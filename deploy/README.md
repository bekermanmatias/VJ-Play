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

## Preparación inicial de VPS

La publicación automatizada actual requiere una VPS preparada; el workflow no crea infraestructura ni configura firewall/DNS.

1. Crear una VM Ubuntu/Debian con Docker Engine, Compose plugin, `curl`, `tar` y usuario de deploy con acceso a Docker.
2. Crear `/opt/vjplay` y copiar `deploy/.env.example` como `/opt/vjplay/.env`; completar los valores runtime sin versionarlos. Deben definirse `ADMIN_SECRET` y `ADMIN_SESSION_SECRET` distintos.
3. Si las imágenes GHCR son privadas, ejecutar `docker login ghcr.io` en la VPS con un token de solo lectura `read:packages`.
4. Configurar SSH dedicado, restringido y con clave de host verificada; configurar `VPS_KNOWN_HOSTS` en GitHub. El workflow no ejecuta `ssh-keyscan`.

Para pruebas locales se puede usar `docker compose up -d --build` desde `deploy/`; la VPS de producción debe actualizarse mediante el release SHA manual de GitHub Actions descrito abajo, no con `git pull` ni tags mutables.

## Recorder + WireGuard

El recorder necesita ver el DVR en la LAN del club. **WireGuard va en el host**, no en Docker. Su configuración y ciclo de vida son independientes del release web; el workflow de VPS no inicia ni actualiza ese servicio.

1. Configurar `wg0` según `docs/MIKROTIK-WIREGUARD.md` y `docs/VPS-DEPLOY.md` §3.
2. Probar: `ping 192.168.88.10` desde la VM.
3. El recorder usa `network_mode: host`, por lo que ve la red del host (incluido `wg0`). Para operarlo, usar de forma explícita el Compose registry-only y un SHA publicado, junto con `/opt/vjplay/.env`; no usar `--build` desde una carpeta de release web.

## Rebuild tras cambiar URLs del front

`PUBLIC_REPLAY_API_BASE` se embebe en el build de Astro:

```bash
docker compose build --no-cache frontend
docker compose up -d
```

Guía complementaria de WireGuard y la VM: `docs/VPS-DEPLOY.md`.

## CI y releases a VPS con GitHub Actions + GHCR

El único pipeline de publicación es `.github/workflows/deploy-vps.yml`:

- Pull requests y pushes a `staging`/`main` ejecutan lint, typecheck, tests y builds de frontend, backend y recorder.
- Los pushes a `staging` y `main` publican los tres contenedores en GHCR con el SHA completo del commit. Los tags `staging`/`main` son alias; no se usan para elegir una versión en producción.
- No hay una VPS de staging configurada en el repositorio: el branch `staging` valida y publica imágenes, pero no despliega.
- Producción **no se despliega al hacer push**. Desde Actions, ejecutar manualmente el workflow en la rama `main`, indicar un SHA completo alcanzable desde `main` y activar `deploy_production`. El job requiere el environment `production`, que debe configurarse en **Settings → Environments** con reviewers/approval antes de habilitar releases.
- La VPS descarga configuración versionada del mismo SHA y usa imágenes con ese SHA exacto. El deploy no ejecuta migraciones ni actualiza/reinicia el servicio `recorder`. El seed SQL de staging permanece como workflow separado y explícito.

Los antiguos workflows de deploy a Cloudflare Pages y Cloud Run se retiraron: Pages recibía un build SSR de Astro no compatible con hosting estático; Cloud Run podía desplegar backend independientemente y ejecutar migraciones automáticamente. El publisher separado del recorder también se consolidó en el pipeline GHCR.

### Preparar la VPS (Ubuntu/Debian)

1. Instalar Docker Engine, Docker Compose plugin y `curl`; dar al usuario de deploy acceso a Docker.
2. Crear el directorio raíz, por defecto `/opt/vjplay`, y guardar la configuración runtime en `/opt/vjplay/.env` (basarse en `deploy/.env.example`). No se sube ni versiona ese archivo.
3. Configurar `ADMIN_SECRET` y `ADMIN_SESSION_SECRET` con valores distintos, además de las credenciales backend de Supabase/R2 y las variables runtime requeridas. Los secretos de Mercado Pago, si se utilizan, permanecen únicamente en este `.env` del backend; nunca en GitHub build args.
4. Para paquetes GHCR privados, autenticar Docker en la VPS con un token de solo lectura (`read:packages`) antes del release. Para paquetes públicos no hace falta.
5. Configurar acceso SSH dedicado y restringido. El workflow exige una clave de host fijada previamente; no hace `ssh-keyscan` durante el release.

### Configurar GitHub

En **Settings → Secrets and variables → Actions**, configurar:

| Tipo | Nombre | Uso |
|---|---|---|
| Secret | `VPS_HOST` | Host/IP SSH de la VPS |
| Secret | `VPS_USER` | Usuario con acceso Docker |
| Secret | `VPS_SSH_KEY` | Clave privada dedicada del workflow |
| Secret | `VPS_KNOWN_HOSTS` | Línea(s) `known_hosts` verificada(s) fuera del workflow (`[host]:puerto` si no es 22) |
| Secret | `VPS_SSH_PORT` | Opcional; default 22 |
| Variable | `VPS_DEPLOY_PATH` | Raíz de deploy en VPS; default `/opt/vjplay` |
| Variable | `PUBLIC_REPLAY_API_BASE` | URL pública no secreta embebida en frontend build |

El `GITHUB_TOKEN` del job recibe `packages: write` para publicar GHCR. **No** configurar `ADMIN_SECRET`, `ADMIN_SESSION_SECRET`, credenciales Supabase/R2 ni credenciales de pagos como build args o variables de build. Compose exige ambos secretos admin al iniciar frontend; estarán en `.env` runtime de la VPS.

### Release, salud y rollback

El deploy copia solo los archivos `deploy/` trackeados del SHA solicitado, preserva `/opt/vjplay/.env` y las named volumes, descarga las imágenes del SHA, y actualiza explícitamente `backend`, `frontend` y `caddy`. Hace reintentos de `/health` y `/`; si falla, intenta volver al último SHA exitoso registrado. En el primer release gestionado todavía no hay SHA previo y no existe rollback automático; debe prepararse una versión operativa conocida antes de usar este pipeline en producción.

Para rollback posterior, ejecutar el workflow manual seleccionando el SHA conocido (debe seguir siendo ancestro de `main`). La configuración de TLS no está incluida en `deploy/Caddyfile`: hoy publica HTTP por el puerto 80; no exponer credenciales sobre una red insegura y configurar TLS en una tarea separada antes del uso público sensible.

El workflow no contacta la VPS salvo en un `workflow_dispatch` de producción aprobado. No hace `git pull/reset` en la VPS, no compila allí, no ejecuta migraciones y no modifica el servicio ni el volumen persistente del recorder.
