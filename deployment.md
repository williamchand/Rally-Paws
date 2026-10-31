# Rally deployment & demo guide

Operational guide for the web starter (React PWA + FastAPI coach). The product
spec is [`docs/Rally-PRD.md`](docs/Rally-PRD.md); the privacy draft is
[`docs/PRIVACY_POLICY.md`](docs/PRIVACY_POLICY.md) (placeholders + legal review
required before any public launch).

## 1. Run locally

Requirements: Python 3.12+, Node.js 22+, npm.

```sh
# Terminal 1 — backend
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate | macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # then set MODEL_API_KEY and CONFIRM_SECRET
pytest                 # backend tests
uvicorn main:app --reload --port 8000
```

```sh
# Terminal 2 — web app
cd rally-web
npm ci
npm run dev   # http://localhost:5173, /api proxied to :8000
```

Set `COACH_API_BASE` when the backend runs elsewhere (e.g.
`COACH_API_BASE=http://192.168.1.10:8000 npm run dev`). Never put provider keys
in the web app or commit them.

## 2. Environment variables

Backend (`backend/.env`, or the host's secret store):

| Variable | Required | Purpose |
|---|---|---|
| `MODEL_API_KEY` | for chat | Meta Model API key. Without it, `/api/chat` answers 503; drafts, estimates, schedules still work |
| `MODEL_BASE_URL` | no | Default `https://api.meta.ai/v1` |
| `MODEL_ID` | no | Default `muse-spark-1.3` |
| `CONFIRM_SECRET` | yes | Long random string signing activity-confirmation tokens |
| `CHAT_RATE_PER_MIN` | no | Per-IP chat+billing budget (default `20`). Raise for demo day when judges share one WiFi egress (Blueprint sets `120`) |
| `CORS_EXTRA_ORIGINS` | for split deploys | Comma-separated extra allowed origins (not needed for the same-origin Blueprint) |
| `REVENUECAT_SECRET_KEY` | no | RevenueCat secret key: enables real Plus entitlement checks. Without it, the app runs its clearly-labelled demo billing flow |
| `REVENUECAT_ENTITLEMENT` | no | Entitlement id to check (default `plus`) |
| `REVENUECAT_BASE_URL` | no | Default `https://api.revenuecat.com` |

Web app build: `VITE_COACH_API_BASE` (absolute backend URL, same-origin by
default). Container runtime: `BACKEND_URL` (see `rally-web/Dockerfile`).

## 3. Deploy paths (demo)

### Option A — Render Blueprint (recommended)

One Docker web service: the image builds the React PWA and the FastAPI
backend serves it same-origin, so no CORS or cross-service wiring is needed.
The repo-root `render.yaml` defines it; `Dockerfile` builds it.

1. Push this repo to GitHub/GitLab and connect it in the Render Dashboard.
2. **New → Blueprint**, select the repo. Render reads `render.yaml` and
   creates the `rally` web service (free plan).
3. When prompted, paste `MODEL_API_KEY` (Meta Model API key). Without it,
   `/api/chat` answers 503 but drafts, estimates, and schedules still work.
   `CONFIRM_SECRET` is auto-generated.
4. Deploy, then open the public URL (`https://rally-xxxx.onrender.com`).
   Verify `/health` and run the demo script (§4) on a phone.

Notes:

- Rally has no accounts and the server keeps no activity data: history, XP,
  and preferences live in the browser. The free tier's ephemeral disk is
  therefore a non-issue, and no disk or database is needed.
- The Docker build runs the backend test suite (`pytest`); a failing test
  fails the deploy.
- Free services sleep when idle; the first request after sleep takes ~1 minute.
- Every push to the connected branch redeploys automatically.

### Option B — Render manual split (backend + web separately)

- **Backend:** Web Service, root `backend/`, build `pip install -r requirements.txt`,
  start `uvicorn main:app --host 0.0.0.0 --port $PORT`. Set `MODEL_API_KEY` and
  `CONFIRM_SECRET` in the secret store.
- **Web:** Static Site from `rally-web/` (`npm ci && npm run build`, publish
  `dist/`) with `VITE_COACH_API_BASE` set to the backend's public URL at build
  time, plus the web origin in the backend's `CORS_EXTRA_ORIGINS`. Or deploy
  `rally-web/Dockerfile` as a Web Service with `BACKEND_URL` pointing at the
  backend service. Serve behind HTTPS.
- Verify: open the public URL, check `/health`, run the demo script (§4) on a phone.

### Option C — Baseten

- Deploy the FastAPI app from `backend/` as a Baseten service with autoscaling
  min 1 for the demo; put `MODEL_API_KEY` and `CONFIRM_SECRET` in Baseten
  secrets. Serve the `rally-web` static build behind HTTPS with `/api` and
  `/health` proxied to the service URL. Follow the current Baseten docs for
  exact deploy commands; this guide pins only the env contract in §2.

## 4. Demo script (5 minutes, on a phone)

Shortcut: open the URL with `?demo=seed`, or tap **Explore with demo data**
on the welcome card, for a rich preloaded state (streak, pet, plan, invite).
Otherwise start empty:

1. Open the public URL → complete or skip the welcome card → Today shows the
   greeting, coach chat, and the sticky quick-action row above the composer.
2. Tap **Plan my week** → with a key the coach drafts a plan and opens it;
   without one the plan form opens → **Draft plan** → save it on the card
   (deterministic, no key needed).
3. Open **Explore** → tap a sport tile → instant prefilled draft opens →
   tap **Confirm and log** → session-saved receipt with XP, streak, and
   honest estimate labels → **Share result card** → **Done** → **Close**.
4. Open **You** → **Open pet & activity** → pet meters (driven by your
   activity), streak, pace trend, personal bests with provenance labels,
   history, saved plans, and calendar import (sample `.ics` below).
5. In the pet view → **See rewards & quests** → claim a quest → check the
   closet (Top hat unlocks at 100 XP).
6. Open **Friends** → **New matchup** → create an invite → **Copy** the link →
   open it in another browser tab to see the shared card.
7. Open **Explore** → search venues (demo data) → open a club → pick a
   day/time → **Book court** (simulated, labelled). Or tap the **Book a
   court** chip → coach finds clubs → jumps to the club detail.
8. Open **Food** → AI meal picks stream in (key set) with **Cook this**
   recipe details, or search recipes directly (always works, free API).
9. Open **You** → **See Plus** → pick Annual/Monthly → **Continue** →
   confirm the labelled demo purchase → welcome screen. Without a
   `REVENUECAT_SECRET_KEY`, Plus stays demo-only; with one, **Restore
   purchases** verifies the real entitlement.
10. If the coach answers: chat is live (`MODEL_API_KEY` set). If it replies
    that the coach isn't connected: drafts/estimates/schedules still demo
    fully via the chips' fallbacks.

Sample `.ics` for step 4 (save as `demo.ics`, import in the pet view):

```ics
BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
SUMMARY:Tennis with Sam
DTSTART:20261031T12:00:00
DTEND:20261031T13:00:00
LOCATION:Riverside courts
END:VEVENT
END:VCALENDAR
```

## 5. Safety limits & troubleshooting

- Chat is rate-limited per IP (20/min); drafts/estimates are deterministic and
  unlimited. Model failures return `model_error` (502); nothing is saved.
- Confirmation tokens expire after 30 minutes; editing a draft after review
  requires re-review (the app re-drafts automatically).
- Logs record tool names, latency, and model id only — never message text.
- CORS (split deploys only): add the public web origin to `CORS_EXTRA_ORIGINS`.
- Billing status is rate-limited per IP like chat. Demo Plus is device-only
  and clearly labelled; it never charges and never implies a real subscription.
- After a redeploy, a stale cached page can request old hashed assets: the
  server answers those with 404 (never the app shell), and `index.html` is
  served `no-store`, so a plain refresh heals it. `/health` reports
  `frontend: embedded` when the web build is actually being served.

## 6. Known unverified areas (this build)

- Backend tests run in the Docker build, but were **not executed in this
  environment** (no Python here). A green Render build is the current proof.
- Live Meta Model API round-trip, tool loop, and image input: implemented
  against the documented chat-completions shape; not exercised with a real key.
- Live RevenueCat verification: implemented against the documented subscriber
  API; not exercised with a real secret key or real purchases.
- Venues are sample demo data with simulated booking; Health Connect/watch
  sync is native-app future work; browser GPS accuracy varies by device.
- Privacy policy is a draft: replace `[bracketed]` placeholders, confirm
  provider retention, and complete legal review before public launch.
