/**
 * Cliente HTTP para las APIs administrativas.
 *
 * El navegador siempre llama a rutas same-origin `/admin/api/*`. El servidor
 * Astro valida la sesión y agrega `x-admin-secret`; el navegador nunca conoce
 * el secreto administrativo.
 */
export const ADMIN_API_PREFIX = "/admin/api";

export function adminApiUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${ADMIN_API_PREFIX}${normalized}`;
}

export async function adminReadError(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { error?: unknown; message?: unknown };
    if (typeof data?.error === "string" && data.error.trim() !== "") {
      return data.error;
    }
    if (typeof data?.message === "string" && data.message.trim() !== "") {
      return data.message;
    }
  } catch {
    /* respuesta sin JSON */
  }
  return `Error ${response.status}`;
}

export async function adminFetch(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(adminApiUrl(path), {
    ...init,
    credentials: "same-origin",
  });
}

export async function adminFetchJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await adminFetch(path, init);
  if (response.status === 401) {
    throw new Error("Sesión administrativa requerida");
  }
  if (!response.ok) {
    throw new Error(await adminReadError(response));
  }
  if (response.status === 204) {
    return undefined as T;
  }
  const text = await response.text();
  if (!text) {
    return undefined as T;
  }
  return JSON.parse(text) as T;
}
