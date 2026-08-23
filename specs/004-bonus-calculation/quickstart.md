# Quickstart: Validating Bonus Calculation

## Prerequisites

- Backend running: `cd backend; .venv\Scripts\activate; uvicorn main:app --reload` (serves `http://127.0.0.1:8000`).
- Frontend running: `cd frontend; npm run dev` (serves `http://localhost:5173`).
- Fixture files matching `data-model.md`/`research.md` #3's layout — the repo-root reference files (`ข้อมูลพนักงานปี_68.xlsx`, `สรุปโบนัส_68.xlsx`) already exercise a real employee (`ชิติมา กตัญญู`, flagged `leaveNotFound`) and can be copied into `backend/tests/fixtures/` as the base fixture; implementation tasks should also build small edited copies for the scenarios below (mirrors `specs/003`'s quickstart — no fixture-building tooling exists yet, this feature needs its own).

## Scenario 1 — Full run, review results (User Story 1, AC1-AC3)

1. On the Bonus Calculation page (`/bonus-calculation`, Calculation tab), upload the current-year data file and the previous-year summary file, enter the year (e.g. `2025`), and submit.
2. Confirm the on-screen summary shows total employees processed, number successfully calculated, and number flagged as exceptions, and that every flagged employee is individually listed by name and exception reason (spec Clarifications, 2026-08-23 (3)) — a successfully-calculated employee is not listed individually on screen.
3. Open the downloaded report (Scenario 2) and confirm at least one employee whose `otCategoryCode` is `"OT SEWING"` or `"OT PAINT"` was scored using that department's OT table, not the general one (compare against `research.md` #7's thresholds) — this and the remaining per-employee checks below are verified in the report, since full detail is report-only.
4. In the downloaded report, confirm an employee whose deductions outweigh their grade shows a negative `totalScore` (not clamped) but a `provisionalDays`/`provisionalBonus` of `0`.
5. Attempt to submit with one file missing — confirm the frontend blocks the request before it's sent.

## Scenario 2 — Download and finalize the report (User Story 2, AC1-AC3)

1. From the same submission as Scenario 1 (calculating and downloading are one action, `research.md` #1), confirm the response also includes a downloadable `bonusReport` and that the page offers it for download immediately — no separate "run calculation" step first.
2. Open the downloaded `.xlsx`. Confirm it contains every employee (finalized and not), each with their scores, provisional bonus, previous-year comparison, a blank approved-day-count cell, and an empty final-bonus cell.
3. Fill in an approved day count for one employee directly in the file. Confirm that employee's final-bonus cell calculates automatically (spreadsheet formula, `research.md` #10) — no interaction with the web app required — and that no other employee's row changed.
4. Confirm an employee flagged with a blocking exception (e.g. `evaluationNotFound`) has a blank provisional bonus, and that filling in an approved day count for that employee's row still leaves the final-bonus cell blank rather than producing a number (FR-013).
5. Confirm any employee with an exception note appears in the report with that note intact, not omitted.

## Scenario 3 — Trust results when data doesn't fully match (User Story 3, AC1-AC3)

1. In a copy of the fixture, remove one employee's row from the evaluation sheet, remove a different employee's row from the leave sheet, and remove a third employee's row from the previous-year summary sheet.
2. Upload, submit, and confirm all three employees appear individually in the on-screen `flaggedEmployees` list (each exception category makes its employee appear there, `data-model.md`): the evaluation-missing one is flagged `evaluationNotFound` with `totalScore` blank (visible in the downloaded report); the leave-missing one is flagged `leaveNotFound` but still has a fully computed `totalScore` in the report (leave scores default to zero contribution, `research.md` #8); the previous-year-missing one is flagged `previousBonusNotFound`, calculates normally, and its report row shows `previousGradeLetter`/`previousBonus` both blank.
3. Confirm the run summary's `exceptionCount` reflects all three, that `flaggedEmployees` lists exactly those three, and that the run otherwise completed for every other employee (visible only in the downloaded report, not listed individually on screen).
4. Re-run with an unmodified fixture and confirm the summary shows zero exceptions, `flaggedEmployees` is empty, and the UI presents this as a successful run (not an empty/error state).

## Scenario 4 — Correctness against known reference data (SC-003, `research.md` #11)

1. Run a calculation using `ข้อมูลพนักงานปี_68.xlsx` as the current-year file and a file containing `สรุปโบนัส_68.xlsx`'s `ผลสรุปโบนัสปี_67` sheet as the previous-year summary.
2. For the flagged `leaveNotFound` example row (`ชิติมา กตัญญู`), compare the on-screen `flaggedEmployees` entry's computed `currentGradeLetter`, component scores, `totalScore`, and `provisionalBonus` against `สรุปโบนัส_68.xlsx`'s own `ผลสรุปโบนัสปี_68` sheet (if present) figure-for-figure. For a small sample spanning each of the three OT-category tables plus one negative-`totalScore` employee — none of which are necessarily flagged — make the same comparison against their rows in the downloaded report instead, since they may not appear in `flaggedEmployees`.
3. Confirm they match exactly — this is the acceptance bar for SC-003, not a separate synthetic fixture.

## Scenario 5 — Request-level failures (FR-003)

1. Submit `year` such that the resolved sheet name (e.g. `ผลประเมินปี_99`) doesn't exist in `currentYearFile` — confirm a 4xx naming the missing sheet.
2. Submit a `previousYearSummaryFile` missing its `ผลสรุปโบนัสปี_<prevYY>` sheet — confirm a 4xx naming it.

## Expected artifacts per run

- `summary` + `flaggedEmployees` + `bonusReport` — all three from the single `POST /accounts/bonus-calculation` call, rendered/offered together in the Calculation tab.

## Out of scope for this quickstart

The Configuration tab stays a visual placeholder in v1 (spec.md Assumptions) — nothing to validate there.
