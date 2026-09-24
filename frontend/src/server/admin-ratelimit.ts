/**
 * Rate limit en memoria, suficiente para un único proceso Node (Astro standalone).
 * No requiere Redis. Pensado para frenar intentos triviales de login admin.
 */
interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 5_000;

export interface RateLimitOptions {
  max: number;
  windowMs: number;
}

/** Devuelve true si la request está permitida; false si superó el límite. */
export function checkRateLimit(
  key: string,
  options: RateLimitOptions,
  nowMs: number = Date.now(),
): boolean {
  const { max, windowMs } = options;
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= nowMs) {
    if (buckets.size >= MAX_BUCKETS) {
      pruneExpired(nowMs);
    }
    buckets.set(key, { count: 1, resetAt: nowMs + windowMs });
    return true;
  }

  if (existing.count >= max) {
    return false;
  }

  existing.count += 1;
  return true;
}

/** Reinicia el contador de una clave (p. ej. tras un login exitoso). */
export function resetRateLimit(key: string): void {
  buckets.delete(key);
}

function pruneExpired(nowMs: number): void {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= nowMs) {
      buckets.delete(key);
    }
  }
}

/** Solo para tests. */
export function clearRateLimits(): void {
  buckets.clear();
}
