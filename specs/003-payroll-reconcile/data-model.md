# Data Model: Payroll Reconciliation

All entities below are in-memory shapes for the duration of one request — there is no persistence layer for this feature (spec.md Assumptions: read-only, no write-back). Internally they are columns of one working `pandas.DataFrame` (one row per employee, built by the vectorized pipeline in `research.md` #1-#2), not per-employee Python objects — the tables below describe that `DataFrame`'s columns, mirroring how `accounts_service.py`'s `compute_benefit_rows` documents its working frame. The source file's own Thai column headers and department-name conventions are preserved throughout (`research.md` #2).

## DepartmentSection (derived column — `department` / `department_category`)

Every employee row carries its section's department, forward-filled down from that section's header row (`research.md` #2's `ffill()`). A department-header row is identified structurally — a non-blank department cell paired with a *blank* employee first-name cell — rather than by matching the department name against the four known categories, so a section with an unrecognized name still opens its own section instead of silently merging into the preceding one (`research.md` #2, FR-013).

| Column | Type | Notes |
|---|---|---|
| department | str | The Thai text found in the department column (e.g. `สำนักงาน`), broadcast to every row in its section. |
| department_category | `"office"` \| `"factoryOrContract"` \| `"unrecognized"` | `สำนักงาน` → `office`; `โรงเหล็ก`, `โรงเย็บ`, `พนง.ชั่วคราว` → `factoryOrContract` (same formula, per `CalculationReconcileService`'s `else` branch); anything else → `unrecognized` — a vectorized `.map()`/`np.select()` over `department`. |

## EmployeeWageRecord (working `DataFrame` — one row per employee, one pay period)

Assembled by joining the attendance-row frame and the overtime-row frame side-by-side (`research.md` #1); the per-day-count sum columns (`total_workday`, `total_sunday`, etc.) are computed with `.iloc[:, start:end].sum(axis=1)` across each frame rather than accumulated in a loop.

| Column | Type | Notes |
|---|---|---|
| index, first_name, last_name | str | From the row's `#` / `ชื่อ` / `นามสกุล` cells. |
| salary | float | Base salary/rate (`ค่าแรงปี xx`). |
| total_workday, total_workday_hour, total_sunday | float | Attendance totals already computed by the source file's own formulas (`วันปกติ`, `ชม.ปกติ`, `อาทิตย์`). |
| total_workday_ot_hour, total_weekend_ot_hour | float | `OT ปกติ`, `OT วันหยุด`. |
| lump_sum, diligent_allowance, shift_fee, bonus | float | Flat add-ons carried through unchanged into the recalculated total. |
| social_security, advance_payment, deduct_loan_fund, tax | float | Stated deductions; `social_security` is recalculated only when the stated value is non-zero (`research.md` #4). |
| stated_actual_total_wage | float | `สุทธิ` — the value being checked. |

A row whose paired OT row is missing, or whose numeric cells fail to parse (`pd.to_numeric(..., errors="coerce")` → `NaN`), is excluded from formula computation — that employee is instead reported directly as a `dataError` exception via the `.isna()` mask described in `research.md` #5.

## ReconciliationEntry (wire model — one flagged employee)

API-facing entity (`contracts/payroll-reconciliation-api.md`); wire fields are camelCase, backend Python attributes stay `snake_case`, bridged via the shared `CamelModel` alias generator (`backend/models/common.py`).

| Field (wire) | Type | Notes |
|---|---|---|
| department | str | The section's `raw_name` the employee belongs to. |
| employeeId | str \| None | The row's `#` value. |
| employeeName | str \| None | `firstName lastName`, when known. |
| statedAmount | number \| None | `stated_actual_total_wage`; `null` for a `dataError` row if unreadable. |
| recalculatedAmount | number \| None | The recomputed net wage; `null` for `unrecognizedDepartment` (no formula to apply) or `dataError` (insufficient data). |
| variance | number \| None | `statedAmount - recalculatedAmount`, when both are present. |
| status | `"discrepancy"` \| `"unrecognizedDepartment"` \| `"dataError"` | Only non-matched employees are ever represented as a `ReconciliationEntry` — matched employees are counted, not individually listed (FR-007 asks for discrepancy detail only). |
| detail | str | Human-readable explanation, e.g. the missing-header or malformed-row reason for `dataError`. |

## ReconciliationSummary (wire model)

| Field (wire) | Type | Notes |
|---|---|---|
| totalEmployeesReconciled | int | Every employee row processed for the selected period, across all sections. |
| matchedCount | int | `totalEmployeesReconciled` minus every flagged status. |
| discrepancyCount | int | Count of `status == "discrepancy"` only (used for the discrepancy-report presence rule, `research.md` #6). |
| discrepanciesByDepartment | dict[str, int] | Keyed by `raw_name`, counting all flagged statuses (discrepancy + unrecognizedDepartment + dataError) per department, for the User Story 3 department breakdown. |

## ReconcilePayrollResponse (wire model — full response envelope)

| Field (wire) | Type | Notes |
|---|---|---|
| summary | ReconciliationSummary | |
| discrepancies | list[ReconciliationEntry] | All flagged employees, any status. |
| reconciliationReport | FileAttachment | Always present — every employee processed, stated vs. recalculated amount, status. |
| discrepancyReport | FileAttachment \| None | Present only when `discrepancyCount > 0`; `null` otherwise (spec User Story 2, Acceptance Scenario 3). |

`FileAttachment` (`filename`, `contentBase64`) is reused unchanged from the existing benefits feature, extracted into `backend/models/common.py` alongside `CamelModel` so both feature areas share one definition (Constitution Principle V).

## Validation rules (from Functional Requirements)

- `payrollFile` and `period` are both required at the request level; a request missing either is rejected before any parsing is attempted (FR-002, FR-012).
- If the selected period has no matching sheet in the uploaded file, or the file is missing the `วันหยุด`/`วันปกติ` header markers `getHeader` depends on, the request fails with a 4xx and a specific message — not a raw exception (FR-011).
- A department section whose name isn't one of the four recognized categories does not stop the run; every employee in it becomes an `unrecognizedDepartment` entry (FR-013).
- A row with missing/misaligned overtime data becomes a `dataError` entry rather than silently computing with zeros (Edge Cases).
- Every other employee is recalculated and compared; a mismatch (after rounding to 2 decimals, half-up per `research.md` #4a) becomes a `discrepancy` entry (FR-003, FR-004, FR-005).
