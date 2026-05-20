# Deploy Docker — Google Cloud / VPS

Stack listo para **probar y subir** back + front en una VM (créditos $300 o free tier).

## Qué incluye

| Servicio | Puerto interno | Público |
|----------|----------------|---------|
| **Caddy** | — | `:80` (sitio + `/api` → backend) |
| **backend** | 4000 | vía Caddy `/api/*` |
| **frontend** | 4321 | vía Caddy `/` |
| **recorder** (opcional) | `network_mode: host` | no expone HTTP |

## Requisitos en la VM

- Ubuntu 24.04, **≥ 2 GB RAM** recomendado si corrés back + front + recorder.
- Docker + Compose (ver `infra/vps-setup-docker.sh`).
- Firewall GCP: permitir **TCP 80** (y 22 SSH).

## Pasos rápidos (GCP)

1. Crear VM (`e2-small` recomendado para prueba con Docker; `e2-micro` solo back+front).
2. En la VM:

```bash
git clone <tu-repo> /opt/vjplay/source
cd /opt/vjplay/source
sudo bash infra/vps-setup-docker.sh
# Cerrar sesión y volver a entrar si agregaste el usuario al grupo docker

cd deploy
cp .env.example .env
nano .env   # SITE_HOST y PUBLIC_REPLAY_API_BASE = http://IP_PUBLICA
docker compose up -d --build
docker compose ps
curl -s http://127.0.0.1/health
```

3. En el navegador: `http://IP_PUBLICA` (replays, admin, etc.).

## Recorder + WireGuard

El recorder necesita ver el DVR en la LAN del club. **WireGuard va en el host**, no en Docker:

1. Configurar `wg0` según `docs/MIKROTIK-WIREGUARD.md` y `docs/VPS-DEPLOY.md` §3.
2. Probar: `ping 192.168.88.10` desde la VM.
3. Levantar recorder:

```bash
cd /opt/vjplay/source/deploy
docker compose --profile recorder up -d --build
```

`network_mode: host` hace que el contenedor use la red del host (incluido `wg0`).

## Rebuild tras cambiar URLs del front

`PUBLIC_REPLAY_API_BASE` se embebe en el build de Astro:

```bash
docker compose build --no-cache frontend
docker compose up -d
```

## Imágenes pre-construidas (opcional)

En tu PC o CI:

```bash
cd deploy
docker compose build
docker tag deploy-backend-1 gcr.io/TU_PROYECTO/vjplay-backend:latest
docker push gcr.io/TU_PROYECTO/vjplay-backend:latest
```

En la VM: editar `docker-compose.yml` para usar `image:` en lugar de `build:` y `docker compose pull`.

## Variables clave

| Variable | Dónde |
|----------|--------|
| `VJ_RUNTIME=vps` | backend + recorder |
| `PUBLIC_REPLAY_API_BASE` | build frontend (= URL que ve el usuario) |
| `CORS_ORIGINS` | backend (= mismo origen que el sitio) |
| Secretos Supabase/R2 | `.env` compartido |

Guía completa de la VM: `docs/VPS-DEPLOY.md`.
