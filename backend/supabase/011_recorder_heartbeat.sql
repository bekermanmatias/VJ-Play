-- Heartbeat del recorder: cada worker (uno por cancha) reporta estado periódico.
-- El admin lo usa para mostrar si las cámaras están grabando bien.
-- Ejecutar después de 010_replay_courts_dvr.sql.

create table if not exists public.recorder_heartbeat (
  court_slug text primary key references public.replay_courts (slug) on delete cascade,
  last_seen_at timestamptz not null,
  status text not null check (status in ('recording', 'idle', 'error', 'paused', 'starting')),
  current_segment_match_key text,
  current_segment_started_at timestamptz,
  bytes_written_last_segment bigint,
  last_segment_uploaded_at timestamptz,
  last_segment_match_key text,
  error_message text,
  recorder_version text,
  recorder_host text,
  updated_at timestamptz not null default now()
);

create index if not exists recorder_heartbeat_status_idx
  on public.recorder_heartbeat (status, last_seen_at);

alter table public.recorder_heartbeat enable row level security;

comment on table public.recorder_heartbeat is
  'Estado actual de cada worker del recorder. Se upsert-ea cada N segundos desde el VPS.';
comment on column public.recorder_heartbeat.status is
  'recording = capturando ahora · starting = arrancando · idle = fuera de ventana · paused = recording_enabled=false · error';
comment on column public.recorder_heartbeat.current_segment_match_key is
  'match_key del segmento que se está grabando en este momento.';
comment on column public.recorder_heartbeat.last_segment_match_key is
  'Último match_key cerrado y subido a R2.';
