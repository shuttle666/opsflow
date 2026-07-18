#!/bin/sh
set -eu

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
compose_file="${script_dir}/docker-compose.yml"
project_name="opsflow-nginx-smoke"

command -v docker >/dev/null 2>&1 || {
  echo "Docker is required to run the Nginx ingress smoke."
  exit 1
}
command -v openssl >/dev/null 2>&1 || {
  echo "OpenSSL is required to validate the HTTPS Nginx template."
  exit 1
}

certs_dir=$(mktemp -d "${TMPDIR:-/tmp}/opsflow-nginx-smoke.XXXXXX")
export NGINX_SMOKE_CERTS_DIR="${certs_dir}"

cleanup() {
  exit_code=$?
  trap - EXIT

  if [ "${exit_code}" -ne 0 ]; then
    docker compose -p "${project_name}" -f "${compose_file}" logs --no-color || true
  fi

  docker compose -p "${project_name}" -f "${compose_file}" down --volumes --remove-orphans || true
  rm -rf "${certs_dir}"
  exit "${exit_code}"
}

trap cleanup EXIT

mkdir -p "${certs_dir}/live/smoke"
openssl req -x509 -newkey rsa:2048 -nodes -days 1 \
  -keyout "${certs_dir}/live/smoke/privkey.pem" \
  -out "${certs_dir}/live/smoke/fullchain.pem" \
  -subj "/CN=api.opsflow.test" \
  >/dev/null 2>&1

docker compose -p "${project_name}" -f "${compose_file}" build
docker compose -p "${project_name}" -f "${compose_file}" up -d --wait fixture
docker compose -p "${project_name}" -f "${compose_file}" run --rm --no-deps ssl-config
docker compose -p "${project_name}" -f "${compose_file}" up \
  --abort-on-container-exit \
  --exit-code-from smoke \
  smoke
