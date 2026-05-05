/**
 * Normaliza parámetros de ruta cuando el tipado admite string | string[] (Express 5).
 */
export function firstRouteParam(
  value: string | string[] | undefined,
): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  return Array.isArray(value) ? value[0] : value;
}
