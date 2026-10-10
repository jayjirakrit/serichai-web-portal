# Research: Frontend Cutover to the Angular Portal

All "NEEDS CLARIFICATION" resolved; no spec.md changes needed. Reference inventory lives in `design.md` §4.5.

## 1. Rename mechanics and git history
- **Decision**: two commits on the cutover branch: (1) `git rm -r frontend` (legacy), (2) `git mv frontend-ng frontend`, then fixups in a third commit. Squash/merge strategy is the maintainer's call.
- **Why**: legacy and new app share paths (`Dockerfile`, `nginx.conf`, `package.json`, `eslint.config.js`, `public/favicon.svg`, ...). In a single commit git sees "modified", not "renamed", and `git log --follow` loses the Angular history. With the legacy tree already removed in commit 1, commit 2 is a pure 100%-similarity rename.
- **Rejected**: copy files instead of `git mv` (loses history); single commit (history ambiguity).

## 2. Windows path-lock risk
- `frontend-ng/node_modules` (and `.angular/`, `dist/`) hold thousands of files; renaming the parent fails with "Permission denied / EBUSY" when `ng serve`, VS Code/TS server, Defender, Search indexer or a Vitest watcher holds handles. Same for deleting `frontend/node_modules` after `git rm` (git leaves ignored files, so the folder survives and blocks `git mv` target).
- **Decision**: stop dev servers/close editors; delete ignored build artifacts of both folders first (`node_modules`, `dist`, `.angular`) using PowerShell `Remove-Item -Recurse -Force`; then `git mv`; then `npm ci`. Costs one `npm ci`, which is a required gate anyway. `rm -rf` is denied in `.claude/settings.json`, so the human (or an approved PowerShell command) runs the deletes.
- **Fallback if the rename is still locked**: `git mv` is not required for history, because git detects renames by content. Copy the tracked files to `frontend/` (e.g. `robocopy frontend-ng frontend /E /XD node_modules dist .angular`), remove `frontend-ng`, and `git add frontend` / `git rm -r frontend-ng`; `git status` should still report renames at 100% similarity. Verify with `git diff --cached -M --stat`.

## 3. node_modules / dist are untracked
`git check-ignore`: `frontend/node_modules`, `frontend/dist`, `frontend-ng/dist` are ignored (so not in any commit); `frontend-ng/node_modules` ignored via its own `.gitignore`. Nothing to `git rm` for them; they must only be removed from disk.

## 4. Working-tree state (snapshot at planning time, branch still `main`)
- Modified: `CLAUDE.md` (uncommitted; cutover edits layer on top).
- Deleted, unstaged: `ANGULAR_MIGRATION_PLAN.md`, `docs/diagrams/serichai-lg-journey.excalidraw`.
- Untracked: `VERCEL_DEPLOYMENT_PLAN.md` (references `frontend-ng/` 3x and legacy `frontend/` 1x), `sample-data/`, `Chopaisarn_Bonus_Macro_V3.xlsm`, `specs/008-react-to-angular-cutover/`.
- **Decision**: cutover commits stage explicit paths only (no `git add -A`); the user commits or stashes the unrelated WIP first. The deleted docs are historical and out of scope; `sample-data/` and the `.xlsm` are never touched.

## 5. Dead-rule and stale-doc findings (beyond plain `frontend-ng` text)
- `.devcontainer/devcontainer.json` already runs `cd frontend && npm ci`, i.e. today it installs the *React* deps; the move fixes it with zero edits (matches FR-007 "from their current locations").
- `docker-compose.yml` already has `context: ./frontend`; today it builds the React app. After the move it builds Angular with zero edits. Dockerfile/nginx.conf of `frontend-ng` already carry the 20m body limit and 120s timeouts (FR-005); legacy nginx.conf lacks them.
- `.claude/hooks/guard-paths.mjs` self-disables once `frontend-ng/` is gone, leaving dead code; remove it. `.claude/hooks/lint-frontend.mjs` hard-codes `frontend-ng`; must change or lint-on-edit silently stops.
- `.claude/agents/*.md` and `.claude/skills/speckit-plan` are stack-neutral except `speckit-plan/SKILL.md:167` and `speckit-execution/SKILL.md:100`. `frontend-engineer.md` / `solution-architect.md` contain no `frontend-ng`/React text, so spec 007 T018's agent edits are already satisfied; nothing to change there.
- `CLAUDE.md` "Windows native install" paragraph says uvicorn serves the bundle via `FRONTEND_DIST`, but `scripts/windows/README.md` and scripts use **nginx** on one port. `FRONTEND_DIST` is set by nothing in `scripts/`. Documented drift: fix the CLAUDE.md wording (docs only); leave `backend/main.py` untouched (FR-016).
- Constitution Technology Standards "frontend Path" still says `frontend-ng/` (renamed at cutover) and "legacy React app frozen": needs a PATCH amendment (2.4.0 -> 2.4.1, wording only) via `/speckit-constitution`.
- Code comments mention React/TanStack: `core/auth/login.ts:4`, `core/http/api-call.ts:8`. Harmless; flagged as an open question, default is leave (surgical, Principle VI).
- `.gitignore:76 !frontend/.env.development` only existed for the deleted legacy `.env.development`; remove. Vite lines (145-148) are generic Node boilerplate; leave unless owner wants them gone (open question).

## 6. Spec 007 T017/T018
Superseded by this feature. Record in `plan.md` and, at implement time, mark them `[X] (superseded by 008)` in `specs/007-angular-frontend-migration/tasks.md`. Editing that historical file is the one allowed exception to "history untouched" and is a single-line annotation each; if the maintainer prefers, leave it and rely on spec 008's assumption. (Open question 3.)

## 7. README content source
Verified from code, not specs: routes in `frontend-ng/src/app/app.routes.ts` (home, login stub, employee-benefits, bonus-calculation, payroll-reconciliation, elderly-tax-deduction); endpoints in `backend/routers/accounts.py` (`POST /accounts/employee-benefits`, `/payroll-reconcile`, `/bonus-calculation`, `/tax-deduction`); optional uploads `previousBenefitsFile` (carry-forward) and `previousYearSummaryFile`. Route names and endpoint names differ (payroll-reconciliation vs payroll-reconcile; elderly-tax-deduction vs tax-deduction); the README must use the right one in each context. Authentication is a placeholder only.
