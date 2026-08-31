# Feature Specification: Containerized Deployment with Single Entry Point

**Feature Branch**: `005-docker-deployment`

**Created**: 2026-08-31

**Status**: Draft

**Input**: User description: "I want to deploy this application both frontend and backend in docker container with single entry point using devcontainer or docker compose is okay."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Start the whole application with one command (Priority: P1)

A developer or operator wants to bring up the entire portal (frontend and backend together) without manually starting two separate processes (`npm run dev` in one terminal, `uvicorn` in another) and without needing to remember how the two are wired together.

**Why this priority**: This is the core value of the feature — without it, containerization offers no benefit over the current two-process workflow. Everything else builds on this.

**Independent Test**: Can be fully tested by running a single documented command (e.g. `docker compose up`) from a clean checkout and confirming both the UI and its backend-dependent features become usable, without any other manual step.

**Acceptance Scenarios**:

1. **Given** a fresh clone of the repository with Docker installed, **When** the developer runs the single startup command, **Then** both the frontend and backend start successfully without additional manual configuration.
2. **Given** the application is already running, **When** the developer stops and re-runs the same single command, **Then** the application returns to a working state with no extra manual steps.

---

### User Story 2 - Access the whole portal through one address (Priority: P2)

An end user wants to open one URL/port to use the portal, including features that call the backend (employee benefits, payroll reconciliation, bonus calculation), without needing to know that a separate backend service exists at a different address.

**Why this priority**: This is the "single entry point" requirement explicitly requested — it determines how the deployment is actually consumed day-to-day, distinct from how it's started.

**Independent Test**: Can be fully tested by opening only the single published address in a browser and successfully completing an end-to-end action that requires backend data (e.g. calculating employee benefits), with no separate address ever needed.

**Acceptance Scenarios**:

1. **Given** the containerized application is running, **When** a user navigates to the single published address, **Then** the portal UI loads and all pages are reachable.
2. **Given** the user is on a page that calls the backend (e.g. employee benefits calculation), **When** the user performs that action, **Then** it completes successfully using only the single entry point address, without the user needing to reach the backend directly.

---

### User Story 3 - Consistent environment for new contributors (Priority: P3)

A new contributor wants to start working on the codebase without first installing and configuring Node.js, Python, and their respective toolchains locally, by using a ready-made containerized development environment.

**Why this priority**: Valuable for onboarding and consistency, but the application is already usable by developers today via the existing local toolchain — this story improves the experience rather than enabling something previously impossible.

**Independent Test**: Can be fully tested by opening the repository in a devcontainer-compatible editor (or running the equivalent container setup) on a machine with only Docker installed, and confirming the developer can edit and run the application without installing Node.js or Python locally.

**Acceptance Scenarios**:

1. **Given** a machine with only Docker (and a devcontainer-compatible editor) installed, **When** the developer opens the project as a devcontainer, **Then** they get a working environment with the frontend and backend toolchains available, without installing them on the host machine.

---

### Edge Cases

- What happens when the backend container fails to start or crashes — does the frontend surface a clear error instead of silently failing or showing a blank page?
- What happens when the backend's required data files (currently read from a hardcoded local path, per known rough edges in `accounts_service.py`) are not present inside the container?
- How does the system behave when the single entry point's port is already in use on the host machine?
- What happens to in-progress user work (e.g. an unsaved file upload/calculation) if a container restarts?
- What happens when frontend and backend containers are started out of order or one is unavailable when the other starts?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow starting the entire application (frontend and backend together) via a single command or action.
- **FR-002**: The system MUST expose a single network entry point (one host/port) through which users reach the portal's UI.
- **FR-003**: Backend functionality that the frontend depends on (employee benefits, payroll reconciliation, bonus calculation, and any future backend features) MUST be reachable through that same single entry point, without users needing to separately address the backend.
- **FR-004**: The frontend and backend MUST be independently containerized, such that each can be rebuilt and updated without requiring changes to the other's container image.
- **FR-005**: The system MUST provide a documented, repeatable setup (a single configuration file and/or command) that a developer can use to bring up a fully working local instance of the application.
- **FR-006**: The containerized deployment MUST preserve all existing portal functionality (employee benefits, payroll reconciliation, bonus calculation) unchanged from the current non-containerized behavior.
- **FR-007**: Configuration that differs between environments (e.g. the backend's allowed CORS origin, currently hardcoded to `http://localhost:5173`, and the frontend's backend base URL) MUST be adjustable without modifying application source code.
- **FR-008**: The system MUST make the backend's required data inputs (the Excel-based templates it currently reads from a hardcoded Windows path) available to the containerized backend by mounting them from the host machine's filesystem into the container, so files can be updated in place without rebuilding the image.
- **FR-009**: This containerized setup MUST primarily support running within a small, private network (e.g. office LAN/VPN) rather than public internet exposure — no TLS/HTTPS termination, public domain, or internet-facing hardening is required; the deployment target is a single host reachable only from within that private network.
- **FR-010**: The single entry point MUST remain open to anyone who can reach it on the private network, with no login/authentication required, matching today's unauthenticated local setup. Revisiting this is out of scope for this feature.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A developer can go from a fresh repository clone to a fully running application (frontend and backend both usable) using no more than one setup command, in under 10 minutes.
- **SC-002**: A user can complete an end-to-end task that requires backend data (e.g. calculating employee benefits) using only the single published entry point address, with zero references to a separate backend address.
- **SC-003**: Stopping and restarting the containerized application returns the portal to a fully working state with no manual reconfiguration, 100% of the time.
- **SC-004**: A new contributor can begin editing and running the application having installed only Docker (and optionally a devcontainer-compatible editor) on their machine — no local Node.js or Python installation required.

## Assumptions

- The existing frontend (React/Vite) and backend (FastAPI) codebases will be containerized largely as-is; this feature is about packaging and access, not rewriting application logic.
- A reverse proxy / gateway pattern (or an equivalent way of unifying frontend and backend traffic under one address) will be used to satisfy the single-entry-point requirement; the specific technology is a planning-phase decision, not a spec-level constraint beyond "use Docker containers, optionally via devcontainer or Docker Compose" as the user specified.
- The application remains for internal use by Serichai / Ch.Paisarn staff, deployed only within a small private network (office LAN/VPN); this feature does not introduce new user roles and does not make the portal reachable from the public internet.
- TLS/HTTPS, a public domain, and authentication are explicitly out of scope for this feature, since access is confined to a private network and today's unauthenticated behavior is being preserved as-is.
- The backend's Excel data templates will be supplied via a host-mounted volume rather than baked into the image or uploaded at runtime; whoever runs the container is responsible for ensuring the expected files exist at the mounted host path.
- Known rough edges called out in the project's engineering guidelines (hardcoded CORS origin, hardcoded Excel data path) will need to become environment-configurable as part of making the app deployable in a container — this is treated as part of this feature's scope, not a separate cleanup effort.
