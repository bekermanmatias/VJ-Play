import { readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { env } from '../config/env.js';

/** Marca tipo navbar: escudo + “Club Social” / “Varela Junior”, esquina aplicada en FFmpeg (arriba derecha del video). */
let cachedPath: string | null = null;
let cachedSig = '';

async function buildWatermarkPngBuffer(escudoPath: string | null): Promise<Buffer> {
  const brandW = 304;
  const brandH = 76;
  const svg = Buffer.from(
    `<svg width="${brandW}" height="${brandH}" xmlns="http://www.w3.org/2000/svg">
      <text x="0" y="22" font-family="Arial, Helvetica, sans-serif" font-weight="800" font-size="13" fill="#0f172a">CLUB SOCIAL</text>
      <text x="0" y="54" font-family="Arial, Helvetica, sans-serif" font-weight="900" font-size="22" fill="#22c55e">VARELA JUNIOR</text>
    </svg>`,
    'utf8',
  );
  const textPng = await sharp(svg).png().toBuffer();

  if (!escudoPath) {
    return textPng;
  }

  try {
    const raw = await readFile(escudoPath);
    const escudoPng = await sharp(raw).resize({ height: 68 }).ensureAlpha().png().toBuffer();
    const meta = await sharp(escudoPng).metadata();
    const ew = meta.width ?? 68;
    const eh = meta.height ?? 68;
    const gap = 14;
    const totalW = ew + gap + brandW;
    const totalH = Math.max(eh, brandH) + 20;

    return sharp({
      create: {
        width: totalW,
        height: totalH,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([
        { input: escudoPng, left: 0, top: Math.floor((totalH - eh) / 2) },
        { input: textPng, left: ew + gap, top: Math.floor((totalH - brandH) / 2) },
      ])
      .png()
      .toBuffer();
  } catch {
    return textPng;
  }
}

/**
 * Ruta a PNG temporal con marca (reutiliza archivo si no cambió la config).
 */
export async function ensureReplayVideoWatermarkPngPath(): Promise<string> {
  const escudo =
    env.replayDownloadEscudoPath?.trim() ||
    env.watermarkPngPath?.trim() ||
    '';
  const sig = escudo || '__text_only__';

  const target = join(tmpdir(), 'vj-replay-video-watermark.png');

  if (cachedPath === target && cachedSig === sig) {
    try {
      await readFile(target);
      return target;
    } catch {
      cachedPath = null;
    }
  }

  const png = await buildWatermarkPngBuffer(escudo ? escudo : null);
  await writeFile(target, png);
  cachedPath = target;
  cachedSig = sig;
  return target;
}
