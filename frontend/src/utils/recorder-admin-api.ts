import { normalizeReplayApiBase } from "@/utils/replay-api-base";

export interface CourtDvrRow {
  slug: string;
  label: string;
  sortOrder: number;
  active: boolean;
  dvrChannel: number | null;
  dvrSubtype: number;
  rtspUrlOverride: string | null;
  recordingEnabled: boolean;
}

export type RecorderStatus =
  | "recording"
  | "idle"
  | "error"
  | "paused"
  | "starting"
  | "unknown";

export interface RecorderHeartbeatRow {
  courtSlug: string;
  courtLabel: string | null;
  status: RecorderStatus;
  lastSeenAt: string | null;
  secondsSinceLastSeen: number | null;
  stale: boolean;
  currentSegmentMatchKey: string | null;
  lastSegmentMatchKey: string | null;
  lastSegmentUploadedAt: string | null;
  errorMessage: string | null;
  recordingEnabled: boolean;
}

function getBase(): string {
  const base = normalizeReplayApiBase(
    import.meta.env.PUBLIC_REPLAY_API_BASE ?? "",
  );
  if (!base) {
    throw new Error("Falta PUBLIC_REPLAY_API_BASE");
  }
  return base;
}

async function readError(res: Response): Promise<string> {
  const text = await res.text();
  try {
    const parsed = JSON.parse(text) as { error?: string };
    return parsed.error ?? text ?? `HTTP ${res.status}`;
  } catch {
    return text || `HTTP ${res.status}`;
  }
}

export async function fetchCourtsDvr(adminSecret: string): Promise<CourtDvrRow[]> {
  const base = getBase();
  const res = await fetch(`${base}/api/replays/admin/courts-dvr`, {
    headers: { "x-admin-secret": adminSecret },
  });
  if (!res.ok) {
    throw new Error(await readError(res));
  }
  const json = (await res.json()) as { courts?: CourtDvrRow[] };
  return Array.isArray(json.courts) ? json.courts : [];
}

export interface PatchCourtDvrInput {
  dvrChannel?: number | null;
  dvrSubtype?: number | null;
  rtspUrlOverride?: string | null;
  recordingEnabled?: boolean;
}

export async function patchCourtDvr(
  adminSecret: string,
  slug: string,
  input: PatchCourtDvrInput,
): Promise<CourtDvrRow> {
  const base = getBase();
  const res = await fetch(
    `${base}/api/replays/admin/courts-dvr/${encodeURIComponent(slug)}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-admin-secret": adminSecret,
      },
      body: JSON.stringify(input),
    },
  );
  if (!res.ok) {
    throw new Error(await readError(res));
  }
  const json = (await res.json()) as { court: CourtDvrRow };
  return json.court;
}

export async function fetchRecorderStatus(
  adminSecret: string,
): Promise<RecorderHeartbeatRow[]> {
  const base = getBase();
  const res = await fetch(`${base}/api/replays/admin/recorder-status`, {
    headers: { "x-admin-secret": adminSecret },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(await readError(res));
  }
  const json = (await res.json()) as { courts?: RecorderHeartbeatRow[] };
  return Array.isArray(json.courts) ? json.courts : [];
}
