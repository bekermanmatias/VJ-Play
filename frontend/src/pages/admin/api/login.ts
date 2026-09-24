import type { APIRoute } from "astro";
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

/** Solo permite destinos internos de /admin para evitar open redirect. */
function sanitizeNext(raw: FormDataEntryValue | null): string {
  const value = typeof raw === "string" ? raw : "";
  if (value.startsWith("/admin") && !value.startsWith("//") && !value.includes("\\")) {
    return value;
  }
  return "/admin";
}

export const POST: APIRoute = async ({ request, cookies, clientAddress }) => {
  if (!isAdminConfigured()) {
    return redirectTo("/admin/login?error=unavailable");
  }

  const form = await request.formData();
  const password = String(form.get("password") ?? "");
  const next = sanitizeNext(form.get("next"));

  let key = "unknown";
  try {
    key = clientAddress || "unknown";
  } catch {
    key = "unknown";
  }

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
