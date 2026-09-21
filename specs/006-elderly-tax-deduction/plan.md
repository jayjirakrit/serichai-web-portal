# Implementation Plan: Elderly-Employee Tax Deduction Service

**Branch**: `006-elderly-tax-deduction` | **Date**: 2026-09-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/006-elderly-tax-deduction/spec.md`

## Summary

Add one endpoint, `POST /accounts/tax-deduction`, to the existing `/accounts` router (`backend/routers/accounts.py`), delegating to a new `backend/services/tax_deduction_service.py`, implementing Thailand's Royal Decree No. 639 (B.E. 2560) elderly-employee wage-deduction calculation: the pipeline reads the uploaded payroll workbook's `ข้อมูลพนักงาน` roster sheet, corrects Buddhist-Era-mislabeled dates of birth, computes each employee's age and average monthly net salary (wage + OT, bonus excluded, averaged over populated months only), determines eligibility (age > 60 AND salary <= 15,000), ranks and caps eligible employees at 10% of total headcount, and computes capped per-month deductible amounts for selected employees. In one response, the endpoint returns a run summary (including the rule constants applied), the full per-employee breakdown for on-screen review (sorted by total deduction descending), and a generated report as a base64 `FileAttachment` — the same "summary + records + embedded report" JSON envelope shape already used by `bonus-calculation` and `payroll-reconcile`, rather than a separate binary-download or rules-lookup endpoint. The report is built from a static company template (`backend/data/Tax_Reduction_Template.xlsx`, research.md #6 revised) filled in with each employee's row, matching `accounts_service.py`/`bonus_service.py`'s static-template convention — it is a generated document, not a copy of the uploaded file. A new app-level `GET /health` liveness probe is added alongside it, unrelated to this consolidation. A new `frontend/src/services/taxDeductionService.ts` rewires the already-scaffolded `frontend/src/pages/TaxDeduction.tsx` (currently a stale copy wired to the benefits endpoint) onto this endpoint, following the upload/on-screen-summary/download pattern already established by `EmployeeBenefits.tsx`/`PayrollReconcile.tsx`.

## Technical Context

**Language/Version**: Python 3.13 (backend, existing `.venv`); TypeScript, React 19 (frontend) — both already established, no change.

**Primary Dependencies**: Backend: FastAPI, `pandas`, `numpy`, `openpyxl` (all already in `requirements.txt`), `pytest`. Parsing follows the vectorized `pd.read_excel(header=None) → resolve columns → vectorized pandas/numpy pipeline` idiom already shared by `accounts_service.py` and `bonus_service.py` (`research.md` #1) — no new dependency. Frontend: `@tanstack/react-query`, DaisyUI/Tailwind — no new dependency.

**Storage**: N/A. The uploaded file is processed in-memory for one request and never persisted (spec.md: stateless per-run, no persistence of past calculation runs).

**Testing**: `pytest`, new `backend/tests/test_tax_deduction.py` covering: the รวม/bonus-column parsing rule for March/December (`research.md` #2), the BE-year DOB correction (`research.md` #4), partial-year averaging (`research.md` #5), the three eligible/selected/not-eligible output states (FR-007, FR-014), the headcount-cap-rounds-to-zero edge case, tie-breaking by `ลำดับ`, and malformed-upload rejection (missing sheet / missing column). Frontend: no automated test runner exists repo-wide (per `CLAUDE.md`); validated manually via `quickstart.md`, consistent with `specs/001`–`003`.

**Target Platform**: Web — same FastAPI dev server + Vite SPA, two local processes, no new deployment target.

**Performance Goals**: Process a 150+ employee roster (spec SC-002) well within a single synchronous request — same order of magnitude as the existing benefits/bonus calculations, no async/background job needed.

**Constraints**: The roster sheet's 12 month blocks must be located by scanning for `รวม` occurrences positionally, not by fixed column letters, because March's and December's blocks have an extra `โบนัส` column before `รวม` that must be excluded from the deduction-relevant monthly figure (`research.md` #2 — the single most bug-prone part of this feature). The output report is filled into a static `TEMPLATE_PATH` template loaded from `backend/data/Tax_Reduction_Template.xlsx` (`research.md` #6, revised — matching `accounts_service.py`/`bonus_service.py`'s static-template convention rather than filling the uploaded workbook in place), then base64-encoded into the response body (`research.md` #7, revised) rather than streamed as a raw binary download; the uploaded roster is never echoed back into the report. Every business-rule constant (age threshold, salary cap, headcount percentage, BE offset, rounding rule) is defined once in `tax_deduction_service.py` and echoed back in every response's summary (FR-010, FR-012) — there is no separate rules-lookup endpoint to keep in sync.

**Scale/Scope**: One new endpoint on the existing `/accounts` router + one new service + one new models file, one new root-level `/health` endpoint (unrelated, see `research.md` #11), and one frontend page rewire (file already scaffolded, currently wired to the wrong backend endpoint) + one new frontend service module.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design — see note below.*

| Principle | Status | Notes |
|---|---|---|
| I. Spec/Plan/Task Separation | PASS | `spec.md` stays business-language-only; this plan is the technical translation. The original feature description's suggested paths (`/api/v1/tax-deduction/calculate`, `/calculate-json`) and status code (422 for all rejections) are technical details from the raw Input text, not requirements re-stated in `spec.md`'s FRs — this plan is free to (and does) choose different, constitution-compliant technical choices; see Principle III below. |
| II. Monorepo Boundary Discipline | PASS | Frontend and backend communicate only through the four documented endpoints (`contracts/*.md`); no cross-imports. |
| III. Tech Stack Standards | **Resolved during design — see note** | New Pydantic models in `backend/models/tax_deduction.py` use the shared `CamelModel` (`backend/models/common.py`). The endpoint is kebab-case, resource-named, under the existing `/accounts` prefix: `POST /accounts/tax-deduction` — **not** the originally-suggested `/api/v1/tax-deduction/calculate` / `/calculate-json` / `/rules`, which would have violated both the no-verb-suffix rule this same principle states explicitly and this repo's one-endpoint-per-resource-action precedent (`research.md` #7, #8, revised). It returns one JSON envelope (`summary` + `employees` + a base64 `taxDeductionReport` `FileAttachment`), matching `CalculateBonusResponse`/`ReconcilePayrollResponse` exactly, rather than splitting the workbook/JSON/rules concerns across three endpoints. `GET /health` is added at the app level (`backend/main.py`), outside `/accounts`, since it isn't an accounts-domain resource. `accounts.py` delegates to a new `tax_deduction_service.py` — a fourth independently-owned service behind the same router, following `003`'s precedent of adding a service rather than a router file. |
| IV. Quality Gates | PARTIAL (justified — same as 001/002/003) | Backend calculation, BE-date correction, cap/tie-break logic, and malformed-upload handling get `pytest` coverage. Frontend gets `tsc -b` + `eslint .` but no new automated UI test — no test runner is configured repo-wide; see Complexity Tracking. |
| V. Anti-Bloat Principle | PASS | One endpoint on the existing `/accounts` router (no new router file), one new service, reuses `CamelModel`/`FileAttachment` from `backend/models/common.py` (the same envelope shape as `bonus_service.py`/`payroll_reconcile_service.py`, no bespoke response shape), reuses/extends `backend/util/be_dates.py` rather than duplicating date-math helpers. `GET /health` is a single dict literal, not a new module. |

**Post-Phase-1 re-check**: No new violations surfaced during data-model/contract design. The one apparent Principle III conflict (endpoint paths and count in the original feature description) was resolved during Phase 0 (`research.md` #7, #8) by choosing a single constitution-compliant, precedent-matching endpoint before any contract was written, rather than deferred to Complexity Tracking as an accepted violation — there is no outstanding gate failure. (Revision note: an earlier draft of this plan split the workbook/JSON/rules concerns into three endpoints; consolidated back to one per explicit direction to match the `bonus-calculation`/`payroll-reconcile` envelope pattern exactly — see `research.md` #7.)

## API Contracts

- `POST /accounts/tax-deduction` — see `contracts/tax-deduction-api.md`
- `GET /health` — see `contracts/health-api.md`

## Project Structure

### Documentation (this feature)

```text
specs/006-elderly-tax-deduction/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   ├── tax-deduction-api.md
│   └── health-api.md
└── tasks.md              # Phase 2 output (/speckit-tasks — not created by this command)
```

### Source Code (repository root)

```text
backend/
├── main.py                              # MODIFIED: + GET /health
├── routers/
│   └── accounts.py                      # MODIFIED: + POST /tax-deduction (payrollFile, optional
│                                         #   referenceDate), delegating to
│                                         #   services.tax_deduction_service
├── services/
│   └── tax_deduction_service.py        # NEW: module constants (AGE_THRESHOLD, SALARY_CAP,
│                                         #   HEADCOUNT_CAP_PERCENT, HEADCOUNT_CAP_ROUNDING,
│                                         #   BE_YEAR_OFFSET) + roster/output sheet parsing
│                                         #   (รวม-scan with bonus-column exclusion), eligibility/
│                                         #   ranking/cap pipeline, workbook fill-in-place, and the
│                                         #   shared TaxDeductionRequestError (→ HTTPException 400,
│                                         #   mirroring BenefitsRequestError/BonusRequestError/
│                                         #   PayrollReconcileRequestError)
├── models/
│   └── tax_deduction.py                 # NEW: TaxDeductionSummary (includes the applied rule
│                                         #   constants), TaxDeductionEmployeeResult,
│                                         #   CalculateTaxDeductionResponse (summary + employees +
│                                         #   taxDeductionReport: FileAttachment)
│                                         #   (import CamelModel, FileAttachment from models/common.py)
├── util/
│   └── be_dates.py                      # MODIFIED: + correct_be_year(dob, reference_date)
└── tests/
    └── test_tax_deduction.py            # NEW

frontend/
├── src/services/
│   └── taxDeductionService.ts           # NEW: calculateTaxDeduction(), checkHealth()
├── src/pages/
│   └── TaxDeduction.tsx                 # MODIFIED: rewired from the stale benefitsService wiring
│                                         #   (already scaffolded, untracked) onto taxDeductionService;
│                                         #   renders the results table from the response and offers
│                                         #   the embedded report as a download, modeled on
│                                         #   EmployeeBenefits.tsx's / PayrollReconcile.tsx's layout
└── src/App.tsx                          # No change — the `/tax-deduction` route already exists
```

**Structure Decision**: Option 2 (web application), unchanged from prior features. This feature adds one endpoint to the existing `/accounts` router plus one unrelated root-level `/health` endpoint (rather than a new router file), backed by one new, separately-owned service module, plus one new frontend service module and a rewire of an already-scaffolded page — no new top-level directory.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No new violations beyond the one already justified in `specs/001-employee-benefit-calculation/plan.md` (no automated frontend test runner) — see that plan's Complexity Tracking table; not restated here per Principle V (Anti-Bloat).
