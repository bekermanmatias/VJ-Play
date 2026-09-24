import { describe, expect, it } from "vitest";

import { getClientIp } from "@/server/admin-client-ip";

function fakeRequest(headers: Record<string, string> = {}): Request {
  return { headers: new Headers(headers) } as unknown as Request;
}

describe("getClientIp", () => {
  it("usa la última entrada de x-forwarded-for (la que agrega el proxy)", () => {
    expect(
      getClientIp(fakeRequest({ "x-forwarded-for": "203.0.113.9, 70.41.3.18, 150.172.238.178" })),
    ).toBe("150.172.238.178");
  });

  it("ignora una primera entrada spoofeada por el cliente", () => {
    expect(getClientIp(fakeRequest({ "x-forwarded-for": "1.2.3.4, 198.51.100.7" }))).toBe(
      "198.51.100.7",
    );
  });

  it("tolera espacios y entradas vacías", () => {
    expect(getClientIp(fakeRequest({ "x-forwarded-for": "  1.2.3.4 ,  5.6.7.8  " }))).toBe(
      "5.6.7.8",
    );
    expect(getClientIp(fakeRequest({ "x-forwarded-for": ", , 9.9.9.9" }))).toBe("9.9.9.9");
  });

  it("usa x-real-ip cuando no hay x-forwarded-for", () => {
    expect(getClientIp(fakeRequest({ "x-real-ip": "198.51.100.20" }))).toBe("198.51.100.20");
  });

  it("cae al fallback del adapter", () => {
    expect(getClientIp(fakeRequest(), "10.0.0.5")).toBe("10.0.0.5");
  });

  it("devuelve 'unknown' si no hay ninguna fuente", () => {
    expect(getClientIp(fakeRequest())).toBe("unknown");
    expect(getClientIp(fakeRequest(), "")).toBe("unknown");
    expect(getClientIp(fakeRequest(), null)).toBe("unknown");
  });
});
