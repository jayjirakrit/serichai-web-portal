# Quality Report: 008 react-to-angular cutover

**Verdict: PASS WITH NOTES** (no failing gate; T010 and T023 live checks remain for a human)

## Acceptance criteria

| ID | Result | Evidence |
|----|--------|----------|
| FR-001/002/003 | met | Top level has only `frontend/`; no `frontend-ng`; React tooling removed (git diff c634629) |
| FR-004/016 | met | `git diff c634629 -- backend` empty; routes in `frontend/src/app/app.routes.ts` unchanged |
| FR-005 | partial | `docker-compose.yml:22` context `./frontend`, `.dockerignore` updated; `docker compose up --build` NOT run (T010 open) |
| FR-006 | met (static) | `scripts/windows/_common.ps1`, `setup.ps1`, `start-portal.ps1` use `frontend\dist\serichai-web-portal\browser`, consistent with `angular.json` output; setup.ps1 not executed |
| FR-007 | met | `.devcontainer/devcontainer.json:18` `cd frontend && npm ci ...` |
| FR-008 | met | `frontend/proxy.conf.json` present; engineer proxy check 200/405 |
| FR-009 | met | CLAUDE.md, README, scripts, ignored hooks/skills/constitution updated; no stale hits in `.claude`, `.devcontainer`, compose |
| FR-010 | partial | Literal design §4.7 grep not empty, see Findings (all explainable) |
| FR-011-014 | met | README features table matches `app.routes.ts` routes and `backend/routers/accounts.py` endpoints (employee-benefits, bonus-calculation, payroll-reconcile, tax-deduction); home cards agree; layout section accurate |
| FR-015, SC-007 | met | see Gates |
| FR-017 | met | plan.md, design.md, research.md, quickstart.md present |
| SC-001/002 | met with note | see Findings |
| SC-003/004/005/006 | not verified | need human run (T010, T023) |

## Gates

- frontend `npm run lint` -> pass
- frontend `npm test -- --watch=false` -> pass (38/38)
- frontend `npm run build` -> pass
- backend `pytest -q` -> pass (73/73)
- design §4.7 path tests (`frontend/angular.json`, `proxy.conf.json`, no `frontend-ng`) -> pass
- design §4.7 literal grep (tracked) -> hits, see Findings
- `grep frontend-ng VERCEL_DEPLOYMENT_PLAN.md` (untracked) -> no hits
- docker compose up --build, scripts/windows/setup.ps1 -> not run (Docker/Windows host unavailable)

## Findings

Critical/major: none.

Minor
- `README.md:68,70` · docs · intentional "Upgrading from the old layout" section names `frontend-ng` and "React"; contradicts FR-010/SC-002 "0 hits outside historical records" and the gate's "no allow-list". Fix: either record this as an accepted exemption in spec/design §4.7, or reword to "the old temporary folder".
- `.gitignore:105-109` · root · generic `vitepress` ignore entries match the gate regex `vite`. Not Vite tooling; remove them (unused) or tighten the regex.
- `CLAUDE.md:23,88`, `frontend/README.md:41`, `frontend/package.json:39`, `tsconfig.spec.json:7` · "Vitest" matches the `vite` substring; false positives. Tighten the gate regex to `\bvite\b|vite\.config`.
- `.specify/memory/constitution.md` (gitignored, local) · version-history lines mention React/Vite/TanStack/`frontend-ng`; acceptable as changelog but not covered by the git gate and not committed.
- Security: no new inputs, dependencies, secrets or config changes; CORS/nginx/upload limits untouched; scripts changes are path-only. No issues.
- Hygiene: untracked `Chopaisarn_Bonus_Macro_V3.xlsm`, `sample-data/` and `VERCEL_DEPLOYMENT_PLAN.md` are outside this feature; make sure they are not swept into the cutover commits.

## Open for a human
T010 (docker compose up --build, deep link, upload, Windows setup.ps1 and page smoke) and T023 (quickstart on a clean checkout, README read-through for SC-006).
