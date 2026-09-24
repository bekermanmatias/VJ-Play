/**
 * Acceso a variables de entorno SOLO del servidor (Astro SSR / Node).
 *
 * Se prioriza `process.env` para que los valores definidos en tiempo de
 * ejecución (Docker/Compose) tengan efecto; `import.meta.env` queda como
 * respaldo para desarrollo/build. Nunca debe importarse desde código cliente.
 */
export function serverEnv(name: string): string | undefined {
  if (typeof process !== "undefined" && process.env) {
    const value = process.env[name];
    if (value && value.trim() !== "") {
      return value;
    }
  }
  try {
    const fromMeta = (import.meta.env as unknown as Record<string, string | undefined>)[
      name
    ];
    if (fromMeta && fromMeta.trim() !== "") {
      return fromMeta;
    }
  } catch {
    /* import.meta.env no disponible */
  }
  return undefined;
}
