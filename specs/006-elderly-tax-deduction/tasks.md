# Tasks: Elderly-Employee Tax Deduction Service

**Input**: Design documents from `specs/006-elderly-tax-deduction/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/tax-deduction-api.md, contracts/health-api.md, quickstart.md

**Tests**: Included — spec.md's NFR requires the eligibility/ranking/cap/monthly-fill logic to be pure, unit-testable functions, and plan.md's Testing section names the exact scenarios `backend/tests/test_tax_deduction.py` must cover.

**Organization**: Tasks are grouped by user story (spec.md priorities P1/P2/P3). The feature is served by a **single** backend endpoint (`POST /accounts/tax-deduction`, per the consolidated `contracts/tax-deduction-api.md`) whose one JSON response already carries everything all three stories need — so the backend calculation pipeline and response shape are built once, in Setup/Foundational, and each user story phase adds the specific slice of behavior (file download, on-screen breakdown, rule visibility) that story is responsible for proving, plus the frontend surface for it.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Paths are exact, repo-relative

## Path Conventions

Web app (per `CLAUDE.md`/plan.md): `backend/` (FastAPI) and `frontend/` (React+TS), run as two independent processes — no shared build.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Test fixtures and dependency confirmation shared by every later phase

- [X] T001 Create test fixture workbooks `backend/tests/fixtures/tax_deduction_roster.xlsx` and `backend/tests/fixtures/tax_deduction_roster_malformed.xlsx`, matching the `ข้อมูลพนักงาน`/`ผลประโยช์นพนักงาน` template documented in `data-model.md` (8 identity columns + 12 `รวม`-terminated month blocks with `โบนัส` before the 3rd/12th, and a 4-row-title output sheet). Build `tax_deduction_roster.xlsx` with a small mixed roster (e.g. 10 rows): at least one clearly selected employee (age > 60, salary <= 15,000), two employees tied on average salary to exercise the `seq` tie-break, enough eligible employees to exceed a 10%-of-headcount cap so at least one is eligible-but-excluded, one employee ineligible by age only, one ineligible by salary only, and one new-hire employee with fewer than 12 populated months. Build `tax_deduction_roster_malformed.xlsx` as a copy with the `ผลประโยช์นพนักงาน` sheet deleted. Generate both via a throwaway `openpyxl` script (not committed) run through `backend/.venv/Scripts/python.exe`, optionally starting from `Tax_Reduction_Sample.xlsx` at the repo root for column layout reference.
- [X] T002 [P] Confirm `backend/requirements.txt` already provides `openpyxl`, `pandas`, `numpy`, and `pytest` and `frontend/package.json` already provides `@tanstack/react-query` — verification only, no dependency changes expected (plan.md Technical Context).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The pure calculation core (constants, parsing, eligibility/ranking/cap/monthly-fill, workbook writer) that every user story's endpoint and UI depend on. No file/HTTP dependency, per spec.md's NFR.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T003 Add `correct_be_year(dob: date, reference_date: date) -> date` to `backend/util/be_dates.py`, alongside the existing `retirement_date`/`benefit_year_end_date` helpers: `return dob.replace(year=dob.year - 543) if dob.year > reference_date.year else dob` (research.md #4 — `BE_YEAR_OFFSET = 543`).
- [X] T004 [P] Unit tests for `correct_be_year` in `backend/tests/test_be_dates.py`: a BE-mislabeled year (e.g. `2497-03-26` with `reference_date=2026-09-18`) corrects to `1954-03-26`; a genuine Gregorian year is returned unchanged; the boundary case `dob.year == reference_date.year` is left uncorrected.
- [X] T005 Create `backend/models/tax_deduction.py` with `TaxDeductionEmployeeResult`, `TaxDeductionSummary` (run stats **and** the rule constants applied — `ageThreshold`, `salaryCapPerMonth`, `headcountCapPercent`, `headcountCapRounding`, `beYearOffset`), and `CalculateTaxDeductionResponse` (`summary` + `employees` + `taxDeductionReport: FileAttachment`) as `CamelModel` subclasses, importing `CamelModel`/`FileAttachment` from `backend/models/common.py` — field lists exactly per `data-model.md`'s "Wire models" section.
- [X] T006 In `backend/services/tax_deduction_service.py`, define the module constants `AGE_THRESHOLD = 60`, `SALARY_CAP = 15000.0`, `HEADCOUNT_CAP_PERCENT = 0.10`, `HEADCOUNT_CAP_ROUNDING = "floor"`, `BE_YEAR_OFFSET = 543` (data-model.md Rule set table), and a `TaxDeductionRequestError(Exception)` class for malformed-upload signaling (research.md #9).
- [X] T007 In `backend/services/tax_deduction_service.py`, implement `read_roster(content: bytes) -> pd.DataFrame`: load `ข้อมูลพนักงาน` via `pd.read_excel(io.BytesIO(content), sheet_name="ข้อมูลพนักงาน", header=None, engine="openpyxl")`, resolve the 8 identity columns (`ลำดับ`, `เลขบัตรประชาชน`, `คำนำหน้า`, `ชื่อ`, `สกุล`, `อัตราค่าแรง`, `วันเดือนปีเกิด`, `คนพิการ`) by header text, scan row 1 left-to-right for every `รวม` occurrence to locate the 12 month blocks in calendar order, and build `monthly_net[1..12]` per research.md #2's branch rule (non-bonus months read `รวม` directly; March/December compute `wage + OT.fillna(0)`, ignoring `รวม`/`โบนัส`). Raise `TaxDeductionRequestError` (naming what's missing) when the sheet, an identity header, or fewer/more than 12 `รวม` occurrences are found.
- [X] T008 [P] In `backend/services/tax_deduction_service.py`, implement `validate_output_sheet(workbook) -> None`: confirms `ผลประโยช์นพนักงาน` exists and row 4 contains `เงินเดือน`, `วันเดือนปีเกิด`, `อายุปัจจุบัน`, all 12 month-name headers, and `รวม` (research.md #3 — `เลขบัตรประชาชน` is optional), raising `TaxDeductionRequestError` naming the first missing header otherwise.
- [X] T009 In `backend/services/tax_deduction_service.py`, implement `calculate(roster: pd.DataFrame, reference_date: date) -> pd.DataFrame`: apply `correct_be_year` (T003) to every `date_of_birth`, compute `age` and `average_monthly_net_salary` (sum of populated `monthly_net` columns ÷ count of populated months — never ÷12, research.md #5), the combined `eligible = (age > AGE_THRESHOLD) & (average_monthly_net_salary <= SALARY_CAP)` for every row, `rank` (1-based, eligible rows only, sorted by `average_monthly_net_salary` descending, ties by ascending `seq`), `selected` (top `floor(len(roster) * HEADCOUNT_CAP_PERCENT)` eligible rows by rank), and per-row `monthly_deduction[1..12]` (`monthly_net[m]` for populated months of `selected` rows where `monthly_net[m] <= SALARY_CAP`, `0` for an unpopulated month, an over-cap month — never clamped to `SALARY_CAP` — or any non-`selected` row) and `total_deduction` — per research.md #10's pipeline order and data-model.md's `EmployeeCalculationResult` columns.
- [X] T010 [P] Unit tests for `calculate` in `backend/tests/test_tax_deduction.py`, using small in-memory `DataFrame`s (no file I/O, per the NFR): BE-corrected age drives eligibility correctly; partial-year averaging divides by populated-month count, not 12; a month with `wage+OT` over `SALARY_CAP` reads `0` for only that month while the employee stays `selected` and other months are unaffected; two employees with identical `average_monthly_net_salary` are ordered by ascending `seq`; a headcount small enough that `floor(headcount * 0.10) == 0` yields `eligible=True, selected=False` for everyone who passes age/salary.
- [X] T011 In `backend/services/tax_deduction_service.py`, implement `fill_output_workbook(content: bytes, filename: str, results: pd.DataFrame) -> FileAttachment`: `openpyxl.load_workbook(io.BytesIO(content))`, write `results` into `ผลประโยช์นพนักงาน` starting at row 5 (row `5 + seq - 1`, original `seq` order) per `data-model.md`'s "Output sheet write mapping" table, leave rows 1–4 of that sheet and the entire `ข้อมูลพนักงาน` sheet untouched, save to an in-memory buffer, base64-encode it, and return a `FileAttachment(filename=filename, content_base64=...)`. (Post-implementation revision, `research.md` #6 revised: `fill_output_workbook` now takes only `results` and loads the static `TEMPLATE_PATH` template — `backend/data/Tax_Reduction_Template.xlsx` — instead of the uploaded `content`; `content`/`filename` params were removed, and `validate_output_sheet`/T008 was deleted as dead code since the upload's own output sheet is no longer read.)
- [X] T012 [P] Unit test for `fill_output_workbook` in `backend/tests/test_tax_deduction.py`, round-tripping `backend/tests/fixtures/tax_deduction_roster.xlsx` through `read_roster` → `calculate` → `fill_output_workbook` → decode: confirms `ข้อมูลพนักงาน` is byte-for-byte unchanged, `ผลประโยช์นพนักงาน` rows 1–4 are unchanged, and the written data rows match `calculate`'s output exactly.

**Checkpoint**: The full calculation pipeline and output-workbook writer exist and are unit-tested in isolation. User story phases below wire this into the HTTP layer and the UI.

---

## Phase 3: User Story 1 - HR calculates the deduction and gets the filled workbook back (Priority: P1) 🎯 MVP

**Goal**: Upload a payroll workbook and receive back the same workbook with the calculation sheet filled in (FR-001–FR-008, FR-011).

**Independent Test**: quickstart.md Scenario 1 (upload `Tax_Reduction_Sample_filled.xlsx`, decode `taxDeductionReport`, confirm the filled workbook matches the worked example) and Scenario 3 (malformed upload rejected with 400/422, not a miscalculation).

### Tests for User Story 1

- [X] T013 [P] [US1] Integration test in `backend/tests/test_tax_deduction.py`: `POST /accounts/tax-deduction` (FastAPI `TestClient`) with `tax_deduction_roster.xlsx` returns 200 with a `taxDeductionReport.contentBase64` that decodes to a valid `.xlsx`; with `tax_deduction_roster_malformed.xlsx` returns 400 naming the missing `ผลประโยช์นพนักงาน` sheet; with `payrollFile` omitted returns 422 (per `contracts/tax-deduction-api.md`). Expect this to fail until T014–T015 exist.

### Implementation for User Story 1

- [X] T014 [US1] In `backend/services/tax_deduction_service.py`, implement `calculate_tax_deduction(payroll_content: bytes, payroll_filename: str, reference_date: date | None) -> dict` — the single calculation-run entry point (research.md #10) that calls `read_roster` (T007) → `validate_output_sheet` (T008) → `calculate` (T009) → `fill_output_workbook` (T011), defaults `reference_date` to today, and returns a dict matching `CalculateTaxDeductionResponse`'s shape (`summary` including every rule constant from T006, `employees`, `taxDeductionReport`). (Post-implementation revision alongside T011's: the `validate_output_sheet` call and the `payroll_filename` parameter were removed — see T011's note.)
- [X] T015 [US1] Add `POST /accounts/tax-deduction` to `backend/routers/accounts.py`: `payrollFile: UploadFile = File(...)`, `referenceDate: str | None = Form(None)`, `response_model=CalculateTaxDeductionResponse`; parses `referenceDate` when supplied, calls `tax_deduction_service.calculate_tax_deduction`, catches `TaxDeductionRequestError` and raises `HTTPException(status_code=400, detail=str(exc))` — mirroring the existing `employee-benefits`/`bonus-calculation`/`payroll-reconcile` handlers in the same file exactly.
- [X] T016 [US1] Create `frontend/src/services/taxDeductionService.ts`: camelCase `TaxDeductionEmployeeResult`, `TaxDeductionSummary`, `CalculateTaxDeductionResponse`, `FileAttachment` types matching `data-model.md`, and `calculateTaxDeduction(payrollFile: File, referenceDate?: string): Promise<CalculateTaxDeductionResponse>` posting `multipart/form-data` to `` `${API_BASE_URL}/accounts/tax-deduction` `` — following the `fetch`-based pattern in `frontend/src/services/bonusService.ts`.
- [X] T017 [US1] Rewire `frontend/src/pages/TaxDeduction.tsx` off its current stale `benefitsService`/`calculateBenefits` wiring onto `taxDeductionService.calculateTaxDeduction`: a single payroll-file upload input, an optional reference-date input, a submit button driving a `useMutation`, and a "Download filled workbook" button that decodes/saves `result.taxDeductionReport` via the same `downloadFileAttachment` helper already defined in this file.

**Checkpoint**: User Story 1 is fully functional — HR can upload a payroll workbook and download the filled calculation from the web portal.

---

## Phase 4: User Story 2 - HR reviews the calculation on-screen before exporting (Priority: P2)

**Goal**: See the per-employee breakdown on screen, with the three eligibility/selection states visibly distinguished (FR-009, FR-014).

**Independent Test**: quickstart.md Scenario 2 — after one upload, inspect the on-screen table for a not-eligible row (age/salary shown, all-zero months), an eligible-but-excluded row (positive rank, all-zero months), and a selected row (non-zero months), without downloading anything.

### Tests for User Story 2

- [X] T018 [P] [US2] Backend test in `backend/tests/test_tax_deduction.py` asserting `calculate_tax_deduction`'s `employees` list contains every roster row (not eligible-only), sorted by `total_amount` descending with ties broken by ascending `seq` (post-implementation revision — originally seq order, changed per explicit follow-up direction to sort by total deduction; the filled workbook's row placement is unaffected, see `contracts/tax-deduction-api.md`), and that the three FR-014 states are each shaped correctly: not-eligible (`eligible=False`, `rank=None`, all-zero `monthlyAmounts`, non-null `age`/`averageMonthlySalary`), eligible-but-excluded (`eligible=True`, `selected=False`, positive `rank`, all-zero `monthlyAmounts`), and selected (`eligible=True`, `selected=True`, positive `rank`, non-zero `monthlyAmounts` where populated).

### Implementation for User Story 2

- [X] T019 [US2] In `frontend/src/pages/TaxDeduction.tsx`, add a results table rendering `result.employees`: sequence, name, age, average salary, a status badge derived from `eligible`/`selected` ("Not eligible" / "Eligible, not selected" / "Selected"), the 12 monthly amounts, and the total — styled with existing DaisyUI/Tailwind tokens per `CLAUDE.md`'s Layout → Sizing → Typography → Colors → States class-ordering convention.

**Checkpoint**: User Stories 1 and 2 both work — the filled workbook downloads, and the same run's results are also reviewable on screen with the three states visibly distinct.

---

## Phase 5: User Story 3 - A rule owner confirms which constants were used for a given run (Priority: P3)

**Goal**: The business-rule constants a run actually applied are visible alongside its results (FR-010, SC-004).

**Independent Test**: quickstart.md Scenario 1 steps 2–3 — confirm the displayed constants match `tax_deduction_service`'s module values, and that supplying a different `referenceDate` changes both the displayed reference date and the computed ages/eligibility together.

### Tests for User Story 3

- [X] T020 [P] [US3] Backend test in `backend/tests/test_tax_deduction.py` asserting `calculate_tax_deduction`'s `summary` fields `ageThreshold`, `salaryCapPerMonth`, `headcountCapPercent`, `headcountCapRounding`, and `beYearOffset` exactly equal `tax_deduction_service`'s module constants (T006), and that passing a different `reference_date` changes `summary.referenceDate` and the computed `age`/`eligible` values consistently with each other (SC-004).

### Implementation for User Story 3

- [X] T021 [US3] In `frontend/src/pages/TaxDeduction.tsx`, add an "Active rules for this run" panel displaying `result.summary`'s `ageThreshold`, `salaryCapPerMonth`, `headcountCapPercent`, `beYearOffset`, and `referenceDate`, alongside the existing headcount/eligible/cap/selected counts.

**Checkpoint**: All three user stories are independently functional from the one endpoint's response.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Items outside the three user stories — the standalone health probe and final verification

- [X] T022 [P] Add `GET /health` returning `{"status": "ok"}` directly in `backend/main.py` (no new router, no `/accounts` prefix — research.md #11; unrelated to the tax-deduction endpoint consolidation).
- [X] T023 [P] Add `checkHealth(): Promise<{ status: string }>` to `frontend/src/services/taxDeductionService.ts` calling `GET /health` (`contracts/health-api.md`).
- [X] T024 Run `pytest` in `backend/` and `npm run build` (`tsc -b` + `vite build`) plus `npm run lint` in `frontend/`; fix any failures introduced by this feature's changes.
- [X] T025 Execute `specs/006-elderly-tax-deduction/quickstart.md` end-to-end against the running dev servers (`uvicorn main:app --reload` + `npm run dev`) using the real `Tax_Reduction_Sample_filled.xlsx` at the repo root, confirming all four scenarios pass as documented.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately.
- **Foundational (Phase 2)**: Depends on Setup (T010/T012's tests exercise the fixtures from T001) — BLOCKS all user stories.
- **User Story 1 (Phase 3)**: Depends on Foundational (T014 calls T007/T009/T011 directly).
- **User Story 2 (Phase 4)**: Depends on User Story 1 (T019 extends the page and mutation result T017 introduced; T018 exercises the same `calculate_tax_deduction` entry point T014 built).
- **User Story 3 (Phase 5)**: Depends on User Story 1 (T021 extends the same page; T020 exercises the same entry point) — independent of Phase 4's changes (different fields of the same response).
- **Polish (Phase 6)**: Depends on Phases 1–5 being complete.

### User Story Dependencies

Because all three stories are carried by one endpoint's single response, US2 and US3 are additive presentation/verification layers on top of US1's already-complete backend, rather than independent backend slices — but each remains independently *testable*: US1 via the file-download quickstart scenario, US2 via the on-screen three-state check, US3 via the rule-constants check, each against fields already present in T014's output.

### Within Each User Story

- Story-level tests (T013, T018, T020) are written to validate the story's slice of the already-existing `calculate_tax_deduction` output/endpoint, and should fail until that story's implementation tasks land.
- Within Foundational: T003 before T004; T007/T008/T009 before T010; T009/T011 before T012.

### Parallel Opportunities

- T001 and T002 (Setup) can run in parallel.
- T004, T008, T010, T012 (Foundational tests/validator, each touching a different concern) can run in parallel with each other once their respective implementation task lands, but not before it.
- T013 (US1 test) can be authored in parallel with T016 (frontend service) — different files, both depend only on Foundational.
- T018 (US2 backend test) and T020 (US3 backend test) touch the same test file but different assertions — treat as sequential edits to `backend/tests/test_tax_deduction.py`, not parallel.
- T022 and T023 (Polish) can run in parallel — different files, unrelated to the tax-deduction endpoint.

---

## Parallel Example: Foundational Phase

```bash
# Once T003 (correct_be_year) lands:
Task: "Unit tests for correct_be_year in backend/tests/test_be_dates.py"

# Once T007 (roster reader) lands, in parallel with T008 (output validator — different function, same file, but no shared state):
Task: "Implement validate_output_sheet in backend/services/tax_deduction_service.py"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (fixtures).
2. Complete Phase 2: Foundational (pure calculation core — this is most of the feature's real logic).
3. Complete Phase 3: User Story 1 (wire the endpoint, rewire the page, download the filled workbook).
4. **STOP and VALIDATE**: Run quickstart.md Scenario 1 (file part) and Scenario 3 against the MVP.
5. Deploy/demo if ready — HR already gets the core value (no more manual spreadsheet work).

### Incremental Delivery

1. Setup + Foundational → calculation core proven correct in isolation via unit tests.
2. Add User Story 1 → filled-workbook download works end-to-end → demo-able MVP.
3. Add User Story 2 → on-screen three-state breakdown appears on the same page, no backend change.
4. Add User Story 3 → active-rules panel appears on the same page, no backend change.
5. Polish → `/health`, full lint/type/test pass, final quickstart run.

---

## Notes

- [P] tasks = different files (or, within one file, independent functions with no shared state), no dependencies.
- Because one endpoint serves all three stories, "independent" for US2/US3 means independently *verifiable* (a distinct quickstart scenario and a distinct backend test), not independently *deployable* backend slices — this is a deliberate consequence of the single-endpoint design in `research.md` #7, not an oversight.
- Commit after each task or logical group.
- Every business-rule constant (T006) is defined exactly once and consumed by both `calculate`/`fill_output_workbook` and the `summary` object (T005/T014) — never re-declared in the router or the frontend.
