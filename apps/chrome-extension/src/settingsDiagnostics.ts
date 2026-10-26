import type { AgentEvent } from "./sse";

export type ChatProviderTestStatus =
  | "pending"
  | "ok"
  | "provider_error"
  | "tool_boundary"
  | "invalid_response"
  | "pi_rpc_no_text"
  | "pi_normalizer_no_delta"
  | "provider_auth_failed"
  | "piagent_provider_config_missing"
  | "piagent_sidecar_unavailable"
  | "llm_provider_missing"
  | "llm_model_invalid";

export type ChatProviderTestResult = {
  status: Exclude<ChatProviderTestStatus, "pending">;
  receivedText: string;
  message: string;
  errorCode?: string;
  recoverable?: boolean;
  rawEvent?: AgentEvent;
};

type ChatProviderTestDraft = {
  receivedText: string;
  sawDone: boolean;
  errorEvent?: AgentEvent;
  toolBoundaryEvent?: AgentEvent;
};

export type ChatProviderTestCollector = {
  accept(event: AgentEvent): ChatProviderTestStatus;
  finalize(reason?: "complete" | "timeout"): ChatProviderTestResult;
};

const BOUNDARY_PATTERNS = [
  /后续版本开放/,
  /当前是\s*Chat\s*模式，不会调用工具/i,
  /当前\s*Agent\s*模式暂未开放工具调用/i,
  /工具调用暂未开放/,
  /tool\s+disabled/i,
  /default\s+disabled/i
];

export function isBoundaryOrDeferredText(text: string): boolean {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return false;
  return BOUNDARY_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function createChatProviderTestCollector(): ChatProviderTestCollector {
  const draft: ChatProviderTestDraft = {
    receivedText: "",
    sawDone: false
  };

  return {
    accept(event) {
      if (isToolBoundaryEvent(event)) {
        draft.toolBoundaryEvent = event;
        return "tool_boundary";
      }
      if (event.type === "error") {
        draft.errorEvent = event;
        return classifyRuntimeErrorStatus(event);
      }
      if (event.type === "response.delta" && typeof event.data.text === "string") {
        draft.receivedText += event.data.text;
      }
      if (event.type === "response.done") {
        draft.sawDone = true;
      }
      return "pending";
    },
    finalize(reason = "complete") {
      return classifyChatProviderTest(draft, reason);
    }
  };
}

function classifyChatProviderTest(draft: ChatProviderTestDraft, reason: "complete" | "timeout"): ChatProviderTestResult {
  const receivedText = draft.receivedText.trim();
  if (draft.toolBoundaryEvent) {
    return {
      status: "tool_boundary",
      receivedText,
      message: "Chat Provider 测试未通过：PiAgent 触发了当前 Chat 模式未开放的工具请求。",
      rawEvent: draft.toolBoundaryEvent
    };
  }
  if (draft.errorEvent) {
    const status = classifyRuntimeErrorStatus(draft.errorEvent);
    return {
      status,
      receivedText,
      message: runtimeErrorMessage(status, draft.errorEvent),
      errorCode: typeof draft.errorEvent.data.code === "string" ? draft.errorEvent.data.code : undefined,
      recoverable: typeof draft.errorEvent.data.recoverable === "boolean" ? draft.errorEvent.data.recoverable : undefined,
      rawEvent: draft.errorEvent
    };
  }
  if (reason === "timeout") {
    return {
      status: "invalid_response",
      receivedText,
      message: "Chat Provider 测试超时：未在限定时间内收到完整响应。"
    };
  }
  if (!draft.sawDone) {
    return {
      status: "invalid_response",
      receivedText,
      message: "Chat Provider 测试未收到完整结束事件。"
    };
  }
  if (!receivedText) {
    return {
      status: "invalid_response",
      receivedText,
      message: "PiAgent 已结束但未返回普通文本，请检查 pi RPC 输出格式。"
    };
  }
  if (isBoundaryOrDeferredText(receivedText)) {
    return {
      status: "invalid_response",
      receivedText,
      message: "Chat Provider 测试未通过：返回内容是能力边界提示，不是普通文本回复。"
    };
  }
  return {
    status: "ok",
    receivedText,
    message: `Chat Provider 测试通过：${receivedText.slice(0, 80)}`
  };
}

function classifyRuntimeErrorStatus(event: AgentEvent): Exclude<ChatProviderTestStatus, "pending" | "ok" | "tool_boundary" | "invalid_response"> {
  const code = typeof event.data.code === "string" ? event.data.code : "";
  if (code === "pi_rpc_no_text") return "pi_rpc_no_text";
  if (code === "pi_normalizer_no_delta") return "pi_normalizer_no_delta";
  if (code === "provider_auth_failed") return "provider_auth_failed";
  if (code === "piagent_provider_config_missing") return "piagent_provider_config_missing";
  if (code === "piagent_sidecar_unavailable" || code === "piagent_unavailable") return "piagent_sidecar_unavailable";
  if (code === "llm_provider_missing" || code === "provider_missing") return "llm_provider_missing";
  if (code === "llm_model_invalid" || code === "model_invalid") return "llm_model_invalid";
  return "provider_error";
}

function runtimeErrorMessage(status: ChatProviderTestStatus, event: AgentEvent): string {
  if (status === "pi_rpc_no_text") return "Chat Provider 测试未通过：PiAgent raw 输出没有普通文本，请检查 pi RPC 协议是否兼容。";
  if (status === "pi_normalizer_no_delta") return "Chat Provider 测试未通过：PiAgent raw event 疑似包含文本，但 normalizer 没有转换出普通文本 delta。";
  if (status === "provider_auth_failed") return "Chat Provider 测试未通过：模型服务鉴权失败，请检查 API Key。";
  if (status === "piagent_provider_config_missing") return "Chat Provider 测试未通过：PiAgent 没有收到完整的模型服务配置。";
  if (status === "piagent_sidecar_unavailable") return "Chat Provider 测试未通过：Pi Sidecar 未启动或暂不可用。请启动 Pi Sidecar，或在 Settings 中手动切换到 LLM Direct。";
  if (status === "llm_provider_missing") return "Chat Provider 测试未通过：尚未选择模型服务。请保存 Provider / model，或手动切换到 LLM Direct。";
  if (status === "llm_model_invalid") return "Chat Provider 测试未通过：当前模型不存在或不属于所选 Provider，请检查 model。";
  return String(event.data.message ?? "Chat Provider 测试失败。");
}

function isToolBoundaryEvent(event: AgentEvent): boolean {
  if (event.type === "tool.requested") return true;
  if (event.type === "tool.denied") return true;
  if (event.type !== "intent.detected") return false;
  return event.data.core_event_type === "tool.requested";
}
