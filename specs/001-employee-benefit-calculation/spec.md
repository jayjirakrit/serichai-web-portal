# Feature Specification: Employee Benefit Calculation

**Feature Branch**: `001-employee-benefit-calculation`

**Created**: 2026-08-18

**Status**: Implemented

**Input**: User description: "Automate the annual Employee Benefit calculation process, replacing a manual, error-prone spreadsheet workflow." The design was revised mid-implementation (2026-08-19) from a three-file payroll/master/previous-year matching pipeline into a single-file formula calculation computed directly from the employee master data — see "Design history" below.

## Design history

The feature was originally scoped as a three-file matching pipeline (User Stories 1-4 in earlier drafts of this spec: match payroll to master data by ID/name, add newly-eligible employees, flag resignations, carry forward prior-year liability figures verbatim) with the benefit-amount formula itself explicitly out of scope.

That pipeline was fully implemented, then replaced. Once the benefit-amount formula was reverse-engineered from `backend/data/Employee_Benefit_Sample.xlsx` (`research.md` #9-10), it became clear the formula only needs the employee master data — date of birth, start date, wage rate, and status — and none of the fields the payroll/previous-year files existed to supply (a payroll-sourced salary figure, a carried-forward prior liability). Maintaining two calculation paths (multi-file matching *and* formula-driven) would have meant two different sets of numbers for the same employee depending on which path ran. The matching/carry-forward pipeline, its dedicated tests, and the `previousBenefitFile`/`payrollFile` inputs were removed; the formula-driven, master-data-only calculation is now the one implementation, at the original `POST /accounts/employee-benefits` endpoint.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Compute the employee benefit liability from master data (Priority: P1)

HR staff upload the employee master data file. The system computes each eligible employee's projected retirement salary, severance entitlement, survival probability, and estimated benefit liability directly from that one file, flags resigned employees, and produces a final benefit workbook plus a standalone exception report — without needing a separate payroll file or a previous year's benefit file.

**Why this priority**: This is the entire feature. It replaces the manual spreadsheet's formula work (previously copy-pasted and hand-maintained by HR) with a deterministic, auditable calculation from a single input file.

**Independent Test**: Supply an employee master file containing employees above and below the eligibility age, an employee already at/past retirement age, an employee below retirement age with a nonzero years-of-service figure, a resigned employee, and a row missing a required field; confirm the output workbook contains exactly the eligible employees with correctly computed columns, the resigned employee is flagged, the under-eligibility-age employee is absent (not an exception), and the row missing a required field is excluded and reported.

**Acceptance Scenarios**:

1. **Given** an employee master record with a date of birth, start date, and wage rate, **When** the calculation runs, **Then** the output row's retirement date, current age, service-to-retirement years, service-to-date years, remaining years, projected salary at retirement, severance entitlement, survival probability, estimated liability at retirement, and estimated liability at the current year-end all match the values produced by the documented formula and lookup tables (FR-005–FR-011).
2. **Given** an employee who has reached the eligibility age of 35 by the benefit year-end, **When** the calculation runs, **Then** that employee appears in the output; **given** an employee who has not yet reached 35, **When** the calculation runs, **Then** that employee is silently absent from the output (not an exception — not yet being part of the benefit program is a normal state, not a data error) (FR-004).
3. **Given** an employee whose current age is at or beyond the retirement age, **When** the calculation runs, **Then** their estimated liability at the current year-end equals their full estimated liability at retirement (no proration); **given** an employee younger than the retirement age with a nonzero service-to-retirement figure, **When** the calculation runs, **Then** their estimated liability at the current year-end is prorated by service-to-date divided by service-to-retirement (FR-011).
4. **Given** an employee marked resigned (`สถานะ` = `ลาออก`) in the master file, **When** the calculation runs, **Then** their output row is flagged resigned; an active employee's row carries no flag (FR-012).
5. **Given** a master record missing date of birth, start date, or wage rate, **When** the calculation runs, **Then** that employee is excluded from the output and reported as an exception (category `missingRequiredField`), rather than silently computed with a fabricated or zero value (FR-003).
6. **Given** a master file missing a required column entirely, or that is empty or unreadable, **When** the file is submitted, **Then** the request fails with a clear error rather than producing a partial or guessed result.
7. **Given** the calculation produces the final benefit workbook, **When** that workbook is opened, **Then** its company header, date/assumptions row, and instructional row are byte-for-byte the ones from `backend/data/Employee_Benefit_Template.xlsx`, and every computed employee row appears directly below the template's own column-header row (FR-014).

---

### Edge Cases

- What happens when an employee's current age is exactly at the retirement age boundary (60)? → Full liability at retirement, no proration (FR-011).
- What happens when an employee's years-to-retirement is zero (e.g. a data entry places the start date after the computed retirement date)? → Treated as fully vested (full liability), avoiding a division by zero.
- What happens when a benefit-year boundary falls in a leap year, given the organization's Buddhist Era (BE) year convention (BE = Gregorian year + 543)? → BE years are handled numerically throughout, with no Gregorian conversion; see `research.md` #2 (historical) and the `be_dates` module.
- What happens when the master file's wage-rate column mixes monthly-scale and daily-wage-scale values with no rate-type indicator? → Every value is treated as a monthly salary as-is, with no conversion; flagged as a data-quality caveat rather than guessed (`research.md` #11).
- What happens when a resigned employee has not yet reached the eligibility age? → Still excluded (not yet part of the benefit program); resignation status does not itself grant eligibility.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST accept a single employee master data file (`.xlsx`/`.csv`) as the sole input for the benefit calculation.
- **FR-002**: System MUST resolve the master file's columns to prefix, first name, last name, date of birth, start date, wage rate, and status using the existing Thai-header aliases (`COLUMN_ALIASES`), and MUST fail the request with a clear error if the file lacks a required column entirely (rather than a required *value* on some rows — see FR-003).
- **FR-003**: System MUST exclude any individual row missing date of birth, start date, or wage rate from the calculated output and report it as an exception (category `missingRequiredField`), rather than fabricating or zeroing the missing value.
- **FR-004**: System MUST include an employee in the calculated output only once they have reached the eligibility age of 35 by the year-end of the current benefit cycle; an employee who has not yet reached 35 is silently excluded (not an exception).
- **FR-005**: System MUST compute each included employee's retirement date as date of birth plus the retirement age (60 years).
- **FR-006**: System MUST compute current age, service-to-retirement years, service-to-date years, and remaining years as of the current benefit cycle's year-end reference date, using completed-whole-years semantics (Excel `DATEDIF(...,"Y")`-equivalent), per `research.md` #9.
- **FR-007**: System MUST compute the projected salary at retirement as the current wage rate compounded at the configured annual salary-increase rate (3%) over the remaining-service years.
- **FR-008**: System MUST compute the severance entitlement at retirement as the projected retirement salary multiplied by the number of months' pay set out in the company's years-of-service bracket table, consistent with the Thai Labor Protection Act's severance schedule (`research.md` #9).
- **FR-009**: System MUST compute the survival-to-retirement probability by looking up the employee's current age against the company's age-bracket probability table (`research.md` #9).
- **FR-010**: System MUST compute the estimated liability at retirement as the severance entitlement multiplied by the survival probability.
- **FR-011**: System MUST compute the estimated liability at the current year-end as: the full estimated liability at retirement when the employee's current age is at or beyond the retirement age; otherwise, the estimated liability at retirement prorated by service-to-date divided by service-to-retirement (`research.md` #10).
- **FR-012**: System MUST flag an employee's output row as resigned when the master file's status column equals `ลาออก`, and MUST leave an active employee's row unflagged.
- **FR-013**: System MUST leave the columns for which no formula exists in the reference workbook (`ยอดยกมา`, `ต้นทุน`, `คชจ.บริหาร`, `คชจ.ขาย`, `อายุงาน (ปี/เดือน)`, `อายุ (ปี/เดือน)`) blank in the output, rather than guessing a value for them.
- **FR-014**: System MUST produce the final benefit calculation workbook by opening `backend/data/Employee_Benefit_Template.xlsx` itself as the base file — preserving its company header, date/assumptions row, and instructional row exactly — and appending one row per eligible employee directly below the template's existing column-header row, rather than generating a new workbook from scratch that merely matches the template's column shape.
- **FR-015**: System MUST produce a validation/exception report as a separate, standalone document from the final benefit workbook, listing every row excluded under FR-003, so HR can act on it without re-deriving the discrepancy manually.

### Key Entities

- **Employee Master Record**: The sole input record — identity (prefix/first/last name), date of birth, start date, wage rate, and employment status — used for both eligibility and the formula calculation.
- **Benefit Calculation Entry**: A single employee's computed row in the output workbook — identity, wage rate, retirement date, age/service-year figures, projected salary at retirement, severance entitlement, survival probability, estimated liabilities, and resignation flag.
- **Exception Record**: One row per master record excluded from calculation because a required field (date of birth, start date, or wage rate) was missing.
- **Benefit Formula Assumptions**: The workbook-level constants the calculation depends on — the annual salary-increase rate (3%), the retirement age (60), the years-of-service → severance-months bracket table, and the age → survival-probability bracket table (`research.md` #9).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: HR can complete a full annual benefit calculation in under 5 minutes (a single file upload and one synchronous request), down from the current multi-day manual spreadsheet process.
- **SC-002**: 100% of master records missing a required field are surfaced in the exception report — none are silently dropped or computed with a fabricated value.
- **SC-003**: 100% of employees who reached the eligibility age in the current cycle are present in the calculated output without manual addition.
- **SC-004**: 100% of resigned employees identified in the master file are visibly flagged in the output, with zero resigned employees left unflagged.
- **SC-005**: For every employee master record with a populated date of birth, start date, and wage rate, the calculated output matches the value obtained by applying the documented formula and lookup tables by hand, with zero unexplained discrepancies.

## Assumptions

- The eligibility age threshold is 35 and the retirement age is 60, as stated in the current manual process, and are expected to remain constant unless a future policy change specifies otherwise.
- "Resigned" status is authoritatively determined by the employee master file's status column; the feature does not independently infer resignation from other signals.
- The employee master data's wage-rate column (`อัตราค่าแรง`) is treated as a monthly salary as-is for every row, with no conversion, even though some values in the current sample data are daily-wage-scale rather than monthly-scale; correcting that ambiguity in the source data is HR's responsibility, not something this feature infers (`research.md` #11).
- Every employee master record is expected to have a populated date of birth, start date, and wage rate; a record missing any of these is excluded from the calculated output and reported as an exception (FR-003) rather than estimated. As of 2026-08-19, `backend/data/Employee_Master_Data.xlsx` has zero populated dates of birth across all 89 rows — a corrected file is needed before a real run produces any calculated rows (`research.md`'s "Open assumption carried into implementation").
- The proration threshold in the estimated-liability-at-year-end formula (FR-011) is the retirement age (60) — reconstructed from the reference workbook's evidently broken `$F$3` cell reference (`research.md` #10) rather than confirmed directly with HR/finance; flag this and the wage-rate caveat above to HR/finance before relying on the output for a real filing.
- Users of this feature are internal HR staff who already understand the existing benefit calculation workbook's structure and terminology (including its Thai-language column headers and BE year convention); this specification does not require translating or reinterpreting that domain terminology.
- Related annual processes referenced in HR's existing working notes — tracking employees over age 60 for a separate retirement file, the disability-hiring tax deduction quota, and bonus calculation from attendance data — are separate business processes with their own inputs and are out of scope for this feature.
