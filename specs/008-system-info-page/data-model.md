# Data Model: System Info "About" Page

No persistence (FR-007). One read-only, per-request value object.

## SystemInfo

Backend: `backend/models/system.py` → `SystemInfo(CamelModel)` (reuses `CamelModel` from
`backend/models/common.py`). Frontend: `features/about/about.models.ts` → `SystemInfo`.

| Python field | Wire (camelCase) | Type | Source / rule | FR |
|---|---|---|---|---|
| `app_name` | `appName` | `str` | env `APP_NAME`, default `"Serichai Web Portal"` (research #2) | FR-001 |
| `app_version` | `appVersion` | `str` | env `APP_VERSION`, default `"dev"` (research #2) | FR-001, SC-004 |
| `server_time` | `serverTime` | `str` | ISO 8601, seconds precision, numeric offset, generated at request time (research #3) | FR-001, FR-002 |
| `status` | `status` | `Literal["ok"]` | constant; endpoint answering implies ok | FR-003 |

Validation: none beyond types; the object is server-produced and never accepted as input.
State transitions: none.

## AppIdentity (backend-internal)

`system_service.AppIdentity` — frozen dataclass `(name: str, version: str)` resolved from
env by `get_app_identity()`, the `Depends` provider the router injects. Not on the wire.
