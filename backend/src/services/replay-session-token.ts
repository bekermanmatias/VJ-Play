import { createHmac, timingSafeEqual } from 'node:crypto';

export type ReplaySessionClaims = {
  mk: string;
  /** Unix timestamp (seconds) */
  iat: number;
  /** Unix timestamp (seconds) */
  exp: number;
};

export function signReplaySessionToken(
  claims: ReplaySessionClaims,
  secret: string,
): string {
  const body = Buffer.from(JSON.stringify(claims)).toString('base64url');
  const sig = createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifyReplaySessionToken(
  token: string,
  secret: string,
): ReplaySessionClaims | null {
  const parts = token.split('.');
  if (parts.length !== 2) {
    return null;
  }
  const body = parts[0];
  const sig = parts[1];
  if (!body || !sig) {
    return null;
  }

  const expectedSig = createHmac('sha256', secret).update(body).digest('base64url');
  const a = Buffer.from(sig, 'utf8');
  const b = Buffer.from(expectedSig, 'utf8');
  if (a.length !== b.length) {
    return null;
  }
  if (!timingSafeEqual(a, b)) {
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
    !('mk' in parsed) ||
    !('iat' in parsed) ||
    !('exp' in parsed)
  ) {
    return null;
  }

  const mk = (parsed as { mk?: unknown }).mk;
  const iat = (parsed as { iat?: unknown }).iat;
  const exp = (parsed as { exp?: unknown }).exp;

  if (typeof mk !== 'string' || typeof iat !== 'number' || typeof exp !== 'number') {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  if (exp <= now) {
    return null;
  }

  return { mk, iat, exp };
}
