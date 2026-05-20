import { getSupabase } from "../config/supabase.js";
import { env } from "../config/env.js";

export interface RecordingCourt {
  slug: string;
  label: string;
  dvrChannel: number | null;
  dvrSubtype: number;
  rtspUrlOverride: string | null;
  recordingEnabled: boolean;
}

export interface ResolvedCourt extends RecordingCourt {
  rtspUrl: string;
}

interface RawRow {
  slug: string;
  label: string;
  dvr_channel: number | null;
  dvr_subtype: number | null;
  rtsp_url_override: string | null;
  recording_enabled: boolean;
}

export async function listRecordingCourts(): Promise<RecordingCourt[]> {
  const supa = getSupabase();
  const { data, error } = await supa
    .from("replay_courts")
    .select("slug,label,dvr_channel,dvr_subtype,rtsp_url_override,recording_enabled")
    .eq("active", true)
    .eq("recording_enabled", true)
    .order("sort_order", { ascending: true });

  if (error) {
    throw new Error(`[courts.repo] no se pudo leer replay_courts: ${error.message}`);
  }
  const rows = (data ?? []) as RawRow[];
  return rows.map(toRecordingCourt);
}

function toRecordingCourt(r: RawRow): RecordingCourt {
  return {
    slug: r.slug,
    label: r.label,
    dvrChannel: r.dvr_channel,
    dvrSubtype: r.dvr_subtype ?? 0,
    rtspUrlOverride: r.rtsp_url_override,
    recordingEnabled: r.recording_enabled,
  };
}

export function resolveRtspUrl(c: RecordingCourt): string {
  if (c.rtspUrlOverride && c.rtspUrlOverride.trim() !== "") {
    return c.rtspUrlOverride.trim();
  }
  if (c.dvrChannel === null || Number.isNaN(c.dvrChannel)) {
    throw new Error(
      `[courts.repo] cancha "${c.slug}" no tiene dvr_channel ni rtsp_url_override`,
    );
  }
  return env.dvr.urlTemplate
    .replace("{user}", encodeURIComponent(env.dvr.user))
    .replace("{password}", encodeURIComponent(env.dvr.password))
    .replace("{host}", env.dvr.host)
    .replace("{port}", String(env.dvr.port))
    .replace("{channel}", String(c.dvrChannel))
    .replace("{subtype}", String(c.dvrSubtype));
}

export function resolveCourt(c: RecordingCourt): ResolvedCourt {
  return { ...c, rtspUrl: resolveRtspUrl(c) };
}
