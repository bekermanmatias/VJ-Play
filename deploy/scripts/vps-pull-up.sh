#!/usr/bin/env bash
# En la VPS: bajar imágenes y levantar sin compilar (sin astro build).
set -euo pipefail
cd "$(dirname "$0")/.."

COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.registry.yml)

if [[ ! -f .env ]] || ! grep -qE '^IMAGE_REGISTRY=.+' .env; then
  echo "Falta IMAGE_REGISTRY en deploy/.env (mismo valor que en tu PC)." >&2
  exit 1
fi

echo ">> pull..."
"${COMPOSE[@]}" pull

PROFILE=()
[[ "${1:-}" == "--recorder" ]] && PROFILE=(--profile recorder)

echo ">> up -d (sin build)..."
"${COMPOSE[@]}" up -d --no-build "${PROFILE[@]}"

"${COMPOSE[@]}" ps
curl -sf http://127.0.0.1/health && echo "" && echo "OK /health" || echo "WARN: /health no respondió aún"
