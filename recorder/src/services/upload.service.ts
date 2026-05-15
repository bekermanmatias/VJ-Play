import { createReadStream } from "node:fs";
import { stat, unlink } from "node:fs/promises";
import { basename } from "node:path";
import { Upload } from "@aws-sdk/lib-storage";
import { getR2BucketName, getR2PublicUrl, getS3Client } from "../config/s3.js";
import { getSupabase } from "../config/supabase.js";
import { env } from "../config/env.js";
import { createLogger } from "../util/log.js";

const log = createLogger("upload");

/**
 * Convierte el nombre `YYYY-MM-DD_HH-00.mp4` en match_key `cancha|YYYY-MM-DD|HH`.
 */
export function deriveMatchKey(courtSlug: string, filename: string): string {
  const base = basename(filename, ".mp4");
  const m = base.match(/^(\d{4}-\d{2}-\d{2})_(\d{2})-/);
  if (!m) {
    throw new Error(`[upload] no se pudo parsear match_key de "${filename}"`);
  }
  return `${courtSlug}|${m[1]}|${m[2]}`;
}

export function buildR2Key(courtSlug: string, filename: string): string {
  const base = basename(filename, ".mp4");
  const m = base.match(/^(\d{4}-\d{2}-\d{2})_(\d{2})-/);
  const ymd = m?.[1] ?? "unknown-date";
  const hh = m?.[2] ?? "00";
  return `${env.tenantId}/replays/${courtSlug}/${ymd}/${hh}.mp4`;
}

export interface UploadedSegment {
  matchKey: string;
  key: string;
  publicUrl: string;
  bytes: number;
}

export async function uploadSegmentToR2(params: {
  courtSlug: string;
  localPath: string;
}): Promise<UploadedSegment> {
  const filename = basename(params.localPath);
  const key = buildR2Key(params.courtSlug, filename);
  const matchKey = deriveMatchKey(params.courtSlug, filename);
  const size = (await stat(params.localPath)).size;

  log.info("subiendo segmento", { matchKey, key, bytes: size });

  const uploader = new Upload({
    client: getS3Client(),
    params: {
      Bucket: getR2BucketName(),
      Key: key,
      Body: createReadStream(params.localPath),
      ContentType: "video/mp4",
      CacheControl: "public, max-age=2592000, immutable",
    },
    queueSize: 4,
    partSize: 16 * 1024 * 1024,
  });

  await uploader.done();
  log.info("subida ok", { matchKey, key });

  return {
    matchKey,
    key,
    publicUrl: getR2PublicUrl(key),
    bytes: size,
  };
}

export async function upsertReplayAsset(seg: UploadedSegment): Promise<void> {
  const supa = getSupabase();
  const { error } = await supa
    .from("replay_assets")
    .upsert(
      {
        match_key: seg.matchKey,
        video_url: seg.publicUrl,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "match_key" },
    );
  if (error) {
    throw new Error(`[upload] no se pudo upsert replay_assets ${seg.matchKey}: ${error.message}`);
  }
}

export async function cleanupLocal(localPath: string): Promise<void> {
  if (env.recording.localRetentionHours === 0) {
    try {
      await unlink(localPath);
      log.debug("local borrado", { localPath });
    } catch (e) {
      log.warn("no se pudo borrar local", { localPath, error: String(e) });
    }
  }
  // Si retentionHours > 0 el cleanup lo hace un task separado por modificación.
}
