---

description: "Task list for Previous-Year Benefit Carry-Forward"
---

# Tasks: Previous-Year Benefit Carry-Forward

**Input**: Design documents from `specs/002-previous-benefit-carryforward/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/benefits-api-carryforward.md, quickstart.md

**Tests**: Included — `plan.md`'s Testing section explicitly calls for extending `backend/tests/test_calculate_benefits.py` with carry-forward cases.

**Organization**: Tasks are grouped by user story (spec.md priorities P1/P2/P3). Related, small, same-area changes are consolidated into single tasks to keep the list executable without unnecessary busywork.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1, US2, US3); Foundational/Polish tasks carry no story label

---

## Phase 1: Foundational (Blocking Prerequisites)

**Purpose**: Shape changes shared by every user story. No behavior change yet.

- [X] T001 [P] Add `"duplicateEmployeeId"` to the `ExceptionCategory` type in both `backend/models/benefits.py` (`Literal["missingRequiredField", "duplicateEmployeeId"]`) and `frontend/src/services/benefitsService.ts`
- [X] T002 [P] Add `"prior_liability": ["ผลประโยชน์ของพนักงานที่คาดว่าต้องจ่าย ณ วันสิ้นปีปัจจุบัน"]` to `COLUMN_ALIASES` in `backend/services/accounts_service.py` (research.md #4; the `"id"` key already exists there)

**Checkpoint**: Foundation ready — User Story 1 can now be implemented.

---

## Phase 2: User Story 1 - Carry forward last year's liability by employee ID (Priority: P1) 🎯 MVP

**Goal**: When both files are supplied, an employee whose ID uniquely matches a row in the previous-year file gets that row's liability value copied unmodified into `ยอดยกมา`; unmatched IDs stay blank with no exception; an ID duplicated in the previous-year file blocks carry-forward for every employee sharing it and is reported as a `duplicateEmployeeId` exception; a previous-year file missing required columns or unreadable fails the request.

**Independent Test**: Supply a master file and a previous-year file where several employee IDs match, several exist only in one file, and one ID is duplicated in the previous-year file; confirm matched employees show the correct carried-forward value, unmatched employees show a blank `ยอดยกมา` with no exception, and the duplicated ID is reported as an exception with `ยอดยกมา` left blank for that employee.

### Tests for User Story 1 ⚠️

> Write these first; they should fail until the Implementation tasks below are done.

- [X] T003 [P] [US1] In `backend/tests/test_calculate_benefits.py`, add tests for `_normalize_employee_id()` (numeric `1002.0`, text `" 1002 "`, and `NaN` all converge/resolve correctly, FR-009) and `compute_carry_forward()` (unique match builds a `{id: liability}` lookup with no exceptions, FR-006; a duplicated ID is excluded from the lookup and produces exactly one `duplicateEmployeeId` exception, FR-008; a file missing `รหัสพนักงาน` or the liability column raises `BenefitsRequestError`, FR-004; an empty/unreadable file raises `BenefitsRequestError`, FR-005)
- [X] T004 [P] [US1] In `backend/tests/test_calculate_benefits.py`, add tests for `compute_benefit_rows()`'s new `carry_forward_lookup` param: a matched ID sets `ยอดยกมา` to the looked-up value unmodified; an unmatched ID (and, separately, a blank master-file ID) leaves `ยอดยกมา` as `None` with no exception (FR-007)
- [X] T005 [P] [US1] In `backend/tests/test_calculate_benefits.py`, add an end-to-end test calling `calculate_benefits()` with both master and previous-year content (one matched ID, one duplicated ID), asserting the output workbook's `ยอดยกมา` cell for the matched employee and `result["summary"]["exceptions_by_category"]["duplicateEmployeeId"] == 1`

### Implementation for User Story 1

- [X] T006 [US1] Implement `_normalize_employee_id(value) -> str | None` and `compute_carry_forward(previous_content: bytes | None, previous_filename: str | None) -> tuple[dict[str, float], list[dict]]` in `backend/services/accounts_service.py` per research.md #1/#2/#5: normalizer converges `NaN`/blank→`None`, whole-number float→`str(int(value))`, else `str(value).strip()`; `compute_carry_forward` returns `({}, [])` when no file is supplied, else validates required columns (raising `BenefitsRequestError` per FR-004/FR-005), builds the normalized-ID lookup, and excludes+reports duplicated IDs as `duplicateEmployeeId` exception dicts
- [X] T007 [US1] Update `compute_benefit_rows()` in `backend/services/accounts_service.py`: pull the master file's own `รหัสพนักงาน` (`cols["id"]`) into the working DataFrame, normalize it, add a `carry_forward_lookup: dict[str, float] = {}` param that sets each output row's `ยอดยกมา` via `.get(normalized_id)`, and remove `ยอดยกมา` from `BENEFIT_UNFORMULATED_COLUMNS` (it's now conditionally populated) — update `test_resigned_flag_set_and_unformulated_columns_left_blank` in `backend/tests/test_calculate_benefits.py` to assert `ยอดยกมา is None` via its own line instead of the `BENEFIT_UNFORMULATED_COLUMNS` loop
- [X] T008 [US1] Update `calculate_benefits()` in `backend/services/accounts_service.py` to accept optional `previous_content: bytes | None = None, previous_filename: str | None = None`; call `compute_carry_forward()` before `compute_benefit_rows()`, pass the lookup through, merge the returned duplicate exceptions into `exceptions`, and add `"duplicateEmployeeId": 0` to the `exceptions_by_category` defaults (depends on T006, T007)
- [X] T009 [US1] Add optional `previousBenefitsFile: UploadFile | None = File(None)` param to `calculate_employee_benefits()` in `backend/routers/accounts.py`; read its bytes when present and pass `previous_content`/`previous_filename` through to `accounts_service.calculate_benefits()` (depends on T008)
- [X] T010 [US1] Wire the frontend end to end: add an optional `previousBenefitsFile?: File` param to `calculateBenefits()` in `frontend/src/services/benefitsService.ts` (appended to `FormData` only when present), and add a second, optional `<input type="file">` ("Previous Employee Benefits") with its own `useState<File | null>` under the Data Source fieldset in `frontend/src/pages/EmployeeBenefits.tsx`, passed into the existing `useMutation`'s `calculateBenefits()` call

**Checkpoint**: User Story 1 is fully functional and independently testable.

---

## Phase 3: User Story 2 - Run the calculation without a previous-year file (Priority: P2)

**Goal**: Omitting `previousBenefitsFile` produces output identical to today's single-file calculation.

**Independent Test**: Submit only a master file; confirm output, summary, and exception report are byte-for-byte identical to the base feature's, with every `ยอดยกมา` cell blank.

- [X] T011 [US2] In `backend/tests/test_calculate_benefits.py`, add a regression test calling `calculate_benefits()` with only `master_content`/`master_filename` (no previous-file args), asserting `exceptions_by_category["duplicateEmployeeId"] == 0` and every output row's `ยอดยกมา` is `None` (FR-003). No production code expected here — if it fails, the defect is in T006/T008's default handling.

**Checkpoint**: User Stories 1 and 2 both hold — omitting the file is a true no-op.

---

## Phase 4: User Story 3 - Data-quality problems in the previous-year file are visible, not guessed (Priority: P3)

**Goal**: A duplicated employee ID in the previous-year file is a distinct, HR-visible exception.

**Independent Test**: Submit a previous-year file with a duplicated employee ID; confirm the exception report includes an entry identifying the duplicate, distinguishable from `missingRequiredField`.

- [X] T012 [US3] In `backend/tests/test_calculate_benefits.py`, add a test asserting a `duplicateEmployeeId` exception's shape (`employee_id` set to the duplicated ID, `employee_name` `None`) and that `build_exception_report()` renders it distinctly from a `missingRequiredField` row in the same run; then in `frontend/src/pages/EmployeeBenefits.tsx`, update the exceptions list rendering to fall back to showing `exception.employeeId` when `exception.employeeName` is `null`, so a `duplicateEmployeeId` entry still displays an identifying value

**Checkpoint**: All three user stories are independently functional.

---

## Phase 4.5: Reconciliation — manual implementation vs. this plan

**Context**: The backend/frontend changes for this feature were written by hand rather than driven task-by-task from this file, then reconciled back into `spec.md`/`data-model.md`/`plan.md`/`contracts/` after the fact. Two divergences from what was originally planned:

- [X] T007a [US1] `compute_benefit_rows()`'s output gained a `รหัสพนักงาน` column in `OUTPUT_COLUMNS` (`backend/services/accounts_service.py`), populated from the same normalized `employee_id` T007 already pulls in. Not in T007's original description — added because carry-forward can't work in a second year unless this year's own output emits an ID to match against next time. Covered by `test_calculate_benefits_end_to_end_with_carry_forward_and_duplicate` and `test_output_workbook_uses_template_and_appends_rows_after_header` (updated for the shifted column offset / new merged-cell range).
- [X] T007b (out of this feature's scope, bundled in the same manual update) `compute_benefit_rows()` also changed how several base-feature (001) fields are populated based on `is_resigned` (retirement-projection columns now blank unless resigned; `ลาออก` changed from `bool` to `"ใช่"`/`"ไม่ใช่"`). Not part of carry-forward (FR-010 exception, flagged in `spec.md`/`data-model.md`, not part of this feature's requirements). Fixed as a follow-on to keep the suite honest about current behavior: `resigned_flagged_count` in `calculate_benefits()` was truthy-checking `r["ลาออก"]`, which broke once that value became the always-truthy string `"ไม่ใช่"` for active employees — changed to `r["ลาออก"] == "ใช่"`. Updated `test_resigned_flag_set_and_unformulated_columns_left_blank` (`row["ลาออก"] == "ใช่"`, was `is True`) and marked the two proration tests' fixture employees resigned (`test_no_proration_at_or_above_retirement_age_matches_sample_row_5`, `test_proration_applies_below_retirement_age`) so their retirement-projection assertions still exercise real computed values instead of the new blank-when-active path.

**Checkpoint**: `pytest tests/test_calculate_benefits.py` — 22 passed, 0 failed.

---

## Phase 5: Polish & Cross-Cutting Concerns

- [X] T013 [P] Run `npm run build` + `npm run lint` in `frontend/`, and `cd backend; .venv/Scripts/pytest tests/test_calculate_benefits.py`, to confirm no regressions
- [X] T014 Manually execute `quickstart.md` Scenarios 1-5 (omitted file, unique match, unmatched ID, duplicate ID, invalid previous file) against the running frontend + backend

---

## Dependencies & Execution Order

- **Foundational (T001-T002)**: No dependencies; both [P], blocks all user stories
- **User Story 1 (T003-T010)**: Depends on Foundational. Within it: tests (T003-T005) first; T006 blocks T007 and T008; T007 blocks T008; T008 blocks T009; T010 (frontend) can proceed in parallel with T006-T009 (backend) since the contract is already fixed by `contracts/benefits-api-carryforward.md`
- **User Story 2 (T011)**: Depends on US1 being implemented (verifies its default-parameter behavior); adds no new production code
- **User Story 3 (T012)**: Depends on US1's `compute_carry_forward()` (T006) already producing the `duplicateEmployeeId` shape
- **Polish (T013-T014)**: Depends on all user stories being complete

## Parallel Example

```bash
# After Foundational (T001-T002):
Task: "Add _normalize_employee_id/compute_carry_forward tests in backend/tests/test_calculate_benefits.py"       # T003
Task: "Add compute_benefit_rows carry_forward_lookup tests in backend/tests/test_calculate_benefits.py"          # T004
Task: "Add calculate_benefits end-to-end carry-forward test in backend/tests/test_calculate_benefits.py"         # T005

# Backend (T006-T009) and frontend (T010) tracks in parallel:
Task: "Implement _normalize_employee_id + compute_carry_forward in backend/services/accounts_service.py"         # T006
Task: "Wire previousBenefitsFile through frontend service + EmployeeBenefits.tsx"                                 # T010
```

## Implementation Strategy

**MVP**: Foundational → User Story 1 → run T013 + relevant quickstart scenarios. Per spec.md, US1 alone delivers the entire feature; US2 and US3 verify guarantees (safe omission, duplicate visibility) that US1's implementation must already satisfy, not new code paths — confirm with Phases 3-4 before calling the feature done.

## Notes

- [P] tasks touch different files, or the same test file with no dependency between the added test functions
- Verify tests fail before implementing (T003-T005, T011, T012's test half)
- Stop at any checkpoint to validate a story independently
