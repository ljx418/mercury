"""WP-B corrective C3 — eligibility is proved BEFORE anything is allocated.

These tests use the REAL `MediaAcquisitionCoordinator` (no fake with a
different signature) and the REAL import manager. The oracle is the observable
consequence: a rejected create must leave NO import record, NO token and NO
sandbox, and an eligible create must succeed.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from navia_runtime.modules.media_companion.acquisition.coordinator import (
    CAPTURE_FALLBACK_ROUTES,
    MediaAcquisitionCoordinator,
    MediaAcquisitionError,
    MediaAcquisitionRequest,
)
from navia_runtime.modules.media_companion.acquisition.task_artifacts import (
    TaskArtifactSandbox,
)
from navia_runtime.modules.media_companion.local_import.contracts import ImportError
from navia_runtime.modules.media_companion.local_import.runtime import LocalImportManager
from navia_runtime.modules.media_companion.local_import.store import LocalMediaImportStore

TASK_ID = "media_task_" + "b" * 32
OTHER_TASK = "media_task_" + "c" * 32
SOURCE = "portal:bilibili:BV1R6TEST:cid:1"
GENERATION = "depgen_" + "c" * 64


def _request(task_id: str = TASK_ID, source: str = SOURCE) -> MediaAcquisitionRequest:
    return MediaAcquisitionRequest(
        task_id=task_id,
        source_identity=source,
        adapter_id="bilibili",
        media_id="BV1R6TEST",
        playback_unit_id="cid",
        part_id="1",
        consent_policy_id="bilibili-media-consent/v1",
        consent_policy_revision=1,
    )


@pytest.fixture
def coordinator(tmp_path: Path) -> MediaAcquisitionCoordinator:
    sandbox = TaskArtifactSandbox(tmp_path / "tasks")
    return MediaAcquisitionCoordinator(sandbox)


@pytest.fixture
def manager(tmp_path: Path, coordinator: MediaAcquisitionCoordinator) -> LocalImportManager:
    store = LocalMediaImportStore(tmp_path / "navia.sqlite3")
    instance = LocalImportManager(store, media_root=str(tmp_path / "inputs"))
    instance._media_root = str(tmp_path / "inputs")
    instance._eligibility_resolver = coordinator.local_import_eligibility
    return instance


def _exhaust_routes(coordinator: MediaAcquisitionCoordinator, task_id: str = TASK_ID) -> None:
    coordinator.create(_request(task_id))
    for route in CAPTURE_FALLBACK_ROUTES:
        coordinator.record_route_failure(task_id, route, "V3_MEDIA_SUBTITLE_UNAVAILABLE")


def _body(task_id: str = TASK_ID, source: str = SOURCE) -> dict[str, object]:
    return {
        "taskId": task_id,
        "sourceIdentity": source,
        "declaredMediaType": "video/mp4",
        "byteLength": 1024,
    }


def test_c3_an_unknown_task_is_refused_and_nothing_is_allocated(
    manager: LocalImportManager, coordinator: MediaAcquisitionCoordinator
) -> None:
    """C3 — the task must exist; no record, no token, no sandbox."""
    with pytest.raises(ImportError) as error:
        manager.create(_body(), dependency_generation=GENERATION)
    assert error.value.code == "V3_MEDIA_IMPORT_TASK_NOT_ELIGIBLE"
    assert manager.store.list_incomplete() == []
    assert manager.tokens.outstanding() == 0


def test_c3_a_mismatched_source_is_refused(
    manager: LocalImportManager, coordinator: MediaAcquisitionCoordinator
) -> None:
    """C3 — the source identity must be the one the task owns."""
    _exhaust_routes(coordinator)
    with pytest.raises(ImportError) as error:
        manager.create(_body(source="portal:bilibili:BV1OTHER0000:cid:1"), dependency_generation=GENERATION)
    assert error.value.code == "V3_MEDIA_IMPORT_TASK_NOT_ELIGIBLE"
    assert manager.store.list_incomplete() == []


def test_c3_a_task_that_has_not_exhausted_the_routes_is_refused(
    manager: LocalImportManager, coordinator: MediaAcquisitionCoordinator
) -> None:
    """C3 — the three automatic routes must have failed first."""
    coordinator.create(_request())
    coordinator.record_route_failure(TASK_ID, CAPTURE_FALLBACK_ROUTES[0], "V3_MEDIA_SUBTITLE_UNAVAILABLE")

    with pytest.raises(ImportError) as error:
        manager.create(_body(), dependency_generation=GENERATION)
    assert error.value.code == "V3_MEDIA_IMPORT_TASK_NOT_ELIGIBLE"
    assert manager.store.list_incomplete() == []


def test_c3_a_task_with_a_selected_input_is_refused(
    manager: LocalImportManager, coordinator: MediaAcquisitionCoordinator
) -> None:
    """C3 — a task that already holds a selected input needs no import."""
    _exhaust_routes(coordinator)
    coordinator._tasks[TASK_ID]["selectedInput"] = {"artifactId": "already", "kind": "audio"}

    with pytest.raises(ImportError) as error:
        manager.create(_body(), dependency_generation=GENERATION)
    assert error.value.code == "V3_MEDIA_IMPORT_TASK_NOT_ELIGIBLE"
    assert manager.store.list_incomplete() == []


def test_c3_a_task_with_an_active_capture_is_refused(
    manager: LocalImportManager, coordinator: MediaAcquisitionCoordinator
) -> None:
    """C3 — an active capture blocks a local import."""
    _exhaust_routes(coordinator)
    coordinator.bind_capture_grant(TASK_ID, "mcg_capture_already")

    with pytest.raises(ImportError) as error:
        manager.create(_body(), dependency_generation=GENERATION)
    assert error.value.code == "V3_MEDIA_IMPORT_TASK_NOT_ELIGIBLE"
    assert manager.store.list_incomplete() == []


def test_c3_a_terminal_task_is_refused(
    manager: LocalImportManager, coordinator: MediaAcquisitionCoordinator
) -> None:
    """C3 — a terminal acquisition cannot start an import."""
    _exhaust_routes(coordinator)
    coordinator._tasks[TASK_ID]["state"] = "failed"

    with pytest.raises(ImportError) as error:
        manager.create(_body(), dependency_generation=GENERATION)
    assert error.value.code == "V3_MEDIA_IMPORT_TASK_NOT_ELIGIBLE"
    assert manager.store.list_incomplete() == []


def test_c3_an_eligible_task_creates_exactly_one_import(
    manager: LocalImportManager, coordinator: MediaAcquisitionCoordinator
) -> None:
    """C3 — the eligible success path."""
    _exhaust_routes(coordinator)

    created = manager.create(_body(), dependency_generation=GENERATION)
    assert created["import"]["importId"].startswith("media_import_")
    assert len(created["uploadToken"]) == 43
    assert len(manager.store.list_incomplete()) == 1


def test_c3_the_coordinator_query_itself_reports_the_frozen_conditions(
    coordinator: MediaAcquisitionCoordinator
) -> None:
    """C3 — the production query returns the frozen facts."""
    _exhaust_routes(coordinator)
    verdict = coordinator.local_import_eligibility(TASK_ID, SOURCE)
    assert verdict["eligible"] is True
    assert [item["route"] for item in verdict["failures"]] == list(CAPTURE_FALLBACK_ROUTES)
    with pytest.raises(MediaAcquisitionError):
        coordinator.local_import_eligibility(OTHER_TASK, SOURCE)
