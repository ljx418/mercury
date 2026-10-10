from __future__ import annotations

import copy
import hashlib
import json
import sqlite3
from pathlib import Path

import jsonschema
import pytest
from fastapi.testclient import TestClient

from navia_runtime.modules.media_companion.outline import (
    DeterministicExtractiveOutlineGenerator,
    MediaOutlineError,
    canonical_bytes,
    validate_outline_bundle,
)
from navia_runtime.modules.media_companion.task_store import MediaTaskStore, MediaTaskStoreError
from navia_runtime import app as app_module


TASK = "media_task_" + "1" * 32
SOURCE = "portal:bilibili:BV1ZpYd66ELP:41828944992:1"


def evidence(task_id: str = TASK) -> list[dict]:
    return [
        {
            "evidenceId": "mtr_" + "1" * 32,
            "taskId": task_id,
            "kind": "transcript",
            "timestampStartMs": 0,
            "timestampEndMs": 40_000,
            "contentSha256": hashlib.sha256("第一段真实转写内容".encode()).hexdigest(),
            "relativeArtifactRef": "evidence/transcript-0001.json",
            "text": "第一段真实转写内容，介绍视频主题。",
        },
        {
            "evidenceId": "mev_" + "2" * 32,
            "taskId": task_id,
            "kind": "vision_caption",
            "timestampStartMs": 65_000,
            "timestampEndMs": 65_001,
            "contentSha256": hashlib.sha256("画面显示流程图".encode()).hexdigest(),
            "relativeArtifactRef": "evidence/vision-0001.json",
            "text": "画面显示流程图与标题。",
        },
    ]


def progress_to_synthesizing(store: MediaTaskStore) -> int:
    store.create(TASK, SOURCE)
    revision = 1
    for state in ("acquiring", "transcribing", "extracting_frames", "analyzing_vision", "synthesizing"):
        store.transition(TASK, revision, state)
        revision += 1
    return revision


def bundle(revision: int = 7, *, state: str = "ready") -> dict:
    return DeterministicExtractiveOutlineGenerator().generate(
        task_id=TASK,
        source_identity=SOURCE,
        revision=revision,
        source_title="真实 B 站视频",
        evidence=evidence(),
        state=state,
        terminal_failure_code="LOW_SIGNAL_CONTENT" if state == "degraded" else None,
    )


def test_generator_is_deterministic_private_text_is_not_in_catalog_and_schema_valid() -> None:
    first = bundle()
    second = bundle()
    assert canonical_bytes(first) == canonical_bytes(second)
    assert all("text" not in item for item in first["evidenceCatalog"])
    validate_outline_bundle(first)
    root = Path(__file__).resolve().parents[3]
    schema = json.loads((root / "docs/active/project/contracts/v3_media_outline_taskstore_v2.schema.json").read_text())
    store = MediaTaskStore(":memory:")
    expected = progress_to_synthesizing(store)
    envelope = store.commit_terminal(first, expected_revision=expected, idempotency_key="publish-001")
    jsonschema.Draft202012Validator(schema, format_checker=jsonschema.FormatChecker()).validate(envelope)


def test_generator_rejects_cross_task_path_escape_and_empty_evidence() -> None:
    invalid = evidence("media_task_" + "2" * 32)
    with pytest.raises(MediaOutlineError, match="belong"):
        DeterministicExtractiveOutlineGenerator().generate(
            task_id=TASK, source_identity=SOURCE, revision=2, source_title="x", evidence=invalid,
        )
    invalid = evidence()
    invalid[0]["relativeArtifactRef"] = "../secret.json"
    with pytest.raises(MediaOutlineError, match="path"):
        DeterministicExtractiveOutlineGenerator().generate(
            task_id=TASK, source_identity=SOURCE, revision=2, source_title="x", evidence=invalid,
        )
    with pytest.raises(MediaOutlineError, match="real evidence"):
        DeterministicExtractiveOutlineGenerator().generate(
            task_id=TASK, source_identity=SOURCE, revision=2, source_title="x", evidence=[],
        )


def test_store_atomic_publish_idempotent_replay_and_restart(tmp_path: Path) -> None:
    path = tmp_path / "navia.sqlite3"
    store = MediaTaskStore(path)
    expected = progress_to_synthesizing(store)
    candidate = bundle(expected + 1)
    first = store.commit_terminal(candidate, expected_revision=expected, idempotency_key="publish-001")
    replay = store.commit_terminal(candidate, expected_revision=expected, idempotency_key="publish-001")
    assert replay == first
    assert store.transaction_counts(TASK) == {"eventCount": 7, "outboxCount": 1, "outlineCount": 1}
    reopened = MediaTaskStore(path).get(TASK)
    assert reopened["state"] == "ready"
    assert reopened["revision"] == expected + 1
    assert reopened["projections"]["outline"]["outlineId"] == first["outline"]["outlineId"]


@pytest.mark.parametrize("fault", ["before_aggregate", "after_aggregate", "after_event", "after_outbox", "before_commit"])
def test_store_fault_injection_rolls_back_every_write(tmp_path: Path, fault: str) -> None:
    store = MediaTaskStore(tmp_path / f"{fault}.sqlite3")
    expected = progress_to_synthesizing(store)
    with pytest.raises(RuntimeError, match="fault"):
        store.commit_terminal(bundle(expected + 1), expected_revision=expected, idempotency_key="publish-001", fault_at=fault)
    current = store.get(TASK)
    assert current["state"] == "synthesizing"
    assert current["revision"] == expected
    assert current["projections"] is None
    assert store.transaction_counts(TASK) == {"eventCount": 6, "outboxCount": 0, "outlineCount": 0}


def test_store_rejects_stale_revision_and_idempotency_payload_change(tmp_path: Path) -> None:
    store = MediaTaskStore(tmp_path / "navia.sqlite3")
    expected = progress_to_synthesizing(store)
    original = bundle(expected + 1)
    store.commit_terminal(original, expected_revision=expected, idempotency_key="publish-001")
    changed = copy.deepcopy(original)
    changed["outline"]["title"] = "changed"
    with pytest.raises(MediaTaskStoreError) as caught:
        store.commit_terminal(changed, expected_revision=expected, idempotency_key="publish-001")
    assert caught.value.code == "TASK_IDENTITY_MISMATCH"
    with pytest.raises(MediaTaskStoreError) as caught:
        store.transition(TASK, expected, "failed")
    assert caught.value.code == "TASK_REVISION_CONFLICT"


def test_store_rejects_projection_publish_before_synthesizing(tmp_path: Path) -> None:
    store = MediaTaskStore(tmp_path / "navia.sqlite3")
    store.create(TASK, SOURCE)
    with pytest.raises(MediaTaskStoreError) as caught:
        store.commit_terminal(bundle(2), expected_revision=1, idempotency_key="publish-early")
    assert caught.value.code == "TASK_TRANSITION_INVALID"


def test_blocked_zero_projection_retry_and_cancel_barrier(tmp_path: Path) -> None:
    blocked_task = "media_task_" + "3" * 32
    source = "portal:bilibili:BV1vt1sBgEzc:33724694904:1"
    store = MediaTaskStore(tmp_path / "navia.sqlite3")
    store.create(blocked_task, source)
    candidate = DeterministicExtractiveOutlineGenerator.blocked(
        task_id=blocked_task, source_identity=source, revision=2, failure_code="MEDIA_ACCESS_RESTRICTED",
    )
    envelope = store.commit_terminal(candidate, expected_revision=1, idempotency_key="blocked-001")
    assert envelope["outline"] is None and envelope["timeline"] == [] and envelope["mindmap"] is None
    retried = store.retry(blocked_task, 2)
    assert retried["state"] == "created" and retried["revision"] == 3
    cancelled = store.cancel(blocked_task, 3)
    assert cancelled["state"] == "cancelled" and cancelled["projections"] is None


def test_recovery_marks_uncertain_outbox_failed_without_replay(tmp_path: Path) -> None:
    store = MediaTaskStore(tmp_path / "navia.sqlite3")
    store.create(TASK, SOURCE)
    now = "2026-10-08T00:00:00Z"
    store._conn.execute(
        "INSERT INTO media_task_outbox VALUES (?,?,?,?,?,?,?,?)",
        ("outbox_" + "1" * 32, TASK, 1, "provider_dispatch", "in_progress", "a" * 64, now, now),
    )
    recovered = store.recover()
    assert len(recovered) == 1
    assert recovered[0]["state"] == "failed"
    assert recovered[0]["terminalFailureCode"] == "TASK_RECOVERY_UNCERTAIN"
    status = store._conn.execute("SELECT status FROM media_task_outbox").fetchone()[0]
    assert status == "uncertain"


def test_outline_task_api_requires_session_and_recovers_from_store(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    store = MediaTaskStore(tmp_path / "api.sqlite3")
    monkeypatch.setattr(app_module, "media_outline_task_store", store)
    extension_id = "a" * 32
    origin = f"chrome-extension://{extension_id}"
    monkeypatch.setenv("NAVIA_LOCAL_FILES_EXTENSION_ID", extension_id)
    app_module.companion_session_broker.clear()
    client = TestClient(app_module.app)
    assert client.post("/v1/media/outline-tasks", json={"sourceIdentity": SOURCE}).status_code == 401
    session = app_module.companion_session_broker.issue(origin)
    headers = {"Authorization": f"Bearer {session['token']}", "Origin": origin}
    created = client.post("/v1/media/outline-tasks", headers=headers, json={"sourceIdentity": SOURCE})
    assert created.status_code == 201
    task = created.json()["data"]["task"]
    direct = client.get(f"/v1/media/outline-tasks/{task['taskId']}", headers=headers)
    latest = client.get("/v1/media/outline-tasks", headers=headers, params={"sourceIdentity": SOURCE})
    assert direct.json()["data"]["task"]["taskId"] == task["taskId"]
    assert latest.json()["data"]["task"]["taskId"] == task["taskId"]
    listed = client.get("/v1/media/outline-tasks", headers=headers)
    assert [item["taskId"] for item in listed.json()["data"]["tasks"]] == [task["taskId"]]
    assert "projections" not in listed.json()["data"]["tasks"][0]
    assert client.get("/v1/media/outline-tasks", headers=headers, params={"limit": 0}).status_code == 400
    cancelled = client.post(
        f"/v1/media/outline-tasks/{task['taskId']}/cancel",
        headers=headers,
        json={"expectedRevision": 1},
    )
    assert cancelled.json()["data"]["task"]["state"] == "cancelled"
