/**
 * Borra 3 replays del medio, mueve 2 filas a 2026-05-20 13:00 y 14:00 (Supabase + R2).
 * Uso: node scripts/reorganize-replay-assets-2026-05-20.mjs --yes
 */
import { config as loadDotenv } from "dotenv";
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";
import { join } from "node:path";

loadDotenv({ path: join(process.cwd(), ".env") });

const yes = process.argv.includes("--yes");
const dryRun = process.argv.includes("--dry-run") || !yes;

function requireEnv(name) {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Falta ${name} en backend/.env`);
  return v;
}

const r2PublicBase = requireEnv("R2_PUBLIC_BASE_URL").replace(/\/$/, "");
const r2Bucket = requireEnv("R2_BUCKET_NAME");
const s3 = new S3Client({
  region: "auto",
  endpoint:
    process.env.R2_ENDPOINT?.trim() ||
    `https://${requireEnv("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: requireEnv("R2_ACCESS_KEY_ID"),
    secretAccessKey: requireEnv("R2_SECRET_ACCESS_KEY"),
  },
});

const supabase = createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_KEY"), {
  auth: { persistSession: false, autoRefreshToken: false },
});

const TO_DELETE = [
  {
    matchKey: "cancha-padel|2026-05-16|11",
    r2Key: "cvj/replays/cancha-padel/2026-05-16/11.mp4",
  },
  {
    matchKey: "cancha-3|2026-05-16|11",
    r2Key: "cvj/replays/cancha-3/2026-05-16/11.mp4",
  },
  {
    matchKey: "cancha-f5|2026-05-16|11",
    r2Key: "cvj/replays/cancha-f5/2026-05-16/11.mp4",
  },
];

const MOVES = [
  {
    oldMatchKey: "cancha-padel|2026-05-16|12:00",
    newMatchKey: "cancha-padel|2026-05-20|13:00",
    oldR2Key: "cvj/replays/cancha-padel/2026-05-16/12.mp4",
    newR2Key: "cvj/replays/cancha-padel/2026-05-20/13.mp4",
  },
  {
    oldMatchKey: "cancha-padel|2026-05-15|13:00",
    newMatchKey: "cancha-padel|2026-05-20|14:00",
    oldR2Key: "demo/replays/2026-05-15/turno-1300-youtube.mp4",
    newR2Key: "demo/replays/2026-05-20/turno-1400-youtube.mp4",
  },
];

function publicUrl(key) {
  return `${r2PublicBase}/${key}`;
}

async function deleteR2Key(key) {
  if (dryRun) {
    console.log(`[dry-run] R2 delete ${key}`);
    return;
  }
  await s3.send(new DeleteObjectCommand({ Bucket: r2Bucket, Key: key }));
  console.log(`R2 borrado: ${key}`);
}

async function copyR2Key(fromKey, toKey) {
  if (dryRun) {
    console.log(`[dry-run] R2 copy ${fromKey} -> ${toKey}`);
    return;
  }
  await s3.send(
    new CopyObjectCommand({
      Bucket: r2Bucket,
      CopySource: `${r2Bucket}/${fromKey}`,
      Key: toKey,
    }),
  );
  await deleteR2Key(fromKey);
  console.log(`R2 movido: ${fromKey} -> ${toKey}`);
}

async function purgeMatchKeys(matchKeys) {
  for (const mk of matchKeys) {
    if (dryRun) {
      console.log(`[dry-run] Supabase purge ${mk}`);
      continue;
    }
    await supabase.from("replay_clips").delete().eq("match_key", mk);
    await supabase.from("match_access_codes").delete().eq("match_key", mk);
    await supabase.from("replay_match_codes").delete().eq("match_key", mk);
    const { error } = await supabase.from("replay_assets").delete().eq("match_key", mk);
    if (error) throw new Error(`delete replay_assets ${mk}: ${error.message}`);
    console.log(`Supabase borrado: ${mk}`);
  }
}

async function upsertAsset(matchKey, videoUrl, posterUrl = null) {
  if (dryRun) {
    console.log(`[dry-run] upsert ${matchKey} -> ${videoUrl}`);
    return;
  }
  const { error } = await supabase.from("replay_assets").upsert(
    {
      match_key: matchKey,
      video_url: videoUrl,
      poster_url: posterUrl,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "match_key" },
  );
  if (error) throw new Error(`upsert ${matchKey}: ${error.message}`);
  console.log(`Supabase upsert: ${matchKey}`);
}

async function migrateMove({ oldMatchKey, newMatchKey, oldR2Key, newR2Key }) {
  const { data: row } = await supabase
    .from("replay_assets")
    .select("video_url,poster_url")
    .eq("match_key", oldMatchKey)
    .maybeSingle();

  if (!row) {
    console.warn(`No existe en DB: ${oldMatchKey}`);
    return;
  }

  const { data: codeRow } = await supabase
    .from("replay_match_codes")
    .select("plain_code,numeric_id")
    .eq("match_key", oldMatchKey)
    .maybeSingle();

  await copyR2Key(oldR2Key, newR2Key);
  await purgeMatchKeys([oldMatchKey]);
  await upsertAsset(newMatchKey, publicUrl(newR2Key), row.poster_url);

  if (!dryRun && codeRow?.plain_code) {
    const { error: codeErr } = await supabase.from("replay_match_codes").upsert(
      {
        match_key: newMatchKey,
        plain_code: codeRow.plain_code,
        numeric_id: codeRow.numeric_id ?? undefined,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "match_key" },
    );
    if (codeErr) console.warn(`replay_match_codes ${newMatchKey}:`, codeErr.message);
    else console.log(`Código conservado: ${codeRow.plain_code} -> ${newMatchKey}`);
  }
}

async function main() {
  console.log(dryRun ? "=== MODO DRY-RUN ===" : "=== EJECUTANDO ===");

  for (const item of TO_DELETE) {
    await deleteR2Key(item.r2Key);
    await purgeMatchKeys([item.matchKey]);
  }

  for (const move of MOVES) {
    await migrateMove(move);
  }

  const { data: left } = await supabase
    .from("replay_assets")
    .select("match_key,video_url")
    .order("updated_at", { ascending: false });

  console.log("\nQuedó en replay_assets:");
  console.table(left ?? []);
}

await main();
