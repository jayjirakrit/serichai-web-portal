# Quality Report: 008 System Info "About" Page

**Verdict**: PASS WITH NOTES

Scope: diff vs `c634629` limited to feature files (pre-existing user changes to `CLAUDE.md`,
`ANGULAR_MIGRATION_PLAN.md`, `Chopaisarn_Bonus_Macro_V3.xlsm`, `VERCEL_DEPLOYMENT_PLAN.md`,
`sample-data/` excluded). Paths below are under `frontend-ng/src/app/` unless they start with `backend/` or `frontend-ng/`.

## Acceptance criteria

| ID | Status | Evidence |
|----|--------|----------|
| FR-001 | met | `backend/services/system_service.py:23-31`; live `GET /system/info` → 200 with all four fields |
| FR-002 | met | `system_service.py:29` `isoformat(timespec="seconds")` on aware dt; `test_server_time_uses_numeric_offset_for_utc`; live `+07:00` |
| FR-003 | met | `system_service.py:30`, `models/system.py:10` `Literal["ok"]`; `test_system_info_status_and_identity` |
| FR-004 | met | `app.routes.ts:33-36`, `shared/ui/navbar.ts:13`; `app.routes.spec.ts` "resolves /about to About", `layout.spec.ts` |
| FR-005 | met | `features/about/about.html:7-16`; `about.spec.ts` "renders the four labelled values…" |
| FR-006 | met | `about.html:5` result-panel; `about.spec.ts` spinner + 502 error tests |
| FR-007 | met | No guard or storage on the route or the endpoint; TestClient call made without auth |
| US1-1/2/3 | met | navbar link on every Layout page; direct-URL routing test; success render test |
| US2-1/2 | met | `about.spec.ts` "shows the spinner…" / "shows a readable error…" |
| Edge: unreachable | met | apiCall error path → alert (502 test); no client timeout by design (design §6) |
| Edge: leave early | met | `about.spec.ts` "cancels the request…" (`req.cancelled`) |
| Edge: timezone | met | serverTime shown verbatim with offset (`about.html:13`) |
| SC-001 | met | Navbar is in shared Layout, so About is one click from any page |
| SC-002 | met (not timed) | Endpoint does no I/O; live response was immediate |
| SC-003 | partial (accepted) | Fails fast in dev; behind nginx a hung backend waits up to the 60 s default (design §6 risk) |
| SC-004 | met (config-dependent) | `APP_VERSION` env → `docker-compose.yml`, `.env.example`; live `APP_VERSION=1.2.3` echoed |
| Contract `system-api.md` | met | path, method, camelCase keys exactly `{appName, appVersion, serverTime, status}`, defaults, no `Z` |

## Gates

- `backend/.venv python -m pytest` (from `backend/`) → pass (80 passed)
- `npm run build` (frontend-ng) → pass (`about` lazy chunk emitted)
- `npm run lint` (frontend-ng) → pass
- `npm test -- --watch=false` (frontend-ng) → pass (16 files, 44 tests)
- T001 proxy.conf.json parses → pass
- Live check: `uvicorn` + `curl /system/info` → 200 camelCase body; POST → 405; `/health` unaffected → pass
- Quickstart Scenario 4 (Docker/Windows) → not run (Docker builds the React app until spec 007 T017)
- Browser walkthrough of `/about` → not run; covered by component and route tests

## Findings

**Critical**: none. **Major**: none.

**Minor**

- `app.spec.ts:29` · frontend · edited, though no task names it (adds `'about'` to the route-path list) · Principle VI (surgical) · Needed to keep the existing test passing. Accept, and record it as a deviation.
- `scripts/windows/nginx.conf.template:38-42` · infra · adds `proxy_set_header Host/X-Real-IP`, which the design §4.5 snippet does not have · design deviation · Harmless and matches `/accounts/`. Accept.
- `features/about/about.html:3` · frontend · `class="bold"` is not a Tailwind or DaisyUI class, so it has no effect (copied from `home.html:5`) · styling tokens · Use `font-bold` or a `--fz-*` token if bold is wanted. Not a regression.
- `features/about/about.html:4,8` · frontend · uses palette literals (`bg-white`, `border-gray-300`, `text-neutral-500`) rather than `var(--…)` tokens · constitution frontend styling rule · These follow design.md §4.3 and existing pages. Consider tokens in a later cleanup.
- `backend/routers/system.py:9` · backend · an unauthenticated endpoint discloses app version and server time · security (info disclosure, low) · Accepted by spec FR-007 and the private-network deployment. No action.
- `docker-compose.yml:9` · infra · only `APP_VERSION` is passed through, not `APP_NAME`, so the name can't be overridden in Docker · SC-004 is only about version · Optional: add `APP_NAME: ${APP_NAME:-Serichai Web Portal}` if needed.

Security review: there is no input surface (no body or params). Env values are rendered through Angular interpolation, which auto-escapes them. Logs contain no secrets or PII. No new dependencies. CORS is unchanged. The `FRONTEND_DIST` prefix list was extended correctly (`backend/main.py:40`), so `/system/*` is not swallowed by the SPA fallback.
