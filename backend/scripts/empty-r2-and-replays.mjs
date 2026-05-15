/**
 * Vacía todos los objetos del bucket R2 y borra filas de replay en Supabase
 * (assets, clips, códigos) para empezar de cero con demos nuevos.
 *
 * Uso:
 *   node scripts/empty-r2-and-replays.mjs --dry-run
 *   node scripts/empty-r2-and-replays.mjs --yes
 */
import { config as loadDotenv } from "dotenv";
import {
  DeleteObjectsCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";
import { join } from "node:path";

loadDotenv({ path: join(process.cwd(), ".env") });

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Falta ${name} en backend/.env`);
  return value;
}

const dryRun = process.argv.includes("--dry-run");
const confirmed = process.argv.includes("--yes");

if (!dryRun && !confirmed) {
  console.error("Modo seguro: agregá --yes para borrar o --dry-run para simular.");
  process.exit(1);
}

const r2AccountId = requireEnv("R2_ACCOUNT_ID");
const r2BucketName = requireEnv("R2_BUCKET_NAME");
const r2Endpoint =
  process.env.R2_ENDPOINT?.trim() ||
  `https://${r2AccountId}.r2.cloudflarestorage.com`;

const s3 = new S3Client({
  region: "auto",
  endpoint: r2Endpoint,
  credentials: {
    accessKeyId: requireEnv("R2_ACCESS_KEY_ID"),
    secretAccessKey: requireEnv("R2_SECRET_ACCESS_KEY"),
  },
});

const supabase = createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_KEY"), {
  auth: { persistSession: false, autoRefreshToken: false },
});

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function listAllObjectKeys() {
  const keys = [];
  let continuationToken;
  do {
    const out = await s3.send(
      new ListObjectsV2Command({
        Bucket: r2BucketName,
        ContinuationToken: continuationToken,
      }),
    );
    for (const item of out.Contents ?? []) {
      if (item.Key) keys.push(item.Key);
    }
    continuationToken = out.IsTruncated ? out.NextContinuationToken : undefined;
  } while (continuationToken);
  return keys;
}

async function deleteR2Keys(keys) {
  let deleted = 0;
  for (const batch of chunk(keys, 1000)) {
    if (dryRun) {
      deleted += batch.length;
      continue;
    }
    const res = await s3.send(
      new DeleteObjectsCommand({
        Bucket: r2BucketName,
        Delete: {
          Objects: batch.map((Key) => ({ Key })),
          Quiet: true,
        },
      }),
    );
    deleted += batch.length - (res.Errors?.length ?? 0);
    if (res.Errors?.length) {
      for (const err of res.Errors) {
        console.warn(`[r2-delete-error] ${err.Key}: ${err.Message}`);
      }
    }
  }
  return deleted;
}

async function countTable(name) {
  const { count, error } = await supabase.from(name).select("*", { count: "exact", head: true });
  if (error) throw new Error(`${name}: ${error.message}`);
  return count ?? 0;
}

async function deleteAllInTable(name, filterColumn) {
  const { error, count } = await supabase
    .from(name)
    .delete({ count: "exact" })
    .gte(filterColumn, "1970-01-01T00:00:00Z");
  if (error) throw new Error(`${name}: ${error.message}`);
  return count ?? 0;
}

async function clearSupabaseReplays() {
  const steps = [
    { name: "replay_clips", label: "clips", col: "created_at" },
    { name: "replay_match_codes", label: "códigos visibles", col: "updated_at" },
    { name: "match_access_codes", label: "códigos de acceso", col: "created_at" },
    { name: "replay_assets", label: "partidos (assets)", col: "updated_at" },
  ];

  const summary = {};
  for (const { name, label, col } of steps) {
    if (dryRun) {
      summary[label] = await countTable(name);
    } else {
      summary[label] = await deleteAllInTable(name, col);
    }
  }
  return summary;
}

async function main() {
  console.log(`Bucket: ${r2BucketName}`);
  console.log(dryRun ? "Modo: dry-run (no se borra nada)" : "Modo: BORRADO REAL");

  const keys = await listAllObjectKeys();
  console.log(`Objetos en R2: ${keys.length}`);
  if (keys.length > 0 && keys.length <= 20) {
    for (const k of keys) console.log(`  - ${k}`);
  } else if (keys.length > 20) {
    for (const k of keys.slice(0, 5)) console.log(`  - ${k}`);
    console.log(`  ... y ${keys.length - 5} más`);
  }

  const r2Deleted = await deleteR2Keys(keys);
  console.log(`R2: ${dryRun ? "se borrarían" : "borrados"} ${r2Deleted} objeto(s)`);

  const db = await clearSupabaseReplays();
  console.log("Supabase:");
  for (const [label, n] of Object.entries(db)) {
    console.log(`  - ${label}: ${dryRun ? "se borrarían" : "borradas"} ${n} fila(s)`);
  }

  console.log(dryRun ? "\nListo (simulación). Ejecutá con --yes para aplicar." : "\nListo. Podés subir demos nuevos.");
}

await main();
