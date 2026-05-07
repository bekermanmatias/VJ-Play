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

export async function loadReplayCourts(apiBase: string): Promise<ReplayCourtsApiPayload> {
  const base = apiBase.trim().replace(/\/$/, "");
  if (!base) {
    return { courts: FALLBACK_REPLAY_COURTS, source: "env" };
  }
  try {
    const res = await fetch(`${base}/api/replays/courts`);
    if (!res.ok) {
      return { courts: FALLBACK_REPLAY_COURTS, source: "env" };
    }
    const json: unknown = await res.json();
    return normalizeCourtsPayload(json);
  } catch {
    return { courts: FALLBACK_REPLAY_COURTS, source: "env" };
  }
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
