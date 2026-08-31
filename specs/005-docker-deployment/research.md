# Research: Containerized Deployment with Single Entry Point

Mechanism is fixed by the spec/user request (Docker Compose, optionally with a
devcontainer) — not re-litigated here. This resolves the *how*: topology, config
strategy, and volume layout.

## 1. Reverse-proxy / single-entry-point technology

**Decision**: `nginx:alpine` as a gateway container. It serves the built frontend
static assets (`frontend/dist`) directly and reverse-proxies `/accounts/*` to the
backend container over the Compose network, all from one image and one exposed port.

**Rationale**: All existing and current endpoints live under one path prefix
(`backend/routers/accounts.py` mounts everything at `/accounts`, confirmed by reading
the router — no other router exists), so the routing rule is a single `location`
block. nginx does static-file serving and proxying natively with no extra process,
keeping the gateway image minimal and matching FR-002/FR-003 (one host:port for UI +
API) directly.

**Alternatives considered**:
- *Traefik* — stronger fit for many dynamically-registered services/TLS via
  auto-discovery labels; unneeded complexity here (one static route, no TLS per
  FR-009).
- *Caddy* — simpler config syntax, but the team has no existing familiarity with it
  and nginx's `try_files`/`proxy_pass` pattern for "SPA + API behind one origin" is
  the most widely documented version of this exact shape.
- *Serve the SPA from a Node process (`vite preview`/`serve`) and proxy separately* —
  adds a second runtime process and still needs a proxy in front of it for FR-002;
  strictly more moving parts than nginx alone.

## 2. How the frontend build gets served

**Decision**: Multi-stage `frontend/Dockerfile` — stage 1 (`node:20-alpine`) runs
`npm ci && npm run build` producing `dist/`; stage 2 (`nginx:alpine`) copies `dist/`
into `/usr/share/nginx/html` plus a repo-provided `nginx.conf` with SPA fallback
(`try_files $uri /index.html`) and the `/accounts/` proxy rule. The build stage is
discarded from the final image — no Node runtime ships in production.

**Rationale**: Matches `npm run build`'s existing output (CLAUDE.md) with no new
build tooling; keeps the shipped image to nginx + static files only.

## 3. Env-based config vs. Vite's build-time env baking

**Problem**: Vite inlines `import.meta.env.VITE_*` at build time, but FR-007 requires
the frontend's backend base URL to be adjustable *without modifying source*, and the
current code hardcodes `const BACKEND_BASE_URL = "http://127.0.0.1:8000"`, duplicated
in `benefitsService.ts`, `bonusService.ts`, and `payrollReconcileService.ts`.

**Decision**: Because nginx now proxies `/accounts/*` on the *same origin* the page
was loaded from, the containerized frontend never needs an absolute backend URL —
service calls switch to a relative base (`""`), resolved via one shared
`frontend/src/services/apiConfig.ts` exporting
`API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ""`. All three service files
import this constant instead of each declaring their own. Local (non-Docker) dev,
where the Vite dev server has no proxy, keeps working by setting
`VITE_API_BASE_URL=http://127.0.0.1:8000` in a checked-in `frontend/.env.development`
— still zero source changes to retarget an environment, since `.env.development` is
config, not application code, and only applies to `npm run dev`.

**Rationale**: Sidesteps the build-time-baking problem entirely for the deployed case
instead of fighting it (e.g. runtime `env.js` injection), and reduces duplication as
a side effect. `.env.development` overriding the container-default empty base URL is
the standard Vite mechanism for this and needs no custom tooling.

**Alternatives considered**:
- *Runtime-injected `window.__ENV__` via an entrypoint script writing a small JS file
  into the nginx image at container start* — solves true runtime reconfigurability,
  but this app has exactly one env-dependent value and the proxy topology already
  makes it unnecessary; added complexity isn't justified (Principle V).
- *Bake the absolute Compose-network backend URL at build time* — breaks if the
  published port/hostname changes per deployment; relative same-origin calls avoid
  the coupling entirely.

## 4. Backend CORS origin configurability

**Decision**: `backend/main.py` reads `CORS_ORIGINS` (comma-separated) from the
environment at startup, defaulting to `http://localhost:5173` — preserving today's
behavior when the var is unset. Docker Compose sets it explicitly for clarity even
though, in the proxied topology, the browser only ever talks to nginx's origin
(server-to-server nginx→backend calls aren't subject to browser CORS at all); the var
still matters for the existing local dev workflow (Vite dev server on 5173 calling
the backend directly).

**Rationale**: Satisfies FR-007 with a one-line change; avoids inventing a config
mechanism beyond a standard env var read.

## 5. Host-mounted Excel data volume (FR-008)

**Decision**: Introduce a `DATA_DIR` env var read by `accounts_service.py` and
`bonus_service.py` in place of their current `Path(__file__).resolve().parent.parent
/ "data"` construction, defaulting to that same relative path when unset (no change
outside Docker). `docker-compose.yml` bind-mounts a host directory to `/app/data`
(read-only — every current read of this directory is template input, never written
back) and sets `DATA_DIR=/app/data`; the backend `Dockerfile` excludes `backend/data/`
via `.dockerignore` so template files are never baked into the image, only supplied
at runtime, per FR-008. The host path defaults to `./backend/data` (so a fresh clone
works out of the box, matching SC-001) and is overridable via a `HOST_DATA_DIR` entry
in a root `.env` file for a different host layout.

**Rationale**: Directly implements FR-008 and the spec Assumption that "whoever runs
the container is responsible for the files existing at the mounted path" — the
default host path requires no setup for the common case, while remaining swappable.

**Alternatives considered**: Baking `backend/data/*.xlsx` into the image — rejected
explicitly by FR-008 (files must be updatable without a rebuild).

## 6. Devcontainer's relationship to docker-compose.yml (User Story 3)

**Decision**: A separate `.devcontainer/` definition — its own `Dockerfile` (Node 20
+ Python 3.13 in one image) and `devcontainer.json` (`forwardPorts: [5173, 8000]`,
`postCreateCommand` running `npm install` in `frontend/` and `pip install -r
requirements.txt` in `backend/`) — rather than reusing/attaching to the
`docker-compose.yml` gateway/backend services.

**Rationale**: The two have different jobs. `docker-compose.yml` (US1/US2) packages
the app for someone to *run* — built assets, no source mounts, single published port.
The devcontainer (US3, P3) is for someone to *edit and iterate on* the app — needs
both toolchains, hot-reload (`npm run dev` + `uvicorn --reload`), and the two existing
dev ports open, none of which is compatible with the built-image, single-port
gateway shape. Keeping them separate avoids compromising either (e.g. adding
source-mount dev complexity into the production-shaped compose file). Inside the
devcontainer, a contributor runs the exact two commands already documented in
`CLAUDE.md` — no new dev workflow to learn.

**Alternatives considered**: `devcontainer.json`'s `dockerComposeFile` pointing at
`docker-compose.yml` with a dedicated dev override service — more moving parts
(a compose override file plus the devcontainer file) for a P3 story that's
independent of P1/P2's runtime shape; rejected per Principle V.

## 7. Startup ordering / dependency health (Edge Case)

**Decision**: Backend Compose service declares a `healthcheck` hitting
`GET /docs` (FastAPI's built-in Swagger UI — already served with no code change) via
`curl`; the gateway service sets `depends_on: backend: condition: service_healthy`.

**Rationale**: Answers the "containers started out of order" edge case with Compose's
built-in mechanism, at zero application-code cost — no new `/health` endpoint needed
since `/docs` already returns 200 once FastAPI is up.

## 8. Restart / in-progress-work behavior (Edge Case, SC-003)

**Decision**: No design change needed. Every current feature (`benefits`, `bonus`,
`payroll-reconcile`) processes an uploaded file entirely in-memory per request with
no persistence layer (confirmed in `specs/003-payroll-reconcile/plan.md`'s Technical
Context: "Storage: N/A"). A container restart has nothing to lose beyond the
in-flight request itself, and returns to a clean working state — satisfying SC-003
without any new state-preservation mechanism.

## 9. Published port / conflict handling (Edge Case)

**Decision**: The gateway service's published port is `${PORT:-8080}:80`, read from a
root `.env` file (`PORT=8080` default, not `8000` or `5173` to avoid colliding with
either existing local dev process). Changing it is a one-line `.env` edit, no source
change — satisfying FR-007's "adjustable without modifying source" for this value
too.
