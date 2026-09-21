# Quickstart: Validating the Elderly-Employee Tax Deduction Service

## Prerequisites

- Backend running: `cd backend; .venv\Scripts\activate; uvicorn main:app --reload` (serves `http://127.0.0.1:8000`).
- Frontend running: `cd frontend; npm run dev` (serves `http://localhost:5173`).
- Sample file: `Tax_Reduction_Sample_filled.xlsx` at the repo root — already matches the template layout documented in `data-model.md`/`research.md` (150+ employees, mixed ages/salaries; used as this feature's ground truth during design).

## Scenario 0 — Health check

1. `GET http://127.0.0.1:8000/health` → confirm `{ "status": "ok" }` (`contracts/health-api.md`).

## Scenario 1 — One call returns rules, on-screen results, and the generated report together (User Stories 1–3, FR-008/FR-009/FR-010)

1. On the Tax Deduction page (`/tax-deduction`), upload `Tax_Reduction_Sample_filled.xlsx` and submit — or call `POST /accounts/tax-deduction` directly with `payrollFile` set.
2. Confirm `summary` includes `ageThreshold: 60`, `salaryCapPerMonth: 15000.0`, `headcountCapPercent: 0.10`, `beYearOffset: 543`, and `referenceDate` equal to today (FR-010) — no separate rules call is needed.
3. Repeat with `referenceDate=2026-12-31` in the form body → confirm `summary.referenceDate` echoes that date and every computed figure reflects ages/salaries as of that date instead of today.
4. Confirm `summary.totalHeadcount` equals the roster's row count, and `summary.headcountCap == floor(totalHeadcount * 0.10)`.
5. Decode `taxDeductionReport.contentBase64` (or use the page's download action) and confirm a `.xlsx` results — this is the static `backend/data/Tax_Reduction_Template.xlsx` template filled in, not a copy of the uploaded file (research.md #6, revised):
   - `taxDeductionReport.filename` is the fixed `tax_deduction_report.xlsx`, and the workbook has a single sheet (`ผลประโยช์นพนักงาน`) — no `ข้อมูลพนักงาน` roster sheet.
   - Rows 1–4 (the template's own title block and header) are intact; data rows from row 5 list every employee with a computed `เงินเดือน`, corrected `วันเดือนปีเกิด`, `อายุปัจจุบัน`, 12 monthly amounts, and `รวม`.
   - For the first sample employee (DOB `2497-03-26`, i.e. Buddhist-Era `1954-03-26`, seq 1 → row 5), confirm `อายุปัจจุบัน = 72` (as of a 2026-09-18 reference date) and `เงินเดือน = 14678.92` (`176147 / 12`), matching `data-model.md`'s worked example.

## Scenario 2 — On-screen results distinguishing the three states (User Story 2, FR-009, FR-014)

Using the same response from Scenario 1's `employees` array (no second request needed):

1. Find an employee with `eligible: false` — confirm all 12 `monthlyAmounts` are `0` and `rank: null`, while `age`/`averageMonthlySalary` are still populated (FR-007).
2. Find an employee with `eligible: true, selected: false` (beyond the headcount cap) — confirm all 12 `monthlyAmounts` are `0` but `rank` is a positive integer (FR-005, Edge Cases).
3. Find an employee with `selected: true` — confirm each `monthlyAmounts[i]` equals that month's wage+OT when it is at or below 15,000, and any month with `wage+OT` above 15000 shows `0` for only that month (not clamped to 15000), with `selected` and the other months unaffected (FR-006, Edge Cases).
4. Confirm the March and December amounts equal `wage + OT` (excluding that month's `โบนัส` column) for at least one employee whose source `รวม` for those months differs from `wage + OT` — proving the bonus-exclusion parsing rule (`research.md` #2) is applied, not `รวม` read verbatim.

## Scenario 3 — Rejecting a malformed upload (FR-011)

1. Submit a copy of the sample file with the `ข้อมูลพนักงาน` roster sheet deleted → confirm 400 with a message naming the missing sheet. (The uploaded file's own `ผลประโยช์นพนักงาน` sheet, if any, is not read or validated at all — the report always comes from the static template — so deleting *that* sheet from the upload no longer produces a rejection.)
2. Submit a copy with one `รวม` column header renamed/removed from `ข้อมูลพนักงาน` → confirm 400 identifying the missing month column, not a wrong silent calculation.
3. Submit with no file selected → confirm the frontend blocks submission before any request is sent (mirrors `EmployeeBenefits.tsx`'s existing guard), and a direct request with no `payrollFile` field returns 422.

## Scenario 4 — Small-roster headcount rounding to zero (Edge Cases)

1. Build a small roster (e.g. 5 employees) where at least one otherwise qualifies by age and salary.
2. Confirm `summary.headcountCap == 0` and every employee shows `eligible: true` (if they pass age/salary) but `selected: false` with all-zero `monthlyAmounts` — not an error.

## Out of scope for this quickstart

Confirming the calculated amounts match a real company's production payroll (as opposed to the bundled sample) is a business-side sign-off this quickstart's mechanical checks cannot substitute for.
