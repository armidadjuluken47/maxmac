#!/usr/bin/env bash
# Production deploy for MaxMac on a VPS.
#
# Usage (on server):
#   cp deploy/env.example deploy/env   # once, then edit
#   chmod +x deploy/deploy.sh deploy/install-nginx.sh
#   ./deploy/deploy.sh
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${SCRIPT_DIR}/env"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing ${ENV_FILE}. Copy deploy/env.example to deploy/env and edit it."
  exit 1
fi

# shellcheck disable=SC1090
source "$ENV_FILE"

APP_ROOT="${APP_ROOT:-$REPO_ROOT}"
PUBLIC_WP_URL="${PUBLIC_WP_URL:-https://wp.maxmacsafaris.com}"
FRONTEND_ORIGIN="${FRONTEND_ORIGIN:-https://maxmacsafaris.com}"
NPM_CI="${NPM_CI:-1}"
RUN_WP_IMPORT="${RUN_WP_IMPORT:-0}"

cd "$APP_ROOT"

echo "==> Pull latest code"
git pull --ff-only

echo "==> Build Astro frontend (PUBLIC_WP_URL=${PUBLIC_WP_URL})"
cd frontend
if [[ "$NPM_CI" == "1" ]]; then
  npm ci
else
  npm install
fi
PUBLIC_WP_URL="$PUBLIC_WP_URL" npm run build
cd "$APP_ROOT"

WP_CONFIG="${APP_ROOT}/wordpress-maxmac/wp-config.php"
if [[ -f "$WP_CONFIG" ]]; then
  echo "==> Ensure SF_FRONTEND_ORIGIN in wp-config.php"
  if grep -q "SF_FRONTEND_ORIGIN" "$WP_CONFIG"; then
    echo "    SF_FRONTEND_ORIGIN already defined — update manually if needed: ${FRONTEND_ORIGIN}"
  else
    echo "    Add this line to wp-config.php before 'stop editing':"
    echo "    define('SF_FRONTEND_ORIGIN', '${FRONTEND_ORIGIN}');"
  fi
fi

if [[ "$RUN_WP_IMPORT" == "1" ]]; then
  echo "==> Refresh AMS catalog JSON"
  node scripts/import-africanmecca.mjs
  echo "==> Sync trips to WordPress"
  php wordpress-maxmac/scripts/import-africanmecca-trips.php
fi

echo "==> Reload Nginx"
if command -v nginx >/dev/null 2>&1; then
  sudo nginx -t
  sudo systemctl reload nginx
fi

echo ""
echo "Deploy complete."
echo "  Frontend: ${FRONTEND_ORIGIN}"
echo "  WordPress API: ${PUBLIC_WP_URL}"
echo ""
echo "Smoke tests:"
echo "  curl -s ${PUBLIC_WP_URL}/wp-json/wptravelengine/v2/trips?per_page=1 | head"
echo "  curl -s ${FRONTEND_ORIGIN}/api/geo"
