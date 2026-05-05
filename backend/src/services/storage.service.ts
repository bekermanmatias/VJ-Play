import { PutObjectCommand } from '@aws-sdk/client-s3';
import { createReadStream } from 'node:fs';
import { env } from '../config/env.js';
import { getR2BucketName, getS3Client } from '../config/s3.js';

export interface UploadFileResult {
  key: string;
  publicUrl?: string;
}

function buildPublicUrl(key: string): string | undefined {
  const base = env.r2PublicBaseUrl;
  if (!base) {
    return undefined;
  }
  return `${base.replace(/\/$/, '')}/${key}`;
}

/**
 * Sube un archivo local a R2 mediante streaming (adecuado para MP4 grandes).
 */
export async function uploadFileToR2(params: {
  key: string;
  filePath: string;
  contentType: string;
  cacheControl?: string;
}): Promise<UploadFileResult> {
  const client = getS3Client();
  const bucket = getR2BucketName();

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: params.key,
      Body: createReadStream(params.filePath),
      ContentType: params.contentType,
      CacheControl: params.cacheControl,
    }),
  );

  return {
    key: params.key,
    publicUrl: buildPublicUrl(params.key),
  };
}
