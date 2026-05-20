#!/usr/bin/env bash
# Instala Docker Engine + Compose plugin en Ubuntu 24.04 (GCP VPS).
# Ejecutar después de crear la VM: sudo bash infra/vps-setup-docker.sh
set -euo pipefail

echo "[1/4] Dependencias base…"
sudo apt-get update -y
sudo apt-get install -y ca-certificates curl gnupg

echo "[2/4] Docker oficial…"
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sudo sh
fi

echo "[3/4] Usuario en grupo docker…"
sudo usermod -aG docker "${SUDO_USER:-$USER}" 2>/dev/null || true

echo "[4/4] Carpetas VJ Play…"
sudo mkdir -p /opt/vjplay /var/log/vjplay
sudo chown -R "${SUDO_USER:-$USER}:${SUDO_USER:-$USER}" /opt/vjplay /var/log/vjplay 2>/dev/null || true

echo
docker --version
docker compose version
echo
echo "Listo. Si agregaste tu usuario al grupo docker, cerrá sesión SSH y volvé a entrar."
echo "Próximo paso:"
echo "  cd /opt/vjplay/source/deploy && cp .env.example .env && docker compose up -d --build"
