# Design: Frontend Cutover to the Angular Portal

Spec: `spec.md` · Plan: `plan.md` · Contracts: `contracts/README.md` (not applicable)

## 1. Approach

Planned (not yet built). Retire the React app, make the Angular app the only `frontend/`, and fix the handful of files that hard-code the old name. Backend, API, templates and Docker/devcontainer logic are untouched.

- The move is mechanical: `git rm -r frontend` then `git mv frontend-ng frontend` in separate commits so git records a clean rename and Angular history follows.
- Most "dependent files" are already correct by accident: `docker-compose.yml` (`context: ./frontend`) and `.devcontainer/devcontainer.json` (`cd frontend && npm ci`) point at the new name and today build/install the **legacy React** app. After the swap they build Angular with zero edits.
- Real edits: 3 PowerShell files, 2 Claude hooks (one becomes a deletion of dead code), 2 skill lines, CLAUDE.md, constitution Technology Standards, one `.gitignore` line, README rewrite, plus an untracked VERCEL plan.
- The risk lives in the operations: Windows folder locks on `node_modules`, an already-installed Windows host whose `dist` path moves, and unrelated uncommitted work in the tree.

## 2. Key decisions

| Decision | Choice | Why / trade-off |
|----------|--------|-----------------|
| Commit shape | Commit A `[IMP][FE]` `git rm -r frontend`; commit B `[IMP][FE]` `git mv frontend-ng frontend`; commit C `[IMP]` fixups; commit D `[DOCS]`/`[IMP][DOC]` README + CLAUDE.md + constitution | Same-path files (`Dockerfile`, `nginx.conf`, `package.json`...) would show as "modified" in one commit and break `git log --follow`. Four small commits stay "one reviewable change set" on a single branch. |
| Artifact cleanup | Delete `node_modules`, `dist`, `.angular` of both folders before the move | Avoids EBUSY/path-length failures on Windows; `npm ci` is a gate anyway. |
| Staging | Explicit paths, never `git add -A` | Working tree has unrelated WIP (`CLAUDE.md`, deleted docs, VERCEL plan, `sample-data/`, `.xlsm`). |
| guard-paths hook | Delete the legacy-freeze block, keep the `backend/data` Excel rule | Block self-disables after the move, so keeping it is dead code. |
| lint-frontend hook | Replace `frontend-ng` with `frontend` (2 constants) | Otherwise edit-time lint silently stops. |
| Constitution | PATCH 2.4.0 -> 2.4.1, Technology Standards frontend Path only | Wording-only; no principle changes. |
| Backend `FRONTEND_DIST` | Leave code; fix CLAUDE.md prose | FR-016. CLAUDE.md says uvicorn serves the bundle, but scripts use nginx; `FRONTEND_DIST` is set by nothing in `scripts/`. |
| README | Overview + links to CLAUDE.md / `scripts/windows/README.md` | Spec: no duplicated long instructions; Principle V. |
| Windows hosts | Required re-run of `setup.ps1` after pulling | `dist` moves to `frontend\dist\...`; `start-portal.ps1` throws "Missing ... run setup.ps1" otherwise. Safe (idempotent). |

## 3. Flow

Ordered cutover sequence (each step has a check; stop on first failure; D-steps are dependency-ordered):

```text
0 Preflight   git status clean for in-scope paths; record pre-SHA; stop ng serve/uvicorn/docker/editors;
              baseline gates in frontend-ng (npm ci, lint, test, build) + pytest      -> pass
1 Clean       PowerShell: Remove-Item -Recurse -Force frontend\node_modules, frontend\dist,
              frontend-ng\node_modules, frontend-ng\dist, frontend-ng\.angular        -> dirs gone
2 Commit A    git rm -r frontend ; (leftover untracked dir removed) ; test ! -e frontend
3 Commit B    git mv frontend-ng frontend ; git status -M shows renames, 0 adds of content
4 Commit C    edits per inventory §4.5 (scripts, hooks, skills, .gitignore, compose/devcontainer verified no-op)
5 Gates       cd frontend ; npm ci ; npm run lint ; npm test -- --watch=false ; npm run build
              backend pytest ; docker compose config ; docker compose up --build (smoke)
              scripts\windows dry review (+ setup.ps1 on the install host)
6 Commit D    README.md rewrite, CLAUDE.md, constitution 2.4.1 (/speckit-constitution), VERCEL plan paths
7 Sweep       stale-reference grep (§4.5) -> 0 outside specs/
8 Annotate    spec 007 T017/T018 marked superseded (see Open question 3)
Rollback      before push: git reset --hard <pre-SHA>; after push: git revert D C B A (reverse order);
              restore deps with npm ci in the folder that returns; Windows host: pull + setup.ps1
```

Concrete commands for steps 1-3 and the sweep (PowerShell; the human runs the deletes because `rm -rf` is denied for the agent):

```powershell
$pre = git rev-parse HEAD                      # rollback anchor
Get-Process node,Code -ErrorAction SilentlyContinue | Select Name,Id   # handle holders
foreach ($d in 'frontend\node_modules','frontend\dist','frontend-ng\node_modules','frontend-ng\dist','frontend-ng\.angular') {
  if (Test-Path $d) { Remove-Item $d -Recurse -Force }
}
git rm -r frontend
if (Test-Path frontend) { Remove-Item frontend -Recurse -Force }   # untracked leftovers
git commit -m "[IMP][FE] remove legacy React frontend"
git mv frontend-ng frontend
git commit -m "[IMP][FE] rename frontend-ng to frontend"
git diff -M --stat HEAD~1 | Select -Last 3     # expect renames, no content change
```

Why two gates matter for operators: `docker compose build` proves the gateway image builds from `frontend/` (output path `dist/serichai-web-portal/browser` is copied by the Dockerfile), and `setup.ps1` proves the Windows scripts find the same output path. The `angular.json` output path and `package.json` name do not change, so the two scripts and Dockerfile need only the folder name.

Rollback matrix:

| State | Action |
|-------|--------|
| Uncommitted / local commits only | `git reset --hard $pre`; `cd frontend-ng; npm ci` |
| Pushed, not deployed | `git revert D C B A` (reverse order) |
| Deployed (Docker) | redeploy previous image/commit; compose context returns to React `frontend/` |
| Deployed (Windows) | `git pull` the revert, re-run `setup.ps1` (rebuilds `frontend-ng\dist`) |

Failure paths: step 3 EBUSY -> close handle holders (`Get-Process node,Code`), retry; if still locked use the copy fallback in research §2. Step 5 failure -> do not proceed to D; fix in C or roll back.

## 4. Key files

Requirement groups -> files:

| Requirements | Key files |
|--------------|-----------|
| FR-001..004 | `frontend/` (deleted), `frontend-ng/` -> `frontend/` (git mv) |
| FR-005 | `frontend/Dockerfile`, `frontend/nginx.conf`, `docker-compose.yml` (verify only) |
| FR-006 | `scripts/windows/_common.ps1`, `setup.ps1`, `start-portal.ps1` |
| FR-007, FR-008 | `.devcontainer/devcontainer.json` (verify only), `frontend/proxy.conf.json` (verify only) |
| FR-009, FR-010 | `CLAUDE.md`, `.specify/memory/constitution.md`, `.claude/hooks/*`, `.claude/skills/*`, `.gitignore` |
| FR-011..014 | `README.md` |
| FR-015..017 | gates in §3; this design |

### 4.1 Backend — Not applicable

No backend file changes. `backend/main.py` CORS default (`http://localhost:4200`), `FRONTEND_DIST` hook and routers stay as is.

### 4.2 Core / shared building blocks — Not applicable

No source change under `frontend/src/`. Optional comment-only cleanups (`core/auth/login.ts:4` "matches the React page", `core/http/api-call.ts:8` "replaces TanStack") are Open question 4; default is leave.

### 4.3 Features / pages — Not applicable

All five pages move unchanged (home, employee-benefits, bonus-calculation, payroll-reconcile, elderly-tax-deduction) plus the login stub in `core/auth/`. Parity is asserted by the existing `*.spec.ts` suites run from `frontend/`.

### 4.4 Algorithms / business rules — Not applicable

### 4.5 Routing, config & infra (where the decisions live)

#### Reference inventory (searched with `git grep`, excluding `node_modules`, `dist`, `.git`, `specs/` history, lockfiles; hidden dirs included)

| File | Current reference | Required change |
|------|-------------------|-----------------|
| `frontend/**` (17 tracked non-src files + `src/`) | legacy React app | `git rm -r` (Commit A) |
| `frontend/node_modules`, `frontend/dist` | ignored, untracked | delete from disk only |
| `frontend-ng/**` | Angular app | `git mv` to `frontend/` (Commit B); `node_modules`/`dist`/`.angular` deleted first |
| `frontend-ng/Dockerfile`, `nginx.conf`, `.dockerignore` | no self-reference (nginx comment generic) | none; move with folder |
| `docker-compose.yml:22` | `context: ./frontend` | none (becomes correct); verify `docker compose config` |
| `.dockerignore:7-8` | `frontend/node_modules`, `frontend/dist` | none (becomes correct) |
| `.env.example` | no frontend path | none |
| `.devcontainer/devcontainer.json` | `postCreateCommand: cd frontend && npm ci ...` | none (today installs React deps; becomes correct) |
| `.devcontainer/Dockerfile` | `node:24-bookworm`, no path | none |
| `.github/` | does not exist | none |
| `scripts/windows/_common.ps1:21` | `frontend-ng\dist\serichai-web-portal\browser` | `frontend\dist\...` |
| `scripts/windows/setup.ps1:7` | comment "(frontend-ng)" | "(frontend)" |
| `scripts/windows/setup.ps1:108` | `Join-Path $RepoRoot 'frontend-ng'` | `'frontend'` |
| `scripts/windows/start-portal.ps1:18` | `frontend-ng\dist\...` | `frontend\dist\...` |
| `scripts/windows/README.md`, `nginx.conf.template` | no path (says "built Angular app") | none |
| `scripts/windows/nginx/conf/portal.conf` | generated, gitignored, holds absolute `frontend-ng` path | none in git; regenerated at each start from `_common.ps1` |
| `.claude/hooks/guard-paths.mjs:12-21` | legacy-freeze rule keyed on `frontend-ng` existing | delete block (and now-unused `fs`/`path` imports if unused) |
| `.claude/hooks/lint-frontend.mjs:1,10,12,13` | `frontend-ng` regex, cwd, slice | `frontend` |
| `.claude/hooks/compact-context.mjs` | none | none |
| `.claude/settings.json` | hook wiring, no path | none |
| `.claude/skills/speckit-execution/SKILL.md:100` | `[ADD][FE] ... for \`frontend-ng/\`` | `frontend/` |
| `.claude/skills/speckit-plan/SKILL.md:167-168` | "under `frontend-ng/src/app/`, or `frontend/src/app/` after the spec 007 cutover" | "under `frontend/src/app/`" |
| `.claude/agents/*.md` | stack-neutral, no `frontend-ng`/React | none (verified) |
| `.specify/workflows/*/workflow.yml`, `templates/*` | only generic `frontend` words | none |
| `.specify/memory/constitution.md` ~241-242 | Path `frontend-ng/` ... legacy React frozen | `frontend/`, drop legacy sentence; v2.4.1 + Sync Impact Report |
| `CLAUDE.md:9-10` | two-app list, T017 note | single `frontend/` Angular entry; drop legacy line |
| `CLAUDE.md:17,27` | heading `frontend-ng/`; legacy-app paragraph | heading `frontend/`; delete paragraph |
| `CLAUDE.md:50` | "compose still builds React from ./frontend; Angular in frontend-ng/" | delete the "Until the spec 007 cutover" sentence |
| `CLAUDE.md:52-54` (Windows install) | says uvicorn + `FRONTEND_DIST` serves bundle | correct to nginx on one port (see `scripts/windows/README.md`); `FRONTEND_DIST` described as optional/unused by scripts |
| `CLAUDE.md:83,141` | `frontend-ng/src/app/`, `frontend-ng/proxy.conf.json` | `frontend/...` |
| `CLAUDE.md:128` | `[FE]` tag = `frontend/` | none (now accurate) |
| `.gitignore:76` | `!frontend/.env.development` (legacy file) | remove line |
| `.gitignore:145-148` | generic Vite boilerplate | leave unless Open question 5 says remove |
| `README.md` | 7 lines | full rewrite (§4.6) |
| `backend/main.py`, `backend/README.md`, `backend/Dockerfile` | no frontend path (comment says Angular) | none |
| `docs/` | `docs/diagrams/*.excalidraw` deleted in WT, no refs | none |
| `VERCEL_DEPLOYMENT_PLAN.md` (untracked) | `frontend-ng` x4 (title, intro, `"root": "frontend-ng/"`, API note); line 56 "exclude legacy `frontend/`" | rename to `frontend/`; delete legacy-exclude clause. Open question 2 |
| `frontend/README.md` (from Angular) | CLI boilerplate | optional: add a pointer to root README/CLAUDE.md (no required change) |
| `specs/001..007/**` | historical mentions | exempt; only 007 `tasks.md` T017/T018 annotated (Open question 3) |
| `ANGULAR_MIGRATION_PLAN.md` | deleted in WT | historical, leave deleted |
| `sample-data/`, `Chopaisarn_Bonus_Macro_V3.xlsm` | untracked, no refs | never staged by this feature |

Working-tree and ignore notes: `frontend/node_modules`, `frontend/dist`, `frontend-ng/dist`, `frontend-ng/node_modules` are git-ignored (never tracked), so only disk cleanup is needed. `git check-ignore` of `scripts/windows/nginx/` also confirms nginx runtime files are not tracked.

Key edits as code (only these carry a decision):

```powershell
# scripts/windows/_common.ps1:21  (start-portal.ps1:18 identical shape)
$script:DistDir = Join-Path $script:RepoRoot 'frontend\dist\serichai-web-portal\browser'

# scripts/windows/setup.ps1:108-109
$frontend = Join-Path $RepoRoot 'frontend'
$dist = Join-Path $frontend 'dist\serichai-web-portal\browser'
```

```js
// .claude/hooks/lint-frontend.mjs
if (!rel || !/^frontend\/src\/.+\.(ts|html)$/i.test(rel)) process.exit(0);
const cwd = path.join(projectDir(input), 'frontend');
const file = rel.slice('frontend/'.length);
```

```js
// .claude/hooks/guard-paths.mjs  after: legacy-freeze block removed, backend/data rule kept
if (lower.startsWith('backend/data/') && /\.xls[xm]?$/.test(lower)) { /* unchanged block */ }
// remove: import fs, import path (if now unused), angularNotYetRenamed + the frontend/ block
```

```text
.gitignore   -  !frontend/.env.development
```

Note: while `frontend-ng/` still exists, `guard-paths` blocks Edit/Write on `frontend/`; Bash `git rm`/`git mv` are not hooked. Order matters: Commit B before editing any file under `frontend/`.

**Check**: `git grep -nIiE "frontend-ng|\breact\b|\bvite\b|tanstack" -- . ':!specs' ':!**/package-lock.json'` returns nothing except items the owner chose to keep (`.gitignore` Vite block, optional code comments).

**Specs must assert** (existing suites, run from `frontend/`): `core/http/api-call.spec.ts` (error text, cancel), each `*.service.spec.ts` (URL + exact field names, so wire format unchanged), each component smoke spec, `shared/ui/*.spec.ts`. No new specs are added (FR-016).

### 4.6 README.md outline (verified against `app.routes.ts`, `home.ts`, `routers/accounts.py`)

```markdown
# Serichai Web Portal
One paragraph: internal tool for Serichai and Ch.Paisarn; accountants upload Excel
workbooks and get calculated results and downloadable reports. Private network, no TLS/auth.

## Features
| Page (route) | What it does | Backend endpoint |
| Home (/) | landing page with cards to each tool | - |
| Login (/login) | placeholder only; no authentication yet | - |
| Employee Benefits (/employee-benefits) | calculates benefits from master data; optional previous-benefits file carries forward; summary, exceptions, 2 downloads | POST /accounts/employee-benefits |
| Bonus Calculation (/bonus-calculation) | current-year file, optional previous-year summary, year; summary, flagged employees, bonus report download | POST /accounts/bonus-calculation |
| Payroll Reconciliation (/payroll-reconciliation) | reconciles a payroll workbook for a period | POST /accounts/payroll-reconcile |
| Elderly Tax Deduction (/elderly-tax-deduction) | tax deduction from a roster workbook, optional reference date; template in public/ | POST /accounts/tax-deduction |
Thai-language headers and Buddhist Era years are used in the Excel data.

## Tech stack        Angular 22 + Tailwind v4/DaisyUI | FastAPI, Python 3.13 | nginx, Docker
## Run locally       2 processes: uvicorn (backend/), npm start (frontend/); link CLAUDE.md Commands
## Deploy            Docker: cp .env.example .env ; docker compose up -> :8080
                     Windows native: scripts/windows/setup.ps1 (link its README)
## Repository layout frontend/ backend/ specs/ scripts/windows/ docs/ .specify/ .claude/ docker-compose.yml
## Development process  Spec-Kit specs under specs/ (list 001-008 in one line), CLAUDE.md conventions,
                     commit tags
## Notes             Upgrading after the 008 cutover: delete old frontend-ng/ + node_modules, re-run setup.ps1
```

Note: authored feature list must come from the files above at write time; the six commands in the README are executed once on a clean checkout (SC-005).

### 4.7 Zero-stale-reference gate (definition)

```bash
# must print nothing (allow-list noted in Open questions 4-5)
git grep -nIiE "frontend-ng|react|vite|tanstack" -- . ':!specs' ':!**/package-lock.json'
# untracked WIP is not covered by git grep; check explicitly
grep -n "frontend-ng" VERCEL_DEPLOYMENT_PLAN.md
# every path the docs mention must exist
test -f frontend/angular.json && test -f frontend/proxy.conf.json && test ! -e frontend-ng
```

Historical exemptions: `specs/**` and git history only. `node_modules`/`dist` are not scanned (ignored, regenerated).

## 5. Data & contracts touched

None. `contracts/README.md` records N/A; existing contracts in specs 001-007 govern `POST /accounts/*`. `data-model.md` is N/A.

## 6. Risks, gaps & mismatches

- **Windows path locks**: renaming/deleting a folder containing `node_modules` fails with open handles (`ng serve`, VS Code TS server, Defender, indexer, Vitest watch). Mitigate with step 1 and the copy fallback (research §2). Long paths: enable `git config core.longpaths true` if `npm ci` paths approach 260 characters.
- **Same-path collision**: committing delete + rename together hides history; mitigated by separate commits.
- **Installed Windows host**: after pull, `frontend\dist` does not exist until `setup.ps1` re-runs; the scheduled task would fail at boot with "Missing ... run setup.ps1". Document in README/quickstart; re-run is idempotent. Stale `frontend-ng/` leftovers (ignored `node_modules`, `dist`) remain on developer disks after pulling because git does not delete ignored files; tell developers to delete the folder.
- **Silent no-op hooks**: if `lint-frontend.mjs` is missed, lint-on-edit stops without error; covered by the grep gate and a manual edit test.
- **Docker context**: `docker compose build` uses `./frontend`; stale `frontend/dist` or `node_modules` from React would be copied only if `.dockerignore` lacked them; `frontend/.dockerignore` (from Angular) excludes `node_modules`, `dist`, `.angular`. Verified by build.
- **Doc drift found**: CLAUDE.md Windows description (uvicorn/`FRONTEND_DIST`) contradicts the nginx-based scripts; `backend/main.py` still contains the `FRONTEND_DIST` path unused by scripts. Fix prose only.
- **Working tree**: `CLAUDE.md` has uncommitted edits; the cutover edits must be layered on them, not overwrite. `VERCEL_DEPLOYMENT_PLAN.md` is untracked WIP of the owner.
- **Spec 007 contracts** cite `frontend/src/app/...` and names like `benefits.service.ts` (as-built: `employee-benefits.service.ts`): historical drift, not touched.
- **Constitution Principle VI**: no refactors piggyback; feature-name asymmetries (`payroll-reconciliation` route vs `payroll-reconcile` endpoint, `elderly-tax-deduction` vs `/accounts/tax-deduction`) are documented in README only, not renamed.

## 7. Open questions

1. Commit granularity: keep the four commits (A delete, B rename, C fixups, D docs) on the cutover branch, or squash on merge (loses rename detection only if squashed into one commit with same-path files, so merge-commit or rebase-merge is preferred)?
2. `VERCEL_DEPLOYMENT_PLAN.md` is untracked WIP that names `frontend-ng/`. Update its paths as part of this feature (proposed), or leave it for its owner?
3. Annotate spec 007 `tasks.md` T017/T018 as `[X] superseded by 008` (one line each, proposed), or leave history untouched and rely on 008's Assumptions?
4. RESOLVED (user): remove all React/TanStack wording. Only `core/http/api-call.ts:8` still has it (`login.ts` no longer does); reworded in T014a.
5. RESOLVED (user): remove the Vite block in `.gitignore` (T014); the grep gate has no allow-list.
6. Should the README include the Vercel deployment option? Proposed: no, it is unmerged WIP and is not a supported deployment today.
