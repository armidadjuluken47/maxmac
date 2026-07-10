# VPS deployment

**Start here:** [QUICKSTART.md](QUICKSTART.md) — short 4-step guide.

This file has extra detail if you need it.

| URL | Role |
|-----|------|
| `https://maxmacsafaris.com` | Astro storefront |
| `https://wp.maxmacsafaris.com` | WordPress + bookings |

---

## One-time server setup (Ubuntu 22.04/24.04)

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y nginx mariadb-server php8.2-fpm php8.2-mysql \
  php8.2-xml php8.2-curl php8.2-mbstring php8.2-zip php8.2-gd php8.2-intl \
  unzip git certbot python3-certbot-nginx

curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
```

### MySQL

```sql
CREATE DATABASE maxmac_wp CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'maxmac'@'localhost' IDENTIFIED BY 'CHANGE_ME';
GRANT ALL PRIVILEGES ON maxmac_wp.* TO 'maxmac'@'localhost';
FLUSH PRIVILEGES;
```

### Clone repo

```bash
sudo mkdir -p /var/www/maxmac
sudo chown -R $USER:$USER /var/www/maxmac
git clone <your-repo-url> /var/www/maxmac
cd /var/www/maxmac
```

### WordPress `wp-config.php`

In `wordpress-maxmac/wp-config.php`:

1. **Remove** SQLite for production (`define('DB_ENGINE', 'sqlite');`)
2. Set MySQL credentials (`DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`)
3. Add:

```php
define('SF_FRONTEND_ORIGIN', 'https://maxmacsafaris.com');
define('DISABLE_WP_CRON', true);
```

Run the installer: `https://wp.maxmacsafaris.com/wp-admin/install.php`

Then in WP Admin:

- **Settings → Permalinks** → Post name
- **WP Travel Engine** → currency (e.g. KES), pages, Paystack keys

### Environment file

```bash
cp deploy/env.example deploy/env
nano deploy/env   # set your domains and paths
chmod +x deploy/deploy.sh deploy/install-nginx.sh
```

### Nginx + SSL

```bash
./deploy/install-nginx.sh
sudo certbot --nginx -d maxmacsafaris.com -d www.maxmacsafaris.com
sudo certbot --nginx -d wp.maxmacsafaris.com
```

### Import catalog into WordPress

```bash
node scripts/import-africanmecca.mjs
cd wordpress-maxmac && php scripts/import-africanmecca-trips.php
```

### WP cron (system cron, not loopback)

```bash
crontab -e
```

Add:

```cron
*/5 * * * * php /var/www/maxmac/wordpress-maxmac/wp-cron.php >/dev/null 2>&1
```

---

## Every deploy

```bash
cd /var/www/maxmac
./deploy/deploy.sh
```

To also refresh the AMS catalog into WP:

```bash
RUN_WP_IMPORT=1 ./deploy/deploy.sh
```

Or set `RUN_WP_IMPORT=1` in `deploy/env`.

---

## Currency geo API on VPS

`deploy/api/geo.php` is served at `GET /api/geo` on the frontend vhost.

- **With Cloudflare proxy** (orange cloud): reads `CF-IPCountry` → accurate currency detection.
- **Without Cloudflare**: returns `null` and the site falls back to browser locale (still works).

Recommended: put Cloudflare in front of the VPS for SSL/CDN + geo headers.

---

## DNS records

| Type | Name | Value |
|------|------|-------|
| A | `@` | VPS IP |
| A | `www` | VPS IP |
| A | `wp` | VPS IP |

---

## Smoke tests

```bash
curl -s https://wp.maxmacsafaris.com/wp-json/wptravelengine/v2/trips?per_page=1
curl -s https://maxmacsafaris.com/api/geo
```

Open `https://maxmacsafaris.com/packages` and confirm trips load.

---

## Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```
