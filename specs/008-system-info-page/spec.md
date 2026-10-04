# Feature Specification: System Info "About" Page

**Feature Branch**: `008-system-info-page`

**Created**: 2026-10-05

**Status**: Implemented

**Input**: User description: "MOCK TEST FEATURE: System info "About" page. Add a backend endpoint GET /system/info that returns the app name, app version, server time (ISO 8601), and a status of "ok". Add an Angular "About" page at route /about, linked from the navbar, that calls this endpoint and shows the values in a card, with loading and error states. Keep it minimal — no auth, no persistence."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View system information (Priority: P1)

A portal user opens the "About" page from the main navigation and sees the portal's name, its current version, the server's current date and time, and whether the system is running normally.

**Why this priority**: This is the whole feature — it lets users and support staff confirm which version of the portal they are using and that it is up, without asking IT.

**Independent Test**: Open the portal, choose "About" in the main navigation, and confirm the four values are shown together in one summary panel.

**Acceptance Scenarios**:

1. **Given** the portal is running, **When** the user selects "About" in the main navigation, **Then** the About page opens and shows the application name, application version, server date and time, and a status of "ok".
2. **Given** the user is on any portal page, **When** they look at the main navigation, **Then** an "About" link is visible.
3. **Given** the user goes directly to the About page's address, **When** the page opens, **Then** the same information is shown as when navigating from the menu.

---

### User Story 2 - Understand loading and failure (Priority: P2)

While the information is being fetched, the user sees that it is loading; if it cannot be retrieved, the user sees a clear error message instead of blank or stale values.

**Why this priority**: Prevents users from mistaking an empty or broken page for "the system is fine", but the page still delivers its core value without it.

**Independent Test**: Open the About page while the server is slow or unavailable and confirm a loading indicator appears, followed by an error message if the server cannot be reached.

**Acceptance Scenarios**:

1. **Given** the information has not arrived yet, **When** the About page is displayed, **Then** a loading indicator is shown and no placeholder values are presented as real.
2. **Given** the server cannot be reached or returns a failure, **When** the request ends, **Then** the page shows a readable error message and no system values.

---

### Edge Cases

- The server is unreachable: the page shows the error state (User Story 2), never an endless loading indicator.
- The user leaves the About page before the information arrives: nothing is shown on the next page and no error is raised.
- The server's clock is in a different time zone from the user: the time is shown as reported by the server, including its time-zone offset, so it is unambiguous.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide, on request, the application name, the application version, the server's current date and time, and an operational status.
- **FR-002**: The server date and time MUST be given in the international standard date-time format (ISO 8601) including the time-zone offset.
- **FR-003**: The operational status MUST read "ok" whenever the system is able to answer the request.
- **FR-004**: The portal MUST offer an "About" page reachable from the main navigation and by its own direct address.
- **FR-005**: The About page MUST display the four values from FR-001 together in a single summary panel, each with a clear label.
- **FR-006**: The About page MUST show a loading indicator while the information is being retrieved, and an error message if retrieval fails.
- **FR-007**: The About page and its information MUST be available without signing in, and the feature MUST NOT store any data.

### Key Entities

- **System Information**: A read-only snapshot describing the running portal — application name, application version, server date and time, and operational status. Produced fresh on every request; never stored.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can reach the About page from any portal page in one click.
- **SC-002**: Under normal conditions, all four values appear within 2 seconds of opening the About page.
- **SC-003**: In 100% of failed retrievals, the user sees an error message within 10 seconds instead of a blank page or permanent loading indicator.
- **SC-004**: The version shown on the About page matches the version actually deployed in 100% of checks.

## Assumptions

- This is a mock feature used to exercise the specification pipeline; scope is intentionally minimal.
- Application name and version come from the portal's own configuration; no new admin screen is needed to change them.
- The status only reports "ok" when the system can respond; deeper health checks (e.g. of data files) are out of scope.
- The About page follows the portal's existing look and navigation; no new visual style is introduced.
- No sign-in exists in the portal today, so the page is open to anyone who can reach the portal on the private network.
- Technical hint (for planning only): the description names a read-only "system info" service address and an "/about" page address; these are carried into the plan, not this spec.
