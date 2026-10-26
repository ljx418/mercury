"""GC-B5R final offline correction — FC4 (the exact candidate shape and the
temporal enforcement) and FC5 (the real global Provider request cap).

Nothing here reaches an external system: the adapter is the REAL production
adapter and only its HTTP transport is faked. No Chrome, no Runtime, no
Provider, no download, no import, no media task, no Cookie and no audio
output happen in this file.

FC4 enforces the EXACT key sets of the top-level candidate, of the brief, of
EVERY claim and of EVERY chapter, requires a REAL boolean conflict flag, and
routes the initial route AND the service-level `repair_v2` through ONE shared
candidate-enforcement function.

FC5 enforces the hard global cap of ONE adapter instance: the initial
extraction, the candidate generation, the shape repair, the temporal repair
and the service-level `repair_v2` share ONE budget, and every retry after a
timeout or a malformed response counts against it.
"""

from __future__ import annotations

import json
from typing import Any

import httpx
import pytest

from navia_runtime.modules.media_companion.comprehension.diagnostics import (
    stage_b_candidate_shape_violation,
)
from navia_runtime.modules.media_companion.comprehension.service import (
    MediaComprehensionService,
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

CHUNK_BODY = {"summary": "分块概括", "sections": []}
MAX_REQUESTS = 8


def evidence_item(index: int, start_ms: int) -> dict[str, Any]:
    return {
        "evidenceId": f"mtr_{index:032d}",
        "kind": "transcript",
        "timestampStartMs": start_ms,
        "timestampEndMs": start_ms + 4_000,
        "text": f"这是第 {index} 条派生字幕文本，不属于诊断范围。",
    }


def chapter(
    evidence_ids: list[str],
    *,
    relation: str = "continuation",
) -> dict[str, Any]:
    return {
        "title": "章节标题",
        "thesis": "章节核心结论说明。",
        "evidenceIds": list(evidence_ids),
        "relationToPrevious": relation,
    }


def valid_candidate() -> dict[str, Any]:
    return {
        "brief": {
            "text": "视频完整讲述了背景、方法与结论，覆盖开头中段和结尾。",
            "evidenceIds": [
                "mtr_00000000000000000000000000000000",
                "mtr_00000000000000000000000000000002",
                "mtr_00000000000000000000000000000003",
            ],
        },
        "claims": [
            {
                "text": f"第 {index + 1} 条可核验的核心表达，概括了视频的一个要点。",
                "evidenceIds": [
                    "mtr_00000000000000000000000000000000"
                    if index == 0
                    else "mtr_00000000000000000000000000000003"
                ],
            }
            for index in range(2)
        ],
        "chapters": [
            chapter(["mtr_00000000000000000000000000000000"], relation="opening"),
            chapter(["mtr_00000000000000000000000000000003"], relation="conclusion"),
        ],
        "unresolvedEvidenceConflict": False,
    }


def temporal_invalid_candidate() -> dict[str, Any]:
    value = valid_candidate()
    value["chapters"][1]["evidenceIds"] = ["mtr_00000000000000000000000000000000"]
    return value


def candidate_requests(requests: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        request
        for request in requests
        if request.get("task") != "extract_grounded_chapter_candidates"
    ]


def fake_provider(
    bodies: list[Any],
) -> tuple[MiniMaxGroundedSynthesisProvider, list[dict[str, Any]]]:
    """The REAL adapter with a fake HTTP transport.

    The chunk-extraction requests are answered with the frozen chunk shape;
    the queued bodies answer the candidate requests, in order.
    """
    remaining = list(bodies)
    requests: list[dict[str, Any]] = []

    def handler(request: httpx.Request) -> httpx.Response:
        envelope = json.loads(request.content.decode("utf-8"))
        user_content = envelope["messages"][-1]["content"]
        payload = json.loads(user_content)
        requests.append(payload)
        body: Any = CHUNK_BODY if payload.get("task") == "extract_grounded_chapter_candidates" else remaining.pop(0)
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


def faulty_provider(
    fault: str,
) -> tuple[MiniMaxGroundedSynthesisProvider, list[int]]:
    """The REAL adapter whose every HTTP attempt fails in ONE way."""
    calls: list[int] = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(1)
        if fault == "timeout":
            raise httpx.TimeoutException("offline test timeout")
        # A malformed response: the content is not a JSON object.
        return httpx.Response(
            200,
            json={"choices": [{"message": {"content": "not json at all"}, "finish_reason": "stop"}]},
        )

    provider = MiniMaxGroundedSynthesisProvider(
        dict(PROVIDER),
        client_factory=lambda: httpx.Client(transport=httpx.MockTransport(handler)),
    )
    return provider, calls


def four_evidence() -> list[dict[str, Any]]:
    return [evidence_item(index, index * 1_000) for index in range(4)]


# ---------------------------------------------------------------------------
# FC4 — the EXACT candidate shape.
# ---------------------------------------------------------------------------


def test_fc4_the_valid_candidate_conforms() -> None:
    """FC4 — the exact frozen candidate passes the shape check."""
    assert stage_b_candidate_shape_violation(valid_candidate()) is None


def test_fc4_a_brief_with_a_missing_field_is_refused() -> None:
    """FC4 — a brief that misses a frozen field is a violation."""
    value = valid_candidate()
    del value["brief"]["evidenceIds"]
    assert stage_b_candidate_shape_violation(value) == "brief_shape"


def test_fc4_a_brief_with_an_extra_field_is_refused() -> None:
    """FC4 — a brief that carries an unknown field is a violation."""
    value = valid_candidate()
    value["brief"]["extraField"] = "x"
    assert stage_b_candidate_shape_violation(value) == "brief_shape"


@pytest.mark.parametrize("text", ["太短", "甲" * 101, None])
def test_fc4_a_brief_outside_the_frozen_value_domain_is_refused(text: Any) -> None:
    value = valid_candidate()
    value["brief"]["text"] = text
    assert stage_b_candidate_shape_violation(value) == "brief_value_domain"


def test_fc4_a_brief_without_evidence_ids_is_refused() -> None:
    value = valid_candidate()
    value["brief"]["evidenceIds"] = []
    assert stage_b_candidate_shape_violation(value) == "brief_value_domain"


def test_fc4_an_extra_field_on_a_non_first_claim_is_refused() -> None:
    """FC4 — EVERY claim is checked, not only the first one."""
    value = valid_candidate()
    value["claims"][1]["extraField"] = "x"
    assert stage_b_candidate_shape_violation(value) == "claim_field_set"


def test_fc4_a_missing_field_on_a_non_first_claim_is_refused() -> None:
    """FC4 — a non-first claim that misses a frozen field is a violation."""
    value = valid_candidate()
    del value["claims"][1]["evidenceIds"]
    assert stage_b_candidate_shape_violation(value) == "claim_field_set"


def test_fc4_a_non_object_claim_is_refused() -> None:
    """FC4 — a claim that is not an object is a violation."""
    value = valid_candidate()
    value["claims"][1] = "一句核心表达"
    assert stage_b_candidate_shape_violation(value) == "claim_field_set"


def test_fc4_initial_shape_regeneration_keeps_the_authorized_provider_context() -> None:
    """FC4/GC-B6F — the repair is grounded in the Provider's OWN derivative.

    The rejected candidate carries the EXACT frozen key vocabulary and safe
    container types, so it is structurally TRUSTED and it becomes the repair
    context. It is the Provider's own authorized derivative: no content is
    invented and nothing is rewritten locally.
    """
    malformed = valid_candidate()
    malformed["claims"] = malformed["claims"] * 5
    provider, sent = fake_provider([malformed, valid_candidate()])

    result, _ = provider.synthesize_v2(
        title="离线标题",
        evidence=four_evidence(),
        style="structured",
    )

    assert stage_b_candidate_shape_violation(result) is None
    candidate_payloads = candidate_requests(sent)
    assert candidate_payloads[1]["task"] == "regenerate_grounded_comprehension_v2_shape"
    assert candidate_payloads[1]["machineShapeViolation"] == "claims_shape"
    assert candidate_payloads[1]["targetCounts"] == {"claims": 5, "chapters": 4}
    # The TRUSTED rejected candidate is the repair context.
    assert candidate_payloads[1]["groundedContext"] == malformed


def test_fc4_an_untrusted_rejected_candidate_keeps_the_authorized_chunk_context() -> None:
    """FC4/GC-B6F — an UNTRUSTED candidate falls back to the chunk context.

    A candidate with an unknown key or an invalid container type may hold
    arbitrary Provider text, so it is never handed back to the Provider: the
    TRUSTED partial context is kept.
    """
    malformed = valid_candidate()
    malformed["rogueKeyWithText"] = "这是绝不能回传给 Provider 的任意文本"
    provider, sent = fake_provider([malformed, valid_candidate()])

    result, _ = provider.synthesize_v2(
        title="离线标题",
        evidence=four_evidence(),
        style="structured",
    )

    assert stage_b_candidate_shape_violation(result) is None
    candidate_payloads = candidate_requests(sent)
    assert candidate_payloads[1]["task"] == "regenerate_grounded_comprehension_v2_shape"
    assert candidate_payloads[1]["groundedContext"] == candidate_payloads[0]["chunkCandidates"]


def test_fc4_repair_shape_regeneration_keeps_the_validated_rejected_candidate() -> None:
    malformed = valid_candidate()
    malformed["brief"]["text"] = "太短"
    original = valid_candidate()
    provider, sent = fake_provider([malformed, valid_candidate()])

    result, _ = provider.repair_v2(
        title="离线标题",
        evidence=four_evidence(),
        candidate=original,
        failure_code="V3510B_BRIEF_COVERAGE_INSUFFICIENT",
        style="structured",
    )

    assert stage_b_candidate_shape_violation(result) is None
    assert sent[1]["task"] == "regenerate_grounded_comprehension_v2_shape"
    assert sent[1]["machineShapeViolation"] == "brief_value_domain"
    assert sent[1]["targetCounts"] == {"claims": 5, "chapters": 4}
    # The TRUSTED rejected candidate is the repair context: it is the
    # Provider's own authorized derivative.
    assert sent[1]["groundedContext"] == malformed


@pytest.mark.parametrize("text", ["太短", "甲" * 241, None])
def test_fc4_a_claim_outside_the_frozen_value_domain_is_refused(text: Any) -> None:
    value = valid_candidate()
    value["claims"][1]["text"] = text
    assert stage_b_candidate_shape_violation(value) == "claim_value_domain"


@pytest.mark.parametrize(
    ("field", "value"),
    [("title", "短"), ("title", "甲" * 81), ("thesis", "太短"), ("thesis", "甲" * 501), ("evidenceIds", [])],
)
def test_fc4_a_chapter_outside_the_frozen_value_domain_is_refused(field: str, value: Any) -> None:
    candidate = valid_candidate()
    candidate["chapters"][1][field] = value
    assert stage_b_candidate_shape_violation(candidate) == "chapter_value_domain"


def test_fc4_a_null_conflict_flag_is_refused() -> None:
    """FC4 — the conflict flag must be a REAL boolean."""
    value = valid_candidate()
    value["unresolvedEvidenceConflict"] = None
    assert stage_b_candidate_shape_violation(value) == "conflict_flag"


def test_fc4_a_missing_conflict_flag_is_refused() -> None:
    """FC4 — a missing conflict flag is a violation, never a default.

    A MISSING flag is also a missing TOP-LEVEL key, so the exact key set
    class is reported first; a PRESENT but null flag is reported as the
    conflict flag class. Both are refusals.
    """
    value = valid_candidate()
    del value["unresolvedEvidenceConflict"]
    violation = stage_b_candidate_shape_violation(value)
    assert violation is not None
    assert violation == "top_level_key_set"


def test_fc4_a_non_boolean_conflict_flag_is_refused() -> None:
    """FC4 — a truthy string is not a boolean."""
    value = valid_candidate()
    value["unresolvedEvidenceConflict"] = "false"
    assert stage_b_candidate_shape_violation(value) == "conflict_flag"


def test_fc4_every_chapter_is_checked() -> None:
    """FC4 — a malformed LAST chapter is a violation."""
    value = valid_candidate()
    value["chapters"][-1]["extraField"] = "x"
    assert stage_b_candidate_shape_violation(value) == "chapter_field_set"


def test_fc4_a_missing_top_level_field_is_refused() -> None:
    """FC4 — the top level is an EXACT key set too."""
    value = valid_candidate()
    del value["claims"]
    assert stage_b_candidate_shape_violation(value) == "top_level_key_set"


# ---------------------------------------------------------------------------
# FC4 — ONE shared enforcement on BOTH routes.
# ---------------------------------------------------------------------------


def test_fc4_the_initial_route_regenerates_a_malformed_candidate() -> None:
    """FC4 — a non-first claim violation is regenerated by the SAME Provider."""
    malformed = valid_candidate()
    malformed["claims"][1]["extraField"] = "x"
    provider, requests = fake_provider([malformed, valid_candidate()])
    value, _ = provider.synthesize_v2(title="测试标题", evidence=four_evidence())
    assert "extraField" not in value["claims"][1]
    sent = candidate_requests(requests)
    assert sent[1]["task"] == "regenerate_grounded_comprehension_v2_shape"
    assert sent[1]["machineShapeViolation"] == "claim_field_set"


def test_fc4_the_repair_route_enforces_the_same_shape() -> None:
    """FC4 — the service-level repair route regenerates a malformed candidate."""
    malformed = valid_candidate()
    malformed["claims"][1]["extraField"] = "x"
    provider, requests = fake_provider([malformed, valid_candidate()])
    repaired, _ = provider.repair_v2(
        title="测试标题",
        evidence=four_evidence(),
        candidate=valid_candidate(),
        failure_code="V3510B_EVIDENCE_UNCLOSED",
        style="structured",
    )
    assert "extraField" not in repaired["claims"][1]
    sent = candidate_requests(requests)
    assert sent[1]["task"] == "regenerate_grounded_comprehension_v2_shape"
    assert sent[1]["machineShapeViolation"] == "claim_field_set"


def test_fc4_the_repair_route_enforces_the_temporal_contract() -> None:
    """FC4 — the repair route applies the SAME temporal validation."""
    provider, requests = fake_provider([temporal_invalid_candidate(), valid_candidate()])
    repaired, _ = provider.repair_v2(
        title="测试标题",
        evidence=four_evidence(),
        candidate=valid_candidate(),
        failure_code="V3510B_CHAPTER_TIME_INVALID",
        style="structured",
    )
    assert repaired["chapters"][1]["evidenceIds"] == ["mtr_00000000000000000000000000000003"]
    sent = candidate_requests(requests)
    assert sent[1]["task"] == "repair_grounded_comprehension_v2_temporal_contract"


def test_fc4_the_two_routes_issue_the_same_regeneration_contract() -> None:
    """FC4 — the initial and the repair route may never drift apart."""
    malformed = valid_candidate()
    malformed["claims"][1]["extraField"] = "x"

    initial_provider, initial_requests = fake_provider([malformed, valid_candidate()])
    initial_provider.synthesize_v2(title="测试标题", evidence=four_evidence())

    repair_provider, repair_requests = fake_provider([malformed, valid_candidate()])
    repair_provider.repair_v2(
        title="测试标题",
        evidence=four_evidence(),
        candidate=valid_candidate(),
        failure_code="V3510B_EVIDENCE_UNCLOSED",
        style="structured",
    )

    initial_regeneration = candidate_requests(initial_requests)[1]
    repair_regeneration = candidate_requests(repair_requests)[1]
    assert initial_regeneration["task"] == repair_regeneration["task"]
    assert initial_regeneration["machineShapeViolation"] == repair_regeneration["machineShapeViolation"]
    assert initial_regeneration["requirements"] == repair_regeneration["requirements"]
    assert initial_regeneration["outputSchema"] == repair_regeneration["outputSchema"]


def test_fc4_a_recovered_diagnostic_records_a_resolved_outcome() -> None:
    """FC4 — a recovered stage records `recovered`, never `fail_closed`."""
    malformed = valid_candidate()
    malformed["claims"][1]["extraField"] = "x"
    provider, _ = fake_provider([malformed, valid_candidate()])
    provider.synthesize_v2(title="测试标题", evidence=four_evidence())
    stages = provider.stage_b_diagnostics
    outcomes = [entry["repair"]["finalOutcome"] for entry in stages]
    assert "recovered" in outcomes
    assert "fail_closed" not in outcomes
    recovered = [entry for entry in stages if entry["repair"]["finalOutcome"] == "recovered"][0]
    assert recovered["failureCode"] is None
    assert recovered["candidateShape"]["shapeViolation"] == "none"
    # The diagnostic stays redacted.
    serialized = json.dumps(stages, ensure_ascii=False)
    assert "这是第" not in serialized
    assert "mtr_" not in serialized


def test_fc4_a_terminal_refusal_records_fail_closed() -> None:
    """FC4 — only a terminal refusal records `fail_closed`."""
    malformed = valid_candidate()
    malformed["claims"][1]["extraField"] = "x"
    provider, _ = fake_provider([malformed] * 16)
    with pytest.raises(MediaTaskStoreError) as error:
        provider.synthesize_v2(title="测试标题", evidence=four_evidence())
    assert error.value.code == "V352_SYNTHESIS_RESPONSE_INVALID"
    outcomes = [entry["repair"]["finalOutcome"] for entry in provider.stage_b_diagnostics]
    assert "fail_closed" in outcomes
    assert "recovered" not in outcomes


# ---------------------------------------------------------------------------
# FC5 — the real global Provider request cap.
# ---------------------------------------------------------------------------


def test_fc5_the_cap_is_eight_and_is_exposed() -> None:
    """FC5 — the cap is a number, not a comment."""
    provider, _ = fake_provider([])
    assert provider.request_bound == MAX_REQUESTS
    assert MAX_REQUESTS == 8


def test_fc5_a_timeout_at_the_cap_boundary_calls_the_client_once_more() -> None:
    """FC5 — starting at cap-1, a timeout buys at most ONE more attempt."""
    provider, calls = faulty_provider("timeout")
    # The budget starts at cap-1: seven attempts are already recorded.
    provider._requests.extend([b""] * (MAX_REQUESTS - 1))
    with pytest.raises(MediaTaskStoreError) as error:
        provider.synthesize_v2(title="测试标题", evidence=four_evidence())
    assert error.value.code == "V352_SYNTHESIS_RESPONSE_INVALID"
    assert len(calls) == 1, "the client may be called at most once more"
    assert len(provider._requests) <= MAX_REQUESTS


def test_fc5_a_malformed_response_at_the_cap_boundary_calls_the_client_once_more() -> None:
    """FC5 — a malformed JSON response buys at most ONE more attempt."""
    provider, calls = faulty_provider("malformed")
    provider._requests.extend([b""] * (MAX_REQUESTS - 1))
    with pytest.raises(MediaTaskStoreError) as error:
        provider.synthesize_v2(title="测试标题", evidence=four_evidence())
    assert error.value.code == "V352_SYNTHESIS_RESPONSE_INVALID"
    assert len(calls) == 1, "the client may be called at most once more"
    assert len(provider._requests) <= MAX_REQUESTS


def test_fc5_the_retries_of_one_request_count_against_the_same_cap() -> None:
    """FC5 — the transport retry of ONE request never exceeds the cap."""
    provider, calls = faulty_provider("timeout")
    provider._requests.extend([b""] * (MAX_REQUESTS - 1))
    with pytest.raises(MediaTaskStoreError):
        provider.synthesize_v2(title="测试标题", evidence=four_evidence())
    assert len(calls) <= 1
    assert len(provider._requests) <= MAX_REQUESTS


def test_fc5_the_initial_route_and_the_service_repair_share_one_cap() -> None:
    """FC5 — the initial route and `repair_v2` share ONE budget."""
    malformed = valid_candidate()
    malformed["claims"][1]["extraField"] = "x"
    provider, _ = fake_provider([malformed, valid_candidate()] + [malformed] * 16)
    evidence = four_evidence()

    value, _ = provider.synthesize_v2(title="测试标题", evidence=evidence)
    assert len(provider._requests) == 3, "the extraction, the candidate and the regeneration"

    # The service-level repair runs on the SAME adapter instance.
    with pytest.raises(MediaTaskStoreError) as error:
        provider.repair_v2(
            title="测试标题",
            evidence=evidence,
            candidate=value,
            failure_code="V3510B_EVIDENCE_UNCLOSED",
            style="structured",
        )
    assert error.value.code == "V352_SYNTHESIS_RESPONSE_INVALID"
    assert len(provider._requests) == MAX_REQUESTS, "the shared cap is never exceeded"


def test_fc5_exceeding_the_cap_publishes_nothing() -> None:
    """FC5 — the frozen failure code survives, and no candidate is returned."""
    malformed = valid_candidate()
    malformed["claims"][1]["extraField"] = "x"
    provider, _ = fake_provider([malformed] * 16)
    with pytest.raises(MediaTaskStoreError) as error:
        provider.synthesize_v2(title="测试标题", evidence=four_evidence())
    assert error.value.code == "V352_SYNTHESIS_RESPONSE_INVALID"
    assert error.value.status == 502
    assert len(provider._requests) == MAX_REQUESTS
    # The receipt was never handed out: nothing is published.
    assert provider.stage_b_diagnostics[-1]["repair"]["finalOutcome"] == "fail_closed"


def test_fc5_the_extraction_shares_the_cap_with_the_candidate() -> None:
    """FC5 — the initial extraction counts against the same budget."""
    provider, requests = fake_provider([valid_candidate()])
    provider.synthesize_v2(title="测试标题", evidence=four_evidence())
    tasks = [request.get("task") for request in requests]
    assert tasks[0] == "extract_grounded_chapter_candidates"
    assert tasks[1] == "produce_grounded_comprehension_v2"
    assert len(provider._requests) == 2


# ---------------------------------------------------------------------------
# RC3 — the ACTUAL outbound Provider HTTP attempts.
# ---------------------------------------------------------------------------


def test_rc3_the_adapter_counts_every_outbound_attempt() -> None:
    """RC3 — the adapter owns the count of its OWN outbound attempts."""
    provider, requests = fake_provider([valid_candidate()])
    evidence = four_evidence()
    provider.synthesize_v2(title="测试标题", evidence=evidence)
    # The extraction and the candidate generation are both outbound attempts.
    assert len(requests) == 2
    assert provider.provider_outbound_http_attempts == 2
    assert provider.provider_outbound_http_attempts == len(requests)


def test_rc3_a_regeneration_is_counted_as_an_outbound_attempt() -> None:
    """RC3 — a malformed candidate and its regeneration are both counted."""
    malformed = valid_candidate()
    malformed["claims"][1]["extraField"] = "x"
    provider, requests = fake_provider([malformed, valid_candidate()])
    provider.synthesize_v2(title="测试标题", evidence=four_evidence())
    assert len(requests) == 3, "the extraction, the candidate and the regeneration"
    assert provider.provider_outbound_http_attempts == 3


def test_rc3_the_service_diagnostic_carries_the_outbound_attempt_count(tmp_path) -> None:
    """RC3 — the INTERNAL diagnostic of the production service carries it."""
    provider, requests = fake_provider([valid_candidate()])
    provider.synthesize_v2(title="测试标题", evidence=four_evidence())
    service = MediaComprehensionService(
        store=None,
        private_evidence_root=tmp_path,
        synthesis_provider_factory=lambda: provider,
    )
    service._write_stage_b_diagnostic(
        task_id="media_task_" + "9" * 32,
        stage="provider_attempt",
        failure_code="V3510B_PROVIDER_RESPONSE_INVALID",
        candidate=None,
        evidence=[],
        provider=provider,
    )
    written = json.loads(
        (tmp_path / "diagnostics" / ("media_task_" + "9" * 32) / "stage-b-diagnostic.json").read_text(
            encoding="utf-8"
        )
    )
    counts = [
        stage.get("providerOutboundHttpAttempts")
        for stage in written["stages"]
        if isinstance(stage, dict)
    ]
    assert counts, "the diagnostic must carry the count"
    assert max(count for count in counts if count is not None) == 2
    # The diagnostic carries a COUNT only: no response text, no prompt, no
    # evidence id, no path and no secret.
    serialized = json.dumps(written, ensure_ascii=False)
    assert "这是第" not in serialized
    assert "mtr_" not in serialized
    assert "/home/" not in serialized
    assert "sk-" not in serialized
