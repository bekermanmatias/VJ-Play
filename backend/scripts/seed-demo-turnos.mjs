import { promises as fs } from "node:fs";
import { basename, join } from "node:path";
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
import ws from "ws";
import { Agent } from "node:https";

loadDotenv({ path: join(process.cwd(), ".env") });

function requireEnv(name) {
  const v = process.env[name];
  if (!v || v.trim() === "") {
    throw new Error(`Falta ${name} en backend/.env`);
  }
  return v.trim();
}

function localTodayISO() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const supabaseUrl = requireEnv("SUPABASE_URL");
const supabaseKey = requireEnv("SUPABASE_KEY");
const r2AccountId = requireEnv("R2_ACCOUNT_ID");
const r2AccessKeyId = requireEnv("R2_ACCESS_KEY_ID");
const r2SecretAccessKey = requireEnv("R2_SECRET_ACCESS_KEY");
const r2BucketName = requireEnv("R2_BUCKET_NAME");
const r2Endpoint =
  process.env.R2_ENDPOINT?.trim() ||
  `https://${r2AccountId}.r2.cloudflarestorage.com`;
const r2PublicBaseUrl = process.env.R2_PUBLIC_BASE_URL?.trim() || "";

const s3 = new S3Client({
  region: "auto",
  endpoint: r2Endpoint,
  credentials: {
    accessKeyId: r2AccessKeyId,
    secretAccessKey: r2SecretAccessKey,
  },
  forcePathStyle: true,
  requestHandler: new NodeHttpHandler({
    requestTimeout: 30000,
    connectionTimeout: 10000,
    httpsAgent: new Agent({ keepAlive: false, maxSockets: 1 }),
  }),
});

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { transport: ws },
});

const demoDir = join(process.cwd(), "demo-input");
const files = ["turno2.mp4", "turno3.mp4", "turno4.mp4", "turno2.mp4"];
const starts = ["08:00", "09:00", "10:00", "11:00"];
const day = localTodayISO();

function buildPublicUrl(key) {
  if (r2PublicBaseUrl) {
    return `${r2PublicBaseUrl.replace(/\/$/, "")}/${key}`;
  }
  return `${r2Endpoint.replace(/\/$/, "")}/${r2BucketName}/${key}`;
}

const rows = [];

async function uploadMultipartWithRetries({ filePath, key }) {
  const partSize = 5 * 1024 * 1024;
  const maxAttempts = 20;
  const fileBuffer = await fs.readFile(filePath);
  const totalParts = Math.ceil(fileBuffer.length / partSize);

  const create = await s3.send(
    new CreateMultipartUploadCommand({
      Bucket: r2BucketName,
      Key: key,
      ContentType: "video/mp4",
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );
  if (!create.UploadId) {
    throw new Error("No se pudo iniciar multipart upload");
  }
  const uploadId = create.UploadId;

  const parts = [];
  try {
    for (let i = 0; i < totalParts; i += 1) {
      const partNumber = i + 1;
      const start = i * partSize;
      const end = Math.min(start + partSize, fileBuffer.length);
      const body = fileBuffer.subarray(start, end);

      let uploaded = null;
      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
          uploaded = await s3.send(
            new UploadPartCommand({
              Bucket: r2BucketName,
              Key: key,
              UploadId: uploadId,
              PartNumber: partNumber,
              Body: body,
              ContentLength: body.length,
            }),
          );
          break;
        } catch (error) {
          if (attempt === maxAttempts) {
            throw error;
          }
          await new Promise((resolve) => setTimeout(resolve, 700 * attempt));
        }
      }

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
  } catch (error) {
    try {
      await s3.send(
        new AbortMultipartUploadCommand({
          Bucket: r2BucketName,
          Key: key,
          UploadId: uploadId,
        }),
      );
    } catch {
      // Ignorar error de cleanup para no tapar el error real
    }
    throw error;
  }
}

for (let i = 0; i < files.length; i += 1) {
  const file = files[i];
  const abs = join(demoDir, file);
  const key = `demo/replays/${day}/demo-turno-${i + 1}-${basename(file)}`;
  console.log(`Subiendo ${file}...`);
  await uploadMultipartWithRetries({ filePath: abs, key });
  rows.push({
    match_key: `cancha-padel|${day}|${starts[i]}`,
    video_url: buildPublicUrl(key),
    poster_url: null,
    updated_at: new Date().toISOString(),
  });
}

const { error } = await supabase
  .from("replay_assets")
  .upsert(rows, { onConflict: "match_key" });
if (error) {
  throw new Error(`No se pudo upsert replay_assets: ${error.message}`);
}

console.log("Demo cargada OK.");
for (const row of rows) {
  console.log(`${row.match_key} -> ${row.video_url}`);
}
