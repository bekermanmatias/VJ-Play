import { setTimeout as sleep } from "node:timers/promises";
import {
  isWithinRecordingWindow,
  secondsUntilNextWindowChange,
} from "./window.service.js";
import {
  ensureOutputDir,
  listClosedSegments,
  startFfmpegSegment,
  type FfmpegSegmentHandle,
} from "./ffmpeg-segment.service.js";
import {
  cleanupLocal,
  upsertReplayAsset,
  uploadSegmentToR2,
} from "./upload.service.js";
import { sendHeartbeat } from "./heartbeat.service.js";
import type { ResolvedCourt } from "./courts.repo.ts";
import { createLogger } from "../util/log.js";
import { env } from "../config/env.js";

/**
 * Worker por cancha: mantiene un único FFmpeg vivo dentro de la ventana,
 * vigila la carpeta de salida y sube los segmentos cerrados.
 *
 * Estados:
 *   - waiting-window: fuera de ventana → duerme.
 *   - starting:       arrancando ffmpeg.
 *   - recording:      ffmpeg corriendo.
 *   - error:          backoff exponencial y reintenta.
 */

interface WorkerState {
  stopped: boolean;
  ffmpegHandle: FfmpegSegmentHandle | null;
  knownSizes: Map<string, number>;
  uploadedKeys: Set<string>;
  inFlightUploads: Set<string>;
  lastSegmentMatchKey: string | null;
  lastSegmentUploadedAt: string | null;
  lastError: string | null;
  consecutiveFailures: number;
}

const WATCH_INTERVAL_MS = 5_000;
const MAX_BACKOFF_MS = 60_000;

export interface CourtWorkerHandle {
  stop(): Promise<void>;
}

export function startCourtWorker(court: ResolvedCourt): CourtWorkerHandle {
  const log = createLogger(`worker:${court.slug}`);
  const state: WorkerState = {
    stopped: false,
    ffmpegHandle: null,
    knownSizes: new Map(),
    uploadedKeys: new Set(),
    inFlightUploads: new Set(),
    lastSegmentMatchKey: null,
    lastSegmentUploadedAt: null,
    lastError: null,
    consecutiveFailures: 0,
  };

  const heartbeatTimer = setInterval(() => {
    if (state.stopped) return;
    void sendHeartbeat({
      courtSlug: court.slug,
      status: deriveStatus(state),
      currentSegmentMatchKey: deriveCurrentSegmentMatchKey(state),
      lastSegmentMatchKey: state.lastSegmentMatchKey,
      lastSegmentUploadedAt: state.lastSegmentUploadedAt,
      errorMessage: state.lastError,
    });
  }, env.heartbeat.intervalSeconds * 1000);

  const runner = (async () => {
    try {
      await loop();
    } catch (err) {
      log.error("loop principal abortó", { error: String(err) });
    } finally {
      clearInterval(heartbeatTimer);
      await stopFfmpegSafe();
      await sendHeartbeat({ courtSlug: court.slug, status: "paused" });
    }
  })();

  async function loop(): Promise<void> {
    while (!state.stopped) {
      if (!isWithinRecordingWindow()) {
        await stopFfmpegSafe();
        const sec = secondsUntilNextWindowChange();
        log.info("fuera de ventana, durmiendo", { seconds: sec });
        await sleep(sec * 1000);
        continue;
      }

      if (!state.ffmpegHandle) {
        await tryStartFfmpeg();
      }

      await watchSegments();
      await sleep(WATCH_INTERVAL_MS);
    }
  }

  async function tryStartFfmpeg(): Promise<void> {
    state.lastError = null;
    try {
      await ensureOutputDir(court.slug);
      const handle = await startFfmpegSegment(
        { courtSlug: court.slug, rtspUrl: court.rtspUrl },
        (ev) => {
          if (ev.kind === "stderr") {
            log.debug("ffmpeg", { line: ev.line });
          }
          if (ev.kind === "process-exit") {
            log.warn("ffmpeg salió", { code: ev.code, signal: ev.signal });
          }
        },
      );
      state.ffmpegHandle = handle;
      state.consecutiveFailures = 0;
      log.info("ffmpeg arrancado", { pid: handle.pid });

      handle.exited.then(async () => {
        state.ffmpegHandle = null;
        if (!state.stopped && isWithinRecordingWindow()) {
          state.consecutiveFailures += 1;
          const backoff = Math.min(
            MAX_BACKOFF_MS,
            2 ** state.consecutiveFailures * 1000,
          );
          state.lastError = `ffmpeg exited unexpectedly (attempt ${state.consecutiveFailures})`;
          log.warn("backoff antes de reintentar", { ms: backoff });
          await sleep(backoff);
        }
      });
    } catch (err) {
      state.lastError = `no se pudo lanzar ffmpeg: ${String(err)}`;
      log.error(state.lastError);
      state.consecutiveFailures += 1;
      await sleep(Math.min(MAX_BACKOFF_MS, 2 ** state.consecutiveFailures * 1000));
    }
  }

  async function watchSegments(): Promise<void> {
    if (!state.ffmpegHandle) return;
    const { closed, nextSizes } = await listClosedSegments(
      state.ffmpegHandle.outputDir,
      state.knownSizes,
    );
    state.knownSizes = nextSizes;

    // El último archivo de la lista ordenada es probablemente el que está
    // grabando ahora: NO lo subimos hasta que aparezca uno más nuevo.
    const sorted = [...closed].sort();
    const active = newestKey(nextSizes);
    const toUpload = sorted.filter((p) => p !== active);

    for (const localPath of toUpload) {
      if (state.uploadedKeys.has(localPath)) continue;
      if (state.inFlightUploads.has(localPath)) continue;
      state.inFlightUploads.add(localPath);
      void processSegment(localPath).finally(() => {
        state.inFlightUploads.delete(localPath);
      });
    }
  }

  async function processSegment(localPath: string): Promise<void> {
    try {
      const seg = await uploadSegmentToR2({
        courtSlug: court.slug,
        localPath,
      });
      await upsertReplayAsset(seg);
      state.uploadedKeys.add(localPath);
      state.lastSegmentMatchKey = seg.matchKey;
      state.lastSegmentUploadedAt = new Date().toISOString();
      log.info("segmento procesado", { matchKey: seg.matchKey });
      await cleanupLocal(localPath);
    } catch (err) {
      state.lastError = `error subiendo segmento: ${String(err)}`;
      log.error(state.lastError);
    }
  }

  async function stopFfmpegSafe(): Promise<void> {
    if (state.ffmpegHandle) {
      try {
        await state.ffmpegHandle.stop();
      } catch (err) {
        log.warn("error parando ffmpeg", { error: String(err) });
      } finally {
        state.ffmpegHandle = null;
      }
    }
  }

  return {
    async stop() {
      state.stopped = true;
      await stopFfmpegSafe();
      await runner;
    },
  };
}

function deriveStatus(state: WorkerState): "recording" | "starting" | "error" | "idle" {
  if (state.lastError) return "error";
  if (state.ffmpegHandle) return "recording";
  if (!isWithinRecordingWindow()) return "idle";
  return "starting";
}

function deriveCurrentSegmentMatchKey(_state: WorkerState): string | null {
  // El "actual" lo sabemos por el archivo más nuevo. Lo dejamos null por ahora;
  // se puede derivar leyendo el filename más reciente en watchSegments.
  return null;
}

function newestKey(sizes: Map<string, number>): string | null {
  let best: string | null = null;
  for (const k of sizes.keys()) {
    if (!best || k > best) best = k;
  }
  return best;
}
