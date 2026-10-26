from __future__ import annotations

import json
from pathlib import Path

import httpx
from fastapi.testclient import TestClient

from navia_runtime.modules.media_companion.comprehension import MediaComprehensionService
from navia_runtime.modules.media_companion.comprehension.synthesis import DeepSeekStrictGroundedSynthesisProvider, GroundedSynthesisReceipt, MiniMaxGroundedSynthesisProvider, _parse_json_object, synthesis_style, validate_synthesis
from navia_runtime.modules.media_companion.product_materializer import MediaProductMaterializer
from navia_runtime.modules.media_companion.product_services import MediaAskService
from navia_runtime.modules.media_companion.task_store import MediaTaskStore, MediaTaskStoreError


TASK = "media_task_" + "5" * 32
SOURCE = "portal:bilibili:BV1ZpYd66ELP:41828944992:1"


class Projection:
    def get(self, task_id: str):
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


def build(tmp_path: Path):
    store = MediaTaskStore(tmp_path / "runtime.sqlite3")
    private = tmp_path / "private"
    task = MediaProductMaterializer(store, Projection(), private).materialize(TASK)
    return store, private, task, MediaComprehensionService(store, private)


def stage_b_groups(evidence):
    start = min(item["timestampStartMs"] for item in evidence)
    end = max(item["timestampEndMs"] for item in evidence)
    width = end - start
    boundaries = (start + width // 3, start + 2 * width // 3)
    return (
        [item for item in evidence if item["timestampStartMs"] < boundaries[0]],
        [item for item in evidence if boundaries[0] <= item["timestampStartMs"] < boundaries[1]],
        [item for item in evidence if item["timestampStartMs"] >= boundaries[1]],
    )


def test_comprehension_builds_one_closed_semantic_projection_without_cloud(tmp_path: Path):
    _, _, task, service = build(tmp_path)
    projection = service.get(TASK, task["revision"])

    assert projection["schemaVersion"] == "v3-media-workspace-comprehension-projection/v1"
    assert projection["task"]["taskRevision"] == task["revision"]
    assert projection["authorization"] == {
        "groundedTextCloudStatus": "disabled",
        "providerId": None,
        "modelId": None,
        "outboundDerivedTextSha256": None,
        "rawMediaUploadCount": 0,
    }
    chapters = projection["outline"]["chapters"]
    assert 3 <= len(chapters) <= 12
    assert [chapter["order"] for chapter in chapters] == list(range(len(chapters)))
    assert all(chapter["keyPoints"] and chapter["evidenceIds"] for chapter in chapters)
    assert all(left["endMs"] <= right["startMs"] for left, right in zip(chapters, chapters[1:]))
    assert projection["timeline"]["outlineId"] == projection["outline"]["outlineId"]
    assert len(projection["timeline"]["moments"]) >= 8
    for chapter in chapters:
        chapter_moments = [
            moment for moment in projection["timeline"]["moments"]
            if moment["chapterId"] == chapter["chapterId"]
        ]
        key_point_times = [moment["timestampMs"] for moment in chapter_moments if moment["kind"] == "key_point"]
        assert len(key_point_times) == len(set(key_point_times))
        assert all(chapter["startMs"] < value < chapter["endMs"] for value in key_point_times)
    assert projection["mindmap"]["outlineId"] == projection["outline"]["outlineId"]
    assert max(node["depth"] for node in projection["mindmap"]["nodes"]) >= 2


def test_comprehension_rejects_stale_revision_and_missing_thumbnail(tmp_path: Path):
    _, _, task, service = build(tmp_path)
    try:
        service.get(TASK, task["revision"] - 1)
        raise AssertionError("stale revision should fail")
    except MediaTaskStoreError as error:
        assert error.code == "TASK_REVISION_CONFLICT"
    try:
        service.thumbnail(TASK, task["projections"]["evidenceCatalog"][0]["evidenceId"])
        raise AssertionError("transcript thumbnail should fail")
    except MediaTaskStoreError as error:
        assert error.code == "V351_THUMBNAIL_NOT_FOUND"


def test_comprehension_api_requires_companion_session(tmp_path: Path, monkeypatch):
    import navia_runtime.app as runtime_app

    store, private, task, service = build(tmp_path)
    extension_id = "a" * 32
    origin = f"chrome-extension://{extension_id}"
    monkeypatch.setenv("NAVIA_LOCAL_FILES_EXTENSION_ID", extension_id)
    runtime_app.companion_session_broker.clear()
    monkeypatch.setattr(runtime_app, "media_outline_task_store", store)
    monkeypatch.setattr(runtime_app, "media_comprehension_service", service)
    client = TestClient(runtime_app.app)

    denied = client.get(f"/v1/media/tasks/{TASK}/comprehension", params={"revision": task["revision"]})
    assert denied.status_code == 401
    session = client.post("/v1/companion/sessions", headers={"Origin": origin}).json()["data"]
    response = client.get(
        f"/v1/media/tasks/{TASK}/comprehension",
        params={"revision": task["revision"]},
        headers={"Authorization": f"Bearer {session['token']}"},
    )
    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    assert response.json()["data"]["projection"]["task"]["taskId"] == TASK


def test_synthesis_api_requires_session_consent_and_provider(tmp_path: Path, monkeypatch):
    import navia_runtime.app as runtime_app

    store, _, task, service = build(tmp_path)
    extension_id = "b" * 32
    origin = f"chrome-extension://{extension_id}"
    monkeypatch.setenv("NAVIA_LOCAL_FILES_EXTENSION_ID", extension_id)
    runtime_app.companion_session_broker.clear()
    monkeypatch.setattr(runtime_app, "media_outline_task_store", store)
    monkeypatch.setattr(runtime_app, "media_comprehension_service", service)
    client = TestClient(runtime_app.app)
    endpoint = f"/v1/media/tasks/{TASK}/comprehension/synthesize"

    denied = client.post(endpoint, json={"expectedRevision": task["revision"], "consent": True, "style": "structured"})
    assert denied.status_code == 401

    session = client.post("/v1/companion/sessions", headers={"Origin": origin}).json()["data"]
    headers = {"Authorization": f"Bearer {session['token']}"}
    no_consent = client.post(endpoint, headers=headers, json={"expectedRevision": task["revision"], "consent": False, "style": "structured"})
    assert no_consent.status_code == 403
    assert no_consent.json()["error"]["code"] == "V3510B_CONSENT_REQUIRED"

    no_provider = client.post(endpoint, headers=headers, json={"expectedRevision": task["revision"], "consent": True, "style": "structured"})
    assert no_provider.status_code == 409
    assert no_provider.json()["error"]["code"] == "V352_SYNTHESIS_PROVIDER_MISSING"


def test_grounded_synthesis_replaces_preview_without_uploading_raw_media(tmp_path: Path):
    store, private, task, _ = build(tmp_path)
    observed = {}

    class Provider:
        def synthesize(self, *, title, evidence, style):
            observed["title"] = title
            observed["evidence"] = evidence
            observed["style"] = style
            midpoint = len(evidence) // 2
            groups = (evidence[:midpoint], evidence[midpoint:])
            result = {
                "summary": "视频先建立问题背景，再演示解决方法并总结适用边界。",
                "chapters": [
                    {
                        "title": "问题背景与目标",
                        "thesis": "开篇界定需要解决的问题及目标。",
                        "keyPoints": ["说明问题背景", "明确处理目标"],
                        "evidenceIds": [item["evidenceId"] for item in groups[0]],
                        "evidenceNote": "字幕与画面描述一致。",
                        "relationToPrevious": "opening",
                        "startMs": groups[0][0]["timestampStartMs"],
                        "endMs": groups[0][-1]["timestampEndMs"],
                    },
                    {
                        "title": "方法步骤与结论",
                        "thesis": "后半段依次演示方法并归纳结果与限制。",
                        "keyPoints": ["演示关键步骤", "归纳结果限制"],
                        "evidenceIds": [item["evidenceId"] for item in groups[1]],
                        "evidenceNote": "",
                        "relationToPrevious": "conclusion",
                        "startMs": groups[1][0]["timestampStartMs"],
                        "endMs": groups[1][-1]["timestampEndMs"],
                    },
                ],
            }
            return result, GroundedSynthesisReceipt("minimax-cn-openai-vision", "MiniMax-M3", "9" * 64, 2, {"inputTokens": 100, "outputTokens": 50})

    service = MediaComprehensionService(store, private, synthesis_provider_factory=Provider)
    projection = service.synthesize(TASK, task["revision"], True, "detailed")

    assert projection["schemaVersion"] == "v3-media-workspace-comprehension-projection/v2"
    assert projection["quality"]["mode"] == "grounded_model"
    assert projection["quality"]["style"] == "detailed"
    assert projection["quality"]["styleRisk"]["riskCode"] == "over_inclusion"
    assert projection["authorization"]["groundedTextCloudStatus"] == "granted"
    assert projection["authorization"]["rawMediaUploadCount"] == 0
    assert projection["outline"]["summary"].startswith("视频先建立")
    assert observed["evidence"]
    assert observed["style"] == "detailed"
    assert all(set(item) == {"evidenceId", "kind", "timestampStartMs", "timestampEndMs", "text"} for item in observed["evidence"])
    assert not any("path" in key.lower() or "cookie" in key.lower() for item in observed["evidence"] for key in item)
    assert service.get(TASK, task["revision"])["outline"]["contentSha256"] == projection["outline"]["contentSha256"]
    class AskProvider:
        def answer(self, *, question, category, chapters, evidence):
            assert question == "视频首先说明了什么？"
            assert category == "factual"
            assert chapters and evidence
            return {"status": "answered", "answerBlocks": [{"text": "模型根据完整章节回答了开篇问题。", "evidenceIds": [evidence[0]["evidenceId"]], "timestampMs": evidence[0]["timestampStartMs"]}]}

    ask_service = MediaAskService(store, private, comprehension=service)
    ask_service.set_grounded_provider_factory(AskProvider)
    answer = ask_service.ask(TASK, task["revision"], "视频首先说明了什么？")
    assert answer["status"] == "answered"
    assert answer["executionMode"] == "grounded_model"
    assert "完整章节" in answer["answer"]

    class EndingProvider:
        def answer(self, *, question, category, chapters, evidence):
            assert question == "概括开头：视频最后得到什么结论？"
            assert [chapter["title"] for chapter in chapters] == ["方法步骤与结论"]
            return {
                "status": "answered",
                "answerBlocks": [{
                    "text": "模型依据最后一章回答了最终结论。",
                    "evidenceIds": [evidence[0]["evidenceId"]],
                    "timestampMs": evidence[0]["timestampStartMs"],
                }],
            }

    ask_service.set_grounded_provider_factory(EndingProvider)
    ending = ask_service.ask(TASK, task["revision"], "概括开头：视频最后得到什么结论？")
    assert ending["executionMode"] == "grounded_model"
    assert "最后一章" in ending["answer"]


def test_synthesis_validation_rejects_unknown_evidence_and_overlap():
    evidence = [
        {"evidenceId": "mtr_" + "1" * 32, "timestampStartMs": 0, "timestampEndMs": 1000},
        {"evidenceId": "mtr_" + "2" * 32, "timestampStartMs": 1000, "timestampEndMs": 2000},
    ]
    base = {
        "summary": "这是一个长度足够且覆盖完整视频内容的结构化总结。",
        "chapters": [
            {"title": "第一部分主题", "thesis": "第一部分提供明确的主要结论。", "keyPoints": ["关键事实一", "关键事实二"], "evidenceIds": [evidence[0]["evidenceId"]], "evidenceNote": "", "relationToPrevious": "opening"},
            {"title": "第二部分主题", "thesis": "第二部分继续给出方法与最终结论。", "keyPoints": ["关键步骤一", "关键步骤二"], "evidenceIds": [evidence[1]["evidenceId"]], "evidenceNote": "", "relationToPrevious": "conclusion"},
        ],
    }
    assert len(validate_synthesis(base, evidence)["chapters"]) == 2
    invalid = {**base, "chapters": [dict(base["chapters"][0]), dict(base["chapters"][1])]}
    invalid["chapters"][1]["evidenceIds"] = ["mtr_" + "f" * 32]
    try:
        validate_synthesis(invalid, evidence)
        raise AssertionError("unknown evidence must fail")
    except MediaTaskStoreError as error:
        assert error.code == "V352_SYNTHESIS_EVIDENCE_UNCLOSED"


def test_json_parser_selects_last_contract_object_from_extra_text():
    value = (
        '分析草稿 {"note":"not the final contract"}\n'
        '最终结果：{"status":"insufficient_evidence","answerBlocks":[]}\n结束'
    )
    assert _parse_json_object(value) == {"status": "insufficient_evidence", "answerBlocks": []}


def test_synthesis_styles_are_closed_and_explain_risk():
    assert synthesis_style("structured")["riskLevel"] == "low"
    assert synthesis_style("concise")["riskCode"] == "coverage_omission"
    try:
        synthesis_style("xiaohongshu")
        raise AssertionError("unfrozen style must fail")
    except MediaTaskStoreError as error:
        assert error.code == "V352_SYNTHESIS_STYLE_INVALID"


def test_cross_chapter_question_intents_use_full_outline_path():
    assert MediaAskService._category("各章节怎样共同支撑结论？") == "cross_chapter"
    assert MediaAskService._category("视频如何从选址疑问逐步推进到运营结论？") == "cross_chapter"
    assert MediaAskService._category("两部分各自采用怎样的分析结构？") == "cross_chapter"


def test_synthesis_validation_deterministically_trims_excess_points():
    evidence = [
        {"evidenceId": "mtr_" + "3" * 32, "timestampStartMs": 0, "timestampEndMs": 1000},
        {"evidenceId": "mtr_" + "4" * 32, "timestampStartMs": 1000, "timestampEndMs": 2000},
    ]
    value = {
        "summary": "这是一个覆盖完整视频并满足最小长度要求的结构化总结。",
        "chapters": [
            {"title": "第一部分主题", "thesis": "第一部分提供明确且可核验的主要结论。", "keyPoints": [f"关键事实{i}" for i in range(8)], "evidenceIds": [evidence[0]["evidenceId"]], "evidenceNote": "", "relationToPrevious": "opening"},
            {"title": "第二部分主题", "thesis": "第二部分继续给出方法和最终结论。", "keyPoints": ["关键步骤一", "关键步骤二"], "evidenceIds": [evidence[1]["evidenceId"]], "evidenceNote": "", "relationToPrevious": "conclusion"},
        ],
    }
    assert len(validate_synthesis(value, evidence)["chapters"][0]["keyPoints"]) == 5


def test_synthesis_navigation_intervals_allow_grounded_cross_chapter_reference():
    first = "mtr_" + "5" * 32
    second = "mtr_" + "6" * 32
    third = "mtr_" + "7" * 32
    evidence = [
        {"evidenceId": first, "timestampStartMs": 0, "timestampEndMs": 1000},
        {"evidenceId": second, "timestampStartMs": 1000, "timestampEndMs": 2000},
        {"evidenceId": third, "timestampStartMs": 2000, "timestampEndMs": 3000},
    ]
    value = {
        "summary": "这是一个覆盖完整视频并满足最小长度要求的结构化总结。",
        "chapters": [
            {"title": "第一部分主题", "thesis": "第一部分提供明确且可核验的主要结论。", "keyPoints": ["关键事实一", "关键事实二"], "evidenceIds": [first, second], "evidenceNote": "", "relationToPrevious": "opening"},
            {"title": "第二部分主题", "thesis": "第二部分引用前文并给出新的最终结论。", "keyPoints": ["关键步骤一", "关键步骤二"], "evidenceIds": [second, third], "evidenceNote": "", "relationToPrevious": "conclusion"},
        ],
    }
    result = validate_synthesis(value, evidence)
    assert [(item["startMs"], item["endMs"]) for item in result["chapters"]] == [(0, 2000), (2000, 3000)]


def test_chapter_compression_preserves_deterministic_group_evidence():
    provider = MiniMaxGroundedSynthesisProvider({"id": "test", "model": "test", "baseUrl": "https://invalid", "apiKey": "not-used"})
    provider._complete = lambda prompt: (_ for _ in ()).throw(AssertionError("compression must not call the model"))
    source = {
        "summary": "原始总结",
        "chapters": [{
            "title": f"原始章节 {index}", "thesis": f"原始章节 {index} 的结论。",
            "keyPoints": [f"原始事实 {index}", "共同限制条件"],
            "evidenceIds": [f"mtr_{index:032d}"], "evidenceNote": "", "relationToPrevious": "continuation",
        } for index in range(17)],
    }
    result = provider._compress_chapters("标题", source, synthesis_style("structured"))
    assert len(result["chapters"]) == 10
    assert result["chapters"][0]["evidenceIds"] == ["mtr_00000000000000000000000000000000"]
    assert result["chapters"][-1]["evidenceIds"] == ["mtr_00000000000000000000000000000015", "mtr_00000000000000000000000000000016"]


def test_provider_retries_invalid_structured_response(monkeypatch):
    provider = MiniMaxGroundedSynthesisProvider({"id": "test", "model": "test", "baseUrl": "https://invalid", "apiKey": "not-used"})
    outcomes = iter([
        MediaTaskStoreError("V352_SYNTHESIS_RESPONSE_INVALID", "invalid", status=502),
        {"summary": "valid", "chapters": []},
    ])
    attempts = []

    def complete_once(payload, *, system_prompt, temperature):
        attempts.append((payload, system_prompt, temperature))
        outcome = next(outcomes)
        if isinstance(outcome, Exception):
            raise outcome
        return outcome

    provider._complete_once = complete_once
    monkeypatch.setattr("navia_runtime.modules.media_companion.comprehension.synthesis.time.sleep", lambda _: None)
    assert provider._complete({"task": "test"})["summary"] == "valid"
    assert len(attempts) == 2
    assert all("视频结构化理解器" in system_prompt for _, system_prompt, _ in attempts)
    assert all(temperature == 0.1 for _, _, temperature in attempts)


def _strict_provider(handler):
    transport = httpx.MockTransport(handler)
    return DeepSeekStrictGroundedSynthesisProvider(
        {
            "id": "deepseek-strict-tool",
            "model": "deepseek-chat",
            "baseUrl": "https://api.deepseek.com",
            "apiKey": "test-only-secret",
        },
        client_factory=lambda: httpx.Client(transport=transport),
    )


def _strict_chunk_payload():
    return {
        "task": "extract_grounded_chapter_candidates",
        "evidence": [{
            "evidenceId": "mtr_" + "1" * 32,
            "kind": "transcript",
            "timestampStartMs": 0,
            "timestampEndMs": 1000,
            "text": "真实证据内容。",
        }],
    }


def _strict_chunk_value():
    return {
        "summary": "这是满足严格结构要求的本块内容概括。",
        "sections": [{
            "title": "问题背景部分",
            "thesis": "这一部分解释问题背景和目标。",
            "keyPoints": ["说明当前问题", "界定处理目标"],
            "evidenceIds": ["mtr_" + "1" * 32],
            "evidenceNote": "",
        }],
    }


def test_deepseek_strict_provider_forces_named_tool_and_validates_locally():
    def handler(request: httpx.Request):
        assert request.url.path == "/beta/chat/completions"
        body = json.loads(request.content)
        function = body["tools"][0]["function"]
        assert function["strict"] is True
        assert body["tool_choice"]["function"]["name"] == function["name"]
        assert body.get("response_format") is None
        return httpx.Response(200, json={
            "choices": [{"message": {"content": "ignored", "tool_calls": [{
                "function": {"name": function["name"], "arguments": json.dumps(_strict_chunk_value(), ensure_ascii=False)},
            }]}}],
            "usage": {"prompt_tokens": 10, "completion_tokens": 20},
        })

    provider = _strict_provider(handler)
    assert provider._complete_once(_strict_chunk_payload())["sections"][0]["title"] == "问题背景部分"
    assert provider._usage == {"inputTokens": 10, "outputTokens": 20}


def test_deepseek_strict_provider_rejects_content_fallback_and_extra_fields():
    outcomes = iter([
        {"choices": [{"message": {"content": json.dumps(_strict_chunk_value(), ensure_ascii=False)}}]},
        {"choices": [{"message": {"tool_calls": [{"function": {
            "name": "submit_navia_grounded_contract",
            "arguments": json.dumps({**_strict_chunk_value(), "unexpected": True}, ensure_ascii=False),
        }}]}}]},
    ])
    provider = _strict_provider(lambda _: httpx.Response(200, json=next(outcomes)))
    for _ in range(2):
        try:
            provider._complete_once(_strict_chunk_payload())
        except MediaTaskStoreError as error:
            assert error.code == "V352_SYNTHESIS_RESPONSE_INVALID"
        else:
            raise AssertionError("strict adapter must fail closed")


def test_deepseek_strict_provider_rejects_unknown_task_before_network():
    provider = _strict_provider(lambda _: (_ for _ in ()).throw(AssertionError("network must not be called")))
    try:
        provider._complete_once({"task": "unknown", "evidence": [{"evidenceId": "mtr_" + "1" * 32}]})
    except MediaTaskStoreError as error:
        assert error.code == "V352_SYNTHESIS_TASK_UNSUPPORTED"
    else:
        raise AssertionError("unknown strict task must fail closed")


def test_stage_b_provider_reprompts_temporal_boundary_without_repairing_locally():
    provider = MiniMaxGroundedSynthesisProvider({"id": "test", "model": "test", "baseUrl": "https://invalid", "apiKey": "not-used"})
    evidence = [
        {"evidenceId": "mtr_" + "1" * 32, "kind": "transcript", "timestampStartMs": 0, "timestampEndMs": 1000, "text": "开篇真实证据内容足够长。"},
        {"evidenceId": "mtr_" + "2" * 32, "kind": "transcript", "timestampStartMs": 1000, "timestampEndMs": 2000, "text": "结尾真实证据内容足够长。"},
    ]
    provider._extract_chunk = lambda *args, **kwargs: {"summary": "候选", "sections": []}
    invalid = {
        "brief": {"text": "这是满足长度要求的完整视频概括文字内容。", "evidenceIds": [item["evidenceId"] for item in evidence]},
        "claims": [{"text": "第一条有效核心表达。", "evidenceIds": [evidence[0]["evidenceId"]]}, {"text": "第二条有效核心表达。", "evidenceIds": [evidence[1]["evidenceId"]]}],
        "chapters": [
            {"title": "错误开篇章节", "thesis": "错误地遗漏了最早证据。", "evidenceIds": [evidence[1]["evidenceId"]], "relationToPrevious": "opening"},
            {"title": "结尾章节内容", "thesis": "结尾证据仍然保持闭合。", "evidenceIds": [evidence[1]["evidenceId"]], "relationToPrevious": "conclusion"},
        ],
        "unresolvedEvidenceConflict": False,
    }
    valid = {
        **invalid,
        "chapters": [
            {"title": "正确开篇章节", "thesis": "开篇使用最早直接证据。", "evidenceIds": [evidence[0]["evidenceId"]], "relationToPrevious": "opening"},
            invalid["chapters"][1],
        ],
    }
    calls = []
    provider._complete = lambda payload, **kwargs: calls.append(payload) or (invalid if len(calls) == 1 else valid)
    result, receipt = provider.synthesize_v2(title="测试", evidence=evidence)
    assert result is valid
    assert len(calls) == 2
    assert calls[1]["task"] == "repair_grounded_comprehension_v2_temporal_contract"
    assert receipt.request_count == 0


def test_partial_fallback_preserves_order_and_evidence():
    first = "mtr_" + "8" * 32
    second = "mtr_" + "9" * 32
    result = MiniMaxGroundedSynthesisProvider._result_from_partials([
        {"summary": "第一块总结完整。", "sections": [{"title": "第一部分主题", "thesis": "第一部分结论完整明确。", "keyPoints": ["关键事实一", "关键事实二"], "evidenceIds": ["mtr_" + "8" * 32], "evidenceNote": ""}]},
        {"summary": "第二块总结完整。", "sections": [
            {"title": "无效引用", "thesis": "这条结果必须被整体丢弃。", "keyPoints": ["无效事实一", "无效事实二"], "evidenceIds": ["invented"], "evidenceNote": ""},
            {"title": "第二部分主题", "thesis": "第二部分结论完整明确。", "keyPoints": ["关键步骤一", "关键步骤二"], "evidenceIds": [second, "invented"], "evidenceNote": ""},
        ]},
    ], [
        {"evidenceId": first},
        {"evidenceId": second},
    ])
    assert result["summary"] == "第一块总结完整。；第二块总结完整。"
    assert [chapter["relationToPrevious"] for chapter in result["chapters"]] == ["opening", "continuation"]
    assert result["chapters"][1]["evidenceIds"] == [second]


def test_grounded_answer_rejects_unknown_or_non_visual_citations():
    evidence = [{"evidenceId": "ocr_" + "a" * 32, "kind": "ocr_block", "timestampStartMs": 1000, "timestampEndMs": 2000, "text": "画面中的真实文字"}]
    provider = MiniMaxGroundedSynthesisProvider({"id": "test", "model": "test", "baseUrl": "https://invalid", "apiKey": "not-used"})
    provider._complete = lambda payload, **kwargs: {"status": "answered", "answerBlocks": [{"text": "画面显示了输入证据中的真实文字。", "evidenceIds": [evidence[0]["evidenceId"]]}]}
    result = provider.answer(question="画面显示了什么？", category="visual", chapters=[], evidence=evidence)
    assert result["answerBlocks"][0]["timestampMs"] == 1000

    provider._complete = lambda payload, **kwargs: {"status": "answered", "answerBlocks": [{"text": "这是一条没有闭合引用的错误回答。", "evidenceIds": ["invented"]}]}
    try:
        provider.answer(question="画面显示了什么？", category="visual", chapters=[], evidence=evidence)
        raise AssertionError("unknown answer evidence must fail")
    except MediaTaskStoreError as error:
        assert error.code == "V352_ASK_EVIDENCE_UNCLOSED"

    transcript = {
        "evidenceId": "mtr_" + "b" * 32,
        "kind": "transcript",
        "timestampStartMs": 2000,
        "timestampEndMs": 3000,
        "text": "这是一条语音转写证据。",
    }
    provider._complete = lambda payload, **kwargs: {
        "status": "answered",
        "answerBlocks": [{
            "text": "错误地使用语音转写回答了画面问题。",
            "evidenceIds": [transcript["evidenceId"]],
        }],
    }
    try:
        provider.answer(question="画面显示了什么？", category="visual", chapters=[], evidence=[transcript])
        raise AssertionError("visual answer must reject transcript-only evidence")
    except MediaTaskStoreError as error:
        assert error.code == "V352_ASK_VISUAL_EVIDENCE_INVALID"


def test_stage_b_v2_1_is_revision_hash_bound_and_preserves_v1(tmp_path: Path):
    store, private, task, _ = build(tmp_path)

    class Provider:
        def synthesize_v2(self, *, title, evidence, style):
            groups = stage_b_groups(evidence)
            ids = [item["evidenceId"] for item in evidence]
            return ({
                "brief": {
                    "text": "视频先界定问题背景，再演示具体方法，最后归纳结果限制与适用范围。",
                    "evidenceIds": [groups[0][0]["evidenceId"], groups[1][0]["evidenceId"], groups[2][-1]["evidenceId"]],
                },
                "claims": [
                    {"text": "开篇明确了待解决问题和本次讲解目标。", "evidenceIds": [ids[0]]},
                    {"text": "中段演示方法步骤，结尾归纳结果及限制。", "evidenceIds": [groups[1][0]["evidenceId"], ids[-1]]},
                ],
                "chapters": [
                    {"title": "问题背景与目标", "thesis": "开篇界定问题背景与处理目标。", "evidenceIds": [groups[0][0]["evidenceId"]], "relationToPrevious": "opening"},
                    {"title": "方法步骤与操作", "thesis": "中段按顺序演示具体处理方法。", "evidenceIds": [groups[1][0]["evidenceId"]], "relationToPrevious": "continuation"},
                    {"title": "结果限制与范围", "thesis": "结尾归纳结果限制和适用范围。", "evidenceIds": [groups[2][0]["evidenceId"], groups[2][-1]["evidenceId"]], "relationToPrevious": "conclusion"},
                ],
                "unresolvedEvidenceConflict": False,
            }, GroundedSynthesisReceipt("minimax", "MiniMax-M2.1", "d" * 64, 2, {"inputTokens": 10, "outputTokens": 10}))

    service = MediaComprehensionService(store, private, synthesis_provider_factory=Provider)
    projection = service.synthesize(TASK, task["revision"], True)

    assert projection["schemaVersion"] == "v3-media-workspace-comprehension-projection/v2"
    assert projection["quality"]["status"] == "complete"
    assert projection["grounded"]["brief"]["text"] == projection["outline"]["summary"]
    assert projection["grounded"]["brief"]["origin"] == "provider"
    assert len(projection["grounded"]["claims"]) == 2
    path = next((private / "grounded-comprehension-v2.1" / TASK).rglob("*.json"))
    assert json.loads(path.read_text())["schemaVersion"] == "v3-media-grounded-comprehension/v2.1"
    assert path.stat().st_mode & 0o777 == 0o600
    assert not (private / "grounded-comprehension-v2" / TASK).exists()
    assert not (private / "synthesis" / TASK / f"revision-{task['revision']}.json").exists()
    assert service.get(TASK, task["revision"])["grounded"] == projection["grounded"]


def test_stage_b_invalid_provider_preserves_published_v2_1_bytes(tmp_path: Path):
    store, private, task, _ = build(tmp_path)
    state = {"invalid": False}

    class Provider:
        def synthesize_v2(self, *, title, evidence, style):
            if state["invalid"]:
                return ({"brief": {}}, GroundedSynthesisReceipt("minimax", "MiniMax-M2.1", "e" * 64, 1, {}))
            groups = stage_b_groups(evidence)
            return ({
                "brief": {"text": "视频完整说明问题背景、操作方法与最终限制，覆盖全部关键阶段。", "evidenceIds": [groups[0][0]["evidenceId"], groups[1][0]["evidenceId"], groups[2][-1]["evidenceId"]]},
                "claims": [
                    {"text": "视频开篇明确问题背景和讲解目标。", "evidenceIds": [groups[0][0]["evidenceId"]]},
                    {"text": "视频随后演示方法并总结结果限制。", "evidenceIds": [groups[1][0]["evidenceId"], groups[2][-1]["evidenceId"]]},
                ],
                "chapters": [
                    {"title": "背景与目标说明", "thesis": "开篇完整说明问题背景与目标。", "evidenceIds": [groups[0][0]["evidenceId"]], "relationToPrevious": "opening"},
                    {"title": "方法演示过程", "thesis": "中段演示解决问题的具体方法。", "evidenceIds": [groups[1][0]["evidenceId"]], "relationToPrevious": "continuation"},
                    {"title": "结果与限制总结", "thesis": "结尾总结结果、限制与适用范围。", "evidenceIds": [groups[2][0]["evidenceId"], groups[2][-1]["evidenceId"]], "relationToPrevious": "conclusion"},
                ],
                "unresolvedEvidenceConflict": False,
            }, GroundedSynthesisReceipt("minimax", "MiniMax-M2.1", "e" * 64, 1, {}))

    service = MediaComprehensionService(store, private, synthesis_provider_factory=Provider)
    service.synthesize(TASK, task["revision"], True)
    path = next((private / "grounded-comprehension-v2.1" / TASK).rglob("*.json"))
    before = path.read_bytes()
    state["invalid"] = True
    try:
        service.synthesize(TASK, task["revision"], True)
        raise AssertionError("invalid provider output must fail")
    except MediaTaskStoreError as error:
        assert error.code == "V3510B_PROVIDER_RESPONSE_INVALID"
    assert path.read_bytes() == before


def test_stage_b_route_2_repairs_once_then_composes_closed_brief(tmp_path: Path):
    store, private, task, _ = build(tmp_path)
    calls = {"initial": 0, "repair": 0}

    def short_candidate(evidence):
        groups = stage_b_groups(evidence)
        return {
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
        }

    class Provider:
        def synthesize_v2(self, *, title, evidence, style):
            calls["initial"] += 1
            return short_candidate(evidence), GroundedSynthesisReceipt("minimax", "MiniMax-M3", "f" * 64, 1, {})

        def repair_v2(self, *, title, evidence, candidate, failure_code, style):
            calls["repair"] += 1
            assert failure_code == "V3510B_BRIEF_LENGTH_INVALID"
            return short_candidate(evidence), GroundedSynthesisReceipt("minimax", "MiniMax-M3", "f" * 64, 2, {})

    service = MediaComprehensionService(store, private, synthesis_provider_factory=Provider)
    projection = service.synthesize(TASK, task["revision"], True)
    assert calls == {"initial": 1, "repair": 1}
    assert projection["quality"]["status"] == "complete"
    assert projection["grounded"]["brief"]["origin"] == "deterministic_claim_composer"
    assert len(projection["grounded"]["brief"]["sourceClaimIds"]) == 3
    assert next((private / "grounded-comprehension-v2.1" / TASK).rglob("*.json")).is_file()


def test_stage_b_route_2_does_not_mask_non_brief_repair_failure(tmp_path: Path):
    store, private, task, _ = build(tmp_path)

    class Provider:
        def synthesize_v2(self, *, title, evidence, style):
            groups = stage_b_groups(evidence)
            value = {
                "brief": {"text": "太短", "evidenceIds": [groups[0][0]["evidenceId"], groups[1][0]["evidenceId"], groups[2][-1]["evidenceId"]]},
                "claims": [
                    {"text": "开篇界定了需要讨论的核心问题。", "evidenceIds": [groups[0][0]["evidenceId"]]},
                    {"text": "中段给出分析并在结尾归纳结论。", "evidenceIds": [groups[1][0]["evidenceId"], groups[2][-1]["evidenceId"]]},
                ],
                "chapters": [
                    {"title": "问题背景与范围", "thesis": "开篇界定问题背景和讨论范围。", "evidenceIds": [groups[0][0]["evidenceId"]], "relationToPrevious": "opening"},
                    {"title": "分析路径与结论", "thesis": "中段推进分析并在结尾形成结论。", "evidenceIds": [groups[1][0]["evidenceId"], groups[2][-1]["evidenceId"]], "relationToPrevious": "conclusion"},
                ],
                "unresolvedEvidenceConflict": False,
            }
            return value, GroundedSynthesisReceipt("minimax", "MiniMax-M3", "a" * 64, 1, {})

        def repair_v2(self, *, title, evidence, candidate, failure_code, style):
            broken = dict(candidate)
            broken["chapters"] = [dict(item) for item in candidate["chapters"]]
            broken["chapters"][1]["evidenceIds"] = broken["chapters"][0]["evidenceIds"]
            return broken, GroundedSynthesisReceipt("minimax", "MiniMax-M3", "a" * 64, 2, {})

    service = MediaComprehensionService(store, private, synthesis_provider_factory=Provider)
    try:
        service.synthesize(TASK, task["revision"], True)
        raise AssertionError("chapter failure must remain fail-closed")
    except MediaTaskStoreError as error:
        assert error.code == "V3510B_CHAPTER_TIME_INVALID"
    assert not (private / "grounded-comprehension-v2.1" / TASK).exists()


def test_stage_b_route_2_changed_authority_before_commit_publishes_nothing(tmp_path: Path, monkeypatch):
    store, private, task, _ = build(tmp_path)

    class Provider:
        def synthesize_v2(self, *, title, evidence, style):
            groups = stage_b_groups(evidence)
            return ({
                "brief": {"text": "视频完整说明问题背景、操作方法与结果限制，覆盖全部关键阶段。", "evidenceIds": [groups[0][0]["evidenceId"], groups[1][0]["evidenceId"], groups[2][-1]["evidenceId"]]},
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
            }, GroundedSynthesisReceipt("minimax", "MiniMax-M3", "b" * 64, 1, {}))

    service = MediaComprehensionService(store, private, synthesis_provider_factory=Provider)

    def reject_changed_binding(*args, **kwargs):
        raise MediaTaskStoreError("V3510B_EVIDENCE_CATALOG_CHANGED", "changed", status=409)

    monkeypatch.setattr(service, "_assert_current_binding", reject_changed_binding)
    try:
        service.synthesize(TASK, task["revision"], True)
        raise AssertionError("changed authority must fail before publication")
    except MediaTaskStoreError as error:
        assert error.code == "V3510B_EVIDENCE_CATALOG_CHANGED"
    assert not (private / "grounded-comprehension-v2.1" / TASK).exists()


def test_stage_b_route_2_has_no_hidden_retry_when_no_claim_subset_is_valid(tmp_path: Path):
    store, private, task, _ = build(tmp_path)
    calls = {"initial": 0, "repair": 0}

    class Provider:
        def _candidate(self, evidence):
            groups = stage_b_groups(evidence)
            return {
                "brief": {"text": "太短", "evidenceIds": [groups[0][0]["evidenceId"], groups[1][0]["evidenceId"], groups[2][-1]["evidenceId"]]},
                "claims": [
                    {"text": "开篇界定了需要讨论的核心问题。", "evidenceIds": [groups[0][0]["evidenceId"]]},
                    {"text": "中段给出了分析路径和关键依据。", "evidenceIds": [groups[1][0]["evidenceId"]]},
                ],
                "chapters": [
                    {"title": "问题背景与范围", "thesis": "开篇界定问题背景和讨论范围。", "evidenceIds": [groups[0][0]["evidenceId"]], "relationToPrevious": "opening"},
                    {"title": "分析路径与结论", "thesis": "中段推进分析并在结尾形成结论。", "evidenceIds": [groups[1][0]["evidenceId"], groups[2][-1]["evidenceId"]], "relationToPrevious": "conclusion"},
                ],
                "unresolvedEvidenceConflict": False,
            }

        def synthesize_v2(self, *, title, evidence, style):
            calls["initial"] += 1
            return self._candidate(evidence), GroundedSynthesisReceipt("minimax", "MiniMax-M3", "c" * 64, 1, {})

        def repair_v2(self, *, title, evidence, candidate, failure_code, style):
            calls["repair"] += 1
            return self._candidate(evidence), GroundedSynthesisReceipt("minimax", "MiniMax-M3", "c" * 64, 2, {})

    service = MediaComprehensionService(store, private, synthesis_provider_factory=Provider)
    try:
        service.synthesize(TASK, task["revision"], True)
        raise AssertionError("missing ending claim must remain fail-closed")
    except MediaTaskStoreError as error:
        assert error.code == "V3510B_BRIEF_LENGTH_INVALID"
    assert calls == {"initial": 1, "repair": 1}
    assert not (private / "grounded-comprehension-v2.1" / TASK).exists()

def test_grounded_answer_retries_contract_failure_before_accepting():
    evidence = [{
        "evidenceId": "mtr_" + "c" * 32,
        "kind": "transcript",
        "timestampStartMs": 0,
        "timestampEndMs": 1000,
        "text": "视频证据说明了一个可以回答的问题。",
    }]
    provider = MiniMaxGroundedSynthesisProvider({"id": "test", "model": "test", "baseUrl": "https://invalid", "apiKey": "not-used"})
    attempts = []

    def complete(payload, **kwargs):
        attempts.append(payload)
        if len(attempts) == 1:
            return {"status": "answered", "answerBlocks": [], "extra": "invalid"}
        return {
            "status": "answered",
            "answerBlocks": [{"text": "第二次返回了引用闭合的有效回答。", "evidenceIds": [evidence[0]["evidenceId"]]}],
        }

    provider._complete = complete
    result = provider.answer(question="视频说明了什么？", category="factual", chapters=[], evidence=evidence)
    assert result["status"] == "answered"
    assert len(attempts) == 2
    assert "retryConstraint" not in attempts[0]
    assert "retryConstraint" in attempts[1]


def test_cross_chapter_answer_allows_six_blocks_but_not_seven():
    evidence = [{
        "evidenceId": f"mtr_{index:032d}",
        "kind": "transcript",
        "timestampStartMs": index * 1000,
        "timestampEndMs": (index + 1) * 1000,
        "text": f"第 {index + 1} 个章节证据。",
    } for index in range(7)]
    provider = MiniMaxGroundedSynthesisProvider({"id": "test", "model": "test", "baseUrl": "https://invalid", "apiKey": "not-used"})
    attempts = []

    def complete(payload, **kwargs):
        attempts.append(payload)
        count = 7 if len(attempts) == 1 else 6
        return {
            "status": "answered",
            "answerBlocks": [{
                "text": f"第 {index + 1} 个阶段具有引用闭合的回答。",
                "evidenceIds": [evidence[index]["evidenceId"]],
            } for index in range(count)],
        }

    provider._complete = complete
    result = provider.answer(question="整体各章如何关联？", category="cross_chapter", chapters=[], evidence=evidence)
    assert len(result["answerBlocks"]) == 6
    assert len(attempts) == 2
    assert "1 至 6" in attempts[1]["retryConstraint"]


def test_grounded_answer_retries_when_internal_ids_leak_into_text():
    evidence = [{
        "evidenceId": "mtr_" + "d" * 32,
        "kind": "transcript",
        "timestampStartMs": 0,
        "timestampEndMs": 1000,
        "text": "一条有效的转写证据。",
    }]
    provider = MiniMaxGroundedSynthesisProvider({"id": "test", "model": "test", "baseUrl": "https://invalid", "apiKey": "not-used"})
    attempts = []

    def complete(payload, **kwargs):
        attempts.append(payload)
        text = (
            f"正文错误包含内部标识 {evidence[0]['evidenceId']}。"
            if len(attempts) == 1 else "正文只保留面向用户的有效回答。"
        )
        return {"status": "answered", "answerBlocks": [{"text": text, "evidenceIds": [evidence[0]["evidenceId"]]}]}

    provider._complete = complete
    result = provider.answer(question="证据说明什么？", category="factual", chapters=[], evidence=evidence)
    assert result["answerBlocks"][0]["text"] == "正文只保留面向用户的有效回答。"
    assert len(attempts) == 2
