# Quickstart: verifying the cutover

Run from the repo root in Git Bash/PowerShell after the cutover commits. Setup of the move itself is in `design.md` §3.

## 0. Pre-flight (before the move)
1. Stop `ng serve`, `uvicorn`, Docker stacks; close editors on the repo (path locks).
2. Commit or stash unrelated WIP (`CLAUDE.md` edits, deleted docs, `VERCEL_DEPLOYMENT_PLAN.md`). Baseline: `cd frontend-ng && npm ci && npm run lint && npm test -- --watch=false && npm run build`, `cd ../backend && .venv/Scripts/python -m pytest` (record results; same results are expected afterwards).

## 1. Structure (SC-001)
```
ls                      # exactly: backend frontend ... ; no frontend-ng
ls frontend             # angular.json package.json src public Dockerfile nginx.conf ... ; no vite.config.ts, tailwind.config.js, index.html
git status -M           # frontend-ng/* shown as renames to frontend/*
```

## 2. Front-end gates (SC-007)
```
cd frontend && npm ci && npm run lint && npm test -- --watch=false && npm run build
test -f dist/serichai-web-portal/browser/index.html
cd ../backend && .venv/Scripts/python -m pytest
```

## 3. Stale-reference sweep (SC-002)
```
git grep -nIiE "frontend-ng|\breact\b|\bvite\b|tanstack" -- . ':!specs' ':!**/package-lock.json'
```
Expected: no hits (allowed exceptions listed in design.md §4.5 if the owner keeps them). Then check path-bearing commands resolve: `git grep -nI "frontend/" -- CLAUDE.md README.md scripts .claude .devcontainer`.

## 4. Local two-process dev (FR-008)
`uvicorn main:app --reload` in `backend/`; `npm start` in `frontend/`; open http://localhost:4200, upload a file from `sample-data/` on each feature page.

## 5. Container (SC-004, FR-005)
```
cp .env.example .env   # first time
docker compose config
docker compose up --build
```
Open http://localhost:8080, deep-link to http://localhost:8080/elderly-tax-deduction (SPA fallback), upload a sample workbook (> 1 MB passes; limit 20 MB).

## 6. Windows install (FR-006)
Elevated PowerShell: `scripts\windows\setup.ps1` (re-run is safe on an already-installed machine; required after pull because `dist` moved). Then http://localhost:8080 and `Get-ScheduledTask SerichaiWebPortal`. If `-SkipBuild` is used, `frontend\dist\serichai-web-portal\browser\index.html` must already exist.

## 7. Parity (FR-004, SC-003)
For each page (Home, Login, Employee Benefits with and without previous file, Bonus Calculation, Payroll Reconciliation, Elderly Tax Deduction): idle, pending, error (no file), success + download behave as before; compare with a pre-cutover run of `frontend-ng` if desired.

## 8. Dev container (FR-007)
Reopen in container; `postCreateCommand` finishes without error; `npm start` and `uvicorn` work.

## 9. README (SC-005, SC-006)
Execute every command in `README.md` once on a clean checkout; confirm the feature list matches `frontend/src/app/app.routes.ts`.

## Rollback
Before pushing: `git reset --hard <pre-cutover SHA>` (or `git revert` the cutover commits if pushed); restore `node_modules` with `npm ci` in `frontend-ng/`. Windows hosts: `git pull` the revert and re-run `setup.ps1`.
