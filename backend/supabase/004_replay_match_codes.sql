-- Código visible (6 chars) por partido para operación en recepción/admin.
-- Se guarda en texto por requerimiento operativo de copiado y reenvío al cliente.
-- El control de acceso real sigue validando hash en match_access_codes.

create table if not exists public.replay_match_codes (
  match_key text primary key references public.replay_assets (match_key) on delete cascade,
  plain_code text not null,
  updated_at timestamptz not null default now(),
  constraint replay_match_codes_plain_code_len check (char_length(plain_code) = 6)
);

create unique index if not exists replay_match_codes_plain_code_unique_idx
  on public.replay_match_codes (plain_code);

alter table public.replay_match_codes enable row level security;

comment on table public.replay_match_codes is 'Código operativo visible por partido para copiar desde admin.';
