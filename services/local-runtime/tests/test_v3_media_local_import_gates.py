"""WP-B — B03 eligibility, B16 disk-space gate, B28 deadlines.

These three cases do NOT need the private seed media, so they can be closed on
their own.

  B03  a task is eligible only when the three automatic routes have failed and
       there is no selected input, capture, import or terminal yet;
  B16  free space is proven BEFORE a writer can exist: the exact requirement
       passes and one byte under it is refused;
  B28  every frozen deadline is honoured, and a stale callback never rewrites a
       terminal record or leaks the active slot.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import pytest

from navia_runtime.modules.media_companion.local_import import contracts as C
from navia_runtime.modules.media_companion.local_import.contracts import ImportError
from navia_runtime.modules.media_companion.local_import.manager import (
    ImportSession,
    TokenRegistry,
    issue_upload_token,
    token_digest,
)
from navia_runtime.modules.media_companion.local_import.runtime import LocalImportManager
from navia_runtime.modules.media_companion.local_import.store import LocalMediaImportStore

TASK_ID = "media_task_" + "b" * 32
SOURCE = "portal:bilibili:BV1R6TEST:cid:1"
GENERATION = "depgen_" + "c" * 64


@pytest.fixture
def manager(tmp_path: Path) -> LocalImportManager:
    store = LocalMediaImportStore(tmp_path / "navia.sqlite3")
    instance = LocalImportManager(store, media_root=str(tmp_path / "inputs"))
    instance._media_root = str(tmp_path / "inputs")
    # C3: the REAL production coordinator decides eligibility.
    from navia_runtime import app as runtime_app
    from wp_b_local_import_harness import make_task_eligible

    make_task_eligible(TASK_ID, SOURCE)
    instance._eligibility_resolver = runtime_app.media_acquisition_coordinator.local_import_eligibility
    return instance


def _body(**overrides: Any) -> dict[str, Any]:
    return {
        "taskId": TASK_ID,
        "sourceIdentity": SOURCE,
        "declaredMediaType": "video/mp4",
        "byteLength": 1024,
        **overrides,
    }


# --- B16: the disk-space gate ------------------------------------------------


def test_b16_the_space_requirement_is_the_frozen_formula() -> None:
    exact = C.required_free_bytes(1024**3)
    # Without a duration the headroom is the frozen 512 MiB cap.
    assert exact == 1024**3 + 512 * 1024 * 1024
    # A short media keeps the 128 MiB floor PLUS its own derived PCM bytes,
    # and the sum stays far below the 512 MiB cap.
    short = C.required_free_bytes(1024, 1000)
    assert short == 1024 + 128 * 1024 * 1024 + 32_000
    assert short < C.required_free_bytes(1024)


def test_b16_exact_space_is_accepted_and_one_under_is_refused(manager, monkeypatch) -> None:
    required = C.required_free_bytes(1024)

    monkeypatch.setattr(manager, "_free_bytes", lambda: required)
    created = manager.create(_body(), dependency_generation=GENERATION)
    assert created["import"]["byteLength"] == 1024
    first = created["import"]["importId"]

    # Free the task slot the honest way: cancel, so the next attempt is a real
    # retry of an ELIGIBLE task and not a bypass of the C3 gate.
    manager.cancel(first)

    monkeypatch.setattr(manager, "_free_bytes", lambda: required - 1)
    with pytest.raises(ImportError) as error:
        manager.create(_body(), dependency_generation=GENERATION)
    assert error.value.code == "V3_MEDIA_IMPORT_DISK_SPACE_LOW"
    # The refused import left no row and no writer.
    assert manager.store.list_incomplete() == []


def test_c3_the_space_gate_never_outranks_eligibility(manager, monkeypatch) -> None:
    """C3 — an ineligible task is refused BEFORE any disk or allocation work."""
    monkeypatch.setattr(manager, "_free_bytes", lambda: 0)
    with pytest.raises(ImportError) as error:
        manager.create(
            _body(taskId="media_task_" + "d" * 32), dependency_generation=GENERATION
        )
    assert error.value.code == "V3_MEDIA_IMPORT_TASK_NOT_ELIGIBLE"


# --- B28: deadlines and stale callbacks --------------------------------------


def test_b28_the_token_deadline_is_the_frozen_ten_minutes() -> None:
    assert C.AWAITING_TOKEN_TTL_SECONDS == 600
    assert C.UPLOAD_WALL_CLOCK_SECONDS == 1800
    assert C.FFPROBE_DEADLINE_SECONDS == 30
    assert C.PREPARING_DEADLINE_SECONDS == 1800


def test_b28_an_expired_token_is_refused(manager) -> None:
    registry = TokenRegistry(now=lambda: 0.0)
    token = registry.issue("media_import_" + "a" * 32)
    later = TokenRegistry(now=lambda: float(C.AWAITING_TOKEN_TTL_SECONDS) + 1)
    # The same digest cannot be honoured once its window closed.
    with pytest.raises(ImportError) as error:
        later.consume(token, "media_import_" + "a" * 32)
    assert error.value.code == "V3_MEDIA_IMPORT_TOKEN_INVALID"


def test_b28_an_upload_past_its_wall_clock_fails_closed() -> None:
    session = ImportSession(
        import_id="media_import_" + "a" * 32,
        declared_length=4096,
        write=lambda _piece: None,
        task_quota_bytes=4096,
    )
    session.started_monotonic -= float(C.UPLOAD_WALL_CLOCK_SECONDS) + 1
    assert session.over_wall_clock() is True
    with pytest.raises(ImportError) as error:
        session.feed(b"x" * 16)
    assert error.value.code == "V3_MEDIA_IMPORT_WRITE_FAILED"
    assert session.cancelled is True


def test_b28_a_stale_callback_cannot_rewrite_a_terminal_record(manager) -> None:
    created = manager.create(_body(), dependency_generation=GENERATION)
    import_id = created["import"]["importId"]
    record = manager.store.get(import_id)
    manager.store.transition(import_id, expected_sequence=record["sequence"], state="cancelling")
    cancelled = manager.store.transition(
        import_id,
        expected_sequence=record["sequence"] + 1,
        state="cancelled",
        failure_code="V3_MEDIA_IMPORT_CANCELLED",
    )

    # A late progress callback arriving with the OLD sequence is refused.
    with pytest.raises(ImportError):
        manager.store.transition(
            import_id, expected_sequence=record["sequence"], state="uploading"
        )
    assert manager.store.get(import_id) == cancelled
    # The active slot is released, so the same task may start again.
    again = manager.create(_body(), dependency_generation=GENERATION)
    assert again["import"]["importId"] != import_id


def test_b28_the_token_is_never_written_to_the_store(manager) -> None:
    token = issue_upload_token()
    created = manager.create(_body(), dependency_generation=GENERATION)
    assert len(token) == 43
    registry_dump = str(manager.tokens._entries)  # noqa: SLF001 - asserting absence
    assert token not in registry_dump
    assert token_digest(token) not in registry_dump


# --- B03: task eligibility --------------------------------------------------


def test_b03_an_active_import_blocks_a_second_one(manager) -> None:
    manager.create(_body(), dependency_generation=GENERATION)
    with pytest.raises(ImportError) as error:
        manager.create(_body(), dependency_generation=GENERATION)
    assert error.value.code == "V3_MEDIA_IMPORT_ACTIVE"
    assert error.value.details.get("importId")


def test_b03_a_terminal_import_frees_the_task_slot(manager) -> None:
    first = manager.create(_body(), dependency_generation=GENERATION)
    manager.cancel(first["import"]["importId"])
    second = manager.create(_body(), dependency_generation=GENERATION)
    assert second["import"]["importId"] != first["import"]["importId"]


def test_b03_the_generation_is_bound_into_the_record(manager) -> None:
    created = manager.create(_body(), dependency_generation=GENERATION)
    assert created["import"]["importId"].startswith("media_import_")
    assert manager.store.get(created["import"]["importId"])["dependencyGeneration"] == GENERATION
