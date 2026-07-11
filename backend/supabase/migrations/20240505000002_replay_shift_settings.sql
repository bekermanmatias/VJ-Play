-- Configuración de turnos de grabación/replay (editable por admin vía API con service_role).
-- Ejecutar en Supabase SQL Editor después de 001_replay_access.sql.

create table if not exists public.replay_shift_settings (
  singleton_key text primary key default 'global' check (singleton_key = 'global'),
  shift_duration_seconds int not null default 3600
    check (shift_duration_seconds >= 300 and shift_duration_seconds <= 28800),
  window_start_hour int not null default 8
    check (window_start_hour >= 0 and window_start_hour <= 23),
  window_end_hour int not null default 24
    check (window_end_hour >= 1 and window_end_hour <= 24),
  updated_at timestamptz not null default now(),
  constraint replay_shift_settings_window_ok check (window_end_hour * 60 > window_start_hour * 60)
);

insert into public.replay_shift_settings (singleton_key)
values ('global')
on conflict (singleton_key) do nothing;

alter table public.replay_shift_settings enable row level security;

comment on table public.replay_shift_settings is
  'Duración de cada turno y ventana horaria del listado público; fallback en env si no hay fila.';
