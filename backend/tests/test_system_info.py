"""Tests for GET /system/info (specs/008-system-info-page)."""

from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

from main import app
from services.system_service import (
    DEFAULT_APP_NAME,
    DEFAULT_APP_VERSION,
    AppIdentity,
    get_app_identity,
    get_system_info,
)


@pytest.mark.parametrize("value", [None, ""])
def test_app_identity_defaults_when_env_unset_or_empty(
    monkeypatch: pytest.MonkeyPatch, value: str | None
) -> None:
    for key in ("APP_NAME", "APP_VERSION"):
        if value is None:
            monkeypatch.delenv(key, raising=False)
        else:
            monkeypatch.setenv(key, value)

    identity = get_app_identity()

    assert identity == AppIdentity(name=DEFAULT_APP_NAME, version=DEFAULT_APP_VERSION)
    assert identity.name == "Serichai Web Portal"
    assert identity.version == "dev"


def test_app_identity_reads_env_override(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("APP_NAME", "Portal X")
    monkeypatch.setenv("APP_VERSION", "1.4.0")

    assert get_app_identity() == AppIdentity(name="Portal X", version="1.4.0")


def test_server_time_uses_numeric_offset_for_utc() -> None:
    now = datetime(2026, 10, 5, 7, 3, 12, 123456, tzinfo=timezone.utc)

    info = get_system_info(AppIdentity(name="n", version="v"), now=now)

    assert info["server_time"] == "2026-10-05T07:03:12+00:00"
    assert not info["server_time"].endswith("Z")
    parsed = datetime.fromisoformat(info["server_time"])
    assert parsed.tzinfo is not None


def test_server_time_defaults_to_aware_now() -> None:
    info = get_system_info(AppIdentity(name="n", version="v"))

    parsed = datetime.fromisoformat(info["server_time"])
    assert parsed.tzinfo is not None
    assert parsed.microsecond == 0
    assert not info["server_time"].endswith("Z")


def test_system_info_status_and_identity() -> None:
    info = get_system_info(AppIdentity(name="n", version="v"))

    assert info["status"] == "ok"
    assert info["app_name"] == "n"
    assert info["app_version"] == "v"


def test_get_system_info_endpoint_returns_camel_case_body() -> None:
    app.dependency_overrides[get_app_identity] = lambda: AppIdentity(
        name="Test Portal", version="9.9.9"
    )
    try:
        response = TestClient(app).get("/system/info")
    finally:
        app.dependency_overrides.pop(get_app_identity, None)

    assert response.status_code == 200
    body = response.json()
    assert set(body) == {"appName", "appVersion", "serverTime", "status"}
    assert body["appName"] == "Test Portal"
    assert body["appVersion"] == "9.9.9"
    assert body["status"] == "ok"
    assert datetime.fromisoformat(body["serverTime"]).tzinfo is not None
    assert not body["serverTime"].endswith("Z")
