# Quickstart: Validating Containerized Deployment

## Prerequisites

- Docker + Docker Compose installed. No local Node.js or Python required (SC-004).
- A fresh clone of the repository (SC-001 measures from this state).

## Scenario 1 — Single command brings up the whole app (User Story 1, AC1)

1. From the repo root: `docker compose up`.
2. Confirm both the `backend` and `gateway` containers report healthy/running with no
   manual step beyond this one command (FR-001, SC-001 — target under 10 minutes
   including image build on a fresh clone).

## Scenario 2 — Restart returns to a working state (User Story 1, AC2)

1. With the stack up, `docker compose down`, then `docker compose up` again.
2. Confirm the portal is reachable and functional exactly as before, with no extra
   manual reconfiguration (FR-001 AC2, SC-003).

## Scenario 3 — Single entry point serves UI and backend-dependent features (User Story 2)

1. Open only `http://localhost:${PORT:-8080}` in a browser — never a separate backend
   address.
2. Confirm the portal UI loads and all pages (`/`, employee benefits, payroll
   reconciliation, bonus calculation) are reachable (FR-002).
3. On the Employee Benefits page, upload a sample master file (e.g.
   `backend/data/Employee_Master_Data.xlsx` or `sample-data/master.xlsx` if present)
   and submit. Confirm the calculation completes successfully using only the single
   published address — open browser devtools' network tab and confirm every request
   targets that same origin, never a `127.0.0.1:8000`/other backend address (FR-003,
   SC-002).

## Scenario 4 — Host-mounted data template (FR-008)

1. Confirm `docker-compose.yml`'s bind mount is in effect: edit a cell in the
   host-side `backend/data/Employee_Benefit_Template.xlsx` (or point `HOST_DATA_DIR`
   at a copy with a change), without rebuilding any image.
2. Re-run the Scenario 3 employee-benefits calculation and confirm the output report
   reflects the edited template — proving the file is read from the live host mount,
   not baked into the image.

## Scenario 5 — Config changes without code changes (FR-007)

1. Stop the stack. Edit the root `.env` file's `PORT` to a different value, run
   `docker compose up`, and confirm the portal is now reachable only at the new port
   — no source file touched.
2. (Local dev, non-Docker) Confirm `frontend/.env.development`'s
   `VITE_API_BASE_URL=http://127.0.0.1:8000` is the only thing that changes between
   `npm run dev` (needs an absolute backend URL) and the containerized build (uses a
   relative URL through the gateway) — no service file (`benefitsService.ts` etc.)
   hardcodes a backend address anymore.

## Scenario 6 — Devcontainer onboarding (User Story 3)

1. On a machine with only Docker and a devcontainer-compatible editor installed, open
   the repository as a devcontainer.
2. Confirm the container provides both a working `node`/`npm` and `python`/`pip`
   toolchain (`postCreateCommand` has already run `npm install` / `pip install -r
   requirements.txt`), and that the two existing dev commands from `CLAUDE.md`
   (`npm run dev`, `uvicorn main:app --reload`) work inside it — without installing
   anything on the host (FR-005 for this story's scope, SC-004).

## Out of scope for this quickstart

Load/performance behavior under many concurrent users, and any production hardening
(TLS, auth) — explicitly excluded by FR-009/FR-010.
