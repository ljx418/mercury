"""GC-B5R — the production input-authority composition (O01, O03, O05-O09).

Every case here drives the REAL owners: the durable local-import store, the
task store's source authority, the comprehension service, the frozen V2.1
validator and the atomic publisher. Only the external network primitive (the
synthesis Provider) is faked, and it is faked at the boundary the frozen
contract allows.

The obligations are the ones of
`post-wp-b-rebaseline-2026-10-23/02-acceptance-plan.md`.
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

import pytest

from navia_runtime.modules.media_companion.comprehension import MediaComprehensionService
from navia_runtime.modules.media_companion.comprehension.synthesis import GroundedSynthesisReceipt
from navia_runtime.modules.media_companion.input_authority import MediaInputAuthority
from navia_runtime.modules.media_companion.local_import.binding import (
    CROSS_RUN_REUSE_CODE,
    IMPORT_CANCELLED_CODE,
    SOURCE_MISMATCH_CODE,
    resolve_binding,
    verify_binding,
)
from navia_runtime.modules.media_companion.local_import.store import LocalMediaImportStore
from navia_runtime.modules.media_companion.product_materializer import MediaProductMaterializer
from navia_runtime.modules.media_companion.task_store import MediaTaskStore, MediaTaskStoreError

TASK = "media_task_" + "7" * 32
OTHER_TASK = "media_task_" + "8" * 32
SOURCE = "portal:bilibili:BV1GCB5R000:41828944992:1"
OTHER_SOURCE = "portal:bilibili:BV1GCB5R999:41828944992:1"
GENERATION = "depgen_" + "a" * 64
OTHER_GENERATION = "depgen_" + "b" * 64
IMPORT_ID = "media_import_" + "9" * 32
MANIFEST_SHA256 = "1" * 64


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
    """The deterministic source thirds the production analyzer uses."""
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
    """A candidate the FROZEN V2.1 validator accepts."""
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
            {
                "text": "开篇界定了需要讨论的核心问题和本次讲解目标。",
                "evidenceIds": [opening[0]["evidenceId"]],
            },
            {
                "text": "中段按顺序演示了具体的处理方法与操作步骤。",
                "evidenceIds": [middle[0]["evidenceId"], middle[-1]["evidenceId"]],
            },
            {
                "text": "结尾归纳了最终结果、限制条件与适用范围。",
                "evidenceIds": [ending[-1]["evidenceId"]],
            },
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

    def __init__(self, *, repair: bool = False) -> None:
        self.calls: list[dict[str, Any]] = []
        self.repairs: list[dict[str, Any]] = []
        self.mutate: Any = None
        self._repair = repair

    def _receipt(self, request_count: int = 1) -> GroundedSynthesisReceipt:
        return GroundedSynthesisReceipt(
            "minimax-cn-openai-vision", "MiniMax-M3", "9" * 64, request_count, {},
        )

    def synthesize_v2(self, *, title, evidence, style):  # noqa: ANN001
        self.calls.append({"title": title, "evidence": evidence, "style": style})
        candidate = grounded_candidate(evidence)
        if self.mutate is not None:
            candidate = self.mutate(candidate, evidence)
        return candidate, self._receipt()

    def b5_provider_receipt_extras(self) -> dict[str, Any]:
        return {
            "endpointClass": "chat_completions",
            "structureMode": "grounded_v2_1",
            "attemptId": "attempt-" + "a" * 8,
            "latencyMs": 1,
            "requestSha256": "1" * 64,
            "responseSha256": "2" * 64,
            "finishReason": "stop",
        }


class RepairingStubProvider(StubProvider):
    """A Provider DOUBLE that owns the ONE bounded repair route."""

    def __init__(self) -> None:
        super().__init__(repair=True)

    def repair_v2(self, *, title, evidence, candidate, failure_code, style):  # noqa: ANN001
        self.repairs.append({"failure_code": failure_code})
        return grounded_candidate(evidence), self._receipt(2)


# ---------------------------------------------------------------------------
# The production stack used by the cases below.
# ---------------------------------------------------------------------------


def build(
    tmp_path: Path,
    *,
    with_local_import: bool = True,
    generation: str = GENERATION,
    current_generation: str | None = None,
    import_state: str = "ready",
    source_identity: str = SOURCE,
    provider: StubProvider | None = None,
    shared_database: bool = False,
    inject_authority: bool = True,
):
    """The REAL owners: the task store, the local-import store, the authority,
    the product materializer and the comprehension service."""
    store = MediaTaskStore(tmp_path / "runtime.sqlite3")
    private = tmp_path / "private"
    imports = LocalMediaImportStore(
        tmp_path / "runtime.sqlite3" if shared_database else tmp_path / "imports.sqlite3"
    )
    if with_local_import:
        imports.create_import(
            task_id=TASK,
            source_identity=source_identity,
            byte_length=4096,
            declared_media_type="video/mp4",
            dependency_generation=generation,
            import_id=IMPORT_ID,
        )
        if import_state == "ready":
            # The REAL WP-B state machine, phase by phase, to the durable
            # terminal the local route depends on.
            for state, fields in (
                ("uploading", {"uploaded_bytes": 4096}),
                ("verifying", {}),
                ("preparing", {}),
            ):
                imports.transition(
                    IMPORT_ID,
                    expected_sequence=imports.get(IMPORT_ID)["sequence"],
                    state=state,
                    **fields,
                )
            imports.transition(
                IMPORT_ID,
                expected_sequence=imports.get(IMPORT_ID)["sequence"],
                state="ready",
                video_manifest_sha256=MANIFEST_SHA256,
            )
        elif import_state == "cancelled":
            imports.transition(
                IMPORT_ID,
                expected_sequence=imports.get(IMPORT_ID)["sequence"],
                state="cancelled",
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
        generation_resolver=lambda _task_id: (
            current_generation if current_generation is not None else generation
        ),
    )
    service = MediaComprehensionService(
        store,
        private,
        synthesis_provider_factory=factory,
        input_authority=authority if inject_authority else None,
    )
    task = MediaProductMaterializer(store, Projection(), private).materialize(TASK)
    return {
        "store": store,
        "imports": imports,
        "authority": authority,
        "service": service,
        "provider": provider,
        "factory_calls": factory_calls,
        "task": task,
        "private": private,
    }


def published(private: Path) -> list[Path]:
    root = private / "grounded-comprehension-v2.1"
    return sorted(root.rglob("*.json")) if root.exists() else []


# ---------------------------------------------------------------------------
# O01 — the current authority inventory.
# ---------------------------------------------------------------------------


def test_o01_the_inventory_names_the_live_production_symbols() -> None:
    """O01 — every reused path in the map is a real production symbol."""
    import inspect

    from navia_runtime.modules.media_companion.comprehension import service as service_module

    source = inspect.getsource(service_module)
    assert "def synthesize(" in source
    assert "def _require_current_input(" in source
    assert "def _assert_current_binding(" in source
    assert "def _save_grounded_v2_1(" in source
    assert "def require_current_input(" in inspect.getsource(MediaInputAuthority)
    assert "def resolve_binding(" in inspect.getsource(resolve_binding)
    # The synthesis still asks for exactly ONE Provider per task.
    assert "provider = self._synthesis_provider_factory()" in source
    # The publication is still the atomic V2.1 write.
    assert "self._save_grounded_v2_1(derivative)" in source
    # No fallback, no best-of-N and no cross-Provider stitching was added.
    assert "fallback" not in source.lower()
    assert "best_of" not in source.lower()


# ---------------------------------------------------------------------------
# O03 — the source binding.
# ---------------------------------------------------------------------------


def test_o03_the_local_binding_resolves_from_the_durable_record(tmp_path: Path) -> None:
    """O03 — the binding is read from the durable import record."""
    stack = build(tmp_path)
    binding = resolve_binding(store=stack["imports"], task_id=TASK)
    assert binding is not None
    assert binding.task_id == TASK
    assert binding.source_identity == SOURCE
    assert binding.dependency_generation == GENERATION
    assert binding.import_id == IMPORT_ID
    assert binding.state == "ready"


def test_o03_a_mismatched_task_is_refused(tmp_path: Path) -> None:
    """O03 — an asset bound to another task is refused."""
    stack = build(tmp_path)
    binding = resolve_binding(store=stack["imports"], task_id=TASK)
    assert binding is not None
    with pytest.raises(ValueError) as error:
        verify_binding(
            binding,
            task_id=OTHER_TASK,
            source_identity=SOURCE,
            dependency_generation=GENERATION,
        )
    assert str(error.value) == CROSS_RUN_REUSE_CODE


def test_o03_a_mismatched_media_identity_is_refused(tmp_path: Path) -> None:
    """O03 — another media id, playback unit or part is another media."""
    stack = build(tmp_path)
    binding = resolve_binding(store=stack["imports"], task_id=TASK)
    assert binding is not None
    for identity in (
        "portal:bilibili:BV1OTHER000:41828944992:1",
        "portal:bilibili:BV1GCB5R000:99999999999:1",
        "portal:bilibili:BV1GCB5R000:41828944992:2",
    ):
        with pytest.raises(ValueError) as error:
            verify_binding(
                binding,
                task_id=TASK,
                source_identity=identity,
                dependency_generation=GENERATION,
            )
        assert str(error.value) == SOURCE_MISMATCH_CODE


def test_o03_a_cross_run_generation_is_refused(tmp_path: Path) -> None:
    """O03 — an asset prepared under another generation is a cross-run reuse."""
    stack = build(tmp_path, generation=OTHER_GENERATION, current_generation=GENERATION)
    binding = resolve_binding(store=stack["imports"], task_id=TASK)
    assert binding is not None
    with pytest.raises(ValueError) as error:
        verify_binding(
            binding,
            task_id=TASK,
            source_identity=SOURCE,
            dependency_generation=GENERATION,
        )
    assert str(error.value) == CROSS_RUN_REUSE_CODE


def test_o03_a_cancelled_import_never_reaches_the_provider(tmp_path: Path) -> None:
    """O03 — a closed local import never reaches a Provider."""
    stack = build(tmp_path, import_state="cancelled")
    with pytest.raises(MediaTaskStoreError) as error:
        stack["service"].synthesize(TASK, stack["task"]["revision"], True)
    assert error.value.code == IMPORT_CANCELLED_CODE
    assert stack["provider"].calls == [], "the Provider must not be asked"
    assert published(stack["private"]) == []


def test_o03_a_mismatched_identity_never_reaches_the_provider(tmp_path: Path) -> None:
    """O03 — the identity of the asset must be the identity of the task."""
    stack = build(tmp_path, source_identity=OTHER_SOURCE)
    with pytest.raises(MediaTaskStoreError) as error:
        stack["service"].synthesize(TASK, stack["task"]["revision"], True)
    assert error.value.code == SOURCE_MISMATCH_CODE
    assert stack["provider"].calls == []
    assert published(stack["private"]) == []


def test_o03_a_cross_run_asset_never_reaches_the_provider(tmp_path: Path) -> None:
    """O03 — an asset of another generation never reaches a Provider."""
    stack = build(tmp_path, generation=OTHER_GENERATION, current_generation=GENERATION)
    calls_before = len(stack["provider"].calls)
    with pytest.raises(MediaTaskStoreError) as error:
        stack["service"].synthesize(TASK, stack["task"]["revision"], True)
    assert error.value.code == CROSS_RUN_REUSE_CODE
    assert len(stack["provider"].calls) == calls_before, "the Provider must not be asked"
    assert published(stack["private"]) == []


def test_o03_the_default_authority_refuses_a_local_input_it_cannot_verify(
    tmp_path: Path,
) -> None:
    """O03/C1 — an authority without a generation resolver fails CLOSED.

    The default composition carries no dependency-generation resolver, so a
    local input can never be verified against a CURRENT generation here. The
    refusal happens before the Provider and publishes nothing.
    """
    stack = build(tmp_path, shared_database=True, inject_authority=False)
    with pytest.raises(MediaTaskStoreError) as error:
        stack["service"].synthesize(TASK, stack["task"]["revision"], True)
    assert error.value.code == "V3_MEDIA_DEPENDENCY_NOT_READY"
    assert stack["provider"].calls == []
    assert published(stack["private"]) == []


def test_o03_the_default_authority_refuses_a_foreign_asset(tmp_path: Path) -> None:
    """O03 — the PRODUCTION path refuses an asset of another media."""
    stack = build(
        tmp_path,
        shared_database=True,
        inject_authority=False,
        source_identity=OTHER_SOURCE,
    )
    with pytest.raises(MediaTaskStoreError) as error:
        stack["service"].synthesize(TASK, stack["task"]["revision"], True)
    assert error.value.code == SOURCE_MISMATCH_CODE
    assert stack["provider"].calls == []
    assert published(stack["private"]) == []


def test_o03_the_default_authority_refuses_a_cancelled_import(
    tmp_path: Path,
) -> None:
    """O03 — the PRODUCTION path refuses a closed local import."""
    stack = build(
        tmp_path,
        shared_database=True,
        inject_authority=False,
        import_state="cancelled",
    )
    with pytest.raises(MediaTaskStoreError) as error:
        stack["service"].synthesize(TASK, stack["task"]["revision"], True)
    assert error.value.code == IMPORT_CANCELLED_CODE
    assert stack["provider"].calls == []
    assert published(stack["private"]) == []


def test_o03_the_current_generation_comes_from_the_injected_resolver(
    tmp_path: Path,
) -> None:
    """O03/C1 — the current generation is the RESOLVER's answer, never a guess.

    The resolver is the dependency manager's own seam. The authority compares
    the local asset against it, and a changed generation is a cross-run reuse.
    """
    stack = build(
        tmp_path,
        shared_database=True,
        inject_authority=False,
        generation=OTHER_GENERATION,
        current_generation=OTHER_GENERATION,
    )
    # The resolver is injected, so the default composition is not the one
    # under test here: the authority is built with the manager seam.
    from navia_runtime.modules.media_companion.input_authority import (
        MediaInputAuthority,
    )

    stack["service"]._input_authority = MediaInputAuthority(
        task_store=stack["store"],
        local_import_store=stack["imports"],
        generation_resolver=lambda task_id: (
            OTHER_GENERATION if task_id == TASK else None
        ),
    )
    stack["service"].synthesize(TASK, stack["task"]["revision"], True)
    assert published(stack["private"])

    # A resolver that answers with ANOTHER generation makes the same asset a
    # cross-run reuse.
    stack["service"]._input_authority = MediaInputAuthority(
        task_store=stack["store"],
        local_import_store=stack["imports"],
        generation_resolver=lambda task_id: (
            GENERATION if task_id == TASK else None
        ),
    )
    calls_before = len(stack["provider"].calls)
    with pytest.raises(MediaTaskStoreError) as error:
        stack["service"].synthesize(TASK, stack["task"]["revision"], True)
    assert error.value.code == CROSS_RUN_REUSE_CODE
    assert len(stack["provider"].calls) == calls_before, "the Provider must not be asked"


def test_o03_a_revision_mismatch_is_refused(tmp_path: Path) -> None:
    """O03 — a task that moved is refused before the Provider is asked."""
    stack = build(tmp_path)
    with pytest.raises(MediaTaskStoreError) as error:
        stack["service"].synthesize(TASK, stack["task"]["revision"] + 1, True)
    assert error.value.code == "V3510B_TASK_REVISION_CONFLICT"
    assert stack["provider"].calls == []


def test_o03_a_stale_source_authority_is_refused(tmp_path: Path) -> None:
    """O03 — a historical source may not start new processing."""
    stack = build(tmp_path)
    stack["store"].reserve_source_authority(
        SOURCE, OTHER_TASK, "bilibili", "bilibili-media-consent/v1", 1,
    )
    with pytest.raises(MediaTaskStoreError) as error:
        stack["service"].synthesize(TASK, stack["task"]["revision"], True)
    assert error.value.code == "V3_MEDIA_HISTORICAL_READ_ONLY"
    assert stack["provider"].calls == []


# ---------------------------------------------------------------------------
# O04 — the route order and the default-off capture.
# ---------------------------------------------------------------------------


def _coordinator(tmp_path: Path):
    from navia_runtime.modules.media_companion.acquisition.coordinator import (
        MediaAcquisitionCoordinator,
        MediaAcquisitionRequest,
    )
    from navia_runtime.modules.media_companion.acquisition.task_artifacts import (
        TaskArtifactSandbox,
    )

    store = MediaTaskStore(tmp_path / "runtime.sqlite3")
    coordinator = MediaAcquisitionCoordinator(
        TaskArtifactSandbox(tmp_path / "sandbox"), authority_store=store,
    )
    coordinator.create(MediaAcquisitionRequest(
        task_id=TASK,
        source_identity=SOURCE,
        adapter_id="bilibili",
        media_id="BV1GCB5R000",
        playback_unit_id="41828944992",
        part_id="1",
        consent_policy_id="bilibili-media-consent/v1",
        consent_policy_revision=1,
    ))
    return coordinator


def test_o04_the_automatic_routes_precede_the_explicit_local_import(
    tmp_path: Path,
) -> None:
    """O04 — the local import route opens only after the three automatic ones."""
    from navia_runtime.modules.media_companion.acquisition.coordinator import (
        CAPTURE_FALLBACK_ROUTES,
        MediaAcquisitionError,
    )

    coordinator = _coordinator(tmp_path)

    # The local route is NOT open while the automatic routes are alive.
    with pytest.raises(MediaAcquisitionError) as error:
        coordinator.local_import_eligibility(TASK, SOURCE)
    assert error.value.code == "V3_MEDIA_CAPTURE_NOT_ELIGIBLE"

    # A route failure out of the frozen order is refused.
    with pytest.raises(MediaAcquisitionError) as error:
        coordinator.record_route_failure(
            TASK, "credentialed_media_asr", "V3_MEDIA_SUBTITLE_UNAVAILABLE",
        )
    assert error.value.code == "V3_MEDIA_ROUTE_ORDER_INVALID"

    # The three automatic routes fail in the frozen order.
    for route in CAPTURE_FALLBACK_ROUTES:
        coordinator.record_route_failure(TASK, route, "V3_MEDIA_SUBTITLE_UNAVAILABLE")
    assert coordinator.capture_eligibility(TASK)["captureFallbackEligible"] is True
    assert coordinator.local_import_eligibility(TASK, SOURCE)["eligible"] is True

    # A local import of ANOTHER source is never eligible for this task.
    with pytest.raises(MediaAcquisitionError) as error:
        coordinator.local_import_eligibility(TASK, OTHER_SOURCE)
    assert error.value.code == "V3_MEDIA_TASK_INVALID"


def test_o04_tab_capture_stays_default_off(tmp_path: Path) -> None:
    """O04 — tabCapture needs an explicit grant AFTER the three routes."""
    from navia_runtime.modules.media_companion.acquisition.coordinator import (
        CAPTURE_FALLBACK_ROUTES,
        MediaAcquisitionError,
    )

    coordinator = _coordinator(tmp_path)

    # No capture grant may be bound while the automatic routes are alive.
    with pytest.raises(MediaAcquisitionError) as error:
        coordinator.bind_capture_grant(TASK, "grant_" + "a" * 32)
    assert error.value.code == "V3_MEDIA_CAPTURE_NOT_ELIGIBLE"
    assert coordinator.capture_eligibility(TASK)["captureFallbackEligible"] is False

    # Even after the three routes, the grant is an EXPLICIT act: the task
    # never holds one until a caller binds it.
    for route in CAPTURE_FALLBACK_ROUTES:
        coordinator.record_route_failure(TASK, route, "V3_MEDIA_SUBTITLE_UNAVAILABLE")
    assert coordinator.get(TASK)["captureGrantId"] is None


# ---------------------------------------------------------------------------
# O05 — one Provider per task.
# ---------------------------------------------------------------------------


def test_o05_exactly_one_provider_is_asked_per_task(tmp_path: Path) -> None:
    """O05 — one Provider, one request, no best-of-N and no stitching."""
    stack = build(tmp_path)
    stack["service"].synthesize(TASK, stack["task"]["revision"], True)
    assert len(stack["provider"].calls) == 1
    assert stack["provider"].repairs == []
    assert stack["factory_calls"]["count"] == 1, "the task may hold ONE Provider"
    payload = json.loads(published(stack["private"])[0].read_text(encoding="utf-8"))
    receipt = payload["receipt"]
    assert receipt["providerId"] == "minimax-cn-openai-vision"
    assert receipt["modelId"] == "MiniMax-M3"
    assert receipt["requestCount"] == 1
    assert receipt["endpointClass"] == "chat_completions"
    assert receipt["structureMode"] == "grounded_v2_1"
    projection = stack["service"].get(TASK, stack["task"]["revision"])
    assert projection["authorization"]["providerId"] == "minimax-cn-openai-vision"
    assert projection["authorization"]["modelId"] == "MiniMax-M3"
    assert projection["authorization"]["outboundDerivedTextSha256"] is not None


def test_o05_a_task_without_a_provider_is_rejected(tmp_path: Path) -> None:
    """O05 — ZERO Providers is a rejection, never a silent success."""
    stack = build(tmp_path, inject_authority=False)
    service = MediaComprehensionService(
        stack["store"],
        stack["private"],
        synthesis_provider_factory=None,
        input_authority=stack["authority"],
    )
    with pytest.raises(MediaTaskStoreError) as error:
        service.synthesize(TASK, stack["task"]["revision"], True)
    assert error.value.code == "V352_SYNTHESIS_PROVIDER_MISSING"
    assert published(stack["private"]) == []


def test_o05_the_outbound_payload_carries_only_derived_text(tmp_path: Path) -> None:
    """O05/O06 — the outbound payload is evidence text only, and every raw
    counter is zero."""
    stack = build(tmp_path)
    stack["service"].synthesize(TASK, stack["task"]["revision"], True)
    outbound = stack["provider"].calls[0]["evidence"]
    assert outbound, "the Provider must receive the evidence"
    for item in outbound:
        assert set(item) == {
            "evidenceId", "kind", "timestampStartMs", "timestampEndMs", "text",
        }
        assert not any("path" in key.lower() or "cookie" in key.lower() for key in item)
    payload = json.loads(published(stack["private"])[0].read_text(encoding="utf-8"))
    receipt = payload["receipt"]
    assert receipt["rawVideoUploadCount"] == 0
    assert receipt["rawAudioUploadCount"] == 0
    assert receipt["frameByteUploadCount"] == 0
    assert receipt["cookieUploadCount"] == 0
    assert receipt["apiKeyDisclosureCount"] == 0
    assert receipt["localPathUploadCount"] == 0
    projection = stack["service"].get(TASK, stack["task"]["revision"])
    assert projection["authorization"]["rawMediaUploadCount"] == 0
    assert projection["authorization"]["groundedTextCloudStatus"] == "granted"


def test_o06_the_published_payload_carries_no_raw_media_or_local_path(
    tmp_path: Path,
) -> None:
    """O06 — the payload scan over the published derivative is clean."""
    stack = build(tmp_path)
    stack["service"].synthesize(TASK, stack["task"]["revision"], True)
    files = published(stack["private"])
    assert files
    text = files[0].read_text(encoding="utf-8")
    for marker in (
        "sk-", "sk_live_", "AIza", "gho_",
        "Cookie", "Authorization", "Bearer ", "api_key=", "apiKey=",
        "SESSDATA", "bili_jct", "buvid",
        "/home/", "/mnt/", "C:\\\\", ".mp4", ".mkv", ".webm", ".wav",
        "base64", "frameBytes",
    ):
        assert marker not in text, f"the published payload leaks {marker!r}"
    # The frozen secret shapes of the runner's scanner.
    for pattern in (
        r"sk-[A-Za-z0-9_\-]{16,}",
        r"sk_live_[A-Za-z0-9]{8,}",
        r"AIza[0-9A-Za-z_\-]{16,}",
        r"gho_[0-9A-Za-z]{16,}",
        r"deepseek-[A-Za-z0-9]{8,}",
        r"minimax-[A-Za-z0-9]{8,}",
    ):
        assert re.search(pattern, text) is None, f"the payload leaks {pattern}"
    # The absolute private root must not appear in the published bytes.
    assert str(stack["private"]) not in text


# ---------------------------------------------------------------------------
# O07 — the V2.1 validation gates.
# ---------------------------------------------------------------------------


def test_o07_a_short_brief_is_rejected_by_the_production_validator(
    tmp_path: Path,
) -> None:
    """O07 — the brief length gate is the production one."""
    stack = build(tmp_path)
    stack["provider"].mutate = lambda candidate, _evidence: {
        **candidate,
        "brief": {**candidate["brief"], "text": "太短了"},
    }
    with pytest.raises(MediaTaskStoreError) as error:
        stack["service"].synthesize(TASK, stack["task"]["revision"], True)
    assert error.value.code == "V3510B_BRIEF_LENGTH_INVALID"
    assert published(stack["private"]) == []


def test_o07_a_raw_transcript_prefix_brief_is_rejected(tmp_path: Path) -> None:
    """O07 — a brief that copies one transcript item is refused."""
    stack = build(tmp_path)

    def mutate(candidate, evidence):
        raw = next(item["text"] for item in evidence if len(item["text"]) >= 40)[:30]
        return {**candidate, "brief": {**candidate["brief"], "text": raw}}

    stack["provider"].mutate = mutate
    with pytest.raises(MediaTaskStoreError) as error:
        stack["service"].synthesize(TASK, stack["task"]["revision"], True)
    assert error.value.code == "V3510B_BRIEF_RAW_PREFIX"
    assert published(stack["private"]) == []


def test_o07_a_broken_chapter_timeline_is_rejected(tmp_path: Path) -> None:
    """O07 — the temporal gate is the production one."""
    stack = build(tmp_path)

    def mutate(candidate, _evidence):
        chapters = [dict(item) for item in candidate["chapters"]]
        chapters[1]["evidenceIds"] = list(chapters[0]["evidenceIds"])
        return {**candidate, "chapters": chapters}

    stack["provider"].mutate = mutate
    with pytest.raises(MediaTaskStoreError) as error:
        stack["service"].synthesize(TASK, stack["task"]["revision"], True)
    assert error.value.code == "V3510B_CHAPTER_TIME_INVALID"
    assert published(stack["private"]) == []


def test_o07_an_unknown_evidence_id_is_rejected(tmp_path: Path) -> None:
    """O07 — the evidence gate is the production one."""
    stack = build(tmp_path)

    def mutate(candidate, _evidence):
        return {
            **candidate,
            "brief": {
                **candidate["brief"],
                "evidenceIds": ["mev_unknown" + "0" * 25],
            },
        }

    stack["provider"].mutate = mutate
    with pytest.raises(MediaTaskStoreError) as error:
        stack["service"].synthesize(TASK, stack["task"]["revision"], True)
    assert error.value.code == "V3510B_EVIDENCE_UNCLOSED"
    assert published(stack["private"]) == []


def test_o07_a_foreign_evidence_id_in_a_claim_is_rejected(tmp_path: Path) -> None:
    """O07 — a claim may not cite evidence of another media."""
    stack = build(tmp_path)

    def mutate(candidate, _evidence):
        claims = [dict(item) for item in candidate["claims"]]
        claims[0]["evidenceIds"] = ["mev_foreign" + "0" * 24]
        return {**candidate, "claims": claims}

    stack["provider"].mutate = mutate
    with pytest.raises(MediaTaskStoreError) as error:
        stack["service"].synthesize(TASK, stack["task"]["revision"], True)
    assert error.value.code == "V3510B_CLAIM_EVIDENCE_UNCLOSED"
    assert published(stack["private"]) == []


# ---------------------------------------------------------------------------
# O08 — the atomic publication.
# ---------------------------------------------------------------------------


def test_o08_a_successful_publication_is_atomic_and_leaves_no_temporary(
    tmp_path: Path,
) -> None:
    """O08 — the V2.1 derivative is written atomically and nothing is left."""
    stack = build(tmp_path)
    stack["service"].synthesize(TASK, stack["task"]["revision"], True)
    files = published(stack["private"])
    assert files, "the V2.1 derivative must exist"
    root = stack["private"] / "grounded-comprehension-v2.1"
    assert not list(root.rglob("*.tmp")), "no temporary file may survive"
    payload = json.loads(files[0].read_text(encoding="utf-8"))
    assert payload["schemaVersion"] == "v3-media-grounded-comprehension/v2.1"
    assert payload["binding"]["taskId"] == TASK
    assert payload["binding"]["sourceIdentity"] == SOURCE
    assert payload["binding"]["taskRevision"] == stack["task"]["revision"]
    assert files[0].stat().st_mode & 0o777 == 0o600


def test_o08_a_failed_publication_preserves_the_previous_bytes(tmp_path: Path) -> None:
    """O08 — a failing synthesis leaves the published derivative untouched."""
    stack = build(tmp_path)
    stack["service"].synthesize(TASK, stack["task"]["revision"], True)
    files = published(stack["private"])
    assert files
    before = files[0].read_bytes()

    stack["provider"].mutate = lambda candidate, _evidence: {
        **candidate,
        "brief": {**candidate["brief"], "text": "太短了"},
    }
    with pytest.raises(MediaTaskStoreError):
        stack["service"].synthesize(TASK, stack["task"]["revision"], True)

    assert files[0].read_bytes() == before, "the published bytes must not move"
    root = stack["private"] / "grounded-comprehension-v2.1"
    assert not list(root.rglob("*.tmp")), "no temporary file may survive"


def test_o08_the_v1_synthesis_bytes_are_never_renamed_or_deleted(tmp_path: Path) -> None:
    """O08 — the V1 path is untouched by a V2.1 publication."""
    stack = build(tmp_path)
    v1 = stack["private"] / "synthesis" / TASK
    v1.mkdir(parents=True, exist_ok=True)
    legacy = v1 / "revision-1.json"
    legacy.write_bytes(b'{"legacy":true}\n')
    stack["service"].synthesize(TASK, stack["task"]["revision"], True)
    assert legacy.read_bytes() == b'{"legacy":true}\n'
    assert not (stack["private"] / "grounded-comprehension-v2" / TASK).exists()


# ---------------------------------------------------------------------------
# O09 — the lifecycle and the cleanup.
# ---------------------------------------------------------------------------


def test_o09_a_cancelled_task_publishes_nothing_and_leaves_no_residue(
    tmp_path: Path,
) -> None:
    """O09 — a cancelled owner publishes no derivative and leaves no bytes."""
    stack = build(tmp_path)
    # The REAL task lifecycle: a terminal task is retried, then cancelled.
    retried = stack["store"].retry(TASK, stack["task"]["revision"])
    cancelled = stack["store"].transition(TASK, retried["revision"], "cancelled")
    assert cancelled["state"] == "cancelled"
    with pytest.raises(MediaTaskStoreError) as error:
        stack["service"].synthesize(TASK, cancelled["revision"], True)
    assert error.value.code == "V351_TASK_NOT_READY"
    assert stack["provider"].calls == []
    assert published(stack["private"]) == []


def test_o09_a_cancelled_import_publishes_nothing(tmp_path: Path) -> None:
    """O09 — a cancelled local import is the owner's terminal state."""
    stack = build(tmp_path, import_state="cancelled")
    with pytest.raises(MediaTaskStoreError) as error:
        stack["service"].synthesize(TASK, stack["task"]["revision"], True)
    assert error.value.code == IMPORT_CANCELLED_CODE
    assert stack["provider"].calls == []
    assert published(stack["private"]) == []


def test_o09_a_restart_preserves_the_published_bytes(tmp_path: Path) -> None:
    """O09 — a fresh service over the same roots reads the same derivative."""
    stack = build(tmp_path)
    stack["service"].synthesize(TASK, stack["task"]["revision"], True)
    files = published(stack["private"])
    assert files
    before = files[0].read_bytes()

    restarted = MediaComprehensionService(
        stack["store"],
        stack["private"],
        synthesis_provider_factory=lambda: stack["provider"],
        input_authority=stack["authority"],
    )
    projection = restarted.get(TASK, stack["task"]["revision"])
    assert projection["task"]["taskRevision"] == stack["task"]["revision"]
    assert files[0].read_bytes() == before
    root = stack["private"] / "grounded-comprehension-v2.1"
    assert not list(root.rglob("*.tmp"))


def test_o09_a_restart_after_a_cancellation_publishes_nothing(tmp_path: Path) -> None:
    """O09 — a restart never resurrects a closed owner."""
    stack = build(tmp_path, import_state="cancelled")
    restarted = MediaComprehensionService(
        stack["store"],
        stack["private"],
        synthesis_provider_factory=lambda: stack["provider"],
        input_authority=stack["authority"],
    )
    with pytest.raises(MediaTaskStoreError) as error:
        restarted.synthesize(TASK, stack["task"]["revision"], True)
    assert error.value.code == IMPORT_CANCELLED_CODE
    assert stack["provider"].calls == []
    assert published(stack["private"]) == []
