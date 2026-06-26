-- Backfill opcional para completar numeric_id de partidos ya existentes.
-- Nota: usa hash MD5 (primeros 12 hex) con el mismo módulo que backend para mantener compatibilidad.

update public.replay_match_codes
set numeric_id = (
  ('x' || substr(md5(match_key), 1, 12))::bit(48)::bigint % 1000000000
)
where numeric_id is null;
