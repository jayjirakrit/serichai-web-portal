---

description: "Task list for Angular Frontend Migration"
---

# Tasks: Angular Frontend Migration

**Input**: `/specs/007-angular-frontend-migration/` (plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md). Design, target structure and code sketches: `/ANGULAR_MIGRATION_PLAN.md` (authoritative). Standing conventions: `CLAUDE.md`.

**Tests**: Requested (FR-014). Per Constitution Principle I, each task includes its own `*.spec.ts` (Vitest via `ng test`) rather than separate test tasks.

**Paths**: New app is built in `frontend-ng/` (renamed to `frontend/` in T017). `backend/` is not touched. All `app/` paths are under `frontend-ng/src/app/`.

**Commits** (CLAUDE.md): `[ADD][FE]`/`[IMP][FE]`/`[DOCS]` tags, no Co-Authored-By trailer (overrides harness default). The spec dir is committed separately as `[DOCS]` before implementation.

## Phase 1: Setup

- [X] T001 Amend `.specify/memory/constitution.md` 1.1.1 -> 2.0.0 via `/speckit-constitution` per research.md #7 (Principle III frontend clause -> Angular + `HttpClient`/`apiCall`; Principle IV gates -> `ng build`/`ng lint`/`ng test`; Principle II rationale "Angular SPA"), with Sync Impact Report.
- [X] T002 Scaffold `frontend-ng/` with Angular CLI 22.2 (project `serichai-web-portal`, standalone, zoneless, strict + `strictTemplates`, Vitest runner, no SSR); set `engines.node >=24.15.0`; create `core/ shared/ features/` skeleton and `@core/* @shared/* @features/*` path aliases in `tsconfig.json`.
- [X] T003 Wire styling and dev proxy in `frontend-ng/`: `.postcssrc.json` (`@tailwindcss/postcss`), deps `tailwindcss @tailwindcss/postcss postcss daisyui`, `src/styles.css` (fonts import, `@import "tailwindcss"; @plugin "daisyui";`, `@theme` block and `@layer base` copied from `frontend/src/index.css`), `index.html` title/favicon, `public/Tax_Reduction_Input.xlsx` (from `frontend/src/assets`), `proxy.conf.json` (`/accounts` -> `http://127.0.0.1:8000`) and `npm start` using it.
- [X] T004 Configure `angular-eslint` (flat config) in `frontend-ng/eslint.config.js` with `no-restricted-imports` boundaries: features must not import other features; `shared` must not import `core`/`features`.

---

## Phase 2: Foundational (blocks all stories)

- [X] T005 `app/core/config/api-config.ts` (`API_BASE_URL` token, provided as `''`), `app/app.config.ts` (`provideRouter`, `provideHttpClient(withFetch())`, global error listeners), `app/app.routes.ts` (lazy `loadComponent` for `''`, `login`, `employee-benefits`, `bonus-calculation`, `payroll-reconciliation`, `tax-deduction`; `**` redirects to `''`), `app/app.ts` (shell with router outlet), `main.ts`.
- [X] T006 [P] `app/core/http/api-call.ts` (+ `.spec.ts`): signal helper per migration plan (`data/error/pending/status/run/reset`); error = `error.detail` else `Request failed with status <status>`; subscription ends with component (`DestroyRef`); spec covers idle/pending/success/error transitions, detail mapping, status 0, and no update after destroy.
- [X] T007 [P] `app/shared/models/attachment.ts` (single `FileAttachment`) and `app/shared/utils/download.ts` `downloadAttachment()` (+ `.spec.ts`: base64 -> Blob, file name, object URL revoked).
- [X] T008 [P] Shared UI and shell (+ smoke specs): `app/shared/ui/{button,card,result-panel,file-field}.ts` (result-panel = idle/pending/error/success shell; file-field shows inline validation message), `app/core/layout/{layout,navbar}.ts` using `<a class="btn">` (no button-in-link), `routerLinkActive` for the active page; port markup/classes from `frontend/src/components/` following the Tailwind class-order convention in `CLAUDE.md`.

**Checkpoint**: `npm run build` green; empty routes lazy-load.

---

## Phase 3: User Story 1 - Every existing page works as before (P1) MVP

**Goal**: Four calculation pages at field-for-field parity with the React pages.
**Independent Test**: With `sample-data/` files against the live backend, each page shows pending -> summary/lists -> working downloads; wrong file shows backend `detail`; missing input shows inline message and sends no request; submit disabled while pending.

Each task: `<feature>.models.ts` (camelCase types from `data-model.md`), `<feature>.service.ts` (FormData POST, no `Content-Type`), page `.ts` + `.html` (ported from `frontend/src/pages/`, `@switch` on `call.status()`, `@for ... track`, decimal pipe with `-` for null), and specs: service spec via `HttpTestingController` asserting URL and exact multipart field names, page smoke spec (renders idle state; blocks submit without file). See the matching `contracts/*-angular.md` for fields and usage paths.

- [X] T009 [P] [US1] `app/features/employee-benefits/` - fields `masterFile`, optional `previousBenefitsFile` -> `POST /accounts/employee-benefits` (`contracts/benefits-api-angular.md`).
- [X] T010 [P] [US1] `app/features/payroll-reconcile/` - `payrollFile`, `period` (`<input type="month">`) -> `POST /accounts/payroll-reconcile` (`contracts/payroll-reconciliation-api-angular.md`).
- [X] T011 [P] [US1] `app/features/bonus-calculation/` - `currentYearFile`, `previousYearSummaryFile`, `year`; calculate/config tabs via `signal` -> `POST /accounts/bonus-calculation` (`contracts/bonus-calculation-api-angular.md`).
- [X] T012 [P] [US1] `app/features/tax-deduction/` - `payrollFile` only (never `referenceDate`, FR-010); `employee-status.ts` (`getEmployeeStatus` ported unchanged, incl. disabled rule) with its spec covering age-only and disabled cases; results table, status badges, rules collapse, template link `/Tax_Reduction_Input.xlsx` (`contracts/tax-deduction-api-angular.md`).

**Checkpoint**: `ng test` and `ng build` green; manual check of the four pages per quickstart.md.

---

## Phase 4: User Story 2 - Navigation, look and feel unchanged (P1)

**Goal**: Same menu, routes, visuals; deep links and unknown addresses behave as today.
**Independent Test**: Side-by-side screenshots vs. React app for Home + 4 pages (all states); direct-open/refresh each route; unknown path lands on Home.

- [X] T013 [US2] `app/features/home/` and `app/features/auth/` (Login placeholder) ported from `frontend/src/pages/`; `app/app.routes.spec.ts` (routes resolve to lazy components, `**` -> Home, active-link class on navbar); fix visual drift found in the side-by-side screenshot review (Home + four pages, all states).

---

## Phase 5: User Story 3 - Deployed and run the same way (P2)

**Goal**: One-command containerised deploy on one port; large uploads work; local two-process dev works.
**Independent Test**: `docker compose up --build`, deep-link `/tax-deduction`, refresh, upload ~20 MB file; `npm start` + uvicorn locally.

- [X] T014 [US3] Deployment/dev config, authored inside `frontend-ng/` so it survives the rename: `Dockerfile` (`node:24-alpine` build, copy `dist/serichai-web-portal/browser` to nginx), `nginx.conf` (existing `try_files` + `/accounts/` proxy plus `client_max_body_size 20m; proxy_read_timeout 120s; proxy_send_timeout 120s;`), `.dockerignore`; `.devcontainer/{Dockerfile,devcontainer.json}` to Node 24, ports 4200/8000, `npm ci`; `.env.example` and `docker-compose.yml` CORS default `5173` -> `4200` (cosmetic).

---

## Phase 6: User Story 4 - Automated tests protect the new front end (P2)

**Goal**: Full quality gate green (specs already written per task).
**Independent Test**: `npm run lint && npm test -- --watch=false && npm run build` in `frontend-ng/`.

- [X] T015 [US4] Run lint, tests and build in `frontend-ng/`; fix all strict-typing (nullable model fields), lint and boundary-rule failures by correcting models, not casting; confirm each page has a spec that fails on a wrong multipart field name or broken error mapping (SC-006), and that lazy chunks are emitted.

---

## Phase 7: User Story 5 - Old front end retired, docs current (P3)

**Goal**: One front end (Angular), accurate docs.
**Independent Test**: `grep -ril "react\|vite\|tanstack" --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=specs .` returns nothing beyond exempt files (quickstart.md "Cutover check").

- [ ] T016 [US5] Parity gate: run quickstart.md "Manual parity check" and "Containerised check" (T014) against `sample-data/`; record any deviations and resolve before cutover.
- [ ] T017 [US5] Cutover: delete `frontend/`, `git mv frontend-ng frontend`; confirm `docker-compose.yml`, devcontainer and lint/test/build still pass from `frontend/`; remove leftover React/Vite artefacts (`tailwind.config.js`, `hero.png`, `react.svg`, `vite.svg`, `App.css`).
- [ ] T018 [US5] Docs: update `CLAUDE.md` (commands, Node 24, `core/shared/features` architecture, state-management section -> signals + `HttpClient` + `apiCall`, Tailwind via `.postcssrc.json`, dev proxy replaces CORS/no-proxy notes, Docker output path; keep the commit-convention section as is), `README.md`, `frontend/README.md`, `.claude/agents/frontend-engineer.md` (Angular rules), `.claude/agents/solution-architect.md` (Principle III wording).

---

## Phase 8: Polish

- [ ] T019 Final run of quickstart.md end to end plus the cutover grep; fix stragglers.

---

## Dependencies & Execution Order

- T001 -> T002 -> T003 -> T004 -> Phase 2 (T005 first; T006-T008 parallel after it) -> Phase 3 (T009-T012 parallel) and T013 (needs T008) -> T014 -> T015 -> T016 -> T017 -> T018 -> T019.
- US1/US2 are independent after Phase 2; US3 needs a buildable app; US5 requires US1-US4 complete (no cutover before parity).
- Parallel: T006/T007/T008; T009/T010/T011/T012. Frontend tasks are all `frontend-ng/`; delegate to `frontend-engineer` (T001, T014's compose/env edits and T018 docs are repo-level).

## Implementation Strategy

MVP = Phases 1-3 (all four pages working in `frontend-ng/` against the live backend), then navigation polish, deploy config, gate, and only then cutover and docs. Stop at each checkpoint to validate.
