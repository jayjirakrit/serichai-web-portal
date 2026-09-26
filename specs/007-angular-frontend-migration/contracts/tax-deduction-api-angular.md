# API Contract Delta: Tax Deduction (Angular consumer)

Extends `specs/006-elderly-tax-deduction/contracts/tax-deduction-api.md` (note: the current `TaxDeductionEmployeeResult` also carries `disabled: boolean`, added after that contract; the type in `data-model.md` matches the live backend model `backend/models/tax_deduction.py`). **Backend unchanged** (FR-017). Error body `{ "detail": string }`; client shows `detail`, else `Request failed with status <status>`.

## `POST /accounts/tax-deduction`

Multipart fields: `payrollFile` (required .xlsx). `referenceDate` remains optional on the backend but the Angular client **never sends it** (FR-010; the React page never bound it either). Response 200 = `CalculateTaxDeductionResponse` in `data-model.md`.

## Frontend contract usage

- `frontend/src/app/features/tax-deduction/tax-deduction.service.ts`: `calculate(payrollFile: File): Observable<CalculateTaxDeductionResponse>` - `HttpClient.post` of `FormData` (only `payrollFile`) to `${API_BASE_URL}/accounts/tax-deduction`; no `Content-Type` header.
- `frontend/src/app/features/tax-deduction/tax-deduction.ts` (+ `.html`): `apiCall` state; inline message when no file; summary block, employees table with status badge from `employee-status.ts` (`getEmployeeStatus`, ported unchanged), rules collapse, template link `/Tax_Reduction_Input.xlsx` (served from `public/`), download of `taxDeductionReport`.
