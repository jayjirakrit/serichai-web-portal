# API Contract: Payroll Reconciliation

Extends the existing `/accounts` router (`backend/routers/accounts.py`), delegating to a new `backend/services/payroll_reconcile_service.py` — a second, independently-owned service behind the same router as `accounts_service.py`, per `CLAUDE.md`'s router→service layering (see `plan.md`'s Constitution Check, Principle III note, for why this endpoint lives under `/accounts` rather than a new router).

All JSON request/response bodies use **camelCase** keys, per the repo-wide API convention in `CLAUDE.md` and Constitution Principle III. Backend Python internals stay `snake_case` (PEP 8); Pydantic models bridge the two via the shared `CamelModel` alias generator (`backend/models/common.py`, also used by `backend/models/benefits.py`).

## `POST /accounts/payroll-reconcile`

Creates one reconciliation run: recalculates every employee's net wage for the selected pay period from the uploaded payroll file and compares it to the amount already stated in that file (FR-001 through FR-009, FR-011 through FR-014).

**Request**: `multipart/form-data`

| Field | Required | Type | Notes |
|---|---|---|---|
| payrollFile | yes | file (.xlsx) | The payroll working file — department sections, paired employee/overtime rows (FR-001). |
| period | yes | string, `YYYY-MM` | The pay period to reconcile, e.g. `2026-08`. Converted server-side to the sheet-name token `ประจำ {M-yy}` (`research.md` #3) to locate the matching sheet (FR-002). |

**Response 200** — `application/json`

```json
{
  "summary": {
    "totalEmployeesReconciled": 0,
    "matchedCount": 0,
    "discrepancyCount": 0,
    "discrepanciesByDepartment": { "สำนักงาน": 0 }
  },
  "discrepancies": [
    {
      "department": "string",
      "employeeId": "string",
      "employeeName": "string",
      "statedAmount": 0,
      "recalculatedAmount": 0,
      "variance": 0,
      "status": "discrepancy",
      "detail": "string"
    }
  ],
  "reconciliationReport": { "filename": "string", "contentBase64": "string" },
  "discrepancyReport": { "filename": "string", "contentBase64": "string" }
}
```

Pydantic models (`backend/models/payroll.py`): `ReconciliationEntry`, `ReconciliationSummary`, `ReconcilePayrollResponse`; `FileAttachment` and `CamelModel` are imported from `backend/models/common.py` (shared with `benefits.py`). `status` is a `Literal["discrepancy", "unrecognizedDepartment", "dataError"]`. `discrepancyReport` is `null` when `summary.discrepancyCount == 0` (`data-model.md`).

**Response 4xx** — `application/json`

```json
{ "detail": "string" }
```

A 4xx is a request-level failure: the selected `period` has no matching sheet in the uploaded file, the file is missing the `วันหยุด`/`วันปกติ` header markers required to locate columns, or the file is unreadable/empty. This is distinct from a per-employee problem (unrecognized department, malformed row, or a wage mismatch), which always comes back as 200 with that employee represented in `discrepancies[]` — never as an error status (mirrors `contracts/benefits-api.md`'s per-row vs. request-level distinction).

## Frontend contract usage

- `frontend/src/services/payrollReconcileService.ts`: `reconcilePayroll(payrollFile, period): Promise<ReconcilePayrollResponse>` — posts to `/accounts/payroll-reconcile` as `multipart/form-data` with `payrollFile` and `period` fields, against the full backend URL (no dev proxy configured, per `CLAUDE.md`). The response is already camelCase and maps directly onto a camelCase TypeScript type.
- `frontend/src/pages/PayrollReconcile.tsx`: a `useMutation` (TanStack Query) calling `reconcilePayroll`; on success, renders `summary` and `discrepancies` in a "Reconciliation Summary" panel (mirroring `EmployeeBenefits.tsx`'s "Validation Summary" panel) and exposes a download action for `reconciliationReport`, plus one for `discrepancyReport` shown only when it's non-null.
- One-shot mutation, not a cached query — no query key needed beyond the mutation itself.
