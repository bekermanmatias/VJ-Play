-- Acceso pagado a replays: códigos emitidos por el club (efectivo / alias) y URLs del video por partido.
-- Ejecutar en Supabase SQL Editor con rol que pueda crear tablas.

create table if not exists public.match_access_codes (
  id uuid primary key default gen_random_uuid(),
  match_key text not null,
  token_hash text not null,
  expires_at timestamptz null,
  revoked boolean not null default false,
  created_at timestamptz not null default now(),
  constraint match_access_codes_unique unique (match_key, token_hash)
);

create index if not exists match_access_codes_match_key_idx
  on public.match_access_codes (match_key);

create table if not exists public.replay_assets (
  match_key text primary key,
  video_url text not null,
  poster_url text null,
  updated_at timestamptz not null default now()
);

alter table public.match_access_codes enable row level security;
alter table public.replay_assets enable row level security;

-- Sin políticas públicas: solo service_role / backend con SUPABASE_KEY service_role.

comment on table public.match_access_codes is 'Hashes SHA-256 del código que el jugador ingresa; el club lo crea tras cobrar.';
comment on table public.replay_assets is 'URLs del replay por match_key (cancha|fecha|hora).';
