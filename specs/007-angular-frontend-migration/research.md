# Research: Angular Frontend Migration

Authoritative technical source: `/ANGULAR_MIGRATION_PLAN.md` (design decisions, gap analysis, target structure). This file records only what was verified or decided while planning.

## 1. Angular / Node / toolchain versions (verified 2026-09-26)

- **Decision**: Angular **22.2.0** (`npm view @angular/cli version` -> `22.2.0`, dist-tag `latest`). The "Angular 22" claim holds; no deviation.
- Constraints read from the registry: `@angular/cli`/`core` require Node `^22.22.3 || ^24.15.0 || >=26`; `@angular/build` peers `typescript >=6.0 <6.1`, `vitest ^4.0.8 || ^5.0.0`, `tailwindcss ^2-^4`, `postcss ^8.4`.
- **Node**: local is v24.21.0 (satisfies). Pin the repo to the **Node 24** line: `node:24-alpine` in `frontend/Dockerfile`, Node 24 in the devcontainer, `engines` `>=24.15.0` in `package.json`. Node 20 (current Docker/devcontainer) is unsupported and MUST be bumped.
- Exact package versions are whatever `ng new` resolves; commit the lockfile. Do not override TypeScript outside Angular's supported range.

## 2. Server state: `HttpClient` + signal `apiCall` helper

- **Decision**: as in the migration plan (decision 3). All four calls are multipart POSTs; `httpResource` is documented as unsuited to mutations; TanStack caching adds nothing. Rejected: `httpResource` (mutation misuse), `@tanstack/angular-query` (extra dependency, no cache value).
- Error mapping: `HttpErrorResponse.error?.detail`, else `Request failed with status <status>` (status 0 when backend unreachable). Preserves current behaviour.
- Navigating away mid-request: the helper is component-scoped and its subscription ends with the component (`takeUntilDestroyed` via `DestroyRef`), so no stale result/error appears on the next page (spec edge case).

## 3. Styling pipeline

- **Decision**: `@tailwindcss/postcss` via `.postcssrc.json` (Angular CLI has no Vite-plugin slot); Tailwind v4 + DaisyUI 5 unchanged; `@theme` tokens copied verbatim into `src/styles.css`; default `light` theme kept (spec Assumptions). Custom CSS only in `styles.css`; no per-component `@apply`.

## 4. Testing

- **Decision**: Angular 22 default runner (Vitest via `@angular/build:unit-test`, `ng test`). `HttpTestingController` (`provideHttpClientTesting`) for services, asserting multipart field names; plain unit tests for `apiCall`, `getEmployeeStatus`, `downloadAttachment` (spy on `URL.createObjectURL` and anchor click); one `TestBed` render smoke test per page. Satisfies FR-014 / SC-006.

## 5. Lint and type-check

- `angular-eslint` (flat config) via `ng add angular-eslint`; import-boundary rule via `no-restricted-imports` (features must not import other features; shared must not import core/features).
- Type-check = `ng build` (strict + `strictTemplates`); there is no separate `tsc -b`.

## 6. Dev workflow, CORS, deployment

- **Dev**: `ng serve` (port 4200) with `proxy.conf.json` proxying `/accounts` -> `http://127.0.0.1:8000`; API base URL empty. Backend CORS is already env-driven (`CORS_ORIGINS` in `backend/main.py`), so **no backend change** (FR-013, FR-017). Update the stale `5173` default in `.env.example`/`docker-compose.yml` to `4200` for consistency only.
- **Prod**: `frontend/Dockerfile` stage 1 `node:24-alpine` + `npm run build`, copy `dist/serichai-web-portal/browser` into nginx; `nginx.conf` adds `client_max_body_size 20m; proxy_read_timeout 120s; proxy_send_timeout 120s;` (FR-012); `try_files` fallback unchanged.
- **Config**: a single `API_BASE_URL` `InjectionToken` provided as `''`; no `environments/` files or `fileReplacements` (proxy and nginx are both same-origin). Simpler than the migration plan's environments option; the plan allows either.

## 6a. Cutover mechanics

- Scaffold in `frontend-ng/`; after parity is verified, delete `frontend/` and `git mv frontend-ng frontend` so Docker/devcontainer/CLAUDE.md paths stay valid. Angular project name: `serichai-web-portal`.
- `Tax_Reduction_Input.xlsx` moves from `src/assets` (Vite `?url`) to `public/`, linked as `/Tax_Reduction_Input.xlsx` (FR-011).

## 7. Constitution amendment: MAJOR (1.1.1 -> 2.0.0)

- Principle III's frontend clause (React + TS strict, TanStack Query sole server-state layer, DaisyUI default) is *redefined*: framework and server-state layer are replaced. Versioning policy: MAJOR = "a principle is ... redefined in a backward-incompatible way"; existing React/TanStack code would violate the new text, so PATCH/MINOR do not fit.
- New Principle III frontend text: Angular + TypeScript strict (`strictTemplates`); Angular `HttpClient` (through the shared `apiCall` helper in `core/http`) is the sole server-state layer, no ad-hoc HTTP calls in components; DaisyUI stays the default UI building block. Principle IV: `tsc -b` / `eslint .` -> `ng build` (strict type-check), `ng lint`, `ng test`. Principle II rationale: "a Vite SPA" -> "an Angular SPA". Backend clauses unchanged.
- Applied through `/speckit-constitution` as the first implementation task, before frontend code lands.

## 8. Open questions

None; defaults are recorded in spec Assumptions (inline validation, reference date removed, `light` theme, unknown routes redirect to Home).
