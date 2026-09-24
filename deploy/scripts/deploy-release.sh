#!/usr/bin/env bash
set -Eeuo pipefail

ROOT=${1:?Usage: deploy-release.sh DEPLOY_ROOT RELEASE_SHA GHCR_OWNER}
SHA=${2:?Missing release SHA}
OWNER=${3:?Missing GHCR owner}

[[ "$ROOT" =~ ^/[A-Za-z0-9._/-]+$ && "$ROOT" != "/" && "$ROOT" != *".."* && "$ROOT" != *"//"* ]] || { echo "Invalid deploy root" >&2; exit 2; }
[[ "$SHA" =~ ^[0-9a-f]{40}$ ]] || { echo "Invalid release SHA" >&2; exit 2; }
[[ "$OWNER" =~ ^[a-z0-9][a-z0-9-]*$ ]] || { echo "Invalid GHCR owner" >&2; exit 2; }

RELEASE="$ROOT/releases/$SHA"
ARCHIVE="/tmp/vjplay-deploy-$SHA.tar.gz"
PREVIOUS_FILE="$ROOT/last-successful-sha"
PREVIOUS=""
[[ -f "$PREVIOUS_FILE" ]] && PREVIOUS=$(cat "$PREVIOUS_FILE")

if [[ ! -f "$ROOT/.env" ]]; then
  echo "Missing runtime environment file: $ROOT/.env" >&2
  exit 1
fi

mkdir -p "$RELEASE"
tar -xzf "$ARCHIVE" --strip-components=1 -C "$RELEASE"
rm -f "$ARCHIVE"
ln -sfn "$ROOT/.env" "$RELEASE/.env"

compose() {
  IMAGE_REGISTRY="ghcr.io/$OWNER" IMAGE_TAG="$1" docker compose \
    --project-name vjplay \
    --env-file "$ROOT/.env" \
    -f "$RELEASE/docker-compose.yml" \
    -f "$RELEASE/docker-compose.registry.yml" "${@:2}"
}

wait_healthy() {
  local attempt
  for attempt in $(seq 1 48); do
    if curl --fail --silent --show-error http://127.0.0.1/health >/dev/null 2>&1 \
      && curl --fail --silent http://127.0.0.1/ >/dev/null 2>&1; then
      return 0
    fi
    sleep 5
  done
  return 1
}

rollback() {
  local failed=$?
  trap - ERR
  if [[ -n "$PREVIOUS" && "$PREVIOUS" =~ ^[0-9a-f]{40}$ && -d "$ROOT/releases/$PREVIOUS" ]]; then
    echo "Release failed; restoring previous successful SHA $PREVIOUS" >&2
    RELEASE="$ROOT/releases/$PREVIOUS"
    ln -sfn "$ROOT/.env" "$RELEASE/.env"
    if compose "$PREVIOUS" pull backend frontend caddy \
      && compose "$PREVIOUS" up -d --no-build backend frontend caddy \
      && wait_healthy; then
      echo "Rollback to $PREVIOUS is healthy" >&2
    else
      echo "Rollback attempted but health checks failed; inspect Docker logs on the VPS" >&2
    fi
  else
    echo "No previous successful SHA is recorded; automatic rollback is unavailable on the first managed release" >&2
  fi
  exit "$failed"
}

trap rollback ERR
compose "$SHA" pull backend frontend caddy
compose "$SHA" up -d --no-build backend frontend caddy
wait_healthy
printf '%s\n' "$SHA" > "$PREVIOUS_FILE.tmp"
mv "$PREVIOUS_FILE.tmp" "$PREVIOUS_FILE"
trap - ERR
echo "Release $SHA is healthy. Recorder service and its persistent volume were not changed."
