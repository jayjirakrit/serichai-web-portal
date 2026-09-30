# Design: Angular Frontend Migration

Spec: `spec.md` · Plan: `plan.md` · Contracts: `contracts/*.md`

Paths are under `frontend-ng/src/app/` unless stated (renamed to `frontend/` at cutover, T017).

## 1. Approach

As-built (T001-T015 done; T016-T019 pending): the React SPA is rebuilt as an Angular 22.2 standalone, zoneless, signals-based app in `frontend-ng/`, with Tailwind v4 + DaisyUI kept. Server state is `HttpClient` wrapped by one signal helper, `apiCall`, replacing TanStack `useMutation`. Four lazy feature pages share `shared/ui` (`layout`, `navbar`, `result-panel`, `file-field`, `button`) and one `downloadAttachment`. Backend is untouched: contracts are the existing ones (see §5). Everything below is trimmed from the real code; §6 lists where code and docs disagree.

## 2. Key decisions

| Decision | Choice | Why / trade-off |
|----------|--------|-----------------|
| Server state | `HttpClient` + `apiCall` in `core/http` | All calls are multipart POST mutations; `httpResource` suits reads, TanStack adds a dependency for no caching value. |
| Request lifecycle | One signal quartet (`data/error/pending` + computed `status`), cancelled on component destroy | No stale result on the next page. `run` itself is not a duplicate guard (§6). |
| Base URL | `API_BASE_URL` token provided `''`; no `environments/` | Dev proxy and nginx are both same-origin. Trade-off: another origin needs a code change. |
| Dev backend access | `proxy.conf.json` wired only through `npm start` | No CORS change (FR-013). Trade-off: bare `ng serve` has no proxy (§6). |
| Prod gateway | nginx SPA fallback + `/accounts/` reverse proxy, 20m body, 120s timeouts | Same shape as today plus FR-012 limits. |
| Routing | Every page `loadComponent`; `**` redirects to `''` | One chunk per page; unknown address lands on Home (FR-007). |
| Module boundaries | ESLint `no-restricted-imports` generated per feature folder | Cheap enforcement; one gap (§6). |
| Result rendering | One `app-result-panel` (`@switch` on status, `[idle]` slot) | Guarantees the four states (FR-003) identically on every page. |

## 3. Flow

```text
click Submit -> onSubmit(): call.pending()? return                      [FR-004]
             -> required file/field missing? inline error signal, return [FR-006]
             -> call.run(...) -> pending=true, data/error cleared
   service: FormData (no Content-Type) -> POST ${API_BASE_URL}/accounts/<resource>
   200            -> data set  -> status 'success' -> panel renders summary + download buttons
   4xx/5xx/offline-> error = body.detail (string) || "Request failed with status <n>" -> 'error'
   download click -> downloadAttachment(): atob -> Blob -> <a download> click -> revoke
component destroyed mid-request -> subscription cancelled, nothing lands on the next page
Browser -> ng serve proxy | nginx -> uvicorn :8000 (browser only sees relative /accounts/*)
```

## 4. Key files

| Requirements | Key files |
|--------------|-----------|
| FR-003, FR-004 | `core/http/api-call.ts`, `shared/ui/result-panel.ts` |
| FR-001, FR-007, FR-013 | `app.routes.ts`, `app.config.ts`, `core/config/api-config.ts` |
| FR-002, FR-006, FR-010 | the four `features/*/*.service.ts`, `*.ts`, `*.html`, `shared/ui/file-field.ts` |
| FR-005, FR-011 | `shared/utils/download.ts`, `shared/models/attachment.ts` |
| FR-008, FR-009 | `shared/ui/layout.ts`, `navbar.ts`, `card.ts` |
| FR-012 | `nginx.conf`, `Dockerfile` |
| FR-014, FR-015 | `*.spec.ts` beside each file, `eslint.config.js` |

### 4.1 Backend — Not applicable

Backend is unchanged (FR-017); no router, service or model work.

### 4.2 Core / shared building blocks

#### core/http/api-call.ts — FR-003, FR-004
```ts
export function apiCall<TArgs extends unknown[], TRes>(fn: (...args: TArgs) => Observable<TRes>) {
  const destroyRef = inject(DestroyRef);            // injection context: field initializer only
  const data = signal<TRes | null>(null);
  const error = signal<string | null>(null);
  const pending = signal(false);
  let sub: Subscription | null = null;
  let destroyed = false;
  destroyRef.onDestroy(() => { destroyed = true; sub?.unsubscribe(); });

  const run = (...args: TArgs): void => {
    if (destroyed) return;
    sub?.unsubscribe();                              // cancels + restarts; NOT a no-op while pending
    pending.set(true); error.set(null); data.set(null);
    sub = fn(...args).subscribe({
      next: (res) => { data.set(res); pending.set(false); },
      error: (e: HttpErrorResponse) => {
        const detail = (e.error as { detail?: unknown } | null)?.detail;
        error.set(typeof detail === 'string' && detail ? detail : `Request failed with status ${e.status}`);
        pending.set(false);
      },
    });
  };
  const reset = (): void => { sub?.unsubscribe(); data.set(null); error.set(null); pending.set(false); };
  const status = computed<ApiCallStatus>(() =>
    pending() ? 'pending' : error() !== null ? 'error' : data() !== null ? 'success' : 'idle');
  return { data: data.asReadonly(), error: error.asReadonly(), pending: pending.asReadonly(), status, run, reset };
}
```
**Check**: offline gives status 0 text; array-valued `detail` (FastAPI 422) shows the generic text; a `null` 200 body would read as `idle`.
**Specs must assert**: idle -> pending -> success sets data; `detail` string mapped, otherwise `Request failed with status N` (incl. 0); `reset` -> idle; no state change after destroy.

#### core/config + app.config.ts — FR-013
```ts
export const API_BASE_URL = new InjectionToken<string>('http://127.0.0.1:8000'); // string is only the DEBUG DESCRIPTION, no default

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),            // zoneless: no provideZoneChangeDetection
    provideRouter(routes),
    provideHttpClient(withFetch()),
    { provide: API_BASE_URL, useValue: '' },         // same origin: proxy / nginx
  ],
};
```
**Check**: the token has no factory, so any spec that omits the provider throws.
**Specs must assert**: services build URLs as `'' + '/accounts/...'` when the token is `''`.

#### shared/ui/result-panel.ts — FR-003
```ts
@Component({
  selector: 'app-result-panel',
  template: `
    @switch (status()) {
      @case ('pending') { <div class="flex items-center gap-2" role="status">
        <span class="loading loading-spinner loading-sm"></span><span>{{ pendingText() }}</span></div> }
      @case ('error')   { <div class="alert alert-error" role="alert"><span>{{ error() }}</span></div> }
      @case ('success') { <ng-content /> }                 // page projects summary + buttons
      @default          { <ng-content select="[idle]" /> } // page projects "Awaiting Data"
    }`,
})
export class ResultPanel {
  readonly status = input.required<ResultPanelStatus>();
  readonly error = input<string | null>(null);
  readonly pendingText = input('Processing...');
}
```
**Check**: both slots are projected from the page; only the active one is rendered.
**Specs must assert**: each status shows its region (`[role=status]`, `.alert-error` with message, projected content, `[idle]` content).

#### shared/ui/file-field.ts — FR-006
```ts
readonly label = input.required<string>();
readonly accept = input('.xlsx,.xls');
readonly errorMessage = input<string | null>(null);      // inline message, never alert()
readonly required = input(false);
readonly fileChange = output<File | null>();             // cleared selection -> null
protected onChange(e: Event) { this.fileChange.emit((e.target as HTMLInputElement).files?.[0] ?? null); }
// template: <input type="file" [class.file-input-error]="errorMessage() !== null" [attr.aria-invalid]=...>
//           @if (errorMessage() !== null) { <p class="label text-error" role="alert">{{ errorMessage() }}</p> }
```
**Specs must assert**: emits the `File`, and `null` when cleared; error text and `role=alert` render only when `errorMessage` is set.

#### shared/ui/layout.ts + navbar.ts — FR-008, FR-009
```ts
// layout: <div class="app-container"><app-navbar /><main class="main-content"><ng-content /></main></div>
// navbar template (only brand link is a real route link):
<div class="navbar bg-base-100 shadow-sm">
  <div class="flex-1"><a class="font-semibold text-xl text-primary pl-6" routerLink="/">Serichai Web Portal</a></div>
  <div class="dropdown dropdown-end">                       <!-- avatar menu: Profile / Settings / Logout are <a> with no href -->
    <div tabindex="0" role="button" class="btn btn-ghost btn-circle avatar" aria-label="Account menu">...</div>
    <ul class="menu menu-sm dropdown-content ..."><li><a>Profile</a></li><li><a>Settings</a></li><li><a>Logout</a></li></ul>
  </div>
</div>
```
**Check**: buttons are no longer nested in links (FR-009 fixed, `card.ts` likewise), but the navbar has NO page links and NO `routerLinkActive`: the US2 "active page highlighted" promise (T008) is unimplemented (§6).
**Specs must assert**: `app-navbar` present, `a[href="/"]` present, no `a button` / `button a`, projected content inside `main`.

#### shared/utils/download.ts — FR-005
```ts
export function downloadAttachment(attachment: FileAttachment): void {   // { filename, contentBase64 }
  const binary = atob(attachment.contentBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([bytes], { type: XLSX_MIME }));
  const a = document.createElement('a');
  a.href = url; a.download = attachment.filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}
```
**Check**: invalid base64 throws out of `atob` with no user message.
**Specs must assert**: Blob type is the xlsx MIME and bytes match; anchor `download` equals `filename`; `revokeObjectURL` called with the created URL.

### 4.3 Features / pages

#### Employee benefits (first, full) — `features/employee-benefits/employee-benefits.{service,models}.ts`, `.ts`, `.html`
```ts
// service: multipart, camelCase field names, optional file omitted (not sent empty) — contracts/benefits-api-angular.md
calculate(masterFile: File, previousBenefitsFile?: File | null): Observable<CalculateBenefitsResponse> {
  const formData = new FormData();
  formData.append('masterFile', masterFile);
  if (previousBenefitsFile) formData.append('previousBenefitsFile', previousBenefitsFile);
  return this.http.post<CalculateBenefitsResponse>(`${this.baseUrl}/accounts/employee-benefits`, formData);
}
```
```ts
// component: signals + guard + inline validation
protected readonly masterFile = signal<File | null>(null);
protected readonly previousBenefitsFile = signal<File | null>(null);
protected readonly masterError = signal<string | null>(null);
protected readonly call = apiCall((master: File, previous: File | null) => this.benefitService.calculate(master, previous));

protected onMasterChange(file: File | null) { this.masterFile.set(file); if (file) this.masterError.set(null); }
protected onSubmit(): void {
  if (this.call.pending()) return;                                       // FR-004
  const master = this.masterFile();
  if (!master) { this.masterError.set('Please upload the employee master data file before submitting.'); return; }
  this.masterError.set(null);
  this.call.run(master, this.previousBenefitsFile());
}
```
```html
<app-file-field label="Employee Master Data" [errorMessage]="masterError()" (fileChange)="onMasterChange($event)" [required]="true" />
<app-file-field label="Previous Employee Benefits" (fileChange)="previousBenefitsFile.set($event)" />
<app-button extraClass="w-fit" [disabled]="call.pending()" (click)="onSubmit()">{{ call.pending() ? 'Processing...' : 'Submit' }}</app-button>

<app-result-panel [status]="call.status()" [error]="call.error()" pendingText="Calculating benefits...">
  <div idle>Awaiting Data ...</div>
  @if (call.data(); as result) {
    counts: result.summary.{totalEmployeesOut, computedCount, resignedFlaggedCount, exceptionCount}
    @if (result.exceptions.length > 0) { @for (exception of result.exceptions; track $index) { category, name || id, detail } }
    <app-button (click)="download(result.employeeBenefitsReport)">Download Benefit Report</app-button>
    <app-button (click)="download(result.exceptionReport)">Download Exception Report</app-button>
  }
</app-result-panel>
```
**Check**: types in `employee-benefits.models.ts` mirror the contract (`FileAttachment` reused from `shared/models`); the Instruction step 3 link is dead (`[href]="templateUrl"` with `templateUrl = ''`, §6).
**Specs must assert** (service): FormData has `masterFile`, has `previousBenefitsFile` only when given, no Content-Type, POST to `/accounts/employee-benefits`. (page): submit without master shows the inline message and issues no request; pending disables the button; error message and both downloads render.

#### Payroll reconcile — differs from employee benefits
- Endpoint `POST /accounts/payroll-reconcile`, fields `payrollFile` + `period` (`YYYY-MM` from `<input type="month">`); no optional file.
- Two independent inline errors; `discrepancyReport` may be `null`, so its download button is conditional; per-row `status` badge (`discrepancy | unrecognizedDepartment | dataError`).
```ts
reconcile(payrollFile: File, period: string) {
  formData.append('payrollFile', payrollFile); formData.append('period', period);
  return this.http.post<ReconcilePayrollResponse>(`${this.baseUrl}/accounts/payroll-reconcile`, formData);
}
// component
protected onSubmit(): void {
  if (this.call.pending()) return;
  this.fileError.set(file ? null : 'Please upload the payroll working file before submitting.');
  this.periodError.set(period ? null : 'Please select the pay period to reconcile before submitting.');
  if (!file || !period) return;                                        // both errors shown together
  this.call.run(file, period);
}
```

#### Bonus calculation — differs from employee benefits
- Endpoint `POST /accounts/bonus-calculation`, fields `currentYearFile`, optional `previousYearSummaryFile`, `year` (string from `<input type="number">`).
- Extra state: `tab: 'cal' | 'config'` (tablist with `role="tab"` + `aria-selected`; the config tab renders nothing yet) and a `submitted` flag so errors appear only after the first submit attempt.
- `EmployeeBonusRecord` numeric fields stay `number | null`; the page shows only `flaggedEmployees` (name + `exceptionNote`).
```ts
protected readonly tab = signal<'cal' | 'config'>('cal');
protected readonly submitted = signal(false);
protected submit(): void {
  if (this.calculation.pending()) return;
  this.submitted.set(true);                                            // drives the two inline errors
  if (!current || !year) return;
  this.calculation.run(current, previous, year);
}
```
```html
<button role="tab" class="tab" [class.tab-active]="tab() === 'cal'" [attr.aria-selected]="tab() === 'cal'" (click)="tab.set('cal')">Calculation</button>
<app-file-field label="Current-Year Data File" [errorMessage]="submitted() && !currentYearFile() ? 'Please upload the current-year data file.' : null" .../>
@if (result.flaggedEmployees.length === 0) { all calculated — 0 exceptions } @else { @for (employee of result.flaggedEmployees; track $index) {...} }
```
**Specs must assert**: `year` appended as a string; `previousYearSummaryFile` omitted when null; tab switch hides/shows the form; `submitted` gating.

#### Elderly tax deduction — differs from employee benefits
- Endpoint `POST /accounts/tax-deduction`, single field `payrollFile`; `referenceDate` is never sent (FR-010) though the response `summary.referenceDate` is displayed.
- Result adds a "rules" collapse and a per-employee table (12 month columns + total); the template download link is the only valid one (`/Tax_Reduction_Input.xlsx` from `public/`, FR-011).
```ts
calculate(payrollFile: File) { const form = new FormData(); form.append('payrollFile', payrollFile);
  return this.http.post<...>(`${this.baseUrl}/accounts/tax-deduction`, form); }
```
```html
@for (employee of result.employees; track employee.seq) {
  @let status = getEmployeeStatus(employee);
  <td>{{ employee.age ?? '-' }}</td><td>{{ (employee.averageMonthlySalary | number: '1.0-2') ?? '-' }}</td>
  <td><span class="badge {{ status.badgeClass }}">{{ status.label }}</span></td>
  @for (amount of employee.monthlyAmounts; track $index) { <td>{{ (amount | number: '1.0-2') ?? '-' }}</td> }
  <td class="font-semibold">{{ (employee.totalAmount | number: '1.0-2') ?? '-' }}</td>
}
```
**Specs must assert**: FormData contains only `payrollFile`; table renders one row per employee with a badge; the status rule (§4.4).

### 4.4 Algorithms / business rules

#### features/elderly-tax-deduction/elderly-tax-deduction.ts — `getEmployeeStatus` (component method, FR-014)
```ts
getEmployeeStatus(e: ElderlyTaxDeductionEmployeeResult): { label: string; badgeClass: string } {
  if (!e.eligible)  return { label: 'Not eligible',                 badgeClass: 'badge-neutral' };
  if (!e.selected)  return { label: 'Eligible, not selected',       badgeClass: 'badge-warning' };
  if (e.disabled)   return { label: 'Selected (disabled, uncapped)', badgeClass: 'badge-success' };
  return              { label: 'Selected',                          badgeClass: 'badge-success' };
}
```
| Input (`eligible, selected, disabled`) | Expected |
|-------|----------|
| false, false, false | Not eligible / `badge-neutral` |
| false, true, true (invalid combo) | Not eligible: eligibility wins, `selected`/`disabled` ignored |
| true, false, false | Eligible, not selected / `badge-warning` |
| true, true, true | Selected (disabled, uncapped) / `badge-success` |
| true, true, false | Selected / `badge-success` |

### 4.5 Routing, config & infra

#### app.routes.ts — FR-001, FR-007
```ts
{ path: '', pathMatch: 'full', loadComponent: () => import('@features/home/home').then((m) => m.Home) },
{ path: 'login', loadComponent: () => import('@core/auth/login').then((m) => m.Login) },
{ path: 'employee-benefits', loadComponent: ... EmployeeBenefits },
{ path: 'bonus-calculation', loadComponent: ... BonusCalculation },
{ path: 'payroll-reconciliation', loadComponent: () => import('@features/payroll-reconcile/payroll-reconcile')... },
{ path: 'elderly-tax-deduction', loadComponent: ... ElderlyTaxDeduction },   // React served /tax-deduction (§6)
{ path: '**', redirectTo: '' },
```
**Check**: page URL `payroll-reconciliation` but API path `payroll-reconcile`; both match the React portal.

#### eslint.config.js — FR-015
```js
// generated per features/<name>/: forbid other features (alias and relative forms)
group: ['@features/*', ...others.flatMap((o) => [`**/features/${o}`, `**/features/${o}/**`, `../${o}`, `../${o}/**`, `../../${o}`, `../../${o}/**`])]
// shared/**: forbid core and features
group: ['@core/*', '@features/*', '**/app/core/**', '../core/**', '../../core/**', '**/features/**']
```
**Check**: `@/features/<other>/x` is blocked, but `@/core/...` is NOT blocked from `shared/` (no pattern matches that alias).

#### proxy.conf.json, nginx.conf, Dockerfile — FR-012, FR-013
```text
proxy.conf.json : "/accounts" -> http://127.0.0.1:8000 (changeOrigin)   # attached via `npm start` only
nginx.conf      : client_max_body_size 20m;
                  location / { try_files $uri $uri/ /index.html; }
                  location /accounts/ { proxy_pass http://backend:8000/accounts/; proxy_read_timeout 120s; proxy_send_timeout 120s; }
Dockerfile      : node:24-alpine build (npm ci; npm run build) -> nginx:alpine, copy dist/serichai-web-portal/browser
```
**Check**: only read/send timeouts are raised; connect and client-body timeouts keep the 60 s default, enough for a 20 MB LAN upload.

## 5. Data & contracts touched

- `POST /accounts/employee-benefits` — `contracts/benefits-api-angular.md`
- `POST /accounts/bonus-calculation` — `contracts/bonus-calculation-api-angular.md`
- `POST /accounts/payroll-reconcile` — `contracts/payroll-reconciliation-api-angular.md`
- `POST /accounts/tax-deduction` — `contracts/tax-deduction-api-angular.md`
- Client-side types and request-state transitions — `data-model.md`. No storage, no backend model change.

## 6. Risks, gaps & mismatches

1. **Route renamed, FR-001 not met.** React serves `/tax-deduction`; Angular serves `/elderly-tax-deduction` (commit `ad67157`), so old bookmarks fall through `**` to Home. Docs, `tasks.md` (T012/T014) and the contract still say `tax-deduction` and `features/tax-deduction/`.
2. **Navbar does not satisfy US2.** No page links and no `routerLinkActive`, only brand link and avatar menu; pages are reachable from Home cards only. Profile/Settings/Logout are `<a>` without `href`.
3. **Dead template links.** Employee-benefits and bonus Instruction step 3 render `<a href="" download="Tax_Reduction_Input.xlsx">` (`templateUrl = ''`); a click downloads the current page as `.xlsx`. React had no such link. Payroll declares an unused `templateUrl`. Only the tax page link is valid.
4. **`getEmployeeStatus` placement.** `data-model.md`, the contract and T012 expect a pure `features/tax-deduction/employee-status.ts` with its own spec; it is a component method covered only via the page spec.
5. **`apiCall.run` is not a guard.** `data-model.md` says "no-op while pending"; code cancels and restarts. FR-004 holds only via each page's `pending()` early return plus `[disabled]`.
6. **Dev proxy only via `npm start`.** `angular.json` `serve` has no `proxyConfig`; bare `ng serve` or IDE launch gets 404 on `/accounts`. Docs say "`ng serve` with proxy".
7. **Lint boundary gap.** `shared/` may import `@/core/*` (alias not matched).
8. **Naming drift.** Docs use `benefits.*`, `bonus.*`, `TaxDeduction*`; code uses `employee-benefits.*`, `bonus-calculation.*`, `ElderlyTaxDeduction*`; selector `app-tax-deduction` is stale; the `API_BASE_URL` string is a description, not a default.
9. **Deleted `ANGULAR_MIGRATION_PLAN.md`** is still cited as authoritative by plan, research, tasks, spec and `eslint.config.js` comments.
10. **FR-017 vs working tree.** `backend/main.py` has an uncommitted edit (CORS default 4200, router ordering); behaviour-neutral for the API but a backend touch.
11. **Deploy points at React until T017.** `docker-compose.yml` builds `./frontend` and the devcontainer runs `cd frontend && npm ci`, so `docker compose up` builds React today; T016's containerised check must follow the rename.
12. **Behaviour changes to confirm at parity review.** Bonus previous-year file is optional (React demanded it); unknown URL now redirects to `/` instead of rendering Home in place; `enterprise` DaisyUI theme replaced by `light` plus copied tokens (SC-003); FastAPI 422 array `detail` shows only the generic message; malformed base64 throws silently.

## 7. Open questions

1. Add `{ path: 'tax-deduction', redirectTo: 'elderly-tax-deduction' }`, or amend FR-001 and the docs to the new address?
2. Add page links with `routerLinkActive` to the navbar (visible change from React), or reword US2 to "reachable from Home" and remove the dead avatar items?
3. Remove the dead "Download the template" step on employee-benefits and bonus (recommended), or supply real templates in `public/`?
4. Extract `getEmployeeStatus` to `employee-status.ts` with a spec (recommended for FR-014), or keep it and fix the docs?
5. Make `apiCall.run` return early while pending, or correct `data-model.md`? Also add `proxyConfig` to `angular.json` `serve` and `@/core/*` to the `shared` lint rule?
6. Restore `ANGULAR_MIGRATION_PLAN.md` under this spec directory, or replace the references with this design plus `research.md`? Commit or revert the `backend/main.py` edit separately?
