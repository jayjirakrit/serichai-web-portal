# Implementation Plan: Containerized Deployment with Single Entry Point

**Branch**: `005-docker-deployment` | **Date**: 2026-08-31 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-docker-deployment/spec.md`

## Summary

Package the existing frontend (React/Vite SPA) and backend (FastAPI) as two
independently built Docker images, fronted by a third `nginx:alpine` gateway
container that serves the built SPA and reverse-proxies `/accounts/*` to the backend
over a Compose-internal network — giving the whole portal one published host:port
(`docker-compose.yml`, `frontend/Dockerfile`, `backend/Dockerfile`). Because the
gateway makes API calls same-origin, the frontend's per-service hardcoded
`http://127.0.0.1:8000` base URL collapses to a relative path in the container build,
resolved through one shared `apiConfig.ts` instead of three duplicated constants; the
backend's CORS allowlist and Excel template directory become env-var-driven
(`CORS_ORIGINS`, `DATA_DIR`) instead of hardcoded, with templates supplied via a
read-only host bind mount rather than baked into the image (FR-008). A separate
`.devcontainer/` (its own Dockerfile with both toolchains) covers User Story 3's
onboarding case independently of the runtime compose shape (`research.md` #6). No
backend endpoint, request/response schema, or router changes — see API Contracts
below.

## Technical Context

**Language/Version**: Python 3.13 (backend), TypeScript/React 19 (frontend), Node 20
LTS for the frontend build stage — all already established, no application-code
language change.

**Primary Dependencies**: No new backend/frontend runtime dependencies. New
infra-only tooling: `nginx:alpine` (gateway image), `node:20-alpine` (frontend build
stage), Docker Compose v2 (`docker-compose.yml`), devcontainer spec
(`.devcontainer/devcontainer.json`).

**Storage**: N/A for application data (unchanged, per `research.md` #8 — every
feature is stateless/in-memory per request). One read-only bind mount for the
backend's Excel output templates (`research.md` #5, `data-model.md`).

**Testing**: No new automated test framework. Validated manually via
`quickstart.md`'s six scenarios (compose up/restart, single-origin access, host-mount
live-edit, config-without-code-change, devcontainer onboarding), consistent with
`specs/001`–`004`'s precedent of no frontend test runner and manual quickstart
validation for infra-level changes. Existing `pytest` suites are unaffected and
continue to run unchanged inside the backend image/CI, if any.

**Target Platform**: Docker containers on a single host reachable only from a private
office LAN/VPN (FR-009) — no TLS, no public domain, no auth (FR-009/FR-010).

**Project Type**: Web application (existing `frontend/` + `backend/` split,
unchanged) — this feature adds deployment packaging around it, not a new
project type.

**Performance Goals**: No new performance target beyond FR-005/SC-001 (fresh clone to
running app in under 10 minutes, including image build).

**Constraints**: All current API traffic is under the single `/accounts` prefix
(confirmed in `backend/routers/accounts.py`), so the gateway needs exactly one proxy
route; this is called out as an assumption to revisit if a future router is added
outside `/accounts`. Vite bakes `import.meta.env.VITE_*` at build time, not runtime —
worked around by using relative, same-origin API calls in the container build rather
than fighting the bake (`research.md` #3).

**Scale/Scope**: Three new Dockerfiles/config surfaces (`backend/Dockerfile`,
`frontend/Dockerfile` + `nginx.conf`, root `docker-compose.yml`), one new
`.devcontainer/` definition, and a small refactor of existing backend/frontend config
reads (CORS origin, data-template path, API base URL) to be env-driven instead of
hardcoded. No new endpoints, pages, or business logic.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|---|---|---|
| I. Spec/Plan/Task Separation | PASS | `spec.md` stays business-language-only (single entry point, one command, private network); this plan is the technical translation — topology, env vars, Dockerfiles. |
| II. Monorepo Boundary Discipline | PASS | Frontend and backend remain independently built/run containers communicating only over HTTP (through the gateway's proxy) — no shared code, no shared image, no cross-imports. The gateway is infra, not a third app sharing code with either side. |
| III. Tech Stack Standards | PASS | No endpoint paths, schemas, or camelCase conventions touched — see API Contracts below. Frontend's `apiConfig.ts` refactor keeps TanStack Query/`services/` layering intact (still one module per resource, still consumed via hooks, not ad-hoc `fetch` in components). |
| IV. Quality Gates | PASS | No application logic changes requiring new tests; existing `pytest`/`tsc -b`/`eslint` gates are unaffected and still apply to the small config-read refactors (`main.py`, `accounts_service.py`, `bonus_service.py`, `apiConfig.ts`). Validation for the deployment behavior itself is manual via `quickstart.md`, consistent with prior features' precedent for non-unit-testable infra/UI flows. |
| V. Anti-Bloat Principle | PASS | One `docker-compose.yml`, two feature Dockerfiles, one `nginx.conf`, one `.devcontainer/` — no orchestration framework (Kubernetes, Helm) or reverse-proxy platform (Traefik) beyond what's needed for one static route (`research.md` #1). `data-model.md` documents config/volume shape only, no fabricated domain entities. |

**Re-check after Phase 1 design**: PASS, unchanged — Phase 1 (`data-model.md`,
`quickstart.md`) confirmed no domain entities, no endpoint changes, and no principle
requires revision. No Complexity Tracking entries needed.

## API Contracts

No API contract changes. This feature is deployment/infrastructure only —
`backend/routers/accounts.py`'s endpoints, their request/response schemas, and their
`/accounts/*` paths are unchanged. Confirmed by reading the current router: every
existing endpoint (`/accounts/employee-benefits`, `/accounts/payroll-reconcile`,
`/accounts/bonus-calculation`) already lives under one prefix, which is exactly what
lets the gateway proxy with a single rule instead of per-endpoint routing (see
`research.md` #1, #9 and `data-model.md`'s network topology diagram). No new
`contracts/*.md` files are added.

## Project Structure

### Documentation (this feature)

```text
specs/005-docker-deployment/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output
├── data-model.md         # Phase 1 output — config/volume shape, no domain entities
├── quickstart.md        # Phase 1 output
└── tasks.md              # Phase 2 output (/speckit-tasks — not created by this command)
```

No `contracts/` directory — no endpoint changes (see API Contracts above).

### Source Code (repository root)

```text
docker-compose.yml                        # NEW: gateway (published port), backend
                                            #   (internal only), env vars + bind mount
                                            #   per data-model.md
.env.example                               # NEW: PORT, HOST_DATA_DIR, CORS_ORIGINS
                                            #   defaults documented for copy-to-.env
.dockerignore                              # NEW (repo root, plus one inside each of
                                            #   backend/ and frontend/): excludes
                                            #   backend/data/, node_modules/, .venv/

backend/
├── Dockerfile                             # NEW: python:3.13-slim, pip install
│                                           #   requirements.txt, copy source (excl.
│                                           #   data/), uvicorn main:app on :8000
├── main.py                                # MODIFIED: CORS_ORIGINS read from env
│                                           #   (research.md #4), default unchanged
├── services/accounts_service.py           # MODIFIED: TEMPLATE_PATH built from
│                                           #   DATA_DIR env var (research.md #5),
│                                           #   default unchanged outside Docker
└── services/bonus_service.py              # MODIFIED: same DATA_DIR change as above

frontend/
├── Dockerfile                             # NEW: multi-stage — node:20-alpine build
│                                           #   → nginx:alpine serve (research.md #2)
├── nginx.conf                             # NEW: SPA fallback + /accounts/* proxy to
│                                           #   backend:8000 (data-model.md topology)
├── .env.development                       # NEW: VITE_API_BASE_URL=http://127.0.0.1:8000
│                                           #   (local `npm run dev` only)
└── src/services/
    ├── apiConfig.ts                       # NEW: shared API_BASE_URL constant
    │                                       #   (research.md #3)
    ├── benefitsService.ts                 # MODIFIED: import API_BASE_URL from
    │                                       #   apiConfig.ts instead of local const
    ├── bonusService.ts                    # MODIFIED: same as above
    └── payrollReconcileService.ts         # MODIFIED: same as above

.devcontainer/
├── Dockerfile                             # NEW: Node 20 + Python 3.13 in one image
└── devcontainer.json                      # NEW: forwardPorts [5173, 8000],
                                            #   postCreateCommand installs both
                                            #   toolchains' deps (research.md #6)
```

**Structure Decision**: Existing Option 2 (web application) layout is unchanged —
`frontend/` and `backend/` stay independently run projects. This feature adds
deployment-only files (Dockerfiles, compose file, devcontainer, nginx config) around
them, plus the smallest possible config-read edits inside each side needed to make
the hardcoded CORS origin, data path, and API base URL environment-adjustable
(FR-007). No new top-level application directory, no new router, no new page.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations — Constitution Check passes both pre- and post-design with no
deviations to document.
