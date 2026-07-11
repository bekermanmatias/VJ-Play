-- Metadata visual y operativo de clips persistidos.

alter table public.replay_clips
  add column if not exists thumb_url text null,
  add column if not exists clip_size_bytes bigint null;

comment on column public.replay_clips.thumb_url is 'Frame representativo del clip (JPG en R2).';
comment on column public.replay_clips.clip_size_bytes is 'Peso en bytes del MP4 generado.';
