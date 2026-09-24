export type AdminAccessDecision =
  | { action: "next" }
  | { action: "redirect"; to: string }
  | { action: "unauthorized" };

const ADMIN_PREFIX = "/admin";
const ADMIN_API_PREFIX = "/admin/api";
const LOGIN_PATH = "/admin/login";
const LOGIN_API = `${ADMIN_API_PREFIX}/login`;
const LOGOUT_API = `${ADMIN_API_PREFIX}/logout`;

/**
 * Decide cómo tratar una request según su path y si tiene sesión válida.
 * Función pura para poder testearla sin levantar Astro.
 */
export function decideAdminAccess(input: {
  pathname: string;
  hasValidSession: boolean;
}): AdminAccessDecision {
  const { pathname, hasValidSession } = input;

  if (pathname === LOGIN_API || pathname === LOGOUT_API) {
    return { action: "next" };
  }

  if (pathname === LOGIN_PATH) {
    return hasValidSession ? { action: "redirect", to: ADMIN_PREFIX } : { action: "next" };
  }

  if (pathname === ADMIN_API_PREFIX || pathname.startsWith(`${ADMIN_API_PREFIX}/`)) {
    return hasValidSession ? { action: "next" } : { action: "unauthorized" };
  }

  if (pathname === ADMIN_PREFIX || pathname.startsWith(`${ADMIN_PREFIX}/`)) {
    if (hasValidSession) {
      return { action: "next" };
    }
    return {
      action: "redirect",
      to: `${LOGIN_PATH}?next=${encodeURIComponent(pathname)}`,
    };
  }

  return { action: "next" };
}
