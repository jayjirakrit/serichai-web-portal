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
    now = now or datetime.now().astimezone()  # aware, local offset
    return {
        "app_name": identity.name,
        "app_version": identity.version,
        # isoformat() on an aware datetime emits "+07:00" / "+00:00", never "Z".
        "server_time": now.isoformat(timespec="seconds"),
        "status": "ok",
    }
