/**
 * CLI: prueba la conexión RTSP a una cancha concreta sin grabar nada.
 * Uso: npm run probe -- --court cancha-padel
 */
import { spawn } from "node:child_process";
import { env } from "../config/env.js";
import { listRecordingCourts, resolveRtspUrl } from "../services/courts.repo.js";

function arg(name: string): string | undefined {
  const flag = `--${name}`;
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main(): Promise<void> {
  const slug = arg("court");
  if (!slug) {
    console.error("Uso: npm run probe -- --court <slug>");
    process.exit(1);
  }
  const courts = await listRecordingCourts();
  const c = courts.find((x) => x.slug === slug);
  if (!c) {
    console.error(`No encontré la cancha "${slug}" con recording_enabled=true.`);
    console.error("Disponibles:", courts.map((x) => x.slug).join(", ") || "(ninguna)");
    process.exit(2);
  }
  let url: string;
  try {
    url = resolveRtspUrl(c);
  } catch (e) {
    console.error(String(e));
    process.exit(3);
  }
  const safe = url.replace(/:[^:@/]+@/, ":***@");
  console.log(`[probe] cancha=${c.slug} url=${safe}`);

  const child = spawn(
    env.ffmpeg.ffprobePath,
    [
      "-hide_banner",
      "-rtsp_transport",
      "tcp",
      "-timeout",
      "5000000",
      "-i",
      url,
      "-show_streams",
      "-of",
      "json",
    ],
    { stdio: "inherit" },
  );
  child.on("exit", (code) => process.exit(code ?? 0));
}

void main();
