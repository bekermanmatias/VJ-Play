import type { ReplayCourtRow } from "@/utils/replay-courts-types";

/** Si el API no responde (misma semántica que el fallback del backend). */
export const FALLBACK_REPLAY_COURTS: ReplayCourtRow[] = [
  { slug: "cancha-padel", label: "Cancha Padel", sortOrder: 0 },
  { slug: "cancha-f5", label: "Cancha F5", sortOrder: 1 },
];

export type ReplayCourtsApiPayload = {
  courts: ReplayCourtRow[];
  source: "database" | "env";
};

const COURTS_CACHE_TTL_MS = 5 * 60 * 1000;
const LOCAL_STORAGE_KEY_PREFIX = "vj_replay_courts_cache:";
const memoryCache = new Map<string, { payload: ReplayCourtsApiPayload; expiresAt: number }>();
const inFlightRequests = new Map<string, Promise<ReplayCourtsApiPayload>>();

function normalizeCourtsPayload(json: unknown): ReplayCourtsApiPayload {
  if (!json || typeof json !== "object") {
    return { courts: FALLBACK_REPLAY_COURTS, source: "env" };
  }
  const o = json as Record<string, unknown>;
  const raw = o.courts;
  if (!Array.isArray(raw) || raw.length === 0) {
    return { courts: FALLBACK_REPLAY_COURTS, source: "env" };
  }
  const courts: ReplayCourtRow[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const slug = typeof r.slug === "string" ? r.slug.trim() : "";
    const label = typeof r.label === "string" ? r.label.trim() : "";
    const sortOrder = typeof r.sortOrder === "number" ? r.sortOrder : courts.length;
    if (!slug || !label) continue;
    courts.push({ slug, label, sortOrder });
  }
  if (courts.length === 0) {
    return { courts: FALLBACK_REPLAY_COURTS, source: "env" };
  }
  courts.sort((a, b) => a.sortOrder - b.sortOrder || a.slug.localeCompare(b.slug));
  const src = o.source === "database" || o.source === "env" ? o.source : "env";
  return { courts, source: src };
}

function normalizeBase(apiBase: string): string {
  return apiBase.trim().replace(/\/$/, "");
}

function getCacheKey(base: string): string {
  return base || "__fallback__";
}

function getLocalStorageKey(cacheKey: string): string {
  return `${LOCAL_STORAGE_KEY_PREFIX}${cacheKey}`;
}

function readCachedPayload(cacheKey: string): ReplayCourtsApiPayload | null {
  const now = Date.now();
  const inMemory = memoryCache.get(cacheKey);
  if (inMemory && inMemory.expiresAt > now) {
    return inMemory.payload;
  }
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(getLocalStorageKey(cacheKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { payload?: unknown; expiresAt?: unknown };
    if (typeof parsed.expiresAt !== "number" || parsed.expiresAt <= now) {
      window.localStorage.removeItem(getLocalStorageKey(cacheKey));
      return null;
    }
    const payload = normalizeCourtsPayload(parsed.payload);
    memoryCache.set(cacheKey, { payload, expiresAt: parsed.expiresAt });
    return payload;
  } catch {
    return null;
  }
}

function writeCachedPayload(cacheKey: string, payload: ReplayCourtsApiPayload): void {
  const expiresAt = Date.now() + COURTS_CACHE_TTL_MS;
  memoryCache.set(cacheKey, { payload, expiresAt });
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(
      getLocalStorageKey(cacheKey),
      JSON.stringify({ payload, expiresAt }),
    );
  } catch {
    /* ignore storage quota/private mode errors */
  }
}

export function getReplayCourtsSnapshot(apiBase: string): ReplayCourtsApiPayload {
  const base = normalizeBase(apiBase);
  const cacheKey = getCacheKey(base);
  return readCachedPayload(cacheKey) ?? { courts: FALLBACK_REPLAY_COURTS, source: "env" };
}

export async function loadReplayCourts(apiBase: string): Promise<ReplayCourtsApiPayload> {
  const base = normalizeBase(apiBase);
  const cacheKey = getCacheKey(base);
  const cached = readCachedPayload(cacheKey);
  if (cached) {
    return cached;
  }
  if (!base) {
    const fallback = { courts: FALLBACK_REPLAY_COURTS, source: "env" } as const;
    writeCachedPayload(cacheKey, fallback);
    return fallback;
  }
  const inFlight = inFlightRequests.get(cacheKey);
  if (inFlight) {
    return inFlight;
  }
  const request = (async () => {
    const res = await fetch(`${base}/api/replays/courts`);
    if (!res.ok) {
      const fallback = { courts: FALLBACK_REPLAY_COURTS, source: "env" } as const;
      writeCachedPayload(cacheKey, fallback);
      return fallback;
    }
    const json: unknown = await res.json();
    const payload = normalizeCourtsPayload(json);
    writeCachedPayload(cacheKey, payload);
    return payload;
  })()
    .catch(() => {
      const fallback = { courts: FALLBACK_REPLAY_COURTS, source: "env" } as const;
      writeCachedPayload(cacheKey, fallback);
      return fallback;
    })
    .finally(() => {
      inFlightRequests.delete(cacheKey);
    });
  inFlightRequests.set(cacheKey, request);
  return request;
}

export async function saveReplayCourts(
  apiBase: string,
  adminSecret: string,
  courts: { slug: string; label: string; sortOrder: number }[],
): Promise<ReplayCourtsApiPayload> {
  const base = apiBase.trim().replace(/\/$/, "");
  if (!base) {
    throw new Error("Falta PUBLIC_REPLAY_API_BASE");
  }
  const res = await fetch(`${base}/api/replays/courts`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "x-admin-secret": adminSecret,
    },
    body: JSON.stringify({ courts }),
  });
  const text = await res.text();
  if (!res.ok) {
    let msg = text;
    try {
      const p = JSON.parse(text) as { error?: string };
      if (p.error) msg = p.error;
    } catch {
      /* use raw */
    }
    throw new Error(msg || `HTTP ${res.status}`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    throw new Error("Respuesta inválida del servidor");
  }
  return normalizeCourtsPayload(parsed);
}
