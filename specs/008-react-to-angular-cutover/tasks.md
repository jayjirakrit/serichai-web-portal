---

description: "Task list for Frontend Cutover to the Angular Portal"
---

# Tasks: Frontend Cutover to the Angular Portal

**Input**: `/specs/008-react-to-angular-cutover/` (spec.md, plan.md, design.md, research.md, quickstart.md, contracts/README.md). Reference inventory, command snippets and rollback matrix: `design.md` §3 and §4.5 (authoritative). Standing conventions: `CLAUDE.md`.

**Tests**: No new tests (FR-016, no behavior change). The existing `*.spec.ts` suites, `pytest`, `docker compose` and the stale-reference grep are the verification gates; each story has a **Check** task.

**Paths**: Repo root is the working dir. After Commit B the Angular app lives in `frontend/`; before it, in `frontend-ng/`. `backend/` is not touched. Supersedes spec 007 T017/T018.

**Commits** (CLAUDE.md): tags `[IMP][FE]` / `[IMP]` / `[IMP][DOC]` / `[DOCS]`, imperative lowercase, **no Co-Authored-By trailer** (overrides harness default). Stage explicit paths only, never `git add -A` (the tree holds unrelated WIP: `CLAUDE.md` edits, deleted docs, `VERCEL_DEPLOYMENT_PLAN.md`, `sample-data/`, the `.xlsm`). Keep A, B, C, D as separate commits; merge without squashing (design.md Q1).

**Ordering constraint**: while `frontend-ng/` exists, `.claude/hooks/guard-paths.mjs` blocks Edit/Write on `frontend/`. Finish Commit B (T004) before editing anything under `frontend/`. Destructive deletes (`Remove-Item -Recurse`, `rm -rf`) are denied for the agent; the human runs T002.

## Phase 1: Setup (preflight)

- [X] T001 Preflight: `git status` shows no unexpected changes in in-scope paths, record `$pre = git rev-parse HEAD` as the rollback anchor, stop `ng serve` / `uvicorn` / docker / Vitest watch / editors holding the folders; baseline gates from `frontend-ng/` (`npm ci`, `npm run lint`, `npm test -- --watch=false`, `npm run build`) and `backend/` (`pytest` if present). Check: all pass; if not, stop (do not migrate a red baseline).
- [X] T002 Clean build artifacts (human runs; see design.md §3 snippet): remove `frontend\node_modules`, `frontend\dist`, `frontend-ng\node_modules`, `frontend-ng\dist`, `frontend-ng\.angular`. Check: those dirs are gone; `git status` unchanged (all are git-ignored).

---

## Phase 2: Foundational (blocks all stories)

- [X] T003 [US1] Commit A: `git rm -r frontend`, remove any untracked leftover (`if (Test-Path frontend) { Remove-Item frontend -Recurse -Force }`), commit `[IMP][FE] remove legacy React frontend`. Check: `test ! -e frontend`.
- [X] T004 [US1] Commit B: `git mv frontend-ng frontend`, commit `[IMP][FE] rename frontend-ng to frontend`. Check: `git diff -M --stat HEAD~1` shows renames only, no content change; `test ! -e frontend-ng`. If EBUSY: close handle holders (`Get-Process node,Code`) and retry; last resort is the copy fallback in research.md §2.

---

## Phase 3: User Story 1 - One single frontend, no legacy leftovers (P1)

**Goal**: exactly one UI app at `frontend/`, no legacy files, pages unchanged.
**Independent test**: repo root lists `frontend/` (Angular) and `backend/`; each page works against the unchanged back end.

- [X] T005 [US1] Verify structure and parity: `test -f frontend/angular.json && test -f frontend/proxy.conf.json && test -f frontend/Dockerfile && test -f frontend/nginx.conf`; `cd frontend && npm ci && npm run lint && npm test -- --watch=false && npm run build`. Check: all exit 0; build output at `frontend/dist/serichai-web-portal/browser`.

---

## Phase 4: User Story 2 - Deployment and installation keep working (P1)

**Goal**: Docker, Windows install, devcontainer and local dev all use `frontend/`.
**Independent test**: `docker compose up --build` serves the portal on `:8080`; Windows scripts resolve the `frontend\dist\...` path.

- [X] T006 [P] [US2] `scripts/windows/_common.ps1:21`: `frontend-ng\dist\serichai-web-portal\browser` -> `frontend\dist\serichai-web-portal\browser` (design.md §4.5 snippet).
- [X] T007 [P] [US2] `scripts/windows/setup.ps1`: line 7 comment `(frontend-ng)` -> `(frontend)`; line 108 `Join-Path $RepoRoot 'frontend-ng'` -> `'frontend'`; confirm the `$dist` join on the next line still resolves.
- [X] T008 [P] [US2] `scripts/windows/start-portal.ps1:18`: `frontend-ng\dist\...` -> `frontend\dist\...`.
- [X] T009 [US2] Verify no-op files, change nothing: `docker-compose.yml` (`context: ./frontend`), `.dockerignore` (`frontend/node_modules`, `frontend/dist`), `.devcontainer/devcontainer.json` (`cd frontend && npm ci`), `.env.example`, `frontend/.dockerignore`. Check: `docker compose config` succeeds and shows `./frontend` context.
- [ ] T010 [US2] Check: `docker compose up --build`, open `http://localhost:8080`, deep-link a feature page, upload a sample file (`sample-data/` or `backend/data`); run `scripts/windows/setup.ps1` on the Windows install host (or review it end to end) and confirm `start-portal.ps1` finds the dist path. Record the "re-run `setup.ps1` after pulling" note for README (T019). Also smoke every page (Home, Login placeholder, Employee Benefits with and without a previous file, Bonus Calculation, Payroll Reconciliation, Elderly Tax Deduction) in idle, error and success states with the sample files, including downloads (SC-003, FR-004).

---

## Phase 5: User Story 3 - Project guidance and tooling describe reality (P2)

**Goal**: every config, hook, skill and instruction file names `frontend/`; none mentions a legacy app.
**Independent test**: follow each path/command in CLAUDE.md and the constitution; all resolve; hooks fire on `frontend/` edits.

- [X] T011 [P] [US3] `.claude/hooks/lint-frontend.mjs` lines 1, 10, 12, 13: `frontend-ng` -> `frontend` (regex `^frontend\/src\/.+\.(ts|html)$`, `cwd` join, `rel.slice('frontend/'.length)`). Check: editing a `frontend/src/**/*.ts` file triggers lint.
- [X] T012 [P] [US3] `.claude/hooks/guard-paths.mjs` lines ~12-21: delete the legacy-freeze block (and remove any import left unused: `fs`, `path`, `projectDir`); keep the `backend/data/*.xls*` rule intact. Check: `node --check` passes and an Edit under `frontend/` is no longer blocked.
- [X] T013 [P] [US3] `.claude/skills/speckit-execution/SKILL.md:100`: `frontend-ng/` -> `frontend/`; `.claude/skills/speckit-plan/SKILL.md:167-168`: reword to "under `frontend/src/app/`" (drop the "or after the spec 007 cutover" clause).
- [X] T014 [P] [US3] `.gitignore`: delete `!frontend/.env.development` (line ~76) and the generic Vite block (`# Vite files`, `vite.config.js.timestamp-*`, `vite.config.ts.timestamp-*`, `.vite/`, lines ~145-148). Check: `git grep -niE "vite" .gitignore` prints nothing.
- [X] T014a [P] [US3] Remove remaining React/TanStack wording outside historical records: `frontend/src/app/core/http/api-call.ts:8` (reword "replaces TanStack `useMutation`" to describe the helper only, e.g. "Signal-based mutation helper for HTTP calls"); `.claude/skills/speckit-specify/SKILL.md:356` ("React components render efficiently" -> "Angular components render efficiently", still a framework-specific bad example). `.specify/memory/constitution.md:242` is handled by T017. Exempt as historical: `specs/**` and the constitution Sync Impact Report entries (lines ~34-39). Comment-only edit, no behavior change.
- [X] T015 [US3] Commit C: stage explicit paths (`scripts/windows/_common.ps1`, `setup.ps1`, `start-portal.ps1`, the two hooks, SKILL.md files, `.gitignore`, `frontend/src/app/core/http/api-call.ts`), commit `[IMP] point scripts, hooks and skills at frontend`. Do not stage `CLAUDE.md` yet.
- [X] T016 [US3] `CLAUDE.md` (layered on its existing uncommitted edits, do not overwrite): lines 9-10 single `frontend/` Angular entry, drop legacy line and T017 note; heading at 17 `frontend/`, delete legacy paragraph at 27; line 50 delete the "Until the spec 007 cutover" sentence; lines 52-54 correct the Windows install description to nginx on one port per `scripts/windows/README.md` and describe `FRONTEND_DIST` as optional/unused by the scripts; lines 83 and 141 `frontend-ng/` -> `frontend/`. Locate each spot by content, not line number (numbers drift because the file has uncommitted edits). Check: every command listed runs as written, and `git grep -niE "frontend-ng|react|vite" CLAUDE.md` prints nothing.
- [X] T017 [US3] Amend `.specify/memory/constitution.md` via `/speckit-constitution`: Technology Standards "Area: frontend -> Path" `frontend-ng/` -> `frontend/`, drop "legacy React app frozen", version 2.4.0 -> 2.4.1 (PATCH) with Sync Impact Report. Wording only.
- [X] T018 [P] [US3] Untracked `VERCEL_DEPLOYMENT_PLAN.md` (owner's WIP; update per design.md Q2): `frontend-ng` x4 -> `frontend` (title, intro, `"root": "frontend/"`, API note) and delete the "exclude legacy `frontend/`" clause at ~line 56. Do not stage it unless the owner asks.

---

## Phase 6: User Story 4 - Root README gives an accurate, current overview (P2)

**Goal**: README explains purpose, features, run/deploy, layout.
**Independent test**: a newcomer reads only README and can start the portal; the feature list matches the app.

- [X] T019 [US4] Rewrite `README.md` (currently 7 lines) per design.md §4.6: purpose/audience (internal, Serichai and Ch.Paisarn, private network, no TLS/auth); Features table verified against `frontend/src/app/app.routes.ts`, `features/home/home.ts` and `backend/routers/accounts.py` (Home `/`, Login placeholder, Employee Benefits incl. carry-forward `POST /accounts/employee-benefits`, Bonus Calculation `POST /accounts/bonus-calculation`, Payroll Reconciliation `/payroll-reconciliation` -> `POST /accounts/payroll-reconcile`, Elderly Tax Deduction `/elderly-tax-deduction` -> `POST /accounts/tax-deduction`; note Thai headers and Buddhist Era years); tech stack; run locally (two processes, link to CLAUDE.md Commands); deploy (Docker `cp .env.example .env && docker compose up` -> `:8080`; Windows `scripts/windows/setup.ps1`, link its README); repository layout; development process (specs 001-008, CLAUDE.md, commit tags); upgrade note (delete old `frontend-ng/` folder, re-run `setup.ps1`). English; no Vercel mention (design.md Q6); link rather than duplicate instructions.
- [X] T020 [US4] Commit D: stage `README.md`, `CLAUDE.md`, `.specify/memory/constitution.md`; commit `[IMP][DOC] update readme and project guidance for single frontend`. Check: `git diff --cached --stat` lists only those files (no `sample-data/`, `.xlsm`, VERCEL plan).

---

## Phase 7: User Story 5 - Analysis and plan (P3) and final verification

**Goal**: the analysis is traceable and the cutover is proven complete.
**Independent test**: design.md inventory rows each have a closed task; gates pass.

- [X] T021 [P] [US5] Annotate `specs/007-angular-frontend-migration/tasks.md` T017 and T018 with one line each: "superseded by 008-react-to-angular-cutover" (design.md Q3); leave all other history untouched.
- [X] T022 [US5] Stale-reference sweep (design.md §4.7): `git grep -nIiE "frontend-ng|react|vite|tanstack" -- . ':!specs' ':!**/package-lock.json'` prints nothing; the same pattern with plain `grep -rniE` over `.claude .specify/memory scripts .devcontainer` (git grep skips untracked dirs) prints nothing except the exempt constitution Sync Impact Report lines; `grep -n "frontend-ng" VERCEL_DEPLOYMENT_PLAN.md` prints nothing; `test -f frontend/angular.json && test ! -e frontend-ng`. The only allowed hits are the `frontend-ng/` mentions in the intentional "Upgrading from the old layout" section of `README.md` and the exempt constitution Sync Impact Report lines.
- [ ] T023 [US5] Run the `quickstart.md` scenarios on a clean checkout (or fresh clone): README commands (SC-005), `frontend/` lint/test/build (SC-007), `pytest`, `docker compose up --build`; local two-process workflow (FR-008): `uvicorn main:app --reload` in `backend/`, `npm start` in `frontend/`, then one `/accounts/*` call through `http://localhost:4200`; one reviewer reads only the README and lists purpose and features (SC-006). Check: all pass; record results in the PR/commit notes.

---

## Dependencies & Execution Order

- T001 -> T002 -> T003 -> T004 (Commit A before B; both before any edit under `frontend/`) -> T005.
- After T004: US2 edits T006-T008 [P], US3 edits T011-T014/T014a [P] and T018 are independent files and can run in parallel; T015 (Commit C) waits for them.
- T009 and T010 (US2 checks) need T006-T008 and T005; T010's Windows part needs the install host.
- T016 and T017 (guidance) are independent of C; T019 needs T010's notes and a working `frontend/` tree; T020 (Commit D) needs T016, T017, T019.
- T021 anytime after T004; T022 and T023 are last.
- Rollback (design.md §3): before push `git reset --hard $pre` then `npm ci` in `frontend-ng/`; after push `git revert D C B A` in reverse order.

## Parallel example

After T004: run T006, T007, T008, T011, T012, T013, T014, T014a, T018 together (different files), then T015.

## Implementation Strategy

MVP = Phases 1-3 (T001-T005): one frontend at `frontend/` with a green build. Do not stop there: US2 is also P1, because the Windows scripts and anything else still naming `frontend-ng` are broken until T006-T008 land. Then US3 and US4 (P2), then final verification. Each commit leaves the tree buildable except between B and C, where only the Windows scripts and hooks are stale; do not push between B and C.
