# Implementation Plan: Employee Benefit Calculation

**Branch**: `001-employee-benefit-calculation` | **Date**: 2026-08-19 (revised) | **Spec**: [spec.md](./spec.md)

## Summary

Compute the annual employee-benefit liability directly from the employee master data file: for each employee who has reached the eligibility age (35) by the benefit-year-end reference date and has a populated date of birth, start date, and wage rate, compute retirement date, current age, service-year figures, projected salary at retirement, severance entitlement, survival probability, and estimated liability (at retirement and at the current year-end) using the formula reverse-engineered from `Employee_Benefit_Sample.xlsx` (`research.md` #6-7). Flag resigned employees. Produce a final benefit workbook (in `Employee_Benefit_Template.xlsx`'s column shape) plus a standalone exception report. Implemented as one backend endpoint, `POST /accounts/employee-benefits`, accepting the master file alone and returning a JSON summary (camelCase fields, per the repo-wide API convention) plus both output files inline as base64.

This plan supersedes an earlier version that matched a payroll file and a previous-year benefit file against the master data and carried liability figures forward verbatim rather than computing them (see `spec.md`'s "Design history" and `research.md`'s "Superseded decisions").

## Technical Context

**Language/Version**: Python 3.13 (backend, existing `.venv`); TypeScript, React 19 (frontend) — both already established, no change.

**Primary Dependencies**: Backend: FastAPI, pandas, numpy, openpyxl, pytest (all in `requirements.txt`). Frontend: existing `@tanstack/react-query`, DaisyUI/Tailwind — no new package needed.

**Storage**: N/A. Stateless request/response; the uploaded master file is processed in-memory and never written to `backend/data/`.

**Testing**: `pytest` for backend business logic (the formula, bracket-table lookups, eligibility, resignation, BE-date handling, the missing-required-field exception path) — see `backend/tests/test_calculate_benefits.py` and `backend/tests/test_be_dates.py`. Frontend: no new test runner; the upload → submit → review flow is validated manually via `quickstart.md`.

**Target Platform**: Web — FastAPI dev server (`uvicorn`) + Vite SPA, run as two local processes exactly as `CLAUDE.md` describes; no new deployment target.

**Performance Goals**: Server-side processing of a few hundred employee rows completes in well under 1 second, comfortably inside one synchronous request.

**Constraints**: Input/output files are Excel workbooks with Thai column headers and Buddhist Era (BE) year dates — this convention must be preserved end-to-end (`CLAUDE.md`). No auth/session layer exists yet (unchanged, out of scope). Single synchronous request/response per calculation run — no background job infrastructure. The reconstructed proration threshold (retirement age, standing in for the reference workbook's broken `$F$3` cell) and the wage-rate scale ambiguity are open business-side questions, not fully confirmed with HR/finance (`research.md` #7-8).

**Scale/Scope**: Internal HR tool, one organization, employee counts in the tens-to-low-hundreds range. No pagination or streaming needed at this scale.

## Constitution Check

| Principle | Status | Notes |
|---|---|---|
| I. Spec/Plan/Task Separation | PASS | This plan stays technical; `spec.md` remains business-language-only. |
| II. Monorepo Boundary Discipline | PASS | Frontend and backend communicate only through the documented `POST /accounts/employee-benefits` contract (`contracts/benefits-api.md`); no cross-imports. |
| III. Tech Stack Standards | PASS | Backend: FastAPI + Pydantic models (`backend/models/benefits.py`) for the response shape, typed throughout, camelCase wire format via an alias generator, no `Depends` needed (no DB/auth for this endpoint). Frontend: the calculate call is a TanStack Query `useMutation`; DaisyUI components reused from the existing page. |
| IV. Quality Gates | PARTIAL (justified) | Backend business logic gets `pytest` unit tests; `tsc -b` and `eslint .` gate the frontend change. The frontend flow itself is validated manually, not with a new test runner — see Complexity Tracking. |
| V. Anti-Bloat Principle | PASS | No job queue, token store, or temp-file cleanup layer; no fuzzy-matching dependency, no ID-matching machinery (removed along with the payroll/previous-file inputs); exception report reuses the domain's existing Excel-native format. |

## Project Structure

### Documentation (this feature)

```text
specs/001-employee-benefit-calculation/
├── plan.md              # This file
├── research.md          # Decisions + rationale (includes superseded pre-pivot decisions for history)
├── data-model.md
├── quickstart.md
├── contracts/
│   └── benefits-api.md
└── tasks.md
```

### Source Code (repository root)

```text
backend/
├── routers/
│   └── accounts.py                 # POST /accounts/employee-benefits — single masterFile field
├── services/
│   └── accounts_service.py         # compute_benefit_rows() + calculate_benefits() orchestrator,
│                                    #   the two formula helpers (_datedif_years, _bracket_lookup),
│                                    #   and the bracket-table/rate constants (research.md #6)
├── models/
│   └── benefits.py                 # ExceptionEntry, CalculationSummary, FileAttachment,
│                                    #   CalculateBenefitsResponse (camelCase aliases)
├── util/
│   └── be_dates.py                 # benefit_year_end_date(), retirement_date()
└── data/
    └── Employee_Benefit_Template.xlsx   # loaded via openpyxl at request time as the output
                                          #   workbook's base file (build_output_workbook)

frontend/
├── src/pages/
│   └── EmployeeBenefits.tsx        # single master-file input, useMutation submit, summary/exceptions, two downloads
├── src/services/
│   └── benefitsService.ts          # calculateBenefits(masterFile) fetch wrapper

sample-data/
└── master.xlsx                     # 7-employee sample with real dates of birth, used for frontend testing
                                     #   (backend/data/Employee_Master_Data.xlsx has none populated yet — research.md)
```

**Structure Decision**: Option 2 (web application) — reuses the existing `backend/routers → backend/services` layering and the existing `frontend/src/pages` + `frontend/src/services` split described in `CLAUDE.md`; no new top-level directories. `backend/services/accounts_service_mock.py` was the throwaway draft this implementation's vectorized-pandas style is modeled on; it is not imported by the app.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| No automated frontend test for the upload/review flow (Principle IV normally requires tests for "critical frontend user flows") | `frontend/` has no test runner configured today (`CLAUDE.md`); adding one is a repo-wide tooling decision, not something this single feature should force through | Introducing Vitest + React Testing Library just for this one page was rejected as disproportionate scope creep; the flow is thin orchestration (upload → one POST → render its response) with no independent logic worth unit-testing, and it is covered by manual verification in `quickstart.md` and a live browser check instead |
