# Implementation Plan: Payroll Reconciliation

**Branch**: `003-payroll-reconcile` | **Date**: 2026-08-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-payroll-reconcile/spec.md`

## Summary

Add `POST /accounts/payroll-reconcile` to the existing `/accounts` router (`backend/routers/accounts.py`, delegating to a new `backend/services/payroll_reconcile_service.py`) that ports the wage-recalculation and comparison logic of `chpaisarn-payroll-reconcile-batch` (Java, `CalculationReconcileService`) into an on-demand HTTP endpoint. A user uploads the payroll working file plus the pay period to check; the service locates that period's sheet, re-derives each employee's net wage from their recorded attendance using the same department-specific formulas as the legacy batch (office staff vs. metal-shop/sewing-shop/contract staff), and flags any employee whose stated net wage doesn't match. Results are returned as a JSON summary + discrepancy list plus two downloadable Excel reports — no email step, matching the on-screen-and-download pattern already established by `EmployeeBenefits.tsx`. A new `frontend/src/pages/PayrollReconcile.tsx`, modeled directly on that page's layout, drives it.

## Technical Context

**Language/Version**: Python 3.13 (backend, existing `.venv`); TypeScript, React 19 (frontend) — both already established, no change.

**Primary Dependencies**: Backend: FastAPI, `pandas`, `numpy`, `openpyxl` (all already in `requirements.txt`), `pytest`. Parsing and recalculation follow the same vectorized pipeline style already established by `accounts_service.py` (`pd.read_excel(header=None)` → locate the header row by scanning for a marker cell → build a typed `DataFrame` → vectorized `pandas`/`numpy` arithmetic, bracket lookups, and `np.where` branching) rather than manual per-cell/per-row iteration, so the two Excel-ingestion features in this backend share one idiom (see `research.md`). Frontend: `@tanstack/react-query`, DaisyUI/Tailwind — no new dependency.

**Storage**: N/A. The uploaded file is processed in-memory for the duration of one request and never persisted, matching spec.md's "read-only, no write-back" assumption.

**Testing**: `pytest`, new `backend/tests/test_payroll_reconcile.py` following the fixture-workbook pattern of `test_calculate_benefits.py` — covering all-matched, a discrepancy in an office-formula department, a discrepancy in a factory/contract-formula department, an unrecognized department section, a missing/absent period sheet, and a malformed header. Frontend: no automated test runner exists repo-wide (per `CLAUDE.md`); validated manually via `quickstart.md`, consistent with `specs/001` and `specs/002`.

**Target Platform**: Web — same FastAPI dev server + Vite SPA, two local processes, no new deployment target, no SMTP/email dependency (the legacy batch's email step is explicitly out of scope per spec.md Assumptions).

**Performance Goals**: Process on the order of 1,000 employee records (spec SC-004) within 30 seconds inside one synchronous request — same order of magnitude as the existing benefits calculation, no async/background job needed.

**Constraints**: The uploaded file's pay-period sheets are named using the legacy batch's exact convention, `ประจำ {M-yy}` with a **Buddhist Era** two-digit year (BE = Gregorian year + 543, e.g. `ประจำ 8-69` for August 2026) — confirmed against real finance workbooks (`research.md` #3); this is the same BE convention `Employee_Benefit_Template.xlsx` uses, just applied to a sheet-name token instead of column headers. Department classification is fixed to the same four Thai category names as `PayrollReconcileConstant.DEPARTMENT_LIST` in the legacy batch; an unrecognized name is a per-row exception, not a config option (spec Assumptions), and section boundaries are detected structurally (a blank employee-name cell marks a department-header row) rather than by matching those four names, so an unrecognized department still opens its own section instead of being silently merged into the preceding one (`research.md` #2, FR-013). Wage-mismatch comparison must reproduce Java's `RoundingMode.HALF_UP` exactly; `pandas`/`numpy`'s default rounding is round-half-to-even, so the vectorized comparison needs an explicit half-up helper rather than a bare `.round(2)` (`research.md` #4a).

**Scale/Scope**: One new endpoint (on the existing `/accounts` router) + service + models, and one new frontend page; no changes to the existing Employee Benefits feature beyond extracting two already-duplicated model classes into a shared module (see Project Structure).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|---|---|---|
| I. Spec/Plan/Task Separation | PASS | `spec.md` stays business-language-only; this plan is the technical translation. |
| II. Monorepo Boundary Discipline | PASS | Frontend and backend communicate only through the documented `POST /accounts/payroll-reconcile` contract (`contracts/payroll-reconciliation-api.md`); no cross-imports. |
| III. Tech Stack Standards | PASS | New Pydantic models in `backend/models/payroll.py` use the same camelCase `alias_generator` pattern as `benefits.py` (via a shared `CamelModel` base, see below). Endpoint path `POST /accounts/payroll-reconcile` is kebab-case under the existing `/accounts` prefix. `accounts.py` delegates this endpoint to `services.payroll_reconcile_service` rather than `accounts_service` — a deliberate one-router/two-services split, since payroll reconciliation is unrelated business logic to the benefits calculation `accounts_service.py` already holds; grouping under `/accounts` is a routing/prefix choice (explicit direction), not a claim that the two share logic. Frontend consumes it via a `useMutation` in a new `payrollReconcileService.ts`, no ad-hoc `fetch` in the page component. |
| IV. Quality Gates | PARTIAL (justified — same as 001/002) | Backend recalculation, discrepancy detection, and unrecognized-department/data-error handling get `pytest` coverage. Frontend gets `tsc -b` + `eslint .` but no new automated UI test — no test runner is configured repo-wide; see Complexity Tracking. |
| V. Anti-Bloat Principle | PASS | One new endpoint on the existing `/accounts` router, one new service, one new page — no new router file, no framework beyond what already exists. `CamelModel` and `FileAttachment` are extracted from `backend/models/benefits.py` into `backend/models/common.py` and reused by `payroll.py`, *reducing* duplication rather than adding it. |

## API Contracts

- `POST /accounts/payroll-reconcile` — see `contracts/payroll-reconciliation-api.md`

## Project Structure

### Documentation (this feature)

```text
specs/003-payroll-reconcile/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── payroll-reconciliation-api.md
└── tasks.md              # Phase 2 output (/speckit-tasks — not created by this command)
```

### Source Code (repository root)

```text
backend/
├── routers/
│   └── accounts.py                      # MODIFIED: + POST /payroll-reconcile (payrollFile,
│                                         #   period multipart fields), delegating to
│                                         #   services.payroll_reconcile_service.reconcile_payroll()
├── services/
│   └── payroll_reconcile_service.py    # NEW: reconcile_payroll() — pandas/numpy vectorized
│                                         #   pipeline (sheet lookup, header/department-section
│                                         #   detection, attendance+overtime row pairing, per-
│                                         #   department wage formulas, half-up-rounded discrepancy
│                                         #   comparison, full + discrepancy-only report generation),
│                                         #   mirroring accounts_service.py's pipeline style
├── models/
│   ├── common.py                        # NEW: CamelModel + FileAttachment, extracted from benefits.py
│   ├── benefits.py                      # MODIFIED: import CamelModel/FileAttachment from common.py
│   │                                     #   instead of defining them locally (no behavior change)
│   └── payroll.py                       # NEW: ReconciliationEntry, ReconciliationSummary,
│                                         #   ReconcilePayrollResponse
└── tests/
    └── test_payroll_reconcile.py        # NEW

frontend/
├── src/services/
│   └── payrollReconcileService.ts       # NEW: reconcilePayroll(payrollFile, period)
├── src/pages/
│   └── PayrollReconcile.tsx             # NEW: modeled on EmployeeBenefits.tsx — file input +
│                                         #   period input, useMutation, summary/discrepancy panel,
│                                         #   two report download buttons
└── src/App.tsx                          # MODIFIED: + route for PayrollReconcile
```

**Structure Decision**: Option 2 (web application), unchanged from `specs/001-employee-benefit-calculation`. This feature adds one new endpoint to the existing `/accounts` router (rather than a new router file), backed by a new, separately-owned service module, plus one new frontend page — no new top-level directory and no change to how `/frontend` and `/backend` run or communicate.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No new violations beyond the one already justified in `specs/001-employee-benefit-calculation/plan.md` (no automated frontend test runner) — see that plan's Complexity Tracking table; not restated here per Principle V (Anti-Bloat).
