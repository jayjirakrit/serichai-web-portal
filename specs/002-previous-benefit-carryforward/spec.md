# Feature Specification: Previous-Year Benefit Carry-Forward

**Feature Branch**: `002-previous-benefit-carryforward`

**Created**: 2026-08-20

**Status**: Draft

**Input**: User description: "as solution architect, I want to analysis and planning for new feature of employee benefits calculation to allow user to upload 1 more file name \"Previous Employee Benefits\" which is the employee benefit report from previous year as optional. If file exist, it will match record employee from employee_id (รหัสพนักงาน) and get value ผลประโยชน์ของพนักงานที่คาดว่าต้องจ่าย ณ วันสิ้นปีปัจจุบัน and put in new file at ยอดยกมา"

This extends `specs/001-employee-benefit-calculation` (the single-file, formula-driven benefit calculation). It does not change that calculation — it adds one optional carry-forward value sourced from a second, optional file.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Carry forward last year's liability by employee ID (Priority: P1)

HR staff, while submitting this year's benefit calculation, optionally also upload last year's benefit report ("Previous Employee Benefits"). For every employee in this year's calculated output, the system looks up that employee's ID in last year's report and, when found, copies last year's "estimated liability at year-end" figure into this year's "ยอดยกมา" (brought-forward) column — so HR no longer has to look up and retype that figure by hand for every employee.

**Why this priority**: This is the entire feature. Without it, `ยอดยกมา` is always blank (per FR-013 of the base feature) and HR must fill it in manually from last year's report — the exact manual, error-prone step this feature removes.

**Independent Test**: Supply a master file and a previous-year file where several employee IDs match, several exist only in one file, and one ID is duplicated in the previous-year file; confirm matched employees show the correct carried-forward value, unmatched employees show a blank `ยอดยกมา` with no exception, and the duplicated ID is reported as an exception with `ยอดยกมา` left blank for that employee.

**Acceptance Scenarios**:

1. **Given** a master file and a previous-year file both containing employee ID `1002`, **When** the calculation runs, **Then** employee `1002`'s output row has `ยอดยกมา` equal to the previous-year file's `ผลประโยชน์ของพนักงานที่คาดว่าต้องจ่าย ณ วันสิ้นปีปัจจุบัน` value for that same ID, copied unmodified.
2. **Given** an eligible employee in this year's output whose ID does not appear anywhere in the previous-year file (e.g. a newly eligible employee), **When** the calculation runs, **Then** that employee's `ยอดยกมา` is blank and no exception is recorded for it.
3. **Given** the previous-year file contains two or more rows with the same employee ID, **When** the calculation runs, **Then** no value is carried forward for any employee matching that ID, `ยอดยกมา` stays blank for them, and an exception distinct from `missingRequiredField` is recorded identifying the duplicated ID.
4. **Given** the previous-year file is supplied but is missing the employee ID column or the liability column entirely, **When** the request is submitted, **Then** the request fails with a clear error and no output is produced — the same way an invalid master file already fails today.

---

### User Story 2 - Run the calculation without a previous-year file (Priority: P2)

HR staff who do not have (or do not want to supply) last year's report can still run the calculation with only the master file, exactly as today.

**Why this priority**: The previous-year file is explicitly optional; existing users and the very first year this feature is used must see zero change in behavior when they omit it.

**Independent Test**: Submit only a master file (no previous-year file); confirm the calculated output, summary, and exception report are byte-for-byte identical to what the base feature produces today, with every `ยอดยกมา` cell blank.

**Acceptance Scenarios**:

1. **Given** no previous-year file is attached, **When** the calculation runs, **Then** the request succeeds exactly as it does today and every output row's `ยอดยกมา` is blank.

---

### User Story 3 - Data-quality problems in the previous-year file are visible, not guessed (Priority: P3)

When the previous-year file has problems that would make a carried-forward figure unreliable (duplicate IDs, or a completely unreadable/wrong file), HR sees a clear signal rather than the system silently picking a value or silently skipping the whole file.

**Why this priority**: A wrong carried-forward liability figure is a financial-reporting risk; staying silent about it defeats the purpose of automating what was previously a manual, checked-by-hand copy step.

**Independent Test**: Submit a previous-year file with a duplicated employee ID; confirm the resulting exception report includes an entry identifying the duplicate, distinguishable from a `missingRequiredField` exception.

**Acceptance Scenarios**:

1. **Given** a previous-year file with a duplicate employee ID, **When** the calculation runs, **Then** the exception report includes a row identifying that ID as duplicated in the previous-year file.

---

### Edge Cases

- What happens when the master file's employee ID for a given row is blank? → That employee cannot be matched (no key to match on); `ยอดยกมา` stays blank, no exception — same as any other unmatched case (Acceptance Scenario 2, User Story 1).
- What happens when the same employee ID appears with different formatting in the two files (e.g. `1002` as a number in one file and `"1002"` as text in the other, or with stray leading/trailing spaces)? → Matching normalizes both sides to trimmed text before comparing; this counts as a match, not a mismatch.
- What happens when a matched previous-year liability value is zero or negative? → Copied forward unmodified; the feature does not validate the figure's plausibility.
- What happens when an employee is flagged resigned this year but still appears in the calculated output? → Carry-forward matching still applies to their row like any other output row; resignation status doesn't change carry-forward behavior.
- What happens when the previous-year file is supplied but the master file has zero populated employee IDs (a known current data-quality gap noted in `specs/001-employee-benefit-calculation`)? → No employee can be matched; every `ยอดยกมา` is blank, and the request still succeeds (this is not treated as an invalid-file error, since the master file's own required columns are unrelated to this feature).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow HR to optionally attach a second file, "Previous Employee Benefits," alongside the required Employee Master Data file when submitting a benefit calculation request.
- **FR-002**: System MUST accept the Previous Employee Benefits file in the same file formats already accepted for the master file (`.xlsx`/`.csv`).
- **FR-003**: When the Previous Employee Benefits file is not supplied, System MUST calculate and produce output exactly as it does today (per `specs/001-employee-benefit-calculation`), with every `ยอดยกมา` cell left blank.
- **FR-004**: When the Previous Employee Benefits file is supplied, System MUST resolve its employee identifier column (`รหัสพนักงาน`) and its prior-year liability-at-year-end column (`ผลประโยชน์ของพนักงานที่คาดว่าต้องจ่าย ณ วันสิ้นปีปัจจุบัน`), and MUST fail the request with a clear error if either column cannot be found — rather than silently proceeding without carry-forward.
- **FR-005**: System MUST fail the request with a clear error if the Previous Employee Benefits file is supplied but is empty or unreadable, consistent with how the master file is already validated.
- **FR-006**: For each employee in this year's calculated output, System MUST look up that employee's ID (`รหัสพนักงาน`, from the master file) against the Previous Employee Benefits file's employee IDs, and, when exactly one row matches, MUST populate that employee's `ยอดยกมา` cell with the matched row's liability-at-year-end value, copied unmodified (no recalculation or adjustment).
- **FR-007**: When an employee's ID has no corresponding row in the Previous Employee Benefits file — including when the master file's own ID for that employee is blank — System MUST leave `ยอดยกมา` blank for that employee and MUST NOT record this as an exception; this is an expected, normal case (e.g. a newly eligible employee with no prior-year record).
- **FR-008**: When the Previous Employee Benefits file contains more than one row sharing the same employee ID, System MUST NOT guess which row is authoritative: it MUST leave `ยอดยกมา` blank for any employee matching that duplicated ID, and MUST record the duplicate as an exception in the same exception report used today, in a category distinct from `missingRequiredField`, identifying the duplicated ID so HR can correct the source file.
- **FR-009**: Matching MUST compare employee IDs as trimmed, string-normalized values (so a numeric `1002` matches a text `"1002"`, and stray leading/trailing whitespace is ignored); System MUST NOT apply fuzzy, partial, or name-based matching.
- **FR-010**: System MUST NOT change any other existing calculation behavior (eligibility gating, formula outputs, resignation flagging, `missingRequiredField` exception handling) when the Previous Employee Benefits file is supplied — the carry-forward value is strictly additive to the existing output.

### Key Entities

- **Previous Employee Benefits Record**: One row from the optional prior-year file — employee ID and the prior-year liability-at-year-end figure to be carried forward. Other columns in that file are not used by this feature.
- **Carry-Forward Match**: The pairing of a current-cycle output employee to at most one previous-year record by employee ID; produces the value written into `ยอดยกมา`, or stays unmatched (blank) when no unique corresponding record exists.
- **Duplicate-ID Exception**: A new exception category (alongside the existing `missingRequiredField`) recorded when the Previous Employee Benefits file contains more than one row for the same employee ID.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: When both files are supplied with populated, consistent employee IDs, 100% of employees with a unique matching prior-year record show the correct carried-forward amount with zero manual re-entry by HR.
- **SC-002**: Omitting the Previous Employee Benefits file produces output identical to today's single-file calculation, with zero regressions.
- **SC-003**: 100% of duplicate employee ID conflicts in the previous-year file are visible to HR in the exception report; zero carried-forward values are ever guessed from an ambiguous match.
- **SC-004**: HR completes a carry-forward-enabled calculation in the same single submission and within the same time budget as today's single-file run (under 5 minutes total), with no separate manual carry-forward step.

## Assumptions

- The Previous Employee Benefits file is expected to be last year's output of this same benefit-calculation feature (or an equivalent report using the same Thai column headers) — its `ผลประโยชน์ของพนักงานที่คาดว่าต้องจ่าย ณ วันสิ้นปีปัจจุบัน` values are carried forward as-is, with no recalculation, indexing, or discounting applied.
- Employee ID (`รหัสพนักงาน`) is assumed to be a stable, unique identifier for a given employee across years. Per explicit user direction, matching is by employee ID only — there is no name-based fallback when an ID is blank or absent.
- As already noted in `specs/001-employee-benefit-calculation`, the current `Employee_Master_Data.xlsx` has zero populated `รหัสพนักงาน` values. Until HR populates that column (in both this year's master file and the previous-year file), carry-forward matching will produce zero matches — this is a pre-existing data-quality gap this feature surfaces but does not fix.
- Duplicate-ID conflicts are surfaced through the existing exception report mechanism (a new category alongside `missingRequiredField`) rather than a separate document, so HR has one place to check for any calculation issue.
- ~~This feature does not alter the final benefit workbook's structure (`specs/001-employee-benefit-calculation`'s FR-014) beyond populating the already-existing, currently-always-blank `ยอดยกมา` column — no new output column is introduced.~~ **Superseded, as implemented**: the output workbook now also includes a `รหัสพนักงาน` (employee ID) column, unconditionally, right after `ลำดับ`. This was necessary for the feature to work in future years — the previous-year file is expected to be *this feature's own prior output* (see the assumption below), which can't carry an ID to match on unless this year's output also emits one. See `data-model.md`'s "Amendment" note for detail.
- The same implementation pass also changed how several base-feature (001) fields are populated based on `is_resigned` (e.g. `เงินเดือน ณ วันเกษียณ` and related projection columns are now blank for active employees, and `ลาออก` is now the string `"ใช่"`/`"ไม่ใช่"` rather than a boolean). This is unrelated to carry-forward matching and out of this spec's original scope (see `data-model.md`'s "Bundled change" note) — it's recorded here only because it shipped in the same manual backend update, not because this spec defines that behavior.
