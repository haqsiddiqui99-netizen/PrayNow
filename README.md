# PrayNow

Mobile-first mosque finder and prayer times app — React + Vite frontend, Express + PostgreSQL backend.

## Features

- Prayer times, mosque finder, smart navigation, Qibla, AI guide, Hadith, tracker
- **Admin portal** — full mosque & timing management
- **Mosque managers** — update timings for assigned mosques only
- PostgreSQL database with role-based API

## Quick Start (Frontend only — mock data)

```bash
npm install
npm run dev
```

Open http://localhost:5173

## Full Stack (Database + API + Admin)

> **Go live (hosted Postgres + public demos):** see [DEPLOY.md](./DEPLOY.md).

### 1. Install server dependencies

```bash
npm run server:install
```

### 2. Configure database

Copy `server/.env.example` to `server/.env`.

**No PostgreSQL installed?** The default dev config uses an in-memory database — no setup needed:

```env
DATABASE_URL=memory://local
```

**With PostgreSQL**, set your connection URL instead:

```env
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/admin
PGSCHEMA=praynow
JWT_SECRET=your-secret-key
SEED_ADMIN_EMAIL=admin@praynow.com
SEED_ADMIN_PASSWORD=Admin@12345
```
### 3. Create schema & seed data

```bash
npm run db:migrate
npm run db:seed
```

This creates the `praynow` schema, tables, default admin, and imports Delhi mosques.

### 4. Run API + frontend

Terminal 1:

```bash
npm run server:dev
```

Terminal 2:

```bash
npm run dev
```

## Mobile 3-role accounts (no web admin required)

| Role | Who | Mobile entry |
|------|-----|--------------|
| **User** | Anyone | Sign up / Sign in |
| **Mosque admin** | Created by app owner | **More → My Mosques** |
| **App admin** | App owner (one) | **More → App Admin** |

Default seed logins (after `npm run db:seed`):

| Role | Mobile | Password |
|------|--------|----------|
| App admin | `9999999999` | `Admin@12345` |
| Mosque admin (demo) | `8888888888` | `Manager@12345` |

Mosque admins are created only by the app owner in **App Admin → Mosque Admins** (mobile + password + assigned mosques).


## Feeding realistic mosque data

There are **three places** to add mosque names, addresses, prayer timings, and other details:

### 1. Admin portal (best for one-by-one)

1. Run API + web (`npm run server:dev` and `npm run dev`)
2. **More → Admin Portal** → login
3. **Mosques → + Add Mosque** — fill basic details, lat/lng, imam, facilities, prayer timings, Juma, Tahajjud/Sehri → **Save**
4. **City tab** — set city-wide prayer windows (Home screen NOW/NEXT, Zawal, sunrise)

Data is stored in PostgreSQL (or in-memory DB in dev) and appears in the mobile app after pull-to-refresh.

**Where to get real values:** Google Maps (name, address, phone, coordinates), mosque notice board / website (azan & jamat times).

### 2. JSON bulk import (best for many mosques)

1. Copy `server/data/mosques.example.json` → `server/data/mosques.json`
2. Add one object per mosque (see example for all fields)
3. Run:

```bash
npm run db:migrate    # first time only
npm run db:import     # imports server/data/mosques.json
```

Dry run: `npm run db:import -- --dry-run` (from repo root, or `npm run db:import -- --dry-run` in `server/`)

Re-running updates existing mosques matched by `legacy_id` or name+address.

### 3. Seed file (built-in demo set)

`server/src/db/seed.js` contains 10 real Delhi mosques. Run `npm run db:seed` to load or refresh them.

### Offline fallback (mobile without API)

If the API is unreachable, the app uses `mobile/src/data/mockData.ts`. Keep it in sync with your live data only if you need offline demo mode.

## Database schema

| Table | Purpose |
|-------|---------|
| `users` | admin & mosque_manager accounts |
| `mosques` | Mosque details |
| `mosque_timings` | Azan & Namaz per prayer |
| `mosque_night_timings` | Tahajjud & Sehri |
| `mosque_assignments` | Links managers to mosques |
| `mosque_live_azan_sessions` | Live azan broadcast sessions (+ recordings) |
| `city_prayer_schedule` | Home page prayer windows |
| `city_settings` | Zawal, sunrise, location |

## API endpoints

| Method | Path | Access |
|--------|------|--------|
| GET | `/api/mosques` | Public |
| POST | `/api/login` | Public |
| POST | `/api/admin/mosques` | Admin |
| PUT | `/api/admin/mosques/:id` | Admin |
| PUT | `/api/admin/mosques/:id/timings` | Admin |
| POST | `/api/admin/users` | Admin |
| POST | `/api/admin/mosques/:id/assign` | Admin |
| GET | `/api/manager/mosques` | Admin / Manager |
| PUT | `/api/manager/mosques/:id/timings` | Admin / Assigned manager |
| POST | `/api/manager/mosques/:id/azan/start` | Admin / Assigned manager |
| POST | `/api/manager/mosques/:id/azan/stop` | Admin / Assigned manager |
| GET | `/api/live-azan/sessions` | Public |
| GET | `/api/mosques/:id/azan/listen` | Public |

## Live Azan streaming (mosque broadcasting)

Mosque managers broadcast azan **live** from their microphone; users hear it in
real time and see a green **LIVE** badge on that mosque. Powered by [Agora](https://www.agora.io) RTC.

**1. Get Agora keys (free tier).** Create a project at
[console.agora.io](https://console.agora.io) and copy the **App ID**
(and **App Certificate** for secure token auth). Add them to `server/.env`:

```
AGORA_APP_ID=your-app-id
AGORA_APP_CERTIFICATE=your-app-certificate   # optional; omit for testing mode
```

Without keys, sessions still track live state but no audio flows
(`agoraConfigured: false`). With App ID only, the Agora project must be in
"testing" mode (no token required).

**2. Broadcast (web admin).** A mosque manager logs into the admin dashboard,
opens their assigned mosque, and taps **🎙️ Start Azan**. The browser captures
the mic and publishes to the mosque's channel. Tap **⏹ Stop Azan** to end
(manual stop only). Broadcasting works in any modern browser over HTTPS/localhost.

**3. Listen.**
- **Web:** the *Live Azan* page joins live channels and plays them automatically.
- **Mobile:** the mosque card **LIVE** badge reflects real broadcasts (polled every
  20s). Real-time mobile listening requires an [Expo **dev build**](mobile/README.md)
  with `react-native-agora` (Expo Go can't load native audio modules) — this is the
  next step for full mobile live audio.

**4. Recordings.** When a broadcast stops you can attach a `recordingUrl`
(`POST …/azan/stop { recordingUrl }`); it's stored on the session so past azans
can be replayed later.

## Tech Stack

- Frontend (web): React 19, TypeScript, Vite 8
- **Mobile:** Expo / React Native — see [`mobile/README.md`](mobile/README.md)
- Backend: Express, PostgreSQL (`pg`), JWT, bcrypt
- Falls back to `mockData.ts` when API is offline
