# Data Model: Previous-Year Benefit Carry-Forward

Extends `specs/001-employee-benefit-calculation/data-model.md` — only the additions/changes below; all other entities (EmployeeMasterRecord, BenefitCalculationEntry, BenefitFormulaAssumptions) are unchanged. Same in-memory-only lifetime, same Thai-header/BE-date conventions.

## PreviousBenefitRecord (from the optional previous-year file)

One row from the "Previous Employee Benefits" file. Only two columns are used; any other column in that file is ignored.

| Field | Type | Notes |
|---|---|---|
| employee_id_raw | str \| float \| None | From `รหัสพนักงาน`. Normalized via `_normalize_employee_id()` (research.md #1) before use. |
| prior_liability | number | From `ผลประโยชน์ของพนักงานที่คาดว่าต้องจ่าย ณ วันสิ้นปีปัจจุบัน`. Copied unmodified into `ยอดยกมา` on a match — no recalculation (FR-006). |

## CarryForwardLookup (derived, request-scoped)

`dict[str, number]` mapping a normalized employee ID to the single previous-year liability value for that ID. Built by `compute_carry_forward()`:

- Rows whose normalized ID is `None` (blank) are dropped — not included, not duplicate-counted (research.md #5).
- Rows whose normalized ID occurs more than once are **excluded from the lookup** (no value carried forward for that ID) and instead produce one `DuplicateIdException` (below) per duplicated ID.
- Empty dict (`{}`) when no previous file is supplied — the natural "no-op" state that makes carry-forward strictly additive (FR-010).

## BenefitCalculationEntry — field addition

`specs/001-employee-benefit-calculation/data-model.md` already lists `ยอดยกมา` as an always-blank output field. This feature is what populates it:

| Field | Source |
|---|---|
| ยอดยกมา | `CarryForwardLookup.get(normalize(master_row.employee_id))`, or blank if no key matches (unmatched ID, blank ID, or an ID that was dropped as a duplicate). |

Matching key (`employee_id`) is read from the master file's own `รหัสพนักงาน` column when present (newly consumed by this feature — see research.md #4).

**Amendment (as implemented, supersedes the earlier "no new output column" Assumption)**: `รหัสพนักงาน` is also written to the output workbook as a new column (`OUTPUT_COLUMNS`, immediately after `ลำดับ`), populated with the same normalized `employee_id`. This closes the loop the spec's own Assumptions describe: the "previous file" is expected to be last year's own output, so this year's output needs a `รหัสพนักงาน` column for *next* year's carry-forward to have anything to match against — the base feature (001) never emitted one. Present unconditionally (not gated on `previousBenefitsFile` being supplied), since it costs nothing when carry-forward isn't used and is required for it to ever work in future years.

**Bundled change, out of this feature's stated scope (FR-010 exception — flagged, not silently absorbed)**: The same implementation pass changed how several existing (001) output fields are populated, gated on `is_resigned`:

| Field | Previous (001) behavior | Current behavior |
|---|---|---|
| เงินเดือน ณ สิ้นปีปัจจุบัน | Always `current_salary` | `current_salary` if resigned, else `0` |
| เงินเดือน ณ วันเกษียณ, ผลประโยชน์ของพนักงานที่ต้องจ่าย ณ วันเกษียณ, ประมาณการหนี้สินผลประโยชน์...ณ วันเกษียณ, ผลประโยชน์...ณ วันสิ้นปีปัจจุบัน | Always the computed value | Computed value if resigned, else `None` (blank) |
| ลาออก | `bool` (`True`/`False`) | `str` — `"ใช่"` / `"ไม่ใช่"` |

This is a change to the base (001) calculation's output shape, not to carry-forward matching itself — carry-forward (`ยอดยกมา`) is unaffected either way. It is documented here because it landed in the same manual backend update this spec folder is being reconciled against; the base feature's own spec/data-model (`specs/001-employee-benefit-calculation/`) has not been updated to match and should be treated as stale on these fields until it is.

## ExceptionRecord — category addition

Extends `specs/001-employee-benefit-calculation/data-model.md`'s `ExceptionRecord`. Same wire shape (`ExceptionEntry`, camelCase via alias generator); one new category value:

| Field (wire) | Type | Notes |
|---|---|---|
| category | `"missingRequiredField" \| "duplicateEmployeeId"` | New value: `duplicateEmployeeId`, one entry per duplicated ID found in the previous-year file (not per duplicate row). |
| employeeId | str \| None | For `duplicateEmployeeId`, set to the duplicated ID (first time this field is actually populated — previously always `None`, per 001's data-model). |
| employeeName | str \| None | `None` for `duplicateEmployeeId` (the duplicate is a property of the previous-year file, not tied to one current-year employee). |
| detail | str | Human-readable, e.g. identifies the ID and that `ยอดยกมา` was left blank for matching employees. |

## Validation rules (from Functional Requirements)

- Previous-year file supplied but missing `รหัสพนักงาน` or `ผลประโยชน์ของพนักงานที่คาดว่าต้องจ่าย ณ วันสิ้นปีปัจจุบัน` entirely → request fails (4xx), same as a master file missing a required column (FR-004).
- Previous-year file supplied but empty/unreadable → request fails (4xx), same as the master file (FR-005).
- Previous-year file omitted entirely → identical output to today's single-file calculation, `ยอดยกมา` blank throughout (FR-003).
- An ID duplicated within the previous-year file → `ยอดยกมา` blank for every current-year employee matching that ID, plus one `duplicateEmployeeId` exception (FR-008).
