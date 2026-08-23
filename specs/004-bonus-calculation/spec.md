# Feature Specification: Bonus Calculation

**Feature Branch**: `004-bonus-calculation`

**Created**: 2026-08-23

**Status**: Draft

**Input**: User description: "I want to create new feature bonus calculation with new page bonus calculation with 2 tab: calculation and configuration refer page from https://claude.ai/design/p/6f40c82d-f54f-45a9-9a29-95349e7402ad?file=Web+Portal+Configuration.dc.html and refer business logic from this files Chopaisarn_Bonus_Macro_V3 in sheet สร้างรีพอร์ตโบนัส while input file is ข้อมูลพนักงานปี_68.xlsx and สรุปโบนัส_68.xlsx. Analysis and planning this as solution architect"

## Clarifications

### Session 2026-08-23

- Q: Is the manual, per-employee approved bonus-day entry (the finalization step) filled in by the user within this feature? → A: Yes — the approved day count is filled in by the user in-app; this confirms User Story 2 is in scope.
- Q: How should employees be matched/joined across the data sources, given the source files have no employee ID column today? → A: Match by name for now, since no employee_id column exists yet in the source data; structure the matching so a unique employee identifier can be adopted as the join key later, once one is introduced upstream.
- Q: Is the Configuration tab (editable scoring-rule tables, saved via an API to the backend) in scope for this feature? → A: No — that capability is future scope. v1 ships calculation and finalization only, using fixed scoring-rule values; editable, API-backed rule configuration is a separate future feature.

### Session 2026-08-23 (2)

- Q: Where does the approved-day-count entry and final-bonus calculation actually happen — inside the web application, or in the downloaded file? → A: In the downloaded file. The user fills in the approved day count directly in the downloaded bonus report, which calculates the final bonus for that employee automatically from the entry — the same sign-off mechanism the existing process already uses. This removes the need for a separate in-app "enter and see it recalculate on screen" step (previously User Story 2); running the calculation and producing the downloadable report happen together, in one action.
- Q: How should the calculation be verified for correctness? → A: By comparing computed results against a known-correct historical run — the same reference data and figures already used to validate the calculation logic during specification — rather than requiring a new independent ground truth to be built.

### Session 2026-08-23 (3)

- Q: Should the on-screen/API results include every employee's full computed record, or only a summary plus flagged exceptions? → A: Summary plus flagged exceptions only (name and exception reason) — mirroring the existing payroll-reconciliation feature's pattern, where only discrepancies are individually listed on screen and the full per-employee record lives in the downloadable report. Full per-employee detail (all scores and provisional bonus, for every employee whether flagged or not) is available only in the downloadable report from User Story 2. This keeps the on-screen experience focused on what needs review rather than duplicating the report's own full detail in a second place.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Calculate Bonus Scores for All Employees (Priority: P1)

An HR/compensation staff member uploads the current year's employee data (evaluation results, working days and overtime, and leave records) together with last year's bonus summary, then runs the bonus calculation. The system scores every employee on evaluation grade, attendance, overtime, and leave usage, combines these into a total score, and immediately shows a results summary — how many employees were fully calculated and how many need review — with each employee needing review individually listed by name and reason. Full per-employee scores and provisional bonus amounts are available in the downloadable report (User Story 2).

**Why this priority**: This is the core value of the feature — replacing a manual, macro-driven spreadsheet process with an on-demand calculation the user can run and review immediately. Without this, there is no feature.

**Independent Test**: Can be fully tested by uploading a known current-year data file and a known previous-year bonus summary, running the calculation, and confirming — via the downloaded report — that every employee receives a computed grade, component scores, total score, and provisional bonus matching hand-verified expected values, while the on-screen summary reflects the correct total/exception counts.

**Acceptance Scenarios**:

1. **Given** valid current-year employee data and a valid previous-year bonus summary, **When** the user uploads both and runs the calculation, **Then** the system displays a summary showing total employees processed, number successfully calculated, and number flagged as exceptions, with each flagged employee individually listed by name and exception reason (Clarifications, 2026-08-23 (3)).
2. **Given** an employee whose overtime is scored under a different set of rules because of their department (e.g. a dyeing/color-department or sewing-department role instead of the general rule), **When** the calculation runs, **Then** that employee's overtime score is computed using the rule set for their department, not the general one.
3. **Given** an employee's combined score deductions outweigh their evaluation grade, **When** the calculation runs, **Then** the system still calculates the resulting negative total score correctly (verifiable in the downloaded report) rather than rejecting or clamping it, while treating it as zero bonus days when converting the score into a bonus amount.
4. **Given** no file has been selected for either required input, **When** the user attempts to run the calculation, **Then** the system blocks the run and prompts the user to upload both files first.

---

### User Story 2 - Download and Finalize the Bonus Report (Priority: P2)

Once a calculation run completes, an HR/compensation staff member downloads the full bonus report — every employee, their scores, provisional bonus, and previous-year comparison — in the same action that ran the calculation. The report includes a blank field per employee for the approved bonus-day count (the number of days' pay the company will actually pay out, subject to management judgment beyond the raw score). As soon as the staff member fills that field in, directly in the downloaded file, the final bonus amount for that employee calculates automatically from it — the same sign-off step the existing process already uses.

**Why this priority**: The computed score only produces a *provisional* bonus suggestion; converting it into an actual, payable bonus figure has always required a human sign-off step, and the downloaded report is the artifact HR actually fills in and hands to finance/management for payout — a separate in-app entry step would just duplicate work already done in the file.

**Independent Test**: Can be fully tested by completing a calculation run, downloading the report, filling in an approved day count for one employee directly in the downloaded file, and confirming that employee's final bonus amount calculates correctly from the entry while every other employee's figures remain unaffected.

**Acceptance Scenarios**:

1. **Given** a completed calculation run, **When** the user downloads the bonus report, **Then** it contains every employee processed, their component scores, total score, provisional bonus, previous-year comparison, a blank approved-day-count field, and any exception notes.
2. **Given** the downloaded report, **When** the user fills in an approved day count for an employee, **Then** that employee's final bonus amount calculates automatically from the entered value and their provisional bonus, with no further action needed in the web application.
3. **Given** a calculation run with employees flagged as exceptions (see User Story 3), **When** the user downloads the report, **Then** those employees and their exception reasons are included and clearly identifiable rather than silently omitted.

---

### User Story 3 - Trust Results When Employee Data Doesn't Fully Match (Priority: P2)

A user reviewing results can tell when an employee could not be matched across the required data sources (for example, present in the working-days data but missing from the evaluation data, or not found in the previous year's bonus summary), see why, and know that the rest of the run still completed successfully for everyone else.

**Why this priority**: The source data is joined by employee name across several independent sheets, which is inherently prone to mismatches (naming inconsistencies, new hires, leavers). Silently dropping or silently zeroing these employees would make the results untrustworthy, so this is essential to the feature being usable — but it is a data-quality safeguard layered on top of the core calculation (P1) rather than a separately valuable flow on its own.

**Independent Test**: Can be fully tested by uploading a current-year data file containing at least one employee missing from the evaluation sheet, one missing from the leave sheet, and one not present in the previous-year bonus summary, then confirming each is flagged individually with the correct reason while all other employees calculate normally.

**Acceptance Scenarios**:

1. **Given** an employee present in the working-days data but missing from the evaluation data, **When** the calculation runs, **Then** that employee is flagged with a clear reason and the run still completes for all other employees.
2. **Given** an employee not found in the previous year's bonus summary, **When** the calculation runs, **Then** that employee's current-year results are still calculated normally, with the previous-year comparison shown as not available rather than blocking or erroring the run.
3. **Given** every employee matches successfully across all data sources, **When** the calculation runs, **Then** the summary clearly presents this as a fully successful run with zero exceptions, not an error or empty state.

---

### Edge Cases

- What happens when an uploaded file is missing a required data section (evaluation, working-days/overtime, or leave) for the selected year? System must show a clear, specific error naming what's missing rather than a raw failure or partial/incorrect results.
- What happens when an employee's department/work category doesn't match any recognized overtime rule set? That employee must be flagged as an exception needing review rather than silently using the wrong rule or being skipped.
- What happens when two employees in the source data appear to have the same name? The system must not silently merge or misattribute their records; this must surface as a reviewable exception.
- What happens when an employee's evaluation data has no scored criteria at all (all blank)? That employee must be flagged as an exception rather than producing a misleading zero or default grade.
- What happens if a user fills in an approved day count for an employee who was flagged as an exception (e.g. missing evaluation data, so no total score or provisional bonus was ever calculated)? The report must make clear that a final bonus cannot be calculated for that employee rather than producing a misleading or incorrect figure.
- What happens with a full year's company headcount worth of data (on the order of a few hundred employees)? The run must still complete and produce usable, reviewable results without the page freezing or timing out.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow a user to upload a current-year employee data file containing evaluation results, working-day/overtime records, and leave records for a selected year.
- **FR-002**: System MUST allow a user to upload a previous-year bonus summary file to provide prior-year grade and bonus figures for comparison.
- **FR-003**: System MUST validate that an uploaded file contains the data sections required for the selected year and reject the run with a specific, understandable error when a required section is missing, rather than failing silently or with a raw system error.
- **FR-004**: System MUST match each employee's records across the evaluation, leave, working-day, and previous-year data sources by name, since no unique employee identifier exists in the source data today, and flag any employee it cannot confidently match in one or more sources as an exception, with the reason, rather than silently omitting them or failing the entire run. The matching approach MUST be structured so a unique employee identifier can be adopted as the join key later, once one becomes available in the source data, without a redesign.
- **FR-005**: System MUST compute, for each successfully matched employee: an evaluation grade derived from their averaged evaluation scores, a working-days score, an overtime score, and leave-based deduction scores for sick leave, personal/special leave, absence, and vacation leave.
- **FR-006**: System MUST determine which overtime scoring rules apply to an employee based on their department/work category (general, dyeing/color, sewing, or other configured categories).
- **FR-007**: System MUST calculate each employee's total score as the sum of their evaluation grade and all component scores, preserving a negative result rather than clamping it at zero.
- **FR-008**: System MUST calculate each employee's provisional bonus (in days and in amount) from their total score and pay rate, treating a non-positive total score as zero provisional bonus days.
- **FR-009**: System MUST display, immediately after a run, each employee flagged as an exception individually — by name and reason — as part of the on-screen results, not only as an aggregate count (Clarifications, 2026-08-23 (3)); each employee's previous year's grade and bonus amount, when available, is included in the downloadable report (see FR-011).
- **FR-010**: System MUST present a results/validation summary immediately after a calculation run, showing at minimum: total employees processed, number successfully calculated, and number flagged as exceptions.
- **FR-011**: System MUST produce a downloadable full bonus report in the same action as running the calculation — no separate download step — including per-employee grade, component scores, total score, provisional bonus, previous-year comparison, and exception notes.
- **FR-012**: System MUST include, in the downloadable report, an editable field per employee for the approved bonus-day count, left blank until filled in, and a final bonus amount for that employee that calculates automatically from the entered value and their provisional bonus once filled in — without requiring the user to return to the web application.
- **FR-013**: System MUST leave the final bonus calculation blank, rather than producing a misleading or incorrect figure, for any employee whose provisional bonus could not be calculated (i.e. who was flagged as a blocking exception).
- **FR-014**: System MUST require both the current-year employee data file and the previous-year bonus summary file to be selected before a calculation run can be submitted.
- **FR-015**: System MUST communicate run state (awaiting input, processing, complete, failed) to the user throughout a calculation run.
- **FR-016**: System MUST calculate every score component (evaluation grade, working-days score, overtime score, leave deduction scores) using a fixed set of scoring-rule values mirrored from the legacy macro's tables, applied consistently across all employees and calculation runs.

### Key Entities

- **Employee Bonus Record**: One employee's full picture for the run — identity (currently name; structured to support a unique employee identifier once one becomes available), department/OT category, pay rate, working days, overtime, leave days by category, evaluation grade, computed component scores, total score, provisional bonus, previous-year comparison, and any exception note. The approved day count and resulting final bonus are captured only in the downloaded report, not as part of the on-screen/returned results. Likewise, full per-employee scores and provisional bonus are available only in the downloaded report — the on-screen/API results surface only the aggregate summary and, for employees flagged as exceptions, their name and exception reason (Clarifications, 2026-08-23 (3)).
- **Evaluation Data**: Per-employee evaluation scores across multiple criteria/evaluators, averaged into the grade used in scoring.
- **Leave Data**: Per-employee accumulated leave days for the year, broken out by category (sick, personal, special-personal, absence, vacation).
- **Working Day/Overtime Data**: Per-employee working days, overtime totals, department/OT category, and pay rate for the year.
- **Previous Year Bonus Summary**: Prior year's grade and bonus amount per employee, used purely for on-screen/report comparison.
- **Scoring Rule**: A named set of thresholds or values (e.g. an overtime table for one department, or a leave-deduction setting) that determines how a score component is calculated, mirrored from the legacy macro's tables. Comes in two shapes: a tiered threshold-range table, or a flat list of named values. Fixed for this feature (not user-editable); editable, API-backed rule management is a future feature.
- **Bonus Calculation Run**: One execution tying together the uploaded data, the fixed rule values in effect at run time, the computed per-employee results, the summary counts, and the downloadable report produced from that same run.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can go from uploading both required files to seeing a results summary and any flagged exceptions in under 3 minutes, for a typical yearly headcount of up to a few hundred employees.
- **SC-002**: 100% of employees present in the uploaded data are either fully calculated or clearly flagged as an exception with a reason — none are silently dropped from the results.
- **SC-003**: Computed grades, scores, and provisional bonus amounts match the results the existing manual process produced for the same historical year's data, verified figure-for-figure against that known-correct run.
- **SC-004**: A user can fill in an approved day count for an employee in the downloaded report and get the correct final bonus amount without returning to the web application or affecting any other employee's figures.
- **SC-005**: Bonus calculation turnaround moves from "manually run a spreadsheet macro and interpret its output" to "upload, review, and download a ready-to-finalize report within the same working session."

## Assumptions

- The four leave categories (sick, personal/special, absence, vacation), the working-days score, and the overtime rule sets (general and the department-specific variants) are the complete set of score components for v1; adding a new score component beyond these is a business-rule change.
- Configuration/rule-editing — an editable Configuration tab that lets a user change scoring-rule values, saved via an API to the backend — is out of scope for this feature. v1 uses fixed scoring-rule values mirrored from the legacy macro's tables; building editable, API-backed rule management is a separate future feature.
- No unique employee identifier (e.g. an employee ID) currently exists in the source data files; employee matching for v1 uses name only, structured so a unique identifier can become the join key later without a redesign, once one is introduced upstream.
- Results and reports are on-screen plus downloadable only, with no email notification step, consistent with the pattern already used elsewhere in the portal.
- The downloaded report is a spreadsheet capable of calculating the final bonus itself once the approved day count is filled in (as the existing process's own output file already does); this is what lets finalization happen without a return trip to the web application.
- Correctness of the calculation is verified against the same known-correct historical data already used to derive the scoring rules during specification, rather than a newly built independent reference.
- Access to calculation and finalization follows the same access model as the rest of the portal (no additional role-based restriction), consistent with the app's current lack of an RBAC system.
- Typical file volume is consistent with the company's current yearly headcount (on the order of a few hundred employees).
