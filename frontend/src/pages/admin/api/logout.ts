import type { APIRoute } from "astro";
import { ADMIN_SESSION_COOKIE } from "@/server/admin-session";

export const prerender = false;

export const POST: APIRoute = async ({ cookies }) => {
  cookies.delete(ADMIN_SESSION_COOKIE, { path: "/" });
  return new Response(null, {
    status: 303,
    headers: { location: "/admin/login", "cache-control": "no-store" },
  });
};
