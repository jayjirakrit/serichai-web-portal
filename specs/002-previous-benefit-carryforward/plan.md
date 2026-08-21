# Implementation Plan: Previous-Year Benefit Carry-Forward

**Branch**: `002-previous-benefit-carryforward` | **Date**: 2026-08-21 | **Spec**: [spec.md](./spec.md)

## Summary

Extend `POST /accounts/employee-benefits` with a second, optional multipart field, `previousBenefitsFile`. When supplied, its rows are keyed by normalized (trimmed, string-cast) `รหัสพนักงาน`; for each of this year's computed employees whose own normalized ID matches exactly one row in that file, `ยอดยกมา` is set to that row's `ผลประโยชน์ของพนักงานที่คาดว่าต้องจ่าย ณ วันสิ้นปีปัจจุบัน` value, copied unmodified. An ID duplicated within the previous-year file blocks carry-forward for every employee sharing it and is surfaced as a new exception category, `duplicateEmployeeId`, alongside the existing `missingRequiredField`. Everything else about `specs/001-employee-benefit-calculation`'s calculation (eligibility, formulas, resignation flagging, output shape) is untouched — this is purely an additive lookup layered on top of the existing pipeline.

## Technical Context

**Language/Version**: Python 3.13 (backend, existing `.venv`); TypeScript, React 19 (frontend) — both already established, no change.

**Primary Dependencies**: Same as `specs/001-employee-benefit-calculation`: backend FastAPI, pandas, numpy, openpyxl, pytest; frontend `@tanstack/react-query`, DaisyUI/Tailwind. No new dependency for either side.

**Storage**: N/A. Both files are processed in-memory for the duration of one request; the previous-year file is never persisted.

**Testing**: `pytest`, extending `backend/tests/test_calculate_benefits.py` with carry-forward cases (unique match, no match, duplicate ID, missing previous-file columns, omitted file). Frontend: no new test runner (per 001's precedent) — the added file input is validated manually via `quickstart.md`.

**Target Platform**: Web — same FastAPI dev server + Vite SPA, two local processes, no new deployment target.

**Performance Goals**: Negligible added cost — one extra O(n) file parse and a dict lookup per employee, at the same tens-to-low-hundreds row scale as the base feature; still comfortably inside one synchronous request.

**Constraints**: Same Thai-header/BE-date conventions as the base feature (`CLAUDE.md`). Matching is strict trimmed-string equality on employee ID only — no fuzzy or name-based fallback (FR-009). `ยอดยกมา` already exists in `Employee_Benefit_Template.xlsx`'s column shape and is currently always blank (`specs/001-employee-benefit-calculation` FR-013) — this feature populates it. **As implemented**, one output column *is* newly introduced: `รหัสพนักงาน`, required so this year's output can serve as a valid "previous file" input in future years (see `data-model.md`'s Amendment note) — narrowing the "no new output column" claim originally in this section.

**Scale/Scope**: Same internal HR tool, same employee-count scale as the base feature; adds one optional file per request, not a new workflow.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|---|---|---|
| I. Spec/Plan/Task Separation | PASS | `spec.md` stays business-language-only; this plan is the technical translation. |
| II. Monorepo Boundary Discipline | PASS | Frontend and backend still communicate only through the documented `POST /accounts/employee-benefits` contract (`contracts/benefits-api-carryforward.md`, a delta on `001`'s `benefits-api.md`); no cross-imports. |
| III. Tech Stack Standards | PASS | New field is a Pydantic-validated optional `UploadFile`; new exception category added to the existing camelCase `ExceptionCategory` literal in `backend/models/benefits.py` (still bridged via the alias generator, no hand-written aliases). Endpoint path is unchanged (still resource-named, no verb suffix). |
| IV. Quality Gates | PARTIAL (justified — same as 001) | Backend logic (`compute_carry_forward`, duplicate detection, ID normalization) gets `pytest` coverage. Frontend gets `tsc -b` + `eslint .` but no new automated UI test; see Complexity Tracking (carried over from `specs/001-employee-benefit-calculation/plan.md`, same rationale, not restated per Principle V). |
| V. Anti-Bloat Principle | PASS | No new router or service module — one existing endpoint gains one optional field and one lookup step. One output column (`รหัสพนักงาน`) is added, justified above (it's what makes carry-forward workable across years, not incidental scope growth). No new dependency (fuzzy-matching libraries explicitly rejected by FR-009). |

## Project Structure

### Documentation (this feature)

```text
specs/002-previous-benefit-carryforward/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md         # Phase 1 output
├── quickstart.md         # Phase 1 output
├── contracts/
│   └── benefits-api-carryforward.md   # Delta on 001's contracts/benefits-api.md
└── tasks.md              # Phase 2 output (/speckit-tasks — not created by this command)
```

### Source Code (repository root)

```text
backend/
├── routers/
│   └── accounts.py                 # + optional previousBenefitsFile: UploadFile | None = File(None)
├── services/
│   └── accounts_service.py         # + compute_carry_forward() (reads previous file, builds
│                                    #   normalized-ID lookup, detects duplicate-ID exceptions);
│                                    #   + _normalize_employee_id() helper; compute_benefit_rows()
│                                    #   gains a carry_forward_lookup param that sets ยอดยกมา;
│                                    #   calculate_benefits() wires the two together
├── models/
│   └── benefits.py                 # ExceptionCategory gains "duplicateEmployeeId"
└── tests/
    └── test_calculate_benefits.py  # + carry-forward cases (unique match, unmatched, duplicate
                                     #   ID, missing previous-file columns, file omitted)

frontend/
├── src/services/
│   └── benefitsService.ts          # calculateBenefits() gains an optional previousBenefitsFile
│                                    #   param, appended to the existing FormData when present;
│                                    #   ExceptionCategory type gains "duplicateEmployeeId"
├── src/pages/
│   └── EmployeeBenefits.tsx        # + second, optional file input ("Previous Employee Benefits")
│                                    #   alongside the existing master-file input
```

**Structure Decision**: Option 2 (web application), unchanged from `specs/001-employee-benefit-calculation` — this feature adds no new top-level directory, router, service module, or frontend page. Every change is additive within the existing `backend/routers → backend/services` and `frontend/src/pages` + `frontend/src/services` files established by the base feature.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No new violations beyond the one already justified in `specs/001-employee-benefit-calculation/plan.md` (no automated frontend test runner) — see that plan's Complexity Tracking table; not restated here per Principle V (Anti-Bloat).
