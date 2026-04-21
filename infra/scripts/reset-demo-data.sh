#!/usr/bin/env bash
# Reset only the public production demo tenant data.
set -Eeuo pipefail

if [ -n "${DEPLOY_PATH:-}" ]; then
  cd "$DEPLOY_PATH"
fi

if [ ! -d ".git" ]; then
  echo "Run this script from the EC2 deployment checkout, or set DEPLOY_PATH."
  exit 1
fi

if [ ! -f ".env.production" ]; then
  echo "Missing .env.production in $(pwd)."
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is not installed or not available to this user."
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "Docker Compose plugin is not installed or not available to this user."
  exit 1
fi

COMPOSE=(docker compose --env-file .env.production -f docker-compose.prod.yml)

echo "Checking production server container."
"${COMPOSE[@]}" ps server

echo "Resetting public demo tenant data."
"${COMPOSE[@]}" exec -T server env DEMO_SEED_CONFIRM=reset-production-demo pnpm demo:seed:production

if [ -n "${API_HEALTH_URL:-}" ]; then
  echo "Checking API health endpoint."
  curl --fail --silent --show-error "$API_HEALTH_URL" >/dev/null
fi

if [ -n "${APP_URL:-}" ]; then
  echo "Checking app endpoint."
  curl --fail --silent --show-error "$APP_URL" >/dev/null
fi

echo "Production demo data reset completed successfully."
