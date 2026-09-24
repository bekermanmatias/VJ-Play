import { describe, expect, it } from "vitest";

import { sanitizeAdminRedirect } from "@/server/admin-redirect";

describe("sanitizeAdminRedirect", () => {
  it("permite rutas admin internas", () => {
    expect(sanitizeAdminRedirect("/admin")).toBe("/admin");
    expect(sanitizeAdminRedirect("/admin/")).toBe("/admin/");
    expect(sanitizeAdminRedirect("/admin/replays")).toBe("/admin/replays");
    expect(sanitizeAdminRedirect("/admin/noticias/categorias")).toBe("/admin/noticias/categorias");
  });

  it("hace fallback a /admin con valores vacíos o no string", () => {
    expect(sanitizeAdminRedirect(null)).toBe("/admin");
    expect(sanitizeAdminRedirect(undefined)).toBe("/admin");
    expect(sanitizeAdminRedirect("")).toBe("/admin");
    expect(sanitizeAdminRedirect("   ")).toBe("/admin");
    expect(sanitizeAdminRedirect(42)).toBe("/admin");
  });

  it("bloquea redirecciones externas y esquemas peligrosos", () => {
    expect(sanitizeAdminRedirect("https://evil.example")).toBe("/admin");
    expect(sanitizeAdminRedirect("http://evil.example/admin")).toBe("/admin");
    expect(sanitizeAdminRedirect("//evil.example")).toBe("/admin");
    expect(sanitizeAdminRedirect("//evil.example/admin")).toBe("/admin");
    expect(sanitizeAdminRedirect("javascript:alert(1)")).toBe("/admin");
    expect(sanitizeAdminRedirect("data:text/html,<script>1</script>")).toBe("/admin");
  });

  it("bloquea variantes encoded", () => {
    expect(sanitizeAdminRedirect("%2F%2Fevil.example")).toBe("/admin");
    expect(sanitizeAdminRedirect("%252F%252Fevil.example")).toBe("/admin");
  });

  it("bloquea backslashes, control chars y traversal", () => {
    expect(sanitizeAdminRedirect("/admin\\..\\evil")).toBe("/admin");
    expect(sanitizeAdminRedirect("/admin\r\nSet-Cookie: x=1")).toBe("/admin");
    expect(sanitizeAdminRedirect("/admin\u0000")).toBe("/admin");
    expect(sanitizeAdminRedirect("/admin/../..")).toBe("/admin");
    expect(sanitizeAdminRedirect("/admin/./replays")).toBe("/admin");
  });

  it("bloquea prefijos que no son exactamente /admin", () => {
    expect(sanitizeAdminRedirect("/adminfoo")).toBe("/admin");
    expect(sanitizeAdminRedirect("/administracion")).toBe("/admin");
    expect(sanitizeAdminRedirect("/otra")).toBe("/admin");
  });
});
