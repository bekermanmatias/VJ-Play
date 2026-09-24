import { adminFetchJson } from "@/utils/admin-api";

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

export async function loadReplayAdminMatches(params: {
  query: string;
}): Promise<ReplayAdminMatchRow[]> {
  const search = params.query.trim()
    ? `?q=${encodeURIComponent(params.query.trim())}`
    : "";
  const json = await adminFetchJson<{ matches?: ReplayAdminMatchRow[] }>(
    `/replays/admin/matches${search}`,
  );
  if (!Array.isArray(json.matches)) {
    return [];
  }
  return json.matches;
}
