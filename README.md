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

## Notifications (honest version)

Nudges for events and habit reminders fire while the app is **open or installed on the home
screen**. Notifying you when it's been fully closed for hours needs a push server — a deliberate
v2 step, not built yet. Installed-on-home-screen covers daily use well.

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
  App.jsx           UI: Now / Today / Habits views + habit modal
  store.js          useMomentum hook — state, localStorage, notifications
  utils.js          time helpers + quick-add parser (pure, testable)
  styles.css        styling (auto light/dark)
public/icon.svg     app icon
```
