import sharp from 'sharp';

/** Exporta un frame capturado a JPEG (rotación EXIF automática). */
export async function exportFrameAsJpeg(inputPath: string, outputPath: string): Promise<void> {
  await sharp(inputPath).rotate().jpeg({ quality: 88, mozjpeg: true }).toFile(outputPath);
}
