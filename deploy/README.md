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

## Build en tu PC → push → pull en la VPS (recomendado)

Evita compilar Astro en una **e2-micro**. Las imágenes se arman en tu máquina y la VM solo las baja.

### 1. Docker Hub (o GHCR)

1. Creá cuenta en [Docker Hub](https://hub.docker.com/) y un repo **público** (o privado + `docker login` en la VPS).
2. En **tu PC**, en `deploy/.env`:

```env
IMAGE_REGISTRY=docker.io/tuusuario
IMAGE_TAG=latest
PUBLIC_REPLAY_API_BASE=http://IP_PUBLICA_DE_LA_VPS
SITE_HOST=http://IP_PUBLICA_DE_LA_VPS
CORS_ORIGINS=http://IP_PUBLICA_DE_LA_VPS
# … resto de secretos igual que en la VPS
```

3. Login y build+push (PowerShell, desde `deploy/`):

```powershell
docker login
.\scripts\build-push.ps1
# Con recorder: .\scripts\build-push.ps1 -WithRecorder
```

Linux/macOS: `chmod +x scripts/build-push.sh && ./scripts/build-push.sh`

Sube: `tuusuario/vjplay-backend`, `tuusuario/vjplay-frontend` (y `vjplay-recorder` si aplica).

### 2. En la VPS (sin `--build`)

Mismo `IMAGE_REGISTRY` e `IMAGE_TAG` en `deploy/.env`:

```bash
cd /opt/vjplay/source/deploy
git pull
docker login   # solo si las imágenes son privadas
./scripts/vps-pull-up.sh
# Con recorder: ./scripts/vps-pull-up.sh --recorder
```

Equivalente manual:

```bash
docker compose -f docker-compose.yml -f docker-compose.registry.yml pull
docker compose -f docker-compose.yml -f docker-compose.registry.yml up -d
```

### 3. Actualizar después de cambios en el código

En la PC: `git pull` → `.\scripts\build-push.ps1` (sube tag `latest` o cambiá `IMAGE_TAG`).

En la VPS: `git pull` → `./scripts/vps-pull-up.sh`.

Si cambiás `PUBLIC_REPLAY_API_BASE`, rebuild del front en la PC (el script ya hace `build` completo).

## Variables clave

| Variable | Dónde |
|----------|--------|
| `IMAGE_REGISTRY` | PC + VPS (`docker.io/usuario` o `ghcr.io/usuario`) |
| `IMAGE_TAG` | PC + VPS (ej. `latest`) |
| `VJ_RUNTIME=vps` | backend + recorder |
| `PUBLIC_REPLAY_API_BASE` | build frontend en la PC (= URL que ve el usuario) |
| `CORS_ORIGINS` | backend (= mismo origen que el sitio) |
| Secretos Supabase/R2 | `.env` compartido |

Guía completa de la VM: `docs/VPS-DEPLOY.md`.
