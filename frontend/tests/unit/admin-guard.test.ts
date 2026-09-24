import { describe, expect, it } from "vitest";

import { decideAdminAccess } from "@/server/admin-guard";

describe("decideAdminAccess", () => {
  it("permite login y logout API sin sesión", () => {
    expect(decideAdminAccess({ pathname: "/admin/api/login", hasValidSession: false })).toEqual({
      action: "next",
    });
    expect(decideAdminAccess({ pathname: "/admin/api/logout", hasValidSession: false })).toEqual({
      action: "next",
    });
  });

  it("redirige las páginas admin a login sin sesión, conservando next", () => {
    expect(decideAdminAccess({ pathname: "/admin", hasValidSession: false })).toEqual({
      action: "redirect",
      to: "/admin/login?next=%2Fadmin",
    });
    expect(decideAdminAccess({ pathname: "/admin/replays", hasValidSession: false })).toEqual({
      action: "redirect",
      to: "/admin/login?next=%2Fadmin%2Freplays",
    });
  });

  it("permite las páginas admin con sesión", () => {
    expect(decideAdminAccess({ pathname: "/admin", hasValidSession: true })).toEqual({
      action: "next",
    });
    expect(decideAdminAccess({ pathname: "/admin/replays", hasValidSession: true })).toEqual({
      action: "next",
    });
  });

  it("redirige /admin/login a /admin si ya hay sesión", () => {
    expect(decideAdminAccess({ pathname: "/admin/login", hasValidSession: true })).toEqual({
      action: "redirect",
      to: "/admin",
    });
    expect(decideAdminAccess({ pathname: "/admin/login", hasValidSession: false })).toEqual({
      action: "next",
    });
  });

  it("devuelve unauthorized para /admin/api sin sesión", () => {
    expect(
      decideAdminAccess({ pathname: "/admin/api/replays/admin/matches", hasValidSession: false }),
    ).toEqual({ action: "unauthorized" });
    expect(
      decideAdminAccess({ pathname: "/admin/api/replays/admin/matches", hasValidSession: true }),
    ).toEqual({ action: "next" });
  });

  it("no interfiere con rutas públicas", () => {
    expect(decideAdminAccess({ pathname: "/", hasValidSession: false })).toEqual({ action: "next" });
    expect(decideAdminAccess({ pathname: "/replays", hasValidSession: false })).toEqual({
      action: "next",
    });
    expect(decideAdminAccess({ pathname: "/api/replays/courts", hasValidSession: false })).toEqual({
      action: "next",
    });
  });
});
