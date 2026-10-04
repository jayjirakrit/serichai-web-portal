# Research: System Info "About" Page

No "NEEDS CLARIFICATION" remained in Technical Context; the items below are the
decisions the spec left to planning.

## 1. How `/system/*` reaches the backend

**Decision**: Add a `/system` forwarding rule wherever `/accounts` is forwarded today, and
nothing else:

| Path to backend | File | Change |
|---|---|---|
| Dev (`npm start`) | `frontend-ng/proxy.conf.json` | add `"/system"` entry, same shape as `"/accounts"` |
| Docker gateway (Angular, post-cutover) | `frontend-ng/nginx.conf` | add `location /system/ { proxy_pass http://backend:8000/system/; ... }` |
| Windows native install | `scripts/windows/nginx.conf.template` | add `location /system/ { proxy_pass http://127.0.0.1:__BACKEND_PORT__; }` |
| `FRONTEND_DIST` fallback in `backend/main.py` | `_api_prefixes` tuple | add `"system"` so the SPA catch-all doesn't swallow it |

**Rationale**: Each gateway forwards an explicit prefix list; a new top-level resource
needs one entry per gateway. Smallest change, same pattern as `/accounts` and `/health`.
**Alternatives rejected**: (a) put the endpoint under `/accounts/system-info` — avoids
gateway edits but files a non-accounts resource under the accounts domain, and the
user asked for `/system/info`; (b) introduce a common `/api` prefix — correct long term
but a repo-wide breaking change, out of scope for a mock feature.
**Notes**: The Windows install actually runs nginx with `FRONTEND_DIST` unset
(`scripts/windows/start-portal.ps1`), contradicting `CLAUDE.md`'s description; the
`main.py` fallback is still live code, so it is updated too. `docker-compose.yml` still
builds the frozen React app (`frontend/`) until spec 007 T017; that app has no About page,
so `frontend/nginx.conf` is left untouched (spec 007's cutover inherits the Angular config).

## 2. Source of `appName` / `appVersion`

**Decision**: Environment variables `APP_NAME` (default `"Serichai Web Portal"`) and
`APP_VERSION` (default `"dev"`), read per request in `system_service.get_app_identity()`
and injected into the router via `Depends` (Constitution III: config via `Depends`).
`docker-compose.yml` passes `APP_VERSION: ${APP_VERSION:-dev}` through and `.env.example`
documents it; the Windows install inherits a machine-level env var (no script change).

**Rationale**: Matches the existing `CORS_ORIGINS` / `DATA_DIR` env-with-default style; no
new dependency or file. Default `"dev"` makes an unset version visibly wrong rather than
plausibly correct (SC-004).
**Alternatives rejected**: `FastAPI(version=...)` hardcoded constant (needs a code change
per release, still not tied to deploy); reading `frontend-ng/package.json` (crosses the
area boundary, and it says `0.0.0`); a `VERSION` file (another artifact to keep in sync
with no release process that writes it).

## 3. `serverTime` format

**Decision**: `datetime.now().astimezone().isoformat(timespec="seconds")`, carried as a
`str` field — always a numeric offset (`+07:00`, `+00:00`), never `Z` or naive.
**Rationale**: FR-002 requires the offset; letting Pydantic serialize a `datetime` emits
`Z` for UTC, and a naive `datetime.now()` emits no offset at all. Seconds precision is
enough for a display value.
**Note**: Docker containers default to UTC, so Docker shows `+00:00`; correct per the spec
edge case ("shown as reported by the server").

## 4. Frontend display of the result

**Decision**: Fetch on component construction via `apiCall(...).run()`; render with
`app-result-panel` (pending/error/success) and a DaisyUI `card` with a `<dl>` of four
labelled values. `serverTime` is shown verbatim (no `DatePipe`).
**Rationale**: `apiCall` already gives loading/error signals and cancels on destroy (spec
edge case "user leaves before data arrives"). The shared `app-card` is a navigation tile
(title/description/"Click Me" link), not a data card, so it is not reused. Verbatim
`serverTime` keeps the server's offset visible; reformatting into the browser zone would
hide it.

## 5. Relation to existing `GET /health`

**Decision**: Leave `GET /health` (`backend/main.py`, spec 006) unchanged.
`/system/info` is a separate, user-facing resource; `/health` stays the liveness probe used
by the Windows setup script.

## 6. Error within 10 s (SC-003)

**Decision**: No client-side timeout. An unreachable backend fails fast (proxy/nginx
returns 502/504 immediately); the endpoint does no I/O, so a hang implies a wedged
process. Recorded as a risk in `design.md` §6 rather than adding an rxjs `timeout`, whose
`TimeoutError` would surface through `apiCall` as "Request failed with status undefined".
