-- Pagos de Mercado Pago para acceso a replays.
-- Cada pago genera un access_token UUID aleatorio que permite ver el replay desde cualquier dispositivo.
-- El token sólo habilita el acceso cuando el pago fue validado como 'approved' por el backend.

create table if not exists public.replay_payments (
  id uuid primary key default gen_random_uuid(),
  match_key text not null references public.replay_assets (match_key) on delete cascade,
  -- external_reference que enviamos a Mercado Pago y usamos para el lookup server-to-server.
  external_reference text not null default gen_random_uuid()::text,
  access_token uuid not null default gen_random_uuid(),
  mp_preference_id text null,
  mp_payment_id text null,
  -- Link de checkout de la preferencia, para reutilizar una compra pendiente sin duplicarla.
  init_point text null,
  mp_status text not null default 'pending',
  -- Snapshot del importe y moneda con los que se creó la preferencia.
  amount numeric(10,2) not null,
  currency text not null default 'ARS',
  payer_email text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  approved_at timestamptz null,
  constraint replay_payments_access_token_unique unique (access_token),
  constraint replay_payments_external_reference_unique unique (external_reference),
  constraint replay_payments_mp_status_check
    check (mp_status in ('pending', 'approved', 'rejected', 'cancelled'))
);

create index if not exists replay_payments_match_key_idx
  on public.replay_payments (match_key);

create index if not exists replay_payments_access_token_idx
  on public.replay_payments (access_token);

create index if not exists replay_payments_external_reference_idx
  on public.replay_payments (external_reference);

create index if not exists replay_payments_mp_preference_id_idx
  on public.replay_payments (mp_preference_id);

-- Un payment id de Mercado Pago sólo puede asociarse a una compra.
create unique index if not exists replay_payments_mp_payment_id_unique_idx
  on public.replay_payments (mp_payment_id)
  where mp_payment_id is not null;

alter table public.replay_payments enable row level security;

comment on table public.replay_payments is 'Pagos de Mercado Pago por partido. access_token es el UUID del link permanente.';
