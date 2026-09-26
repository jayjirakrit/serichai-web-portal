# API Contract Delta: Bonus Calculation (Angular consumer)

Extends `specs/004-bonus-calculation/contracts/bonus-calculation-api.md`. **Backend unchanged** (FR-017): same endpoint, request, response, 4xx behaviour. Error body `{ "detail": string }`; client shows `detail`, else `Request failed with status <status>`.

## `POST /accounts/bonus-calculation`

Multipart fields (unchanged): `currentYearFile` (required .xlsx), `previousYearSummaryFile` (optional .xlsx; when omitted, previous-year grade/bonus are left blank and `previousBonusNotFound` is not flagged), `year` (required string). Response 200 = `CalculateBonusResponse` in `data-model.md` (`summary`, `flaggedEmployees`, `bonusReport`).

## Frontend contract usage

- `frontend/src/app/features/bonus-calculation/bonus.service.ts`: `calculate(currentYearFile: File, previousYearSummaryFile: File | null, year: string): Observable<CalculateBonusResponse>` - `HttpClient.post` of `FormData` to `${API_BASE_URL}/accounts/bonus-calculation`; no `Content-Type` header.
- `frontend/src/app/features/bonus-calculation/bonus-calculation.ts` (+ `.html`): `tab = signal<'cal' | 'config'>`; `apiCall` state; inline message when the current-year file or `year` is missing (previous-year file is optional); result renders `summary`, `flaggedEmployees` (null numerics shown as `-`), download of `bonusReport`.
