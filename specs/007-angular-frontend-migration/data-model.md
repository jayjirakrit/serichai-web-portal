# Data Model: Angular Frontend Migration

No persistent storage and no backend model change (FR-017). Client-side types only. Wire types are camelCase and mirror the existing contracts (`contracts/*.md`); no translation layer.

## Shared (`src/app/shared/models/attachment.ts`)

| Type | Fields |
|---|---|
| `FileAttachment` | `filename: string`, `contentBase64: string` - one definition replacing the 4 copies in `frontend/src/services/*.ts` |

## Request state (`src/app/core/http/api-call.ts`)

`apiCall(fn)` exposes readonly signals `data` (`TRes | null`), `error` (`string | null`), `pending` (`boolean`), computed `status` (`'idle' | 'pending' | 'error' | 'success'`), plus `run(...args)` and `reset()`.

Transitions: `idle -> pending` on `run` (clears `data` and `error`); `pending -> success` on response; `pending -> error` on failure (message per research.md #2); `run` is a no-op while `pending`; `reset()` -> `idle`. Submit buttons are also `[disabled]` while pending (FR-004).

## Feature models (beside each feature service; ported verbatim from the current React services)

| File | Types |
|---|---|
| `features/employee-benefits/benefits.models.ts` | `ExceptionCategory`, `ExceptionEntry`, `CalculationSummary`, `CalculateBenefitsResponse` |
| `features/bonus-calculation/bonus.models.ts` | `BonusExceptionCategory`, `EmployeeBonusRecord`, `BonusCalculationSummary`, `CalculateBonusResponse` |
| `features/payroll-reconcile/payroll-reconcile.models.ts` | `ReconciliationStatus`, `ReconciliationEntry`, `ReconciliationSummary`, `ReconcilePayrollResponse` (`discrepancyReport: FileAttachment \| null`) |
| `features/tax-deduction/tax-deduction.models.ts` | `TaxDeductionEmployeeResult` (includes `disabled`), `TaxDeductionSummary`, `CalculateTaxDeductionResponse` |

Strict-mode note: `EmployeeBonusRecord` numeric fields stay `number | null`; templates guard nulls and render `-` (spec edge case), never cast.

## Page-local UI state (signals)

- File inputs: `File | null` per file; a cleared selection is `null` -> inline missing-input message, no request (FR-006).
- Payroll: `period` (`YYYY-MM`). Bonus: `year`, `tab: 'cal' | 'config'`. Tax: file only (`referenceDate` removed, FR-010).
- `features/tax-deduction/employee-status.ts`: pure `getEmployeeStatus(employee) -> { label, badgeClass }`, ported unchanged.
