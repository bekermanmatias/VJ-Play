import { defineMiddleware } from "astro:middleware";
import { decideAdminAccess } from "@/server/admin-guard";
import { readSessionCookie, verifySessionToken } from "@/server/admin-session";

const ADMIN_PREFIX = "/admin";

/**
 * Protege server-side todo `/admin` y `/admin/api`.
 * - Páginas sin sesión: redirect a /admin/login.
 * - Endpoints /admin/api sin sesión: 401 JSON.
 */
export const onRequest = defineMiddleware((context, next) => {
  const pathname = context.url.pathname;

  if (pathname !== ADMIN_PREFIX && !pathname.startsWith(`${ADMIN_PREFIX}/`)) {
    return next();
  }

  const token = readSessionCookie(context.request.headers.get("cookie"));
  const hasValidSession = verifySessionToken(token);
  const decision = decideAdminAccess({ pathname, hasValidSession });

  if (decision.action === "redirect") {
    return context.redirect(decision.to, 303);
  }

  if (decision.action === "unauthorized") {
    return new Response(JSON.stringify({ error: "Sesión administrativa requerida" }), {
      status: 401,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });
  }

  return next();
});
