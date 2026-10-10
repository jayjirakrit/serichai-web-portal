# Feature Specification: Frontend Cutover to the Angular Portal

**Feature Branch**: `008-react-to-angular-cutover`

**Created**: 2026-10-10

**Status**: Draft

**Input**: User description: "as solution architect, I want to fully migrate frontend from react to angular. Remove /frontend and rename /frontend-ng to /frontend. Update and fix other dependencies file that current use frontend-ng. Then add latest information about serichai-web-portal on README.md at root file. Provide analysis and planning on this."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - One single frontend, no legacy leftovers (Priority: P1)

An engineer opening the repository finds exactly one user interface application, located at the standard, conventional front-end location. The previous (legacy) interface application and everything that only existed to support it are gone. The rebuilt interface keeps the same pages and behavior it has today.

**Why this priority**: This is the point of the cutover. Two interface applications side by side confuse engineers and risk fixes landing in the wrong one.

**Independent Test**: Inspect the repository: confirm one interface application exists at the standard location, the legacy one is absent, and the portal's pages (Home, Login placeholder, Employee Benefits, Bonus Calculation, Payroll Reconciliation, Elderly Tax Deduction) still work against the existing back end.

**Acceptance Scenarios**:

1. **Given** the cutover is complete, **When** an engineer lists the repository's top-level contents, **Then** there is one interface application at the standard front-end location and no legacy or temporary-named duplicate.
2. **Given** the cutover is complete, **When** a user opens each portal page with the sample files, **Then** results, errors and downloads behave the same as before the cutover.
3. **Given** the cutover is complete, **When** the repository is searched for the old temporary location name or for legacy-application tooling, **Then** no reference is found, except in historical records (earlier specs, commit history).

---

### User Story 2 - Deployment and installation keep working (Priority: P1)

Operators who start the portal by container deployment or by the permanent Windows installation, and engineers who onboard through the development container, get a working portal after the move without changing how they do it. Anything that pointed at the old location now points at the new one.

**Why this priority**: A tidy repository is worthless if it can no longer be built, installed or started. Operators are the people who would feel a break first.

**Independent Test**: Start the container deployment from a clean checkout and open a page by direct link; run the Windows setup steps on a clean machine (or review them end to end); open the repository in the development container and start both parts locally.

**Acceptance Scenarios**:

1. **Given** a clean checkout after the cutover, **When** the operator starts the container deployment with default settings, **Then** the whole portal is reachable on the single published port and a feature page can process an uploaded file.
2. **Given** a Windows machine using the native install scripts, **When** the operator runs the setup, **Then** the portal builds, registers to start on boot and serves the pages and the back end from one address.
3. **Given** an engineer opens the repository in the development container, **When** setup finishes, **Then** dependencies for both parts are ready and the documented start commands work.
4. **Given** the local development workflow, **When** the engineer starts the front end and back end as two processes, **Then** the front end reaches the back end without extra manual configuration.

---

### User Story 3 - Project guidance and tooling describe reality (Priority: P2)

Engineers and AI coding assistants reading the project's instructions, agent definitions, constitution, configuration and ignore/lint settings are told the correct location and commands for the single interface application. Nothing tells them to use a folder, command or step that no longer exists, and nothing describes the legacy application as present.

**Why this priority**: Stale guidance sends people and assistants to the wrong place. It matters, but only after the move itself is done.

**Independent Test**: Read the project instructions, the constitution, the assistant/agent guidance, the spec-kit workflow settings and the contributor-facing config, and follow each command or path they mention; every one resolves.

**Acceptance Scenarios**:

1. **Given** the cutover is complete, **When** a new contributor follows the project instructions to install, run, test and build the front end, **Then** every command works as written.
2. **Given** the project constitution and assistant/agent guidance, **When** they are read, **Then** they name the single front end at its standard location and state that the legacy application no longer exists.
3. **Given** an automated or scripted reference to the front end (for example hooks, workflow settings, build or ignore rules), **When** it runs, **Then** it finds the front end at the new location.

---

### User Story 4 - Root README gives an accurate, current overview (Priority: P2)

A stakeholder or new engineer opens the root README and understands what the Serichai Web Portal is, who it serves, which features are available today, how to run it locally or deploy it, and how the repository is organized. The content matches the current state of the portal, not an earlier one.

**Why this priority**: The README is the first thing people read; an outdated one undermines trust in the rest of the documentation.

**Independent Test**: A person unfamiliar with the project reads only the README and can state the portal's purpose, list its features, and start it locally by following the steps.

**Acceptance Scenarios**:

1. **Given** the README, **When** a stakeholder reads it, **Then** it states the portal's purpose and its audience (internal use by Serichai and Ch.Paisarn).
2. **Given** the README, **When** compared with the portal as it runs, **Then** every currently available feature is listed and none that is unavailable is listed.
3. **Given** the README, **When** an engineer follows its run and deploy instructions, **Then** the portal starts for local development, container deployment and the Windows installation.
4. **Given** the README, **When** the reader looks for the repository layout, **Then** it describes the front end, the back end, the specs, deployment assets and scripts as they now exist.

---

### User Story 5 - Analysis and plan for the cutover (Priority: P3)

The solution architect receives a written analysis of everything affected by the cutover and an ordered plan that reduces the risk of breaking deployment, so the move can be reviewed before it happens.

**Why this priority**: It is the planning deliverable requested; it feeds the planning and task phases rather than the running portal.

**Independent Test**: The planning documents list every affected item found in the repository, with an order of work and a verification step for each.

**Acceptance Scenarios**:

1. **Given** the planning phase, **When** the architect reviews the analysis, **Then** every place that referenced the old location is inventoried with what must change.
2. **Given** the plan, **When** it is reviewed, **Then** it states the order of work, how parity and deployment are verified, and how to roll back if a check fails.

---

### Edge Cases

- A reference to the old temporary location sits in a place that is easy to miss (hidden configuration, workflow settings, ignore rules, scripts, documents); a final repository-wide search must catch it.
- Historical records (earlier specs, commit history, previous design notes) legitimately mention the old names; they stay unchanged and are not counted as stale references.
- Dependency lock records and build output of the legacy application must not linger or be mistaken for the new application's.
- Folders on a developer's machine that still hold the old name or ignored build output after pulling the change must not break their next run; the guidance tells them what to clean.
- The Windows install and container build previously pointed at the legacy application in some places and the new one in others; after the change they must both use the single application, and an already-installed machine can be re-run safely.
- The README must not promise features, ports or commands that do not exist, and must not duplicate long instructions that live in the project guidance (it links to them instead).
- Unfinished work from the earlier migration spec (cutover and documentation tasks) must not be executed twice or left contradictory.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The repository MUST contain exactly one user interface application, located at the standard front-end location, and it MUST be the rebuilt application.
- **FR-002**: The legacy user interface application, its tooling files, lock records and any build output MUST be removed from the repository.
- **FR-003**: The temporary location name of the rebuilt application MUST no longer exist; its full content (source, configuration, tests, container build assets) MUST be available under the standard location with no loss.
- **FR-004**: The portal's pages (Home, Login placeholder, Employee Benefits, Bonus Calculation, Payroll Reconciliation, Elderly Tax Deduction) MUST behave identically to before the cutover, and the back end MUST NOT change.
- **FR-005**: The container deployment MUST build and serve the rebuilt application from the standard location on the same single published port, with page deep links, large Excel uploads and long processing times still supported.
- **FR-006**: The Windows native install scripts MUST build and serve the rebuilt application from the standard location and keep registering the portal to start at boot.
- **FR-007**: The development container MUST prepare both parts from their current locations so the documented local start commands work after opening the repository.
- **FR-008**: The local two-process development workflow MUST keep working, with the front end reaching the back end without extra manual configuration.
- **FR-009**: Project instructions, assistant/agent guidance, the project constitution, spec-kit workflow settings and any other configuration, ignore, lint or hook rule that referenced the old temporary location or the legacy application MUST be updated to name the single front end at the standard location.
- **FR-010**: After the change, a repository-wide search for the old temporary name and for legacy-application tooling MUST find nothing outside historical records.
- **FR-011**: The root README MUST state the portal's purpose and audience.
- **FR-012**: The root README MUST list every feature currently available in the portal, each with a one-line description of what it does for the user, matching what the running portal offers.
- **FR-013**: The root README MUST explain how to run the portal for local development, by container deployment and by the Windows native installation, linking to the project instructions for detail instead of duplicating them.
- **FR-014**: The root README MUST describe the repository layout (front end, back end, specs, deployment assets, scripts) as it exists after the cutover.
- **FR-015**: The front end's quality checks (type-check, lint, unit tests, production build) and the back end's tests MUST all pass after the cutover.
- **FR-016**: The change MUST add no new features and make no back-end behavior change.
- **FR-017**: A written analysis of all affected items and an ordered, verifiable plan with a rollback path MUST be produced during the planning phase before the move is made.

### Key Entities *(include if feature involves data)*

- **Front-end application**: The one user interface of the portal; has a location, run/test/build commands, and a deployable output.
- **Legacy application**: The earlier interface that is retired and removed by this feature.
- **Location reference**: Any place (deployment assets, install scripts, development container, workflow settings, guidance documents, ignore/lint rules) that names where the front end lives.
- **Portal feature**: A user-facing capability listed in the README (e.g. employee benefits calculation); has a name, purpose and availability.
- **Historical record**: Earlier specs and commit history that intentionally keep old names and are exempt from cleanup.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The repository contains 1 interface application (down from 2) and 0 leftover files from the legacy application.
- **SC-002**: A repository-wide search for the old temporary location name and legacy-application tooling returns 0 hits outside historical records.
- **SC-003**: 100% of the portal's pages and their idle, in-progress, error and success states behave the same as before, verified with the sample files against the unchanged back end.
- **SC-004**: Starting the container deployment from a clean checkout with default settings yields a reachable, working portal on the first attempt, and the Windows setup completes without manual path edits.
- **SC-005**: 100% of commands written in the README and the project instructions (install, run, test, build, deploy) work as written when executed once on a clean checkout.
- **SC-006**: A person unfamiliar with the project can, from the README alone, name the portal's purpose and list all its available features correctly within 5 minutes.
- **SC-007**: Type-check, lint, all unit tests, the production build and the back end tests complete with 0 errors.

## Assumptions

- This feature is the final cutover of spec 007 (Angular frontend migration) and supersedes that spec's still-open cutover task (T017) and documentation task (T018); those two tasks are not run separately.
- The earlier migration already delivered page parity, tests and deployment support for the rebuilt application; this feature moves, cleans up and documents, and does not re-do it.
- "Standard location" means the folder name `frontend` at the repository root, as stated in the request; the rebuilt application's current temporary folder name is retired.
- Historical records (earlier specs, commit history, the previous migration plan notes) keep their old wording and are exempt from cleanup. Every other mention of the legacy application's framework or tooling (code comments, ignore rules, guidance, skills) is removed, not allow-listed. The one exception is the README's "Upgrading from the old layout" note, which names the retired `frontend-ng/` folder so developers know what to delete.
- Portal features to list in the README are those present in the rebuilt application: employee benefits calculation (including carry-forward of previous benefits), bonus calculation, payroll reconciliation and elderly tax deduction, plus the Home and Login placeholder pages. Authentication remains out of scope.
- The README is an overview with links to the project instructions and feature specs; it targets both stakeholders and engineers, in English.
- The portal stays an internal tool on a private network without TLS or authentication, per the deployment spec (005).
- Backend, API contracts and the Excel templates are unchanged; the shipped deployment assets keep their current behavior apart from location references.
- The change is delivered as a single reviewable change set, with a documented way to revert it, and the spec-kit commit conventions in the project instructions apply.
