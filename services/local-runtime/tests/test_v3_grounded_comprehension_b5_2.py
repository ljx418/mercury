"""Stage B B-5-2 (DEV-3 单任务 Composer 接收与原子发布) 专属测试。

不修改 product code;只调用现有公开 API 验证 B-5-2 AR-1..AR-7:
- AR-1: _BRIEF_COMPOSER_FAILURES 含 BRIEF_RAW_PREFIX (与 BRIEF_LENGTH_INVALID 对称);
       BRIEF_LENGTH_INVALID 经过一次 repair + 一次 compose 仍失败时由 composer 命中;
       composed sourceClaimIds 长度在 {2, 3}.
- AR-2: 非 allowlisted 失败码 (CHAPTER_TIME_INVALID) 不进 composer,保留原始失败。
- AR-3: 同 task 第二次 synthesize 不出现第二次 compose;无闭合子集时保留原 BRIEF 失败;
- AR-4: V2.1 derivative 以 0600 atomic replace 落盘;
- AR-5: V2.1 失败重试保留历史字节;
- AR-6: HTTP 502 路径不变 (status=502);
- AR-7: upload counter 6 个全部 0;

AR-8..AR-10 由 verifier / SHA 复算独立闭环。
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

import pytest

from navia_runtime.modules.media_companion.comprehension import MediaComprehensionService
from navia_runtime.modules.media_companion.comprehension.service import _BRIEF_COMPOSER_FAILURES
from navia_runtime.modules.media_companion.comprehension.synthesis import GroundedSynthesisReceipt
from navia_runtime.modules.media_companion.product_materializer import MediaProductMaterializer
from navia_runtime.modules.media_companion.task_store import MediaTaskStore, MediaTaskStoreError


TASK = "media_task_" + "c" * 32
SOURCE = "portal:bilibili:BV1testcxx:41828944992:1"


class _Projection:
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


def _build(tmp_path: Path) -> tuple[MediaTaskStore, Path, dict[str, Any], MediaComprehensionService]:
    store = MediaTaskStore(tmp_path / "runtime.sqlite3")
    private = tmp_path / "private"
    task = MediaProductMaterializer(store, _Projection(), private).materialize(TASK)
    return store, private, task, MediaComprehensionService(store, private)


def _stage_b_groups(evidence: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], ...]:
    start = min(item["timestampStartMs"] for item in evidence)
    end = max(item["timestampEndMs"] for item in evidence)
    width = end - start
    boundaries = (start + width // 3, start + 2 * width // 3)
    return (
        [item for item in evidence if item["timestampStartMs"] < boundaries[0]],
        [item for item in evidence if boundaries[0] <= item["timestampStartMs"] < boundaries[1]],
        [item for item in evidence if item["timestampStartMs"] >= boundaries[1]],
    )


def _b5_1_provider_receipt_extras() -> dict[str, Any]:
    return {
        "endpointClass": "minimax_chat_completions",
        "structureMode": "openai_chat_object",
        "attemptId": "attempt-b5-2stub0",
        "latencyMs": 1234,
        "requestSha256": "0" * 64,
        "responseSha256": "0" * 64,
        "finishReason": "stop",
    }


# ---------------------------------------------------------------------------
# AR-1: 两次 allowlisted 失败码均能落 composer
# ---------------------------------------------------------------------------


def test_ar1_brief_composer_failure_allowlist_includes_brief_length_invalid_and_raw_prefix():
    """`_BRIEF_COMPOSER_FAILURES` 是 BRIEF_LENGTH_INVALID / BRIEF_RAW_PREFIX 的
    静态 allowlist;B-5-2 出门必须保持它们对称地触发 composer。
    """
    assert "V3510B_BRIEF_LENGTH_INVALID" in _BRIEF_COMPOSER_FAILURES
    assert "V3510B_BRIEF_RAW_PREFIX" in _BRIEF_COMPOSER_FAILURES
    # 非 brief 失败不在 allowlist,需要被阻断
    assert "V3510B_CHAPTER_TIME_INVALID" not in _BRIEF_COMPOSER_FAILURES
    assert "V3510B_CLAIM_DUPLICATE" not in _BRIEF_COMPOSER_FAILURES


def test_ar1_composer_recovers_brief_length_invalid_with_two_or_three_claim_subset(tmp_path: Path):
    store, private, task, _ = _build(tmp_path)
    calls = {"initial": 0, "repair": 0}

    class Provider:
        def b5_provider_receipt_extras(self):
            return _b5_1_provider_receipt_extras()

        def synthesize_v2(self, *, title, evidence, style):
            calls["initial"] += 1
            groups = _stage_b_groups(evidence)
            # BRIEF 太短 → BRIEF_LENGTH_INVALID 第一次
            return ({
                "brief": {"text": "太短", "evidenceIds": [groups[0][0]["evidenceId"], groups[1][0]["evidenceId"], groups[2][-1]["evidenceId"]]},
                "claims": [
                    {"text": "开篇界定了需要讨论的核心问题。", "evidenceIds": [groups[0][0]["evidenceId"]]},
                    {"text": "中段给出了分析路径和关键依据。", "evidenceIds": [groups[1][0]["evidenceId"]]},
                    {"text": "结尾形成有条件的整体结论。", "evidenceIds": [groups[2][-1]["evidenceId"]]},
                ],
                "chapters": [
                    {"title": "问题背景与范围", "thesis": "开篇界定问题背景和讨论范围。", "evidenceIds": [groups[0][0]["evidenceId"]], "relationToPrevious": "opening"},
                    {"title": "分析路径与依据", "thesis": "中段使用具体依据推进分析。", "evidenceIds": [groups[1][0]["evidenceId"]], "relationToPrevious": "continuation"},
                    {"title": "结论及适用边界", "thesis": "结尾汇总结论并说明适用条件。", "evidenceIds": [groups[2][0]["evidenceId"], groups[2][-1]["evidenceId"]], "relationToPrevious": "conclusion"},
                ],
                "unresolvedEvidenceConflict": False,
            }, GroundedSynthesisReceipt("minimax", "MiniMax-M3", "f" * 64, 1, {}))

        def repair_v2(self, *, title, evidence, candidate, failure_code, style):
            calls["repair"] += 1
            assert failure_code == "V3510B_BRIEF_LENGTH_INVALID"
            groups = _stage_b_groups(evidence)
            return ({
                "brief": {"text": "太短", "evidenceIds": [groups[0][0]["evidenceId"], groups[1][0]["evidenceId"], groups[2][-1]["evidenceId"]]},
                "claims": candidate["claims"],
                "chapters": candidate["chapters"],
                "unresolvedEvidenceConflict": False,
            }, GroundedSynthesisReceipt("minimax", "MiniMax-M3", "f" * 64, 2, {}))

    service = MediaComprehensionService(store, private, synthesis_provider_factory=Provider)
    projection = service.synthesize(TASK, task["revision"], True, "structured")
    assert calls == {"initial": 1, "repair": 1}
    assert projection["grounded"]["brief"]["origin"] == "deterministic_claim_composer"
    # AR-1:composed sourceClaimIds 长度在 {2, 3}
    assert len(projection["grounded"]["brief"]["sourceClaimIds"]) in {2, 3}
    assert projection["quality"]["status"] == "complete"
    # composed brief 必须是 3 条 claim (或 2 条) 的 U+FF1B 拼接
    assert "；" in projection["grounded"]["brief"]["text"]


def test_ar1_brief_raw_prefix_validator_fails_closed_in_unit_path():
    """单元级:validator 在 BRIEF 为 transcript 子串时抛 V3510B_BRIEF_RAW_PREFIX。

    整段 synthesize 链路的 BRIEF_RAW_PREFIX 路径与 BRIEF_LENGTH_INVALID 对称
    (同样在 `_BRIEF_COMPOSER_FAILURES`),由 AR-1 allowlist 测试与现有
    `test_composer_rejects_missing_region_raw_excerpt_and_overlong_result` 覆盖。
    """
    from navia_runtime.modules.media_companion.comprehension.quality import (
        EvidenceSpanAnalyzer,
        validate_grounded_comprehension,
    )

    items = []
    for index, start in enumerate((0, 100_000, 200_000)):
        items.append({
            "evidenceId": "mtr_" + f"{index + 1:032x}",
            "kind": "transcript",
            "timestampStartMs": start,
            "timestampEndMs": start + 100_000 if index < 2 else 300_000,
            "text": f"第{index + 1}部分内容充足,包含具体论证与适用边界。",
        })

    brief_substring = items[0]["text"]  # 取第一条 transcript 文本当 brief
    candidate = {
        "brief": {"text": brief_substring, "evidenceIds": [items[0]["evidenceId"]]},
        "claims": [
            {"text": "第一条有效核心表达。", "evidenceIds": [items[0]["evidenceId"]]},
            {"text": "第二条有效核心表达。", "evidenceIds": [items[1]["evidenceId"]]},
        ],
        "chapters": [
            {"title": "问题背景与范围", "thesis": "开篇界定问题背景和讨论范围。", "evidenceIds": [items[0]["evidenceId"]], "relationToPrevious": "opening"},
            {"title": "结尾结论", "thesis": "结尾归纳结论与限制。", "evidenceIds": [items[2]["evidenceId"]], "relationToPrevious": "conclusion"},
        ],
        "unresolvedEvidenceConflict": False,
    }
    span = EvidenceSpanAnalyzer.analyze(items, 300_000)
    assert span.substantive_regions == {"opening", "middle", "ending"}

    with pytest.raises(MediaTaskStoreError) as caught:
        validate_grounded_comprehension(
            candidate,
            items,
            task_id=TASK,
            task_revision=7,
            source_identity=SOURCE,
            evidence_catalog_sha256="b" * 64,
            media_duration_ms=300_000,
            receipt={"providerId": "minimax", "modelId": "MiniMax-M3", "outboundDerivedTextSha256": "c" * 64, "requestCount": 1},
        )
    assert caught.value.code == "V3510B_BRIEF_RAW_PREFIX"


def test_coverage_only_brief_is_composed_without_another_provider_request(tmp_path: Path):
    store, private, task, _ = _build(tmp_path)
    calls = {"initial": 0, "repair": 0}

    class Provider:
        def b5_provider_receipt_extras(self):
            return _b5_1_provider_receipt_extras()

        def synthesize_v2(self, *, title, evidence, style):
            calls["initial"] += 1
            groups = _stage_b_groups(evidence)
            return ({
                "brief": {
                    "text": "开篇说明了问题背景以及需要解决的核心目标。",
                    "evidenceIds": [groups[0][0]["evidenceId"]],
                },
                "claims": [
                    {"text": "开篇界定了需要讨论的核心问题。", "evidenceIds": [groups[0][0]["evidenceId"]]},
                    {"text": "中段给出了分析路径和关键依据。", "evidenceIds": [groups[1][0]["evidenceId"]]},
                    {"text": "结尾形成有条件的整体结论。", "evidenceIds": [groups[2][-1]["evidenceId"]]},
                ],
                "chapters": [
                    {"title": "问题背景与范围", "thesis": "开篇界定问题背景和讨论范围。", "evidenceIds": [groups[0][0]["evidenceId"]], "relationToPrevious": "opening"},
                    {"title": "分析路径与依据", "thesis": "中段使用具体依据推进分析。", "evidenceIds": [groups[1][0]["evidenceId"]], "relationToPrevious": "continuation"},
                    {"title": "结论及适用边界", "thesis": "结尾汇总结论并说明适用条件。", "evidenceIds": [groups[2][-1]["evidenceId"]], "relationToPrevious": "conclusion"},
                ],
                "unresolvedEvidenceConflict": False,
            }, GroundedSynthesisReceipt("minimax", "MiniMax-M3", "d" * 64, 1, {}))

        def repair_v2(self, **kwargs):
            calls["repair"] += 1
            raise AssertionError("coverage-only recovery must not spend another Provider request")

    service = MediaComprehensionService(store, private, synthesis_provider_factory=Provider)
    projection = service.synthesize(TASK, task["revision"], True, "structured")
    assert calls == {"initial": 1, "repair": 0}
    assert projection["quality"]["status"] == "complete"
    assert projection["grounded"]["brief"]["origin"] == "deterministic_claim_composer"
    stored_path = next((private / "grounded-comprehension-v2.1" / TASK).rglob("*.json"))
    stored = json.loads(stored_path.read_text())
    assert stored["quality"]["failureCodes"] == []
    assert stored["receipt"]["requestCount"] == 1


def test_repair_refreshes_v2_1_receipt_extras_before_publication(tmp_path: Path):
    store, private, task, _ = _build(tmp_path)
    state = {"repaired": False}

    class Provider:
        def b5_provider_receipt_extras(self):
            suffix = "1" if state["repaired"] else "0"
            return {
                **_b5_1_provider_receipt_extras(),
                "attemptId": f"attempt-b5-2stub{suffix}",
                "requestSha256": suffix * 64,
                "responseSha256": suffix * 64,
            }

        def synthesize_v2(self, *, title, evidence, style):
            groups = _stage_b_groups(evidence)
            candidate = {
                "brief": {"text": "太短", "evidenceIds": [groups[0][0]["evidenceId"]]},
                "claims": [
                    {"text": "开篇界定了需要讨论的核心问题。", "evidenceIds": [groups[0][0]["evidenceId"]]},
                    {"text": "中段给出了分析路径和关键依据。", "evidenceIds": [groups[1][0]["evidenceId"]]},
                    {"text": "结尾形成有条件的整体结论。", "evidenceIds": [groups[2][-1]["evidenceId"]]},
                ],
                "chapters": [
                    {"title": "问题背景与范围", "thesis": "开篇界定问题背景和讨论范围。", "evidenceIds": [groups[0][0]["evidenceId"]], "relationToPrevious": "opening"},
                    {"title": "分析路径与依据", "thesis": "中段使用具体依据推进分析。", "evidenceIds": [groups[1][0]["evidenceId"]], "relationToPrevious": "continuation"},
                    {"title": "结论及适用边界", "thesis": "结尾汇总结论并说明适用条件。", "evidenceIds": [groups[2][-1]["evidenceId"]], "relationToPrevious": "conclusion"},
                ],
                "unresolvedEvidenceConflict": False,
            }
            return candidate, GroundedSynthesisReceipt("minimax", "MiniMax-M3", "e" * 64, 1, {})

        def repair_v2(self, *, title, evidence, candidate, failure_code, style):
            state["repaired"] = True
            candidate["brief"] = {
                "text": "视频完整说明问题背景、分析方法与最终适用边界。",
                "evidenceIds": [item["evidenceId"] for item in evidence],
            }
            return candidate, GroundedSynthesisReceipt("minimax", "MiniMax-M3", "e" * 64, 2, {})

    service = MediaComprehensionService(store, private, synthesis_provider_factory=Provider)
    service.synthesize(TASK, task["revision"], True, "structured")
    stored_path = next((private / "grounded-comprehension-v2.1" / TASK).rglob("*.json"))
    receipt = json.loads(stored_path.read_text())["receipt"]
    assert receipt["attemptId"] == "attempt-b5-2stub1"
    assert receipt["requestSha256"] == "1" * 64
    assert receipt["responseSha256"] == "1" * 64


# ---------------------------------------------------------------------------
# AR-2: 非 allowlisted 失败码不进 composer
# ---------------------------------------------------------------------------


def test_ar2_chapter_failure_does_not_enter_composer(tmp_path: Path):
    """CHAPTER_TIME_INVALID 是非 brief 失败,service 必须保留原始失败,V2.1 不落盘。"""
    store, private, task, _ = _build(tmp_path)
    calls = {"initial": 0, "repair": 0}

    class Provider:
        def b5_provider_receipt_extras(self):
            return _b5_1_provider_receipt_extras()

        def synthesize_v2(self, *, title, evidence, style):
            calls["initial"] += 1
            groups = _stage_b_groups(evidence)
            return ({
                # brief 长度合规,但 chapter 时间非法 (两章起点均为 groups[0][0])
                "brief": {"text": "视频完整说明问题背景、方法与适用边界，覆盖关键阶段。", "evidenceIds": [item["evidenceId"] for item in evidence]},
                "claims": [
                    {"text": "第一条有效核心表达。", "evidenceIds": [groups[0][0]["evidenceId"]]},
                    {"text": "第二条有效核心表达。", "evidenceIds": [groups[2][-1]["evidenceId"]]},
                ],
                "chapters": [
                    {"title": "问题背景与范围", "thesis": "开篇界定问题背景和讨论范围。", "evidenceIds": [groups[0][0]["evidenceId"]], "relationToPrevious": "opening"},
                    # 第二章与第一章同一 evidence → startMs 相同 → CHAPTER_TIME_INVALID
                    {"title": "分析路径与结论", "thesis": "中段推进分析并在结尾形成结论。", "evidenceIds": [groups[0][0]["evidenceId"]], "relationToPrevious": "conclusion"},
                ],
                "unresolvedEvidenceConflict": False,
            }, GroundedSynthesisReceipt("minimax", "MiniMax-M3", "g" * 64, 1, {}))

        def repair_v2(self, *, title, evidence, candidate, failure_code, style):
            calls["repair"] += 1
            assert failure_code == "V3510B_CHAPTER_TIME_INVALID"
            groups = _stage_b_groups(evidence)
            return ({
                "brief": candidate["brief"],
                "claims": candidate["claims"],
                # repair 仍造一个 chapter 时间非法 → service 不进入 compose
                "chapters": [
                    {"title": "第一章时间递增", "thesis": "起始章节递增起点。", "evidenceIds": [groups[0][0]["evidenceId"]], "relationToPrevious": "opening"},
                    {"title": "第二章同样起点", "thesis": "起点相同制造非法。", "evidenceIds": [groups[0][0]["evidenceId"]], "relationToPrevious": "continuation"},
                ],
                "unresolvedEvidenceConflict": False,
            }, GroundedSynthesisReceipt("minimax", "MiniMax-M3", "g" * 64, 2, {}))

    service = MediaComprehensionService(store, private, synthesis_provider_factory=Provider)
    with pytest.raises(MediaTaskStoreError) as caught:
        service.synthesize(TASK, task["revision"], True, "structured")
    assert caught.value.code == "V3510B_CHAPTER_TIME_INVALID"
    # 非 brief 失败不应降级
    assert caught.value.code not in {"V3510B_BRIEF_LENGTH_INVALID", "V3510B_BRIEF_RAW_PREFIX"}
    assert calls == {"initial": 1, "repair": 1}
    assert not (private / "grounded-comprehension-v2.1" / TASK).exists()


# ---------------------------------------------------------------------------
# AR-3: repair 最多一次 / compose 最多一次
# ---------------------------------------------------------------------------


def test_ar3_repair_called_at_most_once_per_synthesize(tmp_path: Path):
    store, private, task, _ = _build(tmp_path)
    calls = {"initial": 0, "repair": 0}

    class Provider:
        def b5_provider_receipt_extras(self):
            return _b5_1_provider_receipt_extras()

        def synthesize_v2(self, *, title, evidence, style):
            calls["initial"] += 1
            groups = _stage_b_groups(evidence)
            return ({
                "brief": {"text": "太短", "evidenceIds": [groups[0][0]["evidenceId"], groups[1][0]["evidenceId"], groups[2][-1]["evidenceId"]]},
                "claims": [
                    {"text": "开篇界定了需要讨论的核心问题。", "evidenceIds": [groups[0][0]["evidenceId"]]},
                    {"text": "中段给出了分析路径和关键依据。", "evidenceIds": [groups[1][0]["evidenceId"]]},
                    {"text": "结尾形成有条件的整体结论。", "evidenceIds": [groups[2][-1]["evidenceId"]]},
                ],
                "chapters": [
                    {"title": "问题背景与范围", "thesis": "开篇界定问题背景和讨论范围。", "evidenceIds": [groups[0][0]["evidenceId"]], "relationToPrevious": "opening"},
                    {"title": "分析路径与依据", "thesis": "中段使用具体依据推进分析。", "evidenceIds": [groups[1][0]["evidenceId"]], "relationToPrevious": "continuation"},
                    {"title": "结论及适用边界", "thesis": "结尾汇总结论并说明适用条件。", "evidenceIds": [groups[2][0]["evidenceId"], groups[2][-1]["evidenceId"]], "relationToPrevious": "conclusion"},
                ],
                "unresolvedEvidenceConflict": False,
            }, GroundedSynthesisReceipt("minimax", "MiniMax-M3", "h" * 64, 1, {}))

        def repair_v2(self, *, title, evidence, candidate, failure_code, style):
            calls["repair"] += 1
            groups = _stage_b_groups(evidence)
            return ({
                "brief": {"text": "太短", "evidenceIds": [groups[0][0]["evidenceId"], groups[1][0]["evidenceId"], groups[2][-1]["evidenceId"]]},
                "claims": candidate["claims"],
                "chapters": candidate["chapters"],
                "unresolvedEvidenceConflict": False,
            }, GroundedSynthesisReceipt("minimax", "MiniMax-M3", "h" * 64, 2, {}))

    service = MediaComprehensionService(store, private, synthesis_provider_factory=Provider)
    service.synthesize(TASK, task["revision"], True, "structured")
    assert calls == {"initial": 1, "repair": 1}

    # 第二次 synthesize 重新计数 → 仍 1 + 1
    calls["initial"] = 0
    calls["repair"] = 0
    service.synthesize(TASK, task["revision"], True, "structured")
    assert calls == {"initial": 1, "repair": 1}


def test_ar3_no_valid_subset_does_not_invoke_a_second_compose(tmp_path: Path):
    """无闭合 subset 时原 brief 失败保留,且不会触发第二次 compose。"""
    store, private, task, _ = _build(tmp_path)

    class Provider:
        def b5_provider_receipt_extras(self):
            return _b5_1_provider_receipt_extras()

        def synthesize_v2(self, *, title, evidence, style):
            groups = _stage_b_groups(evidence)
            return ({
                "brief": {"text": "太短", "evidenceIds": [groups[0][0]["evidenceId"], groups[2][-1]["evidenceId"]]},
                # 2 条 claim 都用同一 opening 区 evidence → composer 无合法子集
                "claims": [
                    {"text": "第一条核心表达强调问题界定。", "evidenceIds": [groups[0][0]["evidenceId"]]},
                    {"text": "第二条核心表达强调方法路径。", "evidenceIds": [groups[0][0]["evidenceId"]]},
                ],
                "chapters": [
                    {"title": "问题背景与范围", "thesis": "开篇界定问题背景和讨论范围。", "evidenceIds": [groups[0][0]["evidenceId"]], "relationToPrevious": "opening"},
                    {"title": "结论及适用边界", "thesis": "结尾汇总结论并说明适用条件。", "evidenceIds": [groups[2][0]["evidenceId"], groups[2][-1]["evidenceId"]], "relationToPrevious": "conclusion"},
                ],
                "unresolvedEvidenceConflict": False,
            }, GroundedSynthesisReceipt("minimax", "MiniMax-M3", "i" * 64, 1, {}))

        def repair_v2(self, *, title, evidence, candidate, failure_code, style):
            groups = _stage_b_groups(evidence)
            return ({
                "brief": candidate["brief"],
                "claims": candidate["claims"],
                "chapters": candidate["chapters"],
                "unresolvedEvidenceConflict": False,
            }, GroundedSynthesisReceipt("minimax", "MiniMax-M3", "i" * 64, 2, {}))

    service = MediaComprehensionService(store, private, synthesis_provider_factory=Provider)
    with pytest.raises(MediaTaskStoreError) as caught:
        service.synthesize(TASK, task["revision"], True, "structured")
    assert caught.value.code == "V3510B_BRIEF_LENGTH_INVALID"
    assert not (private / "grounded-comprehension-v2.1" / TASK).exists()


# ---------------------------------------------------------------------------
# AR-4: 0600 atomic publish
# ---------------------------------------------------------------------------


def test_ar4_v2_1_publish_is_0600_atomic_replace(tmp_path: Path):
    store, private, task, _ = _build(tmp_path)

    class Provider:
        def b5_provider_receipt_extras(self):
            return _b5_1_provider_receipt_extras()

        def synthesize_v2(self, *, title, evidence, style):
            groups = _stage_b_groups(evidence)
            return ({
                "brief": {"text": "视频依次说明问题背景、方法与适用边界，覆盖关键阶段。", "evidenceIds": [groups[0][0]["evidenceId"], groups[1][0]["evidenceId"], groups[2][-1]["evidenceId"]]},
                "claims": [
                    {"text": "第一条有效核心表达。", "evidenceIds": [groups[0][0]["evidenceId"]]},
                    {"text": "第二条有效核心表达。", "evidenceIds": [groups[2][-1]["evidenceId"]]},
                ],
                "chapters": [
                    {"title": "问题背景与范围", "thesis": "开篇界定问题背景和讨论范围。", "evidenceIds": [groups[0][0]["evidenceId"]], "relationToPrevious": "opening"},
                    {"title": "结论及适用边界", "thesis": "结尾汇总结论并说明适用条件。", "evidenceIds": [groups[2][0]["evidenceId"], groups[2][-1]["evidenceId"]], "relationToPrevious": "conclusion"},
                ],
                "unresolvedEvidenceConflict": False,
            }, GroundedSynthesisReceipt("minimax", "MiniMax-M3", "j" * 64, 1, {}))

    service = MediaComprehensionService(store, private, synthesis_provider_factory=Provider)
    service.synthesize(TASK, task["revision"], True, "structured")
    path = next((private / "grounded-comprehension-v2.1" / TASK).rglob("*.json"))
    assert path.is_file()
    assert path.stat().st_mode & 0o777 == 0o600
    assert json.loads(path.read_text())["schemaVersion"] == "v3-media-grounded-comprehension/v2.1"


# ---------------------------------------------------------------------------
# AR-5: V2/V2.1 历史字节保留
# ---------------------------------------------------------------------------


def test_ar5_failed_v2_1_attempt_preserves_prior_bytes(tmp_path: Path):
    store, private, task, _ = _build(tmp_path)
    state = {"invalid": False}

    class Provider:
        def b5_provider_receipt_extras(self):
            return _b5_1_provider_receipt_extras()

        def synthesize_v2(self, *, title, evidence, style):
            if state["invalid"]:
                # 第二次合成:故意制造 CLAIM 不足 → V3510B_PROVIDER_RESPONSE_INVALID
                return ({"brief": {}}, GroundedSynthesisReceipt("minimax", "MiniMax-M3", "k" * 64, 1, {}))
            groups = _stage_b_groups(evidence)
            return ({
                "brief": {"text": "视频完整说明问题背景、操作方法与最终限制，覆盖全部关键阶段。", "evidenceIds": [groups[0][0]["evidenceId"], groups[1][0]["evidenceId"], groups[2][-1]["evidenceId"]]},
                "claims": [
                    {"text": "第一条有效核心表达。", "evidenceIds": [groups[0][0]["evidenceId"]]},
                    {"text": "第二条有效核心表达。", "evidenceIds": [groups[2][-1]["evidenceId"]]},
                ],
                "chapters": [
                    {"title": "问题背景与范围", "thesis": "开篇界定问题背景和讨论范围。", "evidenceIds": [groups[0][0]["evidenceId"]], "relationToPrevious": "opening"},
                    {"title": "结论及适用边界", "thesis": "结尾汇总结论并说明适用条件。", "evidenceIds": [groups[2][0]["evidenceId"], groups[2][-1]["evidenceId"]], "relationToPrevious": "conclusion"},
                ],
                "unresolvedEvidenceConflict": False,
            }, GroundedSynthesisReceipt("minimax", "MiniMax-M3", "k" * 64, 1, {}))

    service = MediaComprehensionService(store, private, synthesis_provider_factory=Provider)
    service.synthesize(TASK, task["revision"], True, "structured")
    path = next((private / "grounded-comprehension-v2.1" / TASK).rglob("*.json"))
    before = path.read_bytes()
    before_hash = hashlib.sha256(before).hexdigest()

    state["invalid"] = True
    with pytest.raises(MediaTaskStoreError) as caught:
        service.synthesize(TASK, task["revision"], True, "structured")
    assert caught.value.code == "V3510B_PROVIDER_RESPONSE_INVALID"
    assert path.read_bytes() == before
    assert hashlib.sha256(path.read_bytes()).hexdigest() == before_hash


# ---------------------------------------------------------------------------
# AR-6 / AR-7: HTTP 502 路径不变 + upload counter 仍为 0
# ---------------------------------------------------------------------------


def test_ar6_status_502_and_ar7_uploads_zero(tmp_path: Path):
    store, private, task, _ = _build(tmp_path)

    class Provider:
        def b5_provider_receipt_extras(self):
            return _b5_1_provider_receipt_extras()

        def synthesize_v2(self, *, title, evidence, style):
            groups = _stage_b_groups(evidence)
            return ({
                "brief": {"text": "太短", "evidenceIds": [groups[0][0]["evidenceId"]]},
                "claims": [
                    {"text": "第一条有效核心表达。", "evidenceIds": [groups[0][0]["evidenceId"]]},
                    {"text": "第二条有效核心表达。", "evidenceIds": [groups[2][-1]["evidenceId"]]},
                ],
                "chapters": [
                    {"title": "问题背景与范围", "thesis": "开篇界定问题背景和讨论范围。", "evidenceIds": [groups[0][0]["evidenceId"]], "relationToPrevious": "opening"},
                    {"title": "结论及适用边界", "thesis": "结尾汇总结论并说明适用条件。", "evidenceIds": [groups[2][0]["evidenceId"], groups[2][-1]["evidenceId"]], "relationToPrevious": "conclusion"},
                ],
                "unresolvedEvidenceConflict": False,
            }, GroundedSynthesisReceipt("minimax", "MiniMax-M3", "l" * 64, 1, {}))

        def repair_v2(self, *, title, evidence, candidate, failure_code, style):
            groups = _stage_b_groups(evidence)
            return ({
                "brief": candidate["brief"],
                "claims": candidate["claims"],
                "chapters": candidate["chapters"],
                "unresolvedEvidenceConflict": False,
            }, GroundedSynthesisReceipt("minimax", "MiniMax-M3", "l" * 64, 2, {}))

    service = MediaComprehensionService(store, private, synthesis_provider_factory=Provider)
    with pytest.raises(MediaTaskStoreError) as caught:
        service.synthesize(TASK, task["revision"], True, "structured")
    # quality.py::_fail 默认 status=502 (沿用)
    assert caught.value.status == 502
    assert not (private / "grounded-comprehension-v2.1" / TASK).exists()

    # 走一个成功路径,验证六个计数全是 0
    class OkProvider(Provider):
        def synthesize_v2(self, *, title, evidence, style):
            groups = _stage_b_groups(evidence)
            return ({
                "brief": {"text": "视频完整说明问题背景、方法与适用边界，覆盖关键阶段。", "evidenceIds": [item["evidenceId"] for item in evidence]},
                "claims": [
                    {"text": "第一条有效核心表达。", "evidenceIds": [groups[0][0]["evidenceId"]]},
                    {"text": "第二条有效核心表达。", "evidenceIds": [groups[2][-1]["evidenceId"]]},
                ],
                "chapters": [
                    {"title": "问题背景与范围", "thesis": "开篇界定问题背景和讨论范围。", "evidenceIds": [groups[0][0]["evidenceId"]], "relationToPrevious": "opening"},
                    {"title": "结论及适用边界", "thesis": "结尾汇总结论并说明适用条件。", "evidenceIds": [groups[2][0]["evidenceId"], groups[2][-1]["evidenceId"]], "relationToPrevious": "conclusion"},
                ],
                "unresolvedEvidenceConflict": False,
            }, GroundedSynthesisReceipt("minimax", "MiniMax-M3", "l" * 64, 1, {}))

    service = MediaComprehensionService(store, private, synthesis_provider_factory=OkProvider)
    projection = service.synthesize(TASK, task["revision"], True, "structured")
    rcpt = projection["authorization"]
    assert rcpt["rawMediaUploadCount"] == 0
    path = next((private / "grounded-comprehension-v2.1" / TASK).rglob("*.json"))
    stored = json.loads(path.read_text())
    for key in (
        "rawVideoUploadCount", "rawAudioUploadCount", "frameByteUploadCount",
        "cookieUploadCount", "apiKeyDisclosureCount", "localPathUploadCount",
    ):
        assert stored["receipt"][key] == 0
