# Feature Specification: Elderly-Employee Tax Deduction Service

**Feature Branch**: `006-elderly-tax-deduction`

**Created**: 2026-09-18

**Status**: Draft

**Input**: User description: "Build an Elderly-Employee Tax Deduction Service: calculate Thailand's Royal Decree No. 639 (B.E. 2560) corporate tax deduction for wages paid to employees aged over 60, given a payroll workbook. The service must identify eligible employees (age > 60 and average monthly net salary <= 15,000 THB as of a reference date), rank eligible employees by salary and enforce a 10% of total headcount cap, compute per-month deductible amounts (capped at 15,000, bonus excluded) for selected employees, and return results as a filled workbook or as JSON. Must handle a Buddhist-era DOB quirk, reject malformed uploads with 422, keep business-rule constants named and inspectable via a rules endpoint, and expose calculate / calculate-json / rules / health endpoints. Frontend needed to drive the upload and show results."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - HR calculates the elderly-employee deduction from the existing spreadsheet (Priority: P1)

An HR/payroll staff member has the year's payroll roster in the existing Excel template. They upload it to the tool and receive back a completed tax-deduction report — a workbook based on the company's standard reporting template, with the calculation sheet filled in — ready to use for the corporate tax filing, replacing the manual, error-prone spreadsheet process.

**Why this priority**: This is the core value of the feature — HR's actual pain today is doing this calculation by hand in a spreadsheet, once a year, and getting it right. Everything else supports this.

**Independent Test**: Upload a payroll workbook matching the template with a mix of eligible and ineligible employees; download the returned report and confirm the calculation sheet is filled in correctly and the report's title/header rows are intact.

**Acceptance Scenarios**:

1. **Given** a payroll workbook with employees of varying ages and salaries, **When** the user uploads it and requests the calculation, **Then** they receive back a report workbook whose output sheet lists every employee with their computed age, average salary, and 12 monthly deduction amounts, with the report's own title/header rows intact.
2. **Given** a roster where more employees pass the age-eligibility test than the 10% headcount cap allows, **When** the calculation runs, **Then** only the employees with the highest actual deductible totals up to the cap show non-zero monthly amounts, while the rest show as eligible but excluded (all months zero); disabled employees always show non-zero monthly amounts regardless of the cap.
3. **Given** an uploaded file that does not match the expected template (e.g., missing the roster sheet or missing a month's columns), **When** the user uploads it, **Then** the tool clearly tells them the file doesn't match the expected format, without producing a miscalculated result.

---

### User Story 2 - HR reviews the calculation on-screen before exporting (Priority: P2)

Before trusting the numbers enough to attach them to a tax filing, HR wants to see the calculation broken down on screen — who was included, who was excluded and why, and the monthly figures per person — without having to open the downloaded spreadsheet in Excel first.

**Why this priority**: Builds trust in the automated calculation and supports an audit conversation ("why wasn't this person included?") without needing Excel. It's valuable but secondary to actually producing the compliant workbook.

**Independent Test**: Upload the same payroll workbook and view the results as an on-screen table/summary (via the JSON-backed view) showing each employee's eligibility, selection, and monthly amounts, independent of downloading the file.

**Acceptance Scenarios**:

1. **Given** a successfully uploaded payroll workbook, **When** the user requests the on-screen results, **Then** they see, per employee, age, average salary, eligibility, whether they were selected under the cap, and the 12 monthly amounts plus total, without needing to download anything.
2. **Given** an employee who is eligible by age but excluded by the 10% cap, **When** the user views that employee's row, **Then** it is visibly distinguishable from a selected employee (e.g., marked "eligible, not selected" with zeroed months) so the exclusion is self-explanatory.

---

### User Story 3 - A rule owner confirms which constants were used for a given run (Priority: P3)

Whoever owns the tax filing occasionally wants to confirm exactly what thresholds a given calculation run used (the 15,000 baht cap, the 10% headcount limit, the age threshold, the reference date) — for example, before signing off on a filing, or when the rules are eventually revised.

**Why this priority**: Supports auditability and trust in the tool but is not needed for a single successful calculation to happen — it's a supporting/verification capability.

**Independent Test**: Run a calculation and confirm the constants it reports having applied (deduction cap, headcount percentage, age threshold, reference date) are shown alongside that run's results, without having to infer them from the numbers.

**Acceptance Scenarios**:

1. **Given** a completed calculation run, **When** the user reviews its results, **Then** they see, alongside the per-employee figures, the deduction cap per month, the headcount cap percentage, the minimum age threshold, and the reference date that run actually used, in one place.

---

### Edge Cases

- Total headcount is small enough that 10% of it rounds down to zero — no one qualifies for the deduction even if some employees pass the age/salary test individually. The tool must show these employees as eligible but not selected, rather than erroring.
- An employee's stored date of birth uses Buddhist-era year digits inside what looks like a normal date (e.g., a birth year of 2483 instead of the real 1940). The tool must recognize and correct this before computing age, rather than treating the person as unrealistically old or young.
- A selected employee has one month where wage + overtime exceeds the monthly cap (e.g., an overtime spike) — that single month must read as zero while the employee's other months and overall selection are unaffected.
- Two eligible employees have exactly the same average salary — the tool must break the tie the same way every time (not depend on incidental file/row order) so results are reproducible.
- An employee has fewer than 12 months of data populated (e.g., a new hire partway through the year) — the tool must have a defined, documented way of averaging over only the months that exist, rather than silently treating missing months as zero pay (which would understate their average salary) or erroring out.
- The uploaded file is missing a required sheet, is missing one or more expected month columns, or otherwise doesn't match the known template — the tool must reject it with a clear explanation rather than guessing at column positions and producing a wrong answer.
- An employee is over 60 by age but their average monthly net salary exceeds 15,000 THB (e.g., due to heavy overtime in some months) — they remain eligible on age alone; any individual month whose own wage+overtime is at or below 15,000 is still deducted, only the over-cap months read zero.
- A disabled employee (marked in the roster's disabled-employee column) is eligible for the deduction unconditionally, regardless of age or salary, per Royal Decree No. 499 (B.E. 2559) — a young, high-earning disabled employee is still eligible and selected. Their selection does not consume any of the 10% headcount cap reserved for elderly-employee selection, and their monthly deductible amount is their full wage+overtime with no 15,000-per-month cap.
- When ranking eligible (non-disabled) employees for the limited headcount-capped slots, an employee whose average salary is high but who is over the monthly cap every month (and so would receive ฿0 regardless of selection) must not outrank and displace an employee who would actually receive a nonzero deduction — ranking is by each employee's actual potential deductible total, not their raw average salary.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The tool MUST accept an uploaded payroll workbook matching the known template (roster sheet with per-employee identity, base wage, date of birth, a disabled-employee marker, and 12 months of base wage/overtime/bonus-where-applicable figures).
- **FR-002**: The tool MUST determine each employee's age as of a reference date (defaulting to the current date, and configurable to another date such as year-end of a specific tax year) and correct any date of birth whose stored year is implausibly high (Buddhist-era digits) before computing age.
- **FR-003**: The tool MUST determine each employee's average monthly net salary (base wage + overtime, excluding bonus payments) as of the reference date, averaged only over the months for which that employee has data. This figure is informational/reported only (FR-010) — it no longer gates eligibility or drives ranking (see FR-004, FR-005).
- **FR-004**: The tool MUST mark an employee eligible for the deduction when either: (a) age (as of the reference date) is over 60 — with no salary condition on eligibility itself, a high average salary does not disqualify an otherwise age-eligible employee, it only affects which individual months are deductible (FR-006); or (b) the employee is marked as a disabled employee in the roster — eligible unconditionally, with no age or salary test at all (Royal Decree No. 499, B.E. 2559). These are referred to as FR-004(a) and FR-004(b) below.
- **FR-005**: Among eligible, non-disabled employees, the tool MUST rank them by each employee's actual potential deductible total for the year (the sum of what FR-006 would deduct for them across all 12 months if selected) — highest first, breaking exact ties by the employee's original sequence number — and select only the top-ranked employees up to a limit of 10% of the total employee headcount (rounded down); employees beyond that limit remain visible in the results but are marked as not selected. Disabled employees are excluded from this ranked pool entirely and do not consume any of the 10% headcount cap — see FR-004(b) and FR-006a.
- **FR-006**: For each selected, non-disabled employee and each month, the tool MUST report that month's deductible amount as (that month's base wage + overtime) when it is at or below the deduction cap per employee per month, and as zero when it exceeds that cap — a single over-cap month never reduces the amount to the cap value, it zeroes that month only, without affecting other months or the employee's selected status.
- **FR-006a**: A disabled employee MUST always be selected (never excluded by the headcount cap), and their monthly deductible amount for every month MUST be their full base wage + overtime for that month, with no 15,000-per-month cap applied.
- **FR-007**: For employees who are eligible but not selected (excluded by the headcount limit) or not eligible at all, the tool MUST report all 12 monthly amounts as zero, while still showing their computed age and average salary so the exclusion is auditable.
- **FR-008**: Every calculation run MUST produce a completed calculation report — a workbook based on the company's standard tax-deduction reporting template, with its data rows filled in for every employee and its own title/header rows intact — available to the user as part of that run's result. This report is a generated document, not a copy of the file the user uploaded.
- **FR-009**: Every calculation run MUST also produce the same calculation as structured, on-screen-consumable data in that same result (without requiring the user to open the workbook first), including per-employee age, average salary, eligibility, rank, selected status, the 12 monthly amounts, and the yearly total.
- **FR-010**: Every calculation result the tool returns MUST include the values of every business rule actually applied to that run (per-employee monthly deduction cap, headcount cap percentage, minimum age threshold, and the reference date used), so a user never has to infer them from the output figures.
- **FR-011**: The tool MUST reject an uploaded file that does not match the expected roster layout (e.g., missing the roster sheet, or missing one or more expected month columns) with a clear, specific explanation of what didn't match, and MUST NOT produce a calculated result from such a file.
- **FR-012**: Every business-rule constant used in the calculation (the per-employee monthly cap, the headcount percentage limit, the minimum age threshold, the Buddhist-era year correction offset, and the rounding rule applied to the headcount cap) MUST be defined in exactly one place so that a future change to any one of them cannot cause the calculation and the values reported alongside its result to disagree.
- **FR-013**: The tool MUST let a user upload a payroll workbook and, in one action, both view the results on screen and obtain the generated report, all from within the web portal, without needing a separate API tool or a second request.
- **FR-014**: On-screen results MUST visibly distinguish three employee states: not eligible, eligible but not selected (excluded by the headcount cap), and selected (with computed monthly amounts).

### Key Entities

- **Employee record**: One row of the payroll roster — sequence number, ID card number, name, base wage rate, date of birth, whether marked as a disabled employee, and, for each of the 12 months, base wage paid, overtime paid, and (for the two bonus months) bonus paid. Represents the raw input for one person.
- **Calculation result (per employee)**: The computed outcome for one employee for a given run — age at the reference date, average monthly net salary (informational), disabled flag, eligibility flag, rank among the ranked (non-disabled, eligible) pool, selected flag, the 12 monthly deductible amounts, and their total. Represents one row of the output.
- **Calculation run**: One invocation of the calculation over an uploaded workbook — encompasses the reference date used, the full set of per-employee results, and the total headcount and cap figures used to determine selection. Not persisted beyond the request/response.
- **Rule set**: The named business constants in effect for a run — per-employee monthly deduction cap, headcount percentage limit, minimum age threshold, and reference date — reported alongside every calculation run's results.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: HR can go from an unmodified payroll workbook to a completed, ready-to-file calculation workbook in under one minute of hands-on time (upload, wait, download), with zero manual formula editing.
- **SC-002**: A roster of at least 150 employees, with a mix of eligible, cap-excluded, and ineligible employees, produces a calculation that matches an independently verified hand calculation exactly (per-employee monthly amounts and totals), with zero discrepancies.
- **SC-003**: 100% of uploaded files that don't match the expected template are rejected with an explanation the uploader can act on (e.g., "expected sheet X not found"), and produce no downloadable or displayed result.
- **SC-004**: The rules reported with a run's results (deduction cap, headcount percentage, age threshold, reference date) match, in 100% of runs, the values actually applied to that run's calculation — verified by cross-checking the reported values against the computed output within the same result.
- **SC-005**: Reviewing why any single employee was or wasn't selected (eligibility, rank, cap outcome) takes under 30 seconds using the on-screen results, without opening the downloaded workbook.

## Assumptions

- The reference date defaults to "today" but is expected in practice to usually be set to 31 December of the relevant tax year; no automatic detection of "the tax year" from the file is required — the caller supplies it when it should differ from today.
- Age is evaluated once, at the reference date, for the whole year's calculation — an employee who turns 61 partway through the year is treated as either eligible or not for the entire year based on their age at that single reference date; this is a known, accepted simplification, not a defect.
- "Total headcount" for the 10% cap means every employee row present in the uploaded roster for that run (not merely the eligible subset, and not filtered by the out-of-scope criteria below).
- Verifying Thai-national status, Department-of-Employment registration, shareholder/director exclusion, and "only the first employer may claim this employee" are out of scope — the source data has no columns for these, and this service does not enforce them.
- Authentication/authorization, multi-tenant company support, and persistence of past calculation runs are out of scope; each run is a stateless request against an uploaded file.
- An employee with fewer than 12 months of populated data (e.g., a new hire) has their average monthly net salary computed over only the months that contain data for them, not divided by 12; this is treated as a documented, deliberate choice rather than an open question. This average is reported for context but, per FR-003/FR-004, no longer determines eligibility or ranking.
- Verifying "registered disabled person" status against a Department-of-Employment or similar registry is out of scope — the tool trusts the roster's disabled-employee marker column as-is, the same way it trusts every other input column.
- The uploaded workbook's roster sheet name, header row, and column layout are expected to exactly match the existing HR spreadsheet template already in use (data starting at row 2); this feature does not need to support arbitrary or varying roster layouts. The uploaded file's own calculation/output sheet, if it has one, is not read or relied upon — the report is generated from a company-controlled reporting template, not the upload.
- The web portal's existing file-upload and results-display patterns (as already used for the benefits/bonus calculation features) are the expected interaction model — this feature is not introducing a new interaction paradigm to the portal.
