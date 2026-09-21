# API Contract: Health Check

Added directly in `backend/main.py` — not under `/accounts` (it isn't an accounts-domain resource) and not backed by any service module (`research.md` #11). No existing contract in the repo already covers this: `specs/005-docker-deployment/research.md` #7 deliberately relies on FastAPI's built-in `/docs` for the Compose healthcheck rather than defining a `/health` endpoint, so this is the first one.

## `GET /health`

A minimal liveness probe the frontend can call before trusting an upload/calculation attempt to have a reachable backend.

**Request**: no body, no parameters.

**Response 200** — `application/json`

```json
{ "status": "ok" }
```

Returned as a plain `dict`, not a `CamelModel` — a single, permanently-stable field needs no alias generator.

**Response 4xx/5xx**: none defined by this feature; a down/unreachable backend surfaces as a network-level failure to the caller, not an application error body.

## Frontend contract usage

- `frontend/src/services/taxDeductionService.ts`: `checkHealth(): Promise<{ status: string }>` — `GET /health`.
- `frontend/src/pages/TaxDeduction.tsx`: optionally called once on mount (or left unused in v1 — this is a generic, reusable probe, not tax-deduction-specific) to show a "backend unreachable" banner before the user attempts an upload. Not required for the page's core upload/results/download flow to function.
