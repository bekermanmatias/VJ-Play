/**
 * Debe coincidir con `ADMIN_SECRET` del backend.
 * Por Astro/Vite estático, solo puede leerse con prefijo PUBLIC_ (queda en el bundle del cliente).
 * Restringí `/admin` en producción (auth, IP, etc.).
 */
export function getReplayAdminSecret(): string {
  return (import.meta.env.PUBLIC_REPLAY_ADMIN_SECRET ?? "").trim();
}
