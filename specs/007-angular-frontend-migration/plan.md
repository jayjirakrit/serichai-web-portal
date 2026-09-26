# Implementation Plan: Angular Frontend Migration

**Branch**: `007-angular-frontend-migration` | **Date**: 2026-09-26 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/007-angular-frontend-migration/spec.md`

## Summary

Big-bang rewrite of `frontend/` from React 19 to Angular 22.2 (standalone, zoneless, signals, lazy routes), keeping Tailwind v4 + DaisyUI and the FastAPI contract untouched. Built in `frontend-ng/`, then swapped in for `frontend/` after parity. Architecture, target folder structure, `apiCall` helper, and phasing are defined in `/ANGULAR_MIGRATION_PLAN.md` (authoritative; not restated here). This plan records the deviations, verified versions, amendment, and doc/config changes. See `research.md` for decisions.

## Technical Context

**Language/Version**: TypeScript (Angular strict + `strictTemplates`, TS range set by Angular), Angular 22.2.0 (verified, `research.md` #1); backend Python 3.13 unchanged.

**Primary Dependencies**: `@angular/*` 22.2, RxJS, `tailwindcss` v4 + `@tailwindcss/postcss` + `postcss` + `daisyui`, `angular-eslint`. No TanStack, no state library.

**Storage**: N/A.

**Testing**: Angular default runner (Vitest, `ng test`): services via `HttpTestingController`, `apiCall`, `getEmployeeStatus`, `downloadAttachment`, one render smoke test per page (FR-014).

**Target Platform**: Modern browsers; Node >= 24.15 (Angular requires `^22.22.3 || ^24.15.0 || >=26`; repo pins 24); nginx container behind one port.

**Project Type**: web-application (frontend replaced; backend untouched).

**Performance Goals**: Parity with today; each page a lazy chunk.

**Constraints**: Backend contract frozen (FR-017); uploads >= 20 MB, timeouts >= 120 s (FR-012); dev via `ng serve` proxy, no CORS change (FR-013).

**Scale/Scope**: 6 routes, 4 service+page pairs, ~1,550 lines ported.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|---|---|---|
| I. Spec/Plan/Task Separation | PASS | Spec is business-only; technical detail lives here and in the referenced migration plan. |
| II. Monorepo Boundary Discipline | PASS | Only HTTP contracts (`contracts/*-angular.md`); no shared imports. Rationale text ("Vite SPA") updated by the amendment. |
| III. Tech Stack Standards | VIOLATION -> resolved by amendment | Frontend clause names React + TanStack Query. Resolved by amending to Angular + `HttpClient` as sole server-state layer (see Complexity Tracking). Backend clauses untouched and still satisfied: camelCase payloads, kebab-case paths, no backend change. DaisyUI-first retained. |
| IV. Quality Gates | VIOLATION -> resolved by amendment | Names `tsc -b` / `eslint .`. Amended to `ng build` (strict type-check), `ng lint`, `ng test`. Tests now exist for critical flows (improvement over 001-006's manual-only frontend validation). |
| V. Anti-Bloat | PASS | Migration plan is referenced, not copied; one shared `FileAttachment` and download util remove existing duplication; no new libraries beyond the Angular default set. |

Re-check after Phase 1: unchanged; contracts are delta-only and the backend is not modified.

## API Contracts

Backend unchanged (FR-017); these are consumer-side deltas over the original contracts.

- `POST /accounts/employee-benefits` - see `contracts/benefits-api-angular.md`
- `POST /accounts/bonus-calculation` - see `contracts/bonus-calculation-api-angular.md`
- `POST /accounts/payroll-reconcile` - see `contracts/payroll-reconciliation-api-angular.md`
- `POST /accounts/tax-deduction` - see `contracts/tax-deduction-api-angular.md`

## Project Structure

### Documentation (this feature)

```text
specs/007-angular-frontend-migration/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── benefits-api-angular.md
│   ├── bonus-calculation-api-angular.md
│   ├── payroll-reconciliation-api-angular.md
│   └── tax-deduction-api-angular.md
└── tasks.md              # /speckit-tasks
```

### Source Code (repository root)

```text
frontend-ng/  ->  renamed to frontend/ at cutover   # layout per ANGULAR_MIGRATION_PLAN.md "Target structure"
├── angular.json  package.json  .postcssrc.json  proxy.conf.json  eslint.config.js
├── public/   (favicon, Tax_Reduction_Input.xlsx)
└── src/app/{core,shared,features}/**  (specs colocated as *.spec.ts)

frontend/Dockerfile   node:24-alpine, copy dist/serichai-web-portal/browser
frontend/nginx.conf   + client_max_body_size 20m; proxy_read/send_timeout 120s
.devcontainer/{Dockerfile,devcontainer.json}   Node 24; forward 4200 instead of 5173
docker-compose.yml, .env.example   CORS default 4200 (cosmetic)
CLAUDE.md, README.md, frontend/README.md, .claude/agents/frontend-engineer.md,
.claude/agents/solution-architect.md (Principle III wording), .specify/memory/constitution.md
```

**Structure Decision**: Sibling-folder rewrite then rename, so all `frontend/` paths in Docker, devcontainer, and docs stay valid. `backend/` is not touched.

## Docs and config changes (Principle: keep CLAUDE.md current)

| File | Change |
|---|---|
| `.specify/memory/constitution.md` | MAJOR 1.1.1 -> 2.0.0 (research.md #7), Sync Impact Report; first task, via `/speckit-constitution`. |
| `CLAUDE.md` | Commands (`npm start`/`ng build`/`lint`/`test`), Node 24, frontend architecture (`core`/`shared`/`features`), state-management section (signals + `HttpClient` + `apiCall`, replaces TanStack/React Compiler text), Tailwind via `.postcssrc.json`, dev proxy replaces "no proxy / CORS 5173" notes, Docker output path. Commit-convention section unchanged (no Co-Authored-By trailer; this overrides harness attribution). |
| `.claude/agents/frontend-engineer.md` | Rewrite React/TanStack/Compiler rules to Angular rules; description "Angular/TypeScript UI". |
| `.devcontainer/*` | Node 24 base image; ports 4200/8000; `npm ci`. |
| `README.md`, `frontend/README.md` | Replace Vite/React template text. |
| `frontend/Dockerfile`, `frontend/nginx.conf` | As above. |

## Commit plan

Per `CLAUDE.md`: this spec dir as `[DOCS] add angular-frontend-migration feature spec` (separate commit, before implementation); implementation as `[ADD][FE]`/`[IMP][FE]`; constitution/CLAUDE.md as `[DOCS]`. No `Co-Authored-By` trailer.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| Principle III (React/TanStack) and IV (`tsc -b`/`eslint .`) name the retired stack | The feature's purpose is replacing that stack; the principles' frontend wording must change, MAJOR bump 2.0.0 (backward-incompatible redefinition) | Leaving the constitution as-is makes every Angular file a violation; a PATCH/MINOR wording tweak understates a framework change and contradicts the versioning policy |
