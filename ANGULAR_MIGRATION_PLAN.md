# Plan: Migrate `frontend/` from React 19 + TS to Angular 22 (keep Tailwind v4 + DaisyUI)

> **Deliverable (per user):** on approval, copy this document verbatim to the repo root as `ANGULAR_MIGRATION_PLAN.md` (`C:\Users\Lenovo\Desktop\Serichai\source_code\serichai-web-portal\ANGULAR_MIGRATION_PLAN.md`). No other files are changed and no migration code is written yet. Not committed unless asked.

## Context

The portal frontend is a small React SPA (~1,550 lines in `src/`, 250 of them CSS) that talks to a FastAPI backend. The goal is to move it to Angular 22 while keeping the visual design (Tailwind v4 + DaisyUI 5) and the backend contract unchanged. The app is small and simple enough that a **big-bang rewrite in a sibling folder** is cheaper and safer than incremental interop (no micro-frontend / module-federation needed).

Assumption to verify before starting: "Angular 22" (Angular ships every ~6 months; v22 expected ~May 2026). Run `npx @angular/cli@22 version` and read the v22 release notes. Everything below uses only stable features from v20/21 (standalone, signals, `@if/@for`, `HttpClient`, zoneless, Vitest runner), so it should hold for v22; re-check any API marked *experimental* (Signal Forms) before relying on it.

## Current-state facts (from inventory)

- 6 routes: `/login` (stub), `/employee-benefits`, `/bonus-calculation`, `/payroll-reconciliation`, `/tax-deduction`, `/` + `*` → Home (no 404, no guards, no lazy loading).
- 4 feature pages share one shape: pick file(s) → validate → multipart `POST /accounts/<resource>` → JSON response containing base64 xlsx attachments → summary + list + download buttons. States: idle / pending / error / success.
- Server state = **only `useMutation`** (no `useQuery`, no `useEffect`, no refs, no Context, no portals, no custom hooks). Nothing depends on React Compiler.
- Types live inside service files; `FileAttachment` redeclared 4×; `downloadFileAttachment()` copy-pasted in 4 pages.
- Styling: `index.css` with `@import "tailwindcss"; @plugin "daisyui";` + a Material-3-style `@theme` token block + `@layer base` typography. **`tailwind.config.js` is dead code** (v3 syntax, never loaded; `enterprise` theme never applied). No postcss config.
- Env: only `VITE_API_BASE_URL` (`.env.development` = `http://127.0.0.1:8000`, prod = same-origin via nginx `/accounts/` proxy).
- No tests, no auth, no icon lib, no form lib. Deploy = Node 20 build → nginx (`try_files` SPA fallback + `/accounts/` proxy).

## Gap analysis

| Area | React today | Angular 22 target | Gap / risk |
|---|---|---|---|
| Bootstrap | `main.tsx` + StrictMode | `main.ts` + `bootstrapApplication(App, appConfig)` | trivial |
| Routing | `react-router` `Routes`/`NavLink` | `provideRouter(routes)`, lazy `loadComponent`, `routerLink`/`routerLinkActive` | trivial; **add** proper 404 route (today `*` → Home) |
| Layout/children | `children` prop | `<ng-content>` / router-outlet in `Layout` shell | trivial |
| Local state | `useState` | `signal()` / `computed()` | trivial |
| Server state | TanStack `useMutation` | **Chosen:** `HttpClient` + a small `signal`-based `apiCall` helper | `httpResource` rejected: Angular docs advise against it for POST/PUT (see design decision 3) |
| Forms | uncontrolled/controlled inputs | signals + `(change)`/`[value]`; file inputs via `(change)`; reactive forms only if validation grows | low |
| Validation UX | `alert()` in handler (duplicated in `mutationFn`) | inline DaisyUI `validator`/alert text | improvement, small behaviour change |
| Fetch | raw `fetch` + `FormData` | `HttpClient.post(url, FormData)` (don't set Content-Type) | error body is `err.error.detail`, not `response.json().detail` |
| Env config | `import.meta.env.VITE_API_BASE_URL` | `src/environments/environment*.ts` w/ `fileReplacements`, or `InjectionToken<string>` `API_BASE_URL` | Vite env doesn't exist in Angular CLI |
| Asset `?url` import (template xlsx) | Vite `?url` | put file in `public/`, link `/Tax_Reduction_Input.xlsx` | trivial |
| Styling pipeline | `@tailwindcss/vite` | Angular CLI has no Vite plugin slot → `@tailwindcss/postcss` via `.postcssrc.json`; `@import "tailwindcss"; @plugin "daisyui";` in `src/styles.css` | **main tooling gap**; verified path: Tailwind's official Angular guide |
| Component CSS | global only | Angular view encapsulation: DaisyUI/Tailwind classes are global utilities, so use them in templates; keep any custom CSS in `styles.css` (Tailwind in component stylesheets needs `@reference`) | avoid per-component `styles:` with `@apply` |
| Design tokens | `@theme` block in `index.css` | copy verbatim into `styles.css` | port as-is; **fix latent bugs** separately (see Cleanup) |
| Google Fonts `@import url()` | CSS import | keep, or move `<link>` to `index.html` (Angular can inline fonts) | note CSP/offline on a private network |
| Lint | ESLint flat + ts-eslint + react plugins | `ng add angular-eslint` (flat config) | replace react/tanstack rules |
| TS config | no `strict` | Angular CLI defaults to `strict` + `strictTemplates` | **expect type errors to fix** (nullable fields, e.g. `EmployeeBonusRecord` ~35 `number\|null`) |
| Tests | none | Vitest (Angular default runner) — add smoke + service tests | net-new |
| Docker/nginx | build `dist/`, copy to nginx | output is `dist/<project>/browser`; update `COPY` path; `try_files` unchanged | small; also add `client_max_body_size` (see below) |
| DaisyUI dropdown/collapse/tabs | CSS/focus/checkbox driven | identical markup works (no JS deps) | none — this is why DaisyUI ports cleanly |

### Latent issues to resolve (found during inventory; not migration-caused)
1. `<button>` nested in `<a>` in `Card` and `Navbar` (invalid HTML) → use `<a class="btn">`.
2. Tax page `referenceDate` state is never bound to an input (always sent as undefined) → decide: bind a date input, or drop it.
3. nginx has no `client_max_body_size` → default 1 MB will reject larger xlsx uploads. Set (e.g. 20m) and `proxy_read_timeout`.
4. `tailwind.config.js` dead + DaisyUI mapping vars in `@theme` likely ineffective (DaisyUI 5 uses `--color-primary`, `--color-base-100`; custom themes use `@plugin "daisyui/theme"`). Don't carry the file over; decide separately whether to define a real `enterprise` theme.
5. Unused: `checkHealth`, `@tailwindcss/postcss` dep (now needed!), `hero.png`, `react.svg`, `vite.svg`, empty `App.css`, empty Bonus "config" tab, Login stub, inert Navbar menu.
6. `index.html` title is still `serichai-web-portal-app`.

## Key design decisions (recommendations)

1. **Big-bang, parallel folder.** Scaffold `frontend-ng/` next to `frontend/`, reach feature parity, then swap (delete `frontend/`, rename). Backend untouched; contract identical → no backend work.
2. **Zoneless + signals + standalone + new control flow** (`@if/@for/@switch`, `track`). No NgModules, no `*ngIf`.
3. **Server state:** `HttpClient` + one generic signal helper (`apiCall`). Rationale: all 4 calls are POST mutations, for which the Angular docs say to prefer `HttpClient` over `httpResource`; TanStack's caching/invalidation adds nothing today, so it is dropped. Use `httpResource` later for reactive reads if any appear. (CLAUDE.md's TanStack rule must be rewritten either way.)
4. **Single shared `FileAttachment` type + `downloadAttachment()` util** (kills the 4× duplication). `FileAttachment` lives in `shared/models/`, feature payload types beside their feature service, camelCase, matching wire format (per CLAUDE.md API conventions).
5. **Lazy-load each page** via `loadComponent`.
6. **Keep the design tokens and DaisyUI default `light` theme** so the UI is pixel-equivalent; theming clean-up is a follow-up.

## Target structure

```
frontend-ng/
  angular.json  package.json  tsconfig*.json  .postcssrc.json  proxy.conf.json
  public/            favicon.svg, Tax_Reduction_Input.xlsx
  src/
    index.html  main.ts  styles.css      (@import "tailwindcss"; @plugin "daisyui"; + @theme + @layer base)
    environments/environment.ts, environment.development.ts
    app/
      app.ts  app.config.ts  app.routes.ts
      core/                     # app-wide singletons; imported only by app.config / app shell
        config/api-config.ts        (InjectionToken API_BASE_URL)
        http/api-call.ts            (signal mutation helper, replaces useMutation)
        layout/layout.ts navbar.ts  (app shell: Layout + Navbar)
      shared/                   # stateless, feature-agnostic; no imports from features/
        ui/button.ts card.ts result-panel.ts file-field.ts   (result-panel = idle/pending/error/success shell)
        models/attachment.ts        (single FileAttachment type)
        utils/download.ts           (downloadAttachment)
      features/                 # one folder per route; lazy-loaded via loadComponent (add <feature>.routes.ts + loadChildren if a feature grows sub-pages)
        home/            home.ts home.html
        auth/            login.ts login.html
        employee-benefits/  employee-benefits.ts .html  benefits.service.ts  benefits.models.ts
        bonus-calculation/  bonus-calculation.ts .html  bonus.service.ts  bonus.models.ts
        payroll-reconcile/  payroll-reconcile.ts .html  payroll-reconcile.service.ts  payroll-reconcile.models.ts
        tax-deduction/      tax-deduction.ts .html  tax-deduction.service.ts  tax-deduction.models.ts  employee-status.ts
```

**Dependency rules** (enforce with an `angular-eslint`/`no-restricted-imports` rule): `features/*` may import `core` and `shared`; `shared` may import nothing but Angular and other `shared`; `core` may import `shared`; `features/*` must not import from each other. Each feature owns its service and API models (they are only used there today); only `FileAttachment` is cross-feature, so it lives in `shared/models`. Add a path alias (`@core/*`, `@shared/*`, `@features/*`) in `tsconfig.json` to avoid `../../..` imports.

## Implementation sketches

**Tailwind + DaisyUI wiring** (`.postcssrc.json`):
```json
{ "plugins": { "@tailwindcss/postcss": {} } }
```
`angular.json` → `"styles": ["src/styles.css"]`; `styles.css` = current `index.css` content (fonts import, `@import "tailwindcss"; @plugin "daisyui";`, `@theme`, `@layer base`). Deps: `tailwindcss`, `@tailwindcss/postcss`, `postcss`, `daisyui`.

**app.config.ts**
```ts
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withFetch()),
    { provide: API_BASE_URL, useValue: environment.apiBaseUrl },
  ],
};
```
(Zoneless is the default in recent CLI scaffolds; confirm on v22.)

**app.routes.ts**
```ts
export const routes: Routes = [
  { path: '', pathMatch: 'full', loadComponent: () => import('./features/home/home').then(m => m.Home) },
  { path: 'login', loadComponent: ... },
  { path: 'employee-benefits', loadComponent: ... },
  { path: 'bonus-calculation', loadComponent: ... },
  { path: 'payroll-reconciliation', loadComponent: ... },
  { path: 'tax-deduction', loadComponent: ... },
  { path: '**', redirectTo: '' },   // preserves today's behaviour; swap for a NotFound page if desired
];
```

**Generic mutation helper** (`core/http/api-call.ts`) — replaces `useMutation`:
```ts
export function apiCall<TArgs extends unknown[], TRes>(fn: (...a: TArgs) => Observable<TRes>) {
  const data = signal<TRes | null>(null);
  const error = signal<string | null>(null);
  const pending = signal(false);
  const run = (...a: TArgs) => {
    pending.set(true); error.set(null);
    fn(...a).pipe(finalize(() => pending.set(false))).subscribe({
      next: r => data.set(r),
      error: (e: HttpErrorResponse) => error.set(e.error?.detail ?? `Request failed with status ${e.status}`),
    });
  };
  return { data: data.asReadonly(), error: error.asReadonly(), pending: pending.asReadonly(), run,
           status: computed(() => pending() ? 'pending' : error() ? 'error' : data() ? 'success' : 'idle') };
}
```
Does not inject anything, so it can be called anywhere. To avoid overlapping requests, disable the submit button while `pending()` (simple), or route calls through a `Subject` + `switchMap` if cancel-on-resubmit is wanted. Clear a result by adding a `reset()` that nulls `data`/`error` if a page needs it.

**Service** (example — `tax-deduction.service.ts`):
```ts
@Injectable({ providedIn: 'root' })
export class TaxDeductionService {
  private http = inject(HttpClient); private base = inject(API_BASE_URL);
  calculate(payrollFile: File, referenceDate?: string) {
    const f = new FormData();
    f.append('payrollFile', payrollFile);
    if (referenceDate) f.append('referenceDate', referenceDate);
    return this.http.post<CalculateTaxDeductionResponse>(`${this.base}/accounts/tax-deduction`, f);
  }
}
```
Same pattern for benefits (`masterFile`, optional `previousBenefitsFile`), bonus (`currentYearFile`, `previousYearSummaryFile`, `year`), payroll (`payrollFile`, `period`). Do **not** set `Content-Type`.

**Download util** (`shared/utils/download.ts`): port the existing `atob → Uint8Array → Blob → <a download>` once; revoke the object URL.

**Page component pattern** (`tax-deduction.ts`):
```ts
@Component({ selector: 'app-tax-deduction', imports: [Layout, DecimalPipe, NgClass], templateUrl: './tax-deduction.html' })
export class TaxDeduction {
  private svc = inject(TaxDeductionService);
  payrollFile = signal<File | null>(null);
  call = apiCall((f: File) => this.svc.calculate(f));
  onFile(e: Event) { this.payrollFile.set((e.target as HTMLInputElement).files?.[0] ?? null); }
  submit() { const f = this.payrollFile(); if (f) this.call.run(f); }
  statusOf = getEmployeeStatus;         // port pure helper unchanged
}
```
Template: `@switch (call.status())` for the 4 result states; `@for (e of call.data()!.employees; track e.seq)`; `{{ v | number:'1.0-2' }}` replaces `formatNumber` (keep `'-'` for null via `@if`). Tab state in Bonus page = `tab = signal<'cal'|'config'>('cal')`. Payroll `period` = `<input type="month">` bound via `[value]`/`(input)`.

**Why not `httpResource`:** the Angular HTTP guide (angular.dev/guide/http/http-resource) says "Avoid using `httpResource` for *mutations* like `POST` or `PUT`. Instead, prefer directly using the underlying `HttpClient` APIs." All four calls are multipart POSTs, so we use `HttpClient`. Reserve `httpResource` for future reactive reads (e.g. `GET /health`, a list that reloads when a filter signal changes).

**Deployment**: `frontend/Dockerfile` → `COPY --from=build /app/dist/<project>/browser /usr/share/nginx/html`; Node base ≥ version required by Angular 22 (check; likely 22 LTS); nginx.conf: keep `try_files` + `/accounts/` proxy, add `client_max_body_size 20m; proxy_read_timeout 120s;`. Dev: `ng serve` on 4200 → **update backend CORS** origin from `http://localhost:5173` to `http://localhost:4200` (`backend/main.py`), or add `proxy.conf.json` proxying `/accounts` to `127.0.0.1:8000` and leave `apiBaseUrl` empty (preferred — mirrors prod, removes CORS dependency).

## Phased plan

| Phase | Work | Exit criteria |
|---|---|---|
| 0. Decisions & spike (0.5 d) | Confirm Angular 22 + Node version; scaffold `frontend-ng`; wire Tailwind+DaisyUI; render one DaisyUI button, one `card`, `dropdown`, `collapse`, `tabs` | DaisyUI classes and `@theme` tokens (`bg-primary-cont`) render correctly in `ng serve` and `ng build` |
| 1. Foundation (1 d) | `core`/`shared`/`features` skeleton + `@core`/`@shared`/`@features` path aliases + import-boundary lint rule, environments/`API_BASE_URL`, `apiCall`, `download`, `FileAttachment`, `Layout`/`Navbar`/`Button`/`Card`, root routes (each feature lazy via `loadComponent`), `proxy.conf.json` | Home + nav work; lazy chunks emitted |
| 2. Simple pages (0.5–1 d) | Home, Login (stub kept), EmployeeBenefits | multipart call + summary + both downloads work against live backend |
| 3. Remaining pages (1.5–2 d) | PayrollReconcile, BonusCalculation (tabs), TaxDeduction (table, badges, collapse, template link) | field-for-field parity with React pages |
| 4. Quality (1 d) | angular-eslint, strict-mode fixes, Vitest: services (HttpTestingController — assert FormData field names), `apiCall` (status transitions, `detail` error mapping), `getEmployeeStatus`, `download`, one component smoke test per page | `ng lint`, `ng test`, `ng build` green |
| 5. Deploy (0.5 d) | Dockerfile, nginx (body size/timeouts), compose, `.env.example` unchanged; test on port 8080 | `docker compose up` serves Angular app end-to-end |
| 6. Cutover & docs (0.5 d) | replace `frontend/`, update CLAUDE.md, README, `.claude/agents/frontend-engineer.md`, `.devcontainer`, spec-kit constitution refs; remove cleanup items | React code removed; git history retains it |

Estimate: ~5–6 engineer-days incl. review. Commit style per CLAUDE.md: `[ADD][FE] ...` / `[IMP][FE] ...`, no Claude co-author trailer (repo rule overrides the default attribution reminder), keep any spec docs (`[DOCS]`) in a separate commit.

## Docs/config that must change with the migration
- `CLAUDE.md`: commands (`ng serve/build/lint/test`), Frontend architecture section (pages/components/services → `core`/`shared`/`features` layout), **state-management section** (TanStack → signals + HttpClient), Tailwind wiring (`.postcssrc.json`), React Compiler note removed, CORS note (`localhost:4200`/proxy), cross-cutting "no proxy" note.
- `.claude/agents/frontend-engineer.md` (says "React/TypeScript"), `.devcontainer` postCreate, `docker-compose.yml`/`frontend/Dockerfile`, `frontend/README.md`, `.specify` constitution mentions of React/TanStack.

## Risks & mitigations
- **Angular 22 specifics unverified** (assistant knowledge predates release) → Phase 0 spike + read release notes; avoid experimental APIs.
- **Tailwind v4 in Angular CLI** uses PostCSS (slower than Vite plugin; component-level `@apply` needs `@reference`) → keep utilities in templates, custom CSS only in `styles.css`.
- **Strict typing surfaces hidden null bugs** (repo has no `strict`) → budget time; fix models rather than casting.
- **No existing tests → no regression net.** Mitigate by manual parity checklist per page + the new service tests; use `sample-data/` files against the live backend.
- **UI drift:** Angular attribute/class bindings differ (`[class]`, `[ngClass]`); DaisyUI markup is unchanged, so visual diff via side-by-side screenshots of all 5 pages.
- **Team skill/ecosystem cost:** RxJS + DI learning curve; keep to signals + `HttpClient` and minimal RxJS.

## Verification (end-to-end)
1. `cd backend && uvicorn main:app --reload`; `cd frontend-ng && npm ci && ng serve` (proxy on) → exercise each page with files from `sample-data/`: upload, error path (wrong file → `detail` message shown), success summary/lists, and each download opens as valid `.xlsx`.
2. Side-by-side screenshots vs. React app (`npm run dev` in old `frontend/`) for Home, 4 feature pages, all states incl. Tax table and rules collapse.
3. `ng build` (production, strict), `ng lint`, `ng test` all pass; check lazy chunks exist and bundle size is reasonable.
4. `docker compose up` → http://localhost:8080: SPA deep-link refresh works (`/tax-deduction`), `/accounts/*` proxied, upload > 1 MB succeeds.
5. Confirm CLAUDE.md/agent docs updated and no React/Vite references remain (`grep -ri "react\|vite\|tanstack" --exclude-dir=node_modules`).

## Open questions for the owner (defaults in brackets)
- ~~TanStack vs HttpClient vs httpResource~~ **Decided: `HttpClient` + `apiCall`** (httpResource discouraged for POST by Angular docs).
- Replace `alert()` validation with inline messages? [yes]
- Bind a real `referenceDate` input on Tax page, or remove it? [remove until a spec requires it]
- Build a proper `enterprise` DaisyUI theme now or stay on default `light`? [stay on `light`, follow-up]
- Add a 404 page vs. redirect-to-Home? [redirect, as today]
