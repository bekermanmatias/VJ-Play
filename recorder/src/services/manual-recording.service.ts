import { setTimeout as sleep } from "node:timers/promises";
import { getSupabase } from "../config/supabase.js";
import { createLogger } from "../util/log.js";
import { listRecordingCourts, resolveRtspUrl } from "./courts.repo.js";
import { spawn } from "node:child_process";
import { env } from "../config/env.js";
import { join } from "node:path";
import { mkdir, stat } from "node:fs/promises";
import { Upload } from "@aws-sdk/lib-storage";
import { getR2BucketName, getR2PublicUrl, getS3Client } from "../config/s3.js";
import { createReadStream } from "node:fs";
import { randomBytes } from "node:crypto";

const log = createLogger("manual-recording");

const POLL_INTERVAL_MS = 5000;

interface RequestRow {
  id: string;
  court_slug: string;
  duration_seconds: number;
}

function generateRandomCode(): string {
  // Ej: VJP-3X4B
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  const bytes = randomBytes(6);
  for (let i = 0; i < 6; i++) {
    code += chars[bytes[i]! % chars.length];
  }
  return code;
}

async function recordToFile(rtspUrl: string, outPath: string, seconds: number): Promise<void> {
  await mkdir(join(outPath, ".."), { recursive: true }).catch(() => {});
  const args = [
    "-hide_banner",
    "-loglevel", "error",
    "-rtsp_transport", "tcp",
    "-timeout", "5000000",
    "-i", rtspUrl,
    "-t", String(seconds),
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-crf", "23",
    "-pix_fmt", "yuv420p",
    "-c:a", "aac",
    "-b:a", "128k",
    "-movflags", "+faststart",
    "-y",
    outPath,
  ];
  return new Promise((resolve, reject) => {
    const child = spawn(env.ffmpeg.path, args, { stdio: ["ignore", "ignore", "inherit"] });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg salió con código ${code}`));
    });
  });
}

export async function startManualRecordingWorker(stopSignal: AbortSignal): Promise<void> {
  log.info("iniciando worker de grabación manual");
  
  while (!stopSignal.aborted) {
    try {
      await processPendingRequests();
    } catch (err) {
      log.error("error procesando solicitudes manuales", { error: String(err) });
    }
    
    if (stopSignal.aborted) break;
    
    try {
      await sleep(POLL_INTERVAL_MS, undefined, { signal: stopSignal });
    } catch {
      break;
    }
  }
  log.info("worker de grabación manual detenido");
}

async function processPendingRequests(): Promise<void> {
  const supa = getSupabase();
  const { data: requests, error } = await supa
    .from("recorder_manual_requests")
    .select("id, court_slug, duration_seconds")
    .eq("status", "pending")
    .limit(1);

  if (error || !requests || requests.length === 0) return;

  const req = requests[0] as RequestRow;
  log.info("procesando solicitud manual", { reqId: req.id, courtSlug: req.court_slug });

  // Reclamar la solicitud
  await updateStatus(req.id, "recording");

  try {
    const courts = await listRecordingCourts();
    const court = courts.find(c => c.slug === req.court_slug);
    if (!court) throw new Error("Cancha no encontrada o grabación deshabilitada");

    const rtspUrl = resolveRtspUrl(court);
    
    // Nombres de archivos
    const ymd = new Date().toISOString().split("T")[0];
    const localPath = join(
      env.recording.localBufferDir,
      "manual",
      req.court_slug,
      `${req.id}.mp4`
    );

    // 1. Grabar
    await recordToFile(rtspUrl, localPath, req.duration_seconds);

    // 2. Subir
    await updateStatus(req.id, "uploading");
    
    const key = `${env.tenantId}/replays/manual/${req.court_slug}/${ymd}/${req.id}.mp4`;
    const uploader = new Upload({
      client: getS3Client(),
      params: {
        Bucket: getR2BucketName(),
        Key: key,
        Body: createReadStream(localPath),
        ContentType: "video/mp4",
        CacheControl: "public, max-age=300",
      },
      queueSize: 4,
      partSize: 16 * 1024 * 1024,
    });
    await uploader.done();
    const publicUrl = getR2PublicUrl(key);

    // 3. Registrar en replay_assets
    const matchKey = `manual|${req.court_slug}|${req.id}`;
    const { error: upsertErr } = await supa
      .from("replay_assets")
      .upsert({
        match_key: matchKey,
        video_url: publicUrl,
        updated_at: new Date().toISOString(),
      }, { onConflict: "match_key" });
    if (upsertErr) throw new Error(`upsert asset: ${upsertErr.message}`);

    // 4. Crear código de acceso
    const plainCode = generateRandomCode();
    // Generamos un numericId pseudoaleatorio basado en el ID para mantener consistencia
    const numericId = Math.abs(req.id.split("-").join("").split("").reduce((a,b)=>{a=((a<<5)-a)+b.charCodeAt(0);return a&a},0)) % 1000000000;
    
    const { error: codeErr } = await supa
      .from("replay_match_codes")
      .upsert({
        match_key: matchKey,
        plain_code: plainCode,
        numeric_id: numericId,
        updated_at: new Date().toISOString(),
      }, { onConflict: "match_key" });
    if (codeErr) throw new Error(`upsert code: ${codeErr.message}`);

    // Completado
    await supa.from("recorder_manual_requests").update({
      status: "completed",
      match_key: matchKey,
      plain_code: plainCode,
      numeric_id: numericId
    }).eq("id", req.id);
    
    log.info("solicitud manual completada", { reqId: req.id });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error("falló solicitud manual", { reqId: req.id, error: msg });
    await supa.from("recorder_manual_requests").update({
      status: "error",
      error_message: msg
    }).eq("id", req.id);
  }
}

async function updateStatus(id: string, status: string): Promise<void> {
  const supa = getSupabase();
  await supa.from("recorder_manual_requests").update({ status }).eq("id", id);
}
