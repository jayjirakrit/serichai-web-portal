# API Contract Delta: Employee Benefits (Angular consumer)

Extends `specs/001-employee-benefit-calculation/contracts/benefits-api.md` and `specs/002-previous-benefit-carryforward/contracts/benefits-api-carryforward.md`. **Backend unchanged** (FR-017): same endpoint, request, response, and 4xx behaviour. Only the frontend consumer changes. Error body is `{ "detail": string }`; the client shows `detail`, else `Request failed with status <status>`.

## `POST /accounts/employee-benefits`

Multipart fields (unchanged): `masterFile` (required .xlsx), `previousBenefitsFile` (optional .xlsx). Response 200 fields = `CalculateBenefitsResponse` in `data-model.md`.

## Frontend contract usage

- `frontend/src/app/features/employee-benefits/benefits.service.ts`: `calculate(masterFile: File, previousBenefitsFile?: File | null): Observable<CalculateBenefitsResponse>` - `HttpClient.post` of `FormData` to `${API_BASE_URL}/accounts/employee-benefits`; `previousBenefitsFile` appended only when present; no `Content-Type` header set.
- `frontend/src/app/features/employee-benefits/employee-benefits.ts` (+ `.html`): `apiCall(...)` state drives idle/pending/error/success; missing `masterFile` shows an inline message (no request); result panel lists `summary`, `exceptions`, and two downloads (`employeeBenefitsReport`, `exceptionReport`) via `shared/utils/download.ts`.
