import { describe, expect, it } from "vitest";

import {
  ADMIN_SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  createSessionToken,
  readSessionCookie,
  sessionCookieOptions,
  verifyAdminPassword,
  verifySessionToken,
} from "@/server/admin-session";

const SECRET = "super-secret-admin";
const NOW = 1_700_000_000_000;

describe("verifyAdminPassword", () => {
  it("acepta la contraseña correcta", () => {
    expect(verifyAdminPassword(SECRET, SECRET)).toBe(true);
  });

  it("rechaza una contraseña incorrecta", () => {
    expect(verifyAdminPassword("otra-cosa", SECRET)).toBe(false);
    expect(verifyAdminPassword("", SECRET)).toBe(false);
  });

  it("rechaza si no hay secreto configurado", () => {
    expect(verifyAdminPassword(SECRET, "")).toBe(false);
    expect(verifyAdminPassword("", "")).toBe(false);
  });
});

describe("createSessionToken / verifySessionToken", () => {
  it("hace round-trip válido", () => {
    const token = createSessionToken(NOW, SECRET);
    expect(verifySessionToken(token, NOW, SECRET)).toBe(true);
  });

  it("rechaza un token expirado", () => {
    const token = createSessionToken(NOW, SECRET);
    const later = NOW + (SESSION_TTL_SECONDS + 10) * 1000;
    expect(verifySessionToken(token, later, SECRET)).toBe(false);
  });

  it("rechaza un token firmado con otro secreto", () => {
    const token = createSessionToken(NOW, SECRET);
    expect(verifySessionToken(token, NOW, "otro-secreto")).toBe(false);
  });

  it("rechaza tokens malformados", () => {
    expect(verifySessionToken("", NOW, SECRET)).toBe(false);
    expect(verifySessionToken(null, NOW, SECRET)).toBe(false);
    expect(verifySessionToken(undefined, NOW, SECRET)).toBe(false);
    expect(verifySessionToken("sin-punto", NOW, SECRET)).toBe(false);
    expect(verifySessionToken("noexp.deadbeef", NOW, SECRET)).toBe(false);
    expect(verifySessionToken("123.firma-corta", NOW, SECRET)).toBe(false);
  });

  it("rechaza un payload manipulado", () => {
    const token = createSessionToken(NOW, SECRET);
    const [exp, signature] = token.split(".");
    const forged = `${Number.parseInt(exp, 10) + 9999}.${signature}`;
    expect(verifySessionToken(forged, NOW, SECRET)).toBe(false);
  });
});

describe("readSessionCookie", () => {
  it("extrae la cookie de sesión entre otras", () => {
    expect(readSessionCookie(`foo=1; ${ADMIN_SESSION_COOKIE}=abc.def; bar=2`)).toBe("abc.def");
  });

  it("devuelve null si no está presente", () => {
    expect(readSessionCookie("foo=1; bar=2")).toBeNull();
    expect(readSessionCookie(null)).toBeNull();
    expect(readSessionCookie(undefined)).toBeNull();
  });
});

describe("sessionCookieOptions", () => {
  it("siempre es HttpOnly, SameSite lax y Path raíz", () => {
    const opts = sessionCookieOptions(true);
    expect(opts.httpOnly).toBe(true);
    expect(opts.sameSite).toBe("lax");
    expect(opts.path).toBe("/");
    expect(opts.secure).toBe(true);
    expect(opts.maxAge).toBe(SESSION_TTL_SECONDS);
  });

  it("secure=false fuera de producción", () => {
    expect(sessionCookieOptions(false).secure).toBe(false);
  });
});
