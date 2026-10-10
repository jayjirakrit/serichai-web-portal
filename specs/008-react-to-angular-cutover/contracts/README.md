# Contracts: not applicable

Feature 008 adds and changes no endpoint. The HTTP API between `frontend/` and `backend/` is unchanged (FR-016); the authoritative contracts remain in earlier specs:

- `specs/001-employee-benefit-calculation/contracts/benefits-api.md`, `specs/002-previous-benefit-carryforward/contracts/`
- `specs/003-payroll-reconcile/contracts/`, `specs/004-bonus-calculation/contracts/`, `specs/006-elderly-tax-deduction/contracts/`
- `specs/007-angular-frontend-migration/contracts/*-angular.md` (frontend usage, service names; they already cite post-cutover `frontend/src/app/...` paths, which become literally true after the move; some cited file names, e.g. `benefits.service.ts`, differ from the as-built `employee-benefits.service.ts`: historical, not edited)

Parity check: `POST /accounts/employee-benefits`, `/payroll-reconcile`, `/bonus-calculation`, `/tax-deduction` must respond identically before and after the move (quickstart step 7).
