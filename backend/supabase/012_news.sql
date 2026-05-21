-- Sistema de noticias: categorías (alineadas a deportes del club), noticias y galería de imágenes.
-- Ejecutar en Supabase SQL Editor con rol que pueda crear tablas.

-- =============================================================================
-- 1. Categorías de noticias (los deportes son los slugs por defecto)
-- =============================================================================
create table if not exists public.news_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  label text not null,
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint news_categories_slug_format check (slug ~ '^[a-z0-9][a-z0-9_-]{0,127}$')
);

create index if not exists news_categories_active_sort_idx
  on public.news_categories (active, sort_order, slug);

alter table public.news_categories enable row level security;

comment on table public.news_categories is
  'Categorías de noticias. Por defecto incluye los deportes del club; admin puede agregar más.';

-- =============================================================================
-- 2. Noticias
-- =============================================================================
create table if not exists public.news (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  summary text not null default '',
  body text not null default '',
  author text,
  published boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint news_slug_format check (slug ~ '^[a-z0-9][a-z0-9_-]{0,200}$')
);

create index if not exists news_published_idx
  on public.news (published, published_at desc);

create index if not exists news_published_at_idx
  on public.news (published_at desc);

alter table public.news enable row level security;

comment on table public.news is 'Noticias del club. published_at controla visibilidad pública.';

-- =============================================================================
-- 3. Galería de imágenes (hasta 5 por noticia; una marcada como principal)
-- =============================================================================
create table if not exists public.news_images (
  id uuid primary key default gen_random_uuid(),
  news_id uuid not null references public.news (id) on delete cascade,
  image_url text not null,
  image_key text,
  is_main boolean not null default false,
  sort_order int not null default 0,
  alt_text text,
  created_at timestamptz not null default now()
);

create index if not exists news_images_news_idx
  on public.news_images (news_id, sort_order, created_at);

-- Solo una imagen principal por noticia (índice parcial único).
create unique index if not exists news_images_main_unique
  on public.news_images (news_id) where is_main;

alter table public.news_images enable row level security;

comment on table public.news_images is
  'Imágenes asociadas a una noticia. image_key sirve para borrar el objeto en R2.';
comment on column public.news_images.is_main is
  'Solo una por news_id (índice parcial único). La que se usa como portada.';

-- =============================================================================
-- 4. Vínculo noticia ↔ categoría (muchos a muchos)
-- =============================================================================
create table if not exists public.news_category_links (
  news_id uuid not null references public.news (id) on delete cascade,
  category_id uuid not null references public.news_categories (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (news_id, category_id)
);

create index if not exists news_category_links_category_idx
  on public.news_category_links (category_id);

alter table public.news_category_links enable row level security;

comment on table public.news_category_links is
  'Una noticia puede tener varias categorías y aparecer en cada una.';

-- =============================================================================
-- 5. Seed inicial de categorías (slugs alineados con frontend/src/data/deportes.ts)
-- =============================================================================
insert into public.news_categories (slug, label, sort_order) values
  ('institucional', 'Institucional', 0),
  ('futbol-5', 'Fútbol 5', 10),
  ('padel', 'Pádel', 20),
  ('futbol-femenino', 'Fútbol Femenino', 30),
  ('futbol-infantil', 'Fútbol Infantil', 40),
  ('tenis', 'Tenis', 50),
  ('basquet', 'Básquet', 60),
  ('voley', 'Vóley', 70),
  ('rugby', 'Rugby', 80),
  ('natacion', 'Natación', 90),
  ('pelota-paleta', 'Pelota Paleta', 100),
  ('fight-club', 'Varela Fight Club', 110),
  ('calidad', 'Gimnasio No Limits', 120)
on conflict (slug) do update
  set label = excluded.label,
      sort_order = excluded.sort_order,
      updated_at = now();
