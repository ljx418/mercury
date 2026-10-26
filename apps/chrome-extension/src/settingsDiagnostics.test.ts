import { describe, expect, it } from "vitest";
import type { AgentEvent } from "./sse";
import { createChatProviderTestCollector, isBoundaryOrDeferredText } from "./settingsDiagnostics";

function event(type: string, data: Record<string, unknown> = {}): AgentEvent {
  return {
    event_id: `evt_${type}`,
    session_id: "sess_test",
    turn_id: "turn_test",
    type,
    data
  };
}

describe("Chat Provider settings diagnostics", () => {
  it("classifies any non-empty normal text plus done as ok", () => {
    const collector = createChatProviderTestCollector();
    collector.accept(event("response.delta", { text: "普通文本回复，不一定是 pong。" }));
    collector.accept(event("response.done"));

    const result = collector.finalize();

    expect(result.status).toBe("ok");
    expect(result.receivedText).toContain("普通文本回复");
  });

  it("classifies unexpected tool requests as tool_boundary", () => {
    const collector = createChatProviderTestCollector();
    const status = collector.accept(event("intent.detected", { core_event_type: "tool.requested" }));
    const result = collector.finalize();

    expect(status).toBe("tool_boundary");
    expect(result.status).toBe("tool_boundary");
    expect(result.message).toBe("Chat Provider 测试未通过：PiAgent 触发了当前 Chat 模式未开放的工具请求。");
  });

  it("classifies direct tool.requested events as tool_boundary", () => {
    const collector = createChatProviderTestCollector();
    const status = collector.accept(event("tool.requested", { tool_name: "web.search" }));

    expect(status).toBe("tool_boundary");
    expect(collector.finalize().status).toBe("tool_boundary");
  });

  it("classifies tool.denied as tool_boundary", () => {
    const collector = createChatProviderTestCollector();
    const status = collector.accept(event("tool.denied", { message: "工具调用暂未开放" }));

    expect(status).toBe("tool_boundary");
    expect(collector.finalize().status).toBe("tool_boundary");
  });

  it("rejects deferred or boundary text as invalid_response", () => {
    const collector = createChatProviderTestCollector();
    collector.accept(event("response.delta", { text: "这个能力会在后续版本开放。当前我可以先帮你做页面总结。" }));
    collector.accept(event("response.done"));

    expect(isBoundaryOrDeferredText("当前是 Chat 模式，不会调用工具。")).toBe(true);
    expect(collector.finalize().status).toBe("invalid_response");
  });

  it("classifies runtime errors as provider_error and preserves code and recoverable", () => {
    const collector = createChatProviderTestCollector();
    const status = collector.accept(event("error", { message: "provider failed", code: "provider_failed", recoverable: true }));
    const result = collector.finalize();

    expect(status).toBe("provider_error");
    expect(result.status).toBe("provider_error");
    expect(result.errorCode).toBe("provider_failed");
    expect(result.recoverable).toBe(true);
    expect(result.rawEvent?.type).toBe("error");
  });

  it("classifies pi rpc no-text errors distinctly", () => {
    const collector = createChatProviderTestCollector();
    const status = collector.accept(event("error", { message: "done without text", code: "pi_rpc_no_text", recoverable: true }));
    const result = collector.finalize();

    expect(status).toBe("pi_rpc_no_text");
    expect(result.status).toBe("pi_rpc_no_text");
    expect(result.message).toContain("pi RPC 协议");
  });

  it("classifies normalizer no-delta errors distinctly", () => {
    const collector = createChatProviderTestCollector();
    const status = collector.accept(event("error", { message: "text exists but no delta", code: "pi_normalizer_no_delta", recoverable: true }));
    const result = collector.finalize();

    expect(status).toBe("pi_normalizer_no_delta");
    expect(result.status).toBe("pi_normalizer_no_delta");
    expect(result.message).toContain("normalizer");
  });

  it("classifies provider auth failures distinctly", () => {
    const collector = createChatProviderTestCollector();
    const status = collector.accept(event("error", { message: "auth failed", code: "provider_auth_failed", recoverable: true }));
    const result = collector.finalize();

    expect(status).toBe("provider_auth_failed");
    expect(result.status).toBe("provider_auth_failed");
    expect(result.message).toContain("API Key");
  });

  it("classifies missing piagent provider config distinctly", () => {
    const collector = createChatProviderTestCollector();
    const status = collector.accept(event("error", { message: "missing config", code: "piagent_provider_config_missing", recoverable: true }));
    const result = collector.finalize();

    expect(status).toBe("piagent_provider_config_missing");
    expect(result.status).toBe("piagent_provider_config_missing");
    expect(result.message).toContain("模型服务配置");
  });

  it("classifies done without text as invalid_response", () => {
    const collector = createChatProviderTestCollector();
    collector.accept(event("response.done"));

    const result = collector.finalize();

    expect(result.status).toBe("invalid_response");
    expect(result.message).toContain("PiAgent 已结束但未返回普通文本");
  });

  it("classifies timeout without done as invalid_response", () => {
    const collector = createChatProviderTestCollector();
    collector.accept(event("response.delta", { text: "partial" }));

    const result = collector.finalize("timeout");

    expect(result.status).toBe("invalid_response");
    expect(result.message).toContain("超时");
  });
});
