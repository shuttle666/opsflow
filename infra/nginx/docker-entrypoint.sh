#!/bin/sh

set -eu

: "${APP_DOMAIN:?APP_DOMAIN is required}"
: "${API_DOMAIN:?API_DOMAIN is required}"
: "${CERT_NAME:?CERT_NAME is required}"
: "${EVIDENCE_MAX_SIZE_BYTES:=10485760}"

case "${EVIDENCE_MAX_SIZE_BYTES}" in
  ""|*[!0-9]*)
    echo "EVIDENCE_MAX_SIZE_BYTES must be a positive integer."
    exit 1
    ;;
esac

if [ "${EVIDENCE_MAX_SIZE_BYTES}" -le 0 ]; then
  echo "EVIDENCE_MAX_SIZE_BYTES must be a positive integer."
  exit 1
fi

# Nginx limits the complete multipart body, while the application limit applies
# to the uploaded file. Keep one MiB for the multipart envelope and form fields.
EVIDENCE_REQUEST_MAX_SIZE_BYTES=$((EVIDENCE_MAX_SIZE_BYTES + 1048576))
export EVIDENCE_REQUEST_MAX_SIZE_BYTES

template="/etc/nginx/templates/bootstrap.conf.template"
mode="HTTP bootstrap"
cert_dir="/etc/letsencrypt/live/${CERT_NAME}"

if [ -f "${cert_dir}/fullchain.pem" ] && [ -f "${cert_dir}/privkey.pem" ]; then
  template="/etc/nginx/templates/ssl.conf.template"
  mode="HTTPS"
fi

envsubst '${APP_DOMAIN} ${API_DOMAIN} ${CERT_NAME} ${EVIDENCE_REQUEST_MAX_SIZE_BYTES}' \
  < "${template}" \
  > /etc/nginx/conf.d/default.conf

echo "Starting nginx in ${mode} mode."

if [ "${NGINX_CONFIG_TEST_ONLY:-false}" = "true" ]; then
  exec nginx -t
fi

exec nginx -g 'daemon off;'
