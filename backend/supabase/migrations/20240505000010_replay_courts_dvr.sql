-- Sumamos a replay_courts el mapeo cancha → canal del DVR Dahua.
-- Ejecutar después de 009_replay_clips_label.sql.

alter table public.replay_courts
  add column if not exists dvr_channel integer,
  add column if not exists dvr_subtype integer not null default 0,
  add column if not exists rtsp_url_override text,
  add column if not exists recording_enabled boolean not null default false;

comment on column public.replay_courts.dvr_channel is
  'Número de canal en el DVR Dahua (1..N). Usado por el recorder para armar la URL RTSP.';
comment on column public.replay_courts.dvr_subtype is
  'Subtipo Dahua: 0 = mainstream (alta), 1 = substream (baja). Default 0.';
comment on column public.replay_courts.rtsp_url_override is
  'Si está seteado, el recorder usa esta URL en lugar de armarla con DVR_HOST + dvr_channel. Útil para cámaras IP independientes.';
comment on column public.replay_courts.recording_enabled is
  'Si es true, el recorder graba esta cancha de forma continua dentro de la ventana horaria.';

create index if not exists replay_courts_recording_idx
  on public.replay_courts (recording_enabled, sort_order, slug)
  where recording_enabled = true;
