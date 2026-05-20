import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
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

export async function deleteObjectFromR2(key: string): Promise<void> {
  const k = key.trim();
  if (!k) {
    return;
  }
  const client = getS3Client();
  const bucket = getR2BucketName();
  await client.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: k,
    }),
  );
}

/**
 * URL firmada GET para descarga directa (streaming en el navegador, sin pasar por el API).
 */
export async function getPresignedGetObjectDownloadUrl(params: {
  key: string;
  expiresInSeconds: number;
  responseContentDisposition: string;
  responseContentType?: string;
}): Promise<string> {
  const client = getS3Client();
  const bucket = getR2BucketName();
  const cmd = new GetObjectCommand({
    Bucket: bucket,
    Key: params.key,
    ResponseContentDisposition: params.responseContentDisposition,
    ResponseContentType: params.responseContentType ?? 'video/mp4',
  });
  return getSignedUrl(client, cmd, { expiresIn: params.expiresInSeconds });
}

/** URL firmada GET sin Content-Disposition forzado (p. ej. entrada HTTP para FFmpeg). */
export async function getPresignedGetObjectReadUrl(params: {
  key: string;
  expiresInSeconds: number;
  responseContentType?: string;
}): Promise<string> {
  const client = getS3Client();
  const bucket = getR2BucketName();
  const cmd = new GetObjectCommand({
    Bucket: bucket,
    Key: params.key,
    ResponseContentType: params.responseContentType,
  });
  return getSignedUrl(client, cmd, { expiresIn: params.expiresInSeconds });
}

export async function getObjectStreamFromR2(params: {
  key: string;
}): Promise<{ body: NodeJS.ReadableStream; contentLength?: number; contentType?: string }> {
  const client = getS3Client();
  const bucket = getR2BucketName();
  const out = await client.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: params.key,
    }),
  );
  const body = out.Body;
  if (!body || typeof (body as { pipe?: unknown }).pipe !== 'function') {
    throw new Error('Respuesta R2 sin stream legible');
  }
  const len = out.ContentLength;
  return {
    body: body as NodeJS.ReadableStream,
    contentLength: typeof len === 'number' ? len : undefined,
    contentType: typeof out.ContentType === 'string' ? out.ContentType : undefined,
  };
}
