import { setTimeout as sleep } from "node:timers/promises";
import { listRecordingCourts, resolveCourt } from "./courts.repo.js";
import { startCourtWorker, type CourtWorkerHandle } from "./court-worker.js";
import { createLogger } from "../util/log.js";

const log = createLogger("recorder");

/** Tiempo entre re-checkeos de la lista de canchas activas. */
const COURTS_RELOAD_INTERVAL_MS = 60_000;

interface RunningWorker {
  handle: CourtWorkerHandle;
}

export async function runRecorder(stopSignal: AbortSignal): Promise<void> {
  const workers = new Map<string, RunningWorker>();

  async function reconcile(): Promise<void> {
    const courts = await listRecordingCourts();
    const wanted = new Set(courts.map((c) => c.slug));
    log.info("reconcile", { wantedCourts: [...wanted] });

    for (const [slug, w] of workers) {
      if (!wanted.has(slug)) {
        log.info("apagando worker (cancha ya no activa)", { slug });
        await w.handle.stop();
        workers.delete(slug);
      }
    }
    for (const c of courts) {
      if (workers.has(c.slug)) continue;
      try {
        const resolved = resolveCourt(c);
        log.info("arrancando worker", { slug: c.slug });
        const handle = startCourtWorker(resolved);
        workers.set(c.slug, { handle });
      } catch (err) {
        log.error("no se pudo resolver cancha", { slug: c.slug, error: String(err) });
      }
    }
  }

  await reconcile();

  while (!stopSignal.aborted) {
    try {
      await sleep(COURTS_RELOAD_INTERVAL_MS, undefined, { signal: stopSignal });
    } catch {
      break;
    }
    if (stopSignal.aborted) break;
    try {
      await reconcile();
    } catch (err) {
      log.error("reconcile falló", { error: String(err) });
    }
  }

  log.info("apagando todos los workers");
  await Promise.allSettled([...workers.values()].map((w) => w.handle.stop()));
  workers.clear();
}
