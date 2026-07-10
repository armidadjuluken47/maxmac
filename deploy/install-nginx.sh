#!/usr/bin/env bash
# Render Nginx vhost configs from deploy/env and install into sites-available.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/env"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing ${ENV_FILE}. Copy deploy/env.example to deploy/env and edit it."
  exit 1
fi

# shellcheck disable=SC1090
source "$ENV_FILE"

# Auto-detect PHP-FPM socket if deploy/env points at a missing file (common 502 cause).
_sock="${PHP_FPM_SOCK#unix:}"
if [[ -z "${PHP_FPM_SOCK:-}" ]] || [[ ! -S "$_sock" ]]; then
  _detected="$(find /run/php -name 'php*-fpm.sock' 2>/dev/null | head -1)"
  if [[ -n "$_detected" ]]; then
    echo "Using detected PHP-FPM socket: unix:${_detected}"
    PHP_FPM_SOCK="unix:${_detected}"
  fi
fi

for var in APP_ROOT FRONTEND_DOMAIN FRONTEND_DOMAIN_WWW WP_DOMAIN PHP_FPM_SOCK; do
  if [[ -z "${!var:-}" ]]; then
    echo "Set ${var} in deploy/env"
    exit 1
  fi
done

render() {
  local template="$1"
  local out="$2"
  sed \
    -e "s|APP_ROOT|${APP_ROOT}|g" \
    -e "s|FRONTEND_DOMAIN_WWW|${FRONTEND_DOMAIN_WWW}|g" \
    -e "s|FRONTEND_DOMAIN|${FRONTEND_DOMAIN}|g" \
    -e "s|WP_DOMAIN|${WP_DOMAIN}|g" \
    -e "s|PHP_FPM_SOCK|${PHP_FPM_SOCK}|g" \
    "$template" | sudo tee "$out" >/dev/null
  echo "Wrote $out"
}

render "${SCRIPT_DIR}/nginx/frontend.conf" "/etc/nginx/sites-available/maxmac-frontend"
render "${SCRIPT_DIR}/nginx/wordpress.conf" "/etc/nginx/sites-available/maxmac-wp"

sudo ln -sf /etc/nginx/sites-available/maxmac-frontend /etc/nginx/sites-enabled/maxmac-frontend
sudo ln -sf /etc/nginx/sites-available/maxmac-wp /etc/nginx/sites-enabled/maxmac-wp

sudo nginx -t
sudo systemctl reload nginx

echo ""
echo "Nginx configs installed. Next:"
echo "  sudo certbot --nginx -d ${FRONTEND_DOMAIN} -d ${FRONTEND_DOMAIN_WWW}"
echo "  sudo certbot --nginx -d ${WP_DOMAIN}"
