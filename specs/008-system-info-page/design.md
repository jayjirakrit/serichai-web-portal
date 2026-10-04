# Design: System Info "About" Page

Spec: `spec.md` · Plan: `plan.md` · Contracts: `contracts/system-api.md`

Frontend paths are under `frontend-ng/src/app/` unless stated.

## 1. Approach

Planned (nothing built). Backend: a new `/system` router with one `GET /info` handler, a
`system_service` that resolves app identity from env (injected via `Depends`) and stamps
the server time, and a `SystemInfo` model on the existing `CamelModel`. Frontend: a new
`features/about/` folder (service, models, component, template) on the existing `apiCall`
+ `app-result-panel` building blocks, a lazy `/about` route, and one navbar link. Each
gateway that forwards `/accounts` gets a matching `/system` rule. `/accounts/*`, `/health`,
the legacy React app and `frontend/nginx.conf` are untouched.

## 2. Key decisions

| Decision | Choice | Why / trade-off |
|----------|--------|-----------------|
| Endpoint location | New `/system` router, not `/accounts/...` | Not an accounts resource; costs one forwarding rule per gateway (research #1). |
| Gateway forwarding | Add `/system` to proxy.conf, Angular nginx, Windows nginx template, `main.py` `_api_prefixes` | Each forwards an explicit prefix list; a shared `/api` prefix would be a repo-wide break. |
| Name/version source | `APP_NAME` / `APP_VERSION` env, defaults `"Serichai Web Portal"` / `"dev"`, via `Depends` | Matches `CORS_ORIGINS` style; `"dev"` makes an unset version obviously wrong (SC-004). |
| `serverTime` | `str` from `datetime.now().astimezone().isoformat(timespec="seconds")` | Always numeric offset; Pydantic `datetime` would emit `Z`, naive would emit none (FR-002). |
| Service return | `dict` → router builds `SystemInfo(**result)` | Same shape as `accounts.py` handlers. |
| Fetch trigger | `call.run()` in the component constructor | Page has no input; `apiCall` cancels on destroy (leave-early edge case). |
| Display | DaisyUI `card` + `<dl>` inside `app-result-panel`; `serverTime` verbatim | Shared `app-card` is a nav tile; verbatim keeps the server offset visible. |
| Client timeout | None | Endpoint does no I/O; unreachable backend fails fast via proxy (risk §6). |

## 3. Flow

```text
navbar "About" (routerLink /about) | direct URL /about
  -> lazy loadComponent About -> constructor: call.run()           [FR-004]
  -> status 'pending' -> result-panel spinner, no values            [FR-006]
  -> AboutService GET ${API_BASE_URL}/system/info
       browser -> ng serve proxy | nginx (/system/) -> uvicorn :8000
  -> router get_system_info(identity = Depends(get_app_identity))
  -> system_service.get_system_info(identity) -> dict -> SystemInfo (camelCase)
  200            -> data set -> 'success' -> card with 4 labelled values [FR-005]
  502/504/offline-> error = detail || "Request failed with status <n>" -> alert, no values
  user navigates away mid-request -> subscription cancelled, nothing lands on next page
```

## 4. Key files

Requirement → key files (grouped):

| Requirements | Key files |
|--------------|-----------|
| FR-001..003 | `backend/services/system_service.py`, `backend/models/system.py`, `backend/routers/system.py` |
| FR-004 | `app.routes.ts`, `shared/ui/navbar.ts`, gateway configs (§4.5) |
| FR-005..006 | `features/about/about.service.ts`, `about.ts`, `about.html` |
| FR-007 | all of the above (no auth guard, no storage) |

### 4.1 Backend

#### `backend/services/system_service.py` — FR-001..003
```python
import os
from dataclasses import dataclass
from datetime import datetime

DEFAULT_APP_NAME = "Serichai Web Portal"
DEFAULT_APP_VERSION = "dev"


@dataclass(frozen=True)
class AppIdentity:
    name: str
    version: str


def get_app_identity() -> AppIdentity:
    """Depends provider; read per request so env changes need no code change."""
    return AppIdentity(
        name=os.environ.get("APP_NAME") or DEFAULT_APP_NAME,
        version=os.environ.get("APP_VERSION") or DEFAULT_APP_VERSION,
    )


def get_system_info(identity: AppIdentity, now: datetime | None = None) -> dict[str, str]:
    now = now or datetime.now().astimezone()      # aware, local offset
    return {
        "app_name": identity.name,
        "app_version": identity.version,
        "server_time": now.isoformat(timespec="seconds"),  # "+07:00" / "+00:00", never "Z"
        "status": "ok",
    }
```
**Check**: `pytest tests/test_system_info.py`
**Specs must assert**:
- defaults apply when `APP_NAME`/`APP_VERSION` are unset or empty (monkeypatch env)
- `server_time` for an injected aware UTC `now` ends in `+00:00`, and parses with `datetime.fromisoformat` to an aware value
- `status == "ok"`

#### `backend/models/system.py` — FR-001
```python
from typing import Literal

from models.common import CamelModel


class SystemInfo(CamelModel):
    app_name: str
    app_version: str
    server_time: str
    status: Literal["ok"]
```

#### `backend/routers/system.py` — FR-001, FR-007
```python
from fastapi import APIRouter, Depends

import services.system_service as system_service
from models.system import SystemInfo

router = APIRouter(prefix="/system", tags=["System"])


@router.get("/info", response_model=SystemInfo)
def get_system_info(
    identity: system_service.AppIdentity = Depends(system_service.get_app_identity),
) -> SystemInfo:
    return SystemInfo(**system_service.get_system_info(identity))
```
Wiring (no snippet): `routers/__init__.py` adds `from .system import router as system_router`;
`main.py` imports it and calls `app.include_router(system_router)` after `accounts_router`.
**Check**: `curl http://127.0.0.1:8000/system/info`
**Specs must assert**:
- `TestClient GET /system/info` → 200, keys exactly `{appName, appVersion, serverTime, status}`
- `app.dependency_overrides[get_app_identity]` value is echoed in `appName`/`appVersion`
- no auth header needed

### 4.2 Core / shared building blocks

#### `shared/ui/navbar.ts` — FR-004, SC-001
```html
<div class="flex gap-2">
  <a class="btn btn-ghost" routerLink="/about">About</a>   <!-- NEW -->
  <div class="dropdown dropdown-end">
    <!-- unchanged account dropdown -->
  </div>
</div>
```
`RouterLink` is already imported. No other shared/core change; `apiCall`, `ResultPanel`,
`Layout` are reused as-is.
**Check**: `npm test -- --watch=false`
**Specs must assert**:
- navbar renders an `a[href="/about"]` with text "About"
- existing brand-link assertion (`a[href="/"]`) still passes

### 4.3 Features / pages

#### about — `features/about/about.service.ts`, `about.models.ts`, `about.ts`, `about.html`
```ts
// about.models.ts — matches contracts/system-api.md
export interface SystemInfo {
  appName: string;
  appVersion: string;
  serverTime: string;
  status: 'ok';
}

// about.service.ts
@Injectable({ providedIn: 'root' })
export class AboutService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  getSystemInfo(): Observable<SystemInfo> {
    return this.http.get<SystemInfo>(`${this.baseUrl}/system/info`);
  }
}
```
```ts
// about.ts
@Component({
  selector: 'app-about',
  imports: [Layout, ResultPanel],
  templateUrl: './about.html',
})
export class About {
  private readonly service = inject(AboutService);
  protected readonly call = apiCall(() => this.service.getSystemInfo());

  constructor() {
    this.call.run(); // no user input: fetch on open; cancelled if the page is left early
  }
}
```
```html
<!-- about.html -->
<app-layout>
  <div class="flex flex-col gap-4 p-8">
    <h3 class="bold">About</h3>
    <div class="card w-96 p-6 bg-white border border-gray-300 rounded shadow-sm">
      <app-result-panel [status]="call.status()" [error]="call.error()"
                        pendingText="Loading system information...">
        @if (call.data(); as info) {
          <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
            <dt class="text-neutral-500">Application</dt> <dd class="font-semibold">{{ info.appName }}</dd>
            <dt class="text-neutral-500">Version</dt>     <dd class="font-semibold">{{ info.appVersion }}</dd>
            <dt class="text-neutral-500">Server time</dt> <dd class="font-semibold">{{ info.serverTime }}</dd>
            <dt class="text-neutral-500">Status</dt>
            <dd><span class="badge badge-success">{{ info.status }}</span></dd>
          </dl>
        }
      </app-result-panel>
    </div>
  </div>
</app-layout>
```
**Check**: `npm run build && npm run lint && npm test -- --watch=false`; quickstart Scenarios 2-3.
**Specs must assert**:
- service: `HttpTestingController.expectOne('http://api/system/info')`, method `GET`, no body
- page: on create a request is issued and the spinner (`[role=status]`) shows, no values
- page: flushing a 200 renders the four labels and values; `serverTime` text is verbatim
- page: flushing a 502 renders `[role=alert]` with "Request failed with status 502" and no `<dl>`

### 4.4 Algorithms / business rules

Not applicable — no business logic beyond the timestamp format in §4.1.

### 4.5 Routing, config & infra (only where a decision lives)

#### `app.routes.ts` — FR-004
```ts
{
  path: 'about',
  loadComponent: () => import('@features/about/about').then((m) => m.About),
},
// ...must stay above { path: '**', redirectTo: '' }
```
**Check**: `app.routes.spec.ts` asserts `/about` resolves to `About`.

#### `frontend-ng/proxy.conf.json` (dev)
```json
"/system": { "target": "http://127.0.0.1:8000", "secure": false, "changeOrigin": true }
```

#### `frontend-ng/nginx.conf` (Docker, Angular gateway)
```nginx
location /system/ {
    proxy_pass http://backend:8000/system/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

#### `scripts/windows/nginx.conf.template` (Windows install)
```nginx
location /system/ {
    proxy_pass http://127.0.0.1:__BACKEND_PORT__;
}
```

#### `backend/main.py` (`FRONTEND_DIST` fallback)
```python
_api_prefixes = ("accounts", "system", "docs", "redoc", "openapi.json", "health")
```

#### `docker-compose.yml` / `.env.example` (SC-004)
```yaml
# backend.environment
APP_VERSION: ${APP_VERSION:-dev}
```
**Check**: quickstart Scenarios 1 and 4.

## 5. Data & contracts touched

- `GET /system/info` (new) — `contracts/system-api.md`.
- `SystemInfo`, `AppIdentity` (new) — `data-model.md`.
- `GET /health`, all `/accounts/*` contracts — unchanged.

## 6. Risks, gaps & mismatches

- Docker currently builds the frozen React app (`./frontend`) until spec 007 T017; `/about`
  is not reachable in Docker before that cutover. Acceptable for a mock feature.
- `CLAUDE.md` says the Windows install serves the SPA via uvicorn `FRONTEND_DIST`, but
  `scripts/windows/start-portal.ps1` runs nginx with `FRONTEND_DIST` unset. Both paths are
  updated here; the doc drift is not fixed by this feature.
- SC-004 holds only if deployments set `APP_VERSION`; nothing in the repo stamps a release
  version today, so an unset deploy shows `"dev"`.
- SC-003: a wedged backend behind nginx would leave the spinner up for up to nginx's
  default 60 s read timeout; no client timeout is added (research #6).
- Docker shows `serverTime` in UTC (`+00:00`) unless `TZ` is set; correct per spec but may
  surprise users.

## 7. Open questions

1. Should `APP_VERSION` be stamped automatically (e.g. from the git tag in the Docker build
   / `setup.ps1`), or is a manually set env var enough for SC-004?
2. Should the Windows nginx `/system/` rule ship now, or wait until the Windows install is
   re-run for another release? (Design assumes now; it is a one-line change.)
