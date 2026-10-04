# Quickstart: Validating the System Info "About" Page

## Prerequisites

Backend and frontend running per `CLAUDE.md` (`uvicorn main:app --reload` in `backend/`,
`npm start` in `frontend-ng/`). Optionally set `APP_VERSION=1.2.3` before starting uvicorn.

## Scenario 1 — API (FR-001..FR-003)

1. `curl http://127.0.0.1:8000/system/info` → 200 with exactly `appName`, `appVersion`,
   `serverTime`, `status` (`contracts/system-api.md`).
2. `status` is `"ok"`; `serverTime` ends in a `±HH:MM` offset; `appVersion` equals
   `APP_VERSION` if set, else `"dev"`.
3. `curl http://localhost:4200/system/info` → same body (dev proxy forwards `/system`).

## Scenario 2 — About page (US1, FR-004/FR-005)

1. Open `http://localhost:4200`, click **About** in the navbar → `/about` shows one card with
   the four labelled values.
2. Reload `/about` directly → same content.
3. Navbar **About** link is present on every page (Home, Employee Benefits, ...).

## Scenario 3 — Loading and error (US2, FR-006)

1. DevTools → Network → throttle "Slow 3G", reload `/about` → spinner, no values.
2. Stop uvicorn, reload `/about` → error alert with readable text, no values, no endless
   spinner (SC-003).
3. Throttle again, open `/about`, navigate to Home before it resolves → nothing appears
   on Home, no error.

## Scenario 4 — Gateways (research #1)

- Docker (post spec 007 cutover): `docker compose up`, `curl http://localhost:8080/system/info`.
- Windows install: re-run `setup.ps1`, `curl http://localhost:8080/system/info`.

## Automated checks

`pytest` in `backend/`; `npm run build`, `npm run lint`, `npm test -- --watch=false` in
`frontend-ng/`.
