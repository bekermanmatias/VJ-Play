-- Banners del Home: gestionados desde el panel de administración.
-- Cada fila es un slide del carousel del Home.

create table if not exists public.home_banners (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subtitle text not null default '',
  button_label text not null default '',
  button_url text not null default '',
  image_url text not null,
  image_key text,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists home_banners_active_sort_idx
  on public.home_banners (active, sort_order, created_at);

alter table public.home_banners enable row level security;

comment on table public.home_banners is
  'Slides del carousel del Home. Se muestran los activos ordenados por sort_order.';
comment on column public.home_banners.image_key is
  'Clave R2 para borrar la imagen al eliminar el banner.';

-- Seed: los dos slides que ya existían en el Hero estático
insert into public.home_banners (title, subtitle, button_label, button_url, image_url, active, sort_order) values
  (
    'Disfrutá',
    'El Club — Todo el año',
    '',
    '',
    'https://images.unsplash.com/photo-1526232761682-d26e03ac148e?auto=format&fit=crop&w=1920&q=80',
    true,
    0
  ),
  (
    'Revivi tus',
    'Partidos',
    'Ver Replays',
    '/replays',
    '/images/padel.png',
    true,
    10
  );
