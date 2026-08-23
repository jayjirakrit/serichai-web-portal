# Feature Specification: Payroll Reconciliation

**Feature Branch**: `003-payroll-reconcile`

**Created**: 2026-08-21

**Status**: Draft

**Input**: User description: "I want to analysis and planning new feature to run payroll reconcile with similar function from this java batch as API to proceed using interface similar to c:\Users\Lenovo\Desktop\Serichai\source_code\serichai-web-portal\frontend\src\pages\EmployeeBenefits.tsx reference existing payroll reconcile: C:\Users\Lenovo\Desktop\Serichai\source_code\chpaisarn-payroll-reconcile-batch"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Upload & Reconcile Payroll Data (Priority: P1)

A payroll/finance staff member uploads the monthly payroll working file, selects which pay period in the file to check, and submits it. The system recalculates each employee's net wage from their recorded attendance and pay figures and compares it to the amount already stated in the file, then shows a summary of how many employees matched and how many didn't — on screen, immediately.

**Why this priority**: This is the core value of the feature: replacing a once-nightly, email-only batch check with an on-demand check the user can run and read the outcome of right away. Without this, there is no feature.

**Independent Test**: Can be fully tested by uploading a known payroll file with at least one intentionally mismatched employee record, selecting the correct period, and submitting — the summary must show the correct matched/discrepancy counts and the mismatched employee must be identifiable.

**Acceptance Scenarios**:

1. **Given** a valid payroll working file with all employees' stated wages correct, **When** the user uploads it, selects the period, and submits, **Then** the summary shows 0 discrepancies and the total number of employees reconciled.
2. **Given** a valid payroll working file where one or more employees' stated wages don't match what the recorded attendance/pay figures compute to, **When** the user submits a reconciliation run, **Then** the summary shows the correct discrepancy count and each discrepancy is individually listed with enough detail (employee, department, stated vs. recalculated amount) to investigate.
3. **Given** no file has been selected, **When** the user attempts to submit, **Then** the system blocks submission and prompts the user to upload a file first.

---

### User Story 2 - Download Reconciliation Reports (Priority: P2)

After a reconciliation run completes, the user downloads a full reconciliation report (every employee, with stated vs. recalculated amounts and match status) and/or a discrepancies-only report, to file away or hand to finance leadership.

**Why this priority**: On-screen results are enough to spot problems, but payroll/finance work requires an artifact for record-keeping, escalation, and offline follow-up — the same reason the legacy batch produced an Excel summary attachment.

**Independent Test**: Can be fully tested by running a reconciliation with at least one discrepancy, then downloading both reports and confirming the full report lists every employee while the discrepancies-only report lists only the mismatched ones, with matching figures.

**Acceptance Scenarios**:

1. **Given** a completed reconciliation run with at least one discrepancy, **When** the user downloads the full reconciliation report, **Then** it contains every employee processed with their stated amount, recalculated amount, and match status.
2. **Given** a completed reconciliation run with at least one discrepancy, **When** the user downloads the discrepancies-only report, **Then** it contains only the mismatched employees with the same figures shown on screen.
3. **Given** a completed reconciliation run with zero discrepancies, **When** the user looks for a discrepancies report, **Then** the system makes clear there is nothing to download rather than producing a confusing empty file.

---

### User Story 3 - Trust Results Across All Employee Categories (Priority: P3)

A user reviewing discrepancies can tell which department/employee category (e.g., office staff vs. factory, sewing, or contract workers) each flagged employee belongs to, since each category is paid using a different overtime/Sunday-pay formula and investigation steps differ by category.

**Why this priority**: Correctness across categories is essential to the feature being trustworthy, but it is a quality/transparency concern layered on top of P1 rather than a separate independently shippable flow — grouping it as a distinct story keeps the department-awareness requirement visible and testable on its own.

**Independent Test**: Can be fully tested by uploading a file containing mismatches in more than one department category and confirming each discrepancy is correctly attributed to its department and recalculated using that department's formula.

**Acceptance Scenarios**:

1. **Given** a payroll file with employees across office, factory, sewing, and contract categories, **When** a reconciliation run completes, **Then** every discrepancy is labeled with the correct department and every recalculated amount reflects that department's wage formula.

---

### Edge Cases

- What happens when the uploaded file is missing required column headers or isn't a recognizable payroll working file? System must show a clear, specific error rather than a raw failure.
- What happens when the selected pay period has no matching data in the uploaded file? System must tell the user the period wasn't found rather than silently returning an empty or wrong result.
- What happens when a section of the file doesn't match any recognized department category? That employee group must be flagged as an exception needing review rather than silently skipped or causing the whole run to fail.
- What happens when an employee's attendance/overtime data is incomplete or misaligned in the source file? That record must be flagged as a data-error exception rather than silently producing a wrong calculation.
- What happens when every employee reconciles successfully? The summary must clearly present this as a successful "0 discrepancies" outcome, not an error or empty state.
- What happens with a large file (on the order of the company's full monthly headcount across all departments)? The run must still complete and produce usable results without the UI freezing or timing out.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow a user to upload a payroll working file containing employee attendance and wage data organized into department sections.
- **FR-002**: System MUST allow the user to specify which pay period (month/year) within the uploaded file to reconcile.
- **FR-003**: System MUST recalculate each employee's net wage for the selected period using the wage-calculation formula for that employee's department category (office staff use one formula; factory, sewing, and contract staff use another), based on recorded workdays, weekend days, and overtime hours.
- **FR-004**: System MUST compare each employee's recalculated net wage against the net wage already stated for them in the uploaded file.
- **FR-005**: System MUST flag any employee whose stated net wage does not match the recalculated net wage as a discrepancy.
- **FR-006**: System MUST present a validation summary immediately after processing, showing at minimum: total employees reconciled, number matched, and number of discrepancies.
- **FR-007**: System MUST display, for each discrepancy, the employee identifier and name, department category, stated amount, recalculated amount, and the difference between them.
- **FR-008**: System MUST let the user download a complete reconciliation report covering every employee processed in the run, including stated amount, recalculated amount, and match status.
- **FR-009**: System MUST let the user download a discrepancies-only report containing just the employees whose amounts didn't match.
- **FR-010**: System MUST communicate processing state (awaiting input, processing, complete, failed) to the user throughout a reconciliation run.
- **FR-011**: System MUST reject a run and show a specific, understandable error when the uploaded file is missing required data (e.g., unrecognized column headers, or the selected period isn't present) rather than failing silently or surfacing a raw system error.
- **FR-012**: System MUST require a file to be selected before allowing a reconciliation run to be submitted.
- **FR-013**: System MUST flag any department section that doesn't match one of the recognized employee categories as an exception needing review, rather than silently skipping it or aborting the entire run.
- **FR-014**: Reconciliation runs MUST be initiated on demand by a user action rather than on a fixed schedule, replacing the previous nightly automated batch trigger.

### Key Entities

- **Payroll Period File**: The uploaded workbook representing one or more pay periods, organized into department sections, each containing employee attendance/pay rows and the wage amount already stated for that employee.
- **Department Section**: A named grouping within the payroll file (office staff, metal-shop, sewing-shop, or contract staff) that determines which wage-calculation formula applies to its employees.
- **Employee Wage Record**: One employee's attendance and pay data for the selected period — base salary, workdays/hours, weekend days, overtime hours, allowances, deductions, and the net wage already stated for them.
- **Reconciliation Result**: The per-employee outcome of a run — recalculated net wage, match status, and the variance versus the stated amount, if any.
- **Reconciliation Summary**: The aggregate counts of employees processed, matched, and flagged as discrepancies for a given run.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A payroll/finance user can go from uploading a file to seeing reconciliation results in under 2 minutes for a typical monthly payroll file.
- **SC-002**: 100% of wage discrepancies that the legacy nightly batch process would have flagged are also flagged by this feature, verified against historical reconciliation data.
- **SC-003**: Users can identify every discrepant employee, their department, and the size of the discrepancy without manually recomputing any figures themselves.
- **SC-004**: Reconciliation results and downloadable reports are available within 30 seconds of submission for files containing up to 1,000 employee records.
- **SC-005**: Reconciliation turnaround moves from "wait for next day's scheduled batch and email" to "get an answer in the same working session."

## Assumptions

- No email notification is required for this feature; results are surfaced on-screen and via downloadable reports in the same working session, replacing the legacy batch's automated email step (this mirrors the existing Employee Benefits page, which is on-screen + download only).
- Wage calculation continues to recognize the same four department categories as the legacy batch (office staff, metal-shop, sewing-shop, contract staff); adding a new category is a business-rule change, not a user-facing configuration option.
- Uploaded files may contain multiple pay periods (one sheet per month, as in the legacy source file); the user selects which period to reconcile as part of submission.
- This is a read-only reconciliation/reporting tool — it does not modify payroll figures or write back to any payroll system; corrections happen outside this feature.
- Access to this feature follows the same access model as the rest of the portal (no additional role-based restriction), consistent with the app's current lack of an RBAC system.
- Typical file volume is consistent with the company's current monthly payroll headcount (on the order of hundreds to about 1,000 employees across all departments).
