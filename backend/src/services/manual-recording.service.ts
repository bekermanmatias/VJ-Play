import { getSupabase } from '../config/supabase.js';

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

export async function createManualRecording(courtSlug: string, durationSeconds: number): Promise<ManualRecordingRequest> {
  const supa = getSupabase();
  const { data, error } = await supa
    .from('recorder_manual_requests')
    .insert({
      court_slug: courtSlug,
      duration_seconds: durationSeconds,
      status: 'pending',
    })
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(`No se pudo crear la solicitud de grabación: ${error?.message}`);
  }
  return data as ManualRecordingRequest;
}

export async function getManualRecording(id: string): Promise<ManualRecordingRequest | null> {
  const supa = getSupabase();
  const { data, error } = await supa
    .from('recorder_manual_requests')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw new Error(`Error al buscar la solicitud de grabación: ${error.message}`);
  }
  return data as ManualRecordingRequest | null;
}
