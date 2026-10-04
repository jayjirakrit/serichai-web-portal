# Implementation Plan: System Info "About" Page

**Branch**: `008-system-info-page` | **Date**: 2026-10-05 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/008-system-info-page/spec.md`

## Summary

A new backend `/system` router exposes `GET /system/info` (app name and version from env,
server time with numeric offset, constant `status: "ok"`). A new Angular `features/about/`
page at `/about`, linked from the navbar, fetches it on open through `apiCall` and renders
it in a card inside `app-result-panel`. Every gateway that forwards `/accounts` today gains
a matching `/system` rule (`research.md` #1).

## Technical Context

**Language/Version**: Python 3.13 (backend); TypeScript, Angular 22 (`frontend-ng/`).

**Primary Dependencies**: FastAPI + Pydantic 2 (existing `CamelModel`); Angular
`HttpClient` via `apiCall`, DaisyUI. No new dependency.

**Storage**: N/A (FR-007).

**Testing**: `pytest` + `TestClient` with `dependency_overrides` (`backend/tests/test_system_info.py`);
Vitest specs for the about service/page, navbar and route (`ng test`).

**Target Platform**: Existing dev (`npm start` + uvicorn), Docker gateway, Windows nginx install.

**Project Type**: Web application (two independent apps over HTTP).

**Performance Goals**: Values visible < 2 s (SC-002); endpoint does no I/O.

**Constraints**: `serverTime` always carries a numeric offset (`research.md` #3);
`/system/*` must be forwarded by every gateway (`research.md` #1); name/version from
`APP_NAME`/`APP_VERSION` env with defaults (`research.md` #2).

**Scale/Scope**: 1 endpoint, 1 router + service + model, 1 page, 1 navbar link, 4 one-line
gateway entries, 1 compose env line.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Pre | Post-design | Notes |
|---|---|---|---|
| I. Spec/Plan/Task Separation | PASS | PASS | Code only in `design.md`. |
| II. Monorepo Boundary | PASS | PASS | HTTP only; version is not read from `package.json` (`research.md` #2). |
| III. Tech Stack Standards | PASS | PASS | Thin router → service; `SystemInfo(CamelModel)`; config via `Depends(get_app_identity)`; `apiCall` in the component, `HttpClient` only in `about.service.ts`; resource-named path. |
| IV. Quality Gates | PASS | PASS | pytest for the service/endpoint; `ng build`/`ng lint`/`ng test` incl. page states. |
| V. Anti-Bloat | PASS | PASS | Reuses `CamelModel`, `apiCall`, `ResultPanel`, `Layout`; no new shared component. |
| VI. Simple, Surgical | PASS | PASS | No client timeout, no `/api` prefix refactor, `/health` untouched. |

## API Contracts

- `GET /system/info` — app name, version, server time (ISO 8601 + offset), status `"ok"`; see `contracts/system-api.md`

## Design Sketches

Key implementation snippets for architect review live in `design.md` (built from
`.specify/templates/design-template.md`). No implementation code belongs in this file.

## Project Structure

### Documentation (this feature)

```text
specs/008-system-info-page/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── design.md
├── contracts/
│   └── system-api.md
└── tasks.md              # /speckit-tasks
```

### Source Code (repository root)

```text
backend/
├── main.py                    # MODIFIED: include system_router; "system" in _api_prefixes
├── routers/
│   ├── __init__.py            # MODIFIED: re-export system_router
│   └── system.py              # NEW: GET /system/info
├── services/
│   └── system_service.py      # NEW: AppIdentity, get_app_identity, get_system_info
├── models/
│   └── system.py              # NEW: SystemInfo(CamelModel)
└── tests/
    └── test_system_info.py    # NEW

frontend-ng/
├── proxy.conf.json            # MODIFIED: + "/system"
├── nginx.conf                 # MODIFIED: + location /system/
└── src/app/
    ├── app.routes.ts          # MODIFIED: + about (lazy)
    ├── app.routes.spec.ts     # MODIFIED: + /about route assertion
    ├── shared/ui/navbar.ts    # MODIFIED: + About link
    └── features/about/        # NEW: about.ts/.html, about.service.ts, about.models.ts, specs

scripts/windows/nginx.conf.template  # MODIFIED: + location /system/
docker-compose.yml, .env.example     # MODIFIED: APP_VERSION pass-through
```

**Structure Decision**: Existing two-app layout; new backend router/service/model trio
and one new Angular feature folder, per `CLAUDE.md`.

## Complexity Tracking

No violations.
