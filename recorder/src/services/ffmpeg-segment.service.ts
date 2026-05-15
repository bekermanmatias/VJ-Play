import { spawn, type ChildProcessByStdio } from "node:child_process";
import { mkdir, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import type { Readable } from "node:stream";
import { env } from "../config/env.js";
import { createLogger } from "../util/log.js";

/**
 * Wrapper sobre FFmpeg para grabar un RTSP en segmentos contiguos.
 *
 * FFmpeg corre con:
 *   -rtsp_transport tcp -i <url>
 *   -c copy -f segment -segment_time N -reset_timestamps 1 -strftime 1
 *   <localBufferDir>/<courtSlug>/%Y-%m-%d_%H-00.mp4
 *
 * Los archivos que aparecen en la carpeta se procesan cuando dejan de crecer
 * (closed segments). El orquestador escucha esos eventos y los manda a R2.
 */

export interface FfmpegSegmentParams {
  courtSlug: string;
  rtspUrl: string;
}

export type SegmentLifecycle =
  | { kind: "started"; pid: number }
  | { kind: "spawn-error"; error: Error }
  | { kind: "process-exit"; code: number | null; signal: NodeJS.Signals | null }
  | { kind: "stderr"; line: string };

export interface FfmpegSegmentHandle {
  pid: number;
  /** Carpeta donde caen los .mp4 (un subdir por cancha). */
  outputDir: string;
  /** Cierra el ffmpeg con SIGINT para que termine el segmento actual. */
  stop(): Promise<void>;
  /** Promesa que resuelve cuando ffmpeg sale. */
  exited: Promise<{ code: number | null; signal: NodeJS.Signals | null }>;
}

export async function ensureOutputDir(courtSlug: string): Promise<string> {
  const dir = join(env.recording.localBufferDir, courtSlug);
  await mkdir(dir, { recursive: true });
  return dir;
}

export async function startFfmpegSegment(
  params: FfmpegSegmentParams,
  onEvent: (ev: SegmentLifecycle) => void,
): Promise<FfmpegSegmentHandle> {
  const log = createLogger(`ffmpeg:${params.courtSlug}`);
  const outputDir = await ensureOutputDir(params.courtSlug);
  const filenameTemplate = join(outputDir, "%Y-%m-%d_%H-00.mp4");

  const baseArgs = [
    "-hide_banner",
    "-loglevel",
    "warning",
    "-rtsp_transport",
    "tcp",
    "-stimeout",
    "5000000",
    "-i",
    params.rtspUrl,
  ];

  const codecArgs =
    env.recording.videoMode === "h264"
      ? ["-c:v", "libx264", "-preset", "veryfast", "-tune", "zerolatency", "-c:a", "aac"]
      : ["-c", "copy"];

  const segArgs = [
    "-f",
    "segment",
    "-segment_time",
    String(env.recording.segmentSeconds),
    "-segment_format",
    "mp4",
    "-reset_timestamps",
    "1",
    "-strftime",
    "1",
    "-movflags",
    "+faststart",
    filenameTemplate,
  ];

  const args = [...baseArgs, ...codecArgs, ...segArgs];
  log.info("spawn ffmpeg", { outputDir, segmentSeconds: env.recording.segmentSeconds });

  const child: ChildProcessByStdio<null, Readable, Readable> = spawn(env.ffmpeg.path, args, {
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (!child.pid) {
    const err = new Error("ffmpeg no devolvió PID");
    onEvent({ kind: "spawn-error", error: err });
    throw err;
  }
  onEvent({ kind: "started", pid: child.pid });

  child.stderr.setEncoding("utf-8");
  child.stderr.on("data", (chunk: string) => {
    for (const raw of chunk.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line) continue;
      onEvent({ kind: "stderr", line });
    }
  });

  const exited: Promise<{ code: number | null; signal: NodeJS.Signals | null }> = new Promise(
    (resolve) => {
      child.once("exit", (code, signal) => {
        onEvent({ kind: "process-exit", code, signal });
        resolve({ code, signal });
      });
    },
  );

  return {
    pid: child.pid,
    outputDir,
    stop: async () => {
      if (!child.killed) {
        log.info("enviando SIGINT");
        child.kill("SIGINT");
      }
      await exited;
    },
    exited,
  };
}

/**
 * Devuelve los archivos .mp4 del directorio cuyo tamaño no creció en la última
 * verificación: probablemente FFmpeg ya los cerró.
 */
export async function listClosedSegments(
  outputDir: string,
  knownSizes: Map<string, number>,
): Promise<{ closed: string[]; nextSizes: Map<string, number> }> {
  let entries: string[];
  try {
    entries = await readdir(outputDir);
  } catch {
    return { closed: [], nextSizes: knownSizes };
  }
  const next = new Map<string, number>();
  const closed: string[] = [];
  for (const name of entries) {
    if (!name.endsWith(".mp4")) continue;
    const full = join(outputDir, name);
    let size = 0;
    try {
      size = (await stat(full)).size;
    } catch {
      continue;
    }
    next.set(full, size);
    const prev = knownSizes.get(full);
    if (prev !== undefined && prev === size && size > 0) {
      closed.push(full);
    }
  }
  return { closed, nextSizes: next };
}
