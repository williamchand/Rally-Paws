# Rally

Rally is a chat-first activity coach: log sports and workouts, get transparent
calorie estimates, draft weekly plans, and grow a companion pet with earned XP.
This repo contains the React + TypeScript PWA (`rally-web/`) and the FastAPI
backend (`backend/`).

Rally has no accounts and the server keeps no activity data — history, XP, pet,
quests, matches, and preferences live in the browser. The backend calls two
external services at most: the Meta Muse Spark model API (coach replies) and,
when configured, RevenueCat (Plus entitlement checks).

## Deploy to Render

You need: a GitHub/GitLab account, a Render account, and a Meta Model API key
(`MODEL_API_KEY`). Without the key, chat answers "coach not connected" but
drafts, estimates, and schedules still work.

### Path 1 — Blueprint, one service (recommended)

One Docker web service builds the PWA and serves it same-origin from FastAPI.
No CORS or cross-service wiring, one free-tier service.

1. Push this repo to GitHub/GitLab.
2. In the Render Dashboard: **New → Blueprint**, select the repo.
   Render reads [`render.yaml`](render.yaml) and creates the `rally` service.
3. When prompted, paste `MODEL_API_KEY`. (`CONFIRM_SECRET` is auto-generated.)
4. Wait for the build (it runs the frontend build and the backend `pytest`
   suite), then open the public URL, e.g. `https://rally-xxxx.onrender.com`.
5. Verify: `GET /health` returns `{"status": "ok", ...}`, then run the
   5-minute demo script in [`deployment.md`](deployment.md) on a phone.

Every push to the connected branch redeploys automatically. Free services
sleep when idle, so allow ~1 minute for the first request after sleep.

### Path 2 — Backend and frontend as separate Render services

Use this if you want the API and the web app scaled or updated independently.

**Backend — native Python web service**

1. Dashboard: **New → Web Service**, select the repo.
2. Settings: root directory `backend/`, runtime `Python`,
   build command `pip install -r requirements.txt`,
   start command `uvicorn main:app --host 0.0.0.0 --port $PORT`,
   health check path `/health`.
3. Environment variables:
   | Variable | Value |
   |---|---|
   | `MODEL_API_KEY` | your Meta Model API key (secret) |
   | `MODEL_BASE_URL` | `https://api.meta.ai/v1` |
   | `MODEL_ID` | `muse-spark-1.3` |
   | `CONFIRM_SECRET` | generate a long random string (secret) |
   | `CORS_EXTRA_ORIGINS` | the frontend's public URL (step 5 below) |
   | `REVENUECAT_SECRET_KEY` | RevenueCat secret key (optional; enables real Plus checks, otherwise demo billing) |
   | `REVENUECAT_ENTITLEMENT` | `plus` |
4. Deploy and note the backend URL, e.g. `https://rally-api.onrender.com`.

**Frontend — static site**

5. Dashboard: **New → Static Site**, select the same repo.
   Root directory `rally-web/`, build command `npm ci && npm run build`,
   publish directory `dist/`.
6. Environment variable: `VITE_COACH_API_BASE` = the backend URL from step 4
   (baked in at build time — redeploy the site if the backend URL changes).
7. Deploy, copy the site URL, and add it to the backend's
   `CORS_EXTRA_ORIGINS` (backend redeploys automatically on env change).
8. Verify: open the site URL, confirm the coach greeting loads, and run the
   demo script in [`deployment.md`](deployment.md).

Alternatively, deploy `rally-web/Dockerfile` as a Docker web service with
`BACKEND_URL` pointing at the backend — same-origin, so no CORS setup.

## Run locally

```sh
# Terminal 1 — backend (needs MODEL_API_KEY + CONFIRM_SECRET in backend/.env)
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Terminal 2 — web app
cd rally-web
npm ci
npm run dev   # http://localhost:5173, /api proxied to :8000
```

## Docs

- [`deployment.md`](deployment.md) — full deploy guide: env contract, demo
  script, safety limits, troubleshooting, known unverified areas.
- [`demo/`](demo/) — Playwright script that records the demo flow to video
  (local or Render URL, headless or remote browser).
- [`docs/Rally-PRD.md`](docs/Rally-PRD.md) — product vision and requirements
  (includes roadmap items that have not shipped).
- [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md) — architecture and working rules.
- [`docs/PRIVACY_POLICY.md`](docs/PRIVACY_POLICY.md) — privacy draft
  (placeholders + legal review required before any public launch).
