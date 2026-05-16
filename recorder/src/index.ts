import { runRecorder } from "./services/recorder.service.js";
import { createLogger } from "./util/log.js";
import { env } from "./config/env.js";

const log = createLogger("main");

log.info("iniciando recorder", {
  VJ_RUNTIME: env.runtime.mode,
  heartbeats: env.runtime.shouldSendHeartbeat ? "on" : "off (local sin RECORDER_ALLOW_HEARTBEAT_IN_LOCAL)",
});
if (env.runtime.isLocal) {
  log.warn(
    "VJ_RUNTIME=local — ideal para probar sin Mikrotik/VPS; en producción usá VJ_RUNTIME=vps",
  );
}

const controller = new AbortController();

function shutdown(signal: NodeJS.Signals): void {
  log.warn(`recibido ${signal}, deteniendo recorder...`);
  controller.abort();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

process.on("unhandledRejection", (reason) => {
  log.error("unhandledRejection", { reason: String(reason) });
});
process.on("uncaughtException", (err) => {
  log.error("uncaughtException", { error: String(err) });
});

runRecorder(controller.signal)
  .then(() => {
    log.info("recorder detenido limpiamente");
    process.exit(0);
  })
  .catch((err) => {
    log.error("recorder abortó", { error: String(err) });
    process.exit(1);
  });
