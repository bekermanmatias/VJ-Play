import { S3Client } from '@aws-sdk/client-s3';
import { env } from './env.js';

let s3: S3Client | null = null;

export function getS3Client(): S3Client {
  if (!s3) {
    s3 = new S3Client({
      region: 'auto',
      endpoint: env.r2Endpoint,
      credentials: {
        accessKeyId: env.r2AccessKeyId,
        secretAccessKey: env.r2SecretAccessKey,
      },
    });
  }
  return s3;
}

export function getR2BucketName(): string {
  return env.r2BucketName;
}
