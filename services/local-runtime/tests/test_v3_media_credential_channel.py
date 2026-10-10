from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from navia_runtime.modules.media_companion.credential_transport import (
    CredentialChannelStore,
    CredentialEnvelopePolicy,
    CredentialLeaseStore,
    CredentialTransportPolicy,
    MediaCredentialFailure,
)


TOKEN = "runtime-token-" + "x" * 32
EXTENSION_ID = "a" * 32
ORIGIN = f"chrome-extension://{EXTENSION_ID}"
METADATA = {
    "taskId": "media_task_" + "1" * 32,
    "adapterId": "example",
    "policyId": "example-media-consent/v1",
    "policyRevision": 1,
    "browserSessionBindingSha256": "2" * 64,
    "credentialNameSetSha256": "3" * 64,
}
BILIBILI_METADATA = {
    **METADATA,
    "adapterId": "bilibili",
    "policyId": "bilibili-media-consent/v1",
    "credentialNameSetSha256": "67166981712c0b024632614b43d1c7d4ecf7e23c2557b6f76dc58318a7530fc2",
}
MARKER_SECRET = "test-only-cookie-value-never-production"


def envelope_policy():
    return CredentialEnvelopePolicy(
        adapter_id="bilibili",
        session_adapter_id="bilibili-cookie-session",
        policy_id="bilibili-media-consent/v1",
        policy_revision=1,
        envelope_schema_version="BilibiliCredentialEnvelope/v1",
        credential_name_set_sha256=BILIBILI_METADATA["credentialNameSetSha256"],
        allowed_credential_names=frozenset({"SESSDATA", "bili_jct"}),
        required_credential_names=frozenset({"SESSDATA"}),
        domain_allowed=lambda domain: domain.removeprefix(".") == "bilibili.com",
    )


def make_envelope(channel, *, envelope_id="pce_" + "6" * 32):
    return {
        "schemaVersion": "BilibiliCredentialEnvelope/v1",
        "envelopeId": envelope_id,
        "channelId": channel["channelId"],
        "taskId": channel["taskId"],
        "adapterId": channel["adapterId"],
        "sessionAdapterId": "bilibili-cookie-session",
        "policyId": channel["policyId"],
        "policyRevision": channel["policyRevision"],
        "browserSessionBindingSha256": channel["browserSessionBindingSha256"],
        "credentialNameSetSha256": channel["credentialNameSetSha256"],
        "issuedAt": "2026-09-17T10:00:05Z",
        "expiresAt": "2026-09-17T10:00:15Z",
        "credentials": [{
            "name": "SESSDATA",
            "value": MARKER_SECRET,
            "domain": ".bilibili.com",
            "path": "/",
            "secure": True,
            "httpOnly": True,
            "sameSite": "no_restriction",
            "expirationDate": None,
        }],
    }


def test_channel_store_is_one_shot_and_expires():
    clock = [datetime(2026, 9, 17, 10, 0, tzinfo=timezone.utc)]
    store = CredentialChannelStore(now=lambda: clock[0])
    token, public = store.issue(METADATA, ORIGIN)
    assert len(token) >= 43
    assert "token" not in public and "channelToken" not in public
    assert public["status"] == "issued"
    assert store.consume(token)["status"] == "consumed"
    with pytest.raises(MediaCredentialFailure, match="V3_MEDIA_CHANNEL_REPLAYED"):
        store.consume(token)

    token2, _ = store.issue(METADATA, ORIGIN)
    clock[0] += timedelta(seconds=21)
    with pytest.raises(MediaCredentialFailure, match="V3_MEDIA_CHANNEL_EXPIRED"):
        store.consume(token2)


def test_channel_metadata_is_strict():
    store = CredentialChannelStore()
    for invalid in [
        {**METADATA, "unexpected": True},
        {**METADATA, "taskId": "task"},
        {**METADATA, "policyRevision": True},
        {**METADATA, "credentialNameSetSha256": "short"},
    ]:
        with pytest.raises(MediaCredentialFailure, match="V3_MEDIA_CHANNEL_INVALID"):
            store.issue(invalid, ORIGIN)


def test_channel_store_rejects_unregistered_or_drifted_portal_policy():
    policy = CredentialTransportPolicy(
        adapter_id="example",
        policy_id="example-media-consent/v1",
        policy_revision=1,
        credential_name_set_sha256="3" * 64,
    )
    store = CredentialChannelStore(policies=(policy,))
    with pytest.raises(MediaCredentialFailure, match="V3_MEDIA_CHANNEL_INVALID"):
        store.issue({**METADATA, "adapterId": "youtube"}, ORIGIN)
    with pytest.raises(MediaCredentialFailure, match="V3_MEDIA_POLICY_NOT_GRANTED"):
        store.issue({**METADATA, "policyId": "other-media-consent/v1"}, ORIGIN)
    with pytest.raises(MediaCredentialFailure, match="V3_MEDIA_POLICY_REVISION_MISMATCH"):
        store.issue({**METADATA, "policyRevision": 2}, ORIGIN)
    with pytest.raises(MediaCredentialFailure, match="V3_MEDIA_CREDENTIAL_SET_INVALID"):
        store.issue({**METADATA, "credentialNameSetSha256": "4" * 64}, ORIGIN)


def test_channel_endpoint_requires_strong_bearer_and_exact_origin(monkeypatch):
    import navia_runtime.app as runtime_app

    runtime_app.media_credential_channel_store.clear()
    client = TestClient(runtime_app.app)
    monkeypatch.setenv("NAVIA_LOCAL_FILES_EXTENSION_ID", EXTENSION_ID)
    monkeypatch.setenv("NAVIA_LOCAL_FILES_TOKEN", TOKEN)

    def post(headers=None):
        return client.post("/v1/media/credential-channels", json=BILIBILI_METADATA, headers=headers or {})

    assert post({"Origin": ORIGIN}).json()["error"]["code"] == "V3_MEDIA_RUNTIME_AUTH_REQUIRED"
    assert post({"Origin": ORIGIN, "Authorization": "Bearer wrong"}).json()["error"]["code"] == "V3_MEDIA_RUNTIME_AUTH_REQUIRED"
    assert post({"Origin": "chrome-extension://" + "b" * 32, "Authorization": f"Bearer {TOKEN}"}).json()["error"]["code"] == "V3_MEDIA_RUNTIME_ORIGIN_MISMATCH"
    assert post({"Origin": "http://127.0.0.1:5173", "Authorization": f"Bearer {TOKEN}"}).json()["error"]["code"] == "V3_MEDIA_RUNTIME_ORIGIN_MISMATCH"
    assert runtime_app.media_credential_channel_store.size() == 0

    response = post({"Origin": ORIGIN, "Authorization": f"Bearer {TOKEN}"})
    assert response.status_code == 201
    assert response.headers["cache-control"] == "no-store"
    assert response.headers["access-control-allow-origin"] == ORIGIN
    payload = response.json()["data"]
    assert len(payload["channelToken"]) >= 43
    assert payload["channel"]["status"] == "issued"
    assert "channelToken" not in payload["channel"]


def test_channel_endpoint_rejects_weak_runtime_configuration(monkeypatch):
    import navia_runtime.app as runtime_app

    runtime_app.media_credential_channel_store.clear()
    monkeypatch.setenv("NAVIA_LOCAL_FILES_EXTENSION_ID", EXTENSION_ID)
    monkeypatch.setenv("NAVIA_LOCAL_FILES_TOKEN", "weak")
    response = TestClient(runtime_app.app).post(
        "/v1/media/credential-channels",
        json=BILIBILI_METADATA,
        headers={"Origin": ORIGIN, "Authorization": "Bearer weak"},
    )
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "V3_MEDIA_RUNTIME_AUTH_REQUIRED"
    assert runtime_app.media_credential_channel_store.size() == 0


def test_lease_store_keeps_credentials_only_in_memory_and_expires():
    clock = [datetime(2026, 9, 17, 10, 0, 5, tzinfo=timezone.utc)]
    channels = CredentialChannelStore(now=lambda: clock[0] - timedelta(seconds=5))
    token, _ = channels.issue(BILIBILI_METADATA, ORIGIN)
    channel = channels.consume(token)
    leases = CredentialLeaseStore(policies=(envelope_policy(),), now=lambda: clock[0])
    revocation_token, public = leases.issue(channel, make_envelope(channel))
    assert len(revocation_token) >= 43
    assert MARKER_SECRET not in str(public)
    assert "revocationToken" not in public
    assert public["serverValidationStatus"] == "not_performed"
    assert leases.resolve_credentials(public["leaseId"], channel["taskId"])[0]["value"] == MARKER_SECRET
    with pytest.raises(MediaCredentialFailure, match="V3_MEDIA_LEASE_TASK_MISMATCH"):
        leases.resolve_credentials(public["leaseId"], "media_task_" + "f" * 32)
    clock[0] += timedelta(seconds=61)
    with pytest.raises(MediaCredentialFailure, match="V3_MEDIA_LEASE_EXPIRED"):
        leases.resolve_credentials(public["leaseId"], channel["taskId"])
    assert leases.size() == 0


def test_lease_store_actively_clears_idle_credentials_at_deadline():
    clock = datetime(2026, 9, 17, 10, 0, 5, tzinfo=timezone.utc)
    scheduled = []

    def schedule(delay_seconds, callback):
        scheduled.append((delay_seconds, callback))
        return lambda: None

    channels = CredentialChannelStore(now=lambda: clock - timedelta(seconds=5))
    token, _ = channels.issue(BILIBILI_METADATA, ORIGIN)
    channel = channels.consume(token)
    leases = CredentialLeaseStore(
        policies=(envelope_policy(),),
        now=lambda: clock,
        schedule=schedule,
    )
    revocation_token, public = leases.issue(channel, make_envelope(channel))
    assert scheduled[0][0] == 60
    assert leases.size() == 1

    scheduled[0][1]()

    assert leases.size() == 0
    with pytest.raises(MediaCredentialFailure, match="V3_MEDIA_LEASE_EXPIRED"):
        leases.resolve_credentials(public["leaseId"], channel["taskId"])
    with pytest.raises(MediaCredentialFailure, match="V3_MEDIA_LEASE_EXPIRED"):
        leases.revoke(public["leaseId"], revocation_token)


def test_channel_expiry_removes_raw_capability_and_preserves_public_terminal_record():
    clock = [datetime(2026, 9, 17, 10, 0, tzinfo=timezone.utc)]
    store = CredentialChannelStore(now=lambda: clock[0])
    token, public = store.issue(METADATA, ORIGIN)
    clock[0] += timedelta(seconds=21)
    assert store.size() == 0
    record = store.public_record(public["channelId"])
    assert record is not None
    assert record["status"] == "expired"
    assert record["failureCode"] == "V3_MEDIA_CHANNEL_EXPIRED"
    with pytest.raises(MediaCredentialFailure, match="V3_MEDIA_CHANNEL_EXPIRED"):
        store.consume(token)


def test_lease_revoke_requires_capability_and_clears_credentials():
    clock = datetime(2026, 9, 17, 10, 0, 5, tzinfo=timezone.utc)
    channels = CredentialChannelStore(now=lambda: clock - timedelta(seconds=5))
    token, _ = channels.issue(BILIBILI_METADATA, ORIGIN)
    channel = channels.consume(token)
    leases = CredentialLeaseStore(policies=(envelope_policy(),), now=lambda: clock)
    revocation_token, public = leases.issue(channel, make_envelope(channel))

    with pytest.raises(MediaCredentialFailure, match="V3_MEDIA_LEASE_REVOKED"):
        leases.revoke(public["leaseId"], "wrong-revocation-token")
    assert leases.resolve_credentials(public["leaseId"], channel["taskId"])[0]["value"] == MARKER_SECRET

    revoked = leases.revoke(public["leaseId"], revocation_token)
    assert revoked["state"] == "revoked"
    assert revoked["failureCode"] == "V3_MEDIA_LEASE_REVOKED"
    assert leases.size() == 0
    with pytest.raises(MediaCredentialFailure, match="V3_MEDIA_LEASE_EXPIRED"):
        leases.resolve_credentials(public["leaseId"], channel["taskId"])


def test_fresh_runtime_stores_do_not_restore_channels_leases_or_replay_cache():
    clock = datetime(2026, 9, 17, 10, 0, 5, tzinfo=timezone.utc)
    channels = CredentialChannelStore(now=lambda: clock - timedelta(seconds=5))
    token, _ = channels.issue(BILIBILI_METADATA, ORIGIN)
    channel = channels.consume(token)
    leases = CredentialLeaseStore(policies=(envelope_policy(),), now=lambda: clock)
    _, public = leases.issue(channel, make_envelope(channel))

    restarted_channels = CredentialChannelStore(now=lambda: clock)
    restarted_leases = CredentialLeaseStore(policies=(envelope_policy(),), now=lambda: clock)
    assert restarted_channels.size() == 0
    assert restarted_leases.size() == 0
    with pytest.raises(MediaCredentialFailure, match="V3_MEDIA_CHANNEL_INVALID"):
        restarted_channels.consume(token)
    with pytest.raises(MediaCredentialFailure, match="V3_MEDIA_LEASE_EXPIRED"):
        restarted_leases.resolve_credentials(public["leaseId"], channel["taskId"])


def test_lease_store_rejects_envelope_replay_with_a_new_channel():
    clock = datetime(2026, 9, 17, 10, 0, 5, tzinfo=timezone.utc)
    channels = CredentialChannelStore(now=lambda: clock - timedelta(seconds=5))
    leases = CredentialLeaseStore(policies=(envelope_policy(),), now=lambda: clock)
    token, _ = channels.issue(BILIBILI_METADATA, ORIGIN)
    first = channels.consume(token)
    leases.issue(first, make_envelope(first))
    token2, _ = channels.issue(BILIBILI_METADATA, ORIGIN)
    second = channels.consume(token2)
    replay = make_envelope(second)
    replay["channelId"] = second["channelId"]
    with pytest.raises(MediaCredentialFailure, match="V3_MEDIA_ENVELOPE_REPLAYED"):
        leases.issue(second, replay)
    assert leases.size() == 1


@pytest.mark.parametrize(("mutation", "failure_code"), [
    (lambda body: body.update(taskId="media_task_" + "f" * 32), "V3_MEDIA_LEASE_TASK_MISMATCH"),
    (lambda body: body.update(adapterId="youtube"), "V3_MEDIA_ENVELOPE_INVALID"),
    (lambda body: body.update(policyId="other-media-consent/v1"), "V3_MEDIA_POLICY_NOT_GRANTED"),
    (lambda body: body.update(policyRevision=2), "V3_MEDIA_POLICY_REVISION_MISMATCH"),
    (lambda body: body.update(browserSessionBindingSha256="f" * 64), "V3_MEDIA_CHANNEL_INVALID"),
    (lambda body: body.update(credentialNameSetSha256="f" * 64), "V3_MEDIA_CREDENTIAL_SET_INVALID"),
    (lambda body: body["credentials"][0].update(name="not_allowed"), "V3_MEDIA_CREDENTIAL_SET_INVALID"),
    (lambda body: body["credentials"][0].update(domain=".attacker.invalid"), "V3_MEDIA_CREDENTIAL_SET_INVALID"),
    (lambda body: body.update(unexpected=True), "V3_MEDIA_ENVELOPE_INVALID"),
])
def test_lease_store_rejects_tampering_with_exact_failure(mutation, failure_code):
    clock = datetime(2026, 9, 17, 10, 0, 5, tzinfo=timezone.utc)
    channels = CredentialChannelStore(now=lambda: clock - timedelta(seconds=5))
    token, _ = channels.issue(BILIBILI_METADATA, ORIGIN)
    channel = channels.consume(token)
    leases = CredentialLeaseStore(policies=(envelope_policy(),), now=lambda: clock)
    envelope = make_envelope(channel)
    mutation(envelope)
    with pytest.raises(MediaCredentialFailure, match=failure_code):
        leases.issue(channel, envelope)
    assert leases.size() == 0


def test_lease_endpoint_consumes_ticket_before_body_decode(monkeypatch):
    import navia_runtime.app as runtime_app

    runtime_app.media_credential_channel_store.clear()
    runtime_app.media_credential_lease_store.clear()
    monkeypatch.setenv("NAVIA_LOCAL_FILES_EXTENSION_ID", EXTENSION_ID)
    monkeypatch.setenv("NAVIA_LOCAL_FILES_TOKEN", TOKEN)
    client = TestClient(runtime_app.app)
    bootstrap = client.post(
        "/v1/media/credential-channels",
        json=BILIBILI_METADATA,
        headers={"Origin": ORIGIN, "Authorization": f"Bearer {TOKEN}"},
    ).json()["data"]
    headers = {
        "Origin": ORIGIN,
        "Authorization": f"Navia-Media-Channel {bootstrap['channelToken']}",
        "Content-Type": "application/json",
    }
    malformed = client.post("/v1/media/credential-leases", content=b"{", headers=headers)
    assert malformed.status_code == 400
    assert malformed.json()["error"]["code"] == "V3_MEDIA_ENVELOPE_INVALID"
    replay = client.post("/v1/media/credential-leases", json={}, headers=headers)
    assert replay.status_code == 409
    assert replay.json()["error"]["code"] == "V3_MEDIA_CHANNEL_REPLAYED"
    assert runtime_app.media_credential_lease_store.size() == 0


def test_lease_endpoint_returns_public_lease_without_cookie_material(monkeypatch):
    import navia_runtime.app as runtime_app

    runtime_app.media_credential_channel_store.clear()
    runtime_app.media_credential_lease_store.clear()
    monkeypatch.setenv("NAVIA_LOCAL_FILES_EXTENSION_ID", EXTENSION_ID)
    monkeypatch.setenv("NAVIA_LOCAL_FILES_TOKEN", TOKEN)
    client = TestClient(runtime_app.app)
    bootstrap = client.post(
        "/v1/media/credential-channels",
        json=BILIBILI_METADATA,
        headers={"Origin": ORIGIN, "Authorization": f"Bearer {TOKEN}"},
    ).json()["data"]
    channel = bootstrap["channel"]
    issued = datetime.now(timezone.utc)
    envelope = make_envelope(channel, envelope_id="pce_" + "7" * 32)
    envelope["issuedAt"] = issued.isoformat().replace("+00:00", "Z")
    envelope["expiresAt"] = (issued + timedelta(seconds=10)).isoformat().replace("+00:00", "Z")
    response = client.post(
        "/v1/media/credential-leases",
        json=envelope,
        headers={
            "Origin": ORIGIN,
            "Authorization": f"Navia-Media-Channel {bootstrap['channelToken']}",
        },
    )
    assert response.status_code == 201
    assert response.headers["cache-control"] == "no-store"
    data = response.json()["data"]
    assert len(data["revocationToken"]) >= 43
    assert MARKER_SECRET not in str(data["lease"])
    assert "credentials" not in data["lease"]
    assert data["lease"]["credentialCount"] == 1
    assert data["lease"]["serverValidationStatus"] == "not_performed"

    missing = client.delete(
        f"/v1/media/credential-leases/{data['lease']['leaseId']}",
        headers={"Origin": ORIGIN},
    )
    assert missing.status_code == 403
    assert missing.json()["error"]["code"] == "V3_MEDIA_LEASE_REVOKED"
    assert runtime_app.media_credential_lease_store.size() == 1

    wrong = client.delete(
        f"/v1/media/credential-leases/{data['lease']['leaseId']}",
        headers={"Origin": ORIGIN, "Authorization": "Navia-Media-Revoke wrong"},
    )
    assert wrong.status_code == 403
    assert wrong.json()["error"]["code"] == "V3_MEDIA_LEASE_REVOKED"
    assert runtime_app.media_credential_lease_store.size() == 1

    revoked = client.delete(
        f"/v1/media/credential-leases/{data['lease']['leaseId']}",
        headers={"Origin": ORIGIN, "Authorization": f"Navia-Media-Revoke {data['revocationToken']}"},
    )
    assert revoked.status_code == 200
    assert revoked.headers["cache-control"] == "no-store"
    assert revoked.json()["data"]["lease"]["state"] == "revoked"
    assert MARKER_SECRET not in revoked.text
    assert runtime_app.media_credential_lease_store.size() == 0
