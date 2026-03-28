#!/bin/sh

set -eu

: "${APP_DOMAIN:?APP_DOMAIN is required}"
: "${API_DOMAIN:?API_DOMAIN is required}"
: "${CERT_NAME:?CERT_NAME is required}"

template="/etc/nginx/templates/bootstrap.conf.template"
mode="HTTP bootstrap"
cert_dir="/etc/letsencrypt/live/${CERT_NAME}"

if [ -f "${cert_dir}/fullchain.pem" ] && [ -f "${cert_dir}/privkey.pem" ]; then
  template="/etc/nginx/templates/ssl.conf.template"
  mode="HTTPS"
fi

envsubst '${APP_DOMAIN} ${API_DOMAIN} ${CERT_NAME}' \
  < "${template}" \
  > /etc/nginx/conf.d/default.conf

echo "Starting nginx in ${mode} mode."

exec nginx -g 'daemon off;'
