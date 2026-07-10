# VPS quickstart (simple version)

You are hosting **2 things**:

1. **Website** → `maxmacsafaris.com` (Astro)
2. **Booking backend** → `wp.maxmacsafaris.com` (WordPress)

---

## Before you start

You need:

- A VPS (Ubuntu 22/24)
- A domain name
- SSH access to the server

Create these DNS records (in your domain panel):

| Type | Name | Points to |
|------|------|-----------|
| A | `@` | your VPS IP |
| A | `www` | your VPS IP |
| A | `wp` | your VPS IP |

Wait 5–30 minutes for DNS to propagate.

---

## On the server — 4 commands

```bash
# 1) Get the code
git clone <YOUR_REPO_URL> /var/www/maxmac
cd /var/www/maxmac

# 2) Set your domain names
cp deploy/env.example deploy/env
nano deploy/env

# 3) First-time setup (installs nginx/php/mysql tools, builds site, nginx configs)
sudo ./deploy/setup.sh

# 4) Free HTTPS certificates
sudo certbot --nginx -d maxmacsafaris.com -d www.maxmacsafaris.com -d wp.maxmacsafaris.com
```

Replace domain names in the certbot command if yours are different.

---

## Finish in the browser (one time)

`setup.sh` already configures `wp-config.php` (MySQL + frontend URL). You only need:

1. Open **https://wp.maxmacsafaris.com/wp-admin/install.php**  
   Create your WordPress admin account.

2. In WP Admin:
   - **Settings → Permalinks** → choose **Post name** → Save
   - **WP Travel Engine** → set currency + Paystack keys

3. Back on the server, import trips:

```bash
cd /var/www/maxmac
node scripts/import-africanmecca.mjs
php wordpress-maxmac/scripts/import-africanmecca-trips.php
```

4. Open **https://maxmacsafaris.com/packages** — trips should appear.

---

## When you change code later

```bash
cd /var/www/maxmac
./deploy/deploy.sh
```

That’s it.

---

## If something breaks

```bash
# WordPress API working?
curl https://wp.maxmacsafaris.com/wp-json/wptravelengine/v2/trips?per_page=1

# Frontend built?
ls frontend/dist/index.html

# Nginx ok?
sudo nginx -t
```

---

## Optional: auto currency by country

In Cloudflare (free), add your domain and turn proxy **ON** (orange cloud) for `@`, `www`, and `wp`.

This enables `/api/geo` for visitor currency detection.

Without Cloudflare, the site still works — it guesses currency from browser language.
