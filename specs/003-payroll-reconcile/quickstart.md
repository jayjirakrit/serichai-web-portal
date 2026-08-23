# Quickstart: Validating Payroll Reconciliation

## Prerequisites

- Backend running: `cd backend; .venv\Scripts\activate; uvicorn main:app --reload` (serves `http://127.0.0.1:8000`).
- Frontend running: `cd frontend; npm run dev` (serves `http://localhost:5173` — the backend's CORS allowlist only permits this exact origin, per `CLAUDE.md`).
- A sample payroll working file matching the layout in `data-model.md` / `research.md` #2: a sheet named `ประจำ {M-yy}` (Buddhist Era two-digit year) for the period you'll test (e.g. `ประจำ 8-69` for August 2026), with at least one department header row from each category (`สำนักงาน`, and one of `โรงเหล็ก`/`โรงเย็บ`/`พนง.ชั่วคราว`), each followed by paired employee/overtime rows, and column headers on row 3 including `วันหยุด` and `วันปกติ`. No such fixture exists in the repo yet — implementation tasks include building one (`backend/tests/fixtures/`) since this feature has no equivalent of `sample-data/master.xlsx` to reuse.

## Scenario 1 — All employees reconcile (User Story 1, AC1)

1. On the Payroll Reconciliation page (`/payroll-reconciliation`), upload the fixture file, select the matching period, and submit.
2. Confirm the summary shows `discrepancyCount: 0` and `matchedCount` equal to the fixture's total employee count, with an empty `discrepancies` list.
3. Confirm no "download discrepancies" action is offered (spec User Story 2, AC3).

## Scenario 2 — A discrepancy in each department formula (User Story 1 AC2, User Story 3 AC1)

1. In a copy of the fixture, change one office-department employee's stated `สุทธิ` value so it no longer matches their recorded hours, and do the same for one factory/contract-department employee.
2. Upload, select the period, submit.
3. Confirm `discrepancyCount: 2`, and that `discrepancies` lists both employees with their correct `department`, `statedAmount`, `recalculatedAmount`, and `variance` — and that each was recalculated using its own department's formula (office: `/30` daily divisor; factory/contract: per-count with `/8` hourly OT divisor — `research.md` #4).
4. Download the full reconciliation report and confirm it lists every employee (matched and discrepant); download the discrepancies-only report and confirm it lists only the two.

## Scenario 3 — Unrecognized department and malformed row (Edge Cases)

1. In a copy of the fixture, rename one department header to a value not in the four recognized categories, and remove the overtime row beneath one employee elsewhere in the file.
2. Upload, select the period, submit.
3. Confirm the run still completes (200, not a 4xx): the renamed section's employees appear in `discrepancies` with `status: "unrecognizedDepartment"`, and the employee with the missing OT row appears with `status: "dataError"` — neither stops processing of the rest of the file.

## Scenario 4 — Request-level failures (FR-011)

1. Submit with a `period` that has no matching sheet in the uploaded file — confirm a 4xx with a message naming the missing period, not a raw server error.
2. Submit a file with row 3's header missing the `วันหยุด`/`วันปกติ` markers — confirm a 4xx identifying the format problem.
3. Submit with no file selected — confirm the frontend blocks submission before any request is sent (mirrors `EmployeeBenefits.tsx`'s existing guard).

## Expected artifacts per run

- `summary` + `discrepancies` in the API response, rendered in the page's Reconciliation Summary panel.
- A downloadable full reconciliation report (`.xlsx`) — always present.
- A downloadable discrepancies-only report (`.xlsx`) — present only when `discrepancyCount > 0`.

## Out of scope for this quickstart

Confirming the recalculated formulas match finance's real-world expectations against an actual production payroll file (as opposed to a hand-built fixture) is a business-side validation this quickstart's mechanical checks cannot substitute for — have finance cross-check the first real run's discrepancy report before relying on it operationally.
