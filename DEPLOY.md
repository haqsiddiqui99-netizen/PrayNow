# PrayNow production go-live

Host a public API + Postgres, deploy the web admin, then ship an Android preview APK so admins and mosque managers can use PrayNow from anywhere in India.

## Architecture

- **Postgres** — durable mosques, calendars, users
- **API** (`server/`) — HTTPS, `DATABASE_URL` not `memory://`
- **Web admin** (Vite) — `VITE_API_URL` → public API
- **Mobile preview APK** — `EXPO_PUBLIC_API_URL` → public API

## Phase 1 — Postgres + API

### Option A: Docker Compose (local or VPS)

```bash
# From repo root
export JWT_SECRET="replace-with-long-random-string"
export CLIENT_ORIGIN="https://your-admin.vercel.app,http://localhost:5173"
docker compose up -d --build
docker compose exec api npm run db:seed
```

Health check: `GET http://localhost:5000/api/health` → `"database":"postgres"`.

### Option B: Render

1. Push this repo to GitHub/GitLab.
2. In Render: **New → Blueprint** → select repo (`render.yaml`).
3. Set secrets: `JWT_SECRET`, `CLIENT_ORIGIN` (your Vercel admin URL).
4. After deploy, open the API URL `/api/health`.
5. Seed once (Render shell or from your PC):

```bash
# From a machine that can reach the DB, or Render shell in server/
npm run db:seed
```

### Option C: Railway

1. New project → **Postgres** plugin.
2. Deploy `server/` as a service; set `DATABASE_URL` from the plugin, plus `PGSCHEMA=praynow`, `JWT_SECRET`, `CLIENT_ORIGIN`, `NODE_ENV=production`.
3. Start command: `npm run start:prod` (migrate + serve). See `server/railway.json`.
4. `npm run db:seed` once.

### Re-import Kanpur data (after seed)

From repo root, pointed at the **live** API:

```bash
# Windows PowerShell
$env:API_URL="https://YOUR_API_HOST"
node server/scripts/import-kanpur-year.mjs 2026
node server/scripts/import-kanpur-aug-dec-2026.mjs
node server/scripts/import-kanpur-mosques.mjs
```

Admin login for imports: `9999999999` / `Admin@12345` (change after go-live).

### Required env (API)

| Variable | Value |
|----------|--------|
| `DATABASE_URL` | `postgresql://...` |
| `PGSCHEMA` | `praynow` |
| `JWT_SECRET` | long random string |
| `NODE_ENV` | `production` |
| `CLIENT_ORIGIN` | comma-separated HTTPS admin origins |
| `HOST` | `0.0.0.0` |

## Phase 2 — Web admin (Vercel)

1. Import the same repo into [Vercel](https://vercel.com).
2. Framework: Vite. Build: `npm run build`. Output: `dist`.
3. Env: `VITE_API_URL=https://YOUR_API_HOST` (no trailing slash).
4. Deploy. Add that URL to API `CLIENT_ORIGIN`.
5. Open the site → Admin Portal → sign in → add/edit mosques from any city.

Local production build check:

```bash
VITE_API_URL=https://YOUR_API_HOST npm run build
npm run preview
```

## Phase 3 — Android preview APK (demos anywhere)

```bash
cd mobile
npm install
npx eas-cli login
npx eas-cli build:configure   # if first time
```

Edit `mobile/eas.json` → set `EXPO_PUBLIC_API_URL` (and optional `EXPO_PUBLIC_ADMIN_URL`) to your live hosts.

```bash
npx eas-cli build --platform android --profile preview
```

Share the install link with mosque admins. Create manager accounts in **App Admin → Mosque Admins**.

## Phase 4 — Play Store (when ready)

1. Google Play Console developer account.
2. Build production AAB:

```bash
cd mobile
npx eas-cli build --platform android --profile production
```

3. Create app listing (name, screenshots, privacy policy URL, content rating).
4. Upload AAB → **Internal testing** → invite emails → then closed → production.
5. Rotate seed passwords; disable or rename demo manager; enable DB backups on the host.

iOS / TestFlight is optional later (Apple Developer Program required).

## Ops checklist

- [ ] `/api/health` returns `database: postgres`, `production: true`
- [ ] Admin web works over HTTPS from mobile data (not only Wi‑Fi)
- [ ] Preview APK logs in and lists Kanpur mosques
- [ ] New mosque with city `Lucknow` (or any) appears under `/api/cities` without an app rebuild
- [ ] Mosque manager assigned and can edit timings
- [ ] Kanpur year calendar loaded (`city_prayer_days`)
- [ ] JWT_SECRET and admin password changed from defaults
- [ ] Postgres backups enabled

## India-wide admin notes

- Set **City** on each mosque (web form). Lat/lng via paste Google Maps link or coords.
- Users discover cities from `GET /api/cities` (derived from active mosques + catalog aliases).
- For a new city’s Home schedule: Admin → City tab → generate year or import CSV for that city/lat/lng.
