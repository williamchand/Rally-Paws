# Rally video demo (Playwright)

Records the app on a 390×844 phone viewport: onboarding → plan → three
logged sessions (Explore tiles) → pet+activity → quests → matchup share
link → venue booking → Plus demo purchase. Output is `videos/rally-demo.webm`
plus stills in `shots/`. Everything the script touches is deterministic
(no model key needed).

## Setup (once)

```sh
cd demo
npm install
npx playwright install chromium
```

## Record a local run

```sh
# Terminal 1: backend + web app running (see repo README)
# Terminal 2:
cd demo
npm run demo
# or: DEMO_URL=http://localhost:5173 npm run demo
```

## Record the deployed app

```sh
cd demo
DEMO_URL=https://rally-xxxx.onrender.com npm run demo
```

The script waits up to 2 minutes on first load for free-tier cold starts.

## Options

- `HEADFUL=1 npm run demo` — watch the run in a visible browser.
- `BROWSER_WS=ws://host:port/... npm run demo` — drive an
  already-running Playwright server (`npx playwright run-server`)
  instead of launching Chromium, e.g. a remote browser host.
  Video is still recorded to `demo/videos/`.

## Notes

- Each run uses a fresh browser profile, so onboarding always shows.
- The share-link step opens the invite in a second tab and saves it.
- The Plus step uses the labelled demo purchase (no charge, no store).
- `videos/`, `shots/`, and `node_modules/` are git-ignored.
