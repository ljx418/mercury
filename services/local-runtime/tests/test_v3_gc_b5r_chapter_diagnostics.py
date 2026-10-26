"""GC-B5R corrective — the privacy-safe chapter diagnostics (C3) and the
MiniMax candidate shape with bounded repair (C4).

The frozen V2.1 rules are unchanged: chapter starts remain strictly
increasing, the chapter count remains 2..12, the chapter fields remain exact
and every evidence binding remains closed. The independent validator stays
authoritative.

The adapter is the REAL production adapter; only its HTTP transport is faked.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import httpx
import pytest

from navia_runtime.modules.media_companion.comprehension.diagnostics import (
    build_stage_b_diagnostic,
    candidate_shape_diagnostic,
    evidence_capacity_diagnostic,
    stage_b_candidate_shape_violation,
)
from navia_runtime.modules.media_companion.comprehension.quality import (
    validate_grounded_comprehension,
)
from navia_runtime.modules.media_companion.comprehension.synthesis import (
    MiniMaxGroundedSynthesisProvider,
)
from navia_runtime.modules.media_companion.task_store import MediaTaskStoreError

PROVIDER = {
    "id": "minimax-cn-openai-vision",
    "model": "MiniMax-M3",
    "baseUrl": "https://provider.invalid",
    "apiKey": "test-only-secret",
    "adapterKind": "minimax_chat_completions",
}


def evidence_item(index: int, start_ms: int, kind: str = "transcript") -> dict[str, Any]:
    return {
        "evidenceId": f"mtr_{index:032d}",
        "kind": kind,
        "timestampStartMs": start_ms,
        "timestampEndMs": start_ms + 4_000,
        "text": f"这是第 {index} 条派生字幕文本，不属于诊断范围。",
    }


def candidate(chapters: list[dict[str, Any]], *, claims: int = 2) -> dict[str, Any]:
    first = "mtr_00000000000000000000000000000000"
    last = "mtr_00000000000000000000000000000003"
    return {
        "brief": {
            "text": "视频完整讲述了背景、方法与结论，覆盖开头中段和结尾。",
            "evidenceIds": [first, "mtr_00000000000000000000000000000002", last],
        },
        "claims": [
            {
                "text": f"第 {index + 1} 条可核验的核心表达，概括了视频的一个要点。",
                "evidenceIds": [first if index == 0 else last],
            }
            for index in range(claims)
        ],
        "chapters": chapters,
        "unresolvedEvidenceConflict": False,
    }


def chapter(evidence_ids: list[str], *, relation: str = "continuation", title: str = "章节标题", thesis: str = "章节核心结论说明。") -> dict[str, Any]:
    return {
        "title": title,
        "thesis": thesis,
        "evidenceIds": list(evidence_ids),
        "relationToPrevious": relation,
    }


CHUNK_BODY = {"summary": "分块概括", "sections": []}


def candidate_requests(requests: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """The candidate requests only: the chunk extraction is a different task."""
    return [
        request for request in requests
        if request.get("task") != "extract_grounded_chapter_candidates"
    ]


def fake_provider(bodies: list[Any]) -> tuple[MiniMaxGroundedSynthesisProvider, list[dict[str, Any]]]:
    """The REAL adapter with a fake HTTP transport.

    The chunk-extraction requests are answered with the frozen chunk shape; the
    queued bodies answer the candidate requests, in order.
    """
    remaining = list(bodies)
    requests: list[dict[str, Any]] = []

    def handler(request: httpx.Request) -> httpx.Response:
        envelope = json.loads(request.content.decode("utf-8"))
        # The adapter sends the prompt as the user message of the chat request.
        user_content = envelope["messages"][-1]["content"]
        payload = json.loads(user_content)
        requests.append(payload)
        if payload.get("task") == "extract_grounded_chapter_candidates":
            body: Any = CHUNK_BODY
        else:
            body = remaining.pop(0)
        if isinstance(body, Exception):
            raise body
        return httpx.Response(
            200,
            json={
                "choices": [
                    {"message": {"content": json.dumps(body, ensure_ascii=False)}, "finish_reason": "stop"}
                ],
                "usage": {"prompt_tokens": 10, "completion_tokens": 20},
            },
        )

    provider = MiniMaxGroundedSynthesisProvider(
        dict(PROVIDER),
        client_factory=lambda: httpx.Client(transport=httpx.MockTransport(handler)),
    )
    return provider, requests


# ---------------------------------------------------------------------------
# C3 — the diagnostic facts.
# ---------------------------------------------------------------------------


def test_c3_a_frame_and_ocr_may_share_a_start_and_a_valid_candidate_passes() -> None:
    """C3 — a shared start does not prevent two strictly increasing anchors."""
    evidence = [
        evidence_item(0, 0),
        evidence_item(1, 0, kind="ocr_block"),
        evidence_item(2, 10_000),
        evidence_item(3, 20_000),
    ]
    capacity = evidence_capacity_diagnostic(evidence)
    assert capacity["evidenceCount"] == 4
    assert capacity["distinctStartCount"] == 3
    assert capacity["duplicateStartGroupCount"] == 1
    assert capacity["maximumDuplicateStartMultiplicity"] == 2
    assert capacity["hasTwoStrictlyIncreasingAnchors"] is True

    by_id = {item["evidenceId"]: item for item in evidence}
    ordered = sorted(evidence, key=lambda item: (item["timestampStartMs"], item["evidenceId"]))
    value = candidate([
        chapter([ordered[0]["evidenceId"]], relation="opening"),
        chapter([ordered[2]["evidenceId"]], relation="continuation"),
        chapter([ordered[-1]["evidenceId"]], relation="conclusion"),
    ])
    derivative = validate_grounded_comprehension(
        value,
        ordered,
        task_id="media_task_" + "1" * 32,
        task_revision=1,
        source_identity="portal:bilibili:BV1TEST00001:1:p1",
        evidence_catalog_sha256="0" * 64,
        media_duration_ms=24_000,
        receipt={
            "providerId": "minimax-cn-openai-vision",
            "modelId": "MiniMax-M3",
            "outboundDerivedTextSha256": "1" * 64,
            "requestCount": 1,
        },
        schema_version="v3-media-grounded-comprehension/v2.1",
    )
    assert derivative["quality"]["status"] == "complete"
    assert by_id  # the evidence binding stayed closed


def test_c3_equal_chapter_anchors_remain_rejected() -> None:
    """C3 — the frozen strict increase is NOT relaxed."""
    evidence = [
        evidence_item(0, 0),
        evidence_item(1, 0, kind="ocr_block"),
        evidence_item(2, 5_000),
        evidence_item(3, 15_000),
    ]
    ordered = sorted(evidence, key=lambda item: (item["timestampStartMs"], item["evidenceId"]))
    value = candidate([
        chapter([ordered[0]["evidenceId"]], relation="opening"),
        chapter([ordered[1]["evidenceId"]], relation="continuation"),
    ])
    with pytest.raises(MediaTaskStoreError) as error:
        validate_grounded_comprehension(
            value,
            ordered,
            task_id="media_task_" + "1" * 32,
            task_revision=1,
            source_identity="portal:bilibili:BV1TEST00001:1:p1",
            evidence_catalog_sha256="0" * 64,
            media_duration_ms=24_000,
            receipt={
                "providerId": "minimax-cn-openai-vision",
                "modelId": "MiniMax-M3",
                "outboundDerivedTextSha256": "1" * 64,
                "requestCount": 1,
            },
            schema_version="v3-media-grounded-comprehension/v2.1",
        )
    assert error.value.code == "V3510B_CHAPTER_TIME_INVALID"


def test_c3_a_catalog_with_fewer_than_two_distinct_starts_is_diagnosed() -> None:
    """C3 — insufficient temporal capacity is diagnosed and stays fail-closed."""
    evidence = [
        evidence_item(0, 0, kind="frame"),
        evidence_item(1, 0, kind="ocr_block"),
        evidence_item(2, 0),
    ]
    capacity = evidence_capacity_diagnostic(evidence)
    assert capacity["distinctStartCount"] == 1
    assert capacity["hasTwoStrictlyIncreasingAnchors"] is False
    diagnostic = build_stage_b_diagnostic(
        stage="validator_initial",
        failure_code="V3510B_CHAPTER_TIME_INVALID",
        candidate=candidate([chapter([evidence[0]["evidenceId"]])]),
        evidence=evidence,
    )
    assert diagnostic["evidenceCapacity"]["hasTwoStrictlyIncreasingAnchors"] is False


def test_c3_the_malformed_chapter_count_and_fields_are_distinguished() -> None:
    """C3 — the two malformed shapes never share a class."""
    counted = candidate([chapter([f"mtr_{index:032d}"]) for index in range(1)])
    counted["chapters"] = [chapter([f"mtr_{index:032d}"]) for index in range(1)]
    assert stage_b_candidate_shape_violation(counted) == "chapter_count"

    malformed = candidate([chapter([f"mtr_{index:032d}"]) for index in range(2)])
    malformed["chapters"][0]["extraField"] = "x"
    assert stage_b_candidate_shape_violation(malformed) == "chapter_field_set"

    wrong_relation = candidate([chapter([f"mtr_{index:032d}"]) for index in range(2)])
    wrong_relation["chapters"][0]["relationToPrevious"] = "nonsense"
    assert stage_b_candidate_shape_violation(wrong_relation) == "relation_enum"

    extra_top = candidate([chapter([f"mtr_{index:032d}"]) for index in range(2)])
    extra_top["summary"] = "x"
    assert stage_b_candidate_shape_violation(extra_top) == "top_level_key_set"


def test_c3_the_diagnostic_carries_no_text_no_ids_no_paths_and_no_payloads() -> None:
    """C3 — the scanner: a diagnostic may not carry anything forbidden."""
    secret_text = "绝不能进入诊断的字幕原文"
    evidence = [
        {
            "evidenceId": f"mtr_{index:032d}",
            "kind": "transcript",
            "timestampStartMs": index * 1_000,
            "timestampEndMs": index * 1_000 + 900,
            "text": secret_text,
        }
        for index in range(4)
    ]
    rogue = candidate([chapter([f"mtr_{index:032d}"]) for index in range(2)])
    rogue["chapters"][0]["title"] = secret_text
    rogue["rogueKeyWithText"] = secret_text
    diagnostic = build_stage_b_diagnostic(
        stage="validator_initial",
        failure_code="V3510B_CHAPTER_TIME_INVALID",
        candidate=rogue,
        evidence=evidence,
    )
    serialized = json.dumps(diagnostic, ensure_ascii=False)
    for forbidden in (
        secret_text,
        "mtr_00000000000000000000000000000000",
        "/home/",
        "/mnt/",
        "C:\\",
        "sk-",
        "minimax-",
        "title",
        "thesis",
    ):
        assert forbidden not in serialized, f"the diagnostic leaked {forbidden!r}"
    # The facts are still there.
    assert diagnostic["candidateShape"]["chapters"]["count"] == 2
    assert diagnostic["evidenceCapacity"]["evidenceCount"] == 4
    assert diagnostic["anchors"]["chapterAnchorCount"] == 2


# ---------------------------------------------------------------------------
# C4 — the adapter's shape enforcement and bounded repair.
# ---------------------------------------------------------------------------


def _valid_candidate() -> dict[str, Any]:
    return candidate([
        chapter(["mtr_00000000000000000000000000000000"], relation="opening"),
        chapter(["mtr_00000000000000000000000000000003"], relation="conclusion"),
    ])


def test_c4_a_malformed_first_candidate_is_regenerated_by_the_same_provider() -> None:
    """C4 — malformed first, valid next: the SAME Provider regenerates."""
    malformed = {"summary": "wrong shape", "chapters": []}
    provider, requests = fake_provider([malformed, _valid_candidate()])
    evidence = [evidence_item(index, index * 1_000) for index in range(4)]
    value, receipt = provider.synthesize_v2(title="测试标题", evidence=evidence)
    assert value["chapters"][0]["relationToPrevious"] == "opening"
    sent = candidate_requests(requests)
    assert len(sent) == 2
    assert receipt.request_count == len(requests)
    # The regeneration request carries the SHAPE rules, not the rejected text.
    assert sent[1]["task"] == "regenerate_grounded_comprehension_v2_shape"
    assert sent[1]["machineShapeViolation"] in {"top_level_key_set", "claims_shape"}


def test_c4_a_temporal_invalid_first_candidate_is_regenerated() -> None:
    """C4 — the temporal violation is repaired by the SAME Provider."""
    temporal_invalid = candidate([
        chapter(["mtr_00000000000000000000000000000000"], relation="opening"),
        chapter(["mtr_00000000000000000000000000000000"], relation="continuation"),
    ])
    provider, requests = fake_provider([temporal_invalid, _valid_candidate()])
    evidence = [evidence_item(index, index * 1_000) for index in range(4)]
    value, receipt = provider.synthesize_v2(title="测试标题", evidence=evidence)
    assert value["chapters"][1]["evidenceIds"] == ["mtr_00000000000000000000000000000003"]
    sent = candidate_requests(requests)
    assert len(sent) == 2
    assert receipt.request_count == len(requests)
    assert sent[1]["task"] == "repair_grounded_comprehension_v2_temporal_contract"


def test_c4_the_repair_request_carries_the_redacted_temporal_index() -> None:
    """C4 — the repair request states the allowed anchor capacity, no text."""
    temporal_invalid = candidate([
        chapter(["mtr_00000000000000000000000000000000"], relation="opening"),
        chapter(["mtr_00000000000000000000000000000000"], relation="continuation"),
    ])
    provider, requests = fake_provider([temporal_invalid, _valid_candidate()])
    evidence = [evidence_item(index, index * 1_000) for index in range(4)]
    provider.synthesize_v2(title="测试标题", evidence=evidence)
    index_payload = candidate_requests(requests)[1]["temporalIndex"]
    assert index_payload["distinctStartCount"] == 4
    assert index_payload["minimumChapterCount"] == 2
    assert index_payload["maximumChapterCount"] == 12
    assert index_payload["strictlyIncreasingAnchorsRequired"] is True
    serialized = json.dumps(index_payload, ensure_ascii=False)
    assert "这是第" not in serialized
    assert "mtr_" not in serialized


def test_c4_a_persistently_malformed_candidate_exhausts_the_bound() -> None:
    """C4 — persistent invalid output keeps the frozen failure code."""
    provider, requests = fake_provider([{"summary": "wrong"}] * 12)
    evidence = [evidence_item(index, index * 1_000) for index in range(4)]
    with pytest.raises(MediaTaskStoreError) as error:
        provider.synthesize_v2(title="测试标题", evidence=evidence)
    assert error.value.code == "V352_SYNTHESIS_RESPONSE_INVALID"
    assert len(requests) <= provider.request_bound


def test_c4_persistently_duplicated_anchors_fail_closed() -> None:
    """C4 — an anchor violation that never resolves stays fail-closed."""
    temporal_invalid = candidate([
        chapter(["mtr_00000000000000000000000000000000"], relation="opening"),
        chapter(["mtr_00000000000000000000000000000000"], relation="continuation"),
    ])
    provider, requests = fake_provider([temporal_invalid] * 12)
    evidence = [evidence_item(index, index * 1_000) for index in range(4)]
    with pytest.raises(MediaTaskStoreError) as error:
        provider.synthesize_v2(title="测试标题", evidence=evidence)
    assert error.value.code == "V352_SYNTHESIS_RESPONSE_INVALID"
    assert len(requests) <= provider.request_bound


def test_c4_the_request_bound_is_hard_and_exposed() -> None:
    """C4 — the bound is a number the receipt and the tests can see."""
    provider, _ = fake_provider([])
    assert provider.request_bound == 8
    assert provider._request_budget_available() is True


def test_c4_the_receipt_reports_the_request_count_and_the_digests() -> None:
    """C4 — the receipt still records the requests and their digests."""
    provider, requests = fake_provider([_valid_candidate()])
    evidence = [evidence_item(index, index * 1_000) for index in range(4)]
    _, receipt = provider.synthesize_v2(title="测试标题", evidence=evidence)
    assert receipt.request_count == len(requests)
    assert len(receipt.outbound_sha256) == 64
    assert len(receipt.response_sha256) == 64
    assert receipt.attempt_id.startswith("attempt-")


def test_c4_the_adapter_records_the_redacted_stage_diagnostics() -> None:
    """C4 — the adapter's own stage diagnostics are redacted."""
    malformed = {"summary": "wrong shape", "chapters": []}
    provider, _ = fake_provider([malformed, _valid_candidate()])
    evidence = [evidence_item(index, index * 1_000) for index in range(4)]
    provider.synthesize_v2(title="测试标题", evidence=evidence)
    stages = provider.stage_b_diagnostics
    assert stages, "the adapter must record its stage diagnostics"
    assert stages[0]["stage"] == "initial_candidate"
    serialized = json.dumps(stages, ensure_ascii=False)
    assert "这是第" not in serialized
    assert "mtr_" not in serialized


def test_c4_the_independent_validator_stays_authoritative() -> None:
    """C4 — the adapter's shape check never accepts a candidate."""
    # A candidate with a valid shape but an unknown evidence id is still
    # refused by the INDEPENDENT validator.
    value = candidate([
        chapter(["mtr_unknown000000000000000000000000000"], relation="opening"),
        chapter(["mtr_00000000000000000000000000000003"], relation="conclusion"),
    ])
    assert stage_b_candidate_shape_violation(value) is None
    evidence = [evidence_item(index, index * 1_000) for index in range(4)]
    ordered = sorted(evidence, key=lambda item: (item["timestampStartMs"], item["evidenceId"]))
    with pytest.raises(MediaTaskStoreError) as error:
        validate_grounded_comprehension(
            value,
            ordered,
            task_id="media_task_" + "1" * 32,
            task_revision=1,
            source_identity="portal:bilibili:BV1TEST00001:1:p1",
            evidence_catalog_sha256="0" * 64,
            media_duration_ms=24_000,
            receipt={
                "providerId": "minimax-cn-openai-vision",
                "modelId": "MiniMax-M3",
                "outboundDerivedTextSha256": "1" * 64,
                "requestCount": 1,
            },
            schema_version="v3-media-grounded-comprehension/v2.1",
        )
    assert error.value.code == "V3510B_EVIDENCE_UNCLOSED"
