import type { APIRoute } from "astro";
import { proxyAdminRequest } from "@/server/admin-proxy";

export const prerender = false;

export const ALL: APIRoute = ({ request, params }) => {
  const path = params.path ?? "";
  const search = new URL(request.url).search;
  return proxyAdminRequest(request, { path, search });
};
