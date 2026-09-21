# API Contract: Elderly-Employee Tax Deduction Calculation

Extends the existing `/accounts` router (`backend/routers/accounts.py`), delegating to a new `backend/services/tax_deduction_service.py`, per `CLAUDE.md`'s router→service layering (a fourth independently-owned service behind `/accounts`, alongside `accounts_service.py`, `bonus_service.py`, `payroll_reconcile_service.py`).

One endpoint, one JSON response envelope — `summary` + `employees` + an embedded base64 report — the same shape `CalculateBonusResponse` (`bonus_report`) and `ReconcilePayrollResponse` (`reconciliation_report`) already use (`research.md` #7). There is no separate binary-download endpoint, no separate on-screen-JSON endpoint, and no separate rules-lookup endpoint: this single call satisfies FR-008 (generated report), FR-009 (on-screen breakdown), and FR-010 (rules applied) at once. The report is built from the static `backend/data/Tax_Reduction_Template.xlsx` template (`research.md` #6, revised) — matching `accounts_service.py`/`bonus_service.py`'s static-template convention — not from the uploaded file itself.

All JSON request/response bodies (and multipart field names) use **camelCase** keys, per `CLAUDE.md` and Constitution Principle III, bridged via the shared `CamelModel` alias generator (`backend/models/common.py`).

## `POST /accounts/tax-deduction`

Computes the elderly-employee deduction (FR-001 through FR-007) and returns, in one response: the run's summary (headcount/eligibility figures plus every rule constant applied), the full per-employee breakdown, and the generated report.

**Request**: `multipart/form-data`

| Field | Required | Type | Notes |
|---|---|---|---|
| payrollFile | yes | file (.xlsx) | Must contain the `ข้อมูลพนักงาน` roster sheet matching the known template (`data-model.md`). Its own calculation/output sheet, if any, is not read — the report comes from a static, code-owned template instead. |
| referenceDate | no | string, `YYYY-MM-DD` | Age/salary reference date (FR-002). Defaults to today when omitted. |

**Response 200** — `application/json`

```json
{
  "summary": {
    "referenceDate": "2026-12-31",
    "totalHeadcount": 150,
    "eligibleCount": 20,
    "headcountCap": 15,
    "selectedCount": 15,
    "ageThreshold": 60,
    "salaryCapPerMonth": 15000.0,
    "headcountCapPercent": 0.10,
    "headcountCapRounding": "floor",
    "beYearOffset": 543
  },
  "employees": [
    {
      "seq": 1,
      "idCardNumber": "9361832421024",
      "prefix": "นาง",
      "firstName": "นุ่ม",
      "lastName": "นิ่ม",
      "dateOfBirth": "1954-03-26",
      "age": 72,
      "averageMonthlySalary": 14678.92,
      "eligible": true,
      "rank": 3,
      "selected": true,
      "monthlyAmounts": [14665, 14669, 14739, 14616, 14660, 14749, 14717, 14666, 14724, 14681, 14611, 14650],
      "totalAmount": 176147
    }
  ],
  "taxDeductionReport": {
    "filename": "tax_deduction_report.xlsx",
    "contentBase64": "..."
  }
}
```

Pydantic models (`backend/models/tax_deduction.py`): `TaxDeductionSummary`, `TaxDeductionEmployeeResult`, `CalculateTaxDeductionResponse` (`data-model.md`). `employees` lists every roster row (not eligible-only), sorted by `totalAmount` descending — the highest-deduction employee first — with ties (e.g. every non-selected employee, all at `0`) broken by ascending `seq` for determinism. The frontend still distinguishes the three FR-014 states from `eligible`/`selected`, not from list position, but the list order itself is now meaningful (highest-value employees surface first) rather than incidental. The generated report is unaffected by this ordering: `taxDeductionReport` always places each employee in their own fixed row (`5 + seq - 1`) regardless of `employees`' order, since `fill_output_workbook` re-sorts by `seq` internally. `taxDeductionReport` is the static `backend/data/Tax_Reduction_Template.xlsx` template filled in with the computed results and re-encoded as base64 (`research.md` #6, revised) — not the uploaded file — with a fixed filename (`FileAttachment`, `backend/models/common.py`).

**Response 4xx** — `application/json`

```json
{ "detail": "string" }
```

- **422**: `payrollFile` missing entirely, or `referenceDate` present but not a valid date — FastAPI's automatic request validation, no custom code (`research.md` #9).
- **400**: `payrollFile` uploaded but structurally malformed — missing the `ข้อมูลพนักงาน` roster sheet, missing an identity column, or missing/miscounting the roster's 12 `รวม` columns (`data-model.md` Validation rules) — raised as `tax_deduction_service.TaxDeductionRequestError`, caught in the router and translated to `HTTPException(400)`, exactly like `BenefitsRequestError`/`BonusRequestError`/`PayrollReconcileRequestError`. (The uploaded file's own output/calculation sheet, if any, is never validated — the report is generated from a static template instead.)

Per-employee outcomes (not eligible, eligible-but-excluded, selected) are never a 4xx — they're reflected as zeroed/non-zeroed rows in `employees` and in the generated report (FR-007), matching the per-row-vs-request-level distinction established by the other `/accounts` contracts.

## Frontend contract usage

- `frontend/src/services/taxDeductionService.ts`: `calculateTaxDeduction(payrollFile: File, referenceDate?: string): Promise<CalculateTaxDeductionResponse>` — posts `multipart/form-data` to `/accounts/tax-deduction` against the full backend URL (no dev proxy, per `CLAUDE.md`); response is already camelCase, mapped directly onto a matching TypeScript type (no translation layer).
- `frontend/src/pages/TaxDeduction.tsx`: a single `useMutation` whose result renders both a results table (`summary` shown above it — headcount, eligible count, cap, selected count, and the active rule constants; `employees` rendered with a status badge derived from `eligible`/`selected` — "Not eligible" / "Eligible, not selected" / "Selected" per FR-014 — plus the 12 monthly amounts + total) and a download action that decodes `taxDeductionReport.contentBase64` and triggers a browser save — the same `atob`-decode-then-`<a download>` pattern `EmployeeBenefits.tsx`'s `downloadFileAttachment` already uses for `bonus_report`/`reconciliation_report`. One-shot mutation, not a cached `useQuery` — the result is tied to one specific upload, not a resource to refetch.
