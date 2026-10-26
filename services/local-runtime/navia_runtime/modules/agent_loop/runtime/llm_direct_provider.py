from __future__ import annotations

import json
import logging
from collections.abc import AsyncIterator, Callable

import httpx

from navia_runtime.contracts import ErrorCode, new_id
from navia_runtime.modules.agent_loop.runtime.chat_profile_prompt import CHAT_PROFILE_SYSTEM_PROMPT, build_page_context_prompt
from navia_runtime.modules.agent_loop.runtime.core_types import CoreEvent, CoreEventType, CoreTurnInput
from navia_runtime.tools import summarize_page


LOGGER = logging.getLogger(__name__)


class LLMDirectProvider:
    provider_id = "llm_direct"

    def __init__(self, model_provider: dict[str, object] | None = None, client_factory: Callable[[], httpx.Client] | None = None) -> None:
        self.model_provider = model_provider or {}
        self.client_factory = client_factory or (lambda: httpx.Client(timeout=30.0))

    async def run_turn(self, input: CoreTurnInput) -> AsyncIterator[CoreEvent]:
        if not self.model_provider:
            yield self._error(input, "llm_provider_missing", "LLM Provider 未配置，请在 Settings 中选择 DeepSeek Provider。")
            return
        api_key = str(self.model_provider.get("apiKey") or "")
        base_url = str(self.model_provider.get("baseUrl") or "")
        model = str(self.model_provider.get("model") or "")
        if not api_key or not base_url or not model:
            yield self._error(input, "llm_provider_missing", "LLM Provider 配置不完整。")
            return
        try:
            with self.client_factory() as client:
                with client.stream(
                    "POST",
                    f"{base_url.rstrip('/')}/chat/completions",
                    headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                    json=self._request_payload(input, model=model, base_url=base_url),
                ) as response:
                    if response.is_error:
                        response.read()
                    response.raise_for_status()
                    for line in response.iter_lines():
                        if not line.startswith("data:"):
                            continue
                        payload = line[5:].strip()
                        if not payload or payload == "[DONE]":
                            continue
                        text = self._delta_text(payload)
                        if text:
                            yield CoreEvent(CoreEventType.RESPONSE_DELTA, input.session_id, input.turn_id, input.trace_id, input.request_id, {"text": text})
            yield CoreEvent(CoreEventType.RESPONSE_DONE, input.session_id, input.turn_id, input.trace_id, input.request_id, {"message_id": new_id("msg_")})
        except httpx.HTTPStatusError as exc:
            provider_error = self._provider_error(exc.response)
            LOGGER.warning(
                "LLM provider rejected request: status=%s type=%s code=%s",
                exc.response.status_code,
                provider_error["type"],
                provider_error["code"],
            )
            if self._is_content_policy_rejection(exc.response, provider_error):
                local_summary = self._local_summary(input)
                if local_summary:
                    yield CoreEvent(
                        CoreEventType.RESPONSE_DELTA,
                        input.session_id,
                        input.turn_id,
                        input.trace_id,
                        input.request_id,
                        {"text": local_summary},
                    )
                    yield CoreEvent(
                        CoreEventType.RESPONSE_DONE,
                        input.session_id,
                        input.turn_id,
                        input.trace_id,
                        input.request_id,
                        {"message_id": new_id("msg_"), "fallback": "local_page_summary"},
                    )
                    return
                yield self._error(input, "provider_content_policy_rejected", "当前内容被模型服务的内容策略拒绝，请调整问题后重试。")
                return
            yield self._error(input, "provider_call_failed", "模型服务暂时无法完成请求，请稍后重试或在 Settings 中测试连接。")
        except Exception as exc:
            LOGGER.warning("LLM provider call failed: %s", type(exc).__name__)
            yield self._error(input, "provider_call_failed", "模型服务暂时无法完成请求，请稍后重试或在 Settings 中测试连接。")

    def _messages(self, input: CoreTurnInput) -> list[dict[str, str]]:
        messages = [{"role": "system", "content": CHAT_PROFILE_SYSTEM_PROMPT}]
        if input.active_page:
            messages.append({"role": "system", "content": f"PAGE_CONTEXT:\n{build_page_context_prompt(input.active_page)}"})
        messages.append({"role": "user", "content": input.user_message})
        return messages

    def _request_payload(self, input: CoreTurnInput, *, model: str, base_url: str) -> dict[str, object]:
        payload: dict[str, object] = {"model": model, "messages": self._messages(input), "stream": True}
        if "minimax" in base_url.lower():
            payload["thinking"] = {"type": "disabled"}
        return payload

    def _delta_text(self, payload: str) -> str:
        try:
            data = json.loads(payload)
        except json.JSONDecodeError:
            return ""
        text = data.get("choices", [{}])[0].get("delta", {}).get("content")
        return text if isinstance(text, str) else ""

    def _provider_error(self, response: httpx.Response) -> dict[str, str]:
        try:
            payload = response.json()
        except (json.JSONDecodeError, ValueError):
            return {"type": "unknown", "code": str(response.status_code), "message": ""}
        error = payload.get("error") if isinstance(payload, dict) else None
        if not isinstance(error, dict):
            return {"type": "unknown", "code": str(response.status_code), "message": ""}
        return {
            "type": str(error.get("type") or "unknown"),
            "code": str(error.get("code") or error.get("http_code") or response.status_code),
            "message": str(error.get("message") or ""),
        }

    def _is_content_policy_rejection(self, response: httpx.Response, error: dict[str, str]) -> bool:
        signal = " ".join(error.values()).lower()
        return response.status_code in {400, 422} and any(
            marker in signal for marker in ("sensitive", "content policy", "moderation", "new_sensitive")
        )

    def _local_summary(self, input: CoreTurnInput) -> str | None:
        if not input.active_page or not any(marker in input.user_message.lower() for marker in ("总结", "summary", "summarize")):
            return None
        page = dict(input.active_page)
        page["page_id"] = page.get("page_id") or page.get("pageId") or new_id("page_")
        page["cleaned_text"] = page.get("cleaned_text") or page.get("cleanedText") or ""
        try:
            result = summarize_page(
                {
                    "active_page": page,
                    "session_id": input.session_id,
                    "turn_id": input.turn_id,
                    "tool_call_id": new_id("toolcall_"),
                }
            )
        except (KeyError, TypeError, ValueError):
            return None
        content = result.get("content") if isinstance(result, dict) else None
        summary = content.get("summary") if isinstance(content, dict) else None
        if not isinstance(summary, str) or not summary.strip():
            return None
        return f"> 云端模型因内容策略未处理此页面，以下为 Navia 本地页面摘要。\n\n{summary.strip()}"

    def _error(self, input: CoreTurnInput, code: str, message: str) -> CoreEvent:
        return CoreEvent(
            CoreEventType.ERROR,
            input.session_id,
            input.turn_id,
            input.trace_id,
            input.request_id,
            {"code": code or ErrorCode.MODEL_UNAVAILABLE.value, "message": message, "recoverable": True},
        )
