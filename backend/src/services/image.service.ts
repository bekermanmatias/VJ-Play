import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { env } from '../config/env.js';

/**
 * Aplica marca de agua (PNG con alpha opcional) y exporta JPEG.
 * sharp delega trabajo pesado al pool de libvips; no usar APIs síncronas de fs.
 */
export async function applyWatermarkAndExportJpeg(
  inputPath: string,
  outputPath: string,
): Promise<void> {
  const base = sharp(inputPath).rotate();

  const watermarkPath = env.watermarkPngPath;
  if (watermarkPath) {
    const overlay = await readFile(watermarkPath);
    await base
      .composite([{ input: overlay, gravity: 'south-east' }])
      .jpeg({ quality: 88, mozjpeg: true })
      .toFile(outputPath);
    return;
  }

  await base.jpeg({ quality: 88, mozjpeg: true }).toFile(outputPath);
}
