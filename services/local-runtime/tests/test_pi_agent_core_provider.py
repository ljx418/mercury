from __future__ import annotations

import asyncio

import httpx

from navia_runtime.modules.agent_loop.runtime.core_types import CoreEventType, CoreTurnInput
from navia_runtime.modules.agent_loop.runtime.chat_profile_prompt import CHAT_PROFILE_SYSTEM_PROMPT, build_page_context_prompt, build_prompt_envelope
from navia_runtime.modules.agent_loop.runtime.pi_agent_core_provider import PiAgentCoreProvider
from navia_runtime.modules.agent_loop.runtime.llm_direct_provider import LLMDirectProvider
from navia_runtime.modules.agent_loop.runtime.pi_sidecar_client import PiSidecarError


class FakePiClient:
    def __init__(self, events=None, fail_health: bool = False) -> None:
        self.events = events or [{"type": "response.delta", "text": "hello"}, {"type": "response.done"}]
        self.fail_health = fail_health
        self.created_body_tool_names = None
        self.system_prompt = None
        self.profile = None
        self.tool_policy = None
        self.prompt_message = None
        self.prompted = False

    def health(self):
        if self.fail_health:
            raise PiSidecarError("offline")
        return {"status": "ok"}

    def create_session(self, navia_session_id: str, model_provider=None, system_prompt=None, profile="chat", tool_policy="disabled"):
        self.created_body_tool_names = []
        self.system_prompt = system_prompt
        self.profile = profile
        self.tool_policy = tool_policy
        return {"sessionId": f"pi_{navia_session_id}", "toolNames": []}

    def send_prompt(self, session_id: str, message: str, request_id: str, turn_id: str, trace_id: str):
        self.prompted = True
        self.prompt_message = message
        return {"accepted": True, "sessionId": session_id}

    def stream_events(self, session_id: str):
        yield from self.events


def active_page() -> dict[str, object]:
    return {
        "pageId": "page_pi_fixture",
        "title": "Mercury 页面",
        "url": "https://example.com/article",
        "domain": "example.com",
        "selectedText": "选区内容优先解释",
        "cleanedText": "清洗正文内容",
        "visibleText": "低价值可见正文",
        "chunks": [{"chunkId": "chunk_pi_1", "text": "chunk fallback text"}],
        "perceptionDigest": {"summary": "高信号页面摘要", "items": [{"text": "关键观点 A"}]},
        "highSignalPage": {"summary": "高信号页面正文"},
        "debug": {"raw": "Pi raw event should not leak"},
        "private": {"apiKey": "sk-1234567890abcdef"},
        "localPath": "/Users/hr/Documents/secret",
    }


def core_input(message: str = "hello", *, page: dict[str, object] | None = None) -> CoreTurnInput:
    return CoreTurnInput(
        session_id="sess_pi_provider",
        turn_id="turn_pi_provider",
        trace_id="trace_pi_provider",
        request_id="req_pi_provider",
        user_message=message,
        active_page=page,
        recent_messages=[],
        budget={},
        adapters=[],
        mode="chat",
        provider_config={
            "provider": "piagent",
            "modelProvider": {
                "type": "deepseek",
                "baseUrl": "https://api.deepseek.com",
                "model": "deepseek-v4-flash",
                "apiKeyRef": "sqlite:provider:api_key",
            },
        },
    )


def collect(provider: PiAgentCoreProvider, input_data: CoreTurnInput | None = None):
    async def run():
        return [event async for event in provider.run_turn(input_data or core_input())]

    return asyncio.run(run())


def test_pi_agent_core_provider_yields_delta_done() -> None:
    fake = FakePiClient()
    events = collect(PiAgentCoreProvider(client=fake, max_polls=1))

    assert [event.type for event in events] == [CoreEventType.STATE, CoreEventType.RESPONSE_DELTA, CoreEventType.RESPONSE_DONE]
    assert fake.prompted is True
    assert fake.created_body_tool_names == []
    assert fake.profile == "chat"
    assert fake.tool_policy == "disabled"
    assert fake.system_prompt == CHAT_PROFILE_SYSTEM_PROMPT
    assert fake.prompt_message is not None
    assert "浏览器侧边栏中的网页阅读聊天助手" in fake.prompt_message
    assert "TASK_TYPE: general_chat" in fake.prompt_message
    assert "TOOLS_ALLOWED: false" in fake.prompt_message
    assert "hello" in fake.prompt_message
    assert events[0].data["systemPromptInjectionMode"] == "prompt_envelope"


def test_pi_agent_prompt_injects_structured_page_context() -> None:
    fake = FakePiClient()
    events = collect(PiAgentCoreProvider(client=fake, max_polls=1), core_input("请总结当前页面", page=active_page()))

    assert [event.type for event in events] == [CoreEventType.STATE, CoreEventType.RESPONSE_DELTA, CoreEventType.RESPONSE_DONE]
    assert fake.prompt_message is not None
    assert "TASK_TYPE: summarize_page" in fake.prompt_message
    assert "PAGE_CONTEXT:" in fake.prompt_message
    assert "PAGE_TITLE:\nMercury 页面" in fake.prompt_message
    assert "PAGE_URL:\nhttps://example.com/article" in fake.prompt_message
    assert "SELECTED_TEXT:\n选区内容优先解释" in fake.prompt_message
    assert "PAGE_CONTEXT_DIGEST:" in fake.prompt_message
    assert "高信号页面摘要" in fake.prompt_message
    assert "PAGE_TEXT:\n清洗正文内容" in fake.prompt_message
    assert "Pi raw event" not in fake.prompt_message
    assert "sk-1234567890abcdef" not in fake.prompt_message
    assert "/Users/hr" not in fake.prompt_message


def test_pi_agent_mindmap_text_is_standardized_to_artifact_created() -> None:
    fake = FakePiClient(
        events=[
            {"type": "response.delta", "text": "```mermaid\nmindmap\n  root((Building a GPT))\n    Dataset\n      Tiny Shakespeare\n        Too deep\n```"},
            {"type": "response.done"},
        ]
    )
    events = collect(PiAgentCoreProvider(client=fake, max_polls=1), core_input("生成当前页面 Mindmap", page=active_page()))

    event_types = [event.type for event in events]
    assert event_types == [CoreEventType.STATE, CoreEventType.ARTIFACT_CREATED, CoreEventType.RESPONSE_DELTA, CoreEventType.RESPONSE_DONE]
    artifact_event = events[1]
    artifact = artifact_event.data["artifact"]
    assert artifact["type"] == "mindmap"
    assert artifact["content"].startswith("mindmap\n")
    assert "Too deep" not in artifact["content"]
    assert artifact["metadata"]["format"] == "mermaid"
    assert artifact["metadata"]["generatedBy"] == "piagent"
    assert artifact["metadata"]["layout"] == "pyramid"
    assert artifact["metadata"]["maxDepth"] == 3
    assert artifact["metadata"]["validation"]["valid"] is True
    assert artifact["metadata"]["nodeSourceMap"]
    assert artifact["metadata"]["nodeBindings"]
    assert artifact["sourcePageId"] == "page_pi_fixture"
    assert artifact["sourceChunkIds"] == ["chunk_pi_1"]
    assert events[2].data["text"] == "已生成当前页面思维导图。"
    assert "mindmap" not in events[2].data["text"]


def test_pi_agent_mindmap_plain_mermaid_prefix_is_standardized_to_artifact_created() -> None:
    fake = FakePiClient(events=[{"type": "response.delta", "text": "mermaid\nmindmap\n  root((Building a GPT))"}, {"type": "response.done"}])
    events = collect(PiAgentCoreProvider(client=fake, max_polls=1), core_input("生成当前页面 Mindmap", page=active_page()))

    artifact = next(event.data["artifact"] for event in events if event.type == CoreEventType.ARTIFACT_CREATED)
    assert artifact["content"] == "mindmap\n  root((Building a GPT))"


def test_pi_agent_mindmap_fenced_mindmap_block_is_standardized_to_artifact_created() -> None:
    fake = FakePiClient(events=[{"type": "response.delta", "text": "```mindmap\nroot((Building a GPT))\n  Dataset\n```"}, {"type": "response.done"}])
    events = collect(PiAgentCoreProvider(client=fake, max_polls=1), core_input("生成当前页面 Mindmap", page=active_page()))

    artifact = next(event.data["artifact"] for event in events if event.type == CoreEventType.ARTIFACT_CREATED)
    assert artifact["content"] == "mindmap\nroot((Building a GPT))\n  Dataset"


def test_pi_agent_mindmap_recovers_from_polluted_fence_prefix() -> None:
    fake = FakePiClient(events=[{"type": "response.delta", "text": "```m```mermaid\nmindmap\n  root((Building a GPT))\n```"}, {"type": "response.done"}])
    events = collect(PiAgentCoreProvider(client=fake, max_polls=1), core_input("生成当前页面 Mindmap", page=active_page()))

    artifact = next(event.data["artifact"] for event in events if event.type == CoreEventType.ARTIFACT_CREATED)
    assert artifact["content"] == "mindmap\n  root((Building a GPT))"


def test_page_context_helper_prioritizes_selected_text_and_digest() -> None:
    page = active_page()
    page["selectedText"] = "S" * 2000
    page["perceptionDigest"] = {"summary": "D" * 2000}
    page["cleanedText"] = "C" * 4000
    page["visibleText"] = "V" * 4000

    prompt = build_page_context_prompt(page, max_chars=2600)

    assert prompt.index("SELECTED_TEXT") < prompt.index("PAGE_CONTEXT_DIGEST")
    assert "S" * 100 in prompt
    assert "D" * 100 in prompt
    assert "V" * 100 not in prompt
    assert len(prompt) <= 2600


def test_llm_direct_uses_same_page_context_helper() -> None:
    page = active_page()
    direct = LLMDirectProvider(model_provider={"apiKey": "key", "baseUrl": "https://example.com", "model": "m"})

    direct_context = direct._messages(core_input("请总结当前页面", page=page))[1]["content"]
    shared_context = build_page_context_prompt(page)

    assert shared_context in direct_context
    assert "PAGE_TITLE:\nMercury 页面" in direct_context
    assert "PAGE_CONTEXT_DIGEST:" in direct_context


def test_llm_direct_disables_minimax_thinking_without_changing_other_providers() -> None:
    direct = LLMDirectProvider()

    minimax = direct._request_payload(core_input(), model="MiniMax-M3", base_url="https://api.minimaxi.com/v1")
    deepseek = direct._request_payload(core_input(), model="deepseek-chat", base_url="https://api.deepseek.com")

    assert minimax["thinking"] == {"type": "disabled"}
    assert "thinking" not in deepseek


def test_llm_direct_classifies_minimax_sensitive_rejection_and_builds_local_summary() -> None:
    direct = LLMDirectProvider()
    response = httpx.Response(
        422,
        json={"error": {"type": "unprocessable_entity_error", "message": "input new_sensitive (1026)", "http_code": "422"}},
    )
    provider_error = direct._provider_error(response)

    assert direct._is_content_policy_rejection(response, provider_error) is True
    summary = direct._local_summary(core_input("总结当前页面", page=active_page()))
    assert summary is not None
    assert "Navia 本地页面摘要" in summary
    assert "Mercury 页面" in summary


def test_llm_direct_reads_streaming_error_response_before_classification() -> None:
    request = httpx.Request("POST", "https://api.minimaxi.com/v1/chat/completions")
    response = httpx.Response(
        422,
        request=request,
        stream=httpx.ByteStream(
            b'{"error":{"type":"unprocessable_entity_error","message":"input new_sensitive (1026)","http_code":"422"}}'
        ),
    )
    response.read()
    try:
        response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        error = LLMDirectProvider()._provider_error(exc.response)

    assert error["message"] == "input new_sensitive (1026)"


def test_llm_direct_does_not_use_local_summary_for_general_chat() -> None:
    direct = LLMDirectProvider()

    assert direct._local_summary(core_input("你好", page=active_page())) is None


def test_pi_agent_core_provider_done_without_text_yields_empty_response_error() -> None:
    fake = FakePiClient(events=[{"type": "state", "state": "pi.raw", "rawSummary": "{\"type\":\"agent_end\"}"}, {"type": "response.done"}])
    events = collect(PiAgentCoreProvider(client=fake, max_polls=1))

    assert [event.type for event in events] == [CoreEventType.STATE, CoreEventType.STATE, CoreEventType.ERROR]
    assert events[2].data["code"] == "pi_rpc_no_text"
    assert events[2].data["recoverable"] is True


def test_pi_agent_summarize_without_page_returns_page_context_missing() -> None:
    fake = FakePiClient()
    events = collect(PiAgentCoreProvider(client=fake, max_polls=1), core_input("请总结当前页面"))

    assert [event.type for event in events] == [CoreEventType.ERROR]
    assert events[0].data["code"] == "page_context_missing"
    assert fake.prompted is False


def test_pi_agent_mindmap_without_page_returns_page_context_missing() -> None:
    fake = FakePiClient()
    events = collect(PiAgentCoreProvider(client=fake, max_polls=1), core_input("生成 Mindmap"))

    assert [event.type for event in events] == [CoreEventType.ERROR]
    assert events[0].data["code"] == "page_context_missing"
    assert fake.prompted is False


def test_pi_agent_general_chat_without_page_does_not_require_page_context() -> None:
    fake = FakePiClient()
    events = collect(PiAgentCoreProvider(client=fake, max_polls=1), core_input("你好"))

    assert [event.type for event in events] == [CoreEventType.STATE, CoreEventType.RESPONSE_DELTA, CoreEventType.RESPONSE_DONE]
    assert fake.prompted is True


def test_pi_agent_core_provider_raw_text_without_delta_yields_normalizer_error() -> None:
    fake = FakePiClient(events=[{"type": "state", "state": "pi.raw", "rawSummary": "{\"message\":{\"content\":\"hello\"}}"}, {"type": "response.done"}])
    events = collect(PiAgentCoreProvider(client=fake, max_polls=1))

    assert events[2].data["code"] == "piagent_no_assistant_text_delta"


def test_pi_agent_core_provider_thinking_only_yields_hidden_thinking_error() -> None:
    fake = FakePiClient(events=[{"type": "state", "state": "pi.raw", "rawSummary": "{\"assistantMessageEvent\":{\"type\":\"thinking_delta\",\"delta\":\"[redacted]\"}}"}, {"type": "response.done"}])
    events = collect(PiAgentCoreProvider(client=fake, max_polls=1))

    assert events[2].data["code"] == "piagent_hidden_thinking_only"
    assert "内部思考内容已被安全过滤" in events[2].data["message"]
    assert "redacted" not in events[2].data["message"]


def test_pi_agent_core_provider_toolcall_yields_tool_call_denied_error() -> None:
    fake = FakePiClient(events=[{"type": "tool.requested", "toolName": "read", "toolCallId": "tc_pi"}, {"type": "tool.denied", "toolName": "read", "toolCallId": "tc_pi"}, {"type": "response.done"}])
    events = collect(PiAgentCoreProvider(client=fake, max_polls=1))

    assert CoreEventType.TOOL_REQUESTED in [event.type for event in events]
    assert CoreEventType.TOOL_DENIED in [event.type for event in events]
    assert events[-1].type == CoreEventType.ERROR
    assert events[-1].data["code"] == "piagent_tool_call_denied"
    assert "toolCallId" not in events[-1].data["message"]


def test_pi_agent_core_provider_user_role_echo_does_not_look_like_assistant_text() -> None:
    fake = FakePiClient(events=[{"type": "state", "state": "pi.raw", "rawSummary": "{\"message\":{\"role\":\"user\",\"content\":\"hello\"}}"}, {"type": "response.done"}])
    events = collect(PiAgentCoreProvider(client=fake, max_polls=1))

    assert events[2].data["code"] == "pi_rpc_no_text"


def test_pi_agent_core_provider_missing_model_provider_is_explicit() -> None:
    async def run():
        input_data = core_input()
        input_data.provider_config.clear()
        return [event async for event in PiAgentCoreProvider(client=FakePiClient(), max_polls=1).run_turn(input_data)]

    events = asyncio.run(run())

    assert events[0].type == CoreEventType.ERROR
    assert events[0].data["code"] == "piagent_provider_config_missing"


def test_pi_agent_core_provider_preserves_provider_auth_failed() -> None:
    fake = FakePiClient(events=[{"type": "error", "code": "provider_auth_failed", "message": "401 invalid api key", "recoverable": True}])
    events = collect(PiAgentCoreProvider(client=fake, max_polls=1))

    assert events[1].type == CoreEventType.ERROR
    assert events[1].data["code"] == "provider_auth_failed"


def test_pi_agent_core_provider_offline_yields_recoverable_error() -> None:
    events = collect(PiAgentCoreProvider(client=FakePiClient(fail_health=True), max_polls=1))

    assert events[0].type == CoreEventType.ERROR
    assert events[0].data["recoverable"] is True


def test_pi_agent_tool_request_is_denied_without_started() -> None:
    fake = FakePiClient(events=[{"type": "tool.requested", "toolName": "bash", "toolCallId": "tc_pi"}, {"type": "tool.denied", "toolName": "bash", "toolCallId": "tc_pi"}, {"type": "response.done"}])
    events = collect(PiAgentCoreProvider(client=fake, max_polls=1))

    assert CoreEventType.TOOL_REQUESTED in [event.type for event in events]
    assert CoreEventType.TOOL_DENIED in [event.type for event in events]
    assert CoreEventType.TOOL_STARTED not in [event.type for event in events]
    assert events[-1].data["code"] == "piagent_tool_call_denied"


def test_chat_profile_prompt_does_not_leak_coding_agent_mindset() -> None:
    forbidden = ["这是代码任务", "这不是代码任务", "我在编程项目中工作", "我可以帮你写数据抓取代码", "PiAgentCoreProvider", "sidecar", "toolNames", "工具已禁用"]

    assert "浏览器侧边栏中的网页阅读聊天助手" in CHAT_PROFILE_SYSTEM_PROMPT
    assert "不是编码助手" in CHAT_PROFILE_SYSTEM_PROMPT
    assert "不能读取本地文件" in CHAT_PROFILE_SYSTEM_PROMPT
    assert "不能查看目录" in CHAT_PROFILE_SYSTEM_PROMPT
    assert "不能执行命令" in CHAT_PROFILE_SYSTEM_PROMPT
    assert "不能调用 read/write/bash/edit/grep/find/ls" in CHAT_PROFILE_SYSTEM_PROMPT
    fake_prompt = build_prompt_envelope("总结当前页面", task_type="summarize_page", active_page=active_page())
    assert "TOOLS_ALLOWED" in fake_prompt
    assert "TASK_TYPE: summarize_page" in fake_prompt
    assert "CONTEXT_SOURCE: Runtime provided browser page context" in fake_prompt
    assert "以下 PAGE_CONTEXT 就是当前浏览器页面内容" in fake_prompt
    assert "默认先给结论" in CHAT_PROFILE_SYSTEM_PROMPT
    for phrase in forbidden:
        assert phrase not in CHAT_PROFILE_SYSTEM_PROMPT


def test_mindmap_prompt_contains_output_format_instruction() -> None:
    prompt = build_prompt_envelope("生成思维导图", task_type="mindmap_page", active_page=active_page())

    assert "MINDMAP_OUTPUT_FORMAT" in prompt
    assert "Mermaid mindmap" in prompt
    assert "artifact.created" in prompt
