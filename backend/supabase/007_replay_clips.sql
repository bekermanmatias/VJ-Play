-- Clips generados desde el reproductor, vinculados al partido y video original.
-- Persistencia operativa para mostrar clips reales (R2) en el panel del replay.

create table if not exists public.replay_clips (
  id uuid primary key default gen_random_uuid(),
  match_key text not null references public.replay_assets (match_key) on delete cascade,
  source_url text not null,
  clip_url text not null,
  clip_key text not null,
  start_seconds double precision not null check (start_seconds >= 0),
  duration_seconds double precision not null check (duration_seconds > 0),
  created_at timestamptz not null default now()
);

create index if not exists replay_clips_match_key_created_at_idx
  on public.replay_clips (match_key, created_at desc);

alter table public.replay_clips enable row level security;

comment on table public.replay_clips is 'Clips derivados de replay_assets, almacenados en R2 y listados por partido.';
