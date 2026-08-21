# Research: Employee Benefit Calculation

## Superseded decisions (2026-08-19 pivot to a single master-data-only formula path)

The feature was originally built as a three-file (payroll + master + previous-year) matching/carry-forward pipeline with the benefit-amount formula out of scope, then rebuilt as a single-file formula calculation once the formula was reverse-engineered (`spec.md`'s "Design history"). The decisions below record the earlier design for historical context; they no longer describe the shipped implementation.

- **Employee matching strategy (ID-first, name-fallback matching across payroll/master files)** — superseded: there is no second file to match against anymore. `match_employees()`, `PersonRow`, and the ID/name normalization helpers were removed from `accounts_service.py`.
- **Age-eligibility reference date via plain BE-year subtraction** (`year_end.year - dob.year`, no month/day adjustment) — superseded by the completed-whole-years (`DATEDIF`-equivalent) calculation in #9 below, which the reconstructed formula requires for the non-year-end date comparisons (e.g. `years_to_retirement`). `be_dates.age_at_year_end()` was removed as dead code.
- **Carry-forward semantics** (copy every column from a previous-year file verbatim except salary/resigned-flag/dates) — superseded: there is no previous-year file input anymore. Every liability column is recomputed from the formula on every run. `carry_forward()` was removed.
- **Relationship between the formula calculation and the matching pipeline** (originally: keep them as two separate, independently-maintained paths) — superseded by the decision to fully replace the matching pipeline with the formula path at the same endpoint, once it became clear maintaining both would produce two different liability figures for the same employee depending on which path ran.

## 1. Resignation status source

- **Decision**: Treat the employee master file's status column (`สถานะ`, present but unpopulated in the current template) as authoritative. A single configured marker value (default: exact string `"ลาออก"`) sets the resigned flag; blank or any other value means active.
- **Rationale**: Per the spec's Assumptions, resignation is authoritatively determined by the master source, not inferred. No populated example of the status column exists in the current template, so a single named, easily-extended marker constant keeps behavior explicit rather than guessing at multiple synonyms.
- **Alternatives considered**: Inferring resignation from absence in payroll — moot now (no payroll file), and was rejected even under the original design by the spec's Assumptions section.

## 2. Output delivery shape

- **Decision**: A single synchronous API call returns one JSON body containing the exception summary/list plus both output files (final benefit workbook, exception report) inline as base64. No server-side job queue, token, or temp-file storage.
- **Rationale**: Sample data is tens to low hundreds of rows; synchronous processing easily fits SC-001's target. A job/token/temp-storage layer would be unjustified complexity at this scale (Constitution Principle V).
- **Alternatives considered**: Background job + polling — rejected, unnecessary at this data scale. Server-side temp file + download-by-token endpoint — rejected, adds statefulness/cleanup with no benefit over inline base64 at these file sizes.

## 3. Exception report format

- **Decision**: A standalone `.xlsx` workbook, one sheet, columns `Category | Employee ID | Employee Name | Detail`.
- **Rationale**: Matches the domain's existing Excel-native workflow; a `Category` column gives HR a groupable/sortable exceptions list without inventing new UI.
- **Alternatives considered**: CSV — rejected, loses the grouping/formatting HR expects from the existing Excel workflow. Exceptions rendered only in the frontend with no file — rejected, FR-015 requires a standalone document.

## 4. Frontend test strategy for this feature

- **Decision**: No new frontend test runner is introduced. The upload → submit → review flow is validated manually via `quickstart.md`. Backend business logic (the formula, bracket-table lookups, eligibility, resignation, BE-date handling) gets `pytest` unit tests.
- **Rationale**: `CLAUDE.md` records no test runner (Jest/Vitest) is configured in `frontend/` yet; introducing one is a repo-wide tooling decision beyond this feature. The frontend page is thin orchestration (upload one file, call one endpoint, render its response) with no independent decision logic worth unit-testing.
- **Alternatives considered**: Introduce Vitest + React Testing Library for this one page — rejected as disproportionate scope creep for a single thin page.

## 5. API naming conventions (endpoint path + JSON field casing)

- **Decision**: The endpoint is `POST /accounts/employee-benefits` (kebab-case, resource-named — not a verb-suffixed `/calculate` action path). The final output file field is named `employeeBenefitsReport`. All JSON request/response field names use camelCase, bridged from the backend's `snake_case` Python attributes via a Pydantic `alias_generator`.
- **Rationale**: Adopted as a repo-wide API convention (recorded in `CLAUDE.md` and the constitution's Principle III) rather than a one-off choice for this feature, so every future endpoint follows the same shape and frontend/backend field names don't need a per-feature translation table.
- **Alternatives considered**: `snake_case` JSON to mirror Python directly — rejected in favor of camelCase, the prevailing convention on the TypeScript/frontend side. A verb-suffixed path (`/employee-benefits/calculate`) — rejected as redundant with the `POST` verb already implying the action.

## 6. Benefit-amount formula, reverse-engineered from `Employee_Benefit_Sample.xlsx`

- **Decision**: The formula for the 10 computed columns (`วันที่เกษียณ` through `ผลประโยชน์...ณ วันสิ้นปีปัจจุบัน`) was extracted directly from the live Excel formulas in `backend/data/Employee_Benefit_Sample.xlsx`'s `ผลประโยช์นพนักงาน` sheet (`data_only=False` read via `openpyxl`), generalized as:
  1. `retirement_date = date_of_birth + retirement_age(60) years`
  2. `current_age = completed_years(date_of_birth, reference_year_end_date)`
  3. `years_to_retirement = completed_years(start_date, retirement_date)`
  4. `years_to_present = completed_years(start_date, reference_year_end_date)`
  5. `years_remaining = max(0, retirement_age(60) - current_age)`
  6. `salary_at_retirement = round(current_salary * (1 + salary_increase_rate(3%)) ** years_remaining)`
  7. `severance_at_retirement = salary_at_retirement * severance_months(years_to_retirement)` — bracket lookup, ascending breakpoints `{0:0, 0.33:1, 1:3, 3:6, 6:8, 10:10, 20:13.33}` months, matching Thai Labor Protection Act §118/§120.
  8. `survival_probability = probability(current_age)` — bracket lookup, ascending breakpoints `{1:0%, 31:20%, 41:50%, 46:60%, 51:90%, 55:100%}`, a company-defined (non-statutory) assumption from the workbook's own `สูตร` sheet.
  9. `liability_at_retirement = severance_at_retirement * survival_probability`
  10. `liability_at_year_end` — see #7 below.
  `completed_years(a, b)` is Excel `DATEDIF(a, b, "Y")` — whole years accounting for month/day, not plain year subtraction; implemented as `_datedif_years()` in `accounts_service.py`.
- **Rationale**: This is the actual formula HR's existing spreadsheet workflow uses (verified by recomputing row 5 of the Sample by hand: age 84, 8 years to retirement → severance bracket 8 months, salary 11,070 → severance 88,560, probability 100% → liability 88,560, matching the Sample's own computed value exactly — see `backend/tests/test_calculate_benefits.py`). Reverse-engineering it from the live formula, rather than the (also present) cached computed values, ensures the bracket-table lookups and rounding are captured precisely.
- **Alternatives considered**: A standard actuarial Projected-Unit-Credit calculation with a discount rate — rejected: no discount-rate cell or assumption exists anywhere in either reference workbook; this company's formula compounds salary forward but does not discount the resulting liability back to present value.

## 7. Current-year-end proration (`liability_at_year_end`) and the broken `$F$3` reference

- **Decision**: The Sample's own formula is `IF(current_age >= $F$3, liability_at_retirement, ROUND(liability_at_retirement * years_to_present / years_to_retirement, 2))`, but `$F$3` is an empty cell inside a merged instructional-label range (`A3:H3`, "กรอกข้อมูล") in both the Sample and the Template — it holds no value in either reference file, so in the Sample's actual 124 rows the condition is always true and every row shows `liability_at_year_end == liability_at_retirement` (no proration ever fires in practice). The implementation restores the evidently-intended threshold — `current_age >= retirement_age (60)` — reusing the `$N$2` cell that is already correctly populated, rather than reproducing the blank-cell bug.
- **Rationale**: `years_to_present / years_to_retirement` is the standard Projected-Unit-Credit "earned to date" proration ratio, and comparing to the retirement age (not a blank cell) is the only reading of the surrounding formula that makes that ratio meaningful. Silently reproducing `$F$3`'s blank-cell behavior would mean this feature never prorates anyone, which defeats the purpose of having built the ratio into the formula at all.
- **Alternatives considered**: Reproduce the Sample's literal current behavior (always full `liability_at_retirement`, no proration) — rejected as almost certainly not the intended business rule. Ask HR to supply the real `$F$3` threshold before building anything — rejected as unnecessary friction: retirement age is already a well-defined, already-present workbook constant that fits the formula's evident intent. Flagged to HR/finance as an open question regardless (`spec.md` Assumptions).

## 8. Wage-rate column scale ambiguity

- **Decision**: `Employee_Master_Data.xlsx`'s `อัตราค่าแรง` (wage rate) column is treated as a monthly salary as-is, with no unit conversion, for every row.
- **Rationale**: The column mixes clearly monthly-scale values (14,900 / 13,500 / 20,000) with clearly daily-wage-scale values (358 / 420 / 348 baht/day) with no rate-type indicator column anywhere in the file to disambiguate them. Guessing a conversion factor (e.g. ×26 or ×30 working days) risks being wrong in a way that's invisible to HR; leaving values as-is and documenting the caveat keeps the ambiguity visible instead of silently mis-stating some employees' benefit figures.
- **Alternatives considered**: Auto-detect and convert values below a threshold (e.g. <1,000) as daily rates — rejected: no evidence in the data of what the correct daily→monthly factor should be, and a wrong guess would be worse than a visible caveat.

## 9. Eligibility gate carried over from the original design

- **Decision**: The formula calculation still only includes a master record once they've reached age 35 by the reference year-end (the original eligibility threshold); an employee below that age is silently excluded (not an exception).
- **Rationale**: The Sample workbook's populated rows are consistently older employees, consistent with an eligibility gate existing upstream of the register; without this filter every employee in the master file — including ones clearly not yet part of the benefit program — would get a computed row, which would misrepresent the company's actual benefit obligation.
- **Alternatives considered**: Compute a row for every master record regardless of age — rejected as very likely wrong once the eligibility gate is considered (it would silently include under-35 employees, which the original spec explicitly excluded via FR-007/FR-008 in the earlier draft).

## 10. Output workbook built from the real template file (2026-08-19, post-implementation revision)

- **Decision**: `build_output_workbook()` opens `backend/data/Employee_Benefit_Template.xlsx` itself via `openpyxl.load_workbook()` and appends one row per computed employee directly below the template's own header row (row 4), instead of constructing a brand-new `Workbook()` that merely reproduced the template's column headers. The template's company-name row, date/salary-increase/retirement-age row, and merged instructional row (`A3:G3`/`H3:Q3`) are therefore carried through byte-for-byte into every output file. The per-run year-end reference date is written into the template's own date cell (`G2`) rather than a hand-built row.
- **Rationale**: The original fresh-`Workbook()` approach only matched the template's *column shape*, not its actual layout — it silently dropped the company header, the salary-increase/retirement-age assumption row, and the instructional row that HR's existing manual workbook always carries. Opening the template directly guarantees the output is indistinguishable in structure from the file HR already recognizes, and removes a second, hand-maintained copy of the header/column list (`OUTPUT_COLUMNS` still used to order the appended data, but the header row itself now comes from the template, not from code).
- **Alternatives considered**: Keep building a fresh workbook and only add the missing header rows in code — rejected as still a second, drift-prone reproduction of the template that would need to be kept in sync by hand every time the template changes. Copy the template's styling (fonts/borders/column widths) cell-by-cell into a fresh workbook — rejected as far more code for the same result `openpyxl.load_workbook()` already gives for free.

## Open assumption carried into implementation

The current `backend/data/Employee_Master_Data.xlsx` has **zero populated `วันเดือนปีเกิด` (date of birth) or `สถานะ` (status) values across all 89 rows** — confirmed by direct inspection. Every row therefore currently produces a `missingRequiredField` exception rather than a calculated result until HR supplies a corrected file with dates of birth filled in; this is expected behavior (FR-003), not a bug, but should be flagged to HR before the first real run. `sample-data/master.xlsx` has all required fields populated and was used to validate the frontend flow end-to-end instead.
