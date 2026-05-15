# VJ Play — Deploy del recorder en VPS (Google Cloud Free Tier)

Guía para levantar el servicio `recorder/` en una VM Ubuntu 24.04 LTS de
Google Cloud Compute Engine, conectada por WireGuard al Mikrotik del club.

---

## 1. Crear la VM en Google Cloud

### 1.1 Free Tier permanente

- **Tipo:** `e2-micro` (1 vCPU compartida, 1 GB RAM)
- **Región:** `us-west1`, `us-central1` o `us-east1` (las únicas que cuentan como free)
- **Imagen:** **Ubuntu 24.04 LTS** (x86_64, "Minimal" está bien)
- **Disco:** 30 GB SSD estándar (el máximo gratis)
- **Networking:** dejar IP pública efímera (gratis) o reservar una estática (cuesta cuando la VM está apagada)
- **Firewall:** marcar "Allow HTTPS / HTTP" no es necesario; el recorder no expone puertos. Sí necesitás dejar SSH (22).

### 1.2 Generar par de llaves SSH (Windows)

Desde PowerShell:

```powershell
ssh-keygen -t ed25519 -C "vjplay-recorder" -f $HOME\.ssh\vjplay_recorder
type $HOME\.ssh\vjplay_recorder.pub
```

Pegá la pública en la sección **SSH Keys** de Compute Engine → "Metadata".

### 1.3 Conectar

```powershell
ssh -i $HOME\.ssh\vjplay_recorder USERNAME@<IP-PUBLICA-VPS>
```

---

## 2. Setup base del VPS (una sola vez)

Pegar todo el bloque como un solo script (también está en `infra/vps-setup.sh`):

```bash
sudo apt-get update
sudo apt-get -y upgrade

# Node 20 LTS (NodeSource)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# FFmpeg + utils
sudo apt-get install -y ffmpeg wireguard-tools resolvconf jq

# Carpeta de trabajo
sudo mkdir -p /opt/vjplay /var/lib/vjplay-recorder /var/log/vjplay
sudo chown -R $USER:$USER /opt/vjplay /var/lib/vjplay-recorder /var/log/vjplay

ffmpeg -version | head -n 1
node --version
```

---

## 3. WireGuard cliente (apuntando al Mikrotik del club)

```bash
cd /etc/wireguard
sudo umask 077
sudo bash -c 'wg genkey | tee privatekey | wg pubkey > publickey'
sudo cat privatekey   # <- privada (queda en el VPS, NO compartir)
sudo cat publickey    # <- pública (la cargás en Mikrotik → WireGuard → Peers)
```

Crear `/etc/wireguard/wg0.conf`:

```ini
[Interface]
PrivateKey = <privatekey-del-VPS>
Address = 10.99.0.2/24
# Forzar DNS por wg para evitar leaks (opcional)
# DNS = 1.1.1.1

[Peer]
PublicKey = <publickey-del-Mikrotik>
Endpoint = <ip-publica-o-DDNS-del-club>:13231
AllowedIPs = 10.99.0.0/24, 192.168.88.0/24
PersistentKeepalive = 25
```

Levantar y dejar persistente:

```bash
sudo wg-quick up wg0
sudo systemctl enable wg-quick@wg0
sudo wg show
```

Validar conexión al club:

```bash
ping -c 4 10.99.0.1                  # ← Mikrotik
ping -c 4 192.168.88.10              # ← DVR Dahua
nc -zv 192.168.88.10 554             # ← puerto RTSP abierto
```

---

## 4. Deploy del recorder

### 4.1 Subir el código

Desde tu máquina (Windows) con el repo del proyecto:

```powershell
# Sincronizar la carpeta recorder/ al VPS
scp -i $HOME\.ssh\vjplay_recorder -r recorder USERNAME@<IP-VPS>:/opt/vjplay/
```

O clonando el repo en el VPS (si está en GitHub privado, necesitás deploy key):

```bash
cd /opt/vjplay
git clone git@github.com:tu-org/vj-play.git source
ln -s /opt/vjplay/source/recorder /opt/vjplay/recorder
```

### 4.2 Configurar `.env`

```bash
cd /opt/vjplay/recorder
cp .env.example .env
nano .env   # completar todas las variables
```

Datos a completar:
- Credenciales Supabase y R2 (las mismas del backend, salvo que prefieras una API key separada).
- `DVR_HOST=192.168.88.10`, `DVR_RTSP_USER=recorder`, `DVR_RTSP_PASSWORD=<de Dahua>`.
- `RECORDING_TIMEZONE=America/Argentina/Buenos_Aires`.
- `RECORDER_HOST_LABEL=gcp-free-tier-1` (para diferenciar en heartbeat).

### 4.3 Build

```bash
cd /opt/vjplay/recorder
npm ci --omit=dev=false
npm run build
```

### 4.4 Probar manualmente

Antes de hacer el daemon, probá un ciclo:

```bash
# Verificar la conexión RTSP de una cancha (necesita estar cargada en Supabase
# con recording_enabled=true y dvr_channel seteado)
npm run probe -- --court cancha-padel
```

Si responde con metadata del stream → red OK y credenciales OK.

```bash
# Correr en foreground unos minutos
node dist/index.js
```

Verificá que:
- `replay_assets` recibe upserts cuando termina un segmento.
- `recorder_heartbeat` se actualiza cada N segundos.
- En R2 aparecen objetos bajo `tenants/{tenant}/replays/<cancha>/<YYYY-MM-DD>/<HH>.mp4`.

### 4.5 Daemon con systemd

`/etc/systemd/system/vjplay-recorder.service`:

```ini
[Unit]
Description=VJ Play recorder
After=network-online.target wg-quick@wg0.service
Wants=network-online.target wg-quick@wg0.service

[Service]
Type=simple
User=USERNAME
WorkingDirectory=/opt/vjplay/recorder
EnvironmentFile=/opt/vjplay/recorder/.env
ExecStart=/usr/bin/node /opt/vjplay/recorder/dist/index.js
Restart=always
RestartSec=10
StandardOutput=append:/var/log/vjplay/recorder.log
StandardError=append:/var/log/vjplay/recorder.err.log

# Hardening básico
ProtectSystem=full
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

Activar:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now vjplay-recorder
sudo systemctl status vjplay-recorder
sudo journalctl -u vjplay-recorder -f
```

---

## 5. Operación diaria

```bash
# Ver estado
sudo systemctl status vjplay-recorder

# Logs en vivo
sudo journalctl -u vjplay-recorder -f

# Tamaño del buffer local
du -sh /var/lib/vjplay-recorder/

# Conexión VPN
sudo wg show
```

Reiniciar tras cambiar el `.env`:

```bash
sudo systemctl restart vjplay-recorder
```

---

## 6. Limpieza de buffer local

Si `RECORDING_LOCAL_RETENTION_HOURS > 0`, los archivos subidos a R2 quedan
en `/var/lib/vjplay-recorder/<cancha>/` hasta que pase ese tiempo. Para
hacer la limpieza:

`/etc/systemd/system/vjplay-recorder-cleanup.service`:
```ini
[Unit]
Description=Limpia buffer local del recorder

[Service]
Type=oneshot
ExecStart=/usr/bin/find /var/lib/vjplay-recorder -type f -name "*.mp4" -mmin +1440 -delete
```

`/etc/systemd/system/vjplay-recorder-cleanup.timer`:
```ini
[Unit]
Description=Cleanup diario del buffer recorder

[Timer]
OnCalendar=*-*-* 04:00:00
Persistent=true

[Install]
WantedBy=timers.target
```

```bash
sudo systemctl enable --now vjplay-recorder-cleanup.timer
```

(`-mmin +1440` = más de 24 horas. Ajustar a `RECORDING_LOCAL_RETENTION_HOURS * 60`.)

---

## 7. Costos esperados en free tier

| Recurso | Free tier | Estimado con 2 canchas 1080p |
|---|---|---|
| Compute e2-micro | 1 instancia / mes | ✓ |
| Disco SSD 30 GB | gratis | usa ~1-2 GB |
| Egress a internet | 1 GB/mes fuera de NA | ⚠ probablemente exceda |
| Egress a GCP | gratis | n/a |

**Egress es el riesgo.** Cada MB que el VPS sube a R2 cuenta como egress. Con
2 cámaras 1080p a 4 Mbps grabando 8 hs/día, son ~115 GB/día. Activá
"alertas de billing" en GCP y poné un cap.

Para producción real: **migrar a Hetzner CPX11** (€4.51/mes, 20 TB tráfico
incluido). El recorder es portable, basta repetir las secciones 2 a 4.
