# MaxMac Safaris

Headless safari booking platform: **Astro** storefront + **WordPress / WP Travel Engine** backend + **Paystack** payments.

## Project structure

| Directory | Purpose |
|-----------|---------|
| `frontend/` | Astro static site — catalog, cart, checkout, contact |
| `wordpress-maxmac/` | WordPress + WTE + custom mu-plugins (checkout API bridge) |

## Quick start (local dev)

You need **Node ≥ 22.12** and **PHP ≥ 8.0** running two services:

### 1. WordPress backend

```bash
cd wordpress-maxmac
php -S localhost:8000 router.php
```

- Admin: http://localhost:8000/wp-admin/
- REST API: http://localhost:8000/wp-json/

`router.php` is required — without it, `/wp-json/` and permalinks 404 under PHP's built-in server.

### 2. Astro frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

- Site: http://localhost:4321

## Environment variables

### Frontend (`frontend/.env`)

| Variable | Default | Purpose |
|----------|---------|---------|
| `PUBLIC_WP_URL` | `http://localhost:8000` | WordPress API base URL |

### WordPress (`wordpress-maxmac/.env` or server env)

| Variable | Default | Purpose |
|----------|---------|---------|
| `SF_FRONTEND_ORIGIN` | `http://localhost:4321` | CORS origin + post-payment redirect target |

Set `SF_FRONTEND_ORIGIN` in production to your deployed Astro URL (e.g. `https://maxmacsafaris.com`).

## WordPress setup checklist

1. Log in to wp-admin and configure **WP Travel Engine** (currency, pages).
2. Create/verify the **booking-redirect** page is set as the WTE thank-you page.
3. Configure **Paystack** keys: WP Admin → Bookings → Paystack Gateway.
   - Use `sk_test_…` / `pk_test_…` for development.
   - Supported currencies include KES, NGN, GHS, ZAR, USD.
4. Publish trips in WP — live trips override static fallback data by slug.

## API endpoints (custom)

Namespace: `/wp-json/safariflow/v1/`

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/quote` | POST | Server-side price quote |
| `/checkout` | POST | Create booking + Paystack auth URL |
| `/countries` | GET | Valid billing countries |
| `/contact` | POST | Contact form submission |
| `/bookings/{payment_key}` | GET | Booking status for confirmation page |

## Production deployment

### VPS (simple)

See **[deploy/QUICKSTART.md](deploy/QUICKSTART.md)** — 4 commands on the server, then finish WP in the browser.

```bash
cp deploy/env.example deploy/env && nano deploy/env   # set MYSQL_PASSWORD only
cp frontend/.env.example frontend/.env
sudo ./deploy/setup.sh              # once
./deploy/deploy.sh                  # each code update
```

### Frontend (Cloudflare Pages)

1. Build command: `npm run build` (from `frontend/`)
2. Output directory: `dist`
3. Set `PUBLIC_WP_URL` to your production WordPress URL.
4. The `functions/api/geo.js` edge function provides geo-based currency detection.

### WordPress

- Use MySQL/MariaDB in production (SQLite is for local dev only).
- Set `SF_FRONTEND_ORIGIN` to your Astro production URL.
- Update WP **Settings → General** site URL to your production domain.
- Enable real cron (or system cron calling `wp-cron.php`).
- Rotate `wp-config.php` salts before going live.

## Catalog data strategy

The frontend ships static trip data in `frontend/src/data/packages.ts` as a fallback. When WordPress is reachable, live trips are **merged** with static data — WP wins on matching slugs, static-only trips remain available for browsing.

### Importing from AfricanMecca Safaris

To pull safari packages and destination guides from [AfricanMecca Safaris](https://www.africanmeccasafaris.com/):

```bash
# From repo root (takes ~2 min; rate-limited)
node scripts/import-africanmecca.mjs

# Or only specific countries:
node scripts/import-africanmecca.mjs --countries=kenya,tanzania

# From frontend/
npm run import:ams
```

This writes `frontend/src/data/africanmecca-import.json` (~60 safari itineraries + 8 country guides). The Astro app merges this catalog automatically on `/packages` and `/destinations`.

### Import into WordPress Travel Engine (bookable trips)

To create real WTE `trip` posts (like `/trip/experience-the-magical-south-coast-bush-beach-dolphins/`):

```bash
# 1. Fetch catalog JSON (if not done already)
node scripts/import-africanmecca.mjs

# 2. Import into WP Travel Engine
cd wordpress-maxmac
php scripts/import-africanmecca-trips.php --dry-run          # preview
php scripts/import-africanmecca-trips.php                    # all 60 trips
php scripts/import-africanmecca-trips.php --countries=kenya  # one country
php scripts/import-africanmecca-trips.php --limit=5          # test batch
```

Each imported trip gets:
- `trip` post type with slug like `/trip/best-of-kenya-tour/`
- A **Standard** pricing package (Adult per-person price, USD→KES conversion)
- Destination + activity taxonomies
- Overview tab content and excerpt from AfricanMecca
- `_ams_source_url` meta to skip duplicates on re-import

Optional env: `AMS_USD_TO_KES=130` (default) for price conversion.

**Important:** AfricanMecca's content is copyrighted. Only import if you have rights to use it (your own brand, licensed content, or reference migration). Each imported item includes a `sourceUrl` back to the original page.

## Cron (local)

WP cron loopback is disabled in `wp-config.php` for the PHP dev server. Run manually if needed:

```bash
cd wordpress-maxmac && php wp-cron.php
```
