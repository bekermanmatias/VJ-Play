/**
 * Demo: graba N minutos de cada cancha y la deja publicada como replay
 * del turno actual (hora local Argentina). Uso:
 *
 *   npx tsx scripts/grab-demo.ts                    # 5 min, todas las canchas
 *   npx tsx scripts/grab-demo.ts --duration 60      # 1 min, todas
 *   npx tsx scripts/grab-demo.ts --court cancha-padel --duration 300
 *
 * Opcional: si pasás --code XXXXXX y --api-url + --admin-secret crea código
 * de acceso para ver el replay en la web.
 */
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { join } from "node:path";
import { Upload } from "@aws-sdk/lib-storage";
import { env } from "../src/config/env.js";
import { getR2BucketName, getR2PublicUrl, getS3Client } from "../src/config/s3.js";
import { getSupabase } from "../src/config/supabase.js";
import { listRecordingCourts, resolveRtspUrl } from "../src/services/courts.repo.js";

function arg(name: string): string | undefined {
  const flag = `--${name}`;
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function localPartsAr(now: Date = new Date()): { ymd: string; hh: string } {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: env.recording.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const get = (t: string) => fmt.find((p) => p.type === t)?.value ?? "";
  return {
    ymd: `${get("year")}-${get("month")}-${get("day")}`,
    hh: get("hour").padStart(2, "0"),
  };
}

function maskRtsp(url: string): string {
  return url.replace(/:[^:@/]+@/, ":***@");
}

async function recordToFile(
  rtspUrl: string,
  outPath: string,
  seconds: number,
  encode: "copy" | "h264",
): Promise<void> {
  await mkdir(join(outPath, ".."), { recursive: true }).catch(() => {});
  const codecArgs =
    encode === "h264"
      ? [
          // Re-encode a H.264 + AAC para que el navegador (Chrome/Firefox/Safari) lo reproduzca.
          // El DVR Dahua transmite H.265/HEVC que <video> HTML5 no soporta nativo.
          "-c:v",
          "libx264",
          "-preset",
          "veryfast",
          "-crf",
          "23",
          "-pix_fmt",
          "yuv420p",
          "-c:a",
          "aac",
          "-b:a",
          "128k",
        ]
      : ["-c", "copy"];
  const args = [
    "-hide_banner",
    "-loglevel",
    "error",
    "-rtsp_transport",
    "tcp",
    "-timeout",
    "5000000",
    "-i",
    rtspUrl,
    "-t",
    String(seconds),
    ...codecArgs,
    "-movflags",
    "+faststart",
    "-y",
    outPath,
  ];
  console.log(`  ffmpeg -t ${seconds}s (${encode}) → ${outPath}`);
  return new Promise((resolve, reject) => {
    const child = spawn(env.ffmpeg.path, args, { stdio: ["ignore", "ignore", "inherit"] });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg salió con código ${code}`));
    });
  });
}

async function uploadAndUpsert(params: {
  slug: string;
  localPath: string;
  ymd: string;
  hh: string;
}): Promise<{ matchKey: string; publicUrl: string; bytes: number }> {
  const key = `${env.tenantId}/replays/${params.slug}/${params.ymd}/${params.hh}.mp4`;
  // Match key formato HH:MM (compatible con frontend que manda "12:00", no "12")
  const matchKey = `${params.slug}|${params.ymd}|${params.hh}:00`;
  const size = (await stat(params.localPath)).size;

  const uploader = new Upload({
    client: getS3Client(),
    params: {
      Bucket: getR2BucketName(),
      Key: key,
      Body: createReadStream(params.localPath),
      ContentType: "video/mp4",
      CacheControl: "public, max-age=300",
    },
    queueSize: 4,
    partSize: 16 * 1024 * 1024,
  });
  await uploader.done();

  const publicUrl = getR2PublicUrl(key);
  const supa = getSupabase();
  const { error } = await supa
    .from("replay_assets")
    .upsert(
      {
        match_key: matchKey,
        video_url: publicUrl,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "match_key" },
    );
  if (error) {
    throw new Error(`upsert replay_assets ${matchKey}: ${error.message}`);
  }

  return { matchKey, publicUrl, bytes: size };
}

async function createAccessCode(params: {
  apiUrl: string;
  adminSecret: string;
  matchKey: string;
  plainCode: string;
}): Promise<void> {
  const url = `${params.apiUrl.replace(/\/$/, "")}/api/replays/access/codes`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-admin-secret": params.adminSecret,
    },
    body: JSON.stringify({ matchKey: params.matchKey, plainCode: params.plainCode }),
  });
  // Si ya existe el código no falla la demo: igual upserteamos numeric_id abajo.
  if (!res.ok && res.status !== 400) {
    const text = await res.text();
    throw new Error(`crear código (${res.status}): ${text.slice(0, 200)}`);
  }
}

/** Mismo cálculo que el backend: numeric_id estable a partir del match_key. */
function numericIdFromMatchKey(matchKey: string): number {
  const digest = createHash("sha256").update(matchKey, "utf8").digest("hex");
  return Number.parseInt(digest.slice(0, 12), 16) % 1_000_000_000;
}

async function upsertMatchCode(params: {
  matchKey: string;
  plainCode: string;
}): Promise<number> {
  const supa = getSupabase();
  const numericId = numericIdFromMatchKey(params.matchKey);
  const { error } = await supa.from("replay_match_codes").upsert(
    {
      match_key: params.matchKey,
      plain_code: params.plainCode,
      numeric_id: numericId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "match_key" },
  );
  if (error) {
    throw new Error(`upsert replay_match_codes ${params.matchKey}: ${error.message}`);
  }
  return numericId;
}

async function main(): Promise<void> {
  const durationSec = Number(arg("duration") ?? 300);
  const courtFilter = arg("court");
  const plainCode = arg("code");
  const apiUrl = arg("api-url") ?? "http://localhost:4000";
  const adminSecret = arg("admin-secret");
  // Default: h264 (compatible con <video> HTML5). Usar --encode copy si querés HEVC crudo.
  const encodeRaw = (arg("encode") ?? "h264").toLowerCase();
  const encode = encodeRaw === "copy" ? "copy" : "h264";

  if (!Number.isFinite(durationSec) || durationSec < 10 || durationSec > 1800) {
    throw new Error("--duration debe estar entre 10 y 1800 segundos");
  }

  const courts = await listRecordingCourts();
  const targets = courtFilter ? courts.filter((c) => c.slug === courtFilter) : courts;
  if (targets.length === 0) {
    throw new Error(`No hay canchas con recording_enabled (${courtFilter ?? "todas"})`);
  }

  const { ymd, hh } = localPartsAr();
  console.log(`\n=== Demo grab — turno ${ymd} ${hh}:00 — duración ${durationSec}s ===`);
  console.log(`Canchas: ${targets.map((t) => t.slug).join(", ")}\n`);

  for (const court of targets) {
    const c = { ...court, rtspUrl: resolveRtspUrl(court) };
    console.log(`▶ ${c.slug}  (${maskRtsp(c.rtspUrl)})`);

    const localPath = join(
      env.recording.localBufferDir,
      c.slug,
      `${ymd}_${hh}-00.mp4`,
    );

    try {
      await recordToFile(c.rtspUrl, localPath, durationSec, encode);
      const up = await uploadAndUpsert({
        slug: c.slug,
        localPath,
        ymd,
        hh,
      });
      console.log(`  ✓ subido ${(up.bytes / 1024 / 1024).toFixed(1)} MB`);
      console.log(`  ✓ match_key: ${up.matchKey}`);
      console.log(`  ✓ video_url: ${up.publicUrl}`);

      if (plainCode && adminSecret) {
        try {
          await createAccessCode({
            apiUrl,
            adminSecret,
            matchKey: up.matchKey,
            plainCode,
          });
          const numericId = await upsertMatchCode({
            matchKey: up.matchKey,
            plainCode,
          });
          console.log(`  ✓ código ${plainCode} (ID partido: ${numericId})`);
        } catch (err) {
          console.warn(`  ! no se pudo crear código: ${String(err)}`);
        }
      }
    } catch (err) {
      console.error(`  ✗ ${String(err)}`);
    }
    console.log();
  }

  console.log("Listo. Probá en el frontend → /replays");
  console.log(`  Cancha: <la que grabaste>   Fecha: ${ymd}   Hora: ${hh}:00`);
  if (plainCode) {
    console.log(`  Código: ${plainCode}`);
  }
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
