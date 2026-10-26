from copy import deepcopy

import pytest

from navia_runtime.modules.media_companion.comprehension.quality import (
    EvidenceSpanAnalyzer,
    compose_brief_from_validated_claims,
    validate_grounded_comprehension,
)
from navia_runtime.modules.media_companion.task_store import MediaTaskStoreError


TASK = "media_task_" + "a" * 32
HASH = "b" * 64


def evidence(duration=300_000):
    values = []
    for index, start in enumerate((0, 100_000, 200_000)):
        values.append({
            "evidenceId": "mtr_" + f"{index + 1:032x}",
            "kind": "transcript",
            "timestampStartMs": start,
            "timestampEndMs": duration if index == 2 else start + 100_000,
            "text": f"第{index + 1}部分提供足够长的真实派生文字并说明不同阶段的核心内容。",
        })
    return values


def candidate(items):
    ids = [item["evidenceId"] for item in items]
    return {
        "brief": {
            "text": "视频围绕核心问题依次说明背景、分析方法与最终结论，并明确适用边界。",
            "evidenceIds": ids,
        },
        "claims": [
            {"text": "开篇界定了需要解决的核心问题和讨论范围。", "evidenceIds": [ids[0]]},
            {"text": "中段给出分析路径，结尾形成有条件的整体结论。", "evidenceIds": ids[1:]},
        ],
        "chapters": [
            {"title": "问题背景与范围", "thesis": "开篇明确问题背景和后续分析范围。", "evidenceIds": [ids[0]], "relationToPrevious": "opening"},
            {"title": "分析路径与依据", "thesis": "中段使用具体依据推进核心分析。", "evidenceIds": [ids[1]], "relationToPrevious": "continuation"},
            {"title": "结论及适用边界", "thesis": "结尾汇总结论并说明适用条件。", "evidenceIds": [ids[2]], "relationToPrevious": "conclusion"},
        ],
        "unresolvedEvidenceConflict": False,
    }


def validate(value, items=None, duration=300_000):
    items = items or evidence(duration)
    return validate_grounded_comprehension(
        value,
        items,
        task_id=TASK,
        task_revision=7,
        source_identity="portal:bilibili:BV1test:1:video",
        evidence_catalog_sha256=HASH,
        media_duration_ms=duration,
        receipt={
            "providerId": "minimax",
            "modelId": "MiniMax-M2.1",
            "outboundDerivedTextSha256": "c" * 64,
            "requestCount": 1,
        },
    )


def test_span_analyzer_and_complete_contract():
    items = evidence()
    span = EvidenceSpanAnalyzer.analyze(items, 300_000)
    assert span.substantive_regions == {"opening", "middle", "ending"}
    result = validate(candidate(items), items)
    assert result["quality"]["status"] == "complete"
    assert result["brief"]["regions"] == ["opening", "middle", "ending"]
    assert [item["startMs"] for item in result["chapters"]] == [0, 100_000, 200_000]
    assert result["chapters"][-1]["endMs"] == 300_000
    assert all(result["receipt"][key] == 0 for key in (
        "rawVideoUploadCount", "rawAudioUploadCount", "frameByteUploadCount",
        "cookieUploadCount", "apiKeyDisclosureCount", "localPathUploadCount",
    ))


def test_v2_1_provider_and_composer_provenance_are_explicit():
    items = evidence()
    value = candidate(items)
    provider = validate_grounded_comprehension(
        value,
        items,
        task_id=TASK,
        task_revision=7,
        source_identity="portal:bilibili:BV1test:1:video",
        evidence_catalog_sha256=HASH,
        media_duration_ms=300_000,
        receipt={"providerId": "minimax", "modelId": "MiniMax-M3", "outboundDerivedTextSha256": "c" * 64, "requestCount": 1},
        schema_version="v3-media-grounded-comprehension/v2.1",
    )
    assert provider["brief"]["origin"] == "provider"
    assert provider["brief"]["sourceClaimIds"] == []

    value["brief"]["text"] = "太短"
    value["claims"] = [
        {"text": "开篇界定了需要讨论的核心问题。", "evidenceIds": [items[0]["evidenceId"]]},
        {"text": "中段给出了分析路径和关键依据。", "evidenceIds": [items[1]["evidenceId"]]},
        {"text": "结尾形成有条件的整体结论。", "evidenceIds": [items[2]["evidenceId"]]},
    ]
    composition = compose_brief_from_validated_claims(
        value, items, task_id=TASK, task_revision=7, media_duration_ms=300_000,
    )
    assert composition is not None
    composed = validate_grounded_comprehension(
        composition.candidate,
        items,
        task_id=TASK,
        task_revision=7,
        source_identity="portal:bilibili:BV1test:1:video",
        evidence_catalog_sha256=HASH,
        media_duration_ms=300_000,
        receipt={"providerId": "minimax", "modelId": "MiniMax-M3", "outboundDerivedTextSha256": "c" * 64, "requestCount": 2},
        schema_version="v3-media-grounded-comprehension/v2.1",
        brief_origin="deterministic_claim_composer",
        source_claim_indexes=composition.source_claim_indexes,
    )
    assert composed["brief"]["origin"] == "deterministic_claim_composer"
    assert len(composed["brief"]["sourceClaimIds"]) == 3
    assert composed["brief"]["text"] == "；".join(item["text"] for item in value["claims"])


def test_composer_rejects_missing_region_raw_excerpt_and_overlong_result():
    items = evidence()
    value = candidate(items)
    value["brief"]["text"] = "太短"

    value["claims"] = [
        {"text": "开篇界定了需要讨论的核心问题。", "evidenceIds": [items[0]["evidenceId"]]},
        {"text": "中段给出了分析路径和关键依据。", "evidenceIds": [items[1]["evidenceId"]]},
    ]
    assert compose_brief_from_validated_claims(
        value, items, task_id=TASK, task_revision=7, media_duration_ms=300_000,
    ) is None

    value["claims"] = [
        {"text": items[0]["text"], "evidenceIds": [items[0]["evidenceId"]]},
        {"text": "中段给出了分析路径和关键依据。", "evidenceIds": [items[1]["evidenceId"]]},
        {"text": "结尾形成有条件的整体结论。", "evidenceIds": [items[2]["evidenceId"]]},
    ]
    assert compose_brief_from_validated_claims(
        value, items, task_id=TASK, task_revision=7, media_duration_ms=300_000,
    ) is None

    value["claims"] = [
        {"text": "开篇" + "甲" * 45, "evidenceIds": [items[0]["evidenceId"]]},
        {"text": "中段" + "乙" * 45, "evidenceIds": [items[1]["evidenceId"]]},
        {"text": "结尾" + "丙" * 45, "evidenceIds": [items[2]["evidenceId"]]},
    ]
    assert compose_brief_from_validated_claims(
        value, items, task_id=TASK, task_revision=7, media_duration_ms=300_000,
    ) is None


def test_missing_ending_is_truthfully_limited():
    items = evidence(300_000)
    for item in items:
        if item["timestampStartMs"] == 200_000:
            item["timestampEndMs"] = 250_000
    result = validate(candidate(items), items, duration=300_000)
    assert result["quality"]["status"] == "limited"
    assert "V3510B_ENDING_EVIDENCE_MISSING" in result["quality"]["failureCodes"]


@pytest.mark.parametrize(
    ("mutate", "code"),
    [
        (lambda value: value["brief"].update(text="太短"), "V3510B_BRIEF_LENGTH_INVALID"),
        (lambda value: value["brief"].update(text="第1部分提供足够长的真实派生文字并说明不同阶段的核心内容。"), "V3510B_BRIEF_RAW_PREFIX"),
        (lambda value: value["claims"][1].update(text=value["claims"][0]["text"]), "V3510B_CLAIM_DUPLICATE"),
        (lambda value: value["claims"][0].update(evidenceIds=["mtr_" + "f" * 32]), "V3510B_CLAIM_EVIDENCE_UNCLOSED"),
        (lambda value: value["chapters"][1].update(evidenceIds=value["chapters"][0]["evidenceIds"]), "V3510B_CHAPTER_TIME_INVALID"),
    ],
)
def test_contract_failures_are_stable(mutate, code):
    items = evidence()
    value = candidate(items)
    mutate(value)
    with pytest.raises(MediaTaskStoreError) as caught:
        validate(value, items)
    assert caught.value.code == code


def test_unresolved_conflict_is_limited_not_complete():
    items = evidence()
    value = deepcopy(candidate(items))
    value["unresolvedEvidenceConflict"] = True
    result = validate(value, items)
    assert result["quality"]["status"] == "limited"
    assert result["quality"]["failureCodes"] == ["V3510B_EVIDENCE_CONFLICT_UNRESOLVED"]
