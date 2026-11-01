#!/usr/bin/env bash
set -euo pipefail

echo "=========================================================="
echo "  Deploying OpenScript to Dev (dev-openscript.ssnpictures.in)"
echo "=========================================================="

cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "--> No .env file found. Copying .env.example..."
  cp .env.example .env
fi

if git rev-parse --git-dir > /dev/null 2>&1; then
  echo "--> Pulling latest dev branch..."
  git checkout dev || true
  git pull origin dev || true
fi

echo "--> Building and starting dev containers..."
docker compose -f compose.dev.yaml build
docker compose -f compose.dev.yaml up -d

echo "--> Verifying services health..."
sleep 5
docker compose -f compose.dev.yaml ps

echo "=========================================================="
echo "  OpenScript Dev Deployment Complete!"
echo "  Web: https://dev-openscript.ssnpictures.in"
echo "  API: https://dev-openscript.ssnpictures.in/api/v1/health"
echo "=========================================================="
