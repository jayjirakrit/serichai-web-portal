# Tasks: Containerized Deployment with Single Entry Point

**Input**: Design documents from `/specs/005-docker-deployment/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: Not requested in spec.md. Validation is manual, via `quickstart.md`'s scenarios (referenced as tasks below) rather than an automated test suite.

**Organization**: Tasks are grouped by user story (spec.md priorities P1/P2/P3) to enable independent validation of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: Maps task to spec.md's US1/US2/US3
- File paths are relative to the repository root

---

## Phase 1: Setup

- [X] T001 [P] Add `.dockerignore` at the repo root, `backend/.dockerignore`, and `frontend/.dockerignore`, excluding `backend/data/`, `node_modules/`, `.venv/`, `.git/` (research.md #5)
- [X] T002 [P] Create root `.env.example` documenting `PORT=8080`, `HOST_DATA_DIR=./backend/data`, `CORS_ORIGINS=http://localhost:5173` (data-model.md env var table)

**Checkpoint**: Repo has build-context hygiene and a documented env-var contract before any Dockerfile is written.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Config-read changes and Dockerfiles shared by every user story below. No story can be validated until this phase is done.

- [X] T003 [P] Read `CORS_ORIGINS` (comma-separated) from the environment in `backend/main.py`, defaulting to `http://localhost:5173` when unset (research.md #4)
- [X] T004 [P] Read `DATA_DIR` from the environment in `backend/services/accounts_service.py` and `backend/services/bonus_service.py` in place of the hardcoded `Path(__file__).resolve().parent.parent / "data"`, defaulting to that same relative path when unset (research.md #5)
- [X] T005 [P] Create `frontend/src/services/apiConfig.ts` exporting `API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ""`; update `frontend/src/services/benefitsService.ts`, `bonusService.ts`, and `payrollReconcileService.ts` to import it instead of each declaring their own `http://127.0.0.1:8000` constant; add `frontend/.env.development` with `VITE_API_BASE_URL=http://127.0.0.1:8000` so `npm run dev` keeps working (research.md #3)
- [X] T006 [P] Create `backend/Dockerfile` (`python:3.13-slim`, `pip install -r requirements.txt`, copy source excluding `data/`, run `uvicorn main:app --host 0.0.0.0 --port 8000`)

**Checkpoint**: Backend and frontend config are environment-driven; backend has a buildable image. User story work can begin.

---

## Phase 3: User Story 1 - Start the whole application with one command (Priority: P1) 🎯 MVP

**Goal**: `docker compose up` brings up both frontend and backend together, no other manual step.

**Independent Test**: From a fresh clone, run the single startup command and confirm both containers report healthy/running.

- [X] T007 [US1] Create `frontend/Dockerfile` (multi-stage: `node:20-alpine` runs `npm ci && npm run build`, then `nginx:alpine` serves the output) and `frontend/nginx.conf` (SPA fallback `try_files $uri /index.html`, plus `location /accounts/ { proxy_pass http://backend:8000; }`) (research.md #1, #2)
- [X] T008 [US1] Create root `docker-compose.yml`: `backend` service (build `backend/Dockerfile`, env `DATA_DIR=/app/data` + `CORS_ORIGINS`, read-only bind mount `${HOST_DATA_DIR:-./backend/data}:/app/data`, healthcheck `curl -f http://localhost:8000/docs`) and `gateway` service (build `frontend/Dockerfile`, `depends_on: backend: condition: service_healthy`, publish `${PORT:-8080}:80`) (research.md #7, #9; data-model.md network topology)
- [X] T009 [US1] Run `quickstart.md` Scenarios 1–2: verify `docker compose up` starts both containers with no extra manual step, and `docker compose down && docker compose up` returns to a working state

**Checkpoint**: User Story 1 is independently functional — the app starts with one command.

---

## Phase 4: User Story 2 - Access the whole portal through one address (Priority: P2)

**Goal**: Every page and backend-dependent action works through the single published address, with no separate backend address ever used.

**Independent Test**: Open only the published address in a browser, complete an employee-benefits calculation, and confirm (via devtools network tab) every request stays on that one origin.

- [X] T010 [US2] Run `quickstart.md` Scenario 3: confirm the UI and all pages load, then complete an employee-benefits calculation using only `http://localhost:${PORT:-8080}`, checking the network tab shows no `127.0.0.1:8000`/other backend address

**Checkpoint**: User Stories 1 and 2 both work independently — the gateway built in Phase 3 already satisfies the single-entry-point routing (research.md #1); this phase validates it end-to-end.

---

## Phase 5: User Story 3 - Consistent environment for new contributors (Priority: P3)

**Goal**: A contributor with only Docker (and a devcontainer-compatible editor) gets a working dev environment with both toolchains, no host install.

**Independent Test**: Open the repo as a devcontainer on a Docker-only machine and run the existing `npm run dev` / `uvicorn main:app --reload` commands from `CLAUDE.md`.

- [X] T011 [US3] Create `.devcontainer/Dockerfile` (Node 20 + Python 3.13 in one image) and `.devcontainer/devcontainer.json` (`forwardPorts: [5173, 8000]`, `postCreateCommand` running `npm install` in `frontend/` and `pip install -r requirements.txt` in `backend/`) (research.md #6)
- [X] T012 [US3] Run `quickstart.md` Scenario 6: confirm both toolchains work inside the devcontainer with nothing installed on the host (partial — see Notes)

**Checkpoint**: All three user stories are independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T013 Run `quickstart.md` Scenarios 4–5: confirm a host-side template edit (`backend/data/Employee_Benefit_Template.xlsx`) is reflected without a rebuild (FR-008), and that changing `.env`'s `PORT` changes the published port with no source edit (FR-007)
- [X] T014 [P] Document the `docker compose up` and devcontainer workflows in `CLAUDE.md`'s Commands section, alongside the existing `npm run dev` / `uvicorn` instructions

---

## Dependencies & Execution Order

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Phase 1. Blocks every user story.
- **User Story 1 (Phase 3)**: Depends on Phase 2 (needs `backend/Dockerfile` from T006 and `apiConfig.ts` from T005, since the frontend image build in T007 bundles it). T008 depends on T006 and T007.
- **User Story 2 (Phase 4)**: Depends on Phase 3 (T008's gateway must exist) — validates routing already built, adds no new files.
- **User Story 3 (Phase 5)**: Depends only on Phase 1/2 (independent of Phases 3–4, per spec.md's "Independent Test" for this story); listed after them here only because it's P3.
- **Polish (Phase 6)**: T013 depends on Phase 3 (needs the running stack); T014 has no code dependency.

### Parallel Opportunities

- T001, T002 (Phase 1) in parallel.
- T003, T004, T005, T006 (Phase 2) in parallel — four different files, no cross-dependency.
- T011 (Phase 5) can start any time after Phase 2, in parallel with Phases 3–4 if staffed separately.

---

## Implementation Strategy

**MVP first**: Phases 1 → 2 → 3 (T001–T009) delivers User Story 1 — a working `docker compose up`. Stop and validate there before continuing.

**Incremental delivery**: Add Phase 4 (routing validation, no new build) → Phase 5 (devcontainer, independent) → Phase 6 (remaining edge-case validation + docs).

## Validation Notes (T009/T010/T012/T013)

Ran with a live Docker (Rancher Desktop) engine:

- **T009**: `docker compose up --build -d` built both images and started `backend` (reported `healthy`) then `gateway` with no other manual step. `docker compose down && docker compose up -d` returned `GET /` to 200 with no reconfiguration.
- **T010**: `GET http://localhost:8080/` → 200 (SPA). `POST http://localhost:8080/accounts/employee-benefits` with `backend/data/Employee_Master_Data.xlsx` → 200 with a computed summary — proves the UI's origin and the backend-dependent action both work through the single published port (8080), never `127.0.0.1:8000`.
- **T013**: `md5sum` of `backend/data/Employee_Benefit_Template.xlsx` on the host matched the file read inside the `backend` container at `/app/data/...` (`docker inspect` confirms a read-only bind mount from the host path) — confirms FR-008 without a rebuild. Editing `.env`'s `PORT` from 8080 to 9090 and re-running `docker compose up -d` moved the published port accordingly (9090 reachable, 8080 not) with zero source changes — confirms FR-007.
- **T012**: `docker build -f .devcontainer/Dockerfile .devcontainer` succeeded and `node --version` inside the built image reported v20.20.2 — confirms the Node 20 base layer is sound. The Python 3.13 layer (a `ghcr.io/devcontainers/features/python:1` devcontainer Feature) and the full `postCreateCommand` flow are applied by the devcontainer CLI/spec, not by a plain `docker build`, and no devcontainer-compatible editor was available in this environment to open the folder end-to-end — that half of this task is unverified and worth a manual check the next time someone opens this repo in such an editor.

All test containers/images from this validation pass were torn down (`docker compose down`; the standalone devcontainer test image removed via `docker rmi`) and the scratch `.env` used for the port test was deleted — nothing left running or added to git beyond the feature's own files.
