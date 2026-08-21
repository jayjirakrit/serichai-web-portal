---

description: "Task list for Employee Benefit Calculation"

---

# Tasks: Employee Benefit Calculation

**Input**: Design documents from `specs/001-employee-benefit-calculation/`

**Status**: The feature was originally built as a four-phase, three-file matching/carry-forward pipeline (Setup → Foundational → User Stories 1-4 → Polish), then a fifth, additive master-data-only formula path (User Story 5) was built alongside it. On 2026-08-19 the matching/carry-forward pipeline was removed and the formula path was promoted to be the one implementation at the original `POST /accounts/employee-benefits` endpoint (`spec.md`'s "Design history"). The task list below reflects the current, single-pipeline implementation; the superseded phases' task IDs (T001-T025) are intentionally not reused, so this list picks up at T026 to keep prior task-history references (commits, PRs) resolvable.

## Path Conventions

- Backend: `backend/routers/accounts.py`, `backend/services/accounts_service.py`, `backend/models/benefits.py`, `backend/util/be_dates.py`, `backend/tests/`
- Frontend: `frontend/src/pages/EmployeeBenefits.tsx`, `frontend/src/services/benefitsService.ts`
- Sample data: `sample-data/master.xlsx`

---

## Phase 1: Formula pipeline (removal + implementation)

**Goal**: Replace the matching/carry-forward pipeline with the single-file formula calculation at `POST /accounts/employee-benefits`.

- [X] T026 Remove the matching/carry-forward pipeline from `backend/services/accounts_service.py` (`PersonRow`, `MatchResult`, `normalize_id`, `normalize_name_key`, `parse_date`, `build_person_rows`, `match_employees`, `compute_eligibility` (old signature), `flag_resignations`, `carry_forward`, `EXCEPTION_CATEGORIES`, `ELIGIBILITY_AGE`-unrelated matching helpers) and the old `calculate_benefits(payroll_content, ..., previous_content=None)` orchestrator; delete `backend/tests/test_matching.py`, `test_eligibility.py`, `test_resignation.py`, `test_carry_forward.py` (they tested the removed functions); remove the now-unused `age_at_year_end()` from `backend/util/be_dates.py` and its test; trim `backend/tests/conftest.py` to just the `sys.path` bootstrap (its `PersonRow`-based fixtures were only used by the removed tests)
- [X] T027 Promote the master-data-only formula function to be `calculate_benefits()`/`compute_benefit_rows()` in `backend/services/accounts_service.py` (renamed from `calculate_benefit_projection()`/`compute_benefit_projection_rows()`); add the eligibility-age (35) filter carried over from the original design (`research.md` #9) so an employee below the threshold is silently excluded, not computed
- [X] T028 Consolidate `backend/models/benefits.py`: `ExceptionCategory` now has a single value, `missingRequiredField`; `CalculationSummary` reports `computedCount` (not `matchedCount`/`newEligibleCount`, which no longer apply); `CalculateBenefitsResponse` is the one response model
- [X] T029 Update `backend/routers/accounts.py`: `POST /accounts/employee-benefits` now accepts a single `masterFile` field and calls `accounts_service.calculate_benefits(master_content, master_filename)`; the separate `POST /accounts/employee-benefit-projections` route is removed
- [X] T030 Rename `backend/tests/test_benefit_projection.py` → `backend/tests/test_calculate_benefits.py`, updated for the renamed functions, plus a new test asserting an employee below the eligibility age is silently excluded (no exception)
- [X] T031 Add `numpy` to `backend/requirements.txt` (already a transitive `pandas` dependency, but imported directly by `_bracket_lookup()`)

**Checkpoint**: `pytest` passes (14/14); `curl`/`TestClient` smoke test against `backend/data/Employee_Master_Data.xlsx` returns 89 `missingRequiredField` exceptions (expected — that file has no populated dates of birth yet, `research.md`'s "Open assumption").

---

## Phase 2: Frontend + sample data

**Goal**: Update the frontend to the single-file contract and provide a sample file that actually produces computed rows, then verify the flow live in a browser.

- [X] T032 [P] Rewrite `frontend/src/services/benefitsService.ts`: `calculateBenefits(masterFile: File)` posts a single `masterFile` field; `CalculationSummary`/`ExceptionCategory` types match the consolidated response shape
- [X] T033 [P] Rewrite `frontend/src/pages/EmployeeBenefits.tsx`: one file input (Employee Master Data), remove the payroll/previous-year inputs, Validation Summary shows `Computed` instead of `Matched`/`Newly eligible`
- [X] T034 Remove `sample-data/payroll.xlsx` and `sample-data/previous_benefit.xlsx` (inputs to the removed endpoint shape); keep `sample-data/master.xlsx`, which already has populated dates of birth/start dates/wage rates for 7 employees spanning above/below the eligibility age, above/below retirement age, and one resigned
- [X] T035 Run `npm run build` (`tsc -b` + `vite build`) and `npm run lint` from `frontend/` to confirm the reworked page/service pass the repo's quality gates
- [X] T036 Execute `quickstart.md`'s scenario live: `uvicorn main:app --reload` (backend) + `npm run dev` (frontend, must land on port 5173 — the backend's CORS allowlist doesn't permit other localhost ports) + browser upload of `sample-data/master.xlsx` at `/employee-benefits`; confirmed `Total employees out: 6`, `Computed: 6`, `Resigned flagged: 1`, `Exceptions: 0` (the 7th employee, age 21, correctly excluded from the count without an exception)

**Checkpoint**: Feature is usable end-to-end through the actual UI, verified against a file with real data rather than only via `pytest`/`TestClient`.

---

## Phase 3: Output workbook built from the real template file

**Goal**: The final benefit workbook must be produced by opening `backend/data/Employee_Benefit_Template.xlsx` itself and appending computed rows after its existing header row, rather than generating a workbook that only matches the template's column shape (FR-014, `research.md` #10).

- [X] T037 Rewrite `build_output_workbook()` in `backend/services/accounts_service.py` to `openpyxl.load_workbook(TEMPLATE_PATH)` (new `TEMPLATE_PATH` constant pointing at `backend/data/Employee_Benefit_Template.xlsx`) instead of constructing a fresh `Workbook()`; write the per-run year-end date into the template's own `G2` cell; append each computed row via `ws.append(...)`, which lands directly below the template's existing header row (row 4) since `ws.append()` continues after the current max row
- [X] T038 Add `test_output_workbook_uses_template_and_appends_rows_after_header` to `backend/tests/test_calculate_benefits.py`, asserting the produced workbook's rows 1-3 (company header, date/assumptions, instructions) and merged ranges come from the template unchanged, row 4 is still the template's own header row, and computed rows start at row 5

**Checkpoint**: `pytest` passes (15/15); output workbook opened manually confirms the company header/instructions/merged cells from `Employee_Benefit_Template.xlsx` are present and computed rows start at row 5.

---

## Notes

- Commit after each task or logical group.
- The formula's business-side open questions (`research.md` #7-8: the reconstructed `$F$3` proration threshold, and the daily-wage-scale values in `อัตราค่าแรง`) remain unconfirmed with HR/finance — flag before relying on this endpoint's output for a real filing.
- `backend/data/Employee_Master_Data.xlsx` needs real dates of birth populated before a run against it produces any calculated rows; `sample-data/master.xlsx` is the file to use for demos/testing until then.
