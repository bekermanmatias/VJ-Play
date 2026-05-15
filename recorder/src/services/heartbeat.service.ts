import { getSupabase } from "../config/supabase.js";
import { env } from "../config/env.js";
import { createLogger } from "../util/log.js";

const log = createLogger("heartbeat");

export type RecorderStatus = "recording" | "idle" | "error" | "paused" | "starting";

export interface HeartbeatPayload {
  courtSlug: string;
  status: RecorderStatus;
  currentSegmentMatchKey?: string | null;
  currentSegmentStartedAt?: string | null;
  lastSegmentMatchKey?: string | null;
  lastSegmentUploadedAt?: string | null;
  bytesWrittenLastSegment?: number | null;
  errorMessage?: string | null;
}

export async function sendHeartbeat(p: HeartbeatPayload): Promise<void> {
  const supa = getSupabase();
  const { error } = await supa.from("recorder_heartbeat").upsert(
    {
      court_slug: p.courtSlug,
      status: p.status,
      current_segment_match_key: p.currentSegmentMatchKey ?? null,
      current_segment_started_at: p.currentSegmentStartedAt ?? null,
      last_segment_match_key: p.lastSegmentMatchKey ?? null,
      last_segment_uploaded_at: p.lastSegmentUploadedAt ?? null,
      bytes_written_last_segment: p.bytesWrittenLastSegment ?? null,
      error_message: p.errorMessage ?? null,
      recorder_version: "0.1.0",
      recorder_host: env.heartbeat.hostLabel || null,
      last_seen_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "court_slug" },
  );
  if (error) {
    log.warn("heartbeat falló", { court: p.courtSlug, error: error.message });
  }
}
