# PrayNow Mobile (Expo / React Native)

Run on your **phone with Expo Go** — no Android emulator needed.

**Expo SDK 54** — matches Expo Go 54.x on the Play Store / App Store.

## Prerequisites

- Node.js 18+
- [Expo Go](https://expo.dev/go) **SDK 54** on your Android or iPhone
- PrayNow API: `npm run server:dev` from repo root (port **5000**)

## Quick start

**Terminal 1 — API** (from `mobile/` or repo root):
```bash
npm run server:dev
```

**Terminal 2 — Mobile:**
```bash
cd mobile
npm install
npm start
```

If Expo fails with `fetch failed` or SSL errors (corporate network), set env vars **before** `npm start` (do not use `--offline` with `--lan`):

```powershell
$env:EXPO_OFFLINE="1"
$env:EXPO_NO_DEPENDENCY_VALIDATION="1"
npm start
```

Scan the **QR code** with Expo Go (Android) or Camera app (iOS).

## Preview APK (demo anywhere — no Play Store)

1. Deploy the API (see [`../DEPLOY.md`](../DEPLOY.md)).
2. Edit `eas.json` → replace `https://YOUR_API_HOST` with your live API URL.
3. Build:

```bash
cd mobile
npx eas-cli login
npm run eas:preview
```

Share the install link with mosque admins. Production AAB for Play Store: `npm run eas:production`.

**Important:** Metro must show your PC's LAN IP, e.g. `exp://192.168.1.7:8081` — **not** `exp://127.0.0.1`. `npm start` prints the correct URL at the top.

If the QR code still shows `127.0.0.1`, open **Expo Go → Enter URL manually** and type:
```
exp://192.168.1.7:8081
```

Replace `192.168.1.7` with your IPv4 from `ipconfig`. Phone and PC must be on the **same Wi-Fi**. Disconnect VPN on your PC if connection fails.

If LAN still fails, try tunnel mode (needs internet):
```bash
npm run start:tunnel
```

## API URL for physical phone

Phone and PC must be on the **same Wi-Fi**. Create `mobile/.env`:

```env
EXPO_PUBLIC_API_URL=http://YOUR_PC_IP:5000
```

Find your IP: `ipconfig` → IPv4 Address.

Restart Expo after changing `.env`.

## Live Azan (Agora)

Real-time azan uses Agora RTC. Keys live in `server/.env` only (`AGORA_APP_ID`, `AGORA_APP_CERTIFICATE`).

| Platform | Broadcast mic | Listen |
|----------|---------------|--------|
| **Web admin** | Yes (browser) | Live Azan page |
| **Expo Go** | LIVE badge only | Not supported |
| **Dev / EAS build** | Yes (`react-native-agora`) | Yes |

Build a dev APK with native Agora (required for mobile mic/audio):

```bash
cd mobile
npm run eas:development
```

Preview APK for mosque admins: `npm run eas:preview`.

## Scripts

| Command | Purpose |
|---------|---------|
| `npm start` | Expo dev server + QR code |
| `npm run android` | Open on Android (device/emulator) |
| `npm run ios` | Open on iOS (Mac only) |

## Features (v1)

- Home — prayer times + nearby mosques
- Mosques — sort, radius filter, maps link
- Mosque detail — timings, Google Maps
- Qibla — placeholder compass
- More — upcoming features
- GPS location via expo-location
- API with offline mock fallback

## Project structure

```
mobile/
├── app/                 Expo Router screens
├── src/
│   ├── components/
│   ├── hooks/
│   ├── services/
│   ├── utils/
│   └── data/
└── app.json
```
