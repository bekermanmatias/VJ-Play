#!/usr/bin/env bash
# Build en tu PC y push al registry. Uso: cd deploy && ./scripts/build-push.sh [--recorder] [--no-cache]
set -euo pipefail
cd "$(dirname "$0")/.."

WITH_RECORDER=false
NO_CACHE=""
for arg in "$@"; do
  case "$arg" in
    --recorder) WITH_RECORDER=true ;;
    --no-cache) NO_CACHE="--no-cache" ;;
  esac
done

if [[ ! -f .env ]]; then
  echo "Falta deploy/.env — copiá .env.example y completá IMAGE_REGISTRY." >&2
  exit 1
fi
if ! grep -qE '^IMAGE_REGISTRY=.+' .env; then
  echo "Definí IMAGE_REGISTRY en deploy/.env (ej. docker.io/tuusuario)." >&2
  exit 1
fi

PROFILE=()
[[ "$WITH_RECORDER" == true ]] && PROFILE=(--profile recorder)

echo ">> docker compose build..."
docker compose build $NO_CACHE "${PROFILE[@]}"

SERVICES=(backend frontend)
[[ "$WITH_RECORDER" == true ]] && SERVICES+=(recorder)

echo ">> docker compose push ${SERVICES[*]}..."
docker compose push "${SERVICES[@]}"

cat <<'EOF'

Listo. En la VPS:
  cd /opt/vjplay/source/deploy
  docker compose -f docker-compose.yml -f docker-compose.registry.yml pull
  docker compose -f docker-compose.yml -f docker-compose.registry.yml up -d
EOF
