# Data Model: Elderly-Employee Tax Deduction Service

In-memory shapes for the duration of one request — no persistence layer (spec.md Assumptions: stateless per-run). Internally, one working `pandas.DataFrame` (one row per roster employee), matching `accounts_service.py`'s convention; the tables below describe that frame's columns and the wire models built from it.

## Rule set (single source of truth — `backend/services/tax_deduction_service.py` module constants)

Per FR-012, every constant below is defined exactly once in `tax_deduction_service.py` and used by both the calculation pipeline and the `summary` object echoed back in every `POST /accounts/tax-deduction` response, so the two can never disagree.

| Constant | Value | Used for |
|---|---|---|
| `AGE_THRESHOLD` | `60` | Elderly-employee eligibility gate: `age > AGE_THRESHOLD` (FR-004(a) — strictly over, never `>=`; no salary condition). |
| `SALARY_CAP` | `15000.0` (THB) | The per-employee-per-month deduction cap (FR-006) for non-disabled selected employees only. No longer an eligibility condition (revised: eligibility is age-only per FR-004(a), or unconditional for disabled employees per FR-004(b)) — see FR-006a for the disabled-employee exception (uncapped). |
| `HEADCOUNT_CAP_PERCENT` | `0.10` | Selection cap: `floor(total_roster_rows * HEADCOUNT_CAP_PERCENT)` (FR-005), applied only to the non-disabled, age-eligible ranked pool. |
| `HEADCOUNT_CAP_ROUNDING` | `"floor"` | Documents the rounding rule FR-012 requires be inspectable; implemented as `math.floor`. |
| `BE_YEAR_OFFSET` | `543` | Buddhist-Era DOB correction (`research.md` #4). |

A disabled employee's eligibility, cap-exemption, and uncapped monthly amount (FR-004(b), FR-006a) are not tunable constants — they are unconditional rules keyed off the roster's `คนพิการ` (disabled-marker) column, not a numeric threshold.

## RosterEmployee (working `DataFrame` — one row per `ข้อมูลพนักงาน` data row)

Read per `research.md` #2: first 8 columns resolved by header name; the 12 month blocks located positionally by scanning for `รวม` occurrences, with the March/December bonus-column exclusion rule applied while building `monthly_net`.

| Column | Type | Notes |
|---|---|---|
| seq | int | `ลำดับ` — original row order; used for output row order and eligible-tie tie-break. |
| id_card_number | str \| None | `เลขบัตรประชาชน`. |
| prefix, first_name, last_name | str | `คำนำหน้า` / `ชื่อ` / `สกุล`. |
| base_wage_rate | float | `อัตราค่าแรง` — read but not itself part of the deduction calculation (informational). |
| date_of_birth_raw | date | `วันเดือนปีเกิด`, as stored (possibly BE-mislabeled). |
| date_of_birth | date | `date_of_birth_raw` corrected via `correct_be_year()` (`research.md` #4). |
| disabled_marker | str \| None | `คนพิการ`, as stored (cleaned text or `None` if blank). |
| monthly_net[1..12] | float \| NaN | One column per calendar month, `NaN` when that month is unpopulated (`research.md` #2/#5). Months 1–2,4–11: read directly from that block's `รวม`. Months 3, 12: computed as `wage + OT.fillna(0)`, ignoring `รวม` and `โบนัส` entirely. |

## EmployeeCalculationResult (working `DataFrame` — derived columns, every roster row)

Computed per `research.md` #10 — for every row, not only age-qualifying ones.

| Column | Type | Notes |
|---|---|---|
| age | int \| None | Years from `date_of_birth` to `reference_date` (whole completed years); `None` if `date_of_birth` couldn't be parsed. |
| average_monthly_net_salary | float \| None | `sum(monthly_net over populated months) / count(populated months)`; `None` if zero populated months or `age` is `None`. Informational/reported only — does not gate `eligible` or drive `rank` (revised; see below). |
| disabled | bool | `disabled_marker is not None` (any non-blank value in `คนพิการ` counts). |
| elderly_eligible (internal, age-only) | bool | `(age is not None) & (age > AGE_THRESHOLD)` — no salary condition (FR-004(a), revised). |
| eligible | bool | `elderly_eligible \| disabled` (FR-004). |
| capped_pool (internal) | bool | `elderly_eligible & ~disabled` — the set that actually competes for the headcount-capped slots (FR-005). |
| potential_deduction[1..12] (internal) | float | For `disabled` rows: `monthly_net[m]` uncapped (`0` if unpopulated). For non-`disabled` rows: `monthly_net[m]` when `<= SALARY_CAP`, else `0` (FR-006/FR-006a) — computed for every row regardless of `selected`, so ranking (below) reflects what the employee would actually receive. |
| rank | int \| None | 1-based rank among `capped_pool` rows only, sorted by `sum(potential_deduction[1..12])` descending, ties broken by ascending `seq` (FR-005, revised — no longer sorted by `average_monthly_net_salary`); `None` for `disabled` and non-eligible rows. |
| selected | bool | `True` for the top `headcount_cap` `capped_pool` rows by `rank`, **or** any `disabled` row (unconditional, FR-006a); `False` otherwise (including all non-eligible rows). |
| monthly_deduction[1..12] | float | `potential_deduction[m]` for a `selected` row; `0` for a non-`selected` row (eligible-but-excluded or not-eligible, FR-007). |
| total_deduction | float | `sum(monthly_deduction[1..12])`. |

## CalculationRun (per-request aggregate, not persisted)

| Field | Type | Notes |
|---|---|---|
| reference_date | date | Caller-supplied or defaulted to today (FR-002). |
| total_headcount | int | Every `RosterEmployee` row (spec.md Assumptions — not filtered). |
| eligible_count | int | `sum(eligible)`. |
| headcount_cap | int | `floor(total_headcount * HEADCOUNT_CAP_PERCENT)`. |
| selected_count | int | `sum(selected)`, `== min(eligible_count, headcount_cap)`. |

## Wire models (`backend/models/tax_deduction.py`) — camelCase via `CamelModel`

One endpoint, one response envelope — `summary` + `employees` + an embedded report, matching `CalculateBonusResponse`/`ReconcilePayrollResponse`'s shape exactly (`research.md` #7).

### `TaxDeductionEmployeeResult` (one row of `employees`)

| Field (wire) | Type | Source column |
|---|---|---|
| seq | int | seq |
| idCardNumber | str \| None | id_card_number |
| prefix, firstName, lastName | str | prefix / first_name / last_name |
| dateOfBirth | date \| None | date_of_birth (corrected) |
| age | int \| None | age |
| averageMonthlySalary | float \| None | average_monthly_net_salary |
| eligible | bool | eligible |
| disabled | bool | disabled |
| rank | int \| None | rank |
| selected | bool | selected |
| monthlyAmounts | list[float] (len 12, Jan→Dec) | monthly_deduction[1..12] |
| totalAmount | float | total_deduction |

### `TaxDeductionSummary`

Carries both the run's headcount/eligibility figures and every rule constant applied (FR-010) — there is no separate rules-lookup model or endpoint.

| Field (wire) | Type | Value source |
|---|---|---|
| referenceDate | date | Resolved from the optional `referenceDate` form field, else today. |
| totalHeadcount | int | `total_headcount` (CalculationRun) |
| eligibleCount | int | `eligible_count` (CalculationRun) |
| headcountCap | int | `headcount_cap` (CalculationRun) |
| selectedCount | int | `selected_count` (CalculationRun) |
| ageThreshold | int | `AGE_THRESHOLD` |
| salaryCapPerMonth | float | `SALARY_CAP` |
| headcountCapPercent | float | `HEADCOUNT_CAP_PERCENT` |
| headcountCapRounding | `"floor"` | `HEADCOUNT_CAP_ROUNDING` |
| beYearOffset | int | `BE_YEAR_OFFSET` |

### `CalculateTaxDeductionResponse` (`POST /accounts/tax-deduction` body)

| Field (wire) | Type |
|---|---|
| summary | TaxDeductionSummary |
| employees | list[TaxDeductionEmployeeResult] — every roster row, sorted by `totalAmount` descending, ties broken by ascending `seq` |
| taxDeductionReport | FileAttachment (`backend/models/common.py`) — the generated report, base64-encoded; each employee is written to their own fixed row (`5 + seq - 1`) regardless of `employees`' order |

## Output sheet write mapping (`ผลประโยช์นพนักงาน`, `research.md` #3 and #6 revised)

Written into the **static `TEMPLATE_PATH` template** (`backend/data/Tax_Reduction_Template.xlsx`), never the uploaded workbook, row 5 + `seq - 1` for each roster row, in original `seq` order (not re-sorted by rank/selection):

| Output column (name-resolved) | Value |
|---|---|
| ลำดับ | seq |
| เลขบัตรประชาชน (if header present) | id_card_number |
| คำนำหน้า / ชื่อ / นามสกุล | prefix / first_name / last_name |
| เงินเดือน | average_monthly_net_salary |
| วันเดือนปีเกิด | date_of_birth (corrected) |
| อายุปัจจุบัน | age |
| ม.ค.–ธ.ค. (12 columns) | monthly_deduction[1..12] |
| รวม | total_deduction |

Rows 1–4 of the template (title block + header) pass through unmodified. The template's active sheet is renamed to `OUTPUT_SHEET_NAME` on load. The uploaded workbook's `ข้อมูลพนักงาน` sheet is used only as calculation input and is never included in the report.

## Validation rules (FR-011)

- `payrollFile` is required on `POST /accounts/tax-deduction`; missing → 422 (FastAPI request validation, `research.md` #9).
- The workbook must contain the `ข้อมูลพนักงาน` roster sheet — missing → 400 `TaxDeductionRequestError`. (Its own calculation/output sheet, if any, is not required, read, or validated — the report comes from the static template instead.)
- `ข้อมูลพนักงาน` row 1 must contain all 8 identity headers and exactly 12 `รวม` occurrences with `โบนัส` immediately preceding the 3rd and 12th — otherwise 400.
- The static `TEMPLATE_PATH` file is a deployment/configuration precondition, not a per-request validation: if it's missing from `backend/data/`, `fill_output_workbook()` raises `TaxDeductionRequestError` naming the expected path (mirroring `accounts_service.py`'s `TEMPLATE_PATH` `FileNotFoundError` handling).
- A roster row with an unparseable `วันเดือนปีเกิด` is not a whole-file rejection — it is reported with `age: null`, `eligible: false`, `selected: false`, computed `averageMonthlySalary` still shown, per FR-007's spirit (not explicitly covered by spec.md, documented here as the deliberate per-row degrade-not-fail choice, consistent with FR-011 reserving 400 for structural/whole-file problems only).
