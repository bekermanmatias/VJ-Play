import type { APIRoute } from "astro";
import { getClientIp } from "@/server/admin-client-ip";
import { sanitizeAdminRedirect } from "@/server/admin-redirect";
import { checkRateLimit, resetRateLimit } from "@/server/admin-ratelimit";
import {
  ADMIN_SESSION_COOKIE,
  createSessionToken,
  isAdminConfigured,
  isSecureRequest,
  sessionCookieOptions,
  verifyAdminPassword,
} from "@/server/admin-session";

export const prerender = false;

const LOGIN_RATE_LIMIT = { max: 8, windowMs: 5 * 60 * 1000 };

function redirectTo(location: string): Response {
  return new Response(null, {
    status: 303,
    headers: { location, "cache-control": "no-store" },
  });
}

export const POST: APIRoute = async ({ request, cookies, clientAddress }) => {
  if (!isAdminConfigured()) {
    return redirectTo("/admin/login?error=unavailable");
  }

  const form = await request.formData();
  const password = String(form.get("password") ?? "");
  const next = sanitizeAdminRedirect(form.get("next"));

  let fallbackIp: string | undefined;
  try {
    fallbackIp = clientAddress;
  } catch {
    fallbackIp = undefined;
  }
  const key = getClientIp(request, fallbackIp);

  if (!checkRateLimit(key, LOGIN_RATE_LIMIT)) {
    return redirectTo("/admin/login?error=rate");
  }

  if (!verifyAdminPassword(password)) {
    return redirectTo("/admin/login?error=1");
  }

  resetRateLimit(key);
  cookies.set(
    ADMIN_SESSION_COOKIE,
    createSessionToken(),
    sessionCookieOptions(isSecureRequest(request)),
  );
  return redirectTo(next);
};
