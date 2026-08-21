# API Contract Delta: Previous-Year Benefit Carry-Forward

Extends `specs/001-employee-benefit-calculation/contracts/benefits-api.md` — same endpoint, same response envelope. Only the additions below; everything not mentioned here is unchanged (still camelCase wire format via the alias generator, per `CLAUDE.md` and Constitution Principle III).

## `POST /accounts/employee-benefits`

**Request**: `multipart/form-data` — one field added.

| Field | Required | Type | Notes |
|---|---|---|---|
| masterFile | yes | file (.xlsx/.csv) | Unchanged. |
| previousBenefitsFile | **no** | file (.xlsx/.csv) | **New.** Last year's benefit report (FR-001/FR-002). Omit entirely to get identical behavior to `specs/001-employee-benefit-calculation` (FR-003). |

**Response 200** — `application/json`. Unchanged shape; two effects when `previousBenefitsFile` is supplied:

1. Matched rows' `ยอดยกมา` cell in the `employeeBenefitsReport` workbook is populated (previously always blank).
2. `exceptions[]` may include entries with `"category": "duplicateEmployeeId"` (new value), and `summary.exceptionsByCategory` may include a `duplicateEmployeeId` key.

**Workbook-shape change, independent of whether `previousBenefitsFile` is supplied**: `employeeBenefitsReport` now always includes a `รหัสพนักงาน` column (right after `ลำดับ`), populated from the master file's own employee ID. Not part of the JSON envelope above — see `data-model.md`'s "Amendment" note.

```json
{
  "summary": {
    "totalEmployeesOut": 0,
    "computedCount": 0,
    "resignedFlaggedCount": 0,
    "exceptionCount": 0,
    "exceptionsByCategory": { "missingRequiredField": 0, "duplicateEmployeeId": 0 }
  },
  "exceptions": [
    { "category": "duplicateEmployeeId", "employeeId": "1002", "employeeName": null, "detail": "string" }
  ],
  "employeeBenefitsReport": { "filename": "string", "contentBase64": "string" },
  "exceptionReport": { "filename": "string", "contentBase64": "string" }
}
```

`backend/models/benefits.py`: `ExceptionCategory` becomes `Literal["missingRequiredField", "duplicateEmployeeId"]`. No new Pydantic model — `ExceptionEntry`, `CalculationSummary`, `FileAttachment`, `CalculateBenefitsResponse` are all reused as-is (research.md #3).

**Response 4xx** — unchanged shape (`{ "detail": "string" }`), with two new triggering cases specific to `previousBenefitsFile` (only checked when it is supplied at all):

- It is present but empty/unreadable (FR-005) — same failure mode as an unreadable master file.
- It is present but missing `รหัสพนักงาน` or `ผลประโยชน์ของพนักงานที่คาดว่าต้องจ่าย ณ วันสิ้นปีปัจจุบัน` entirely (FR-004) — same failure mode as a master file missing a required column.

A duplicated ID *within* an otherwise-valid previous-year file is **not** a 4xx — it's a per-ID condition reported via `exceptions[]` in a normal 200 response (FR-008), exactly like a `missingRequiredField` row today.

## Frontend contract usage

- `frontend/src/services/benefitsService.ts`: `calculateBenefits(masterFile, previousBenefitsFile?)` — appends `previousBenefitsFile` to the existing `FormData` only when a file was chosen; omitting it sends the exact same request as today. `ExceptionCategory` type gains `"duplicateEmployeeId"`.
- `frontend/src/pages/EmployeeBenefits.tsx`: a second, optional `<input type="file">` under "Data Source" (mirroring the existing master-file input), wired into the same `useMutation` call. No new UI state beyond one more `useState<File | null>`.
