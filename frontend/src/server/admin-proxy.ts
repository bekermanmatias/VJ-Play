import {
  getAdminSecret,
  isAdminConfigured,
  readSessionCookie,
  verifySessionToken,
} from "@/server/admin-session";
import { serverEnv } from "@/server/server-env";

/**
 * Proxy server-side para las APIs administrativas del backend.
 *
 * El navegador llama a `/admin/api/<ruta>` sin secreto. Astro valida la sesión,
 * agrega `x-admin-secret` (server-only) y reenvía al backend.
 *
 * NO es un proxy genérico: cada método + ruta debe estar en la allowlist.
 */
interface AllowRule {
  method: string;
  pattern: RegExp;
}

const ALLOWED_REQUESTS: AllowRule[] = [
  // Replays — recorder / DVR / moderación
  { method: "GET", pattern: /^replays\/admin\/courts-dvr$/ },
  { method: "PATCH", pattern: /^replays\/admin\/courts-dvr\/[^/]+$/ },
  { method: "POST", pattern: /^replays\/admin\/courts-dvr\/[^/]+\/probe$/ },
  { method: "GET", pattern: /^replays\/admin\/recorder-status$/ },
  { method: "POST", pattern: /^replays\/admin\/manual-record$/ },
  { method: "GET", pattern: /^replays\/admin\/manual-record\/[^/]+$/ },
  { method: "GET", pattern: /^replays\/admin\/matches$/ },
  { method: "PUT", pattern: /^replays\/courts$/ },
  { method: "PUT", pattern: /^replays\/shift-config$/ },
  { method: "POST", pattern: /^replays\/access\/codes$/ },
  // Noticias
  { method: "GET", pattern: /^news\/admin\/list$/ },
  { method: "POST", pattern: /^news\/admin$/ },
  { method: "GET", pattern: /^news\/admin\/[^/]+$/ },
  { method: "PATCH", pattern: /^news\/admin\/[^/]+$/ },
  { method: "DELETE", pattern: /^news\/admin\/[^/]+$/ },
  { method: "POST", pattern: /^news\/admin\/[^/]+\/images$/ },
  { method: "PATCH", pattern: /^news\/admin\/[^/]+\/images\/[^/]+\/main$/ },
  { method: "DELETE", pattern: /^news\/admin\/[^/]+\/images\/[^/]+$/ },
  { method: "GET", pattern: /^news\/admin\/categories$/ },
  { method: "PUT", pattern: /^news\/admin\/categories$/ },
  // Banners
  { method: "GET", pattern: /^banners\/admin\/list$/ },
  { method: "POST", pattern: /^banners\/admin$/ },
  { method: "PATCH", pattern: /^banners\/admin\/[^/]+$/ },
  { method: "DELETE", pattern: /^banners\/admin\/[^/]+$/ },
  { method: "POST", pattern: /^banners\/admin\/[^/]+\/image$/ },
];

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function isAllowedAdminProxyRequest(method: string, path: string): boolean {
  const normalizedMethod = method.toUpperCase();
  const normalizedPath = path.replace(/^\/+/, "");
  return ALLOWED_REQUESTS.some(
    (rule) => rule.method === normalizedMethod && rule.pattern.test(normalizedPath),
  );
}

/**
 * Rechaza paths con encoding, backslashes, doble barra o traversal que podrían
 * sortear la allowlist. El backend siempre recibe un path limpio y normalizado.
 */
export function isSafeAdminProxyPath(path: string): boolean {
  const normalized = path.replace(/^\/+/, "");
  if (normalized.length === 0) {
    return false;
  }
  if (normalized.includes("%") || normalized.includes("\\")) {
    return false;
  }
  if (normalized.includes("//")) {
    return false;
  }
  return normalized.split("/").every((segment) => segment !== "." && segment !== "..");
}

/** Protección CSRF simple: para métodos mutativos exige Origin/Referer propio. */
export function hasValidOrigin(request: Request): boolean {
  if (!MUTATING_METHODS.has(request.method.toUpperCase())) {
    return true;
  }
  let ownOrigin: string;
  try {
    ownOrigin = new URL(request.url).origin;
  } catch {
    return false;
  }
  const origin = request.headers.get("origin");
  if (origin) {
    return origin === ownOrigin;
  }
  const referer = request.headers.get("referer");
  if (referer) {
    try {
      return new URL(referer).origin === ownOrigin;
    } catch {
      return false;
    }
  }
  return false;
}

export function getInternalApiBase(): string {
  const raw =
    serverEnv("INTERNAL_API_BASE") ??
    serverEnv("PUBLIC_REPLAY_API_BASE") ??
    "http://localhost:4000";
  return raw.replace(/\/+$/, "");
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

/**
 * Construye los headers hacia el backend.
 *
 * NO reenvía headers del navegador salvo `content-type` y `accept`; en
 * particular ignora cualquier `x-admin-secret`, `cookie`, `authorization`,
 * `host`, `x-forwarded-*`, `proxy-*` o `transfer-encoding` enviados por el
 * cliente. El secreto administrativo lo establece el servidor.
 */
export function buildUpstreamHeaders(request: Request, secret: string): Headers {
  const headers = new Headers();
  headers.set("x-admin-secret", secret);
  const contentType = request.headers.get("content-type");
  if (contentType) {
    headers.set("content-type", contentType);
  }
  const accept = request.headers.get("accept");
  if (accept) {
    headers.set("accept", accept);
  }
  return headers;
}

export interface ProxyContext {
  path: string;
  search: string;
}

export async function proxyAdminRequest(
  request: Request,
  ctx: ProxyContext,
): Promise<Response> {
  const method = request.method.toUpperCase();
  const path = ctx.path.replace(/^\/+/, "");

  const token = readSessionCookie(request.headers.get("cookie"));
  if (!verifySessionToken(token)) {
    return jsonResponse(401, { error: "Sesión administrativa requerida" });
  }

  if (!isSafeAdminProxyPath(path)) {
    return jsonResponse(404, { error: "Recurso administrativo no encontrado" });
  }

  if (!isAllowedAdminProxyRequest(method, path)) {
    return jsonResponse(404, { error: "Recurso administrativo no encontrado" });
  }

  if (!hasValidOrigin(request)) {
    return jsonResponse(403, { error: "Origen no permitido" });
  }

  const secret = getAdminSecret();
  if (!isAdminConfigured(secret)) {
    return jsonResponse(503, { error: "Operación administrativa no disponible" });
  }

  const upstreamUrl = `${getInternalApiBase()}/api/${path}${ctx.search ?? ""}`;
  const headers = buildUpstreamHeaders(request, secret);

  let body: ArrayBuffer | undefined;
  if (MUTATING_METHODS.has(method)) {
    body = await request.arrayBuffer();
  }

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, {
      method,
      headers,
      body,
      redirect: "manual",
    });
  } catch {
    return jsonResponse(502, { error: "No se pudo contactar el servicio administrativo" });
  }

  const responseHeaders = new Headers();
  const upstreamType = upstream.headers.get("content-type");
  if (upstreamType) {
    responseHeaders.set("content-type", upstreamType);
  }
  responseHeaders.set("cache-control", "no-store");

  const hasBody = ![204, 205, 304].includes(upstream.status);
  return new Response(hasBody ? upstream.body : null, {
    status: upstream.status,
    headers: responseHeaders,
  });
}
