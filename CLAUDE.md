# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Serichai Web Portal — an internal tool for Serichai and Ch.Paisarn. Monorepo with two independently run apps that talk over HTTP:

- `frontend-ng/` — Angular 22 + TypeScript SPA (the main frontend; spec 007 task T017 renames it to `frontend/`)
- `frontend/` — legacy React 19 + Vite SPA, frozen and to be deleted at the same cutover
- `backend/` — FastAPI (Python) service

There is no shared build, no monorepo tooling (Nx/Turborepo/workspaces), and no shared package between the two — they are just two sibling projects in one repo. Always `cd` into the relevant subfolder before running its tooling.

## Commands

### Frontend (`frontend-ng/`)

```
npm ci            # install deps (Node >= 24.15)
npm start         # ng serve with proxy.conf.json (http://localhost:4200, /accounts -> http://127.0.0.1:8000)
npm run build     # ng build (strict type-check) -> dist/serichai-web-portal/browser
npm run lint      # ng lint
npm test          # ng test (Vitest); add -- --watch=false for a single run
```

The legacy React app in `frontend/` still uses `npm run dev` / `npm run build` / `npm run lint` until the cutover deletes it — don't add features there.

### Backend (`backend/`)

A `.venv` already exists at `backend/.venv` (Python 3.13, created with `python -m venv`).

```
backend/.venv/Scripts/activate   # Windows: activate the existing venv
pip install -r requirements.txt
uvicorn main:app --reload        # run from inside backend/, serves on http://127.0.0.1:8000
```

No lint config, no test framework, and no formatter config exist in `backend/` yet — don't invent commands for these.

### Containerized (`docker-compose.yml`)

Runs both apps together behind a single published port, for deployment on a private network (no TLS/auth — see `specs/005-docker-deployment/spec.md`):

```
cp .env.example .env   # first time only; defaults work out of the box
docker compose up      # serves the whole portal on http://localhost:8080 (or $PORT)
```

This builds `backend/Dockerfile` and the frontend `Dockerfile` (a Node build stage → nginx serving the SPA and reverse-proxying `/accounts/*` to the backend with a 20 MB upload limit — see `nginx.conf` next to it). Until the spec 007 cutover the compose file still builds the React app from `./frontend`; the Angular equivalents already live in `frontend-ng/`. The backend's Excel templates are bind-mounted read-only from `HOST_DATA_DIR` (`.env`, defaults to `./backend/data`) rather than baked into the image, so they can be updated without a rebuild. This is a separate workflow from `npm run dev` / `uvicorn --reload` above, not a replacement for it — use those for day-to-day local development.

### Windows native install (`scripts/windows/`)

For a Windows machine that should run the portal permanently without Docker: `setup.ps1` (winget installs Python/Node, venv + `pip install`, `npm ci` + build, registers a boot-time Scheduled Task), `open-firewall.ps1` (LAN access), `set-static-ip.ps1` (optional). The task runs `uvicorn` on `0.0.0.0:8080` with `FRONTEND_DIST` set, so `backend/main.py` serves the built Angular bundle (SPA fallback) plus `/accounts/*` from one origin — the same shape as the nginx gateway. `FRONTEND_DIST` is unset in dev and Docker, so this path is inactive there. See `scripts/windows/README.md`.

### Devcontainer (`.devcontainer/`)

For onboarding: open the repo in a devcontainer-compatible editor to get Node + Python 3.13 with both toolchains' dependencies pre-installed (`postCreateCommand`), then run the same `npm start` / `uvicorn --reload` commands above inside it — no local Node/Python install needed.

## Architecture

### Backend: router → service layering

FastAPI app in `backend/main.py` mounts routers from `backend/routers/`, which delegate to `backend/services/` for logic. New endpoints should follow this same split rather than putting logic inline in the router:

- `backend/routers/<name>.py` defines an `APIRouter` with a URL prefix/tags and thin handler functions.
- `backend/routers/__init__.py` re-exports each router (e.g. `accounts_router`) for `main.py` to include.
- `backend/services/<name>_service.py` holds the actual business logic, called by the matching router.
- `backend/models/` and `backend/util/` exist as placeholders for future Pydantic models / shared helpers — currently empty.

CORS in `main.py` reads `CORS_ORIGINS` (comma-separated, default `http://localhost:4200`, the Angular dev origin) — set it when deploying or adding another frontend origin. In dev the Angular proxy makes calls same-origin, so CORS rarely matters.

Note: `services/accounts_service.py` currently reads its Excel input from a hardcoded absolute Windows path rather than `backend/data/`. Treat this as a known rough edge, not a pattern to copy — new services should take file input as a parameter/upload rather than a hardcoded path.

### API conventions (endpoint paths + JSON field casing)

- Endpoint paths are resource-named, kebab-case for multi-word resources, and rely on the HTTP verb rather than a verb suffix — e.g. `POST /accounts/employee-benefits`, not `POST /accounts/employee_benefits/calculate`.
- All JSON request/response bodies (and multipart form field names) use **camelCase** keys. Backend Python internals stay `snake_case` per PEP 8; bridge the two on each Pydantic model with a camelCase `alias_generator` (e.g. Pydantic's `to_camel`) plus `populate_by_name=True`, rather than hand-writing `Field(alias=...)` per field or exposing `snake_case` keys over the wire.
- Frontend TypeScript types for API payloads should be written camelCase directly (matching the wire format) — no field-translation layer between `fetch`/`axios` calls and component code.

### Frontend: core/shared/features structure

Angular app in `frontend-ng/src/app/` (standalone components, zoneless, TypeScript `strict` + `strictTemplates`):

- `core/` — app-wide singletons: `core/http/api-call.ts` (the `apiCall` helper), `core/config/api-config.ts` (`API_BASE_URL` token), `core/auth/` (Login placeholder).
- `shared/` — reusable UI (`shared/ui/`: `layout`, `navbar`, `button`, `card`, `result-panel`, `file-field`), `shared/models/`, `shared/utils/`.
- `features/<name>/` — one folder per page/route: `<name>.ts` + `<name>.html` (component), `<name>.service.ts` (HTTP calls), `<name>.models.ts` (camelCase types matching the wire format), and `*.spec.ts` for each. Routes are lazy-loaded in `app.routes.ts` via `loadComponent`.
- ESLint (`angular-eslint`, flat config) enforces boundaries: features must not import other features; `shared` must not import `core`/`features`. Use the `@/`, `@core/`, `@shared/`, `@features/` path aliases instead of relative imports.
- Styling is Tailwind CSS v4 (via `@tailwindcss/postcss` in `.postcssrc.json`) plus DaisyUI, using the custom `enterprise` theme. Colors, typography, radii and shadows go through CSS custom properties (`var(--primary)`, `var(--fz-title)`, …) defined in `src/styles.css` — check it before introducing a new color/size, and prefer an existing token over a literal.
- Tailwind class ordering: **Layout → Sizing → Typography → Colors & Effects → States**, e.g. `flex items-center justify-between w-full h-14 bg-white shadow-sm hover:bg-gray-50 transition-all`.
- Build tooling: Angular CLI 22 (`@angular/build`), Vitest for tests, flat-config ESLint.

### Frontend: state management

Follow this decision order rather than reaching for a global store by default:

1. **Local component state (`signal`/`computed`)** — default for anything only one component (and maybe its children via inputs) cares about: form fields, toggles, selected files. Keep state as close as possible to where it's used.
2. **Lift state up** before introducing a shared service — if two siblings need the same state, move it to their nearest common parent.
3. **Server/API state (data from the FastAPI backend) is not UI state.** Angular `HttpClient` is the sole server-state layer:
   - Put HTTP calls in `features/<name>/<name>.service.ts` (`inject(HttpClient)`, `API_BASE_URL`, return `Observable<T>`); never call `HttpClient` from components.
   - Components consume services through `apiCall(fn)` from `@core/http/api-call`, which exposes `data`, `error`, `pending`, `status`, `run`, `reset` as signals and cancels the request when the component is destroyed. Error text is `error.detail` from the backend, else `Request failed with status <status>`.
4. **Injectable services with signals** — for genuinely cross-cutting client state with few, infrequent updates (auth/session user, active theme). Split unrelated concerns into separate services.
5. **Global client-state library (NgRx, etc.)** — don't add one preemptively; only once unrelated features need the same client state and service composition has become painful.
6. **Encapsulate reusable stateful logic** in `core/` or `shared/` helpers (like `apiCall`) instead of duplicating it across features.

## Spec-Kit design sketches

`/speckit-plan` also writes `specs/<feature>/design.md` (from `.specify/templates/design-template.md`): a review aid (~250-400 lines) showing the key implementation files as short key-path snippets (feature service/models/component/template, backend router/service/models, shared blocks, algorithms, decision-carrying config) plus approach, decisions, flow, risks and open questions, for the architect to review at the plan gate, before `/speckit-tasks`. It is the only spec artifact allowed to contain implementation code; engineers treat it as guidance and report any deviation.

## Git commit conventions

- Do **not** add a `Co-Authored-By: Claude` (or any Anthropic/Claude attribution) trailer to commit messages in this repository. Commits should be authored under the user's own identity only.
- Subject line is tagged `[TAG]` or `[TAG][AREA]`, imperative mood, lowercase after the tag: `[ADD]` (new capability), `[IMP]` (change/enhancement to existing behavior), `[DOCS]` (documentation-only, incl. spec-kit artifacts), each optionally paired with an area tag — `[BE]` (`backend/`), `[FE]` (`frontend/`), `[UI]`, `[DOC]`. Examples: `[ADD][BE] employee benefits calculation API`, `[IMP][FE] add previous benefits file upload for carryforward calculation`.
- **Spec-kit feature specs**: when committing a new `specs/<NNN-feature-name>/` directory (spec, plan, research, data-model, contracts, quickstart, design, tasks, checklists), use `[DOCS] add <feature-name> feature spec` as the subject, with a body listing which artifacts are included, e.g.:
  ```
  [DOCS] add <feature-name> feature spec

  Adds the spec-kit planning artifacts (spec, plan, research, data
  model, API contract, quickstart, tasks, checklist) for the <feature>
  feature (<NNN>).
  ```
  Commit only the `specs/<NNN-feature-name>/` directory in that commit — keep spec-doc commits separate from implementation commits (`[ADD]`/`[IMP]`), matching the existing history where each feature's spec lands as its own commit before the `[ADD][BE]`/`[ADD][FE]` implementation commits that follow it.

## Cross-cutting notes

- Frontend and backend are developed and run as two separate processes (`npm start` + `uvicorn`); the Angular dev server proxies `/accounts/*` to `http://127.0.0.1:8000` via `frontend-ng/proxy.conf.json`, so service calls use relative URLs (`API_BASE_URL` is `''`). In containers/Windows install, nginx or `backend/main.py` serves the built SPA and `/accounts/*` from one origin.
- Employee benefit data (`backend/data/Employee_Benefit_Template.xlsx`) uses Thai-language column headers and Buddhist Era (BE) year conventions (BE = Gregorian year + 543) — preserve this convention when touching `accounts_service.py` or related date/year logic.
