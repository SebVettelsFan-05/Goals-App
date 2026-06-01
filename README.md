# Momentum

A low-friction life scheduler + habit tracker. **React + Vite**, installable as a PWA, works
**offline**. No accounts, no backend — your data lives in `localStorage` on your device.

It does three things with as few taps as possible:

1. **Tells you what to do right now** — the home screen always answers "what should I be doing?"
2. **One-line add** — type `Gym 7pm` or `Call mom 14:30` and it's scheduled.
3. **Small habits** — one tap to check off, streaks (🔥) to keep you honest, reminders so you don't forget.

## Run locally

```bash
npm install
npm run dev          # http://localhost:5173  (offline/SW enabled in dev too)
```

Production build + local preview:

```bash
npm run build        # outputs to dist/
npm run preview
```

## Deploy to Vercel (the quick way you wanted)

The repo is a standard Vite app, which Vercel auto-detects — no config needed.

**Option A — dashboard:** push this repo to GitHub, then on vercel.com → *Add New → Project* →
import the repo → Deploy. (Framework: *Vite*, Build: `npm run build`, Output: `dist` — all auto-filled.)

**Option B — CLI:**

```bash
npm i -g vercel
vercel               # first run links/creates the project
vercel --prod        # ship it
```

Once it's live over HTTPS, open the URL on your phone and **Add to Home Screen**
(iPhone: Safari Share menu · Android: Chrome menu → Install). Tap **Enable** for notifications.

## Offline

`vite-plugin-pwa` generates the service worker and precaches the app shell, so it loads and works
with no connection. Updates activate automatically on the next load (`registerType: 'autoUpdate'`).

## Background notifications (Web Push)

Reminders fire **even when the app is fully closed** via Web Push. This needs a small backend,
which is included as Vercel serverless functions (`api/`). It's optional — without it the app
still works and falls back to in-app reminders.

**What's included:** `public/push-sw.js` (receives pushes), `api/subscribe.js` (stores a device's
subscription + reminder schedule), `api/tick.js` (cron endpoint that sends due reminders, with a
15-minute grace window), and a daily Vercel cron in `vercel.json`.

**To turn it on, set these env vars in Vercel → Project → Settings → Environment Variables:**

| Var | Value |
|---|---|
| `VAPID_PUBLIC_KEY` | the public key (same one in `.env`) |
| `VAPID_PRIVATE_KEY` | the private key from `npx web-push generate-vapid-keys` |
| `VAPID_SUBJECT` | `mailto:you@example.com` |
| `CRON_SECRET` | any random string (protects `/api/tick`) |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | from a Vercel KV store (Storage tab → Create → KV) |

Then **re-deploy**. On your phone, install to the home screen and tap **Enable** — iOS requires the
PWA be installed (iOS 16.4+) for push to work.

**Timing precision:** Vercel's free (Hobby) cron runs only **once a day**, so the built-in cron
alone won't give minute-accurate reminders. For real-time nudges, point a free external cron
(e.g. cron-job.org, every 1 min) at:

```
https://YOUR-APP.vercel.app/api/tick?key=YOUR_CRON_SECRET
```

(Or upgrade to Vercel Pro and change `vercel.json`'s schedule to `* * * * *`.) The endpoint is
idempotent — it never sends the same reminder twice in a day.

## Quick-add syntax

| You type | You get |
|---|---|
| `Gym 7pm` | "Gym" at 7:00pm today |
| `Call mom 14:30` | "Call mom" at 2:30pm |
| `lunch noon` | "lunch" at 12:00pm |
| `Standup 9:30am` | "Standup" at 9:30am |
| `Read` | a task with no set time |

Tap an event to mark it done · right-click (long-press) in **Today** to delete · tap a habit chip to check it off.

## Project layout

```
index.html          Vite entry
vite.config.js      Vite + PWA (offline) config
src/
  main.jsx          mounts React, registers the service worker
  App.jsx           UI: Now / Today / Habits / Weight views, weekly check-in, modals
  store.js          useMomentum hook — state, localStorage, push subscribe/sync
  utils.js          time helpers, quick-add parser, weight trend + weekly stats (pure)
  styles.css        styling (auto light/dark)
public/
  icon.svg          app icon
  push-sw.js        push + notification-tap handlers (imported by the SW)
api/
  subscribe.js      store a device's push subscription + reminder schedule
  tick.js           cron endpoint — sends due reminders (15-min grace window)
lib/kv.js           tiny Upstash/Vercel-KV REST helper (no SDK)
vercel.json         Vercel cron config
```
