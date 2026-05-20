/**
 * Descarga los primeros N segundos de un video de YouTube, sube a R2 y registra replay_assets + código demo.
 *
 * Uso:
 *   node scripts/upload-youtube-replay.mjs --url "https://www.youtube.com/watch?v=..." --date 2026-05-15 --time 13:00
 */
import { createHash } from "node:crypto";
import { mkdir, rm, stat } from "node:fs/promises";
import { spawn } from "node:child_process";
import { join } from "node:path";
import { config as loadDotenv } from "dotenv";
import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  S3Client,
  UploadPartCommand,
} from "@aws-sdk/client-s3";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import { createClient } from "@supabase/supabase-js";
import { Agent } from "node:https";
import ws from "ws";

loadDotenv({ path: join(process.cwd(), ".env") });

function requireEnv(name) {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Falta ${name} en backend/.env`);
  return v;
}

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  if (i === -1 || !process.argv[i + 1]) return null;
  return process.argv[i + 1];
}

const youtubeUrl =
  argValue("--url") ?? "https://www.youtube.com/watch?v=Gy57xLpBOgA";
const matchDate = argValue("--date") ?? "2026-05-15";
const matchTime = argValue("--time") ?? "13:00";
const court = argValue("--court") ?? "cancha-padel";
const durationSec = Number.parseInt(argValue("--seconds") ?? "3600", 10);
const demoCode = (argValue("--code") ?? "DEMO01").toUpperCase().replace(/\s+/g, "");

const matchKey = `${court}|${matchDate}|${matchTime}`;

const jwtSecret = requireEnv("JWT_SESSION_SECRET");
const supabase = createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_KEY"), {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { transport: ws },
});

const r2AccountId = requireEnv("R2_ACCOUNT_ID");
const r2BucketName = requireEnv("R2_BUCKET_NAME");
const r2Endpoint =
  process.env.R2_ENDPOINT?.trim() || `https://${r2AccountId}.r2.cloudflarestorage.com`;
const r2PublicBaseUrl = process.env.R2_PUBLIC_BASE_URL?.trim() || "";
const ffmpegPath = process.env.FFMPEG_PATH?.trim() || "ffmpeg";

const s3 = new S3Client({
  region: "auto",
  endpoint: r2Endpoint,
  credentials: {
    accessKeyId: requireEnv("R2_ACCESS_KEY_ID"),
    secretAccessKey: requireEnv("R2_SECRET_ACCESS_KEY"),
  },
  forcePathStyle: true,
  requestHandler: new NodeHttpHandler({
    requestTimeout: 300_000,
    connectionTimeout: 15_000,
    httpsAgent: new Agent({ keepAlive: false, maxSockets: 1 }),
  }),
});

const workDir = join(process.cwd(), "demo-input", "youtube-tmp");
const rawOut = join(workDir, "raw.%(ext)s");
const finalMp4 = join(workDir, "replay-hour.mp4");

function buildPublicUrl(key) {
  if (r2PublicBaseUrl) {
    return `${r2PublicBaseUrl.replace(/\/$/, "")}/${key}`;
  }
  return `${r2Endpoint.replace(/\/$/, "")}/${r2BucketName}/${key}`;
}

function hashStoredToken(normalizedCode) {
  return createHash("sha256").update(`${jwtSecret}|${normalizedCode}`, "utf8").digest("hex");
}

function numericIdFromMatchKey(mk) {
  const digest = createHash("sha256").update(mk, "utf8").digest("hex");
  return Number.parseInt(digest.slice(0, 12), 16) % 1_000_000_000;
}

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { stdio: "inherit", ...opts });
    proc.on("error", reject);
    proc.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} salió con código ${code}`));
    });
  });
}

async function downloadFirstHour() {
  await mkdir(workDir, { recursive: true });
  console.log(`Descargando primeros ${durationSec}s desde YouTube...`);
  const ytdlpArgs = [
    "-m",
    "yt_dlp",
    "--no-playlist",
    "--ffmpeg-location",
    ffmpegPath,
    "--download-section",
    `*0-${durationSec}`,
    "-f",
    "bv*+ba/b",
    "--merge-output-format",
    "mp4",
    "-o",
    rawOut,
    youtubeUrl,
  ];
  await run("python", ytdlpArgs);

  const { readdir } = await import("node:fs/promises");
  const files = await readdir(workDir);
  const downloaded = files.find((f) => f.startsWith("raw.") && !f.endsWith(".part"));
  if (!downloaded) {
    throw new Error("yt-dlp no generó archivo raw.*");
  }
  const downloadedPath = join(workDir, downloaded);

  console.log("Transcodificando a MP4 compatible (H.264 + AAC, 1h exacta)...");
  await run(ffmpegPath, [
    "-y",
    "-i",
    downloadedPath,
    "-t",
    String(durationSec),
    "-map",
    "0:v:0",
    "-map",
    "0:a?",
    "-c:v",
    "libx264",
    "-preset",
    "medium",
    "-crf",
    "23",
    "-profile:v",
    "high",
    "-level",
    "4.0",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-movflags",
    "+faststart",
    finalMp4,
  ]);

  const st = await stat(finalMp4);
  console.log(`Archivo listo: ${(st.size / 1024 / 1024).toFixed(1)} MB`);
  return finalMp4;
}

async function uploadMultipart(filePath, key) {
  const { readFile } = await import("node:fs/promises");
  const partSize = 5 * 1024 * 1024;
  const fileBuffer = await readFile(filePath);
  const totalParts = Math.ceil(fileBuffer.length / partSize);

  const create = await s3.send(
    new CreateMultipartUploadCommand({
      Bucket: r2BucketName,
      Key: key,
      ContentType: "video/mp4",
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );
  if (!create.UploadId) throw new Error("No se pudo iniciar multipart upload");
  const uploadId = create.UploadId;
  const parts = [];

  try {
    for (let i = 0; i < totalParts; i += 1) {
      const partNumber = i + 1;
      const start = i * partSize;
      const end = Math.min(start + partSize, fileBuffer.length);
      const body = fileBuffer.subarray(start, end);
      const uploaded = await s3.send(
        new UploadPartCommand({
          Bucket: r2BucketName,
          Key: key,
          UploadId: uploadId,
          PartNumber: partNumber,
          Body: body,
          ContentLength: body.length,
        }),
      );
      parts.push({ ETag: uploaded.ETag, PartNumber: partNumber });
      console.log(`  parte ${partNumber}/${totalParts} subida`);
    }
    await s3.send(
      new CompleteMultipartUploadCommand({
        Bucket: r2BucketName,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: { Parts: parts },
      }),
    );
  } catch (err) {
    await s3
      .send(
        new AbortMultipartUploadCommand({
          Bucket: r2BucketName,
          Key: key,
          UploadId: uploadId,
        }),
      )
      .catch(() => {});
    throw err;
  }
}

async function registerSupabase(videoUrl) {
  const numericId = numericIdFromMatchKey(matchKey);
  const tokenHash = hashStoredToken(demoCode);

  const { error: assetErr } = await supabase.from("replay_assets").upsert(
    {
      match_key: matchKey,
      video_url: videoUrl,
      poster_url: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "match_key" },
  );
  if (assetErr) throw new Error(`replay_assets: ${assetErr.message}`);

  const { error: codeErr } = await supabase.from("replay_match_codes").upsert(
    {
      match_key: matchKey,
      plain_code: demoCode,
      numeric_id: numericId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "match_key" },
  );
  if (codeErr) throw new Error(`replay_match_codes: ${codeErr.message}`);

  await supabase.from("match_access_codes").delete().eq("match_key", matchKey).eq("token_hash", tokenHash);

  const { error: accessErr } = await supabase.from("match_access_codes").insert({
    match_key: matchKey,
    token_hash: tokenHash,
    expires_at: null,
    revoked: false,
  });
  if (accessErr) throw new Error(`match_access_codes: ${accessErr.message}`);

  return { numericId, demoCode };
}

async function main() {
  if (demoCode.length !== 6) {
    throw new Error("El código demo debe tener 6 caracteres (ej. DEMO01)");
  }

  console.log(`Partido: ${matchKey}`);
  console.log(`YouTube: ${youtubeUrl}`);

  const filePath = await downloadFirstHour();
  const r2Key = `demo/replays/${matchDate}/turno-${matchTime.replace(":", "")}-youtube.mp4`;
  console.log(`Subiendo a R2: ${r2Key}`);
  await uploadMultipart(filePath, r2Key);

  const videoUrl = buildPublicUrl(r2Key);
  const { numericId, demoCode: code } = await registerSupabase(videoUrl);

  await rm(workDir, { recursive: true, force: true });

  console.log("\nListo.");
  console.log(`match_key: ${matchKey}`);
  console.log(`video_url: ${videoUrl}`);
  console.log(`ID numérico: ${numericId}`);
  console.log(`Código de acceso: ${code}`);
  console.log(`Ver en front: /replays/${numericId}`);
}

await main();
