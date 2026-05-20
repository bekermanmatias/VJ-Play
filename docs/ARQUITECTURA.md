# VJ Play — Arquitectura y funcionamiento

Documento de referencia: qué hay hoy en el repo, qué falta para conectar el DVR Dahua del club y cómo se va a comportar el sistema completo.

> Última actualización: 15/05/2026.

---

## 1. Visión general

VJ Play es un sistema de replays deportivos para el Club Social Varela Junior. Los socios que jugaron un partido pueden ver y descargar la grabación de su cancha usando un código.

Componentes:

- **Cámaras IP** del club → **DVR Dahua** (graba 24/7 localmente).
- **Mikrotik hAP Lite** → expone el RTSP del DVR hacia internet vía **WireGuard** (sin abrir puertos al DVR).
- **Recorder service** (a construir): proceso 24/7 en un VPS que se conecta por VPN al Mikrotik, lee el RTSP, segmenta el video en chunks por turno y los sube a R2.
- **Backend Express (Node 20)**: API de códigos de acceso, generación de clips con FFmpeg, marca de agua on-the-fly, presigning de URLs de R2.
- **Cloudflare R2**: almacenamiento de los MP4 (replays completos, clips, snaps).
- **Supabase (Postgres)**: metadata de turnos, códigos de acceso, clips, configuración.
- **Frontend Astro + React**: páginas públicas del club, flujo de replays para socios, panel admin.

---

## 2. Diagrama extremo a extremo

```
┌─────────────────────────────────────────────────────────────────────┐
│                          CLUB (LAN privada)                         │
│                                                                     │
│   ┌──────────────┐    RTSP    ┌──────────────┐                      │
│   │  Cámaras IP  │──────────► │  DVR Dahua   │                      │
│   └──────────────┘            │ 192.168.x.10 │                      │
│                               └──────┬───────┘                      │
│                                      │ LAN                          │
│                               ┌──────▼──────────────┐               │
│                               │  Mikrotik hAP Lite  │               │
│                               │  WireGuard server   │ ◄── pub IP    │
│                               └──────────┬──────────┘               │
└──────────────────────────────────────────┼──────────────────────────┘
                                           │
                                  WireGuard tunnel
                                  (cifrado, sin puertos
                                   del DVR expuestos)
                                           │
┌──────────────────────────────────────────▼──────────────────────────┐
│                         VPS (Hetzner / DO)                          │
│                                                                     │
│   ┌──────────────────────────────────────────────────────────┐      │
│   │           Recorder Service (Node + FFmpeg)               │      │
│   │  - Worker por cancha activa                              │      │
│   │  - FFmpeg lee RTSP → -c copy -f segment (chunks N min)   │      │
│   │  - Upload a R2 + upsert replay_assets                    │      │
│   │  - Respeta ventana horaria + heartbeat                   │      │
│   └────────────────┬─────────────────────────────────────────┘      │
│                    │                                                │
│   ┌────────────────▼─────────────────────────────────────────┐      │
│   │           Backend API (Express) — ya existe              │      │
│   │   /api/replays/*  /api/videos/*  /api/courts/*           │      │
│   └────────────────┬─────────────────────────────────────────┘      │
└────────────────────┼────────────────────────────────────────────────┘
                     │
              ┌──────┴──────┐
              ▼             ▼
     ┌────────────┐  ┌──────────────┐
     │  Supabase  │  │ Cloudflare R2│
     └────────────┘  └──────────────┘
                     ▲
                     │ HTTPS
              ┌──────┴───────┐
              │   Frontend   │  (Vercel/Cloudflare Pages)
              │   Astro      │
              └──────────────┘
```

---

## 3. Estado actual del repo

### 3.1 Lo que YA está implementado

| Pieza | Ubicación | Estado |
|---|---|---|
| API Express | `backend/src/app.ts` | Funcional |
| Snap de cancha desde RTSP | `backend/src/controllers/courts.controller.ts` | Funcional |
| Generación de clips on-demand (FFmpeg) | `backend/src/services/clip-job.service.ts` | Funcional (job store en memoria, MVP) |
| Marca de agua on-the-fly al descargar | `backend/src/services/ffmpeg-watermark-video.service.ts` | Funcional |
| Códigos de acceso (6 chars) | `backend/src/services/replay-access.service.ts` | Funcional |
| Sesión por JWT | `backend/src/services/replay-download-stream-token.ts` | Funcional |
| Frontend público (Home, Deportes, Contacto) | `frontend/src/pages/*.astro` | Funcional |
| Flujo socio → cancha/fecha/turno → código | `frontend/src/components/replays/*` | Funcional |
| Panel admin (parcial) | `frontend/src/pages/admin/*` | Parcial (dashboard con datos mock) |

### 3.2 Lo que NO está y hay que construir

- **Recorder service**: proceso que graba continuamente el DVR. Hoy los MP4 se cargan a mano con `backend/scripts/upload-youtube-replay.mjs` y otros scripts.
- **Mapeo cancha → canal del DVR**: tabla `replay_courts` no tiene columnas para guardar IP/canal/RTSP.
- **Heartbeat / monitor de grabación**: ninguna forma de saber desde el admin si las cámaras están grabando bien.
- **Retención automática**: hoy no se borran ni assets ni objetos de R2 viejos.

---

## 4. Modelo de datos (Supabase)

Tablas actuales:

| Tabla | Propósito |
|---|---|
| `replay_shift_settings` | Duración del turno y ventana horaria global |
| `replay_courts` | Slug + label de cada cancha (sin info de cámara aún) |
| `replay_assets` | PK `match_key` (cancha\|fecha\|hora) → `video_url`, `poster_url` |
| `match_access_codes` | Hash de cada código por `match_key` + expiración |
| `replay_match_codes` | Código legible (6 chars) que ve el operador |
| `replay_clips` | Clips generados por usuarios |

`match_key` formato: `cancha|YYYY-MM-DD|HH`.

### 4.1 Migración pendiente para integrar el DVR

```sql
-- 010_replay_courts_dvr.sql
ALTER TABLE replay_courts
  ADD COLUMN dvr_channel INT,
  ADD COLUMN dvr_subtype INT DEFAULT 0,
  ADD COLUMN rtsp_url_override TEXT,
  ADD COLUMN recording_enabled BOOLEAN DEFAULT false;

CREATE TABLE recorder_heartbeat (
  court_slug TEXT PRIMARY KEY REFERENCES replay_courts(slug) ON DELETE CASCADE,
  last_seen_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL, -- 'recording' | 'idle' | 'error' | 'paused'
  current_segment_match_key TEXT,
  error_message TEXT,
  bytes_written_last_segment BIGINT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 5. Cómo entra el DVR (pieza nueva)

### 5.1 URL RTSP de Dahua

```
rtsp://<user>:<pass>@<ip-mikrotik-wg>:554/cam/realmonitor?channel=<N>&subtype=0
```

- `subtype=0` → mainstream (HD, para grabar).
- `subtype=1` → substream (SD, para previews / snaps).
- `channel=N` → uno por cámara.

### 5.2 Flujo del recorder

1. Levantar al inicio: leer `replay_courts WHERE recording_enabled = true`.
2. Por cada cancha, lanzar un worker.
3. Worker:
   - Si está fuera de la ventana horaria, dormir.
   - Si está dentro, abrir FFmpeg con `-c copy -f segment -segment_time N`.
   - Cuando FFmpeg cierra un segmento (archivo), encolarlo para upload.
4. Upload worker:
   - Subir a R2 con key `tenants/{tenant}/replays/{cancha}/{YYYY-MM-DD}/{HH}.mp4`.
   - `upsert` a `replay_assets` con `match_key`, `video_url`, `poster_url`.
   - Eliminar archivo local tras éxito (o conservar 24h como buffer).
5. Heartbeat cada 30 s a `recorder_heartbeat`.

### 5.3 Comando FFmpeg base

```bash
ffmpeg -rtsp_transport tcp \
  -i "rtsp://recorder:****@10.99.0.1:554/cam/realmonitor?channel=1&subtype=0" \
  -c copy -f segment \
  -segment_time 3600 \
  -reset_timestamps 1 \
  -strftime 1 \
  /tmp/recordings/cancha-1/%Y-%m-%d_%H-00.mp4
```

`-c copy` = sin re-encode, CPU mínima.

---

## 6. Configuración decidida

| Decisión | Elección |
|---|---|
| Dónde corre el recorder | VPS en la nube |
| Acceso al DVR | WireGuard desde el VPS hacia el Mikrotik |
| Segmentación | Rolling (chunks de N minutos, sin esperar al cambio de hora) |
| Cuándo graba | Solo dentro de la ventana del club (`RECORDING_SHIFTS_WINDOW_*`) |
| Mapeo cancha → DVR | Columnas en `replay_courts` editables desde el admin |

---

## 7. Roadmap de implementación

### Fase 1 — Red (manual, con guía)
1. DVR Dahua: IP fija + usuario de solo lectura.
2. Mikrotik: configurar WireGuard server, generar par de llaves, abrir UDP de WG al WAN.
3. VPS: instalar WireGuard cliente y validar `ping <ip-lan-dvr>`.

### Fase 2 — Base de datos
- Migración SQL `010_replay_courts_dvr.sql` + `011_recorder_heartbeat.sql`.

### Fase 3 — Recorder service (paquete nuevo)
- `recorder/src/recorder.service.ts`: orquestador.
- `recorder/src/ffmpeg-segment.service.ts`: spawn FFmpeg + watcher de archivos.
- `recorder/src/upload.service.ts`: cola → R2 → Supabase.
- `recorder/src/window.service.ts`: ventana horaria.
- `recorder/src/health.service.ts`: heartbeat.

### Fase 4 — Admin
- `/admin/configuracion/grabacion`: editar canal DVR, habilitar/deshabilitar grabación por cancha.
- `/admin` dashboard: estado de cada cancha (último heartbeat, segmento actual, errores).

### Fase 5 — Retención
- Cron mensual en el VPS: borra `replay_assets` + objetos R2 con más de N días (configurable).

---

## 8. Variables de entorno (resumen)

### 8.1 Backend (`backend/.env`)
Las que ya están en uso (`backend/src/config/env.ts`).

### 8.2 Recorder (`recorder/.env` — nuevo)
```env
# Supabase (mismas creds que backend, service_role)
SUPABASE_URL=
SUPABASE_KEY=

# R2 (mismas creds que backend)
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
R2_ENDPOINT=
R2_PUBLIC_BASE_URL=

# DVR (cred común para todas las cámaras)
DVR_RTSP_USER=recorder
DVR_RTSP_PASSWORD=
DVR_HOST=10.99.0.1   # IP del DVR vista a través de WireGuard
DVR_RTSP_PORT=554

# Segmentos
RECORDING_SEGMENT_SECONDS=3600
RECORDING_LOCAL_BUFFER_DIR=/var/lib/vjplay-recorder
RECORDING_LOCAL_RETENTION_HOURS=24

# Ventana del club (en horas locales)
RECORDING_SHIFTS_WINDOW_START_HOUR=9
RECORDING_SHIFTS_WINDOW_END_HOUR=24
RECORDING_TIMEZONE=America/Argentina/Buenos_Aires

# Tenant / multi-club (si en algún momento se usa)
TENANT_ID=cvj

# FFmpeg
FFMPEG_PATH=/usr/bin/ffmpeg
FFPROBE_PATH=/usr/bin/ffprobe
```

---

## 9. Costos estimados

| Recurso | Costo aprox. |
|---|---|
| VPS Hetzner CPX21 (3 vCPU, 4 GB, 80 GB SSD) | ~€8/mes |
| R2 storage (1 TB) | $15/mes |
| R2 egress | $0 (R2 no cobra egress) |
| Supabase Pro | $25/mes (si se supera el free) |
| Total estimado para club pequeño | ~$50/mes |

Para 5 canchas a 1080p 5 Mbps grabando 12 hs/día:
- Tráfico DVR→VPS: ~25 Mbps continuos (necesita upload del club ≥ 30 Mbps).
- Tráfico VPS→R2: ~25 Mbps continuos.
- Storage: ~135 GB/día → ~4 TB/mes si guardás todo. Con retención de 7 días son ~950 GB.

---

## 10. Datos físicos pendientes de confirmar

Estos los necesitamos para terminar de configurar el sistema:

- [ ] Modelo exacto del DVR Dahua (XVR, NVR).
- [ ] Cantidad de canchas/cámaras a duplicar de entrada.
- [ ] Resolución y bitrate de cada cámara.
- [ ] IP pública del Mikrotik: ¿fija o dinámica?
- [ ] Upload del club (test desde la LAN del Mikrotik).
- [ ] VPS contratado: proveedor, IP pública, sistema operativo.
- [ ] Decisión sobre retención: cuántos días guardamos los replays completos.
