import { S3Client } from "@aws-sdk/client-s3";
import { env } from "./env.js";

let cached: S3Client | null = null;

export function getS3Client(): S3Client {
  if (cached) return cached;
  cached = new S3Client({
    region: "auto",
    endpoint: env.r2.endpoint,
    credentials: {
      accessKeyId: env.r2.accessKeyId,
      secretAccessKey: env.r2.secretAccessKey,
    },
  });
  return cached;
}

export function getR2BucketName(): string {
  return env.r2.bucket;
}

export function getR2PublicUrl(key: string): string {
  return `${env.r2.publicBaseUrl}/${key.replace(/^\/+/, "")}`;
}
