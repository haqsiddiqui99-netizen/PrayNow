# PrayNow go-live (Railway)

Two services in one Railway project, plus the Android app. No custom domain is required: Railway gives each public service an `https://….up.railway.app` address.

| Service | Root directory | What it runs |
|---|---|---|
| `praynow-db` | Postgres plugin | Database |
| `praynow-api` | `server` | API. Start command `npm run start:prod` (migrate, then serve). |
| `praynow-web` | repo root | Web app, owner desk, privacy page, and `/api` proxy. Uses the root `Dockerfile`. |

## 1. Database and API

1. New Railway project → add **PostgreSQL**.
2. Add a service from this GitHub repo. Set **Root Directory** to `server`.
3. Variables on the API service:

| Variable | Value |
|---|---|
| `DATABASE_URL` | the Postgres connection URL (Railway variable reference) |
| `PGSCHEMA` | `praynow` |
| `NODE_ENV` | `production` |
| `HOST` | `0.0.0.0` |
| `JWT_SECRET` | a random string of at least 32 characters. The API refuses to start with the dev default. |
| `CLIENT_ORIGIN` | the web service's public `https://` address, no trailing slash |
| `SEED_ADMIN_MOBILE` | your own 10-digit mobile |
| `SEED_ADMIN_PASSWORD` | your own password, not a shared default |
| `SEED_ADMIN_EMAIL` | your email |
| `OPENAI_API_KEY` | for the in-app guide |
| `AGORA_APP_ID`, `AGORA_APP_CERTIFICATE` | for live azan |
| `GOOGLE_PLACES_API_KEY` | only if you import mosques from Places |

Generate a secret locally with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.

4. Generate a public domain for the API only if you want to call it directly. The phone app can instead use the web service address, because that service proxies `/api`.
5. Open `https://YOUR-API/api/health`. You want `"database":"postgres"` and `"production":true`.
6. Seed once, from the `server` folder with the Railway CLI: `railway run npm run db:seed`. Then sign in and change nothing that was left as a sample.
7. Turn on Postgres backups in Railway.

## 2. Web and owner desk

1. Add a second service from the same repo. Leave the root directory as the repo root so it uses the root `Dockerfile`.
2. Variables (available at **build** time):

| Variable | Value |
|---|---|
| `API_UPSTREAM` | private API address, `http://${{praynow-api.RAILWAY_PRIVATE_DOMAIN}}:${{praynow-api.PORT}}`. Use the public API URL if private networking is off. |
| `VITE_API_URL` | leave empty. The site then calls `/api` on its own address, and Caddy forwards it. |
| `VITE_GOOGLE_MAPS_API_KEY` | a browser key, restricted to this site's address. Enable Maps JavaScript API and Geocoding API. |

3. Generate a public domain. Put that exact origin into the API's `CLIENT_ORIGIN` and redeploy the API.
4. Check:
   - `/` loads the site
   - `/portal/` opens the desk and you can sign in
   - `/privacy/` and `/delete-account/` load
   - dropping a pin on the desk map works

## 3. Data

- In the desk, open City and generate the prayer year for each launch city.
- Mosque files in `server/data/` are merged in on API startup.
- Create mosque manager accounts from the desk.

## 4. Android preview

In `mobile/eas.json`, set both profiles:

- `EXPO_PUBLIC_API_URL` = the web service origin (no trailing slash, no `/api`). The app adds `/api` itself.
- `EXPO_PUBLIC_ADMIN_URL` = the same origin, so Privacy in the app opens `/privacy/`.

Upload the FCM service-account key to the Expo project or push notifications will not arrive. `google-services.json` is already in the app.

```bash
cd mobile
npx eas-cli login
npx eas-cli build --platform android --profile preview
```

Install the APK and test over mobile data: sign in, register, delete account, mosques, timings, facilities, reminders, live azan, the widget, and the guide.

A release build with no `EXPO_PUBLIC_API_URL` refuses to guess a server.

## 5. Play Store, when the organization account exists

- Privacy policy URL: `https://YOUR-WEB/privacy/`
- Account deletion is in the app (account menu → Delete account) and on the web at `/delete-account/`.
- `SCHEDULE_EXACT_ALARM` is used so prayer reminders fire on time. Declare that in Play Console.
- Build the store bundle: `npx eas-cli build --platform android --profile production`
- Ship to internal testing, then closed testing, then production.
- The package name `com.praynow.app` cannot be changed after the first upload.

## Checks

- [ ] `/api/health` returns `database: postgres`, `production: true`
- [ ] Desk sign-in works from the public web address
- [ ] A new account can be created and then deleted from the app and from `/delete-account/`
- [ ] Preview APK loads mosques on mobile data
- [ ] `JWT_SECRET` is not the dev default, and the seed admin password is your own
- [ ] Postgres backups are on
