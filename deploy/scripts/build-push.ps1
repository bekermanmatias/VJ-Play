# Build en tu PC y push a Docker Hub / GHCR.
# Uso (desde deploy/):
#   1. cp .env.example .env  → completar IMAGE_REGISTRY, PUBLIC_REPLAY_API_BASE, etc.
#   2. docker login
#   3. .\scripts\build-push.ps1
#      .\scripts\build-push.ps1 -WithRecorder

param(
  [switch]$WithRecorder,
  [switch]$NoCache
)

$ErrorActionPreference = "Stop"
$DeployRoot = Split-Path -Parent $PSScriptRoot
Set-Location $DeployRoot

if (-not (Test-Path ".env")) {
  Write-Error "Falta deploy/.env — copiá .env.example y completá IMAGE_REGISTRY (ej. docker.io/tuusuario)."
}

$envContent = Get-Content ".env" -Raw
if ($envContent -notmatch "IMAGE_REGISTRY=\s*\S+") {
  Write-Error "Definí IMAGE_REGISTRY en deploy/.env (ej. IMAGE_REGISTRY=docker.io/tuusuario)."
}

$buildArgs = @("compose", "build")
if ($NoCache) { $buildArgs += "--no-cache" }
if ($WithRecorder) {
  $buildArgs += "--profile", "recorder"
}

Write-Host ">> docker compose build (PUBLIC_REPLAY_API_BASE desde .env)..." -ForegroundColor Cyan
& docker @buildArgs
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$pushArgs = @("compose", "push", "backend", "frontend")
if ($WithRecorder) { $pushArgs += "recorder" }

Write-Host ">> docker compose push..." -ForegroundColor Cyan
& docker @pushArgs
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "Listo. En la VPS:" -ForegroundColor Green
Write-Host "  cd /opt/vjplay/source/deploy"
Write-Host "  # mismo IMAGE_REGISTRY e IMAGE_TAG en .env"
Write-Host "  docker compose -f docker-compose.yml -f docker-compose.registry.yml pull"
Write-Host "  docker compose -f docker-compose.yml -f docker-compose.registry.yml up -d"
