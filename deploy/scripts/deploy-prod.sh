#!/usr/bin/env bash
# Deploy the production Docker Compose stack from the EC2 checkout.
set -Eeuo pipefail

: "${DEPLOY_PATH:?DEPLOY_PATH is required}"
: "${DEPLOY_SHA:?DEPLOY_SHA is required}"
: "${API_HEALTH_URL:?API_HEALTH_URL is required}"

cd "$DEPLOY_PATH"

if [ ! -d ".git" ]; then
  echo "$DEPLOY_PATH is not a Git repository."
  exit 1
fi

if [ ! -f ".env.production" ]; then
  echo "Missing .env.production in $DEPLOY_PATH."
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
PREVIOUS_SHA="$(git rev-parse HEAD)"
ROLLBACK_NEEDED=false

rollback() {
  status=$?
  if [ "$status" -eq 0 ]; then
    return 0
  fi

  if [ "$ROLLBACK_NEEDED" = "true" ]; then
    echo "Deployment failed. Rolling back to $PREVIOUS_SHA."
    git checkout "$PREVIOUS_SHA" || true
    "${COMPOSE[@]}" up -d --build --remove-orphans || true
  fi

  exit "$status"
}

trap rollback EXIT

echo "Fetching latest main branch from origin."
git fetch origin main:refs/remotes/origin/main

ORIGIN_MAIN_SHA="$(git rev-parse origin/main)"
if [ "$ORIGIN_MAIN_SHA" != "$DEPLOY_SHA" ]; then
  echo "Skipping stale deployment. CI completed for $DEPLOY_SHA, but origin/main is $ORIGIN_MAIN_SHA."
  exit 0
fi

git checkout main
git pull --ff-only origin main

CURRENT_SHA="$(git rev-parse HEAD)"
if [ "$CURRENT_SHA" != "$DEPLOY_SHA" ]; then
  echo "Deployment checkout mismatch. Expected $DEPLOY_SHA, got $CURRENT_SHA."
  exit 1
fi

ROLLBACK_NEEDED=true

echo "Deploying $DEPLOY_SHA with Docker Compose."
"${COMPOSE[@]}" up -d --build --remove-orphans
"${COMPOSE[@]}" ps

wait_for_container() {
  container_name="$1"
  expected_status="$2"

  for attempt in $(seq 1 40); do
    state="$(docker inspect --format '{{.State.Status}}' "$container_name" 2>/dev/null || true)"
    health="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{end}}' "$container_name" 2>/dev/null || true)"

    if [ "$expected_status" = "healthy" ] && [ "$health" = "healthy" ]; then
      echo "$container_name is healthy."
      return 0
    fi

    if [ "$expected_status" = "running" ] && [ "$state" = "running" ]; then
      echo "$container_name is running."
      return 0
    fi

    echo "Waiting for $container_name. state=${state:-unknown} health=${health:-none} attempt=$attempt/40"
    sleep 5
  done

  docker logs --tail=100 "$container_name" || true
  return 1
}

wait_for_container opsflow-server-prod healthy
wait_for_container opsflow-client-prod healthy
wait_for_container opsflow-nginx-prod running

echo "Checking API health endpoint."
curl --fail --silent --show-error "$API_HEALTH_URL" >/dev/null

if [ -n "${APP_URL:-}" ]; then
  echo "Checking app endpoint."
  curl --fail --silent --show-error "$APP_URL" >/dev/null
fi

ROLLBACK_NEEDED=false
echo "Production deployment completed successfully."
