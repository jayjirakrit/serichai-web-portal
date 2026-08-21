# Research: Previous-Year Benefit Carry-Forward

No `NEEDS CLARIFICATION` markers — the spec's Edge Cases and Assumptions sections already resolve the open questions a normal Phase 0 pass would raise. This records the resulting technical decisions.

## 1. Employee ID normalization

**Decision**: Normalize every employee ID (both files) through one helper: `NaN`/blank → `None`; a whole-number float (how pandas/openpyxl represents a numeric Excel cell, e.g. `1002.0`) → `str(int(value))`; anything else → `str(value).strip()`, empty-after-strip → `None`.

**Rationale**: FR-009 requires `1002` (numeric) and `"1002"` (text) to match, and stray whitespace to be ignored. Excel numeric cells arrive from `pandas`/`openpyxl` as `float64`, so a naive `str()` would produce `"1002.0"` and never match the text-file counterpart `"1002"` — the float-to-int-string step is what makes the two representations converge. Centralizing this in one helper (rather than inlining it at each call site) means master-file IDs and previous-file IDs are guaranteed to normalize identically.

**Alternatives considered**: Fuzzy/partial matching — explicitly rejected by FR-009. Pandas' own type coercion (`astype(str)`) — rejected because it doesn't collapse the `1002.0` vs `1002` case, which is exactly the scenario the spec's Edge Cases section calls out.

## 2. Where carry-forward plugs into the existing pipeline

**Decision**: A new, independent function, `compute_carry_forward(previous_content, previous_filename) -> (lookup, duplicate_exceptions)`, runs before `compute_benefit_rows`. It returns `({}, [])` when no previous file is supplied. `compute_benefit_rows` gains one new parameter, `carry_forward_lookup: dict`, used only to set `ยอดยกมา` on each output row; nothing else in that function's logic changes. `calculate_benefits` (the orchestrator) merges `duplicate_exceptions` into the existing `exceptions` list before building the exception report.

**Rationale**: Matches FR-010 (strictly additive, no change to eligibility/formula/resignation logic) and keeps `compute_benefit_rows` — the part of `accounts_service.py` with the most existing logic and test coverage — nearly untouched, lowering regression risk. It also mirrors the base feature's own separation of "read + validate a file" from "compute the output rows."

**Alternatives considered**: Merging the previous-year DataFrame into the master DataFrame via `pd.merge` before the row loop. Rejected: a `pandas` left-join collapses duplicate keys into multiple joined rows (a many-to-one blowup) rather than surfacing them as a reportable exception, which fights FR-008 instead of implementing it; an explicit dict lookup makes "more than one row for this ID" trivial to detect and reject before any join happens.

## 3. Duplicate-ID exception shape

**Decision**: Reuse the existing `ExceptionEntry` model as-is (`category`, `employeeId`, `employeeName`, `detail`) with a new `category` literal value, `"duplicateEmployeeId"`, added to the existing `ExceptionCategory` union. One exception row is emitted per duplicated ID (not per duplicate row), with `employeeId` set to that ID and `employeeName` left `None` (the duplicate lives in the previous-year file, not tied to a specific current-year employee).

**Rationale**: FR-008 asks for a category "distinct from `missingRequiredField`" that "identif[ies] the duplicated ID" — the existing model already has an `employeeId` field (defined in `specs/001-employee-benefit-calculation`'s `ExceptionEntry`, currently always `None` because the master file has no populated ID column yet); this feature is the first to actually populate it. No new Pydantic model is needed, keeping with Principle V (Anti-Bloat).

**Alternatives considered**: A separate `CarryForwardIssue` model/list on the response. Rejected — the spec (Assumptions) explicitly says duplicate-ID conflicts belong in "the existing exception report mechanism... rather than a separate document."

## 4. Previous-file column resolution

**Decision**: Reuse `accounts_service.py`'s existing `COLUMN_ALIASES` / `resolve_columns()` machinery. `"id": ["รหัสพนักงาน"]` already exists (added for the master file but currently unused downstream — see below); add one new logical key, `"prior_liability": ["ผลประโยชน์ของพนักงานที่คาดว่าต้องจ่าย ณ วันสิ้นปีปัจจุบัน"]`. Both must resolve against the previous file's header row, or the request fails per FR-004.

**Rationale**: The previous-year file is expected to be last year's own output workbook (spec Assumptions), which uses the exact same Thai headers this codebase already produces — no new alias variants are needed. Reusing `resolve_columns()` (rather than a bespoke previous-file column resolver) keeps the "required columns missing → clear 4xx error" behavior consistent with how the master file already fails today (FR-004/FR-005 explicitly ask for this consistency).

**Note**: `COLUMN_ALIASES["id"]` was already present in `accounts_service.py` from the base feature but never wired into `compute_benefit_rows`'s output (per `specs/001-employee-benefit-calculation/data-model.md`, `employeeId` is "Always `None`"). This feature is what finally consumes it — pulling the master file's own `รหัสพนักงาน` (when present) into the working DataFrame so it can be normalized and looked up.

## 5. What "no unique match" means for a blank/duplicate ID

**Decision**: A previous-file row whose own ID normalizes to `None` (blank, or blank-after-strip) is excluded from the lookup entirely and from duplicate-counting — it is not "an ID," so it cannot be "a duplicated ID." A master-file row whose own ID normalizes to `None` simply looks up `None` in the lookup dict, which is never a key, so it always misses (blank stays blank, no exception) — this falls directly out of FR-007's "blank" case without needing a special branch.

**Rationale**: Keeps the None-handling uniform (one code path, not a special case for blank vs. duplicate) and matches the spec's Edge Cases, which only calls out blank *master*-file IDs as a defined no-exception case — it says nothing about blank previous-file IDs needing a duplicate exception, since a blank isn't a "duplicated ID," it's an absence of one.
