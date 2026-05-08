-- ID numérico operativo del partido (mismo valor que usa admin).
-- Se guarda persistido para usarlo en WhatsApp/soporte sin recalcular.

alter table public.replay_match_codes
  add column if not exists numeric_id bigint;

create unique index if not exists replay_match_codes_numeric_id_unique_idx
  on public.replay_match_codes (numeric_id)
  where numeric_id is not null;

comment on column public.replay_match_codes.numeric_id is 'ID numérico estable del partido visible en admin.';
