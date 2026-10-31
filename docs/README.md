# Rally documentation

Rally is a React, TypeScript, and Vite progressive web app with a FastAPI backend. This folder keeps the product specification, the practical development guide, the privacy-policy draft, and the investor pitch.

## Start locally

Requirements: Python 3.12+, Node.js 22+, and npm.

1. In `backend/`, install `requirements.txt`, copy `.env.example` to `.env`, and set `MODEL_API_KEY`. For the Meta Model API, the defaults use `MODEL_BASE_URL=https://api.meta.ai/v1` and `MODEL_ID=muse-spark-1.3`.
2. Start the API from `backend/`:

   ```sh
   uvicorn main:app --reload --port 8000
   ```

3. In another terminal, start the web app:

   ```sh
   cd rally-web
   npm ci
   npm run dev
   ```

The Vite development server forwards API requests to `http://localhost:8000` by default. Set `COACH_API_BASE` if the backend runs elsewhere. Never put provider keys in the web app or commit them.

## How the app is organized

- `rally-web/` contains the React PWA and client-side screens, state, and API calls.
- `backend/rally/domain/` contains framework-independent rules and entities.
- `backend/rally/application/` contains use cases and ports.
- `backend/rally/infrastructure/` contains database, model, identity, and other adapters.
- `backend/rally/api/` contains HTTP routes and request/response handling; `backend/rally/bootstrap.py` wires dependencies.

The model can propose actions, but it cannot save an activity directly. Saving follows a draft, user confirmation, and server-side validation flow. Calorie values are estimates, not measurements.

## Deploy and release

Use the repository-root [`README.md`](../README.md) for the Render deploy quickstart and [`deployment.md`](../deployment.md) for the full guide: environment variables, verification steps, demo script, and known unverified areas. It covers Baseten and Render options. Do not use the old Flutter/Android setup notes from previous versions of this archive.

Before a public launch, review the checklist in the deployment guide and complete the placeholders and legal review in [`PRIVACY_POLICY.md`](PRIVACY_POLICY.md).

## Product scope

[`Rally-PRD.md`](Rally-PRD.md) is the product vision and requirements document. It includes future roadmap items; a requirement in the PRD does not mean the feature has shipped. Confirm implementation status against the code and deployment guide before making product claims.

The HTML pitch is a separate presentation artifact. Update its claims when the shipped product changes.
