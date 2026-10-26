"""GC-B6F — the candidate invariant recovery.

Every candidate-producing request carries the SAME complete frozen candidate
invariants, so a targeted repair can never regress an invariant it does not
address, and a value-domain failure is diagnosable without content leakage.

The adapter in the tests is the REAL production adapter; only its HTTP
transport is faked. No Chrome, no Cookie, no Provider, no download and no
real BVID is involved.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import httpx
import pytest

from navia_runtime.modules.media_companion.comprehension.diagnostics import (
    CANDIDATE_CONTRACT_SCHEMA,
    candidate_contract_requirements,
    candidate_contract_trustworthy,
    candidate_shape_diagnostic,
    stage_b_candidate_shape_violation,
)
from navia_runtime.modules.media_companion.comprehension.quality import (
    assess_chapter_balance,
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


def evidence_item(index: int, start_ms: int, kind: str = "transcript") -> dict[str, Any]:
    return {
        "evidenceId": f"mtr_{index + 1:032d}",
        "kind": kind,
        "timestampStartMs": start_ms,
        "timestampEndMs": start_ms + 900,
        "text": f"第 {index + 1} 段派生字幕文本，包含可核验的事实陈述与时间范围说明。",
    }


def catalog(count: int = 12, spacing_ms: int = 10_000) -> list[dict[str, Any]]:
    return [evidence_item(index, index * spacing_ms) for index in range(count)]


def chapter(evidence_ids: list[str], *, relation: str = "continuation") -> dict[str, Any]:
    return {
        "title": "章节标题说明",
        "thesis": "章节核心结论的说明文字。",
        "evidenceIds": list(evidence_ids),
        "relationToPrevious": relation,
    }


def candidate(chapters: list[dict[str, Any]], evidence: list[dict[str, Any]]) -> dict[str, Any]:
    ids = [item["evidenceId"] for item in evidence]
    return {
        "brief": {
            "text": "视频完整讲述了背景、方法与结论，覆盖开头中段和结尾。",
            "evidenceIds": [ids[0], ids[len(ids) // 2], ids[-1]],
        },
        "claims": [
            {"text": "第一条可核验的核心表达，概括了视频的一个要点。", "evidenceIds": [ids[0]]},
            {"text": "第二条可核验的核心表达，说明了结论与适用边界。", "evidenceIds": [ids[-1]]},
        ],
        "chapters": chapters,
        "unresolvedEvidenceConflict": False,
    }


def valid_candidate(evidence: list[dict[str, Any]]) -> dict[str, Any]:
    ids = [item["evidenceId"] for item in evidence]
    picked = [ids[0], ids[len(ids) // 2], ids[-1]]
    return candidate(
        [chapter([evidence_id], relation="opening" if index == 0 else "continuation")
         for index, evidence_id in enumerate(picked)],
        evidence,
    )


def candidate_requests(requests: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        request for request in requests
        if request.get("task") != "extract_grounded_chapter_candidates"
    ]


def fake_provider(bodies: list[Any]) -> tuple[MiniMaxGroundedSynthesisProvider, list[dict[str, Any]]]:
    remaining = list(bodies)
    requests: list[dict[str, Any]] = []

    def handler(request: httpx.Request) -> httpx.Response:
        envelope = json.loads(request.content.decode("utf-8"))
        payload = json.loads(envelope["messages"][-1]["content"])
        requests.append(payload)
        if payload.get("task") == "extract_grounded_chapter_candidates":
            body: Any = CHUNK_BODY
        else:
            body = remaining.pop(0) if remaining else {"summary": "no more bodies"}
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
# B6F-1 — the table of the candidate-producing requests.
# ---------------------------------------------------------------------------

def _invariant_statements(block: dict[str, Any]) -> list[str]:
    """The count-independent invariant statements of a contract block."""
    return [
        statement for statement in block["requirements"]
        if "章节数达到" not in statement
        and "任一 20%" not in statement
        and "单章跨度" not in statement
        and "章节起点" not in statement
    ]


def _reference_block(evidence: list[dict[str, Any]]) -> dict[str, Any]:
    """The reference block: the OWNER's output for the same evidence."""
    return candidate_contract_requirements(evidence=evidence)


GENERATION_TASKS = [
    "produce_grounded_comprehension_v2",
    "regenerate_grounded_comprehension_v2_shape",
    "repair_grounded_comprehension_v2_temporal_contract",
    "regenerate_grounded_comprehension_v2_chapter_balance",
    "repair_rejected_grounded_comprehension_v2",
]


def _invariant_statements(block: dict[str, Any]) -> list[str]:
    """The count-independent invariant statements of a contract block."""
    return [
        statement for statement in block["requirements"]
        if "章节数达到" not in statement
        and "任一 20%" not in statement
        and "单章跨度" not in statement
        and "章节起点" not in statement
    ]


def _reference_block(evidence: list[dict[str, Any]]) -> dict[str, Any]:
    """The reference block: the OWNER's output for the same evidence."""
    return candidate_contract_requirements(evidence=evidence)


GENERATION_TASKS = [
    "produce_grounded_comprehension_v2",
    "regenerate_grounded_comprehension_v2_shape",
    "repair_grounded_comprehension_v2_temporal_contract",
    "regenerate_grounded_comprehension_v2_chapter_balance",
    "repair_rejected_grounded_comprehension_v2",
]


def _collect_payloads(evidence: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Drive EVERY candidate-producing request of the adapter and collect it."""
    payloads: list[dict[str, Any]] = []
    ids = [item["evidenceId"] for item in evidence]

    # 1. the initial route with a MALFORMED first candidate -> the shape
    #    regeneration.
    malformed = valid_candidate(evidence)
    malformed["claims"] = malformed["claims"] * 5
    provider, requests = fake_provider([malformed, valid_candidate(evidence)])
    provider.synthesize_v2(title="离线标题", evidence=evidence, style="structured")
    payloads.extend(requests)

    # 2. the initial route with a TEMPORAL invalid candidate -> the temporal
    #    repair.
    temporal = candidate(
        [
            chapter([ids[0]], relation="opening"),
            chapter([ids[0]], relation="continuation"),
            chapter([ids[-1]], relation="conclusion"),
        ],
        evidence,
    )
    provider, requests = fake_provider([temporal, valid_candidate(evidence)])
    provider.synthesize_v2(title="离线标题", evidence=evidence, style="structured")
    payloads.extend(requests)

    # 3. the initial route with a BALANCE invalid candidate -> the balance
    #    regeneration. The anchors cluster inside one fifth of the span.
    dense = catalog(12, spacing_ms=200)
    dense_ids = [item["evidenceId"] for item in dense]
    imbalanced = candidate(
        [chapter([evidence_id]) for evidence_id in dense_ids[:5]]
        + [chapter([dense_ids[-1]], relation="conclusion")],
        dense,
    )
    provider, requests = fake_provider([imbalanced, valid_candidate(dense)])
    provider.synthesize_v2(title="离线标题", evidence=dense, style="structured")
    payloads.extend(requests)

    # 4. the service repair route -> the rejected-candidate regeneration.
    provider, requests = fake_provider([valid_candidate(evidence)])
    provider.repair_v2(
        title="离线标题",
        evidence=evidence,
        candidate=valid_candidate(evidence),
        failure_code="V3510B_BRIEF_COVERAGE_INSUFFICIENT",
        style="structured",
    )
    payloads.extend(requests)
    return payloads


@pytest.mark.parametrize("task", GENERATION_TASKS)
def test_b6f1_every_generation_task_carries_the_complete_invariant_block(task: str) -> None:
    """B6F-1 — every candidate-producing request carries the block ONCE."""
    evidence = catalog()
    payloads = _collect_payloads(evidence)
    matched = [payload for payload in payloads if payload.get("task") == task]
    assert matched, f"the task {task} never produced a request"
    reference_block = _reference_block(evidence)
    for payload in matched:
        assert "candidateContract" in payload, f"{task} does not carry the invariant block"
        # The block is present EXACTLY once.
        assert list(payload.keys()).count("candidateContract") == 1
        block = payload["candidateContract"]
        assert block["schemaVersion"] == CANDIDATE_CONTRACT_SCHEMA
        # The block is the OWNER's output: every invariant is present and the
        # targeted request never removed one of them.
        assert block["chapterBalance"]["maximumChapterSpanRatio"] == 0.60
        assert block["chapterBalance"]["minimumChaptersForConcentrationRule"] == 6
        assert block["chapterBalance"]["minimumChaptersForSpanRule"] == 4
        # The complete invariant set is present.
        assert block["outputKeys"]["top"] == [
            "brief", "chapters", "claims", "unresolvedEvidenceConflict",
        ]
        assert block["outputKeys"]["brief"] == ["evidenceIds", "text"]
        assert block["outputKeys"]["claim"] == ["evidenceIds", "text"]
        assert block["outputKeys"]["chapter"] == [
            "evidenceIds", "relationToPrevious", "thesis", "title",
        ]
        assert block["textRanges"]["brief"] == [20, 100]
        assert block["textRanges"]["claim"] == [8, 240]
        assert block["textRanges"]["chapterTitle"] == [4, 80]
        assert block["textRanges"]["chapterThesis"] == [8, 500]
        assert block["counts"]["claims"]["minimum"] == 2
        assert block["counts"]["claims"]["maximum"] == 8
        assert block["counts"]["chapters"]["minimum"] == 2
        assert block["counts"]["chapters"]["maximum"] == 12
        assert block["relations"] == sorted([
            "cause_effect", "conclusion", "contrast", "continuation", "example", "opening",
        ])
        assert block["conflictFlag"] == {"type": "boolean", "required": True}
        assert block["boundaryEvidence"]["firstEvidenceId"] == evidence[0]["evidenceId"]
        assert block["boundaryEvidence"]["lastEvidenceId"] == evidence[-1]["evidenceId"]
        assert block["anchorOrder"] == "strictly increasing"
        assert block["chapterBalance"]["maximumChapterSpanRatio"] == 0.60
        # The boundary, the anchor order and the membership rules are stated.
        requirements = "\n".join(block["requirements"])
        assert "第一章 evidenceIds 必须包含最早证据" in requirements
        assert "最后一章 evidenceIds 必须包含最晚证据" in requirements
        assert "严格递增" in requirements
        assert "evidenceIndex" in requirements


@pytest.mark.parametrize("task", GENERATION_TASKS)
def test_b6f1_the_targeted_instructions_cannot_shadow_the_block(task: str) -> None:
    """B6F-1 — a targeted instruction never replaces the common block."""
    evidence = catalog()
    payloads = _collect_payloads(evidence)
    matched = [payload for payload in payloads if payload.get("task") == task]
    assert matched
    reference_block = _reference_block(evidence)
    for payload in matched:
        block = payload["candidateContract"]
        targeted = payload.get("requirements", [])
        assert isinstance(targeted, list)
        # A targeted statement may RESTATE a common requirement, but it can
        # never REMOVE one: the block is a separate value that the targeted
        # request cannot touch, and its count-independent invariant
        # statements are the SAME in every request.
        for statement in targeted:
            assert isinstance(statement, str) and statement
        assert _invariant_statements(block) == _invariant_statements(reference_block)
        # Every invariant the targeted list addresses is still in the block.
        for subject in ("brief", "claims", "chapters", "relationToPrevious",
                        "unresolvedEvidenceConflict", "evidenceId"):
            assert any(subject in item for item in block["requirements"])


def test_b6f1_the_contract_owner_is_pure_and_stable() -> None:
    """B6F-1 — the owner returns the same block for the same input."""
    evidence = catalog()
    first = candidate_contract_requirements(evidence=evidence)
    second = candidate_contract_requirements(evidence=evidence)
    assert first == second
    assert json.dumps(first, ensure_ascii=False, sort_keys=True)


# ---------------------------------------------------------------------------
# B6F-2 — the value domains.
# ---------------------------------------------------------------------------

BRIEF_MIN = 20
BRIEF_MAX = 100
CLAIM_MIN = 8
CLAIM_MAX = 240
TITLE_MIN = 4
TITLE_MAX = 80
THESIS_MIN = 8
THESIS_MAX = 500


@pytest.mark.parametrize(
    ("length", "expected"),
    [
        (BRIEF_MIN - 1, "too_short"),
        (BRIEF_MIN, "in_range"),
        (BRIEF_MAX, "in_range"),
        (BRIEF_MAX + 1, "too_long"),
    ],
)
def test_b6f2_the_brief_text_length_buckets_are_exact(length: int, expected: str) -> None:
    """B6F-2 — the brief text bucket is exact and one over."""
    evidence = catalog()
    value = candidate([chapter([evidence[0]["evidenceId"]]), chapter([evidence[-1]["evidenceId"]])], evidence)
    value["brief"]["text"] = "甲" * length
    diagnostic = candidate_shape_diagnostic(value, evidence)
    domain = diagnostic["brief"]["valueDomain"]
    assert domain["textLengthBucket"] == expected
    if expected != "in_range":
        assert stage_b_candidate_shape_violation(value, evidence) == "brief_value_domain"


@pytest.mark.parametrize(
    ("length", "expected"),
    [
        (CLAIM_MIN - 1, "too_short"),
        (CLAIM_MIN, "in_range"),
        (CLAIM_MAX, "in_range"),
        (CLAIM_MAX + 1, "too_long"),
    ],
)
def test_b6f2_the_claim_text_length_buckets_are_exact(length: int, expected: str) -> None:
    """B6F-2 — the claim text bucket is exact and one over."""
    evidence = catalog()
    value = candidate([chapter([evidence[0]["evidenceId"]]), chapter([evidence[-1]["evidenceId"]])], evidence)
    value["claims"][0]["text"] = "甲" * length
    diagnostic = candidate_shape_diagnostic(value, evidence)
    domain = diagnostic["claims"]["valueDomain"]
    assert expected in domain["textLengthBucketClasses"]
    assert domain["textInvalidItemCount"] == (0 if expected == "in_range" else 1)
    if expected != "in_range":
        assert stage_b_candidate_shape_violation(value, evidence) == "claim_value_domain"


@pytest.mark.parametrize(
    ("length", "expected"),
    [
        (TITLE_MIN - 1, "too_short"),
        (TITLE_MIN, "in_range"),
        (TITLE_MAX, "in_range"),
        (TITLE_MAX + 1, "too_long"),
    ],
)
def test_b6f2_the_chapter_name_length_buckets_are_exact(length: int, expected: str) -> None:
    """B6F-2 — the chapter name bucket is exact and one over."""
    evidence = catalog()
    value = candidate([chapter([evidence[0]["evidenceId"]]), chapter([evidence[-1]["evidenceId"]])], evidence)
    value["chapters"][0]["title"] = "甲" * length
    diagnostic = candidate_shape_diagnostic(value, evidence)
    domain = diagnostic["chapters"]["valueDomain"]
    assert expected in domain["chapterNameLengthBucketClasses"]
    assert domain["chapterNameInvalidItemCount"] == (0 if expected == "in_range" else 1)
    if expected != "in_range":
        assert stage_b_candidate_shape_violation(value, evidence) == "chapter_value_domain"


@pytest.mark.parametrize(
    ("length", "expected"),
    [
        (THESIS_MIN - 1, "too_short"),
        (THESIS_MIN, "in_range"),
        (THESIS_MAX, "in_range"),
        (THESIS_MAX + 1, "too_long"),
    ],
)
def test_b6f2_the_chapter_statement_length_buckets_are_exact(length: int, expected: str) -> None:
    """B6F-2 — the chapter statement bucket is exact and one over."""
    evidence = catalog()
    value = candidate([chapter([evidence[0]["evidenceId"]]), chapter([evidence[-1]["evidenceId"]])], evidence)
    value["chapters"][0]["thesis"] = "甲" * length
    diagnostic = candidate_shape_diagnostic(value, evidence)
    domain = diagnostic["chapters"]["valueDomain"]
    assert expected in domain["chapterStatementLengthBucketClasses"]
    assert domain["chapterStatementInvalidItemCount"] == (0 if expected == "in_range" else 1)
    if expected != "in_range":
        assert stage_b_candidate_shape_violation(value, evidence) == "chapter_value_domain"


def test_b6f2_the_brief_text_type_is_reported_without_the_text() -> None:
    """B6F-2 — a non-string brief text is a type class, never the value."""
    evidence = catalog()
    value = candidate([chapter([evidence[0]["evidenceId"]]), chapter([evidence[-1]["evidenceId"]])], evidence)
    value["brief"]["text"] = 12345
    domain = candidate_shape_diagnostic(value, evidence)["brief"]["valueDomain"]
    assert domain["textType"] == "not_a_string"
    assert domain["textLengthBucket"] == "unknown"
    assert "12345" not in json.dumps(domain, ensure_ascii=False)


def test_b6f2_the_evidence_id_container_and_item_failures_are_reported() -> None:
    """B6F-2 — the container class and the item counts are reported."""
    evidence = catalog()
    value = candidate([chapter([evidence[0]["evidenceId"]]), chapter([evidence[-1]["evidenceId"]])], evidence)
    value["brief"]["evidenceIds"] = "not-a-list"
    domain = candidate_shape_diagnostic(value, evidence)["brief"]["valueDomain"]
    assert domain["evidenceIdsContainer"] == "not_a_list"
    assert domain["evidenceIdsItemCount"] == 0

    value = candidate([chapter([evidence[0]["evidenceId"]]), chapter([evidence[-1]["evidenceId"]])], evidence)
    value["brief"]["evidenceIds"] = ["", 7, None, "mtr_unknown"]
    domain = candidate_shape_diagnostic(value, evidence)["brief"]["valueDomain"]
    assert domain["evidenceIdsContainer"] == "list"
    assert domain["evidenceIdsItemCount"] == 4
    assert domain["evidenceIdsEmptyItemCount"] == 1
    assert domain["evidenceIdsNonStringItemCount"] == 2
    assert domain["unknownEvidenceReferenceCount"] == 1


def test_b6f2_the_unknown_reference_count_is_reported_per_collection() -> None:
    """B6F-2 — the membership failure is counted, never named."""
    evidence = catalog()
    value = candidate([chapter([evidence[0]["evidenceId"]]), chapter([evidence[-1]["evidenceId"]])], evidence)
    value["claims"][0]["evidenceIds"] = ["mtr_unknown000000000000000000000000000"]
    diagnostic = candidate_shape_diagnostic(value, evidence)
    assert diagnostic["claims"]["valueDomain"]["unknownEvidenceReferenceCount"] == 1
    assert "mtr_unknown" not in json.dumps(diagnostic, ensure_ascii=False)


def test_b6f2_empty_evidence_id_arrays_are_reported_as_invalid() -> None:
    """B6F-2 — an empty list is a container defect, not zero invalid items."""
    evidence = catalog()
    value = candidate([chapter([evidence[0]["evidenceId"]]), chapter([evidence[-1]["evidenceId"]])], evidence)
    value["brief"]["evidenceIds"] = []
    value["claims"][0]["evidenceIds"] = []
    value["chapters"][0]["evidenceIds"] = []
    diagnostic = candidate_shape_diagnostic(value, evidence)
    assert diagnostic["brief"]["valueDomain"]["evidenceIdsContainer"] == "empty_list"
    assert diagnostic["claims"]["valueDomain"]["evidenceIdsInvalidItemCount"] == 1
    assert diagnostic["chapters"]["valueDomain"]["evidenceIdsInvalidItemCount"] == 1


@pytest.mark.parametrize(
    ("section", "expected"),
    [("brief", "brief_value_domain"), ("claim", "claim_value_domain")],
)
def test_b6f2_unknown_references_are_refused_before_the_validator(section: str, expected: str) -> None:
    """B6F-2 — the adapter enforces membership, not only the prompt."""
    evidence = catalog()
    value = candidate([chapter([evidence[0]["evidenceId"]]), chapter([evidence[-1]["evidenceId"]])], evidence)
    unknown = "mtr_unknown000000000000000000000000000"
    if section == "brief":
        value["brief"]["evidenceIds"] = [unknown]
    else:
        value["claims"][0]["evidenceIds"] = [unknown]
    assert stage_b_candidate_shape_violation(value, evidence) == expected


# ---------------------------------------------------------------------------
# B6F-3 — the privacy of the diagnostic.
# ---------------------------------------------------------------------------

def test_b6f3_the_diagnostic_carries_no_content_no_ids_and_no_provider_identity() -> None:
    """B6F-3 — the value-domain facts are enums and counts only."""
    secret = "绝不能进入诊断的字幕原文"
    evidence = [
        {
            "evidenceId": f"mtr_{index:032d}",
            "kind": "transcript",
            "timestampStartMs": index * 1_000,
            "timestampEndMs": index * 1_000 + 900,
            "text": secret,
        }
        for index in range(6)
    ]
    rogue = candidate([chapter([evidence[0]["evidenceId"]]), chapter([evidence[-1]["evidenceId"]])], evidence)
    rogue["brief"]["text"] = secret
    rogue["chapters"][0]["thesis"] = secret
    rogue["chapters"][0]["evidenceIds"] = ["mtr_unknown000000000000000000000000000"]
    diagnostic = candidate_shape_diagnostic(rogue, evidence)
    serialized = json.dumps(diagnostic, ensure_ascii=False)
    for forbidden in (
        secret,
        "mtr_00000000000000000000000000000000",
        "minimax",
        "MiniMax",
        "/home/",
        "sk-",
    ):
        assert forbidden not in serialized, f"the diagnostic leaked {forbidden!r}"


def test_b6f3_the_balance_assessment_stays_privacy_safe() -> None:
    """B6F-3 — the balance facts are counts and ratios only."""
    evidence = catalog()
    assessment = assess_chapter_balance(
        anchors=[0, 1, 2, 3, 4, 5],
        span_start_ms=0,
        span_end_ms=60_000,
        substantive_region_count=3,
    )
    serialized = json.dumps(assessment.as_diagnostic(), ensure_ascii=False)
    for forbidden in ("mtr_", "第 ", "minimax", "/home/"):
        assert forbidden not in serialized


# ---------------------------------------------------------------------------
# B6F-4 — the scripted real trace.
# ---------------------------------------------------------------------------

def _brief_shape(evidence: list[dict[str, Any]]) -> dict[str, Any]:
    value = valid_candidate(evidence)
    value["brief"]["unexpectedField"] = "额外的字段"
    return value


def _brief_value_domain(evidence: list[dict[str, Any]]) -> dict[str, Any]:
    value = valid_candidate(evidence)
    value["brief"]["text"] = "太短"
    return value


def _temporal_invalid(evidence: list[dict[str, Any]]) -> dict[str, Any]:
    ids = [item["evidenceId"] for item in evidence]
    return candidate(
        [
            chapter([ids[0]], relation="opening"),
            chapter([ids[0]], relation="continuation"),
            chapter([ids[-1]], relation="conclusion"),
        ],
        evidence,
    )


def _temporal_and_balance_invalid(evidence: list[dict[str, Any]]) -> dict[str, Any]:
    ids = [item["evidenceId"] for item in evidence]
    return candidate(
        [
            chapter([ids[0]], relation="opening"),
            chapter([ids[1]], relation="continuation"),
            chapter([ids[2]], relation="continuation"),
            chapter([ids[3]], relation="continuation"),
            chapter([ids[4]], relation="continuation"),
            chapter([ids[-1]], relation="conclusion"),
        ],
        evidence,
    )


def test_b6f4_the_real_trace_converges_inside_the_same_budget() -> None:
    """B6F-4 — the observed sequence converges with NO local mutation."""
    evidence = catalog()
    bodies = [
        _brief_shape(evidence),
        _brief_value_domain(evidence),
        _temporal_invalid(evidence),
        _brief_value_domain(evidence),
        _temporal_and_balance_invalid(evidence),
        _brief_value_domain(evidence),
        valid_candidate(evidence),
    ]
    provider, requests = fake_provider(bodies)
    value, receipt = provider.synthesize_v2(title="离线标题", evidence=evidence, style="structured")
    assert stage_b_candidate_shape_violation(value, evidence) is None
    # The whole trace stayed inside the HARD bound.
    assert len(requests) <= MAX_REQUESTS
    assert receipt.request_count == len(requests)
    # Every candidate-producing request carried the complete block.
    for payload in candidate_requests(requests):
        assert "candidateContract" in payload
    # NOTHING was rewritten locally: the accepted candidate is the Provider's
    # LAST candidate, byte for byte.
    assert value == bodies[-1]
    # The stages of the trace are visible in the diagnostics.
    stages = provider.stage_b_diagnostics
    assert stages
    assert stages[-1]["repair"]["finalOutcome"] == "recovered"


def test_b6f4_the_real_trace_fails_closed_at_the_bound() -> None:
    """B6F-4 — the same trace that never converges fails closed."""
    evidence = catalog()
    bodies = [
        _brief_shape(evidence),
        _brief_value_domain(evidence),
        _temporal_invalid(evidence),
        _brief_value_domain(evidence),
        _temporal_and_balance_invalid(evidence),
        _brief_value_domain(evidence),
        _brief_value_domain(evidence),
        _brief_value_domain(evidence),
    ]
    provider, requests = fake_provider(bodies)
    with pytest.raises(MediaTaskStoreError) as error:
        provider.synthesize_v2(title="离线标题", evidence=evidence, style="structured")
    # The FROZEN terminal code of the service route: the same code the
    # consumed visible run ended with.
    assert error.value.code in {
        "V352_SYNTHESIS_RESPONSE_INVALID",
        "V3510B_CHAPTER_IMBALANCE",
    }
    assert len(requests) <= MAX_REQUESTS
    assert provider.provider_outbound_http_attempts <= MAX_REQUESTS
    assert provider.stage_b_diagnostics[-1]["repair"]["finalOutcome"] == "fail_closed"


# ---------------------------------------------------------------------------
# B6F-5 — the route parity and the selectable adapters.
# ---------------------------------------------------------------------------

def test_b6f5_the_initial_route_and_repair_v2_use_the_same_owner() -> None:
    """B6F-5 — both routes compose the SAME contract block."""
    evidence = catalog()
    provider, requests = fake_provider(
        [_brief_shape(evidence), valid_candidate(evidence), valid_candidate(evidence)]
    )
    provider.synthesize_v2(title="离线标题", evidence=evidence, style="structured")
    provider.repair_v2(
        title="离线标题",
        evidence=evidence,
        candidate=valid_candidate(evidence),
        failure_code="V3510B_BRIEF_COVERAGE_INSUFFICIENT",
        style="structured",
    )
    blocks = [
        payload["candidateContract"]
        for payload in candidate_requests(requests)
        if "candidateContract" in payload
    ]
    assert blocks
    reference = blocks[0]
    for block in blocks:
        assert block["outputKeys"] == reference["outputKeys"]
        assert block["textRanges"] == reference["textRanges"]
        assert block["relations"] == reference["relations"]
        assert block["conflictFlag"] == reference["conflictFlag"]
        assert block["boundaryEvidence"] == reference["boundaryEvidence"]


def test_b6f5_the_strict_adapter_runs_the_shared_repair_loop() -> None:
    """B6F-5 — the selectable strict adapter recognizes the repair tasks."""
    from navia_runtime.modules.media_companion.comprehension.synthesis import (
        DeepSeekStrictGroundedSynthesisProvider,
    )

    strict = DeepSeekStrictGroundedSynthesisProvider(
        {
            **PROVIDER,
            "id": "deepseek-strict",
            "model": "deepseek-chat",
            "adapterKind": "deepseek_strict",
        },
        client_factory=lambda: httpx.Client(transport=httpx.MockTransport(lambda request: httpx.Response(
            200,
            json={
                "choices": [
                    {"message": {"content": json.dumps(CHUNK_BODY, ensure_ascii=False)}, "finish_reason": "stop"}
                ],
                "usage": {"prompt_tokens": 1, "completion_tokens": 1},
            },
        ))),
    )
    for task in (
        "regenerate_grounded_comprehension_v2_shape",
        "regenerate_grounded_comprehension_v2_chapter_balance",
        "repair_grounded_comprehension_v2_temporal_contract",
    ):
        schema = strict._schema_for_task({
            "task": task,
            "evidenceIndex": [{"evidenceId": "mtr_00000000000000000000000000000001"}],
        })
        assert schema["required"] == [
            "brief", "claims", "chapters", "unresolvedEvidenceConflict",
        ]


def test_b6f5_the_trust_decision_is_structural_only() -> None:
    """B6F-5 — the trust is about the STRUCTURE, never the values."""
    evidence = catalog()
    value = valid_candidate(evidence)
    assert candidate_contract_trustworthy(value) is True
    # A VALUE defect does not break the structural trust.
    value["brief"]["text"] = "太短"
    assert candidate_contract_trustworthy(value) is True
    # An unknown key breaks it.
    value["rogueKeyWithText"] = "任意文本"
    assert candidate_contract_trustworthy(value) is False
    # An invalid container type breaks it.
    value = valid_candidate(evidence)
    value["claims"] = "not-a-list"
    assert candidate_contract_trustworthy(value) is False
    # Nested non-string payloads cannot hide behind an otherwise valid list.
    value = valid_candidate(evidence)
    value["brief"]["evidenceIds"] = [{"rogue": "payload"}]
    assert candidate_contract_trustworthy(value) is False
    # A missing key breaks it.
    value = valid_candidate(evidence)
    del value["unresolvedEvidenceConflict"]
    assert candidate_contract_trustworthy(value) is False


# ---------------------------------------------------------------------------
# B6F-6 — the service level: a terminal sequence publishes NOTHING.
# ---------------------------------------------------------------------------

SERVICE_TASK = "media_task_" + "6" * 32
SERVICE_SOURCE = "portal:bilibili:BV1test6xx:41828944992:1"


class _ServiceProjection:
    """A projection with enough distinct evidence rows for the adapters."""

    def get(self, task_id: str) -> dict[str, Any]:
        segments = []
        for index in range(72):
            start = index * 1_000
            segments.append({
                "segmentId": f"seg_{index}",
                "startMs": start,
                "endMs": start + 900,
                "text": f"第 {index + 1} 段真实转写证据，说明视频背景与结论。",
            })
        return {
            "taskId": task_id,
            "sourceIdentity": SERVICE_SOURCE,
            "state": "succeeded",
            "terminal": True,
            "segments": segments,
        }


def _service(tmp_path: Path, provider: Any):
    from navia_runtime.modules.media_companion.comprehension import MediaComprehensionService
    from navia_runtime.modules.media_companion.product_materializer import MediaProductMaterializer
    from navia_runtime.modules.media_companion.task_store import MediaTaskStore

    store = MediaTaskStore(tmp_path / "runtime.sqlite3")
    private = tmp_path / "private"
    task = MediaProductMaterializer(store, _ServiceProjection(), private).materialize(SERVICE_TASK)
    return store, private, task, MediaComprehensionService(
        store,
        private,
        synthesis_provider_factory=lambda: provider,
    )


def test_b6f4_the_terminal_sequence_publishes_nothing_and_keeps_the_product(tmp_path) -> None:
    """B6F-4 — the terminal sequence fails closed and changes NOTHING."""
    store, private, task, service = _service(tmp_path, None)
    catalog = store.get(SERVICE_TASK)["projections"]["evidenceCatalog"]
    evidence = [
        {
            "evidenceId": item["evidenceId"],
            "kind": item["kind"],
            "timestampStartMs": item["timestampStartMs"],
            "timestampEndMs": item["timestampEndMs"],
            "text": "派生文本，用于服务级测试。",
        }
        for item in catalog
    ]
    assert len(evidence) >= 6

    # 1. the FIRST publish succeeds and becomes the previous durable product.
    good = candidate(
        [chapter([item["evidenceId"]]) for item in evidence[:3]]
        + [chapter([evidence[-1]["evidenceId"]], relation="conclusion")],
        evidence,
    )
    provider, _ = fake_provider([good])
    store, private, task, service = _service(tmp_path, provider)
    service.synthesize(SERVICE_TASK, task["revision"], True, "structured")
    published = private / "grounded-comprehension-v2.1" / SERVICE_TASK
    before = {path.name: path.read_bytes() for path in published.rglob("*") if path.is_file()}
    assert before, "the first publish must have produced a durable product"

    # 2. the SECOND attempt never converges: the brief stays out of its
    #    frozen value domain, so the sequence fails closed inside the bound.
    broken_candidate = json.loads(json.dumps(good, ensure_ascii=False))
    broken_candidate["brief"]["text"] = "太短"
    broken = [broken_candidate] * 12
    provider, requests = fake_provider(broken)
    store, private, task, service = _service(tmp_path, provider)
    with pytest.raises(MediaTaskStoreError) as error:
        service.synthesize(SERVICE_TASK, task["revision"], True, "structured")
    # The FROZEN terminal code of the service route: the same code the
    # consumed visible run ended with.
    assert error.value.code == "V3510B_PROVIDER_RESPONSE_INVALID"
    assert len(requests) <= MAX_REQUESTS
    # 3. the previous durable product is byte-identical.
    after = {path.name: path.read_bytes() for path in published.rglob("*") if path.is_file()}
    assert after == before, "the previous durable product must be unchanged"
    # The INTERNAL diagnostic of the final refusal exists.
    diagnostic = private / "diagnostics" / SERVICE_TASK / "stage-b-diagnostic.json"
    assert diagnostic.exists()
