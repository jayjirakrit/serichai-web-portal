# Quickstart: Validating Employee Benefit Calculation

## Prerequisites

- Backend running: `cd backend; .venv\Scripts\activate; uvicorn main:app --reload` (serves `http://127.0.0.1:8000`).
- Frontend running: `cd frontend; npm run dev` (serves `http://localhost:5173` — the backend's CORS allowlist only permits this exact origin, per `CLAUDE.md`).
- A sample employee master file: `sample-data/master.xlsx` (7 employees, mixing ages above/below the eligibility threshold, one resigned, one already past retirement age, several below retirement age with a nonzero years-of-service figure).

## Scenario — Compute the benefit calculation (User Story 1)

1. On the Employee Benefits page (`/employee-benefits`), upload `sample-data/master.xlsx` as the Employee Master Data file and submit.
2. Confirm the Validation Summary shows `Total employees out: 6`, `Computed: 6`, `Resigned flagged: 1`, `Exceptions: 0` — one employee (`Young`, age 21) is below the eligibility age and correctly excluded without appearing as an exception.
3. Download the benefit report and confirm the employee already at/past retirement age (`Malee`, age ~69) has `ผลประโยชน์ของพนักงานที่คาดว่าต้องจ่าย ณ วันสิ้นปีปัจจุบัน` equal to `ประมาณการหนี้สินผลประโยชน์พนักงานที่คาดว่าจะต้องจ่าย ณ วันเกษียณ` exactly (no proration), and is flagged `ลาออก` (resigned).
4. Confirm an employee below retirement age (e.g. `Somchai`) has a prorated `ผลประโยชน์ของพนักงานที่คาดว่าต้องจ่าย ณ วันสิ้นปีปัจจุบัน` — strictly less than their `ประมาณการหนี้สินผลประโยชน์พนักงานที่คาดว่าจะต้องจ่าย ณ วันเกษียณ` — matching `round(liability_at_retirement * years_to_present / years_to_retirement, 2)` by hand.
5. Confirm `ยอดยกมา`, `ต้นทุน`, `คชจ.บริหาร`, `คชจ.ขาย`, `อายุงาน (ปี/เดือน)`, and `อายุ (ปี/เดือน)` are blank in the output for every row (FR-013).
6. Re-run with a copy of the master file where one row's date of birth is cleared; confirm that row is absent from the benefit report and instead appears in the downloaded exception report under `missingRequiredField`.

## Expected artifacts per run

- `summary` in the API response, rendered in the page's Validation Summary panel.
- A downloadable final benefit workbook (`.xlsx`).
- A downloadable exception report (`.xlsx`), separate from the workbook.

## Out of scope for this quickstart

Formal actuarial review of the formula against HR/finance's expectations — in particular, confirming the reconstructed proration threshold (retirement age 60, standing in for the reference workbook's broken `$F$3` cell — `research.md` #10) and the treatment of daily-wage-scale values in `อัตราค่าแรง` (`research.md` #11) — is a business-side validation this quickstart's mechanical checks cannot confirm. Flag both to HR/finance, and confirm `backend/data/Employee_Master_Data.xlsx` has real dates of birth populated, before relying on this endpoint's output for a real filing.
