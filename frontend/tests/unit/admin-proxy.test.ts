import { describe, expect, it } from "vitest";

import { hasValidOrigin, isAllowedAdminProxyRequest } from "@/server/admin-proxy";

describe("isAllowedAdminProxyRequest", () => {
  it("acepta las rutas administrativas conocidas", () => {
    expect(isAllowedAdminProxyRequest("GET", "/replays/admin/courts-dvr")).toBe(true);
    expect(isAllowedAdminProxyRequest("PATCH", "/replays/admin/courts-dvr/cancha-padel")).toBe(true);
    expect(isAllowedAdminProxyRequest("POST", "/replays/admin/courts-dvr/cancha-padel/probe")).toBe(
      true,
    );
    expect(isAllowedAdminProxyRequest("GET", "/replays/admin/recorder-status")).toBe(true);
    expect(isAllowedAdminProxyRequest("POST", "/replays/admin/manual-record")).toBe(true);
    expect(isAllowedAdminProxyRequest("GET", "/replays/admin/manual-record/abc")).toBe(true);
    expect(isAllowedAdminProxyRequest("GET", "/replays/admin/matches")).toBe(true);
    expect(isAllowedAdminProxyRequest("PUT", "/replays/courts")).toBe(true);
    expect(isAllowedAdminProxyRequest("PUT", "/replays/shift-config")).toBe(true);
    expect(isAllowedAdminProxyRequest("POST", "/replays/access/codes")).toBe(true);
    expect(isAllowedAdminProxyRequest("GET", "/news/admin/list")).toBe(true);
    expect(isAllowedAdminProxyRequest("POST", "/news/admin")).toBe(true);
    expect(isAllowedAdminProxyRequest("POST", "/news/admin/123/images")).toBe(true);
    expect(isAllowedAdminProxyRequest("PATCH", "/news/admin/123/images/9/main")).toBe(true);
    expect(isAllowedAdminProxyRequest("DELETE", "/news/admin/123/images/9")).toBe(true);
    expect(isAllowedAdminProxyRequest("PUT", "/news/admin/categories")).toBe(true);
    expect(isAllowedAdminProxyRequest("GET", "/banners/admin/list")).toBe(true);
    expect(isAllowedAdminProxyRequest("POST", "/banners/admin/5/image")).toBe(true);
    expect(isAllowedAdminProxyRequest("DELETE", "/banners/admin/5")).toBe(true);
  });

  it("rechaza rutas públicas, métodos no permitidos y escapes de path", () => {
    expect(isAllowedAdminProxyRequest("GET", "/replays/courts")).toBe(false);
    expect(isAllowedAdminProxyRequest("POST", "/replays/access/verify")).toBe(false);
    expect(isAllowedAdminProxyRequest("DELETE", "/replays/admin/matches")).toBe(false);
    expect(isAllowedAdminProxyRequest("GET", "/payment/status")).toBe(false);
    expect(isAllowedAdminProxyRequest("GET", "/users")).toBe(false);
    expect(isAllowedAdminProxyRequest("GET", "/replays/admin/courts-dvr/../../secreto")).toBe(false);
    expect(isAllowedAdminProxyRequest("GET", "/replays/admin/courts-dvr/")).toBe(false);
  });
});

describe("hasValidOrigin", () => {
  const url = "https://vj.example/admin/api/replays/courts";

  function fakeRequest(method: string, headers: Record<string, string> = {}): Request {
    return { method, url, headers: new Headers(headers) } as unknown as Request;
  }

  it("permite métodos de lectura sin Origin", () => {
    expect(hasValidOrigin(fakeRequest("GET"))).toBe(true);
    expect(hasValidOrigin(fakeRequest("HEAD"))).toBe(true);
  });

  it("exige Origin propio en métodos mutativos", () => {
    expect(hasValidOrigin(fakeRequest("POST"))).toBe(false);
    expect(hasValidOrigin(fakeRequest("POST", { origin: "https://vj.example" }))).toBe(true);
    expect(hasValidOrigin(fakeRequest("POST", { origin: "https://evil.example" }))).toBe(false);
  });

  it("acepta Referer propio cuando no hay Origin", () => {
    expect(
      hasValidOrigin(fakeRequest("PATCH", { referer: "https://vj.example/admin/replays" })),
    ).toBe(true);
    expect(hasValidOrigin(fakeRequest("PATCH", { referer: "https://evil.example/x" }))).toBe(false);
  });
});
