# Feature Specification: Angular Frontend Migration

**Feature Branch**: `007-angular-frontend-migration`

**Created**: 2026-09-26

**Status**: Draft

**Input**: User description: "As solution architect, I want to migrate frontend layer from react to angular. follow the information from this file [ANGULAR_MIGRATION_PLAN.md]. then run speckit-plan, speckit-task, and speckit-implement include unit test too. Pending open question will use suggested option."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Every existing page works exactly as before (Priority: P1)

An internal user opens the portal and uses any of the four calculation pages (employee benefits, bonus calculation, payroll reconciliation, tax deduction) as they do today: choose the required file(s), submit, see a progress state, then either a clear error message or a result summary with lists and downloadable Excel files. The rebuilt front end must give the same results, field for field, against the unchanged back end.

**Why this priority**: The migration only has value if nothing users rely on is lost. Feature parity is the whole deliverable.

**Independent Test**: For each of the four pages, upload the sample files from `sample-data/`, confirm the summary, lists and downloaded files match what the current portal produces; upload a wrong file and confirm the back end's error message is shown.

**Acceptance Scenarios**:

1. **Given** a user on any calculation page with valid files chosen, **When** they submit, **Then** a pending state is shown, then the result summary, lists and download buttons appear with the same values as today.
2. **Given** a result is shown, **When** the user clicks a download button, **Then** a valid Excel file with the same name and contents as today is saved.
3. **Given** the back end rejects the request, **When** the response arrives, **Then** the back end's error detail is shown to the user (or a generic "request failed" message when none is given).
4. **Given** the user submits without required files, **When** they attempt to submit, **Then** they see an inline message explaining what is missing instead of a browser pop-up, and no request is sent.
5. **Given** a request is in progress, **When** the user looks at the submit control, **Then** it cannot be triggered again until the request finishes.

---

### User Story 2 - Navigation, look and feel are unchanged (Priority: P1)

Users move between Home, Login (placeholder), and the four feature pages through the same top navigation, with the same visual design (colors, typography, spacing, cards, tabs, collapsible rules, status badges). Deep links and browser refresh on any page keep working, and unknown addresses land on Home as today.

**Why this priority**: Users should not need retraining, and bookmarks must keep working.

**Independent Test**: Compare side-by-side screenshots of Home and each feature page (all states, including the tax deduction results table and rules section) between the old and new front end; open each page URL directly and refresh.

**Acceptance Scenarios**:

1. **Given** the portal is open, **When** the user uses the navigation, **Then** every page in the current menu is reachable and the active page is highlighted.
2. **Given** a user opens a page URL directly (or refreshes), **When** the page loads, **Then** that page is shown rather than an error.
3. **Given** an address that matches no page, **When** it is opened, **Then** the user lands on Home.
4. **Given** any page, **When** compared visually with the current portal, **Then** there are no noticeable differences other than the intentional fixes listed in Requirements.

---

### User Story 3 - Deployed and run the same way (Priority: P2)

Operators still start the whole portal with one command and reach it on the same single port, and developers still run the front end and back end as two separate processes locally. Larger Excel uploads than today's default limit succeed.

**Why this priority**: Users can't benefit from the rebuild until it ships through the existing deployment path.

**Independent Test**: Start the containerised portal, open a page by deep link, upload a file larger than 1 MB, and confirm it is processed; run the local dev setup and confirm the pages reach the back end.

**Acceptance Scenarios**:

1. **Given** the containerised deployment is started, **When** the user opens the portal on the published port, **Then** the rebuilt front end is served and calls reach the back end.
2. **Given** an Excel file larger than 1 MB (within the agreed upload limit), **When** it is uploaded, **Then** it is accepted and processed.
3. **Given** a developer follows the updated project instructions, **When** they start the front end and back end locally, **Then** the portal works without extra manual configuration.

---

### User Story 4 - Automated tests protect the new front end (Priority: P2)

The rebuilt front end ships with automated unit tests covering the logic whose failure would break a feature: how each page's request is assembled, how request status and back-end errors are turned into what the user sees, the employee-status rules on the tax deduction page, and file download. Each page has at least a basic render test. Type-check, lint, tests and production build all pass.

**Why this priority**: The current front end has no tests; without a safety net the rewrite cannot be trusted.

**Independent Test**: Run the front end's lint, unit-test and production build commands and confirm all pass.

**Acceptance Scenarios**:

1. **Given** the test suite is run, **When** it finishes, **Then** all tests pass.
2. **Given** a page's request logic is changed so a required field name is wrong, **When** tests run, **Then** at least one test fails.
3. **Given** lint, type-check and build are run, **Then** all complete without errors.

---

### User Story 5 - Old front end retired and docs current (Priority: P3)

Once parity is confirmed, the previous front end is removed and project documentation and contributor guidance describe the new one, so nobody is directed to tooling that no longer exists.

**Why this priority**: Prevents two front ends and stale instructions living side by side, but only after parity is proven.

**Independent Test**: Search the repository (excluding history and dependencies) for references to the old framework and its tooling and find none outside intentional history notes.

**Acceptance Scenarios**:

1. **Given** cutover is complete, **When** the repository is inspected, **Then** only one front end exists and it is the rebuilt one.
2. **Given** a new contributor reads the project instructions, **When** they follow them, **Then** the commands and conventions described match the rebuilt front end.

---

### Edge Cases

- Back end unreachable or returns a non-JSON error: the user sees a generic failure message including the status, and the page stays usable for a retry.
- Very large files or slow processing: the upload is not rejected by the front-door limit and does not time out under normal processing times.
- Page reached with no prior interaction (fresh load on a deep link): renders in its idle state with no leftover results.
- Result contains empty or missing numeric values: they display as a dash, as today, rather than "null" or blank.
- User selects a file, then clears the selection: the page returns to a state where submit is not possible.
- User navigates away while a request is in flight: no error or stale result appears on the next page.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The portal MUST offer the same set of pages as today — Home, Login (placeholder), Employee Benefits, Bonus Calculation, Payroll Reconciliation, Tax Deduction — reachable at the same addresses.
- **FR-002**: Each calculation page MUST accept the same inputs as today, send them to the existing back end using the existing request contract unchanged, and present the same result content (summaries, lists, tables, badges, downloads).
- **FR-003**: Each calculation page MUST show four distinct states: idle, in progress, error (with the back end's message), and success.
- **FR-004**: The system MUST prevent a second submission while one is in progress.
- **FR-005**: Downloadable Excel results MUST be saved with the same file names and contents as today, using a single shared download behaviour across all pages.
- **FR-006**: Missing-input problems MUST be shown as inline messages rather than browser pop-up dialogs.
- **FR-007**: Unknown addresses MUST lead to Home, as today.
- **FR-008**: The visual design (tokens, typography, default light theme, layout) MUST remain equivalent to the current portal.
- **FR-009**: Invalid page structures found in the current design (e.g. buttons nested inside links in the navigation and cards) MUST be corrected without changing appearance.
- **FR-010**: The tax deduction page's unused reference-date value MUST be removed until a future spec requires it.
- **FR-011**: The Excel template download on the tax deduction page MUST keep working.
- **FR-012**: The containerised deployment MUST serve the rebuilt front end on the same single port, keep page deep links working, and accept Excel uploads of at least 20 MB with processing timeouts of at least 2 minutes.
- **FR-013**: Local development MUST keep the two-process workflow, with the front end able to reach the back end without cross-origin configuration changes.
- **FR-014**: The rebuilt front end MUST have automated unit tests for: request assembly per page (field names, optional fields), request-status handling and error-message mapping, the employee-status rules, file download, and a basic render check per page.
- **FR-015**: Type-check, lint, unit tests and production build MUST all pass.
- **FR-016**: The previous front end MUST be removed after parity is verified, and CLAUDE.md, contributor/agent guidance, devcontainer setup, README and the project constitution MUST be updated to describe the new front end.
- **FR-017**: The back end's behaviour and request/response contract MUST NOT change as part of this feature.

### Key Entities *(include if feature involves data)*

- **Calculation Request**: The files and optional parameters (year, period) a user submits on a page; unchanged from today.
- **Calculation Result**: The summary, lists/tables and one or more downloadable Excel attachments returned by the back end; unchanged from today.
- **File Attachment**: A named downloadable Excel file delivered with a result; one shared definition used by all pages.
- **Request State**: idle, in progress, error (message) or success (result) for a page's current submission.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of the current pages and their result states (idle, in progress, error, success) are present and behave equivalently, verified with the sample files against the live back end.
- **SC-002**: Downloaded Excel files from the rebuilt portal are identical in content to those from the current portal for the same inputs, on all four calculation pages.
- **SC-003**: Side-by-side review of all pages shows no visual differences beyond the listed intentional fixes.
- **SC-004**: A user can upload an Excel file of 20 MB and receive a result without a size or timeout error.
- **SC-005**: Lint, type-check, all unit tests and the production build complete with zero errors.
- **SC-006**: Every calculation page has at least one test that fails if its request field names or error handling regress.
- **SC-007**: After cutover, a repository search finds zero remaining references to the previous front-end framework's tooling outside history notes, and a new contributor can start the portal by following the updated instructions alone.

## Assumptions

- The back end and its API contract are frozen; no back-end work is in scope except allowing the new local development origin if a proxy is not used.
- Answers to the migration plan's open questions use the plan's suggested defaults: inline validation messages instead of pop-ups; reference-date input removed; visual theme stays on the current default light theme (a custom theme is a follow-up); unknown addresses redirect to Home rather than showing a 404 page.
- The migration is a single cut-over rewrite built alongside the current front end, not an incremental, mixed-framework rollout.
- Target platform version and toolchain specifics (Angular 22 per the input, Node version, styling pipeline, state and HTTP approach) are decided in the plan, not here; see `ANGULAR_MIGRATION_PLAN.md`.
- The Login page stays a placeholder; no authentication is introduced.
- Unused assets and dead configuration in the current front end are not carried over.
- The portal remains an internal tool on a private network with no TLS/auth, per the deployment spec (005).
- Existing sample files in `sample-data/` are the reference data for parity checks.
