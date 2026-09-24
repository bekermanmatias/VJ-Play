/** Destino por defecto cuando el `next` no es válido. */
export const ADMIN_HOME = "/admin";

/**
 * Sanitiza el destino de un redirect administrativo para evitar open redirect.
 *
 * Solo se permiten rutas internas bajo `/admin` (o `/admin/...`). Cualquier
 * intento de escapar (URLs absolutas, protocol-relative, esquemas como
 * `javascript:`/`data:`, backslashes, caracteres de control, segmentos `..`)
 * cae al fallback `/admin`.
 */
export function sanitizeAdminRedirect(raw: unknown): string {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (value.length === 0) {
    return ADMIN_HOME;
  }
  // Caracteres de control (CRLF, NUL, etc.) — evita header injection.
  if (/[\u0000-\u001f\u007f]/.test(value)) {
    return ADMIN_HOME;
  }
  // Sin backslashes (parseo raro) ni doble barra (protocol-relative).
  if (value.includes("\\") || value.includes("//")) {
    return ADMIN_HOME;
  }
  // Debe ser /admin exacto o colgar de /admin/.
  if (value !== ADMIN_HOME && !value.startsWith(`${ADMIN_HOME}/`)) {
    return ADMIN_HOME;
  }
  // Sin traversal de segmentos.
  const segments = value.split("/");
  if (segments.some((segment) => segment === "." || segment === "..")) {
    return ADMIN_HOME;
  }
  return value;
}
