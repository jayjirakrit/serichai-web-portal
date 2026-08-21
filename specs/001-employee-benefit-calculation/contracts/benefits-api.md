# API Contract: Employee Benefit Calculation

Extends the existing `/accounts` router (`backend/routers/accounts.py` → `backend/services/accounts_service.py`), per `CLAUDE.md`'s router→service layering.

All JSON request/response bodies use **camelCase** keys, per the repo-wide API convention recorded in `CLAUDE.md` and the constitution (Principle III). Backend Python internals stay `snake_case` (PEP 8); Pydantic models bridge the two via a camelCase alias generator (see Frontend/Backend notes below).

## `POST /accounts/employee-benefits`

Computes the benefit calculation directly from the employee master file — no payroll file, no previous-year file (`research.md` #12, spec.md "Design history"). Always recomputes every liability column from the formula; there is no carry-forward from a prior cycle.

**Request**: `multipart/form-data`

| Field | Required | Type | Notes |
|---|---|---|---|
| masterFile | yes | file (.xlsx/.csv) | Employee master data — the only input (FR-001). |

**Response 200** — `application/json`

```json
{
  "summary": {
    "totalEmployeesOut": 0,
    "computedCount": 0,
    "resignedFlaggedCount": 0,
    "exceptionCount": 0,
    "exceptionsByCategory": { "missingRequiredField": 0 }
  },
  "exceptions": [
    { "category": "missingRequiredField", "employeeId": null, "employeeName": "string", "detail": "string" }
  ],
  "employeeBenefitsReport": { "filename": "string", "contentBase64": "string" },
  "exceptionReport": { "filename": "string", "contentBase64": "string" }
}
```

Pydantic models (`backend/models/benefits.py`): `ExceptionEntry`, `CalculationSummary`, `FileAttachment`, `CalculateBenefitsResponse` — each configured with a camelCase `alias_generator` (Pydantic's `to_camel`) plus `populate_by_name=True` so Python attributes stay `snake_case`. `ExceptionCategory` has a single value, `missingRequiredField`.

**Response 4xx** — a request-level failure (the file is missing a required column entirely, or is empty/unreadable) returns:

```json
{ "detail": "string" }
```

This is distinct from per-employee exceptions: a 4xx means the request as a whole could not be processed; a row missing a required *value* (date of birth, start date, or wage rate) always comes back as 200 + `exceptions[]`, never as an error status (FR-003).

## Frontend contract usage

- `frontend/src/services/benefitsService.ts`: `calculateBenefits(masterFile): Promise<CalculateBenefitsResponse>` — wraps the `fetch` call against the full backend URL (no dev proxy configured, per `CLAUDE.md`), posting to `/accounts/employee-benefits` with a single `masterFile` multipart field. The response is already camelCase, so it maps directly onto a camelCase TypeScript type with no field-translation layer.
- `frontend/src/pages/EmployeeBenefits.tsx`: a `useMutation` (TanStack Query) calling `calculateBenefits`; on success, renders `summary`/`exceptions` in the "Validation Summary" panel and exposes two download actions — one for `employeeBenefitsReport`, one for `exceptionReport` — that decode `contentBase64` into a `Blob` and trigger a browser save.
- This is a one-shot mutation, not a cached query: no query key is needed beyond the mutation itself.
