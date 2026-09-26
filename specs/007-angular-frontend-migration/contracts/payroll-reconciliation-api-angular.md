# API Contract Delta: Payroll Reconciliation (Angular consumer)

Extends `specs/003-payroll-reconcile/contracts/payroll-reconciliation-api.md`. **Backend unchanged** (FR-017). Error body `{ "detail": string }`; client shows `detail`, else `Request failed with status <status>`.

## `POST /accounts/payroll-reconcile`

Multipart fields (unchanged): `payrollFile` (required .xlsx), `period` (required, `YYYY-MM`). Response 200 = `ReconcilePayrollResponse` in `data-model.md`; `discrepancyReport` is `null` when there are no discrepancies.

## Frontend contract usage

- `frontend/src/app/features/payroll-reconcile/payroll-reconcile.service.ts`: `reconcile(payrollFile: File, period: string): Observable<ReconcilePayrollResponse>` - `HttpClient.post` of `FormData` to `${API_BASE_URL}/accounts/payroll-reconcile`; no `Content-Type` header.
- `frontend/src/app/features/payroll-reconcile/payroll-reconcile.ts` (+ `.html`): `period` bound to `<input type="month">` via `[value]`/`(input)`; `apiCall` state; inline message when file or period is missing; result renders `summary`, `discrepancies`, download of `reconciliationReport` and, only when non-null, `discrepancyReport`.
