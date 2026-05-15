import { createHmac, timingSafeEqual } from 'node:crypto';

/** Claims firmados para autorizar un GET de streaming con marca de agua. Token corto y de un solo uso lógico. */
export type WatermarkedStreamClaims = {
  /** match_key */
  mk: string;
  /** filename para Content-Disposition */
  fn: string;
  /** epoch seconds */
  exp: number;
};

function b64url(input: Buffer): string {
  return input.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(input: string): Buffer {
  const pad = input.length % 4 === 0 ? 0 : 4 - (input.length % 4);
  const norm = input.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(pad);
  return Buffer.from(norm, 'base64');
}

export function signWatermarkedStreamToken(claims: WatermarkedStreamClaims, secret: string): string {
  const payload = b64url(Buffer.from(JSON.stringify(claims), 'utf8'));
  const sig = b64url(createHmac('sha256', secret).update(payload).digest());
  return `${payload}.${sig}`;
}

export function verifyWatermarkedStreamToken(
  token: string,
  secret: string,
): WatermarkedStreamClaims | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const payload = parts[0];
  const sig = parts[1];
  if (!payload || !sig) return null;
  const expected = createHmac('sha256', secret).update(payload).digest();
  const provided = b64urlDecode(sig);
  if (provided.length !== expected.length) return null;
  if (!timingSafeEqual(provided, expected)) return null;
  let claims: WatermarkedStreamClaims;
  try {
    claims = JSON.parse(b64urlDecode(payload).toString('utf8')) as WatermarkedStreamClaims;
  } catch {
    return null;
  }
  if (!claims || typeof claims.mk !== 'string' || typeof claims.fn !== 'string') return null;
  if (typeof claims.exp !== 'number' || claims.exp < Math.floor(Date.now() / 1000)) return null;
  return claims;
}
