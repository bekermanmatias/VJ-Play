import { adminFetchJson } from "@/utils/admin-api";

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
  currentSegmentStartedAt: string | null;
  lastSegmentMatchKey: string | null;
  lastSegmentUploadedAt: string | null;
  bytesWrittenLastSegment: number | null;
  errorMessage: string | null;
  recorderVersion: string | null;
  recorderHost: string | null;
  recordingEnabled: boolean;
}

export async function fetchCourtsDvr(): Promise<CourtDvrRow[]> {
  const json = await adminFetchJson<{ courts?: CourtDvrRow[] }>(
    "/replays/admin/courts-dvr",
  );
  return Array.isArray(json.courts) ? json.courts : [];
}

export interface PatchCourtDvrInput {
  dvrChannel?: number | null;
  dvrSubtype?: number | null;
  rtspUrlOverride?: string | null;
  recordingEnabled?: boolean;
}

export async function patchCourtDvr(
  slug: string,
  input: PatchCourtDvrInput,
): Promise<CourtDvrRow> {
  const json = await adminFetchJson<{ court: CourtDvrRow }>(
    `/replays/admin/courts-dvr/${encodeURIComponent(slug)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
  return json.court;
}

export interface CourtRtspProbeResult {
  ok: boolean;
  courtSlug: string;
  courtLabel?: string;
  rtspUrlMasked: string;
  probedAt: string;
  video?: { codec: string; width: number; height: number };
  error?: string;
}

export async function probeCourtDvr(slug: string): Promise<CourtRtspProbeResult> {
  return adminFetchJson<CourtRtspProbeResult>(
    `/replays/admin/courts-dvr/${encodeURIComponent(slug)}/probe`,
    { method: "POST" },
  );
}

export async function fetchRecorderStatus(): Promise<RecorderHeartbeatRow[]> {
  const json = await adminFetchJson<{ courts?: RecorderHeartbeatRow[] }>(
    "/replays/admin/recorder-status",
    { cache: "no-store" },
  );
  return Array.isArray(json.courts) ? json.courts : [];
}

export interface ManualRecordingRequest {
  id: string;
  court_slug: string;
  duration_seconds: number;
  status: 'pending' | 'recording' | 'uploading' | 'completed' | 'error';
  match_key: string | null;
  plain_code: string | null;
  numeric_id: number | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export async function triggerManualRecord(
  courtSlug: string,
  durationSeconds: number,
): Promise<ManualRecordingRequest> {
  const json = await adminFetchJson<{ request: ManualRecordingRequest }>(
    "/replays/admin/manual-record",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courtSlug, durationSeconds }),
    },
  );
  return json.request;
}

export async function getManualRecordStatus(id: string): Promise<ManualRecordingRequest> {
  const json = await adminFetchJson<{ request: ManualRecordingRequest }>(
    `/replays/admin/manual-record/${encodeURIComponent(id)}`,
    { cache: "no-store" },
  );
  return json.request;
}
