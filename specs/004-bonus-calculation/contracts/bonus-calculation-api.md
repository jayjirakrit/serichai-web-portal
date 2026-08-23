# API Contract: Bonus Calculation

Extends the existing `/accounts` router (`backend/routers/accounts.py`), delegating to a new `backend/services/bonus_service.py` — a third, independently-owned service behind the same router as `accounts_service.py`/`payroll_reconcile_service.py`, per `CLAUDE.md`'s router→service layering (same one-router/multiple-services convention `specs/003`'s Constitution Check documents).

All JSON request/response bodies use **camelCase** keys, per the repo-wide API convention in `CLAUDE.md` and Constitution Principle III. Backend Python internals stay `snake_case` (PEP 8); Pydantic models bridge the two via the shared `CamelModel` alias generator (`backend/models/common.py`).

## `POST /accounts/bonus-calculation`

Runs one bonus-calculation pass: scores every employee in the uploaded current-year data against the fixed rule tables, joins in their previous-year grade/bonus for comparison, and returns a summary, the flagged-employee subset (for on-screen review), and a downloadable report with every employee's full detail — in one call, matching the `CalculateBenefitsResponse`/`ReconcilePayrollResponse` pattern already used by `contracts/benefits-api.md` and `contracts/payroll-reconciliation-api.md` (FR-001 through FR-016). The `flaggedEmployees`/`discrepancies` shape specifically mirrors `contracts/payroll-reconciliation-api.md`'s `ReconcilePayrollResponse` — only employees needing review are returned as individual wire objects (spec Clarifications, 2026-08-23 (3)).

**Request**: `multipart/form-data`

| Field | Required | Type | Notes |
|---|---|---|---|
| currentYearFile | yes | file (.xlsx) | Must contain `ผลประเมินปี_<YY>`, `วันทำงานปี_<YY>`, `วันลาปี_<YY>` for the resolved year (FR-001, FR-003). |
| previousYearSummaryFile | yes | file (.xlsx) | Must contain `ผลสรุปโบนัสปี_<prevYY>` (FR-002, FR-014). |
| year | yes | string, Gregorian year, e.g. `"2025"` | Converted server-side to BE sheet-name suffixes for both files (`research.md` #5), and to label the two year-relative columns in the generated report (`research.md` #9). |

**Response 200** — `application/json`

```json
{
  "summary": {
    "totalEmployees": 0,
    "calculatedCount": 0,
    "exceptionCount": 0,
    "exceptionsByCategory": { "leaveNotFound": 0 }
  },
  "flaggedEmployees": [
    {
      "employeeId": null,
      "matchKey": "string",
      "prefix": "string",
      "firstName": "string",
      "lastName": "string",
      "departmentNotes": "string",
      "otCategoryCode": "OT",
      "payRate": 0,
      "startDate": "2025-01-01",
      "workDays": 0,
      "totalOt": 0,
      "totalNotWorked": 0,
      "sickLeaveDays": 0,
      "personalLeaveDays": 0,
      "specialPersonalLeaveDays": 0,
      "absentDays": 0,
      "vacationDays": 0,
      "currentGradeNumeric": 0,
      "currentGradeLetter": "A",
      "previousGradeLetter": "A",
      "previousBonus": 0,
      "personalLeaveScore": 0,
      "sickLeaveScore": 0,
      "absentScore": 0,
      "vacationScore": 0,
      "workingDaysScore": 0,
      "otScore": 0,
      "totalScore": 0,
      "provisionalDays": 0,
      "provisionalBonus": 0,
      "exceptions": ["leaveNotFound"],
      "exceptionNote": "string"
    }
  ],
  "bonusReport": { "filename": "string", "contentBase64": "string" }
}
```

`flaggedEmployees` contains only employees with a non-empty `exceptions` array — a fully-calculated employee with no exceptions is represented solely by `summary`'s counts and by their row in `bonusReport`, not as an individual wire object here (spec Clarifications, 2026-08-23 (3)).

Pydantic models (`backend/models/bonus.py`): `EmployeeBonusRecord`, `BonusCalculationSummary`, `CalculateBonusResponse`. `exceptions` items are a `Literal` (`BonusExceptionCategory`, see `data-model.md`). `bonusReport` reuses `FileAttachment` from `backend/models/common.py`, unchanged.

`EmployeeBonusRecord` carries no `approvedDays`/`finalBonus` fields — per spec Clarifications (2026-08-23 (2)), approved-day entry and final-bonus calculation happen only inside `bonusReport` itself (a spreadsheet formula, `data-model.md`'s "Generated report layout"), never as API/on-screen state.

**Response 4xx** — `application/json`

```json
{ "detail": "string" }
```

A 4xx is a request-level failure: either file is missing/unreadable, or the resolved sheet name (`ผลประเมินปี_<YY>`, `วันทำงานปี_<YY>`, `วันลาปี_<YY>`, or `ผลสรุปโบนัสปี_<prevYY>`) doesn't exist in its respective file. This is distinct from a per-employee problem (unmatched across sources, unrecognized OT category, blank evaluation, duplicate name), which always comes back as 200 with that employee represented in `flaggedEmployees[]` via `exceptions`/`exceptionNote` — never as an error status (same request-level-vs-per-row split as `contracts/payroll-reconciliation-api.md` and `specs/001`'s `contracts/benefits-api.md`).

## Frontend contract usage

- `frontend/src/services/bonusService.ts`: `calculateBonus(currentYearFile, previousYearSummaryFile, year): Promise<CalculateBonusResponse>` — posts to `/accounts/bonus-calculation` as `multipart/form-data`, against the full backend URL (no dev proxy, per `CLAUDE.md`).
- `frontend/src/pages/BonusCalculation.tsx` (Calculation tab): a single `useMutation` (TanStack Query) calling `calculateBonus`; on success, renders `summary`'s counts plus a `flaggedEmployees` list (name + exception note per row, `PayrollReconcile.tsx`'s existing discrepancies-list pattern) and immediately offers `bonusReport` for download via `PayrollReconcile.tsx`'s existing `downloadFileAttachment` pattern (base64 → `Blob` → object URL → synthetic `<a download>` click) — no second mutation, no client-held run state, no "Download Report" step gated on a prior call (User Story 2).
