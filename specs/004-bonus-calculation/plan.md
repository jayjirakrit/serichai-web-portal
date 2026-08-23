# Implementation Plan: Bonus Calculation

**Branch**: `004-bonus-calculation` | **Date**: 2026-08-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-bonus-calculation/spec.md`

## Summary

Add one endpoint to the existing `/accounts` router (`backend/routers/accounts.py`, delegating to a new `backend/services/bonus_service.py`) that ports the legacy `Chopaisarn_Bonus_Macro_V3.xlsm` macro's scoring logic into an on-demand HTTP flow: `POST /accounts/bonus-calculation` scores every employee in the uploaded current-year data (evaluation, working-days/OT, leave) against fixed rule tables mirrored from the macro, joins in their previous-year grade/bonus for comparison, and returns a summary, the flagged-employee subset (for on-screen review — mirrors `specs/003`'s `discrepancies` shape, spec Clarifications 2026-08-23 (3)), and a downloadable `.xlsx` report with every employee's full detail in the same response — matching the legacy output's own column layout, so the tool's own output can feed next year's run the same way the legacy macro's did. Per spec Clarifications (2026-08-23 (2)), the report itself carries a blank per-employee approved-day cell and a live formula that computes the final bonus the moment the user fills it in *within the file* — finalization is not an in-app step, so there is no second endpoint and no client-held run state. A `frontend/src/pages/BonusCalculation.tsx` Calculation tab (replacing its current non-functional scaffold) drives the one call; its Configuration tab stays a visual placeholder, since editable scoring rules are out of scope for v1 (spec.md Assumptions).

## Technical Context

**Language/Version**: Python 3.13 (backend, existing `.venv`); TypeScript, React 19 (frontend) — both already established, no change.

**Primary Dependencies**: Backend: FastAPI, `pandas`, `numpy`, `openpyxl` (already in `requirements.txt`), `pytest`. Ingestion follows `accounts_service.py`/`payroll_reconcile_service.py`'s vectorized `pandas`/`numpy` idiom (`research.md` #2), simplified relative to `payroll_reconcile_service.py` since this feature's source sheets are flat one-row-per-employee (no department-header rows to detect). Frontend: `@tanstack/react-query`, DaisyUI/Tailwind — no new dependency.

**Storage**: N/A. Both uploaded files, and the computed results, are processed and returned within one request — no backend persistence and no client-held run state to reconcile later (`research.md` #1). The only thing that outlives the request is the downloaded report file itself, on the user's machine.

**Testing**: `pytest`, new `backend/tests/test_bonus_calculation.py` covering: a full successful run, the two blocking-vs-non-blocking exception paths (`evaluationNotFound`/`otCategoryUnrecognized`/`duplicateName`/`workingDayDataInvalid` block `totalScore`; `leaveNotFound`/`previousBonusNotFound` don't, `research.md` #8), a negative-total-score employee floored only at the provisional-days step, each of the three OT rule tables, the generated report's approved-days-cell-blank/final-bonus-formula structure (`research.md` #10), and — per spec Clarifications (2026-08-23 (2)) and SC-003 — a correctness check against `สรุปโบนัส_68.xlsx`'s real `ผลสรุปโบนัสปี_67` sheet as known-correct reference data (`research.md` #11). Frontend: no automated test runner exists repo-wide; validated manually via `quickstart.md`.

**Target Platform**: Web — same FastAPI dev server + Vite SPA, two local processes, no new deployment target.

**Performance Goals**: Process a full yearly headcount (spec SC-001: "a few hundred employees," under 3 minutes end-to-end) within one synchronous request — same order of magnitude as `payroll_reconcile_service.py`'s 1,000-row / 30-second goal, comfortably met by the vectorized pipeline.

**Constraints**: Sheet names embed a two-digit Buddhist Era year suffix the same way `Employee_Benefit_Template.xlsx`/`payroll_reconcile_service.py` do; the frontend collects a plain Gregorian year and the backend derives both the current and previous BE suffixes (`research.md` #5). The previous-year summary file's "previous grade"/"previous bonus" columns (11 and 29) are that file's *own* current-year results, not a separately-labeled comparison field — confirmed against the real `สรุปโบนัส_68.xlsx` (`research.md` #4), which also fixes this feature's own report layout so it can serve as next year's previous-year-summary input.

**Scale/Scope**: One new endpoint on the existing `/accounts` router + one new service + one new models file, and the existing `BonusCalculation.tsx` scaffold's Calculation tab wired to real data; no changes to Employee Benefits or Payroll Reconciliation.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|---|---|---|
| I. Spec/Plan/Task Separation | PASS | `spec.md` stays business-language-only; this plan and `research.md`/`data-model.md` carry the technical translation, including the decompiled-VBA business logic. |
| II. Monorepo Boundary Discipline | PASS | Frontend and backend communicate only through `contracts/bonus-calculation-api.md`; no cross-imports. |
| III. Tech Stack Standards | PASS | New Pydantic models in `backend/models/bonus.py` use the shared `CamelModel` alias generator (`backend/models/common.py`, same as `benefits.py`/`payroll.py`). The endpoint path (`/accounts/bonus-calculation`) is kebab-case, resource-named, under the existing `/accounts` prefix. `accounts.py` delegates to a new `services.bonus_service` — a third, independently-owned service behind one router, the same pattern `specs/003` established for `payroll_reconcile_service.py` alongside `accounts_service.py`. Frontend consumes it via one `useMutation` in a new `bonusService.ts`, no ad-hoc `fetch` in the page component. |
| IV. Quality Gates | PARTIAL (justified — same as 001/002/003) | Backend scoring, rule-table selection, exception blocking/non-blocking behavior, and the generated report's formula structure get `pytest` coverage. Frontend gets `tsc -b` + `eslint .` but no new automated UI test — no test runner is configured repo-wide; see Complexity Tracking. |
| V. Anti-Bloat Principle | PASS | One endpoint on the existing router, one new service, one new models file, one page wired up (no new page, no new router file, no second endpoint/model pair for a finalization step that turned out to live entirely in the spreadsheet, `research.md` #1). Rule tables live inline in `bonus_service.py` rather than a new config-loading layer, since v1's rules are fixed by spec.md's explicit deferral of the Configuration tab. |

## API Contracts

- `POST /accounts/bonus-calculation` — see `contracts/bonus-calculation-api.md`

## Project Structure

### Documentation (this feature)

```text
specs/004-bonus-calculation/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── bonus-calculation-api.md
└── tasks.md              # Phase 2 output (/speckit-tasks — not created by this command)
```

### Source Code (repository root)

```text
backend/
├── routers/
│   └── accounts.py                # MODIFIED: + POST /bonus-calculation (currentYearFile,
│                                   #   previousYearSummaryFile, year multipart fields),
│                                   #   delegating to services.bonus_service
├── services/
│   └── bonus_service.py           # NEW: calculate_bonus() — vectorized pandas/numpy pipeline
│                                   #   (sheet lookup, name-based joins across the 4 sources,
│                                   #   fixed rule-table lookups, blocking/non-blocking
│                                   #   exception logic per research.md #8) scores every
│                                   #   employee internally, but the wire response's
│                                   #   flaggedEmployees exposes only the exception subset
│                                   #   (spec Clarifications 2026-08-23 (3)); the service also
│                                   #   builds the 31-column openpyxl report workbook, every
│                                   #   employee, mirroring the legacy output layout
│                                   #   (research.md #9), with a blank approved-days cell and a
│                                   #   live final-bonus formula per row instead of a
│                                   #   precomputed value (research.md #10)
├── models/
│   └── bonus.py                   # NEW: BonusExceptionCategory, EmployeeBonusRecord,
│                                   #   BonusCalculationSummary, CalculateBonusResponse
└── tests/
    └── test_bonus_calculation.py  # NEW — includes a correctness check against
                                    #   สรุปโบนัส_68.xlsx's real ผลสรุปโบนัสปี_67 sheet
                                    #   as reference data (research.md #11)

frontend/
├── src/services/
│   └── bonusService.ts            # NEW: calculateBonus(...) only — no client-side
│                                   #   finalization helper, finalization lives in the
│                                   #   downloaded file's own formula (research.md #1, #10)
└── src/pages/
    └── BonusCalculation.tsx       # MODIFIED: Calculation tab wired to bonusService via one
                                    #   useMutation — on success, renders the summary counts
                                    #   plus a flagged-employees list (name + exception note,
                                    #   PayrollReconcile.tsx's discrepancies-list pattern) and
                                    #   offers the report for immediate download; Configuration
                                    #   tab left as the existing visual placeholder (out of
                                    #   scope, spec.md Assumptions)
```

**Structure Decision**: Option 2 (web application), unchanged from `specs/001`/`specs/003`. One new endpoint on the existing `/accounts` router (rather than a new router file), one new service module, one new models file, and one existing page wired up — no new top-level directory.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No new violations beyond the one already justified in `specs/001-employee-benefit-calculation/plan.md` (no automated frontend test runner) — see that plan's Complexity Tracking table; not restated here per Principle V (Anti-Bloat).
