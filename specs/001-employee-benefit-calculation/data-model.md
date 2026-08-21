# Data Model: Employee Benefit Calculation

All entities below are in-memory (pandas/dict) shapes for the duration of one request — there is no persistence layer for this feature. Thai column headers and BE-year date convention are preserved throughout (see `CLAUDE.md`).

## EmployeeMasterRecord (from the master file — the sole input)

Maps 1:1 to the `ข้อมูลพนักงาน` sheet shape: `ลำดับ, คำนำหน้า, ชื่อ, สกุล, อัตราค่าแรง, วันเดือนปีเกิด, เริ่มทำงาน, สถานะ`. Supplies identity, date of birth (age/eligibility), start date (service years), wage rate (salary), and status (resignation).

| Field | Type | Notes |
|---|---|---|
| prefix, first_name, last_name | str | From `คำนำหน้า` / `ชื่อ` / `สกุล`. |
| date_of_birth | date (BE-numbered year) | From `วันเดือนปีเกิด`. Required — a row missing this is excluded (FR-003). |
| start_date | date (BE-numbered year) | From `เริ่มทำงาน`. Required. |
| current_salary | number | From `อัตราค่าแรง`, used as-is with no unit conversion (research.md #11). Required. |
| status_raw | str \| None | Raw `สถานะ` cell value; `is_resigned = (status_raw == "ลาออก")`. |

## BenefitCalculationEntry (output row — the final workbook)

Produced per master record that (a) has all three required fields populated and (b) has reached the eligibility age (35) by the current cycle's year-end. Appended directly into `Employee_Benefit_Template.xlsx`'s `ผลประโยช์นพนักงาน` sheet, below its own existing column-header row (`OUTPUT_COLUMNS`) — the template is the output file's base, not just a column-shape reference (FR-014).

| Field | Source / formula (`research.md` #9-10) |
|---|---|
| ลำดับ, คำนำหน้า, ชื่อ, นามสกุล, วันเดือนปีเกิด, วันที่เริ่มทำงาน | Direct from the master row (`สกุล` → `นามสกุล`; `ลำดับ` re-numbered sequentially in the output). |
| เงินเดือน ณ สิ้นปีปัจจุบัน | Direct from `อัตราค่าแรง`, no unit conversion. |
| วันที่เกษียณ (อายุครบ 60) | `date_of_birth + 60 years`. |
| อายุปัจจุบัน | `completed_years(date_of_birth, reference_year_end_date)`. |
| อายุงานถึงปีเกษียณ | `completed_years(start_date, retirement_date)`. |
| อายุงานถึงปีปัจจุบัน | `completed_years(start_date, reference_year_end_date)`. |
| อายุงานคงเหลือ | `max(0, retirement_age(60) - current_age)`. |
| เงินเดือน ณ วันเกษียณ | `round(current_salary * (1.03) ** years_remaining)`. |
| ผลประโยชน์ของพนักงานที่ต้องจ่าย ณ วันเกษียณ | `salary_at_retirement * severance_months(years_to_retirement)` (bracket table). |
| ความน่าจะเป็นในการอยู่จนถึงวันเกษียณ | `probability(current_age)` (bracket table). |
| ประมาณการหนี้สินผลประโยชน์พนักงานที่คาดว่าจะต้องจ่าย ณ วันเกษียณ | `severance_at_retirement * survival_probability`. |
| ผลประโยชน์ของพนักงานที่คาดว่าต้องจ่าย ณ วันสิ้นปีปัจจุบัน | Full liability if `current_age >= 60`, else `round(liability_at_retirement * years_to_present / years_to_retirement, 2)`. |
| ลาออก | `status_raw == "ลาออก"`. |
| ยอดยกมา, ต้นทุน, คชจ.บริหาร, คชจ.ขาย, อายุงาน (ปี/เดือน), อายุ (ปี/เดือน) | Left blank — no formula exists for these anywhere in the reference workbook (FR-013). |

**Eligibility gate**: a master record whose `current_age < 35` at the reference year-end is silently excluded from the output (not an exception — it's a normal, expected state, not a data error).

## ExceptionRecord (one row per record excluded from calculation)

API-facing entity: field names below are the camelCase wire format (`contracts/benefits-api.md`); the backend's internal Python attributes stay `snake_case` and are bridged via a Pydantic alias generator.

| Field (wire) | Type | Notes |
|---|---|---|
| category | `"missingRequiredField"` | The only category — a row missing date of birth, start date, or wage rate. |
| employeeId | str \| None | Always `None` (the master file has no populated employee ID column). |
| employeeName | str \| None | When known. |
| detail | str | Human-readable reason. |

## BenefitFormulaAssumptions (workbook-level constants)

| Constant | Value | Source |
|---|---|---|
| `SALARY_INCREASE_RATE` | 0.03 (3%/yr) | `Employee_Benefit_Sample.xlsx` cell `K2` ("Salary increase"). |
| `RETIREMENT_AGE` | 60 | Matches cell `N2` ("อายุเกษียณ"); also the FR-011 proration threshold. |
| `ELIGIBILITY_AGE` | 35 | Carried over from the feature's original eligibility-gate requirement. |
| `SEVERANCE_MONTHS_TABLE` | Ascending `(min_years_of_service → months_of_pay)` brackets: `{0:0, 0.33:1, 1:3, 3:6, 6:8, 10:10, 20:13.33}` | `สูตร` sheet, rows 4-10 (Thai Labor Protection Act §118/§120). |
| `SURVIVAL_PROBABILITY_TABLE` | Ascending `(min_age → probability)` brackets: `{1:0%, 31:20%, 41:50%, 46:60%, 51:90%, 55:100%}` | `สูตร` sheet, rows 14-19 (company-defined, non-statutory). |

Both tables are approximate-match ("largest breakpoint ≤ lookup value") lookups, matching Excel's `VLOOKUP(..., TRUE)` semantics — an exact match on a breakpoint resolves to that breakpoint's own row.

## Validation rules (from Functional Requirements)

- A master file missing a required column entirely (prefix, first name, last name, date of birth, start date, or wage rate) → the request fails (4xx), rather than guessing column meaning (FR-002).
- A row missing date of birth, start date, or wage rate → excluded from calculation and reported as a `missingRequiredField` exception (FR-003).
- A row whose current age has not reached 35 by the reference year-end → excluded from the output, no exception (FR-004).
