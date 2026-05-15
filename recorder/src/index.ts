import { runRecorder } from "./services/recorder.service.js";
import { createLogger } from "./util/log.js";

const log = createLogger("main");

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
