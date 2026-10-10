# Implementation Plan: Frontend Cutover to the Angular Portal

**Branch**: `008-react-to-angular-cutover` (git branch still `main` at planning time) | **Date**: 2026-10-10 | **Spec**: [spec.md](spec.md)

## Summary

Delete the frozen React app (`frontend/`), move the Angular app `frontend-ng/` to `frontend/` with `git mv`, repoint the few path-bearing files (3 Windows scripts, 2 Claude hooks, 2 skills, CLAUDE.md, constitution, `.gitignore`), and rewrite the root `README.md` from the real feature set. Backend, API, Docker assets and devcontainer need no functional change: compose and devcontainer already say `./frontend` / `cd frontend`, so they start building Angular as soon as the folder is swapped. The risk is operational (Windows path locks, rename history, installed Windows hosts needing a rebuild), not architectural. Full reference inventory, ordered sequence, gates and rollback: [design.md](design.md); evidence and decisions: [research.md](research.md).

## Technical Context

**Language/Version**: TypeScript 6 / Angular 22 (Node >= 24.15) front end; Python 3.13 back end (untouched); PowerShell for `scripts/windows/`; Node ESM for `.claude/hooks/`
**Primary Dependencies**: none added or removed (`package.json`/lockfile move unchanged)
**Storage**: N/A
**Testing**: Vitest via `ng test`, `ng lint`, `ng build`; backend `pytest`; `docker compose config/build`; repository grep for stale references
**Target Platform**: Docker (nginx gateway), Windows native install (nginx + uvicorn, Scheduled Task), devcontainer, local dev
**Project Type**: web application (two sibling projects)
**Performance Goals**: N/A
**Constraints**: no behavior change (FR-004/016); Windows path locks on folder rename; git rename history preserved; historical records (`specs/`) exempt; unrelated working-tree changes must not be swept into the commits
**Scale/Scope**: 1 folder deleted (~17 tracked files + ignored artifacts), 1 folder renamed, ~12 path-bearing edits, 1 README rewrite

## Constitution Check

*GATE: pass before research; re-checked after design.*

| Principle | Result |
|-----------|--------|
| I. Spec/Plan/Task separation | Pass. spec has no tech names; plan code-free; snippets only in design.md. |
| II. Monorepo boundary | Pass, strengthened: `/frontend` + `/backend` become the literal layout the principle names; no cross-imports, API unchanged. |
| III. Tech stack / API contracts | Pass. No endpoint added or changed; `contracts/README.md` records N/A. Angular + `apiCall` rules unchanged. |
| IV. Quality gates | Pass. `ng build`, `ng lint`, `ng test --watch=false` from `frontend/` plus `pytest` are the verification gates. |
| V. Anti-bloat | Pass. README links to CLAUDE.md instead of duplicating; only path-bearing lines edited. |
| VI. Simple, surgical, verifiable | Pass. No drive-by cleanups (code comments mentioning React left unless approved, `backend/main.py` untouched); each task states its check. |

**Constitution text change required (not a violation)**: Technology Standards "Area: frontend -> Path" says `frontend-ng/` and "legacy React app frozen". Amend wording only, version 2.4.0 -> 2.4.1 (PATCH), via `/speckit-constitution`, with a Sync Impact Report. No Complexity Tracking entries.

Post-design re-check: unchanged, all pass.

## API Contracts

No endpoint is added or changed; the backend API is untouched (FR-016). See [contracts/README.md](contracts/README.md) for the not-applicable note and pointers to the existing contracts.

## Design Sketches

Key snippets, decisions, the reference inventory table, cutover sequence, verification gates, risks, rollback and README outline live in [design.md](design.md). No implementation code belongs in this file.

## Project Structure

### Documentation (this feature)

```text
specs/008-react-to-angular-cutover/
├── plan.md
├── research.md
├── data-model.md        # not applicable
├── quickstart.md
├── design.md
├── contracts/README.md  # not applicable (API untouched)
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

Before -> after:

```text
frontend/        (React 19 + Vite, legacy)   -> deleted
frontend-ng/     (Angular 22)                -> frontend/
backend/                                      unchanged
scripts/windows/ (_common, setup, start-portal) paths -> frontend\
.claude/hooks/   (guard-paths, lint-frontend)   paths -> frontend/
README.md, CLAUDE.md, .gitignore, constitution, 2 skills  edited
docker-compose.yml, .env.example, .devcontainer/, .dockerignore, backend/**  no change
```

**Structure Decision**: two sibling projects, `frontend/` (Angular) and `backend/` (FastAPI), per Constitution II; the temporary `frontend-ng` name is retired.

## Superseded work

Spec 007 tasks T017 (cutover) and T018 (docs) are superseded by this feature and must not be executed separately. T018's agent-file edits are already satisfied: `.claude/agents/*.md` contain no `frontend-ng`/React wording (research §5).

## Complexity Tracking

None. No constitution violations.
