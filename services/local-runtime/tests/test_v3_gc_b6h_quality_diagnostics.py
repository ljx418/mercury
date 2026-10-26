"""GC-B6H — the quality diagnostics of the offline correction.

The brief coverage and the unresolved conflict are recorded as STRUCTURAL
facts only: counts, region names, length buckets and stable reasons. They
never carry a text, an evidence id, a path, a Provider identity, a prompt, a
response, a secret or raw media, and they NEVER change the disposition of a
candidate.

No Chrome, no Runtime task, no Cookie, no Provider, no download, no real
BVID and no authorization is used.
"""

from __future__ import annotations

import json
from typing import Any

from navia_runtime.modules.media_companion.comprehension.diagnostics import (
    build_stage_b_diagnostic,
    quality_diagnostic,
)
from navia_runtime.modules.media_companion.comprehension.quality import (
    brief_coverage_diagnostic,
    conflict_diagnostic,
    validate_grounded_comprehension,
)
from navia_runtime.modules.media_companion.task_store import MediaTaskStoreError

SECRET = "绝不能进入诊断的派生原文"
EVIDENCE_ID = "mtr_0123456789abcdef0123456789abcdef"


def _evidence(count: int = 6) -> list[dict[str, Any]]:
    values = []
    for index in range(count):
        start = index * 10_000
        values.append({
            "evidenceId": f"mtr_{index + 1:032d}",
            "kind": "transcript",
            "timestampStartMs": start,
            "timestampEndMs": start + 9_000,
            "text": f"第 {index + 1} 段真实派生转写文本，说明视频的背景与方法。",
        })
    return values


def _candidate(evidence: list[dict[str, Any]], *, conflict: bool = False, brief_ids: list[str] | None = None) -> dict[str, Any]:
    ids = [item["evidenceId"] for item in evidence]
    brief = ids if brief_ids is None else brief_ids
    return {
        "brief": {
            "text": "视频讲述了背景、方法与结论，并覆盖了开头中段和结尾。",
            "evidenceIds": brief,
        },
        "claims": [
            {"text": "第一条可核验的核心表达，概括了视频的一个要点。", "evidenceIds": [ids[0]]},
            {"text": "第二条可核验的核心表达，说明了结论与适用边界。", "evidenceIds": [ids[-1]]},
        ],
        "chapters": [
            {"title": "问题背景与范围", "thesis": "开篇明确问题背景和后续分析范围。", "evidenceIds": [ids[0]], "relationToPrevious": "opening"},
            {"title": "分析路径与依据", "thesis": "中段使用具体依据推进核心分析。", "evidenceIds": [ids[2]], "relationToPrevious": "continuation"},
            {"title": "结论及适用边界", "thesis": "结尾汇总结论并说明适用条件。", "evidenceIds": [ids[-1]], "relationToPrevious": "conclusion"},
        ],
        "unresolvedEvidenceConflict": conflict,
    }


def _validate(candidate: dict[str, Any], evidence: list[dict[str, Any]]) -> str:
    """The UNCHANGED independent V2.1 validator. It returns the disposition."""
    try:
        derivative = validate_grounded_comprehension(
            candidate,
            evidence,
            task_id="media_task_" + "1" * 32,
            task_revision=1,
            source_identity="portal:bilibili:BV1TEST00001:1:p1",
            evidence_catalog_sha256="0" * 64,
            media_duration_ms=max(item["timestampEndMs"] for item in evidence),
            receipt={
                "providerId": "minimax-cn-openai-vision",
                "modelId": "MiniMax-M3",
                "outboundDerivedTextSha256": "1" * 64,
                "requestCount": 1,
            },
            schema_version="v3-media-grounded-comprehension/v2.1",
        )
    except MediaTaskStoreError as error:
        return f"refused:{error.code}"
    return str(derivative["quality"]["status"])


def test_b6h5_the_brief_coverage_diagnostic_carries_only_structural_facts() -> None:
    """B6H-5 — counts, region names, length buckets and a stable reason."""
    evidence = _evidence()
    candidate = _candidate(evidence, brief_ids=[evidence[0]["evidenceId"]])
    diagnostic = brief_coverage_diagnostic(
        candidate,
        evidence,
        task_id="media_task_" + "1" * 32,
        task_revision=1,
        media_duration_ms=60_000,
    )
    assert set(diagnostic) == {
        "eligibleClaimCount",
        "testedCombinationCounts",
        "coveredRegionCount",
        "requiredRegionCount",
        "substantiveRegions",
        "textLengthBuckets",
        "maxCoveredRegionCount",
        "fullRegionSubsetCount",
        "fullRegionSubsetCountAfterLengthFilter",
        "reason",
    }
    assert isinstance(diagnostic["eligibleClaimCount"], int)
    assert set(diagnostic["testedCombinationCounts"]) == {"2", "3"}
    assert diagnostic["reason"] in {
        "no_eligible_claims",
        "no_full_region_subset",
        "length_rule_rejected_all",
        "valid_claim_subset_exists",
        "candidate_not_preparable",
        "not_evaluated",
    }
    for region in diagnostic["substantiveRegions"]:
        assert region in {"opening", "middle", "ending"}
    for bucket in diagnostic["textLengthBuckets"]:
        assert bucket in {"under-20", "20-39", "40-80", "over-80"}


def test_b6h5_the_conflict_diagnostic_carries_only_the_boolean_and_the_bound() -> None:
    """B6H-5 — the boolean outcome, the bounded attempt count and a reason."""
    evidence = _evidence()
    candidate = _candidate(evidence, conflict=True)
    diagnostic = conflict_diagnostic(candidate, repair_attempt_count=3)
    assert set(diagnostic) == {
        "conflictDisclosed",
        "repairAttemptCount",
        "repairAttemptBound",
        "reason",
    }
    assert diagnostic["conflictDisclosed"] is True
    assert diagnostic["repairAttemptCount"] == 3
    assert diagnostic["repairAttemptBound"] == 8
    assert diagnostic["reason"] == "unresolved_conflict_disclosed"
    # The attempt count is BOUNDED.
    assert conflict_diagnostic(candidate, repair_attempt_count=99)["repairAttemptCount"] == 8


def test_b6h5_the_diagnostics_leak_no_text_no_id_no_path_no_provider_and_no_secret() -> None:
    """B6H-5 — the privacy of the quality facts."""
    evidence = _evidence()
    candidate = _candidate(evidence, conflict=True)
    candidate["brief"]["text"] = SECRET
    candidate["claims"][0]["text"] = SECRET
    candidate["chapters"][0]["title"] = SECRET
    candidate["chapters"][0]["thesis"] = SECRET
    diagnostic = quality_diagnostic(candidate, evidence, repair_attempt_count=2)
    serialized = json.dumps(diagnostic, ensure_ascii=False)
    for forbidden in (
        SECRET,
        "绝不能进入诊断",
        "sk-",
        EVIDENCE_ID,
        "mtr_",
        "minimax",
        "MiniMax",
        "http://",
        "https://",
    ):
        assert forbidden not in serialized, f"the diagnostic leaked {forbidden!r}"
    # The evidence ids never enter the diagnostic.
    for item in evidence:
        assert item["evidenceId"] not in serialized


def test_b6h5_the_quality_facts_never_change_the_disposition() -> None:
    """B6H-5 — the diagnostics are a record, never a repair."""
    evidence = _evidence()
    complete = _candidate(evidence)
    limited = _candidate(evidence, brief_ids=[evidence[0]["evidenceId"]])
    conflict = _candidate(evidence, conflict=True)
    assert _validate(complete, evidence) == "complete"
    assert _validate(limited, evidence) != "complete"
    assert _validate(conflict, evidence) != "complete"
    # The diagnostic is PURE: it never mutates the candidate.
    before = json.dumps(limited, ensure_ascii=False, sort_keys=True)
    quality_diagnostic(limited, evidence, repair_attempt_count=1)
    assert json.dumps(limited, ensure_ascii=False, sort_keys=True) == before
    # The conflict flag is never forced to false and the result is never
    # published as complete.
    assert conflict["unresolvedEvidenceConflict"] is True


def test_b6h5_the_stage_diagnostic_carries_the_quality_facts() -> None:
    """B6H-5 — the quality facts join the internal stage diagnostic."""
    evidence = _evidence()
    candidate = _candidate(evidence, conflict=True)
    diagnostic = build_stage_b_diagnostic(
        stage="validator_initial",
        failure_code="V3510B_EVIDENCE_CONFLICT_UNRESOLVED",
        candidate=candidate,
        evidence=evidence,
        repair_attempt_count=2,
        final_outcome="fail_closed",
        provider_outbound_http_attempts=3,
    )
    assert "quality" in diagnostic
    assert diagnostic["quality"]["unresolvedConflict"]["conflictDisclosed"] is True
    assert diagnostic["quality"]["unresolvedConflict"]["repairAttemptCount"] == 2
    serialized = json.dumps(diagnostic, ensure_ascii=False)
    assert "绝不能进入诊断" not in serialized
    assert "mtr_" not in serialized


def test_b6hr6_partial_brief_coverage_reports_the_maximum_coverage() -> None:
    """GC-B6H-R-6 — the PARTIAL coverage is reported, not only the zero.

    When no tested 2/3-claim subset covers EVERY required region, the
    diagnostic still says how many regions the best subset reached, so the
    account of WHY the coverage failed is structural and non-zero.
    """
    evidence = _evidence()
    # The brief cites ONE region and the two claims reach two: no subset
    # covers the three required regions, but the partial coverage is real.
    candidate = _candidate(evidence, brief_ids=[evidence[0]["evidenceId"]])
    diagnostic = brief_coverage_diagnostic(
        candidate,
        evidence,
        task_id="media_task_" + "1" * 32,
        task_revision=1,
        media_duration_ms=60_000,
    )
    assert diagnostic["requiredRegionCount"] == 3
    assert diagnostic["coveredRegionCount"] == 0
    assert diagnostic["maxCoveredRegionCount"] >= 1
    assert diagnostic["maxCoveredRegionCount"] <= diagnostic["requiredRegionCount"]
    assert diagnostic["fullRegionSubsetCount"] == 0
    assert diagnostic["fullRegionSubsetCountAfterLengthFilter"] == 0
    assert diagnostic["reason"] == "no_full_region_subset"
    # The facts are structural: no text, no id, no path.
    serialized = json.dumps(diagnostic, ensure_ascii=False)
    assert "mtr_" not in serialized
    assert "第" not in serialized
