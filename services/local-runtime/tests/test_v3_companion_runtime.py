from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from jsonschema import Draft202012Validator, FormatChecker

from navia_runtime.companion import read_config, single_instance_lock, write_config
from navia_runtime.modules.companion import CompanionFailure, CompanionSessionBroker


EXTENSION_ID = "a" * 32
ORIGIN = f"chrome-extension://{EXTENSION_ID}"


def test_companion_contract_schema_accepts_status_session_and_stop(monkeypatch):
    root = Path(__file__).resolve().parents[3]
    schema = json.loads((root / "docs/active/project/contracts/v3_companion_runtime_v1.schema.json").read_text())
    validator = Draft202012Validator(schema, format_checker=FormatChecker())
    monkeypatch.setenv("NAVIA_LOCAL_FILES_EXTENSION_ID", EXTENSION_ID)
    broker = CompanionSessionBroker()
    session = broker.issue(ORIGIN)
    validator.validate(broker.status())
    validator.validate(session)
    validator.validate(broker.begin_stop(f"Bearer {session['token']}", ORIGIN))


def test_broker_rejects_wrong_origin_and_expires_without_persisting_token(monkeypatch):
    clock = [datetime(2026, 10, 7, tzinfo=timezone.utc)]
    monkeypatch.setenv("NAVIA_LOCAL_FILES_EXTENSION_ID", EXTENSION_ID)
    broker = CompanionSessionBroker(now=lambda: clock[0], ttl_seconds=10)
    with pytest.raises(CompanionFailure, match="V3_COMPANION_ORIGIN_MISMATCH"):
        broker.issue("chrome-extension://" + "b" * 32)
    session = broker.issue(ORIGIN)
    assert session["persisted"] is False
    assert broker.authenticate(f"Bearer {session['token']}", ORIGIN)["sessionId"] == session["sessionId"]
    assert broker.authenticate(f"Bearer {session['token']}", None)["sessionId"] == session["sessionId"]
    with pytest.raises(CompanionFailure, match="V3_COMPANION_ORIGIN_MISMATCH"):
        broker.authenticate(f"Bearer {session['token']}", "chrome-extension://" + "b" * 32)
    clock[0] += timedelta(seconds=10)
    with pytest.raises(CompanionFailure, match="V3_COMPANION_SESSION_EXPIRED"):
        broker.authenticate(f"Bearer {session['token']}", ORIGIN)


def test_broker_revocation_is_terminal(monkeypatch):
    monkeypatch.setenv("NAVIA_LOCAL_FILES_EXTENSION_ID", EXTENSION_ID)
    broker = CompanionSessionBroker()
    session = broker.issue(ORIGIN)
    authorization = f"Bearer {session['token']}"
    assert broker.revoke(authorization, ORIGIN)["status"] == "revoked"
    with pytest.raises(CompanionFailure, match="V3_COMPANION_SESSION_REVOKED"):
        broker.authenticate(authorization, ORIGIN)


def test_runtime_session_bootstrap_and_media_auth_share_ephemeral_session(monkeypatch):
    import navia_runtime.app as runtime_app

    monkeypatch.setenv("NAVIA_LOCAL_FILES_EXTENSION_ID", EXTENSION_ID)
    monkeypatch.setenv("NAVIA_LOCAL_FILES_TOKEN", "master-" + "x" * 40)
    runtime_app.companion_session_broker.clear()
    client = TestClient(runtime_app.app)
    denied = client.post("/v1/companion/sessions", headers={"Origin": "chrome-extension://" + "b" * 32})
    assert denied.status_code == 403
    response = client.post("/v1/companion/sessions", headers={"Origin": ORIGIN})
    assert response.status_code == 201
    session = response.json()["data"]
    assert response.headers["cache-control"] == "no-store"
    status = client.get("/v1/companion/status", headers={"Origin": ORIGIN})
    assert status.json()["data"]["runtimeInstanceId"] == session["runtimeInstanceId"]
    revoked = client.delete(
        "/v1/companion/sessions/current",
        headers={"Origin": ORIGIN, "Authorization": f"Bearer {session['token']}"},
    )
    assert revoked.status_code == 200


def test_companion_session_authorizes_permissions_without_legacy_master_token(monkeypatch):
    import navia_runtime.app as runtime_app

    monkeypatch.setenv("NAVIA_LOCAL_FILES_EXTENSION_ID", EXTENSION_ID)
    monkeypatch.delenv("NAVIA_LOCAL_FILES_TOKEN", raising=False)
    runtime_app.companion_session_broker.clear()
    client = TestClient(runtime_app.app)
    response = client.post("/v1/companion/sessions", headers={"Origin": ORIGIN})
    assert response.status_code == 201
    token = response.json()["data"]["token"]
    permissions = client.get(
        "/v1/knowledge/permissions?workspaceId=ws_default",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert permissions.status_code == 200


def test_companion_config_contains_no_secret_and_lock_rejects_second_process(tmp_path):
    path = tmp_path / "companion.json"
    write_config(path, EXTENSION_ID, 17861)
    assert read_config(path)["extensionId"] == EXTENSION_ID
    raw = path.read_text()
    assert "token" not in raw.lower()
    with single_instance_lock(path.with_suffix(".lock")):
        with pytest.raises(RuntimeError, match="V3_COMPANION_ALREADY_RUNNING"):
            with single_instance_lock(path.with_suffix(".lock")):
                pass
