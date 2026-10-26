"""Stage B B-5-1 (DEV-2 Provider 集中授权边界) 专属测试。

不修改 product code;只调用现有公开 API 验证:
- AR-1 V2.1 receipt 补全 11 字段;
- AR-2 V2 receipt 仍只含原始 4 字段 (字节保留);
- AR-3 V3510B_PROVIDER_REFUSAL 在 service.py 接收门不被 repair / composer 吞掉;
- AR-4 V3510B_PROVIDER_AUTHORIZATION_DENIED 在 service.py 接收门不被 repair / composer 吞掉;
- §5 失败码映射中 refusal / authorization_denied 也不被吞 (含 401/403 路径翻译);
- provider_receipt_extras 在 V2 路径不被写入,只对 V2.1 路径生效。
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import httpx
import pytest

from navia_runtime.modules.media_companion.comprehension import MediaComprehensionService
from navia_runtime.modules.media_companion.comprehension.quality import validate_grounded_comprehension
from navia_runtime.modules.media_companion.comprehension.service import _NO_RETRY_FAILURES
from navia_runtime.modules.media_companion.comprehension.synthesis import (
    DeepSeekStrictGroundedSynthesisProvider,
    GroundedSynthesisReceipt,
    MiniMaxGroundedSynthesisProvider,
)
from navia_runtime.modules.media_companion.product_materializer import MediaProductMaterializer
from navia_runtime.modules.media_companion.task_store import MediaTaskStore, MediaTaskStoreError


TASK = "media_task_" + "5" * 32
SOURCE = "portal:bilibili:BV1test5xx:41828944992:1"
CATALOG_HASH = "b" * 64


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


def _evidence() -> list[dict[str, Any]]:
    values = []
    for index, start in enumerate((0, 100_000, 200_000)):
        values.append({
            "evidenceId": "mtr_" + f"{index + 1:032x}",
            "kind": "transcript",
            "timestampStartMs": start,
            "timestampEndMs": start + 100_000 if index < 2 else 300_000,
            "text": f"第{index + 1}部分提供足够长的真实派生文字并说明不同阶段的核心内容。",
        })
    return values


def _candidate(items: list[dict[str, Any]]) -> dict[str, Any]:
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


# ---------------------------------------------------------------------------
# AR-1 / AR-2 / provider_receipt_extras: V2.1 receipt 字段补全与 V2 字节保留
# ---------------------------------------------------------------------------


def test_ar1_v2_1_receipt_carries_seven_provider_lock_extras():
    items = _evidence()
    extras = {
        "endpointClass": "deepseek_strict_tool",
        "structureMode": "deepseek_beta_strict_tool_v1",
        "attemptId": "attempt-deadbeefcafef00d",
        "latencyMs": 1234,
        "requestSha256": "a" * 64,
        "responseSha256": "b" * 64,
        "finishReason": "refusal",
    }
    result = validate_grounded_comprehension(
        _candidate(items),
        items,
        task_id=TASK,
        task_revision=7,
        source_identity=SOURCE,
        evidence_catalog_sha256=CATALOG_HASH,
        media_duration_ms=300_000,
        schema_version="v3-media-grounded-comprehension/v2.1",
        receipt={
            "providerId": "minimax",
            "modelId": "MiniMax-M3",
            "outboundDerivedTextSha256": "c" * 64,
            "requestCount": 1,
        },
        provider_receipt_extras=extras,
    )

    receipt = result["receipt"]
    # 原始 4 字段 + 6 上传计数 + 7 V2.1 扩展 = 17 字段,但 AR-1 只断言 4 + 7 共 11 字段全在
    for key in (
        "providerId", "modelId", "outboundDerivedTextSha256", "requestCount",
    ):
        assert key in receipt
    for key in (
        "endpointClass", "structureMode", "attemptId", "latencyMs",
        "requestSha256", "responseSha256", "finishReason",
    ):
        assert key in receipt, f"V2.1 receipt missing extra field: {key}"
    assert receipt["endpointClass"] == "deepseek_strict_tool"
    assert receipt["structureMode"] == "deepseek_beta_strict_tool_v1"
    assert receipt["finishReason"] == "refusal"
    # 6 个上传计数仍为 0,确认 secret/raw 字节绝不被打开
    for key in (
        "rawVideoUploadCount", "rawAudioUploadCount", "frameByteUploadCount",
        "cookieUploadCount", "apiKeyDisclosureCount", "localPathUploadCount",
    ):
        assert receipt[key] == 0


def test_ar2_v2_receipt_preserves_four_field_byte_layout_and_drops_extras():
    items = _evidence()
    extras = {
        "endpointClass": "deepseek_strict_tool",
        "structureMode": "deepseek_beta_strict_tool_v1",
        "attemptId": "attempt-deadbeefcafef00d",
        "latencyMs": 1234,
        "requestSha256": "a" * 64,
        "responseSha256": "b" * 64,
        "finishReason": "refusal",
    }
    result = validate_grounded_comprehension(
        _candidate(items),
        items,
        task_id=TASK,
        task_revision=7,
        source_identity=SOURCE,
        evidence_catalog_sha256=CATALOG_HASH,
        media_duration_ms=300_000,
        # 默认 schema_version = v3-media-grounded-comprehension/v2
        receipt={
            "providerId": "minimax",
            "modelId": "MiniMax-M3",
            "outboundDerivedTextSha256": "c" * 64,
            "requestCount": 1,
        },
        provider_receipt_extras=extras,
    )

    receipt = result["receipt"]
    # V2 schema 不写入新增的 7 字段:任何额外键一律不存在
    for key in (
        "endpointClass", "structureMode", "attemptId", "latencyMs",
        "requestSha256", "responseSha256", "finishReason",
    ):
        assert key not in receipt, f"V2 receipt must not contain extras key: {key}"
    # V2 brief 也不写入 brief.origin / brief.sourceClaimIds
    assert "origin" not in result["brief"]
    assert "sourceClaimIds" not in result["brief"]
    # 4 字段值仍正确传递
    assert receipt["providerId"] == "minimax"
    assert receipt["modelId"] == "MiniMax-M3"
    assert receipt["outboundDerivedTextSha256"] == "c" * 64
    assert receipt["requestCount"] == 1


def test_provider_receipt_extras_writes_no_extras_when_extras_empty():
    items = _evidence()
    result = validate_grounded_comprehension(
        _candidate(items),
        items,
        task_id=TASK,
        task_revision=7,
        source_identity=SOURCE,
        evidence_catalog_sha256=CATALOG_HASH,
        media_duration_ms=300_000,
        schema_version="v3-media-grounded-comprehension/v2.1",
        receipt={
            "providerId": "minimax",
            "modelId": "MiniMax-M3",
            "outboundDerivedTextSha256": "c" * 64,
            "requestCount": 1,
        },
    )
    # 即便 V2.1 路径,空 extras 也不补任何新字段
    for key in (
        "endpointClass", "structureMode", "attemptId", "latencyMs",
        "requestSha256", "responseSha256", "finishReason",
    ):
        assert key not in result["receipt"], f"empty extras must not introduce: {key}"


def test_finish_reason_unknown_normalizes_to_malformed_in_v2_1():
    items = _evidence()
    result = validate_grounded_comprehension(
        _candidate(items),
        items,
        task_id=TASK,
        task_revision=7,
        source_identity=SOURCE,
        evidence_catalog_sha256=CATALOG_HASH,
        media_duration_ms=300_000,
        schema_version="v3-media-grounded-comprehension/v2.1",
        receipt={
            "providerId": "minimax",
            "modelId": "MiniMax-M3",
            "outboundDerivedTextSha256": "c" * 64,
            "requestCount": 1,
        },
        provider_receipt_extras={"finishReason": "totally-unknown-value"},
    )
    assert result["receipt"]["finishReason"] == "malformed"


# ---------------------------------------------------------------------------
# §5 失败码映射: refusal / authorization_denied 不进 repair / composer
# ---------------------------------------------------------------------------


def test_no_retry_failures_set_includes_refusal_and_authorization():
    assert "V3510B_PROVIDER_REFUSAL" in _NO_RETRY_FAILURES
    assert "V3510B_PROVIDER_AUTHORIZATION_DENIED" in _NO_RETRY_FAILURES


def _refusing_provider() -> type:
    """构建一个直接在 synthesize_v2 抛 V3510B_PROVIDER_REFUSAL 的 Provider。"""

    class RefusingProvider:
        def __init__(self):
            self.calls = {"synthesize_v2": 0, "repair_v2": 0}

        def synthesize_v2(self, *, title, evidence, style):
            self.calls["synthesize_v2"] += 1
            raise MediaTaskStoreError(
                "V3510B_PROVIDER_REFUSAL",
                "Provider refused to answer this request.",
                status=403,
            )

        def repair_v2(self, *, title, evidence, candidate, failure_code, style):
            self.calls["repair_v2"] += 1
            raise AssertionError("repair_v2 must not be called for refusal")

        def b5_provider_receipt_extras(self):
            return {
                "endpointClass": "minimax_chat_completions",
                "structureMode": "openai_chat_object",
                "attemptId": "attempt-stub",
                "latencyMs": 0,
                "requestSha256": "",
                "responseSha256": "",
                "finishReason": "refusal",
            }

    return RefusingProvider


def _authorizing_provider(code: str, status: int = 401) -> type:
    class AuthorizingProvider:
        def __init__(self):
            self.calls = {"synthesize_v2": 0, "repair_v2": 0}

        def synthesize_v2(self, *, title, evidence, style):
            self.calls["synthesize_v2"] += 1
            raise MediaTaskStoreError(code, "Authorization denied.", status=status)

        def repair_v2(self, *, title, evidence, candidate, failure_code, style):
            self.calls["repair_v2"] += 1
            raise AssertionError(f"repair_v2 must not be called for {code}")

        def b5_provider_receipt_extras(self):
            return {
                "endpointClass": "minimax_chat_completions",
                "structureMode": "openai_chat_object",
                "attemptId": "attempt-stub",
                "latencyMs": 0,
                "requestSha256": "",
                "responseSha256": "",
                "finishReason": "authorization_denied",
            }

    return AuthorizingProvider


def test_ar3_provider_refusal_does_not_enter_repair_or_composer(tmp_path: Path):
    store, private, task, _ = _build(tmp_path)
    Provider = _refusing_provider()
    provider = Provider()
    service = MediaComprehensionService(store, private, synthesis_provider_factory=lambda: provider)

    with pytest.raises(MediaTaskStoreError) as caught:
        service.synthesize(TASK, task["revision"], True, "structured")

    assert caught.value.code == "V3510B_PROVIDER_REFUSAL"
    assert caught.value.status == 403
    assert provider.calls == {"synthesize_v2": 1, "repair_v2": 0}
    # V2.1 产物未被发布
    assert not (private / "grounded-comprehension-v2.1" / TASK).exists()


def test_ar4_provider_authorization_denied_does_not_enter_repair_or_composer(tmp_path: Path):
    store, private, task, _ = _build(tmp_path)
    Provider = _authorizing_provider("V3510B_PROVIDER_AUTHORIZATION_DENIED", status=401)
    provider = Provider()
    service = MediaComprehensionService(store, private, synthesis_provider_factory=lambda: provider)

    with pytest.raises(MediaTaskStoreError) as caught:
        service.synthesize(TASK, task["revision"], True, "structured")

    assert caught.value.code == "V3510B_PROVIDER_AUTHORIZATION_DENIED"
    assert caught.value.status == 401
    assert provider.calls == {"synthesize_v2": 1, "repair_v2": 0}
    assert not (private / "grounded-comprehension-v2.1" / TASK).exists()


def test_ar4_401_unauthorized_translates_to_authorization_denied_without_repair(tmp_path: Path):
    """真实 MiniMaxGroundedSynthesisProvider 收到 401 时,service.py 必须翻译为
    V3510B_PROVIDER_AUTHORIZATION_DENIED 并跳过 repair / composer。
    """
    store, private, task, _ = _build(tmp_path)

    captured: dict[str, int] = {"calls": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["calls"] += 1
        return httpx.Response(401, json={"error": {"code": "invalid_api_key"}})

    transport = httpx.MockTransport(handler)
    provider = MiniMaxGroundedSynthesisProvider(
        {
            "id": "minimax",
            "model": "MiniMax-M3",
            "baseUrl": "https://api.minimax.test",
            "apiKey": "test-only-secret",
        },
        client_factory=lambda: httpx.Client(transport=transport, timeout=10.0),
    )

    service = MediaComprehensionService(store, private, synthesis_provider_factory=lambda: provider)

    with pytest.raises(MediaTaskStoreError) as caught:
        service.synthesize(TASK, task["revision"], True, "structured")

    assert caught.value.code == "V3510B_PROVIDER_AUTHORIZATION_DENIED"
    assert caught.value.status == 401
    # 网络仅被首次调用,任何 repair / composer 重试都未发起
    assert captured["calls"] == 1
    assert not (private / "grounded-comprehension-v2.1" / TASK).exists()


def test_ar4_403_forbidden_translates_to_authorization_denied_without_repair(tmp_path: Path):
    store, private, task, _ = _build(tmp_path)

    captured: dict[str, int] = {"calls": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["calls"] += 1
        return httpx.Response(403, json={"error": {"code": "region_mismatch"}})

    transport = httpx.MockTransport(handler)
    provider = MiniMaxGroundedSynthesisProvider(
        {
            "id": "minimax",
            "model": "MiniMax-M3",
            "baseUrl": "https://api.minimax.test",
            "apiKey": "test-only-secret",
        },
        client_factory=lambda: httpx.Client(transport=transport, timeout=10.0),
    )

    service = MediaComprehensionService(store, private, synthesis_provider_factory=lambda: provider)

    with pytest.raises(MediaTaskStoreError) as caught:
        service.synthesize(TASK, task["revision"], True, "structured")

    # synthesis.py 在 401/403 时硬编码 status=401 (沿用服务侧 401 翻译语义)
    assert caught.value.code == "V3510B_PROVIDER_AUTHORIZATION_DENIED"
    assert caught.value.status == 401
    assert captured["calls"] == 1
    assert not (private / "grounded-comprehension-v2.1" / TASK).exists()


def test_provider_b5_receipt_extras_records_endpoint_class_and_structure_mode():
    provider = MiniMaxGroundedSynthesisProvider(
        {"id": "minimax", "model": "MiniMax-M3", "baseUrl": "https://api.minimax.test", "apiKey": "x"}
    )
    extras = provider.b5_provider_receipt_extras()
    assert set(extras) == {
        "endpointClass", "structureMode", "attemptId", "latencyMs",
        "requestSha256", "responseSha256", "finishReason",
    }
    assert extras["endpointClass"] == "minimax_chat_completions"
    assert extras["structureMode"] == "openai_chat_object"
    assert extras["finishReason"] == "stop"


def test_deepseek_strict_provider_b5_receipt_extras_advertise_strict_contract():
    provider = DeepSeekStrictGroundedSynthesisProvider(
        {"id": "deepseek-strict-tool", "model": "deepseek-chat", "baseUrl": "https://api.deepseek.com", "apiKey": "x"}
    )
    extras = provider.b5_provider_receipt_extras()
    assert extras["endpointClass"] == "deepseek_strict_tool"
    assert extras["structureMode"] == "deepseek_beta_strict_tool_v1"


# ---------------------------------------------------------------------------
# 失败码语义保持: timeout / unavailable / response_invalid 仍走最后一次 retry (沿用)
# ---------------------------------------------------------------------------


def test_non_no_retry_failure_still_routes_through_repair_v2(tmp_path: Path):
    """非 _NO_RETRY_FAILURES 的 V3510B_* 错误 (例如 BRIEF_LENGTH_INVALID) 必须仍然
    进入 repair_v2 一次,确保 §5 中既有的 BRIEF_COMPOSER_FAILURES 路径未被误伤。
    """
    store, private, task, _ = _build(tmp_path)
    calls = {"synthesize_v2": 0, "repair_v2": 0}

    class Provider:
        def b5_provider_receipt_extras(self):
            return {
                "endpointClass": "minimax_chat_completions",
                "structureMode": "openai_chat_object",
                "attemptId": "attempt-x",
                "latencyMs": 0,
                "requestSha256": "0" * 64,
                "responseSha256": "0" * 64,
                "finishReason": "stop",
            }

        def synthesize_v2(self, *, title, evidence, style):
            calls["synthesize_v2"] += 1
            # 构造 BRIEF 太短,这会触发 service 走 repair_v2
            first = evidence[0]
            last = evidence[-1]
            return ({
                "brief": {"text": "太短", "evidenceIds": [first["evidenceId"], last["evidenceId"]]},
                "claims": [
                    {"text": "第一条有效核心表达。", "evidenceIds": [first["evidenceId"]]},
                    {"text": "第二条有效核心表达。", "evidenceIds": [last["evidenceId"]]},
                ],
                "chapters": [
                    {"title": "章节主题起始处", "thesis": "章节结论起始处。", "evidenceIds": [first["evidenceId"]], "relationToPrevious": "opening"},
                    {"title": "结尾结论章节", "thesis": "结尾归纳结论与限制。", "evidenceIds": [last["evidenceId"]], "relationToPrevious": "conclusion"},
                ],
                "unresolvedEvidenceConflict": False,
            }, GroundedSynthesisReceipt("minimax", "MiniMax-M3", "f" * 64, 1, {}))

        def repair_v2(self, *, title, evidence, candidate, failure_code, style):
            calls["repair_v2"] += 1
            assert failure_code == "V3510B_BRIEF_LENGTH_INVALID"
            return ({
                "brief": {"text": "视频完整说明问题背景、方法与适用边界，覆盖关键阶段。", "evidenceIds": [item["evidenceId"] for item in evidence]},
                "claims": [
                    {"text": "第一条核心表达有足够长度。", "evidenceIds": [evidence[0]["evidenceId"]]},
                    {"text": "第二条核心表达有足够长度。", "evidenceIds": [evidence[-1]["evidenceId"]]},
                ],
                "chapters": [
                    {"title": "问题背景与目标", "thesis": "开篇明确问题背景与目标。", "evidenceIds": [evidence[0]["evidenceId"]], "relationToPrevious": "opening"},
                    {"title": "结尾结论", "thesis": "结尾归纳结论与限制。", "evidenceIds": [evidence[-1]["evidenceId"]], "relationToPrevious": "conclusion"},
                ],
                "unresolvedEvidenceConflict": False,
            }, GroundedSynthesisReceipt("minimax", "MiniMax-M3", "f" * 64, 2, {}))

    service = MediaComprehensionService(store, private, synthesis_provider_factory=Provider)
    projection = service.synthesize(TASK, task["revision"], True, "structured")
    assert calls == {"synthesize_v2": 1, "repair_v2": 1}
    # 修复后的 V2.1 产物落盘且 brief 来源 = provider
    assert projection["grounded"]["brief"]["origin"] == "provider"
    assert (private / "grounded-comprehension-v2.1" / TASK).exists()
