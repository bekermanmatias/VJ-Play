import { normalizeReplayApiBase } from "@/utils/replay-api-base";

export type ReplayAdminMatchRow = {
  matchKey: string;
  numericId: number;
  court: string;
  date: string;
  shift: string;
  videoUrl: string;
  videoUpdatedAt: string | null;
  code: string | null;
  codeUpdatedAt: string | null;
};

function parseError(text: string, fallback: string): string {
  try {
    const parsed = JSON.parse(text) as { error?: string };
    return parsed.error || fallback;
  } catch {
    return text || fallback;
  }
}

export async function loadReplayAdminMatches(params: {
  apiBase: string;
  adminSecret: string;
  query: string;
}): Promise<ReplayAdminMatchRow[]> {
  const base = normalizeReplayApiBase(params.apiBase);
  if (!base) {
    throw new Error("Falta PUBLIC_REPLAY_API_BASE");
  }
  const url = new URL(`${base}/api/replays/admin/matches`);
  if (params.query.trim()) {
    url.searchParams.set("q", params.query.trim());
  }
  const res = await fetch(url.toString(), {
    headers: { "x-admin-secret": params.adminSecret },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(parseError(text, `HTTP ${res.status}`));
  }
  const json = JSON.parse(text) as { matches?: ReplayAdminMatchRow[] };
  if (!Array.isArray(json.matches)) {
    return [];
  }
  return json.matches;
}
