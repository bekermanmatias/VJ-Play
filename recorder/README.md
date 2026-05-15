# VJ Play — Recorder Service

Proceso 24/7 que se conecta al DVR Dahua del club (a través de WireGuard hacia el Mikrotik),
graba el RTSP de cada cancha en segmentos de N minutos, los sube a Cloudflare R2 y
hace upsert en Supabase (`replay_assets`) para que el frontend los pueda servir.

## Stack

- **Node 20 + TypeScript**
- **fluent-ffmpeg** + binario `ffmpeg` del sistema
- **@aws-sdk/client-s3** + **@aws-sdk/lib-storage** (multipart)
- **@supabase/supabase-js**

## Estructura

```
recorder/
  src/
    config/
      env.ts          # parseo de variables de entorno
      supabase.ts     # cliente Supabase service-role
      s3.ts           # cliente R2
    services/
      courts.repo.ts            # lee canchas con recording_enabled
      window.service.ts         # ventana horaria del club
      ffmpeg-segment.service.ts # spawn FFmpeg, watch de archivos cerrados
      upload.service.ts         # sube segmentos a R2 + upsert replay_assets
      heartbeat.service.ts      # reporta estado a recorder_heartbeat
      recorder.service.ts       # orquesta un worker por cancha
    cli/
      probe-rtsp.ts             # `pnpm probe` — testea conexión RTSP
    index.ts                    # entrypoint
```

## Setup local (dev)

```bash
cd recorder
cp .env.example .env
# completar .env con tus credenciales
npm install
npm run dev
```

## Probar conexión al DVR

```bash
npm run probe -- --court cancha-padel
```

Imprime info de stream sin grabar nada.

## Producción (en el VPS)

```bash
npm run build
node dist/index.js
```

(o con systemd / Docker; ver `docs/RECORDER-DEPLOY.md`)
