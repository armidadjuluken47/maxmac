#!/usr/bin/env bash
# First-time VPS setup — run once with sudo:
#   cd /var/www/maxmac && sudo ./deploy/setup.sh
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${SCRIPT_DIR}/env"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run with sudo: sudo ./deploy/setup.sh"
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Create deploy/env first:"
  echo "  cp deploy/env.example deploy/env && nano deploy/env"
  exit 1
fi

# shellcheck disable=SC1090
source "$ENV_FILE"

DEPLOY_USER="${SUDO_USER:-$USER}"
APP_ROOT="${APP_ROOT:-$REPO_ROOT}"
PUBLIC_WP_URL="${PUBLIC_WP_URL:-https://wp.maxmacsafaris.com}"
FRONTEND_ORIGIN="${FRONTEND_ORIGIN:-https://maxmacsafaris.com}"

echo "==> MaxMac VPS setup"
echo "    App root:      $APP_ROOT"
echo "    Frontend:      $FRONTEND_ORIGIN"
echo "    WordPress:     $PUBLIC_WP_URL"
echo ""

echo "==> Install system packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq --allow-releaseinfo-change 2>/dev/null || apt-get update -qq
apt-get install -y -qq nginx mariadb-server \
  php-fpm php-mysql php-xml php-curl php-mbstring php-zip php-gd php-intl \
  git unzip certbot python3-certbot-nginx curl

if ! command -v node >/dev/null 2>&1 || [[ "$(node -v | cut -d. -f1 | tr -d v)" -lt 22 ]]; then
  echo "==> Install Node.js 22"
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y -qq nodejs
fi

# Detect PHP-FPM socket
PHP_SOCK="$(find /run/php -name 'php*-fpm.sock' 2>/dev/null | head -1)"
if [[ -z "$PHP_SOCK" ]]; then
  echo "Could not find PHP-FPM socket in /run/php/"
  exit 1
fi
PHP_FPM_SOCK="unix:${PHP_SOCK}"
echo "    PHP-FPM:       $PHP_FPM_SOCK"

# Persist detected socket so install-nginx.sh and re-runs use the right path.
if grep -q '^PHP_FPM_SOCK=' "$ENV_FILE" 2>/dev/null; then
  sed -i "s|^PHP_FPM_SOCK=.*|PHP_FPM_SOCK=${PHP_FPM_SOCK}|" "$ENV_FILE"
else
  echo "PHP_FPM_SOCK=${PHP_FPM_SOCK}" >>"$ENV_FILE"
fi

# Ensure PHP-FPM is running (apt package name varies: php8.3-fpm, php-fpm, etc.)
_php_svc="$(systemctl list-units --type=service --all 'php*-fpm.service' 2>/dev/null | awk '/php.*fpm/ {print $1; exit}')"
if [[ -n "$_php_svc" ]]; then
  systemctl enable "$_php_svc" 2>/dev/null || true
  systemctl start "$_php_svc" 2>/dev/null || true
  echo "    PHP service:   $_php_svc"
fi

echo "==> Create MySQL database (if missing)"
DB_NAME="${MYSQL_DB:-maxmac_wp}"
DB_USER="${MYSQL_USER:-maxmac}"
DB_PASS="${MYSQL_PASSWORD:-}"

if [[ -z "$DB_PASS" ]]; then
  DB_PASS="$(openssl rand -base64 18 | tr -dc 'a-zA-Z0-9' | head -c 20)"
  echo ""
  echo "    Generated MySQL password for user '${DB_USER}': ${DB_PASS}"
  echo "    Saving to deploy/env"
  echo ""
  grep -q '^MYSQL_DB=' "$ENV_FILE" 2>/dev/null || echo "MYSQL_DB=${DB_NAME}" >>"$ENV_FILE"
  grep -q '^MYSQL_USER=' "$ENV_FILE" 2>/dev/null || echo "MYSQL_USER=${DB_USER}" >>"$ENV_FILE"
  if ! grep -q '^MYSQL_PASSWORD=' "$ENV_FILE" 2>/dev/null; then
    echo "MYSQL_PASSWORD=${DB_PASS}" >>"$ENV_FILE"
  fi
fi

mysql -e "CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -e "CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';" 2>/dev/null || true
mysql -e "ALTER USER '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';" 2>/dev/null || true
mysql -e "GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'localhost'; FLUSH PRIVILEGES;"

chown -R "${DEPLOY_USER}:${DEPLOY_USER}" "$APP_ROOT"

echo "==> Configure WordPress (wp-config.php → MySQL)"
WP_CONFIG="${APP_ROOT}/wordpress-maxmac/wp-config.php"
MYSQL_DB="$DB_NAME" MYSQL_USER="$DB_USER" MYSQL_PASSWORD="$DB_PASS" MYSQL_HOST="localhost" \
  FRONTEND_ORIGIN="$FRONTEND_ORIGIN" \
  php "${SCRIPT_DIR}/configure-wp-config.php" "$WP_CONFIG"
chown "${DEPLOY_USER}:${DEPLOY_USER}" "$WP_CONFIG"

echo "==> Build frontend"
cd "${APP_ROOT}/frontend"
sudo -u "${DEPLOY_USER}" env PUBLIC_WP_URL="${PUBLIC_WP_URL}" bash -lc 'npm ci && npm run build'

echo "==> Install Nginx configs"
export PHP_FPM_SOCK
export APP_ROOT FRONTEND_DOMAIN FRONTEND_DOMAIN_WWW WP_DOMAIN
bash "${SCRIPT_DIR}/install-nginx.sh"

echo "==> Enable WP cron"
CRON_LINE="*/5 * * * * php ${APP_ROOT}/wordpress-maxmac/wp-cron.php >/dev/null 2>&1"
sudo -u "${DEPLOY_USER}" bash -lc "(crontab -l 2>/dev/null | grep -v wp-cron.php; echo '${CRON_LINE}') | crontab -"

echo ""
echo "============================================"
echo " Setup done. Finish these in your browser:"
echo "============================================"
echo ""
echo " 1) SSL (if not done yet):"
echo "    sudo certbot --nginx -d ${FRONTEND_DOMAIN} -d ${FRONTEND_DOMAIN_WWW} -d ${WP_DOMAIN}"
echo ""
echo " 2) WordPress install:"
echo "    ${PUBLIC_WP_URL}/wp-admin/install.php"
echo ""
echo " 3) Import trips:"
echo "    cd ${APP_ROOT}"
echo "    node scripts/import-africanmecca.mjs"
echo "    php wordpress-maxmac/scripts/import-africanmecca-trips.php"
echo ""
echo " 4) Open your site:"
echo "    ${FRONTEND_ORIGIN}/packages"
echo ""
