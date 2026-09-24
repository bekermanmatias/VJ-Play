import { beforeEach, describe, expect, it } from "vitest";

import { checkRateLimit, clearRateLimits, resetRateLimit } from "@/server/admin-ratelimit";

describe("checkRateLimit", () => {
  beforeEach(() => {
    clearRateLimits();
  });

  it("permite hasta el máximo y bloquea el siguiente intento", () => {
    const options = { max: 3, windowMs: 1000 };
    expect(checkRateLimit("k", options, 0)).toBe(true);
    expect(checkRateLimit("k", options, 1)).toBe(true);
    expect(checkRateLimit("k", options, 2)).toBe(true);
    expect(checkRateLimit("k", options, 3)).toBe(false);
  });

  it("reinicia el contador pasada la ventana", () => {
    const options = { max: 1, windowMs: 1000 };
    expect(checkRateLimit("k", options, 0)).toBe(true);
    expect(checkRateLimit("k", options, 500)).toBe(false);
    expect(checkRateLimit("k", options, 1000)).toBe(true);
  });

  it("separa por clave", () => {
    const options = { max: 1, windowMs: 1000 };
    expect(checkRateLimit("a", options, 0)).toBe(true);
    expect(checkRateLimit("b", options, 0)).toBe(true);
    expect(checkRateLimit("a", options, 0)).toBe(false);
  });

  it("resetRateLimit limpia la clave", () => {
    const options = { max: 1, windowMs: 1000 };
    expect(checkRateLimit("k", options, 0)).toBe(true);
    resetRateLimit("k");
    expect(checkRateLimit("k", options, 0)).toBe(true);
  });
});
