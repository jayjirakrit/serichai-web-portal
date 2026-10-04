---

description: "Task list for 008-system-info-page"
---

# Tasks: System Info "About" Page

**Input**: Design documents from `/specs/008-system-info-page/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/system-api.md, design.md

**Tests**: Included per Constitution IV (tests required for backend logic and critical
frontend flows). Tests live in the same task as the code they verify (Constitution I:
no separate "write test" tasks).

**Organization**: Tasks are grouped by user story. Frontend paths are under
`frontend-ng/src/app/` unless stated. Snippets for each task are in `design.md` §4.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2)

---

## Phase 1: Setup (Shared Infrastructure)

Not needed — both apps, `CamelModel`, `apiCall`, `ResultPanel` and `Layout` already exist.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Make `/system/*` reachable from the browser in every gateway (research.md #1).

- [X] T001 [P] Add a `/system` forwarding rule mirroring `/accounts` in `frontend-ng/proxy.conf.json`, `frontend-ng/nginx.conf` (`location /system/` → `http://backend:8000/system/`) and `scripts/windows/nginx.conf.template` (`location /system/` → `http://127.0.0.1:__BACKEND_PORT__`); leave `frontend/nginx.conf` untouched. **Verify**: files parse (`node -e "JSON.parse(require('fs').readFileSync('frontend-ng/proxy.conf.json'))"`); after T002, `curl http://localhost:4200/system/info` with `npm start` running returns the backend body.

**Checkpoint**: Gateways forward `/system/*`; story work can proceed.

---

## Phase 3: User Story 1 - View system information (Priority: P1) 🎯 MVP

**Goal**: The About page, reachable from the navbar and by direct URL, shows app name, version, server time and status in one card.

**Independent Test**: quickstart.md Scenarios 1 and 2.

- [X] T002 [P] [US1] Implement `GET /system/info` per `contracts/system-api.md` and design.md §4.1: `SystemInfo(CamelModel)` in `backend/models/system.py`; `AppIdentity`, `get_app_identity()` (env `APP_NAME`/`APP_VERSION`, defaults `"Serichai Web Portal"`/`"dev"`) and `get_system_info(identity, now=None)` in `backend/services/system_service.py`; thin router in `backend/routers/system.py` using `Depends(get_app_identity)`; re-export `system_router` in `backend/routers/__init__.py`; `app.include_router(system_router)` after `accounts_router` and `"system"` added to `_api_prefixes` in `backend/main.py`. Add `backend/tests/test_system_info.py` covering defaults/env override, `serverTime` numeric offset (`+00:00` for injected UTC `now`, never `Z`), `status == "ok"`, and `TestClient GET /system/info` → 200 with exactly the four camelCase keys and `dependency_overrides` values echoed. **Verify**: `pytest` from `backend/` passes.
- [X] T003 [P] [US1] Create the About feature per design.md §4.3: `features/about/about.models.ts` (`SystemInfo`), `features/about/about.service.ts` (`AboutService.getSystemInfo()` → `GET ${API_BASE_URL}/system/info`), `features/about/about.ts` (`About` component, `apiCall` + `run()` in constructor) and `features/about/about.html` (card inside `app-result-panel`, four labelled values, `serverTime` verbatim); add `features/about/about.service.spec.ts` (`HttpTestingController` asserts URL + `GET`) and `features/about/about.spec.ts` (flushing a 200 renders the four labels/values). **Verify**: `npm test -- --watch=false` in `frontend-ng/` passes.
- [X] T004 [US1] Wire navigation (depends on T003): lazy `about` route above the `**` wildcard in `app.routes.ts` with an assertion in `app.routes.spec.ts` that `/about` resolves to `About`; add the `About` `routerLink="/about"` link in `shared/ui/navbar.ts` with an assertion in `shared/ui/layout.spec.ts` that `a[href="/about"]` renders and the existing `a[href="/"]` assertion still passes. **Verify**: `npm run build && npm run lint && npm test -- --watch=false` in `frontend-ng/` pass; quickstart Scenario 2.

**Checkpoint**: User Story 1 is fully functional and testable independently (MVP).

---

## Phase 4: User Story 2 - Understand loading and failure (Priority: P2)

**Goal**: Loading indicator while fetching; readable error and no values on failure; nothing leaks after leaving early.

**Independent Test**: quickstart.md Scenario 3.

- [X] T005 [US2] Extend `features/about/about.spec.ts` (depends on T003): on create the spinner (`[role=status]`) shows with no `<dl>`; flushing a 502 renders `[role=alert]` containing "Request failed with status 502" and no `<dl>`; destroying the fixture before flush issues no further rendering/error. Adjust `features/about/about.html` only if a check fails (e.g. `pendingText`). **Verify**: `npm test -- --watch=false` in `frontend-ng/` passes; quickstart Scenario 3 (stop uvicorn → error alert, no endless spinner).

**Checkpoint**: User Stories 1 and 2 both work independently.

---

## Phase 5: Polish & Cross-Cutting Concerns

- [X] T006 [P] Pass `APP_VERSION: ${APP_VERSION:-dev}` to the backend service in `docker-compose.yml` and document `APP_VERSION` (with its `dev` default) in `.env.example` (research.md #2, SC-004). **Verify**: `docker compose config` shows `APP_VERSION` under the backend service.
- [X] T007 Run the quickstart end to end (depends on T001–T006): Scenarios 1–3 locally; record Scenario 4 (Docker/Windows) as not runnable until spec 007 T017 / a Windows re-install, if so. **Verify**: quickstart.md expected outcomes observed; `pytest`, `npm run build`, `npm run lint`, `npm test -- --watch=false` all pass.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 2)**: T001 — needed for browser → backend calls in dev; does not block writing code or unit tests.
- **US1 (Phase 3)**: T002 and T003 are independent (different apps); T004 needs T003.
- **US2 (Phase 4)**: T005 needs T003 (same component/spec file).
- **Polish (Phase 5)**: T006 independent; T007 last.

### User Story Dependencies

- **US1 (P1)**: none beyond Phase 2.
- **US2 (P2)**: builds on the US1 page (states are rendered by the same template), still independently testable via its own spec assertions.

### Parallel Opportunities

- T001, T002, T003, T006 touch disjoint files and can run in parallel.

## Parallel Example: User Story 1

```text
backend-engineer:  T002 (backend/ router + service + model + pytest)
frontend-engineer: T003 (features/about/*), then T004 (routes + navbar)
```

## Implementation Strategy

### MVP First (User Story 1 Only)

1. T001 → T002 ∥ T003 → T004
2. **STOP and VALIDATE**: quickstart Scenarios 1–2.

### Incremental Delivery

1. MVP (US1) → 2. T005 (US2 states) → 3. T006 + T007 polish and full quickstart.
