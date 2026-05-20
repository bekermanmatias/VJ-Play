-- Canchas visibles en replays (slug estable para match_key; etiqueta editable por admin).
-- Ejecutar después de 002_replay_shift_settings.sql.

create table if not exists public.replay_courts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  label text not null,
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint replay_courts_slug_format check (slug ~ '^[a-z0-9][a-z0-9_-]{0,127}$')
);

create index if not exists replay_courts_active_sort_idx
  on public.replay_courts (active, sort_order, slug);

alter table public.replay_courts enable row level security;

comment on table public.replay_courts is
  'Canchas para búsqueda de replay; slug se usa en match_key junto con fecha y hora de turno.';

insert into public.replay_courts (slug, label, sort_order)
values
  ('cancha-padel', 'Cancha Padel', 0),
  ('cancha-f5', 'Cancha F5', 1)
on conflict (slug) do update set
  label = excluded.label,
  updated_at = now();

-- Ventana de grabación por defecto 08:00 → 24:00 (ya existentes y nuevas filas globales).
update public.replay_shift_settings
set
  window_start_hour = 8,
  window_end_hour = 24,
  updated_at = now()
where singleton_key = 'global';

alter table public.replay_shift_settings
  alter column window_start_hour set default 8;
alter table public.replay_shift_settings
  alter column window_end_hour set default 24;
