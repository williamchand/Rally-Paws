# Development notes

## Working rules

- Keep domain rules independent of web frameworks, databases, and model providers.
- Put external integrations behind application ports and infrastructure adapters.
- Validate model tool arguments as untrusted input. The model may prepare drafts; only an explicit user confirmation followed by server validation can save an activity.
- Preserve source labels for measured, user-entered, sensor-derived, and AI-estimated values. Never describe an estimate as a measurement.
- Keep secrets on the server. Avoid logging chat content or images.

The backend dependency direction is `API / infrastructure → application → domain`. `bootstrap.py` is the composition root. The web app is a React + Vite + TypeScript PWA; native Android and Health Connect support are future work, not part of this web starter.

## Current feature boundary

The repository includes a chat-first web app and FastAPI coach, skippable first-run onboarding, activity drafts and confirmation, estimate cards, schedules, streak-aware XP, local history, pet care, weekly quests, matchup invite links, demo venue booking, and a Plus paywall. There are no accounts: no sign-in provider, no server database. The backend calls at most two external services: the Muse Spark model API, and RevenueCat for Plus entitlement checks when `REVENUECAT_SECRET_KEY` is set (otherwise the app runs its labelled demo billing flow). Health Connect/watch sync, real venue search, and in-app subscription purchases are not implemented. Calendar events are imported from an `.ics` file; they are not read from a connected calendar provider.

Check the implementation before treating this summary as current. The product specification contains planned features as well as shipped behavior.

## Deployment

The repository-root [`deployment.md`](../deployment.md) is the operational guide. In brief:

1. Test the backend and web app locally with their documented environment settings.
2. Deploy via the repo-root `render.yaml` Blueprint (single Docker service; the backend serves the built web app same-origin) and keep `MODEL_API_KEY` and `CONFIRM_SECRET` in the hosting provider's secret store.
3. For a split deployment instead, host the web app behind HTTPS and proxy `/api` and `/health` to the backend. For a container deployment, use the `rally-web/` Dockerfile and set `BACKEND_URL` at runtime.
4. Verify the public URL and rehearse the full flow on a phone before presenting.

The demo guide documents provider-specific commands, safety limits, troubleshooting, and features that have not been verified against live services. Follow it rather than copying old instructions from earlier archive versions.

## Privacy review

The privacy policy is a draft, not a final legal statement. The web app stores preferences and history in browser storage; the server keeps no activity data. A chat request may include a photo selected by the user and calendar details the user chose to share. Those request contents pass through the Rally backend to the configured model provider. Validate hosting logs, provider retention, deletion behavior, and all policy statements before publishing.
