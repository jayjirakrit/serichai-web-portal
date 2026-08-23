# Data Model: Bonus Calculation

All entities are in-memory for the duration of a single request — no persistence layer (`research.md` #1: one call does everything, so there is no run/session state to hold anywhere, in the backend or the frontend). Source-file Thai sheet/column conventions are preserved throughout (`research.md` #3).

## EmployeeBonusRecord (wire model — one row per employee, base population = `วันทำงานปี_<YY>`)

Wire fields are camelCase; backend Python attributes stay `snake_case`, bridged via `CamelModel` (`backend/models/common.py`). Computed for every employee in the base sheet, but only employees carrying ≥1 exception category are returned on the wire, under `CalculateBonusResponse.flaggedEmployees` — full detail for every employee (flagged or not) is available only in `bonusReport` (spec Clarifications, 2026-08-23 (3)). It carries no approved-day or final-bonus fields, since finalization happens exclusively inside the generated report (see "Generated report layout" below), never as API/app state (spec Clarifications, 2026-08-23 (2)).

| Field (wire) | Type | Source / Notes |
|---|---|---|
| employeeId | string \| null | Always `null` in v1 — reserved so a future feature can populate a real identifier without a response-shape change (`research.md` #6, FR-004). |
| matchKey | string | Trimmed `"{firstName} {lastName}"`, the join key actually used in v1 (`research.md` #6). |
| prefix | string \| null | คำนำหน้า. |
| firstName | string | ชื่อ. |
| lastName | string | สกุล/นามสกุล. |
| departmentNotes | string \| null | Working-day sheet col G (`หมายเหตุ`) — e.g. `"ออฟฟิศ"`; determines whether `payRate` needed the /30 conversion. |
| otCategoryCode | string \| null | Working-day sheet col 48 — `"OT"` \| `"OT SEWING"` \| `"OT PAINT"` \| anything else (unrecognized). |
| payRate | number \| null | Working-day sheet col E, divided by 30 only when `departmentNotes` is the office marker (`research.md` #3); `null` only when `workingDayDataInvalid` (`research.md` #8). |
| startDate | string (date) \| null | เริ่มทำงาน, pass-through for the report. |
| workDays | number \| null | col 45. |
| totalOt | number \| null | col 46. |
| totalNotWorked | number \| null | col 47, pass-through. |
| sickLeaveDays, personalLeaveDays, specialPersonalLeaveDays, absentDays, vacationDays | number \| null | Leave sheet cols 78-82; all `null` together when `leaveNotFound`. |
| currentGradeNumeric | number \| null | Average of evaluation sheet cols E:Q (5-17), ignoring blanks; `null` when `evaluationNotFound`/`evaluationAllBlank`. |
| currentGradeLetter | string \| null | 12-tier bracket lookup on `currentGradeNumeric` (`research.md` #7). |
| previousGradeLetter | string \| null | Previous-year summary sheet col 11 (`research.md` #4); `null` when `previousBonusNotFound` — note the previous file has no separate "not found" case for grade vs. bonus, one lookup covers both. |
| previousBonus | number \| null | Previous-year summary sheet col 29 (`research.md` #4). |
| personalLeaveScore, sickLeaveScore, absentScore, vacationScore | number \| null | The four leave-deduction formulas (`research.md` #7); `null` (not `0`) when `leaveNotFound`, even though they contribute `0` to `totalScore` in that case (`research.md` #8). |
| workingDaysScore | number \| null | Tiered band on `workDays`. |
| otScore | number \| null | Tiered band on `totalOt`, using the table selected by `otCategoryCode`; `null` when `otCategoryUnrecognized`. |
| totalScore | number \| null | `currentGradeNumeric + sum(4 leave scores, missing=0) + workingDaysScore + otScore`, **not floored** — `null` only when blocked per `research.md` #8, never clamped at zero when negative (FR-007). |
| provisionalDays | number \| null | `max(0, totalScore * 30 / 12)` — floored at zero here, not at `totalScore` (FR-008). |
| provisionalBonus | number \| null | `provisionalDays * payRate`. This is the value the generated report's final-bonus formula multiplies the user's filled-in approved days against (see below). |
| exceptions | array of `BonusExceptionCategory` | Zero or more of: `evaluationNotFound`, `evaluationAllBlank`, `leaveNotFound`, `previousBonusNotFound`, `otCategoryUnrecognized`, `duplicateName`, `workingDayDataInvalid` (`research.md` #6, #8). Empty = no exceptions (User Story 3 AC3). |
| exceptionNote | string \| null | Human-readable, e.g. `"Not found in evaluation data; not found in previous-year bonus data."` — joins every category in `exceptions`, mirrors the legacy macro's single free-text note column (`research.md` #3). `null` when `exceptions` is empty. |

### `BonusExceptionCategory` (`Literal`)

`"evaluationNotFound" | "evaluationAllBlank" | "leaveNotFound" | "previousBonusNotFound" | "otCategoryUnrecognized" | "duplicateName" | "workingDayDataInvalid"`

**Blocking**: `evaluationNotFound`, `evaluationAllBlank`, `otCategoryUnrecognized`, `duplicateName`, `workingDayDataInvalid` set `totalScore`/`provisionalDays`/`provisionalBonus` to `null`, which in turn leaves the report's final-bonus formula blank for that row regardless of what the user fills into the approved-days cell (FR-013, `research.md` #10). **Non-blocking**: `leaveNotFound` (missing leave scores contribute `0`, not `null`, to `totalScore`), `previousBonusNotFound` (comparison-only). See `research.md` #8 for the verified-against-real-data rationale.

## BonusCalculationSummary (wire model)

| Field (wire) | Type | Notes |
|---|---|---|
| totalEmployees | int | Every row in the working-day (base) sheet with a non-blank name (FR-010). |
| calculatedCount | int | Rows with a non-`null` `totalScore` — i.e. no blocking exception. |
| exceptionCount | int | Rows with at least one entry in `exceptions` (blocking or not — a `leaveNotFound`-only row still counts, since it's still worth a user's attention even though scoring proceeded). |
| exceptionsByCategory | dict[string, int] | Keyed by `BonusExceptionCategory`; a row with multiple categories is counted once per category it has. |

## CalculateBonusResponse (wire model — `POST /accounts/bonus-calculation` response)

| Field (wire) | Type | Notes |
|---|---|---|
| summary | BonusCalculationSummary | |
| flaggedEmployees | array of EmployeeBonusRecord | Only employees with ≥1 entry in `exceptions` — mirrors `specs/003`'s `discrepancies` field on `ReconcilePayrollResponse`. Successfully-calculated employees are represented only in `summary`'s counts and in `bonusReport`, not as individual wire objects (spec Clarifications, 2026-08-23 (3)). |
| bonusReport | FileAttachment | Always present — one `.xlsx`, every employee (flagged or not), produced in the same call that computed `flaggedEmployees` (User Story 2). Reused unchanged from `backend/models/common.py`. |

## Generated report layout (`bonusReport`, mirrors the real legacy output, `research.md` #9)

`build_bonus_report` fills `backend/data/Bonus_Calculation_Template.xlsx` — the same 4-header-row, 31-column layout as the real `ผลสรุปโบนัสปี_<YY>` sheet — rather than building a workbook from scratch, so header labels, the editable/formula annotation band, and per-column styling all come from the template file itself:

| Row | Content |
|---|---|
| 1 | Company name (static, from the template). |
| 2 | Report title, e.g. `ผลสรุปโบนัสผลปี  2568 ( ตั้งแต่ 1 ม.ค. - 31 ธ.ค. 2568)` — the BE year substituted in at generation time. |
| 3 | Annotation band over merged ranges: `ข้อมูลตั้งต้น` (source data, A:D and F:R), `แก้ไขได้` (editable, E and S:X), `สูตร Excel` (formula, Y:AA and AC), `กรุณาเติมค่า` (please fill in, AB). |
| 4 | Column headers, e.g. `ลำดับ`, `คำนำหน้า`, …, `grade<CY>` / `grade<PY>` (col K/L, year substituted), …, `Days`, `Bonus`, `วัน`, `Bonus ที่ได้`, `Bonus ปีที่แล้ว`, `หมายเหตุ`. |
| 5+ | One row per employee, starting at `REPORT_DATA_START_ROW`. |

Per employee row, columns A:X (identity, source data, and the four leave-deduction/working-days/OT score columns) are **static values**, written once at generation time — same figures as the API response. The remaining columns:

| Report column | Cell content | Notes |
|---|---|---|
| grade (M) / grade\<CY\> (K) | static value, **blanked** (regardless of the underlying computed value) whenever the row carries a blocking exception category | The single gate the total-score formula (Y) checks — this is what makes the whole Y→Z→AA→AC formula chain resolve blank for a blocked row (FR-007, FR-013), not just a Python-side `null`. |
| คะแนนทั้งหมด (Y, total score) | **formula**: `=IF(<grade cell>="","",SUM(<grade cell>,<leave+working-days+OT score range>))` | |
| Days (Z) | **formula**: `=IF(<Y cell>="","",IF(<Y cell>*30/12<=0,0,<Y cell>*30/12))` | |
| Bonus (AA, provisional bonus) | **formula**: `=IF(<Z cell>="","",<Z cell>*<pay-rate cell>)` | |
| วัน (approved days, AB) | **blank input cell** | The field User Story 2 describes the user filling in directly. No value, no formula — pure input. Left blank (not `0`) for every row, blocking or not (FR-012). |
| Bonus ที่ได้ (AC, final bonus) | **formula**: `=IF(OR(<AA cell>="",<AB cell>=""),"",ROUND(<AB cell>*<AA cell>/30,0))` | Recalculates automatically the instant the user fills in the approved-days cell — no round trip to the backend (FR-012). Because a blocked row's grade cell (M) is blank, the whole Y/Z/AA chain resolves blank, so this formula's `<AA cell>=""` branch fires regardless of what's typed into approved-days — satisfying FR-013. |

All four formula columns (`Y`, `Z`, `AA`, `AC` — the template's "สูตร Excel"-annotated columns) are rebuilt per row rather than computed once in Python, matching the legacy macro's own report (`ReportModule.bas`'s `WriteDataToReport`, verified directly against the decompiled VBA) and applied uniformly to every row, not just non-blocked ones.

`ลำดับ` (column A) is left blank in every row — reserved for a future employeeId (`research.md` #9) rather than the legacy sheet's own row-sequence number.

## Validation rules (from Functional Requirements)

- `currentYearFile`, `previousYearSummaryFile`, and `year` are all required on `/accounts/bonus-calculation`; a request missing any is rejected before parsing starts (FR-001, FR-002, FR-014).
- If `currentYearFile` is missing any of the three required sheets (evaluation/working-days/leave) for the resolved BE year, or `previousYearSummaryFile` is missing its `ผลสรุปโบนัสปี_<prevYY>` sheet, the request fails with a 4xx naming the missing sheet — not a raw exception (FR-003).
- Every row in the base (working-day) sheet is represented in `bonusReport`, either fully calculated or with one or more exception categories and a human-readable note — none silently dropped from the report. In the JSON response, every row is counted in `summary`, and every row carrying ≥1 exception category additionally appears in `flaggedEmployees` by name and reason — none silently dropped from either (FR-004, SC-002).
- `totalScore` is never clamped at zero when negative; only `provisionalDays` is floored at zero (FR-007, FR-008).
- The report's approved-days cell is always blank at generation time, and its final-bonus formula only ever resolves to a number once both the approved-days cell and that row's `provisionalBonus` are non-blank — never a misleading `0` (FR-012, FR-013).
