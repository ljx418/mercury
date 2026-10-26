"""GC-B5R corrective — the durable, production-wired generation authority.

These cases close the Codex finding M-GCB5R-01: the process-global
`DEPENDENCY_LEASES` mirror is gone, the production composition in
`navia_runtime/app.py` supplies the manager-owned generation seam, and a local
input is compared with a CURRENTLY VERIFIED generation or refused before the
Provider is asked.

Every case drives the REAL owners: the dependency manager, the acquisition
coordinator, the task store, the local-import store, the comprehension service
and the app composition. Only the filesystem/network probes that a verified
snapshot needs and the synthesis Provider (the network edge) are faked, which
is exactly what the corrective goal allows.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import pytest

from navia_runtime.modules.media_companion.acquisition.coordinator import (
    MediaAcquisitionCoordinator,
    MediaAcquisitionError,
    MediaAcquisitionRequest,
)
from navia_runtime.modules.media_companion.acquisition.task_artifacts import (
    TaskArtifactSandbox,
)
from navia_runtime.modules.media_companion.comprehension import MediaComprehensionService
from navia_runtime.modules.media_companion.comprehension.synthesis import (
    GroundedSynthesisReceipt,
)
from navia_runtime.modules.media_companion.dependencies import catalog as frozen
from navia_runtime.modules.media_companion.dependencies.manager import (
    MediaDependencyManager,
)
from navia_runtime.modules.media_companion.input_authority import MediaInputAuthority
from navia_runtime.modules.media_companion.local_import.store import LocalMediaImportStore
from navia_runtime.modules.media_companion.product_materializer import (
    MediaProductMaterializer,
)
from navia_runtime.modules.media_companion.task_store import MediaTaskStore, MediaTaskStoreError

# The WP-A manager probes (the filesystem/network seams a verified snapshot
# needs). The manager itself is the REAL production owner.
from test_v3_media_dependency_manager import (  # noqa: E402
    FakeAsrManager,
    publish_yt_dlp,
    ready_system_tools,
)

TASK = "media_task_" + "7" * 32
OTHER_TASK = "media_task_" + "8" * 32
SOURCE = "portal:bilibili:BV1GCB5R000:41828944992:1"
OTHER_SOURCE = "portal:bilibili:BV1OTHER000:41828944992:1"
IMPORT_ID = "media_import_" + "9" * 32
SYNTHETIC_GENERATION = "depgen_" + "a" * 64


class Projection:
    """The transcript projection the materializer consumes."""

    def get(self, task_id: str) -> dict[str, Any]:
        topics = (
            "首先介绍问题背景和目标",
            "接下来演示方法步骤和界面操作",
            "最后总结结果限制和适用范围",
        )
        segments = []
        for index in range(36):
            start = index * 10_000
            topic = topics[min(2, index // 12)]
            segments.append({
                "segmentId": f"seg_{index}",
                "startMs": start,
                "endMs": start + 9_000,
                "text": f"{topic}，这是第 {index + 1} 条真实转写证据。",
            })
        return {
            "taskId": task_id,
            "sourceIdentity": SOURCE,
            "state": "succeeded",
            "terminal": True,
            "segments": segments,
        }


def stage_b_groups(evidence: list[dict[str, Any]]):
    start = min(item["timestampStartMs"] for item in evidence)
    end = max(item["timestampEndMs"] for item in evidence)
    width = end - start
    boundaries = (start + width // 3, start + 2 * width // 3)
    return (
        [item for item in evidence if item["timestampStartMs"] < boundaries[0]],
        [item for item in evidence if boundaries[0] <= item["timestampStartMs"] < boundaries[1]],
        [item for item in evidence if item["timestampStartMs"] >= boundaries[1]],
    )


def grounded_candidate(evidence: list[dict[str, Any]]) -> dict[str, Any]:
    opening, middle, ending = stage_b_groups(evidence)
    return {
        "brief": {
            "text": "视频先界定问题背景与讲解目标，再演示具体处理方法，最后归纳结果限制与适用范围。",
            "evidenceIds": [
                opening[0]["evidenceId"],
                middle[0]["evidenceId"],
                ending[-1]["evidenceId"],
            ],
        },
        "claims": [
            {"text": "开篇界定了需要讨论的核心问题和本次讲解目标。", "evidenceIds": [opening[0]["evidenceId"]]},
            {"text": "中段按顺序演示了具体的处理方法与操作步骤。", "evidenceIds": [middle[0]["evidenceId"]]},
            {"text": "结尾归纳了最终结果、限制条件与适用范围。", "evidenceIds": [ending[-1]["evidenceId"]]},
        ],
        "chapters": [
            {
                "title": "问题背景与目标",
                "thesis": "开篇界定问题背景与本次讲解目标。",
                "evidenceIds": [opening[0]["evidenceId"]],
                "relationToPrevious": "opening",
            },
            {
                "title": "方法步骤与操作",
                "thesis": "中段按顺序演示具体处理方法与操作步骤。",
                "evidenceIds": [middle[0]["evidenceId"]],
                "relationToPrevious": "continuation",
            },
            {
                "title": "结果限制与范围",
                "thesis": "结尾归纳结果限制与适用范围。",
                "evidenceIds": [ending[0]["evidenceId"], ending[-1]["evidenceId"]],
                "relationToPrevious": "conclusion",
            },
        ],
        "unresolvedEvidenceConflict": False,
    }


class StubProvider:
    """A Provider DOUBLE. Only the network call is faked."""

    def __init__(self) -> None:
        self.calls: list[dict[str, Any]] = []
        self.repairs: list[dict[str, Any]] = []

    def synthesize_v2(self, *, title, evidence, style):  # noqa: ANN001
        self.calls.append({"title": title, "evidence": evidence, "style": style})
        return grounded_candidate(evidence), GroundedSynthesisReceipt(
            "minimax-cn-openai-vision", "MiniMax-M3", "9" * 64, 1, {},
        )

    def b5_provider_receipt_extras(self) -> dict[str, Any]:
        return {
            "endpointClass": "minimax_chat_completions",
            "structureMode": "grounded_v2_1",
            "attemptId": "attempt-" + "a" * 8,
            "latencyMs": 1,
            "requestSha256": "1" * 64,
            "responseSha256": "2" * 64,
            "finishReason": "stop",
        }


def ready_manager(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    *,
    effective: str = "funasr-sensevoice-small-q8",
) -> MediaDependencyManager:
    """A REAL manager whose four dependencies verify."""
    root = tmp_path / "managed-tools"
    root.mkdir(parents=True, exist_ok=True)
    ready_system_tools(tmp_path, monkeypatch)
    publish_yt_dlp(root, b"yt-dlp-bytes")
    return MediaDependencyManager(
        asr_manager=FakeAsrManager(effective=effective),
        managed_root=root,
        now=lambda: "2026-10-23T00:00:00.000Z",
        disk_usage=lambda path: frozen.INSTALL_FREE_SPACE_BYTES + 1,
    )


def unready_manager(tmp_path: Path) -> MediaDependencyManager:
    """A REAL manager whose dependencies do NOT verify."""
    root = tmp_path / "managed-tools-missing"
    root.mkdir(parents=True, exist_ok=True)
    return MediaDependencyManager(
        asr_manager=FakeAsrManager(ready=False),
        managed_root=root,
        now=lambda: "2026-10-23T00:00:00.000Z",
    )


def manager_resolver(manager: MediaDependencyManager):
    """The production seam: the manager's own lease, re-verified on demand."""

    def resolve(task_id: str) -> str | None:
        snapshot = manager.leased_snapshot(task_id)
        if snapshot is None:
            snapshot = manager.acquire_snapshot(task_id)
        generation = getattr(snapshot, "generation", None)
        return generation if isinstance(generation, str) and generation else None

    return resolve


def drive_import_ready(imports: LocalMediaImportStore, import_id: str) -> None:
    """Walk the REAL WP-B state machine to the durable terminal."""
    imports.transition(
        import_id,
        expected_sequence=imports.get(import_id)["sequence"],
        state="uploading",
        uploaded_bytes=4096,
    )
    for state in ("verifying", "preparing"):
        imports.transition(
            import_id,
            expected_sequence=imports.get(import_id)["sequence"],
            state=state,
        )
    imports.transition(
        import_id,
        expected_sequence=imports.get(import_id)["sequence"],
        state="ready",
        video_manifest_sha256="1" * 64,
    )


def build_stack(
    tmp_path: Path,
    *,
    manager: MediaDependencyManager | None = None,
    coordinator: MediaAcquisitionCoordinator | None = None,
    coordinator_source: str | None = SOURCE,
    generation: str = SYNTHETIC_GENERATION,
    with_local_import: bool = True,
    provider: Any = None,
):
    """The REAL owners, composed exactly as `app.py` composes them."""
    store = MediaTaskStore(tmp_path / "runtime.sqlite3")
    imports = LocalMediaImportStore(tmp_path / "runtime.sqlite3")
    private = tmp_path / "private"
    if with_local_import:
        imports.create_import(
            task_id=TASK,
            source_identity=SOURCE,
            byte_length=4096,
            declared_media_type="video/mp4",
            dependency_generation=generation,
            import_id=IMPORT_ID,
        )
    if coordinator is None:
        coordinator = MediaAcquisitionCoordinator(
            TaskArtifactSandbox(tmp_path / "sandbox"), authority_store=store,
        )
    if provider is None:
        provider = StubProvider()
    factory_calls = {"count": 0}

    def factory():
        factory_calls["count"] += 1
        return provider

    authority = MediaInputAuthority(
        task_store=store,
        local_import_store=imports,
        coordinator=coordinator,
        generation_resolver=manager_resolver(manager) if manager is not None else None,
    )
    service = MediaComprehensionService(
        store,
        private,
        synthesis_provider_factory=factory,
        input_authority=authority,
    )
    task = MediaProductMaterializer(store, Projection(), private).materialize(TASK)
    if coordinator_source is not None:
        coordinator.create(MediaAcquisitionRequest(
            task_id=TASK,
            source_identity=coordinator_source,
            adapter_id="bilibili",
            media_id="BV1GCB5R000" if coordinator_source == SOURCE else "BV1OTHER000",
            playback_unit_id="41828944992",
            part_id="1",
            consent_policy_id="bilibili-media-consent/v1",
            consent_policy_revision=1,
        ))
    return {
        "store": store,
        "imports": imports,
        "authority": authority,
        "service": service,
        "provider": provider,
        "factory_calls": factory_calls,
        "coordinator": coordinator,
        "task": task,
        "private": private,
    }


def published(private: Path) -> list[Path]:
    root = private / "grounded-comprehension-v2.1"
    return sorted(root.rglob("*.json")) if root.exists() else []


# ---------------------------------------------------------------------------
# C1.1 — the manager is the only owner of the current generation.
# ---------------------------------------------------------------------------


def test_c1_the_manager_is_the_only_lease_owner(tmp_path: Path, monkeypatch) -> None:
    """C1 — the manager owns the lease; nothing global carries the generation."""
    from navia_runtime.modules.media_companion.dependencies import manager as manager_module

    manager = ready_manager(tmp_path, monkeypatch)
    generation = manager.acquire_snapshot(TASK).generation
    assert generation.startswith("depgen_")
    # The process-global map carries no authority and stays empty.
    assert manager_module.DEPENDENCY_LEASES == {}
    # The lease lives in the manager instance.
    assert manager.leased_snapshot(TASK) is not None
    assert manager._leases[TASK].generation == generation


def test_c1_no_global_cross_instance_bleed(tmp_path: Path, monkeypatch) -> None:
    """C1 — one manager's lease never answers for another instance."""
    first = ready_manager(tmp_path, monkeypatch)
    generation = first.acquire_snapshot(TASK).generation

    # A SECOND instance over the same managed root: a fresh process.
    second = ready_manager(tmp_path, monkeypatch)
    assert second.leased_snapshot(TASK) is None, "a fresh instance holds no lease"
    # It re-verifies and reaches the SAME generation, because the managed
    # content did not change.
    assert second.acquire_snapshot(TASK).generation == generation
    # And the first instance is unaffected.
    assert first.leased_snapshot(TASK).generation == generation


# ---------------------------------------------------------------------------
# C1.2/C1.3 — a fresh process, the same generation, and a changed one.
# ---------------------------------------------------------------------------


def test_c1_a_fresh_manager_with_the_same_generation_is_accepted(
    tmp_path: Path, monkeypatch
) -> None:
    """C1 — after a restart the same verified generation may proceed."""
    manager = ready_manager(tmp_path, monkeypatch)
    generation = manager.acquire_snapshot(TASK).generation
    stack = build_stack(tmp_path, manager=manager, generation=generation)
    drive_import_ready(stack["imports"], IMPORT_ID)

    # A FRESH manager (a fresh process) holds no lease and re-verifies.
    fresh = ready_manager(tmp_path, monkeypatch)
    assert fresh.leased_snapshot(TASK) is None
    stack["authority"]._generation_resolver = manager_resolver(fresh)
    stack["service"].synthesize(TASK, stack["task"]["revision"], True)
    assert published(stack["private"]), "the derivative must be published"
    assert len(stack["provider"].calls) == 1


def test_c1_a_changed_generation_is_refused_before_the_provider(
    tmp_path: Path, monkeypatch
) -> None:
    """C1 — a changed generation is a cross-run reuse, refused before the Provider.

    The local asset was prepared under another run's generation. The CURRENT
    generation is the one the REAL manager verifies right now.
    """
    manager = ready_manager(tmp_path, monkeypatch)
    current = manager.acquire_snapshot(TASK).generation
    assert current != SYNTHETIC_GENERATION
    # The import was prepared under another generation.
    stack = build_stack(tmp_path, manager=manager, generation=SYNTHETIC_GENERATION)
    drive_import_ready(stack["imports"], IMPORT_ID)

    # A FRESH manager (a fresh process) re-verifies the same current
    # generation; the asset still belongs to another run.
    fresh = ready_manager(tmp_path, monkeypatch)
    stack["authority"]._generation_resolver = manager_resolver(fresh)
    with pytest.raises(MediaTaskStoreError) as error:
        stack["service"].synthesize(TASK, stack["task"]["revision"], True)
    assert error.value.code == "V3_MEDIA_CROSS_TASK_REUSE"
    assert stack["provider"].calls == [], "the Provider must not be asked"
    assert published(stack["private"]) == [], "nothing may be published"


def test_c1_an_unverifiable_generation_is_refused_before_the_provider(
    tmp_path: Path,
) -> None:
    """C1 — no verifiable CURRENT generation is a refusal, never a skip."""
    manager = unready_manager(tmp_path)
    stack = build_stack(tmp_path, manager=manager)
    with pytest.raises(MediaTaskStoreError) as error:
        stack["service"].synthesize(TASK, stack["task"]["revision"], True)
    assert error.value.code == "V3_MEDIA_DEPENDENCY_NOT_READY"
    assert stack["provider"].calls == []
    assert published(stack["private"]) == []


def test_c1_a_missing_resolver_is_refused_before_the_provider(tmp_path: Path) -> None:
    """C1 — an authority without the manager seam cannot verify the local route."""
    stack = build_stack(tmp_path, manager=None)
    with pytest.raises(MediaTaskStoreError) as error:
        stack["service"].synthesize(TASK, stack["task"]["revision"], True)
    assert error.value.code == "V3_MEDIA_DEPENDENCY_NOT_READY"
    assert stack["provider"].calls == []
    assert published(stack["private"]) == []


# ---------------------------------------------------------------------------
# C1.5 — the coordinator's live task.
# ---------------------------------------------------------------------------


def test_c1_a_live_coordinator_task_with_another_identity_is_refused(
    tmp_path: Path, monkeypatch
) -> None:
    """C1 — a live acquisition of another media is refused before the Provider."""
    manager = ready_manager(tmp_path, monkeypatch)
    generation = manager.acquire_snapshot(TASK).generation
    stack = build_stack(
        tmp_path,
        manager=manager,
        coordinator_source=OTHER_SOURCE,
        generation=generation,
    )
    with pytest.raises(MediaTaskStoreError) as error:
        stack["service"].synthesize(TASK, stack["task"]["revision"], True)
    assert error.value.code == "V3_MEDIA_TRANSCRIPT_SOURCE_MISMATCH"
    assert stack["provider"].calls == []
    assert published(stack["private"]) == []


def test_c1_a_coordinator_without_a_live_entry_keeps_the_durable_verdict(
    tmp_path: Path, monkeypatch
) -> None:
    """C1 — after a restart the durable authority stays decisive."""
    manager = ready_manager(tmp_path, monkeypatch)
    generation = manager.acquire_snapshot(TASK).generation
    stack = build_stack(
        tmp_path,
        manager=manager,
        coordinator_source=None,
        generation=generation,
    )
    # The coordinator holds no live entry for this task (a Runtime restart).
    with pytest.raises(MediaAcquisitionError):
        stack["coordinator"].get(TASK)
    # The durable authority still decides: the local binding, the identity and
    # the CURRENT generation all agree, so a valid durable product stays
    # readable and a restarted coordinator never blocks it.
    stack["service"].synthesize(TASK, stack["task"]["revision"], True)
    assert published(stack["private"]), "the derivative must be published"
    assert len(stack["provider"].calls) == 1


# ---------------------------------------------------------------------------
# C1 — a failed authority check publishes nothing and moves no counter.
# ---------------------------------------------------------------------------


def test_c1_a_failed_authority_check_publishes_nothing(tmp_path: Path) -> None:
    """C1 — the refusal is total: no Provider, no artifact, no counter."""
    manager = unready_manager(tmp_path)
    stack = build_stack(tmp_path, manager=manager)
    before = {
        "provider_calls": len(stack["provider"].calls),
        "factory_calls": stack["factory_calls"]["count"],
        "published": len(published(stack["private"])),
    }
    with pytest.raises(MediaTaskStoreError):
        stack["service"].synthesize(TASK, stack["task"]["revision"], True)
    after = {
        "provider_calls": len(stack["provider"].calls),
        "factory_calls": stack["factory_calls"]["count"],
        "published": len(published(stack["private"])),
    }
    assert after == before
    assert after["published"] == 0
    assert not list(stack["private"].rglob("*.tmp"))


# ---------------------------------------------------------------------------
# The published derivative must satisfy the FROZEN V2.1 schema.
# ---------------------------------------------------------------------------


def test_c1_the_published_derivative_satisfies_the_frozen_v2_1_schema(
    tmp_path: Path, monkeypatch
) -> None:
    """The receipt extras are a record of the request that ALREADY HAPPENED.

    The real B-5 run published three derivatives whose receipt carried an
    EMPTY attemptId, requestSha256 and responseSha256, because the Runtime
    read the Provider's extras BEFORE the request. The frozen V2.1 schema
    requires those fields, so the published derivative must be validated
    against the schema itself.
    """
    import json
    from pathlib import Path as _Path

    from jsonschema import Draft202012Validator

    schema_path = (
        _Path(__file__).resolve().parents[3]
        / "docs/active/project/contracts/v3_media_grounded_comprehension_v2_1.schema.json"
    )
    validator = Draft202012Validator(json.loads(schema_path.read_text(encoding="utf-8")))

    from navia_runtime.modules.media_companion.comprehension.synthesis import (
        GroundedSynthesisReceipt,
    )

    class RecordingProvider(StubProvider):
        """A Provider whose extras are only filled BY the request."""

        def synthesize_v2(self, *, title, evidence, style):  # noqa: ANN001
            candidate, receipt = super().synthesize_v2(
                title=title, evidence=evidence, style=style,
            )
            self.b5_provider_receipt_extras = lambda: {
                "endpointClass": "minimax_chat_completions",
                "structureMode": "grounded_v2_1",
                "attemptId": "attempt-" + "a" * 16,
                "latencyMs": 42,
                "requestSha256": "1" * 64,
                "responseSha256": "2" * 64,
                "finishReason": "stop",
            }
            return candidate, receipt

    manager = ready_manager(tmp_path, monkeypatch)
    generation = manager.acquire_snapshot(TASK).generation
    stack = build_stack(
        tmp_path,
        manager=manager,
        generation=generation,
        provider=RecordingProvider(),
    )
    drive_import_ready(stack["imports"], IMPORT_ID)
    stack["service"].synthesize(TASK, stack["task"]["revision"], True)
    files = published(stack["private"])
    assert files, "the derivative must be published"
    derivative = json.loads(files[0].read_text(encoding="utf-8"))
    errors = list(validator.iter_errors(derivative))
    assert not errors, [error.message for error in errors[:5]]
    receipt = derivative["receipt"]
    assert receipt["attemptId"].startswith("attempt-")
    assert len(receipt["requestSha256"]) == 64
    assert len(receipt["responseSha256"]) == 64
    assert receipt["latencyMs"] == 42


def test_c5_the_repair_path_also_publishes_a_schema_valid_derivative(
    tmp_path: Path, monkeypatch
) -> None:
    """C5 — the repair route publishes a schema-valid derivative too.

    The receipt extras are read AFTER the repair request, so the published
    attemptId, requestSha256 and responseSha256 are the ones of the request
    that actually produced the derivative.
    """
    import json
    from pathlib import Path as _Path

    from jsonschema import Draft202012Validator

    schema_path = (
        _Path(__file__).resolve().parents[3]
        / "docs/active/project/contracts/v3_media_grounded_comprehension_v2_1.schema.json"
    )
    validator = Draft202012Validator(json.loads(schema_path.read_text(encoding="utf-8")))

    class RepairingProvider(StubProvider):
        """The first candidate is refused; the repair produces a valid one."""

        def synthesize_v2(self, *, title, evidence, style):  # noqa: ANN001
            self.calls.append({"title": title, "evidence": evidence, "style": style})
            short = grounded_candidate(evidence)
            short["brief"] = {**short["brief"], "text": "太短"}
            return short, GroundedSynthesisReceipt(
                "minimax-cn-openai-vision", "MiniMax-M3", "9" * 64, 1, {},
            )

        def repair_v2(self, *, title, evidence, candidate, failure_code, style):  # noqa: ANN001
            self.repairs.append({"failure_code": failure_code})
            return grounded_candidate(evidence), GroundedSynthesisReceipt(
                "minimax-cn-openai-vision", "MiniMax-M3", "9" * 64, 2, {},
            )

    manager = ready_manager(tmp_path, monkeypatch)
    generation = manager.acquire_snapshot(TASK).generation
    stack = build_stack(
        tmp_path,
        manager=manager,
        generation=generation,
        provider=RepairingProvider(),
    )
    drive_import_ready(stack["imports"], IMPORT_ID)
    stack["service"].synthesize(TASK, stack["task"]["revision"], True)
    files = published(stack["private"])
    assert files, "the repair route must publish the derivative"
    derivative = json.loads(files[0].read_text(encoding="utf-8"))
    errors = list(validator.iter_errors(derivative))
    assert not errors, [error.message for error in errors[:5]]
    # The repair produced a VALID brief, so the origin is the Provider's own.
    assert derivative["brief"]["origin"] == "provider"
    assert stack["provider"].repairs, "the repair route must have run"
    assert len(stack["provider"].repairs) == 1, "the repair route is bounded"


# ---------------------------------------------------------------------------
# C1 — the public app composition.
# ---------------------------------------------------------------------------


def test_c1_the_public_app_composition_drives_the_real_owners() -> None:
    """C1 — `app.py` composes the authority from the REAL owners."""
    import navia_runtime.app as runtime_app

    authority = runtime_app.media_input_authority
    assert isinstance(authority, MediaInputAuthority)
    assert authority._task_store is runtime_app.media_outline_task_store
    assert authority._local_import_store is runtime_app.local_media_import_store
    assert authority._coordinator is runtime_app.media_acquisition_coordinator
    assert runtime_app.media_comprehension_service._input_authority is authority
    # The local-import store and the task store share ONE Runtime database.
    assert (
        runtime_app.local_media_import_store.database_path
        == runtime_app.media_outline_task_store.db_path
    )
    # The generation seam is the manager's own.
    assert authority._generation_resolver is not None


def test_c1_the_public_app_composition_synthesizes_over_the_real_database(
    tmp_path: Path, monkeypatch
) -> None:
    """C1 — the app's own service, authority, coordinator and manager.

    Only the synthesis Provider (the network edge) and the dependency probes
    are replaced; the authority, the manager, the coordinator, the task store,
    the local-import store, the service, the validator and the publisher are
    the production objects.
    """
    import navia_runtime.app as runtime_app

    manager = ready_manager(tmp_path, monkeypatch)
    monkeypatch.setattr(runtime_app, "media_dependency_manager", manager)
    provider = StubProvider()
    monkeypatch.setattr(
        runtime_app.media_comprehension_service,
        "_synthesis_provider_factory",
        lambda: provider,
    )

    generation = manager.acquire_snapshot(TASK).generation
    runtime_app.local_media_import_store.create_import(
        task_id=TASK,
        source_identity=SOURCE,
        byte_length=4096,
        declared_media_type="video/mp4",
        dependency_generation=generation,
        import_id=IMPORT_ID,
    )
    private = runtime_app.default_media_task_root() / "product-evidence"
    task = MediaProductMaterializer(
        runtime_app.media_outline_task_store, Projection(), private,
    ).materialize(TASK)

    runtime_app.media_comprehension_service.synthesize(TASK, task["revision"], True)
    root = private / "grounded-comprehension-v2.1"
    assert sorted(root.rglob("*.json")), "the app composition must publish the derivative"
    assert len(provider.calls) == 1
