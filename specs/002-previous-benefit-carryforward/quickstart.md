# Quickstart: Validating Previous-Year Benefit Carry-Forward

Builds on `specs/001-employee-benefit-calculation/quickstart.md` — run that first to confirm the base calculation still works unchanged (User Story 2 of this feature is exactly that: identical output when `previousBenefitsFile` is omitted).

## Prerequisites

- Backend + frontend running as in the base quickstart.
- `sample-data/master.xlsx` (7 employees) — **note**: this file has no populated `รหัสพนักงาน` column (a known pre-existing data gap, `specs/001-employee-benefit-calculation`'s research.md). It's sufficient for the omitted-file regression check (Scenario 1) but cannot demonstrate an actual match, since there's no ID to match on.
- For Scenarios 2-4, a small hand-built pair of files with populated `รหัสพนักงาน` is needed — either a copy of `sample-data/master.xlsx` with an ID column added, or any minimal `.xlsx`/`.csv` with the required headers (`รหัสพนักงาน`, plus a `ผลประโยชน์ของพนักงานที่คาดว่าต้องจ่าย ณ วันสิ้นปีปัจจุบัน` column in the "previous" file). `curl` against the API directly is the fastest way to check these without hand-editing spreadsheets each time.

## Scenario 1 — Omitted previous file (User Story 2)

1. On the Employee Benefits page, upload only `sample-data/master.xlsx` (leave "Previous Employee Benefits" empty) and submit.
2. Confirm the result is byte-for-byte identical to the base quickstart's Scenario (same summary counts, every `ยอดยกมา` cell blank).

## Scenario 2 — Unique match carries the value forward (User Story 1)

1. Prepare a master file where one employee row has `รหัสพนักงาน` = `1002`.
2. Prepare a previous-year file with one row: `รหัสพนักงาน` = `1002`, `ผลประโยชน์ของพนักงานที่คาดว่าต้องจ่าย ณ วันสิ้นปีปัจจุบัน` = some nonzero figure (e.g. `50000`).
3. Submit both files together.
4. Download the benefit report; confirm employee `1002`'s `ยอดยกมา` equals `50000` exactly (copied unmodified, no recalculation).
5. Repeat with the ID formatted differently in each file (numeric `1002` vs. text `"1002"`, or with stray surrounding whitespace) — confirm it still matches (FR-009).

## Scenario 3 — Unmatched ID is silent (User Story 1, Acceptance Scenario 2)

1. Using the same master file as Scenario 2, submit a previous-year file whose only row has `รหัสพนักงาน` = `9999` (no overlap).
2. Confirm employee `1002`'s `ยอดยกมา` is blank and `exceptions[]` has no entry for it (not treated as an error).

## Scenario 4 — Duplicate ID in the previous-year file (User Story 3)

1. Prepare a previous-year file with two rows sharing `รหัสพนักงาน` = `1002` (different liability values).
2. Submit alongside the Scenario 2 master file.
3. Confirm employee `1002`'s `ยอดยกมา` is blank, and `exceptions[]` contains one `duplicateEmployeeId` entry with `employeeId: "1002"` — distinct from `missingRequiredField`.

## Scenario 5 — Invalid previous-year file fails the request (Acceptance Scenario 4)

1. Submit a previous-year file with neither `รหัสพนักงาน` nor `ผลประโยชน์ของพนักงานที่คาดว่าต้องจ่าย ณ วันสิ้นปีปัจจุบัน` present (e.g. an unrelated spreadsheet), alongside a valid master file.
2. Confirm the request fails (4xx) with a clear error and no output files are produced — same failure mode as an invalid master file.

## Expected artifacts per run

Same as the base feature: `summary` + `exceptions[]` in the API response, a downloadable benefit workbook, a downloadable exception report. This feature adds no new artifact — only populates `ยอดยกมา` and, when applicable, adds `duplicateEmployeeId` rows to the existing exception report.

## Out of scope for this quickstart

Populating real `รหัสพนักงาน` values in `backend/data/Employee_Master_Data.xlsx` — that's the pre-existing data-quality gap noted in `specs/001-employee-benefit-calculation`'s research.md and this feature's own Assumptions; until HR populates it, carry-forward will produce zero matches against the real data even though it works correctly against any file that does have IDs.
