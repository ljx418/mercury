from __future__ import annotations

import asyncio

from navia_runtime.contracts import ErrorCode
from navia_runtime.modules.agent_loop.runtime import CoreTurnInput, create_core_provider, run_agentic_turn
from navia_runtime.modules.agent_loop.runtime.pi_sidecar_client import PiSidecarError


def active_page() -> dict[str, object]:
    return {
        "pageId": "page_fixture",
        "sessionId": "sess_fixture",
        "url": "https://example.com/article",
        "title": "Companion Reading Architecture",
        "domain": "example.com",
        "capturedAt": "2026-06-04T00:00:00Z",
        "contentHash": "sha256_fixture",
        "metadata": {"contentType": "article", "wordCount": 120, "paragraphCount": 3, "headingCount": 2},
        "headingTree": [
            {"headingId": "hd_0001", "level": 1, "text": "Companion Reading Architecture", "order": 0, "paragraphIds": ["pg_0001"]},
            {"headingId": "hd_0002", "level": 2, "text": "Structured Page Facts", "order": 1, "paragraphIds": ["pg_0002"]},
        ],
        "paragraphs": [
            {"paragraphId": "pg_0001", "pageId": "page_fixture", "order": 0, "text": "Navia extracts page context for companion reading.", "headingPath": ["Companion Reading Architecture"], "chunkId": "ck_0001"},
            {"paragraphId": "pg_0002", "pageId": "page_fixture", "order": 1, "text": "The page reading module creates paragraphs, chunks, annotations, and stable hashes.", "headingPath": ["Companion Reading Architecture", "Structured Page Facts"], "chunkId": "ck_0001"},
            {"paragraphId": "pg_0003", "pageId": "page_fixture", "order": 2, "text": "Adapters must pass governance before producing artifacts or trace evidence.", "headingPath": ["Companion Reading Architecture"], "chunkId": "ck_0002"},
        ],
        "chunks": [
            {"chunkId": "ck_0001", "pageId": "page_fixture", "order": 0, "text": "Navia extracts page context. The module creates paragraphs and chunks.", "paragraphIds": ["pg_0001", "pg_0002"]},
            {"chunkId": "ck_0002", "pageId": "page_fixture", "order": 1, "text": "Adapters must pass governance.", "paragraphIds": ["pg_0003"]},
        ],
        "annotations": [],
        "summaryDraft": {
            "format": "json",
            "title": "Companion Reading Architecture",
            "tldr": "Navia extracts page context.",
            "keyPoints": ["Navia extracts page context.", "Adapters pass governance.", "Artifacts keep source references."],
            "structure": [],
            "suggestedQuestions": [],
        },
    }


def run_turn(message: str, **overrides: object) -> dict[str, object]:
    payload = {
        "sessionId": "sess_d_test",
        "requestId": "req_d_test",
        "userMessage": message,
        "activePage": active_page(),
        "recentMessages": [{"messageId": "msg_prev", "role": "assistant", "content": "上一轮摘要", "turnId": "turn_prev"}],
        "budget": {"maxToolCalls": 2, "maxRetries": 1, "maxContextBytes": 4096},
    }
    payload.update(overrides)
    return run_agentic_turn(payload)


def event_types(result: dict[str, object]) -> list[str]:
    return [event["type"] for event in result["events"]]  # type: ignore[index]


def test_summary_turn_creates_ids_tool_result_artifact_and_trace() -> None:
    result = run_turn("请总结当前页面")

    assert result["status"] == "succeeded"
    assert str(result["turnId"]).startswith("turn_")
    assert str(result["traceId"]).startswith("trace_")
    assert "budget.checked" in event_types(result)
    assert "tool.started" in event_types(result)
    assert "tool.done" in event_types(result)
    assert "artifact.created" in event_types(result)
    tool_result = result["toolResults"][0]  # type: ignore[index]
    assert tool_result["status"] == "succeeded"
    assert tool_result["tool_call_id"]
    artifact = result["artifacts"][0]  # type: ignore[index]
    assert artifact["sourcePageId"] == "page_fixture"
    assert artifact["turnId"] == result["turnId"]
    assert artifact["toolCallId"] == tool_result["tool_call_id"]
    assert result["trace"]["toolCallIds"] == [tool_result["tool_call_id"]]  # type: ignore[index]


def test_qa_turn_uses_page_answer_adapter() -> None:
    result = run_turn("这些适配器为什么需要治理？")

    assert result["status"] == "succeeded"
    assert result["toolResults"][0]["tool_name"] == "page.answer"  # type: ignore[index]
    assert result["artifacts"][0]["type"] == "answer"  # type: ignore[index]


def test_mindmap_turn_creates_mermaid_artifact_with_source_map() -> None:
    result = run_turn("生成思维导图")

    assert result["status"] == "succeeded"
    artifact = result["artifacts"][0]  # type: ignore[index]
    assert artifact["type"] == "mindmap"
    assert artifact["metadata"]["format"] == "mermaid"
    assert artifact["metadata"]["nodeSourceMap"]


def test_denied_adapter_does_not_emit_tool_started_or_artifact() -> None:
    result = run_turn("执行高风险工具", forceAdapterId="fixture.denied")

    assert result["status"] == "denied"
    assert "tool.denied" in event_types(result)
    assert "tool.started" not in event_types(result)
    assert result["toolResults"] == []
    assert result["artifacts"] == []
    error_events = [event for event in result["events"] if event["type"] == "error"]  # type: ignore[index]
    assert error_events[0]["data"]["code"] == ErrorCode.TOOL_PERMISSION_DENIED.value


def test_missing_active_page_returns_page_context_required_without_fake_artifact() -> None:
    result = run_agentic_turn(
        {
            "sessionId": "sess_missing",
            "requestId": "req_missing",
            "userMessage": "请总结当前页面",
            "budget": {"maxToolCalls": 2},
        }
    )

    assert result["status"] == "denied"
    assert "tool.started" not in event_types(result)
    assert result["artifacts"] == []
    error_events = [event for event in result["events"] if event["type"] == "error"]  # type: ignore[index]
    assert error_events[0]["data"]["code"] == ErrorCode.PAGE_CONTEXT_REQUIRED.value


def test_budget_exceeded_blocks_before_tool_started() -> None:
    result = run_turn("请总结当前页面", budget={"maxToolCalls": 0})

    assert result["status"] == "budget_exceeded"
    assert "tool.started" not in event_types(result)
    assert "tool.denied" in event_types(result)
    error_events = [event for event in result["events"] if event["type"] == "error"]  # type: ignore[index]
    assert error_events[0]["data"]["code"] == ErrorCode.BUDGET_EXCEEDED.value


def test_adapter_failure_maps_to_tool_done_and_error_without_artifact() -> None:
    result = run_turn("触发失败", forceAdapterId="fixture.failure")

    assert result["status"] == "failed"
    assert "tool.started" in event_types(result)
    assert "tool.done" in event_types(result)
    assert "error" in event_types(result)
    assert result["artifacts"] == []
    assert result["toolResults"][0]["status"] == "failed"  # type: ignore[index]


def test_piagent_provider_shell_returns_recoverable_error_when_sidecar_unavailable() -> None:
    provider = create_core_provider({"provider": "piagent"})
    assert provider.provider_id == "piagent"

    class UnavailableClient:
        def health(self):
            raise PiSidecarError("offline")

    provider.client = UnavailableClient()
    events = asyncio.run(
        _collect_async_events(
            provider.run_turn(
                CoreTurnInput(
                    session_id="sess_pi_shell",
                    turn_id="turn_pi_shell",
                    trace_id="trace_pi_shell",
                    request_id="req_pi_shell",
                    user_message="hello",
                    active_page=active_page(),
                    recent_messages=[],
                    budget={},
                    adapters=[],
                    mode="chat",
                    provider_config={},
                )
            )
        )
    )
    assert events[0].type == "error"
    assert events[0].data["code"] == "piagent_sidecar_unavailable"
    assert events[0].data["recoverable"] is True


async def _collect_async_events(iterator):
    return [event async for event in iterator]
