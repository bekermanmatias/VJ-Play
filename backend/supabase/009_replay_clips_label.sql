-- Nombre opcional del clip definido por el usuario.

alter table public.replay_clips
  add column if not exists clip_label text null;

comment on column public.replay_clips.clip_label is 'Nombre elegido por usuario para identificar el clip.';
