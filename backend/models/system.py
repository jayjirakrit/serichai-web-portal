from typing import Literal

from models.common import CamelModel


class SystemInfo(CamelModel):
    app_name: str
    app_version: str
    server_time: str
    status: Literal["ok"]
