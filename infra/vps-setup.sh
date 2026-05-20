#!/usr/bin/env bash
# Setup base de un VPS Ubuntu 24.04 LTS para correr el recorder de VJ Play.
# Idempotente: se puede correr varias veces sin romper nada.
set -euo pipefail

echo "[1/5] Apt update + upgrade…"
sudo apt-get update -y
sudo apt-get -y upgrade

echo "[2/5] Node 20 LTS…"
if ! command -v node >/dev/null 2>&1 || [[ "$(node -v)" != v20* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

echo "[3/5] FFmpeg + WireGuard tools + utilities…"
sudo apt-get install -y \
  ffmpeg \
  wireguard-tools \
  resolvconf \
  jq \
  curl \
  unzip \
  ca-certificates \
  netcat-openbsd

echo "[4/5] Carpetas…"
sudo mkdir -p /opt/vjplay /var/lib/vjplay-recorder /var/log/vjplay
sudo chown -R "$USER":"$USER" /opt/vjplay /var/lib/vjplay-recorder /var/log/vjplay

echo "[5/5] Versiones instaladas:"
echo -n "  node : "; node --version
echo -n "  npm  : "; npm --version
echo -n "  ffmpeg: "; ffmpeg -version | head -n 1
echo -n "  wg   : "; wg --version | head -n 1

echo
echo "Listo. Próximos pasos:"
echo "  1) Configurar /etc/wireguard/wg0.conf y 'sudo wg-quick up wg0'."
echo "  2) Subir la carpeta recorder/ del repo a /opt/vjplay/recorder."
echo "  3) cd /opt/vjplay/recorder && cp .env.example .env && nano .env"
echo "  4) npm ci && npm run build && node dist/index.js"
echo "  5) Cuando esté validado: crear systemd unit (ver docs/VPS-DEPLOY.md sección 4.5)."
