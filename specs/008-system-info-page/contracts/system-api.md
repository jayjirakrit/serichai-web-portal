# API Contract: System Info

New `/system` router (`backend/routers/system.py` → `backend/services/system_service.py`),
re-exported as `system_router` from `backend/routers/__init__.py` and included in
`backend/main.py`, per `CLAUDE.md`'s router→service layering.

All JSON request/response bodies use **camelCase** keys, per the repo-wide API
convention in `CLAUDE.md` and Constitution Principle III. Backend Python internals
stay `snake_case` (PEP 8); Pydantic models bridge the two via a camelCase alias
generator.

## `GET /system/info`

Returns a fresh snapshot of the running portal's name, version, server time and status
(FR-001..FR-003). No authentication (FR-007); nothing is stored.

**Request**: no body, no query parameters.

**Response 200** — `application/json`

```json
{
  "appName": "Serichai Web Portal",
  "appVersion": "1.4.0",
  "serverTime": "2026-10-05T14:03:12+07:00",
  "status": "ok"
}
```

| Field | Type | Notes |
|---|---|---|
| `appName` | string | env `APP_NAME`, default `"Serichai Web Portal"` (FR-001) |
| `appVersion` | string | env `APP_VERSION`, default `"dev"` (FR-001, SC-004) |
| `serverTime` | string | ISO 8601, seconds precision, always a numeric offset `±HH:MM`, never `Z` (FR-002) |
| `status` | `"ok"` | constant (FR-003) |

Maps to new `SystemInfo(CamelModel)` in `backend/models/system.py` (see `data-model.md`).

**Response 4xx**: none defined — the endpoint takes no input. An unreachable or failing
backend surfaces as a gateway/network error (502/504/5xx or status 0); its body may not be
`{ "detail": string }`.

**Routing**: reachable through every gateway that forwards `/accounts` today — see
`research.md` #1.

## Frontend contract usage

- `frontend-ng/src/app/features/about/about.service.ts`:
  `AboutService.getSystemInfo(): Observable<SystemInfo>` — `GET ${API_BASE_URL}/system/info`,
  no body, no params.
- `frontend-ng/src/app/features/about/about.ts` (`About` component, route `/about`):
  `apiCall(() => this.service.getSystemInfo())`, `run()` in the constructor;
  `call.status()` drives `app-result-panel` (pending → spinner, error → `call.error()`
  text, success → card with the four labelled values, `serverTime` shown verbatim).
