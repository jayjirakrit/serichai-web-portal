# Data Model: Containerized Deployment with Single Entry Point

No domain entities — this feature is packaging/topology, not application data
(consistent with `research.md` #8: every existing feature is stateless, in-memory
per-request). What follows is the configuration shape, kept here rather than in
`plan.md` per Principle V.

## Environment variables

| Variable | Read by | Default | Purpose |
|---|---|---|---|
| `PORT` | `docker-compose.yml` (host port mapping) | `8080` | The single published host port for the whole portal (research.md #9). |
| `CORS_ORIGINS` | `backend/main.py` | `http://localhost:5173` | Comma-separated allowed origins for the backend's CORS middleware (research.md #4). |
| `DATA_DIR` | `backend/services/accounts_service.py`, `backend/services/bonus_service.py` | `<repo>/backend/data` (unchanged current path) | Directory the backend reads its Excel output templates from; set to `/app/data` in the container (research.md #5). |
| `HOST_DATA_DIR` | `docker-compose.yml` (bind-mount source) | `./backend/data` | Host-side path bind-mounted to `/app/data` in the backend container (research.md #5). |
| `VITE_API_BASE_URL` | `frontend/src/services/apiConfig.ts` (build-time) | `""` (relative/same-origin) | Prefix for backend API calls; empty in the container build (proxied by nginx), set to `http://127.0.0.1:8000` in `frontend/.env.development` for local `npm run dev` (research.md #3). |

## Volume mounts

| Host path | Container path | Service | Mode | Purpose |
|---|---|---|---|---|
| `${HOST_DATA_DIR:-./backend/data}` | `/app/data` | `backend` | read-only | Excel output templates (`Employee_Benefit_Template.xlsx`, `Bonus_Calculation_Template.xlsx`); never written back by the app (research.md #5), updatable without an image rebuild per FR-008. |

## Network topology

```text
Host                          Compose network ("serichai")
────                          ────────────────────────────
:${PORT} ──► gateway (nginx)  ──► frontend static assets (dist/, in-image)
                               └─► proxy /accounts/* ──► backend:8000
                                                          (FastAPI, not published to host)
```

Only the `gateway` service publishes a host port; `backend` is reachable solely via
the Compose-internal network, satisfying FR-002/FR-003 (single entry point) at the
network level, not just by convention.
