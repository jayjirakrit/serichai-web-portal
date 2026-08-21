# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Serichai Web Portal — an internal tool for Serichai and Ch.Paisarn. Monorepo with two independently run apps that talk over HTTP:

- `frontend/` — React 19 + TypeScript + Vite SPA
- `backend/` — FastAPI (Python) service

There is no shared build, no monorepo tooling (Nx/Turborepo/workspaces), and no shared package between the two — they are just two sibling projects in one repo. Always `cd` into the relevant subfolder before running its tooling.

## Commands

### Frontend (`frontend/`)

```
npm install       # install deps
npm run dev       # start Vite dev server (http://localhost:5173)
npm run build     # tsc -b (typecheck) then vite build
npm run lint      # eslint .
npm run preview   # preview the production build
```

There is no test runner configured yet (no Jest/Vitest in `package.json`) — don't assume `npm test` works.

### Backend (`backend/`)

A `.venv` already exists at `backend/.venv` (Python 3.13, created with `python -m venv`).

```
backend/.venv/Scripts/activate   # Windows: activate the existing venv
pip install -r requirements.txt
uvicorn main:app --reload        # run from inside backend/, serves on http://127.0.0.1:8000
```

No lint config, no test framework, and no formatter config exist in `backend/` yet — don't invent commands for these.

## Architecture

### Backend: router → service layering

FastAPI app in `backend/main.py` mounts routers from `backend/routers/`, which delegate to `backend/services/` for logic. New endpoints should follow this same split rather than putting logic inline in the router:

- `backend/routers/<name>.py` defines an `APIRouter` with a URL prefix/tags and thin handler functions.
- `backend/routers/__init__.py` re-exports each router (e.g. `accounts_router`) for `main.py` to include.
- `backend/services/<name>_service.py` holds the actual business logic, called by the matching router.
- `backend/models/` and `backend/util/` exist as placeholders for future Pydantic models / shared helpers — currently empty.

CORS in `main.py` is hardcoded to allow only `http://localhost:5173` (the Vite dev origin) — update this when deploying or adding another frontend origin.

Note: `services/accounts_service.py` currently reads its Excel input from a hardcoded absolute Windows path rather than `backend/data/`. Treat this as a known rough edge, not a pattern to copy — new services should take file input as a parameter/upload rather than a hardcoded path.

### API conventions (endpoint paths + JSON field casing)

- Endpoint paths are resource-named, kebab-case for multi-word resources, and rely on the HTTP verb rather than a verb suffix — e.g. `POST /accounts/employee-benefits`, not `POST /accounts/employee_benefits/calculate`.
- All JSON request/response bodies (and multipart form field names) use **camelCase** keys. Backend Python internals stay `snake_case` per PEP 8; bridge the two on each Pydantic model with a camelCase `alias_generator` (e.g. Pydantic's `to_camel`) plus `populate_by_name=True`, rather than hand-writing `Field(alias=...)` per field or exposing `snake_case` keys over the wire.
- Frontend TypeScript types for API payloads should be written camelCase directly (matching the wire format) — no field-translation layer between `fetch`/`axios` calls and component code.

### Frontend: pages/components/design-token structure

- `src/pages/` — one component per route, wired up in `src/App.tsx` via `react-router` (`Routes`/`Route`), mounted at the root with `BrowserRouter` in `src/main.tsx`. Add new routes in `App.tsx`.
- `src/components/` — shared UI (`Layout`, `Navbar`, `Button`, `Card`). `Layout` wraps page content with the `Navbar`.
- `src/services/`, `src/utils/`, `src/hooks/` hold API clients, helpers, and hooks. `src/services/queryClient.ts` (the TanStack Query client, see below) is the only file there so far; `src/utils/` and `src/hooks/` are still empty placeholders. There is no per-resource API client yet (e.g. no `accountsService.ts` calling `/accounts/...`) — add those to `src/services/` as backend integration grows.
- Styling is Tailwind CSS v4 (via `@tailwindcss/vite`, not the PostCSS plugin path) plus DaisyUI, using a custom `enterprise` DaisyUI theme defined in `tailwind.config.js`. All colors, typography, radii, and shadows are indirected through CSS custom properties (`var(--primary)`, `var(--fz-title)`, etc.) rather than literal Tailwind values — check `src/index.css` for the token definitions before introducing a new color/size, and prefer an existing token over a new literal.
- Tailwind class ordering convention (from `frontend/README.md`): group utilities as **Layout → Sizing → Typography → Colors & Effects → States**, e.g. `flex items-center justify-between w-full h-14 bg-white shadow-sm hover:bg-gray-50 transition-all`.
- The React Compiler is enabled via `@rolldown/plugin-babel` + `reactCompilerPreset()` in `vite.config.ts` — avoid patterns that defeat it (e.g. unnecessary `useMemo`/`useCallback` micro-optimizations are not needed here; the compiler handles this).
- Path note: Vite 8 + rolldown-based build (`rolldown-vite` under the hood via the `vite` package version), and ESLint uses the flat-config format (`eslint.config.js`) with `typescript-eslint`, `eslint-plugin-react-hooks`, and `eslint-plugin-react-refresh`.

### Frontend: state management

Pages currently use plain `useState` for local UI state (e.g. `EmployeeBenefits.tsx`). Follow this decision order rather than reaching for a global store by default:

1. **Local component state (`useState`/`useReducer`)** — default choice for anything only one component (and maybe its direct children via props) cares about, e.g. form fields, toggles, the file-upload state in `EmployeeBenefits.tsx`. Keep state as close as possible to where it's used; don't lift it "just in case."
2. **Lift state up** before reaching for Context — if two sibling components need the same state, move it to their nearest common parent and pass it down, rather than introducing a global store for a two-component problem.
3. **Server/API state (data from the FastAPI backend) is not the same as UI state.** Model it with **TanStack Query (`@tanstack/react-query`)**, not `useState` + `useEffect` fetch-on-mount:
   - `QueryClient` lives in `src/services/queryClient.ts`; `src/main.tsx` wraps the app in `QueryClientProvider` and mounts `ReactQueryDevtools` in dev builds only (`import.meta.env.DEV`).
   - Put the actual `fetch`/`axios` calls in `src/services/` (one module per backend resource, e.g. an `accountsService.ts` calling `/accounts/...`), and consume them from components via `useQuery` (reads) / `useMutation` (writes, e.g. the benefits/master-data file uploads in `EmployeeBenefits.tsx`) — don't call `fetch` directly inside components.
   - Give queries explicit, structured query keys (e.g. `["accounts", "benefits"]`) so caching/invalidation stays predictable as more endpoints are added.
   - `@tanstack/eslint-plugin-query` (`flat/recommended`) is wired into `eslint.config.js` — don't disable its rules without reason; they catch missing query-key dependencies and other easy-to-miss query bugs.
4. **React Context** — for genuinely cross-cutting client state with few, infrequent updates (auth/session user, active theme). Split unrelated concerns into separate contexts rather than one `AppContext`, so a change to one doesn't re-render consumers of the other.
5. **Global client-state library (Zustand, Redux, etc.)** — don't add one preemptively. Only introduce it once multiple unrelated features need to read/write the same client state and prop-drilling/Context composition has actually become painful; this app is currently small enough that it hasn't.
6. **Encapsulate reusable stateful logic in custom hooks** under `src/hooks/` (e.g. a future `useAuth`, or hooks that wrap `useQuery`/`useMutation` calls from `src/services/`) instead of duplicating logic across pages.

## Git commit conventions

- Do **not** add a `Co-Authored-By: Claude` (or any Anthropic/Claude attribution) trailer to commit messages in this repository. Commits should be authored under the user's own identity only.

## Cross-cutting notes

- Frontend and backend are developed and run as two separate processes (`npm run dev` + `uvicorn`); there's no proxy configured in `vite.config.ts`, so frontend service calls must target the backend's full URL (e.g. `http://127.0.0.1:8000`) until a proxy or env-based base URL is introduced.
- Employee benefit data (`backend/data/Employee_Benefit_Template.xlsx`) uses Thai-language column headers and Buddhist Era (BE) year conventions (BE = Gregorian year + 543) — preserve this convention when touching `accounts_service.py` or related date/year logic.
