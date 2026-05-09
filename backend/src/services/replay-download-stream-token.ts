import { createHmac, timingSafeEqual } from 'node:crypto';

/** Token corto para abrir el stream de descarga con marca (iframe sin header Authorization). */
export type WatermarkedStreamClaims = {
  mk: string;
  /** Nombre sugerido del archivo .mp4 */
  fn: string;
  exp: number;
};

export function signWatermarkedStreamToken(
  claims: WatermarkedStreamClaims,
  secret: string,
): string {
  const body = Buffer.from(JSON.stringify(claims)).toString('base64url');
  const sig = createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifyWatermarkedStreamToken(
  token: string,
  secret: string,
): WatermarkedStreamClaims | null {
  const parts = token.split('.');
  if (parts.length !== 2) {
    return null;
  }
  const [body, sig] = parts;
  if (!body || !sig) {
    return null;
  }
  const expectedSig = createHmac('sha256', secret).update(body).digest('base64url');
  const a = Buffer.from(sig, 'utf8');
  const b = Buffer.from(expectedSig, 'utf8');
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (
    !parsed ||
    typeof parsed !== 'object' ||
    typeof (parsed as { mk?: unknown }).mk !== 'string' ||
    typeof (parsed as { fn?: unknown }).fn !== 'string' ||
    typeof (parsed as { exp?: unknown }).exp !== 'number'
  ) {
    return null;
  }
  const exp = (parsed as { exp: number }).exp;
  const now = Math.floor(Date.now() / 1000);
  if (exp <= now) {
    return null;
  }
  return {
    mk: (parsed as { mk: string }).mk,
    fn: (parsed as { fn: string }).fn,
    exp,
  };
}
