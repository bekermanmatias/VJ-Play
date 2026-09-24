import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { serverEnv } from "@/server/server-env";

/** Nombre de la cookie de sesión administrativa. */
export const ADMIN_SESSION_COOKIE = "vj_admin_session";

/** TTL de la sesión administrativa: 12 horas. */
export const SESSION_TTL_SECONDS = 60 * 60 * 12;

/** Secreto administrativo. Vive únicamente en el runtime del servidor. */
export function getAdminSecret(): string {
  return (serverEnv("ADMIN_SECRET") ?? "").trim();
}

export function isAdminConfigured(secret: string = getAdminSecret()): boolean {
  return secret.length > 0;
}

function sha256(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

/** Comparación en tiempo constante entre dos buffers del mismo largo. */
function safeEqual(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
}

/**
 * Verifica la contraseña ingresada contra ADMIN_SECRET.
 * Se comparan hashes de largo fijo para no filtrar el largo del secreto.
 */
export function verifyAdminPassword(
  input: string,
  secret: string = getAdminSecret(),
): boolean {
  if (!isAdminConfigured(secret)) {
    return false;
  }
  return safeEqual(sha256(input), sha256(secret));
}

function sessionKey(secret: string): Buffer {
  return sha256(`vj-admin-session|${secret}`);
}

function signPayload(payload: string, secret: string): string {
  return createHmac("sha256", sessionKey(secret)).update(payload, "utf8").digest("hex");
}

/** Crea un token de sesión firmado con formato `<expiraEn>.<firmaHmac>`. */
export function createSessionToken(
  nowMs: number = Date.now(),
  secret: string = getAdminSecret(),
): string {
  const expiresAt = Math.floor(nowMs / 1000) + SESSION_TTL_SECONDS;
  const payload = String(expiresAt);
  return `${payload}.${signPayload(payload, secret)}`;
}

/** Valida firma y expiración del token de sesión. */
export function verifySessionToken(
  token: string | null | undefined,
  nowMs: number = Date.now(),
  secret: string = getAdminSecret(),
): boolean {
  if (!token || !isAdminConfigured(secret)) {
    return false;
  }
  const dot = token.indexOf(".");
  if (dot <= 0) {
    return false;
  }
  const payload = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  if (!/^\d+$/.test(payload) || !/^[0-9a-f]{64}$/.test(signature)) {
    return false;
  }
  const expected = signPayload(payload, secret);
  if (!safeEqual(Buffer.from(signature, "utf8"), Buffer.from(expected, "utf8"))) {
    return false;
  }
  const expiresAt = Number.parseInt(payload, 10);
  if (!Number.isFinite(expiresAt)) {
    return false;
  }
  return Math.floor(nowMs / 1000) < expiresAt;
}

export interface SessionCookieOptions {
  httpOnly: boolean;
  sameSite: "lax";
  secure: boolean;
  path: string;
  maxAge: number;
}

export function sessionCookieOptions(
  secure: boolean,
  maxAge: number = SESSION_TTL_SECONDS,
): SessionCookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge,
  };
}

/** Extrae el valor de la cookie de sesión desde el header Cookie. */
export function readSessionCookie(cookieHeader: string | null | undefined): string | null {
  if (!cookieHeader) {
    return null;
  }
  for (const part of cookieHeader.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) {
      continue;
    }
    const name = part.slice(0, eq).trim();
    if (name !== ADMIN_SESSION_COOKIE) {
      continue;
    }
    try {
      return decodeURIComponent(part.slice(eq + 1).trim());
    } catch {
      return null;
    }
  }
  return null;
}

/** Detecta si la request llegó por HTTPS (respetando proxies). */
export function isSecureRequest(request: Request): boolean {
  const forwarded = request.headers.get("x-forwarded-proto");
  if (forwarded) {
    return forwarded.split(",")[0].trim() === "https";
  }
  try {
    return new URL(request.url).protocol === "https:";
  } catch {
    return false;
  }
}
