# Tasks: Bonus Calculation

**Input**: Design documents from `specs/004-bonus-calculation/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/bonus-calculation-api.md, quickstart.md

**Tests**: Explicitly requested — plan.md's Testing section and research.md #11 call for `backend/tests/test_bonus_calculation.py`, including a correctness check against real reference data. Test tasks are included below.

**Organization**: Tasks are grouped by user story (US1/US2/US3 from spec.md) to enable independent implementation and testing of each.

**Design note (spec Clarifications, 2026-08-23 (3))**: The API/on-screen results surface only a summary plus the flagged-employee subset (`flaggedEmployees`, mirroring `specs/003`'s `discrepancies` field) — not every employee's full record. Every employee is still scored internally (needed for the report, which always contains every employee) via an internal pipeline function that tests call directly to assert against non-flagged employees' scores; only the wire-facing `calculate_bonus()` function filters down to `flaggedEmployees` for the JSON response.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Maps the task to US1, US2, or US3
- Every task names an exact file path

## Path Conventions

Web app (per plan.md's Project Structure): `backend/` (FastAPI) and `frontend/` (React+TS), as two independent sibling projects — no shared build.

---

## Phase 1: Setup

**Purpose**: Fixture files this feature's tests need, none of which exist yet.

- [X] T001 Copy `ข้อมูลพนักงานปี_68.xlsx` and `สรุปโบนัส_68.xlsx` (repo root) into `backend/tests/fixtures/` as `bonus_current_year.xlsx` and `bonus_previous_summary.xlsx` — the base fixtures `quickstart.md` and research.md #11 validate correctness against. Create the `backend/tests/fixtures/` directory if it does not already exist.

**Checkpoint**: Base fixtures in place for every downstream test task.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared models, rule-table constants, and sheet-parsing/matching primitives that every user story's scoring logic depends on. No user-story-specific behavior lives here — this phase produces no observable feature on its own.

**⚠️ CRITICAL**: Must complete before any Phase 3+ task.

- [X] T002 [P] Create `backend/models/bonus.py`: `BonusExceptionCategory` (`Literal["evaluationNotFound", "evaluationAllBlank", "leaveNotFound", "previousBonusNotFound", "otCategoryUnrecognized", "duplicateName", "workingDayDataInvalid"]`), `EmployeeBonusRecord(CamelModel)`, `BonusCalculationSummary(CamelModel)`, and `CalculateBonusResponse(CamelModel)` exactly per `data-model.md`'s three wire-model tables (field names, types, nullability) — `EmployeeBonusRecord` includes every field from `employeeId` through `exceptionNote`; `CalculateBonusResponse` has `summary`, `flagged_employees: list[EmployeeBonusRecord]` (wire `flaggedEmployees` — only employees with ≥1 exception category, per data-model.md and spec Clarifications 2026-08-23 (3)), `bonus_report: FileAttachment` (import `FileAttachment` from `backend/models/common.py`, do not redefine it). Follow `backend/models/payroll.py`'s style (one file, `CamelModel` base, `Literal` for the exception type, a filtered-list field named analogously to `ReconcilePayrollResponse.discrepancies`).
- [X] T003 Create `backend/services/bonus_service.py` module skeleton with `BonusRequestError(Exception)` (mirrors `PayrollReconcileRequestError`'s role — raised for request-level failures, caught in the router as a 400) and module-level imports (`base64`, `io`, `numpy as np`, `pandas as pd`, `openpyxl`).
- [X] T004 [P] In `backend/services/bonus_service.py`, add the six fixed rule-table constants as module-level ascending `(lower_bound, value)` breakpoint lists per research.md #7 and the decompiled-VBA business-logic brief: `WORKING_DAYS_SCORE_TABLE`, `OT_GENERAL_SCORE_TABLE`, `OT_SEWING_SCORE_TABLE`, `OT_PAINT_SCORE_TABLE`, the four leave-deduction formulas/tables (sick, personal/special-personal combined per the brief, absent, vacation), and `GRADE_LETTER_TABLE` (12-tier ascending numeric-lower-bound → letter, `F` below 2 up to `A` at 12, per research.md #7). Add `_bracket_lookup(values: pd.Series, table: list[tuple[float, float]]) -> pd.Series`, reimplemented locally in this file per research.md #7 (do not import the private helper from `accounts_service.py`), same `np.searchsorted`-based approximate-match logic as `accounts_service.py:254`.
- [X] T005 In `backend/services/bonus_service.py`, add `_resolve_sheet_tokens(year: str) -> tuple[int, int]` that parses the Gregorian `year` form field to `int`, computes `current_be_year = year + 543` and `previous_be_year = current_be_year - 1`, and raises `BonusRequestError` on a non-integer `year`; and sheet-name builders for `ผลประเมินปี_{YY}`, `วันทำงานปี_{YY}`, `วันลาปี_{YY}` (current year) and `ผลสรุปโบนัสปี_{YY}` (previous year), per research.md #5.
- [X] T006 In `backend/services/bonus_service.py`, add `_read_flat_sheet(content: bytes, sheet_name: str, header_row_index: int) -> pd.DataFrame` — reads with `pd.read_excel(io.BytesIO(content), sheet_name=sheet_name, header=None, engine="openpyxl")`, raising `BonusRequestError` naming the missing sheet on `ValueError` (mirrors `payroll_reconcile_service._read_raw_sheet`), takes row `header_row_index` as header and all rows after as data, and filters to rows with a non-blank first-name cell (mirrors `accounts_service.read_table`'s blank-row filtering) — no department-header/`ffill()` logic needed per research.md #2. Working-day/evaluation/leave sheets use header row index 3 (0-based, row 4); the previous-year summary sheet uses header row index 4 (0-based, row 5) per research.md #3.
- [X] T007 In `backend/services/bonus_service.py`, add `_compute_match_key(prefix, first_name, last_name) -> str` — trimmed, whitespace-collapsed `"{firstName} {lastName}"` per research.md #6 — and `_flag_duplicate_match_keys(df: pd.DataFrame, key_col: str) -> pd.Series` returning a boolean mask of rows whose `matchKey` occurs more than once in `df`.

**Checkpoint**: Models, rule tables, sheet reading, and name-matching primitives exist. No endpoint yet — user stories start here.

---

## Phase 3: User Story 1 - Calculate Bonus Scores for All Employees (Priority: P1) 🎯 MVP

**Goal**: Upload current-year data + previous-year summary, run the calculation, get every employee scored internally, an immediate on-screen summary (total/calculated/exception counts) with each flagged employee individually listed by name and reason, in one `POST /accounts/bonus-calculation` call.

**Independent Test**: Upload `backend/tests/fixtures/bonus_current_year.xlsx` + `bonus_previous_summary.xlsx` with `year=2025`, call the endpoint, confirm the summary counts are correct and every flagged employee appears in `flaggedEmployees`; confirm (via the internal pipeline function, directly in tests) that every employee — flagged or not — has a computed grade, component scores, total score, and provisional bonus unless blocked by an exception.

### Tests for User Story 1

- [X] T008 [P] [US1] In `backend/tests/test_bonus_calculation.py`, write a full-run test: call `bonus_service._score_all_employees()` (the internal per-employee pipeline, T019 — not the wire-facing `calculate_bonus()`) with the Phase 1 fixtures and `year="2025"`, assert every row in the base (working-day) sheet appears in the returned `DataFrame` with non-`None` `total_score`/`provisional_days`/`provisional_bonus` unless it has a blocking exception category, and separately call `bonus_service.calculate_bonus()` with the same inputs to assert `summary.total_employees == calculated_count + <rows with blocking exceptions>` and that `flagged_employees` contains exactly the rows with ≥1 exception category.
- [X] T009 [P] [US1] In `backend/tests/test_bonus_calculation.py`, write one test per OT rule table (general `"OT"`, `"OT SEWING"`, `"OT PAINT"`) calling `_score_all_employees()` and asserting the employee's `ot_score` matches `_bracket_lookup` against the correct table for a known `total_ot` value from the fixture (or a small in-memory `DataFrame` if the fixture lacks a row for one category) — confirms FR-006/Acceptance Scenario 2. These employees are not necessarily flagged, so the assertion must go through `_score_all_employees()`, not `calculate_bonus()`'s `flagged_employees`.
- [X] T010 [P] [US1] In `backend/tests/test_bonus_calculation.py`, write a negative-total-score test: construct an employee row (in-memory `DataFrame` or edited fixture copy) whose leave/working-day deductions outweigh their grade, call `_score_all_employees()`, assert `total_score < 0` (not clamped) while `provisional_days == 0` and `provisional_bonus == 0` — confirms FR-007/FR-008/Acceptance Scenario 3.
- [X] T011 [P] [US1] In `backend/tests/test_bonus_calculation.py`, write the correctness test from research.md #11 / quickstart.md Scenario 4: call `_score_all_employees()` against the Phase 1 fixtures, and for the flagged `ชิติมา กตัญญู` row and at least one row per OT category plus one negative-`totalScore` employee, assert `current_grade_letter`, each component score, `total_score`, and `provisional_bonus` match `สรุปโบนัส_68.xlsx`'s own `ผลสรุปโบนัสปี_68` sheet figure-for-figure (open that sheet directly with `openpyxl`, `data_only=True`, in the test to source expected values — do not hardcode them from memory). Additionally assert that `calculate_bonus()`'s `flagged_employees` includes `ชิติมา กตัญญู` (matches the same figures) but does not include the non-flagged comparison employees.

### Implementation for User Story 1

- [X] T012 [US1] In `backend/services/bonus_service.py`, add `_parse_working_day_sheet(content, current_be_year) -> pd.DataFrame` using T005/T006: reads `วันทำงานปี_{YY}`, extracts columns per research.md #3 (col2 prefix, col3 first name, col4 last name, col5 pay rate, col6 start date, col7 department/notes, col45 work days, col46 total OT, col47 total-not-worked, col48 OT-category code), computes `match_key` (T007), divides `pay_rate` by 30 only when `department_notes` equals the office marker `"ออฟฟิศ"` (research.md #3), and flags `workingDayDataInvalid` for any row where `pay_rate` isn't a positive number (research.md #8) and `duplicateName` for rows whose `match_key` collides within this sheet (T007).
- [X] T013 [US1] [P] In `backend/services/bonus_service.py`, add `_parse_evaluation_sheet(content, current_be_year) -> pd.DataFrame` using T005/T006: reads `ผลประเมินปี_{YY}`, computes `match_key`, averages columns E:Q (5-17) ignoring blanks into `current_grade_numeric`, flagging `evaluationAllBlank` when every one of cols 5-17 is blank for a row.
- [X] T014 [US1] [P] In `backend/services/bonus_service.py`, add `_parse_leave_sheet(content, current_be_year) -> pd.DataFrame` using T005/T006: reads `วันลาปี_{YY}`, computes `match_key`, extracts col78 sick, col79 personal, col80 special-personal, col81 absent, col82 vacation as the raw leave-day columns per research.md #3 (col83 late-minutes is unused, per the brief).
- [X] T015 [US1] [P] In `backend/services/bonus_service.py`, add `_parse_previous_summary_sheet(content, previous_be_year) -> pd.DataFrame` using T005/T006: reads `ผลสรุปโบนัสปี_{prevYY}`, computes `match_key`, extracts col11 as `previous_grade_letter` and col29 as `previous_bonus` per research.md #4.
- [X] T016 [US1] In `backend/services/bonus_service.py`, add `_join_sources(working_day_df, evaluation_df, leave_df, previous_summary_df) -> pd.DataFrame`: left-joins evaluation/leave/previous-summary onto the working-day base by `match_key` (research.md #6); for each of the three joined sources independently, if the base row's `match_key` collides in that specific source sheet, treats that source's data for the ambiguous rows as not-found (sets its columns to `NaN`) rather than merging — do not conflate this with the base-sheet self-collision already flagged as `duplicateName` in T012. Sets `evaluationNotFound` when no evaluation match exists, `leaveNotFound` when no leave match exists, `previousBonusNotFound` when no previous-summary match exists, `otCategoryUnrecognized` when `ot_category_code` isn't one of `"OT"`/`"OT SEWING"`/`"OT PAINT"`.
- [X] T017 [US1] In `backend/services/bonus_service.py`, add `_score_employees(joined_df) -> pd.DataFrame`: computes `current_grade_letter` via `_bracket_lookup` against `GRADE_LETTER_TABLE`; the four leave-deduction scores via `_bracket_lookup` against their respective tables (T004), each left `None`/`NaN` when `leaveNotFound` per data-model.md (not `0`); `working_days_score` via `_bracket_lookup` against `WORKING_DAYS_SCORE_TABLE`; `ot_score` via `_bracket_lookup` against the table selected by `ot_category_code` (`None` when `otCategoryUnrecognized`); `total_score = current_grade_numeric + sum(4 leave scores, missing treated as 0) + working_days_score + ot_score`, set to `None` (not computed) for any row carrying a blocking exception category (`evaluationNotFound`, `evaluationAllBlank`, `otCategoryUnrecognized`, `duplicateName`, `workingDayDataInvalid`) per research.md #8's blocking/non-blocking table, and **not floored** when negative (FR-007); `provisional_days = max(0, total_score * 30 / 12)` when `total_score` is not `None`, else `None`; `provisional_bonus = provisional_days * pay_rate` when both are not `None`, else `None`.
- [X] T018 [US1] In `backend/services/bonus_service.py`, add `_build_exception_note(exceptions: list[str]) -> str | None` — joins each category into one human-readable sentence per data-model.md's example (`"Not found in evaluation data; not found in previous-year bonus data."`), returning `None` when `exceptions` is empty.
- [X] T019 [US1] In `backend/services/bonus_service.py`, add `_score_all_employees(current_year_content: bytes, previous_year_summary_content: bytes, year: str) -> pd.DataFrame` as the internal pipeline: calls T005 for BE-year resolution, T012/T013/T014 against `current_year_content`, T015 against `previous_year_summary_content`, T016, T017, T018 (adding an `exception_note` column), and returns one `DataFrame` row per base-sheet employee with every `EmployeeBonusRecord` field (snake_case) plus `exceptions`/`exception_note`, `employee_id` always `None`. This is the function tests (T008-T011) call directly to inspect non-flagged employees' scores, and the function both `calculate_bonus()` (T020) and `build_bonus_report()` (Phase 4) build on.
- [X] T020 [US1] In `backend/services/bonus_service.py`, add `calculate_bonus(current_year_content: bytes, previous_year_summary_content: bytes, year: str) -> dict` as the wire-facing orchestrator: calls `_score_all_employees()` (T019) once, builds `BonusCalculationSummary` fields per data-model.md (`total_employees` = row count of the base sheet, `calculated_count` = rows with non-`None` `total_score`, `exception_count` = rows with ≥1 exception category, `exceptions_by_category` = per-category counts, a multi-exception row counted once per category), filters the full `DataFrame` to rows with a non-empty `exceptions` list and converts each to an `EmployeeBonusRecord`-shaped dict for `flagged_employees` (spec Clarifications, 2026-08-23 (3) — this is the only place the full-employee `DataFrame` gets narrowed for the wire), and returns `{"summary": {...}, "flagged_employees": [...]}` (the `bonus_report` key is added in T027).
- [X] T021 [US1] In `backend/routers/accounts.py`, add `POST /bonus-calculation` accepting `currentYearFile: UploadFile = File(...)`, `previousYearSummaryFile: UploadFile = File(...)`, `year: str = Form(...)`, reading both files' bytes, calling `bonus_service.calculate_bonus(...)`, catching `bonus_service.BonusRequestError` as an `HTTPException(status_code=400, detail=str(exc))` (same pattern as the two existing endpoints in this file), and returning `CalculateBonusResponse(**result)` — import `bonus_service` and `CalculateBonusResponse` at the top of the file alongside the existing imports.
- [X] T022 [P] [US1] Create `frontend/src/services/bonusService.ts` mirroring `payrollReconcileService.ts`'s structure: `BonusExceptionCategory` type, `EmployeeBonusRecord`, `BonusCalculationSummary`, `FileAttachment` (reuse the same shape as `payrollReconcileService.ts`'s), and `CalculateBonusResponse` interfaces matching `contracts/bonus-calculation-api.md`'s response schema field-for-field (camelCase, including `flaggedEmployees: EmployeeBonusRecord[]`); `calculateBonus(currentYearFile: File, previousYearSummaryFile: File, year: string): Promise<CalculateBonusResponse>` posting `multipart/form-data` to `${BACKEND_BASE_URL}/accounts/bonus-calculation` with fields `currentYearFile`, `previousYearSummaryFile`, `year`, throwing on a non-OK response using the same `errorBody?.detail` pattern.
- [X] T023 [US1] Rewrite `frontend/src/pages/BonusCalculation.tsx`'s Calculation tab (`tab === "cal"` branch) to match `PayrollReconcile.tsx`'s pattern: replace `benefitsFile`/`masterDataFile`/`validateFiles` with `currentYearFile`/`previousYearSummaryFile`/`year` state, a `useMutation<CalculateBonusResponse, Error>` calling `calculateBonus` from T022 (client-side guard before `mutate()` for both files + year present, matching FR-014/Acceptance Scenario 4), and a results panel replacing the static "Awaiting Data" placeholder that renders `mutation.isIdle`/`isPending`/`isError` states plus, on success, the `summary` counts and a `flaggedEmployees` list (one entry per flagged employee: name + `exceptionNote`, `PayrollReconcile.tsx`'s discrepancies-list pattern) — no full per-employee table, since successfully-calculated employees' detail is report-only (spec Clarifications, 2026-08-23 (3)). Leave the Configuration tab (`tab === "config"`) untouched per spec.md's Assumptions.

**Checkpoint**: User Story 1 is independently functional — a user can upload both files, run the calculation, and see the results summary plus every flagged employee on screen.

---

## Phase 4: User Story 2 - Download and Finalize the Bonus Report (Priority: P2)

**Goal**: The same `POST /accounts/bonus-calculation` call also returns a downloadable `.xlsx` report — every employee, flagged or not, with full detail — with a blank approved-days cell and a live formula that computes the final bonus once the user fills that cell in, directly in the file.

**Independent Test**: Complete a calculation run, download the report, fill in an approved day count for one employee directly in the file, confirm that employee's final bonus calculates correctly while every other employee's figures are unaffected.

### Tests for User Story 2

- [X] T024 [P] [US2] In `backend/tests/test_bonus_calculation.py`, write a report-structure test: call `bonus_service.calculate_bonus()`, load the returned `bonus_report` bytes with `openpyxl` (`data_only=False`), and assert (a) the sheet has 31 columns matching research.md #9's order, (b) it contains a row for every employee in the base sheet — not only the ones in `flagged_employees` — via a row count matching `bonus_service._score_all_employees()`'s row count on the same inputs, (c) every row's approved-days (`วัน`) cell is genuinely blank (no value, no formula), and (d) every row's final-bonus (`Bonus ที่ได้`) cell's formula string references that row's approved-days and `provisionalBonus` cells and follows the `=IF(OR(...)),"",ROUND(...))` shape from research.md #10.
- [X] T025 [P] [US2] In `backend/tests/test_bonus_calculation.py`, write a blocked-exception-row report test: for a row with a blocking exception (e.g. `evaluationNotFound`, `provisionalBonus` cell blank), assert its final-bonus formula still evaluates to blank regardless of the `IF(OR(...))` condition's structure (verify by inspecting the formula string and its referenced cells, since `openpyxl` doesn't evaluate formulas) — confirms FR-013.

### Implementation for User Story 2

- [X] T026 [US2] In `backend/services/bonus_service.py`, add `REPORT_COLUMNS` (31-column list, research.md #9/§3's order dumped from `ผลสรุปโบนัสปี_67`) with the two year-relative labels built dynamically from `current_be_year`/`previous_be_year` (e.g. `f"grade{current_be_year % 100:02d}"`), matching `payroll_reconcile_service.py`'s `REPORT_COLUMNS` constant pattern.
- [X] T027 [US2] In `backend/services/bonus_service.py`, add `build_bonus_report(all_employees_df, current_be_year, previous_be_year) -> bytes`, taking the **full** `DataFrame` from `_score_all_employees()` (T019) — every employee, not the `flagged_employees` subset: creates an `openpyxl.Workbook`, appends `REPORT_COLUMNS` (T026) as the header row, then for each employee row writes every `EmployeeBonusRecord` field through `provisionalBonus` as a static value (mirrors `payroll_reconcile_service.build_reconciliation_report`'s `ws.append(...)` loop), leaves the approved-days (`วัน`) cell genuinely blank, and writes the final-bonus (`Bonus ที่ได้`) cell as an `openpyxl` formula string referencing that row's own approved-days and provisional-bonus cell addresses, e.g. `f'=IF(OR({provisional_bonus_cell}="",{approved_days_cell}=""),"",ROUND({approved_days_cell}*{provisional_bonus_cell}/30,0))'` per research.md #10 — saves to an `io.BytesIO()` buffer and returns `.getvalue()`.
- [X] T028 [US2] In `backend/services/bonus_service.py`'s `calculate_bonus()` (T020), call `build_bonus_report(...)` against the full `DataFrame` from the same `_score_all_employees()` call already used to build `summary`/`flagged_employees` (do not re-run the pipeline), and add `"bonus_report": {"filename": "bonus_calculation_report.xlsx", "content_base64": base64.b64encode(report_bytes).decode("ascii")}` to the returned dict, matching `payroll_reconcile_service.reconcile_payroll`'s `content_base64` pattern.
- [X] T029 [US2] In `frontend/src/pages/BonusCalculation.tsx`, add a `downloadFileAttachment` helper (copy `PayrollReconcile.tsx`'s implementation verbatim — base64 → `Blob` → object URL → synthetic `<a download>` click) and a "Download Bonus Report" `Button` in the results panel (T023) that calls it with `result.bonusReport` — offered immediately alongside the summary/`flaggedEmployees` list from the same mutation response, no second mutation or additional request (contracts/bonus-calculation-api.md's "Frontend contract usage").

**Checkpoint**: User Stories 1 AND 2 both work — running a calculation produces on-screen summary/exception results and an immediately-downloadable, self-finalizing report covering every employee.

---

## Phase 5: User Story 3 - Trust Results When Employee Data Doesn't Fully Match (Priority: P2)

**Goal**: Employees that can't be confidently matched across sources are individually flagged with a clear reason in `flaggedEmployees`, and the run still completes for everyone else.

**Independent Test**: Upload a current-year file with one employee missing from evaluation, one missing from leave, and one not present in the previous-year summary; confirm each appears individually in `flaggedEmployees` with the correct reason while all others calculate normally (verifiable via the internal pipeline/report).

**Note**: The matching/flagging logic itself (`_join_sources`, T016) and exception-note building (T018) were already implemented in Phase 3, since scoring in US1 cannot proceed without knowing which sources joined — this phase adds the fixtures and tests that specifically validate the exception-flagging behavior end-to-end, per spec.md's framing of US3 as "a data-quality safeguard layered on top of the core calculation."

### Tests for User Story 3

- [X] T030 [P] [US3] Create `backend/tests/fixtures/bonus_current_year_with_gaps.xlsx`: a copy of `bonus_current_year.xlsx` (T001) with one employee's row removed from the `ผลประเมินปี_68` sheet, a different employee's row removed from `วันลาปี_68`, and (reusing `bonus_previous_summary.xlsx`) with a third employee's row removed from `ผลสรุปโบนัสปี_67` in a copy `backend/tests/fixtures/bonus_previous_summary_with_gaps.xlsx` — per quickstart.md Scenario 3.
- [X] T031 [US3] In `backend/tests/test_bonus_calculation.py`, using the T030 fixtures, write a test asserting: calling `calculate_bonus()`, `flagged_employees` contains exactly three entries — the evaluation-missing employee with `exceptions` containing `evaluationNotFound` and `total_score is None`, the leave-missing employee with `exceptions` containing `leaveNotFound`, and the previous-year-missing employee with `exceptions` containing `previousBonusNotFound`; and calling `_score_all_employees()` directly, confirm the leave-missing employee still has a fully computed (non-`None`) `total_score`, the previous-year-missing employee calculates normally with `previous_grade_letter is None`/`previous_bonus is None`, and `summary.exception_count == 3` with every other employee's row unaffected (matches an unmodified-fixture run on the same rows).
- [X] T032 [P] [US3] In `backend/tests/test_bonus_calculation.py`, write a duplicate-name test: construct an in-memory two-row working-day `DataFrame` (or an edited fixture copy) with two employees sharing the same `matchKey`, call `_score_all_employees()`, assert both rows are flagged `duplicateName` with `total_score is None` for both (per research.md #6 — never silently merged/misattributed).
- [X] T033 [P] [US3] In `backend/tests/test_bonus_calculation.py`, write an `otCategoryUnrecognized` test: an employee whose OT-category code (col48) isn't `"OT"`/`"OT SEWING"`/`"OT PAINT"` is flagged with `total_score is None` (via `_score_all_employees()`), and appears in `calculate_bonus()`'s `flagged_employees`.
- [X] T034 [P] [US3] In `backend/tests/test_bonus_calculation.py`, write a zero-exceptions test: run `calculate_bonus()` against the unmodified Phase 1 fixtures and assert `summary.exception_count == 0` and `flagged_employees == []`, confirming this is reported as a normal, fully-successful summary (not an empty/error state) — confirms Acceptance Scenario 3.

### Implementation for User Story 3

- [X] T035 [US3] In `frontend/src/pages/BonusCalculation.tsx`'s results panel (T023), when `result.flaggedEmployees.length === 0`, render a clear success message (e.g. "All employees calculated successfully — 0 exceptions") instead of an empty list, so a fully-successful run reads as success rather than an empty/error state — confirms Acceptance Scenario 3.

**Checkpoint**: All three user stories are independently functional and tested — flagged employees are visible on screen and every employee's detail is in the report, with zero-exception runs reported as success.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Request-level validation and final repo-wide checks spanning all three stories.

- [X] T036 [P] In `backend/tests/test_bonus_calculation.py`, write the two request-level failure tests from quickstart.md Scenario 5: (a) `year` resolving to a sheet name absent from `currentYearFile` (e.g. a far-future year) raises a `BonusRequestError` naming the missing sheet; (b) `previousYearSummaryFile` missing its `ผลสรุปโบนัสปี_<prevYY>` sheet likewise raises a `BonusRequestError` naming it — call `calculate_bonus()` directly and assert the exception, then separately confirm via a FastAPI `TestClient` call to `POST /accounts/bonus-calculation` that both surface as a 400 (T021) — confirms FR-003.
- [X] T037 Run `backend/.venv/Scripts/python.exe -m pytest backend/tests/test_bonus_calculation.py -v` from the repo root and confirm every test in Phases 3-6 passes.
- [X] T038 Run `npm run build` and `npm run lint` from `frontend/` and confirm both pass with the `BonusCalculation.tsx`/`bonusService.ts` changes (T022, T023, T029, T035).
- [X] T039 Manually walk through `quickstart.md` Scenarios 1-5 end-to-end (backend `uvicorn main:app --reload` + frontend `npm run dev`) and confirm each scenario's expected outcome, including opening the downloaded report in Excel and confirming the approved-days/final-bonus formula behavior described in Scenario 2 steps 2-4, and confirming the on-screen summary/`flaggedEmployees` list matches Scenario 1 step 2 / Scenario 3 step 2's expectations.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Phase 1 (fixtures exist, though T002-T007 don't consume them directly) — BLOCKS all user stories.
- **User Story 1 (Phase 3)**: Depends on Phase 2. No dependency on US2/US3.
- **User Story 2 (Phase 4)**: Depends on Phase 2 and on US1's `_score_all_employees()`/`calculate_bonus()`/`EmployeeBonusRecord` data existing (T019, T020) to have something to render into a report — cannot be built or tested independently of US1's scoring output, though it adds no new scoring logic itself.
- **User Story 3 (Phase 5)**: Depends on Phase 2; its core logic (`_join_sources`, T016) already exists from Phase 3 — this phase is additional fixtures/tests/UI on top, not new backend logic.
- **Polish (Phase 6)**: Depends on Phases 3-5 being complete.

### Within Each User Story

- Models/constants (T002-T007) before any parsing/scoring function.
- Sheet-parsing functions (T012-T015) before the join (T016).
- Join (T016) before scoring (T017).
- Scoring (T017) before the full-pipeline function (T019).
- Full-pipeline function (T019) before the wire orchestrator (T020) and before the report builder (T027) — both consume its output, computed once per request.
- Wire orchestrator (T020) before the router (T021).
- Backend endpoint (T021) before the frontend service (T022) can be manually verified end-to-end, though T022 can be written in parallel against `contracts/bonus-calculation-api.md`'s documented shape.
- Tests for a story (T008-T011, T024-T025, T030-T034, T036) can be written before or alongside that story's implementation tasks, per standard TDD, but are listed first in each phase per the template convention.

### Parallel Opportunities

- T002, T003 can start together (different concerns, same file — T003 creates the module T002 doesn't touch, but both are independent of each other's content); T004 depends on T003's module existing.
- T008-T011 (US1 tests) are parallel to each other (same file, but independent test functions — flag with care if a test runner enforces file-level serialization; content is independent).
- T013, T014, T015 (evaluation/leave/previous-summary parsers) are parallel to each other and to nothing else in US1, once T012 establishes the base-sheet pattern.
- T022 (frontend service) is parallel to T012-T021 (backend), since it's written directly against the contract doc.
- T024, T025 (US2 tests) are parallel to each other.
- T030, T032, T033, T034 (US3 fixtures/tests) are parallel to each other.

---

## Parallel Example: User Story 1

```bash
# After T012 (base working-day parser) establishes the pattern:
Task: "_parse_evaluation_sheet in backend/services/bonus_service.py"
Task: "_parse_leave_sheet in backend/services/bonus_service.py"
Task: "_parse_previous_summary_sheet in backend/services/bonus_service.py"

# In parallel with all backend work, written directly against contracts/bonus-calculation-api.md:
Task: "bonusService.ts in frontend/src/services/bonusService.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 (fixtures) + Phase 2 (models, rule tables, parsing/matching primitives).
2. Complete Phase 3 (User Story 1): full scoring pipeline, endpoint, frontend summary/exceptions display.
3. **STOP and VALIDATE**: run quickstart.md Scenario 1 and Scenario 4 (correctness check) manually; confirm T008-T011 pass.
4. This is a demoable MVP — a user can upload files and see the results summary plus flagged employees, even without the downloadable report or the gapped-fixture exception coverage.

### Incremental Delivery

1. Setup + Foundational → shared groundwork ready.
2. User Story 1 → validate independently → demoable core calculation with summary/exceptions on screen.
3. User Story 2 → validate independently (download + fill in a cell in Excel) → report is now self-finalizing and covers every employee.
4. User Story 3 → validate independently (gapped fixtures) → exception handling is now visibly trustworthy.
5. Polish → request-level failure tests, full test suite, lint/build, full quickstart walkthrough.

### Note on Anti-Bloat (plan.md Constitution Check, Principle V)

Rule tables stay inline in `bonus_service.py` (T004) rather than a new config-loading layer — no task in this list introduces one, matching plan.md's explicit deferral of the Configuration tab to a future feature. There is no `bonus-report` second endpoint or client-held run state — T028 folds the report directly into `calculate_bonus()`'s return value, per research.md #1. The internal/wire split (`_score_all_employees()` vs. `calculate_bonus()`, T019/T020) is the smallest change that lets every employee still be scored (needed for the report) while the JSON response stays limited to what needs review (spec Clarifications, 2026-08-23 (3)) — it is not a new persistence layer or run-state mechanism.
