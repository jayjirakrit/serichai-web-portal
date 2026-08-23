---

description: "Task list for Payroll Reconciliation"
---

# Tasks: Payroll Reconciliation

**Input**: Design documents from `specs/003-payroll-reconcile/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/payroll-reconciliation-api.md, quickstart.md

**Tests**: Included — `plan.md`'s Testing section and Constitution Quality Gates (Principle IV) call for `pytest` coverage of the backend recalculation/discrepancy pipeline.

**Organization**: Tasks are grouped by user story (spec.md priorities P1/P2/P3). Related, small, same-area changes are consolidated into single tasks to keep the list executable without unnecessary busywork (Constitution Principle I).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, or the same file with independent additions and no dependency on each other's code)
- **[Story]**: Which user story this task belongs to (US1, US2, US3); Foundational/Polish tasks carry no story label

## Path Conventions

- Backend: `backend/routers/accounts.py`, `backend/services/payroll_reconcile_service.py`, `backend/models/common.py`, `backend/models/payroll.py`, `backend/models/benefits.py`, `backend/tests/test_payroll_reconcile.py`
- Frontend: `frontend/src/services/payrollReconcileService.ts`, `frontend/src/pages/PayrollReconcile.tsx`, `frontend/src/App.tsx`

---

## Phase 1: Foundational (Blocking Prerequisites)

**Purpose**: Shared model shapes every later phase depends on. No behavior change to the existing Employee Benefits feature.

- [X] T001 [P] Extract `CamelModel` and `FileAttachment` out of `backend/models/benefits.py` into a new `backend/models/common.py`; update `benefits.py` to import both from there instead of defining them locally (no behavior change — `data-model.md`, Constitution Principle V)
- [X] T002 [P] Create `backend/models/payroll.py`: `ReconciliationEntry` (`department`, `employee_id`, `employee_name`, `stated_amount: float | None`, `recalculated_amount: float | None`, `variance: float | None`, `status: Literal["discrepancy", "unrecognizedDepartment", "dataError"]`, `detail`), `ReconciliationSummary` (`total_employees_reconciled`, `matched_count`, `discrepancy_count`, `discrepancies_by_department: dict[str, int]`), and `ReconcilePayrollResponse` (`summary`, `discrepancies: list[ReconciliationEntry]`, `reconciliation_report: FileAttachment`, `discrepancy_report: FileAttachment | None`) — all subclassing `CamelModel` from `common.py` (`data-model.md`, `contracts/payroll-reconciliation-api.md`)

**Checkpoint**: Foundation ready — User Story 1 can now be implemented.

---

## Phase 2: User Story 1 - Upload & Reconcile Payroll Data (Priority: P1) 🎯 MVP

**Goal**: A user uploads the payroll working file, selects a pay period, and submits; the system recalculates every employee's net wage using their department's formula, compares it to the stated amount, and shows a summary (totals/matched/discrepancy counts) plus a detailed discrepancy list on screen.

**Independent Test**: Upload a fixture file with one intentionally mismatched employee, select the matching period, submit — the summary shows the correct matched/discrepancy counts and the mismatched employee is individually listed with department, stated amount, recalculated amount, and variance.

### Tests for User Story 1 ⚠️

> Write these first; they should fail until the Implementation tasks below are done.

- [X] T003 [US1] In `backend/tests/test_payroll_reconcile.py`, add a fixture-building helper (`_build_workbook(...)`, via `openpyxl`) that programmatically constructs a minimal `ประจำ {M-yy}`-named sheet matching the layout in `data-model.md`/`research.md` #2 (header row with `วันหยุด`/`วันปกติ` markers, one or more department-header rows, each followed by paired attendance/overtime rows), parameterized so callers can inject stated `สุทธิ` values that match or intentionally mismatch the recalculated wage; then add tests for header-position resolution (offsets derived from `วันปกติ`'s column, `research.md` #2) and department/row-pairing detection (department labels `ffill()` correctly down each section; attendance+OT rows pair into one row per employee)
- [X] T004 [P] [US1] In `backend/tests/test_payroll_reconcile.py` (depends on T003's helper), add tests for the per-department wage formulas and half-up-rounded discrepancy comparison (`research.md` #4, #4a): an all-matched fixture yields zero discrepancies; a fixture with one office-department (`สำนักงาน`) mismatch and one factory-department (`โรงเหล็ก`) mismatch yields exactly those two flagged with `status="discrepancy"` and the correct `variance`; a value at an exact `.xx5` rounding boundary matches Java's half-up result, not `numpy`'s default banker's rounding
- [X] T005 [P] [US1] In `backend/tests/test_payroll_reconcile.py` (depends on T003's helper), add tests for request-level failures: a `period` with no matching sheet in the workbook raises `PayrollReconcileRequestError` naming the missing period (FR-011); a workbook missing the `วันหยุด`/`วันปกติ` header markers raises `PayrollReconcileRequestError` naming the format problem (FR-011)

### Implementation for User Story 1

- [X] T006 [US1] In `backend/services/payroll_reconcile_service.py`, implement the vectorized parsing pipeline: `_resolve_sheet_name(period: str) -> str` (`research.md` #3), `_locate_header_positions(raw_df) -> dict[str, int]` (scan row 2 for `วันหยุด`/`วันปกติ`, derive every other offset per `ReportHeaderPosition`'s layout, `research.md` #2), and `_build_employee_frame(raw_df, header) -> pd.DataFrame` (boolean-mask department-header detection + `ffill()` + `cumcount() % 2` row-pairing, split attendance/OT rows and rejoin via `pd.concat(axis=1)`, per-day-count columns summed via `.iloc[:, start:end].sum(axis=1)`, `research.md` #1-#2); raise `PayrollReconcileRequestError` when the period's sheet or required header markers aren't found (depends on T003-T005 existing to drive it)
- [X] T007 [US1] In `backend/services/payroll_reconcile_service.py`, implement `_recalculate_wages(employee_df: pd.DataFrame) -> pd.DataFrame`: vectorized office vs. factory/sewing/contract formulas selected via `np.where(is_office, ...)` (`research.md` #4), the half-up rounding helper `np.floor(series * 100 + 0.5) / 100` (`research.md` #4a), and per-row `status`/`detail` assignment — `discrepancy` (amounts differ after half-up rounding), `unrecognizedDepartment` (department not in the four known names, no formula applied), or `dataError` (required numeric cells failed to parse via `pd.to_numeric(errors="coerce")`, `research.md` #5) — plus `build_reconciliation_report(employee_df) -> bytes` and `build_discrepancy_report(employee_df) -> bytes | None` (returns `None` when there are zero `discrepancy`-status rows, `openpyxl`, `research.md` #6) (depends on T006)
- [X] T008 [US1] In `backend/services/payroll_reconcile_service.py`, implement `reconcile_payroll(payroll_content: bytes, payroll_filename: str, period: str) -> dict` orchestrating T006 → T007, assembling `summary` (`total_employees_reconciled`, `matched_count`, `discrepancy_count`, `discrepancies_by_department`) and `discrepancies` (every non-matched employee, any status) per `data-model.md` (depends on T007)
- [X] T009 [US1] In `backend/routers/accounts.py`, add `POST /payroll-reconcile` accepting `payrollFile: UploadFile = File(...)` and `period: str = Form(...)`; read the upload's bytes, call `payroll_reconcile_service.reconcile_payroll(...)`, catch `PayrollReconcileRequestError` → `HTTPException(status_code=400, detail=str(exc))`, and return `ReconcilePayrollResponse(**result)` (depends on T008, T002)
- [X] T010 [P] [US1] Create `frontend/src/services/payrollReconcileService.ts`: camelCase TypeScript types (`ReconciliationEntry`, `ReconciliationSummary`, `FileAttachment`, `ReconcilePayrollResponse`) and `reconcilePayroll(payrollFile: File, period: string): Promise<ReconcilePayrollResponse>` posting `multipart/form-data` (`payrollFile`, `period`) to the full backend URL `/accounts/payroll-reconcile`, mirroring `benefitsService.ts`'s pattern
- [X] T011 [US1] Create `frontend/src/pages/PayrollReconcile.tsx` modeled on `EmployeeBenefits.tsx`: a payroll-file `<input type="file">`, a period `<input type="month">`, a `useMutation` (TanStack Query) calling `reconcilePayroll`, a submit guard blocking submission when no file is selected (FR-012, US1 AC3), and a "Reconciliation Summary" panel rendering `summary`'s counts and the `discrepancies` list (department, employee, stated amount, recalculated amount, variance, detail) — no download buttons yet (Phase 3/US2)
- [X] T012 [US1] Add the `/payroll-reconciliation` route for `PayrollReconcile` in `frontend/src/App.tsx` (depends on T011)

**Checkpoint**: User Story 1 is fully functional and independently testable — the endpoint recalculates and compares wages end-to-end, and the summary/discrepancy list renders on screen. (The API response already carries both report attachments per the contract; no UI consumes them until Phase 3.)

---

## Phase 3: User Story 2 - Download Reconciliation Reports (Priority: P2)

**Goal**: Expose the report attachments the API already returns (T007) through the UI, with dedicated verification of their contents.

**Independent Test**: Run a reconciliation with at least one discrepancy, download both reports, and confirm the full report lists every employee while the discrepancies-only report lists only the mismatched ones; run one with zero discrepancies and confirm no discrepancies-report download is offered.

- [X] T013 [P] [US2] In `backend/tests/test_payroll_reconcile.py`, add tests asserting `build_reconciliation_report()` includes every employee processed (matched and flagged) with stated amount, recalculated amount, and status, and that `build_discrepancy_report()` returns `None` for an all-matched run and a workbook containing only flagged employees otherwise (US2 AC1-AC3) — exercises T007's report builders directly
- [X] T014 [US2] In `frontend/src/pages/PayrollReconcile.tsx`, add a local `downloadFileAttachment()` helper (same base64-to-`Blob` decode as `EmployeeBenefits.tsx`) and two actions: "Download Reconciliation Report" (always enabled, wired to `result.reconciliationReport`) and "Download Discrepancies Report" (rendered only when `result.discrepancyReport` is non-null, US2 AC3)

**Checkpoint**: User Stories 1 and 2 both hold — downloads work and correctly reflect the on-screen results.

---

## Phase 4: User Story 3 - Trust Results Across All Employee Categories (Priority: P3)

**Goal**: Confirm discrepancies are correctly attributed to their department and recalculated with that department's own formula — the multi-department correctness already implemented by T007, made explicitly verifiable on its own.

**Independent Test**: Upload a file with mismatches in more than one department category and confirm each discrepancy is labeled with the correct department and uses that department's formula.

- [X] T015 [US3] In `backend/tests/test_payroll_reconcile.py`, add a dedicated multi-department test: a fixture with a discrepancy in each of the four recognized categories (`สำนักงาน`, `โรงเหล็ก`, `โรงเย็บ`, `พนง.ชั่วคราว`) asserts every discrepancy's `department` matches its section and its `recalculatedAmount` reflects that department's own formula (office `/30` daily divisor vs. factory/contract `/8` hourly OT divisor, `research.md` #4) — exercises T007's branching; no new production code expected
- [X] T016 [US3] Manually verify via `quickstart.md` Scenario 2 that the discrepancy list rendered by `PayrollReconcile.tsx` (T011) displays each entry's `department` so categories are visually distinguishable — no code change expected; if the label is missing, the defect is in T011

**Checkpoint**: All three user stories are independently functional.

---

## Phase 5: Polish & Cross-Cutting Concerns

- [X] T017 [P] Run `npm run build` + `npm run lint` in `frontend/`, and `cd backend; .venv/Scripts/pytest tests/test_payroll_reconcile.py tests/test_calculate_benefits.py`, confirming no regressions (the latter guards against T001's `common.py` extraction breaking the existing Employee Benefits feature)
- [X] T018 Manually execute `quickstart.md` Scenarios 1, 3, and 4 (all-matched, unrecognized-department/data-error handling, request-level failures) against the running frontend + backend

---

## Dependencies & Execution Order

- **Foundational (T001-T002)**: No dependencies; both [P], blocks all user stories
- **User Story 1 (T003-T012)**: Depends on Foundational. Within it: T003 first (fixture helper); T004-T005 depend on T003 but not on each other ([P]); T006 blocks T007; T007 blocks T008; T008 blocks T009; T010 (frontend service) can proceed in parallel with T006-T009 (backend) since the contract is already fixed by `contracts/payroll-reconciliation-api.md`; T011 depends on T010; T012 depends on T011
- **User Story 2 (T013-T014)**: Depends on US1's T007 (report builders) already existing; adds verification + UI, no new backend computation
- **User Story 3 (T015-T016)**: Depends on US1's T007 (formula branching) already existing; adds verification only
- **Polish (T017-T018)**: Depends on all user stories being complete

## Parallel Example

```bash
# Foundational:
Task: "Extract CamelModel/FileAttachment into backend/models/common.py"     # T001
Task: "Create backend/models/payroll.py response models"                    # T002

# After T003 (fixture helper) lands, within User Story 1:
Task: "Add formula/discrepancy/rounding tests in backend/tests/test_payroll_reconcile.py"   # T004
Task: "Add request-level-failure tests in backend/tests/test_payroll_reconcile.py"           # T005

# Backend (T006-T009) and frontend service (T010) tracks in parallel:
Task: "Implement parsing pipeline in backend/services/payroll_reconcile_service.py"          # T006
Task: "Create frontend/src/services/payrollReconcileService.ts"                              # T010
```

## Implementation Strategy

**MVP**: Foundational → User Story 1 → run T017 + relevant quickstart scenarios. User Story 1 alone delivers the feature's core value (upload, recalculate, see results); User Stories 2 and 3 expose and verify guarantees (report downloads, per-department correctness) that US1's implementation must already satisfy — confirm with Phases 3-4 before calling the feature done.

## Notes

- [P] tasks touch different files, or the same test file with independent additions and no dependency between them
- Verify tests fail before implementing (T003-T005, T013's first half)
- Stop at any checkpoint to validate a story independently
- `PayrollReconcileRequestError` (raised by T006, caught by T009) mirrors `accounts_service.py`'s existing `BenefitsRequestError` — a request-level failure distinct from a per-employee exception, per the contract's 4xx-vs-200 distinction
