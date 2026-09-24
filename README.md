# Biometrics

A Whoop/Bezel-style biometrics app: wearable data (steps, resting heart rate, sleep, HRV) synced from a connected device into a mobile app, for multiple users.

**Stack:** React Native (Expo) mobile app · Node.js/TypeScript/Express backend · Prisma/Postgres · BullMQ/Redis for sync

## Status

📋 **[Migration status report](https://claude.ai/artifact/FuYPXc1v8PM4WSqJdtn2kY)** — what shipped in the Fitbit → Google Health API migration, the 8 real bugs only live device testing found, and what's left before this is a finished, publicly-launchable product.

The backend integrates with the [Google Health API](https://developers.google.com/health) (`health.googleapis.com/v4`) rather than Fitbit's classic Web API, which Google now describes as superseded for accounts like this project's target device (a Fitbit synced through a Google account).

## Structure

```
backend/   Express API, Prisma schema, sync worker, Google Health OAuth/webhook integration
mobile/    React Native (Expo) app — sign-in, connect flow, dashboard
docs/      Design specs and implementation plans (superpowers-driven development)
```

## Setup

See `backend/.env.example` and `mobile/.env.example` for required environment variables. Backend setup requires: Better Auth credentials (`BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`), Google OAuth client IDs (`GOOGLE_IOS_CLIENT_ID`), email sender config (`EMAIL_FROM`, optional `RESEND_API_KEY`), Google Health API credentials, a GCP service account for webhook subscription management, and database/Redis connection strings.

```bash
# Backend (Node 24 is required; run `nvm use`)
cd backend
npm install
npx prisma migrate deploy
npm run build && npm test
# In development, verification and password-reset links are printed in the backend log as `[email] to=…`;
# open them on the simulator with `xcrun simctl openurl booted '<link>'`.

# Mobile
cd mobile
npm install
npm test
# Running the app needs a development build (Skia is a native dependency, so Expo Go is not supported):
npx expo run:ios   # or: npx expo run:android
```

## Known limitations

See the [status report](https://claude.ai/artifact/FuYPXc1v8PM4WSqJdtn2kY) for full detail. In short: live webhook delivery hasn't been observed yet (the backfill path is fully proven), the mobile app doesn't currently run on very new iOS SDKs (a scene-lifecycle incompatibility, unrelated to the API integration), and public launch requires passing Google's CASA security review for Restricted OAuth scopes.
