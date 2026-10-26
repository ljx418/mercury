import type { AgentEvent } from "../../sse";
import type { ArtifactRecord } from "../../runtimeClient";
import {
  AGENT_TOOL_DENIED_MESSAGE,
  CHAT_TOOL_DENIED_MESSAGE,
  DEFAULT_DEFERRED_MESSAGE,
  type ChatMessageView,
  type ChatProfile,
  type ChatViewAction,
  type ChatViewState,
  type DebugWarning,
  type InlineStatus
} from "./chatViewTypes";

const TECHNICAL_TERMS = [
  "PiAgentCoreProvider",
  "CoreEvent",
  "sidecar",
  "toolNames",
  "raw event",
  "agent loop",
  "coding agent",
  "code task",
  "这是代码任务",
  "这不是代码任务",
  "我在编程项目中工作",
  "我可以帮你写数据抓取代码",
  "让我看看当前目录",
  "当前正在 pi-agent-bridge 模块中工作"
];

export function createChatViewState(profile: ChatProfile = "chat"): ChatViewState {
  return {
    profile,
    messages: [],
    artifacts: [],
    debugEvents: [],
    debugWarnings: []
  };
}

export function chatViewReducer(state: ChatViewState, action: ChatViewAction): ChatViewState {
  switch (action.type) {
    case "set_profile":
      return { ...state, profile: action.profile };
    case "reset":
      return createChatViewState(state.profile);
    case "restore_messages":
      return restoreMessages(state, action.messages);
    case "system_message":
      return {
        ...state,
        messages: [
          ...state.messages,
          {
            id: createId("sys"),
            turnId: action.turnId,
            role: "system",
            kind: action.kind,
            text: sanitizeUserText(action.text),
            createdAt: action.createdAt ?? now()
          }
        ]
      };
    case "start_turn":
      return startTurn(state, action);
    case "agent_event":
      return applyAgentEvent(state, action.event);
    default:
      return state;
  }
}

function restoreMessages(
  state: ChatViewState,
  messages: Array<{ id: string; role: string; text: string; turnId?: string; artifact?: ArtifactRecord; artifacts?: ArtifactRecord[] }>
): ChatViewState {
  const restored = messages.map((message): ChatMessageView => {
    const artifacts = message.artifacts ?? (message.artifact ? [message.artifact] : []);
    if (message.role === "assistant") {
      return {
        id: message.id,
        turnId: message.turnId ?? createId("turn"),
        role: "assistant",
        text: sanitizeUserText(message.text),
        status: "done",
        createdAt: now(),
        artifacts
      };
    }
    if (message.role === "user") {
      return {
        id: message.id,
        turnId: message.turnId ?? createId("turn"),
        role: "user",
        text: sanitizeUserText(message.text),
        createdAt: now()
      };
    }
    return {
      id: message.id,
      turnId: message.turnId,
      role: "system",
      kind: "status",
      text: sanitizeUserText(message.text),
      createdAt: now()
    };
  });
  return {
    ...state,
    messages: restored,
    currentTurnId: undefined,
    currentAssistantMessageId: undefined,
    activeStatus: undefined,
    artifacts: restored.flatMap((message) => (message.role === "assistant" ? message.artifacts : []))
  };
}

function startTurn(state: ChatViewState, action: Extract<ChatViewAction, { type: "start_turn" }>): ChatViewState {
  const createdAt = action.createdAt ?? now();
  const userMessage: ChatMessageView = {
    id: createId("msg"),
    turnId: action.turnId,
    role: "user",
    text: sanitizeUserText(action.text),
    intentHint: action.intentHint,
    createdAt
  };
  const assistantMessage: ChatMessageView = {
    id: createId("msg"),
    turnId: action.turnId,
    role: "assistant",
    text: "",
    status: "streaming",
    createdAt,
    artifacts: []
  };
  return {
    ...state,
    messages: [...state.messages, userMessage, assistantMessage],
    currentTurnId: action.turnId,
    currentAssistantMessageId: assistantMessage.id,
    activeStatus: undefined,
    deferredNotice: undefined
  };
}

function applyAgentEvent(state: ChatViewState, event: AgentEvent): ChatViewState {
  const withDebug = { ...state, debugEvents: [...state.debugEvents, event] };
  switch (event.type) {
    case "response.delta":
      return applyDelta(withDebug, event);
    case "response.done":
      return applyDone(withDebug, event);
    case "artifact.created":
      return applyArtifact(withDebug, event);
    case "error":
      return applyError(withDebug, event);
    case "tool.denied":
      return applyToolDenied(withDebug, event);
    case "state.transition":
      return applyStateTransition(withDebug, event);
    case "intent.detected":
      return applyIntentDetected(withDebug, event);
    case "tool.started":
    case "tool.done":
    case "budget.checked":
      return withDebug;
    default:
      return addDebugWarning(withDebug, "Unknown AgentEvent ignored by ChatViewReducer.", event);
  }
}

function applyDelta(state: ChatViewState, event: AgentEvent): ChatViewState {
  const resolved = resolveTurn(state, event, "response.delta");
  const text = sanitizeUserText(readText(event.data, "text"));
  let next = resolved.state;
  if (!resolved.turnId) {
    const turnId = createId("orphan_turn");
    next = addDebugWarning(next, "Orphan response.delta without turn_id created an assistant message.", event);
    return appendAssistantText(ensureAssistantMessage(next, turnId), turnId, text, { closeStatus: true });
  }
  next = maybeRekeyActiveTurn(next, resolved.turnId);
  return appendAssistantText(ensureAssistantMessage(next, resolved.turnId), resolved.turnId, text, { closeStatus: true });
}

function applyDone(state: ChatViewState, event: AgentEvent): ChatViewState {
  const resolved = resolveTurn(state, event, "response.done");
  if (!resolved.turnId) return addDebugWarning(resolved.state, "Orphan response.done without turn_id ignored.", event);
  const next = maybeRekeyActiveTurn(resolved.state, resolved.turnId);
  return {
    ...next,
    messages: next.messages.map((message) =>
      message.role === "assistant" && message.turnId === resolved.turnId ? { ...message, status: "done" } : message
    ),
    currentTurnId: next.currentTurnId === resolved.turnId ? undefined : next.currentTurnId,
    currentAssistantMessageId:
      next.currentTurnId === resolved.turnId || next.currentAssistantMessageId === assistantIdForTurn(next, resolved.turnId)
        ? undefined
        : next.currentAssistantMessageId,
    activeStatus: next.activeStatus?.turnId === resolved.turnId ? undefined : next.activeStatus
  };
}

function applyArtifact(state: ChatViewState, event: AgentEvent): ChatViewState {
  const artifact = readArtifact(event.data);
  const resolved = resolveTurn(state, event, "artifact.created");
  let next = resolved.state;
  if (!resolved.turnId) {
    const turnId = createId("orphan_turn");
    next = addDebugWarning(next, "Orphan artifact.created without turn_id created an assistant shell message.", event);
    return attachArtifact(ensureAssistantMessage(next, turnId), turnId, artifact);
  }
  next = maybeRekeyActiveTurn(next, resolved.turnId);
  return attachArtifact(ensureAssistantMessage(next, resolved.turnId), resolved.turnId, artifact);
}

function applyError(state: ChatViewState, event: AgentEvent): ChatViewState {
  const resolved = resolveTurn(state, event, "error");
  const text = sanitizeUserText(readText(event.data, "message") || readText(event.data, "code") || "Runtime error");
  if (!resolved.turnId) {
    return {
      ...addDebugWarning(resolved.state, "Orphan error without turn_id added as system error.", event),
      messages: [
        ...resolved.state.messages,
        { id: createId("sys"), role: "system", kind: "error", text, createdAt: now() }
      ]
    };
  }
  const next = appendAssistantText(ensureAssistantMessage(resolved.state, resolved.turnId), resolved.turnId, `\n${text}`, {
    status: "error",
    closeStatus: true
  });
  return {
    ...next,
    currentTurnId: next.currentTurnId === resolved.turnId ? undefined : next.currentTurnId,
    currentAssistantMessageId: next.currentTurnId === resolved.turnId ? undefined : next.currentAssistantMessageId,
    activeStatus: next.activeStatus?.turnId === resolved.turnId ? undefined : next.activeStatus
  };
}

function applyToolDenied(state: ChatViewState, event: AgentEvent): ChatViewState {
  const resolved = resolveTurn(state, event, "tool.denied");
  const message = state.profile === "agent" ? AGENT_TOOL_DENIED_MESSAGE : CHAT_TOOL_DENIED_MESSAGE;
  const turnId = resolved.turnId ?? createId("orphan_turn");
  const next = resolved.turnId ? resolved.state : addDebugWarning(resolved.state, "Orphan tool.denied without turn_id created a deferred notice.", event);
  return {
    ...appendAssistantText(ensureAssistantMessage(next, turnId), turnId, message, { closeStatus: true }),
    deferredNotice: {
      intent: "unexpected_tool_request",
      profile: state.profile,
      message,
      turnId
    }
  };
}

function applyStateTransition(state: ChatViewState, event: AgentEvent): ChatViewState {
  const resolved = resolveTurn(state, event, "state.transition");
  if (!resolved.turnId) return addDebugWarning(resolved.state, "Orphan state.transition without turn_id ignored in normal UI.", event);
  const target = readText(event.data, "to") || readText(event.data, "state");
  const text = statusText(target);
  if (!text) return resolved.state;
  return {
    ...maybeRekeyActiveTurn(resolved.state, resolved.turnId),
    activeStatus: {
      turnId: resolved.turnId,
      text,
      state: target,
      status: "active"
    }
  };
}

function applyIntentDetected(state: ChatViewState, event: AgentEvent): ChatViewState {
  const status = readText(event.data, "status");
  if (status !== "deferred") return state;
  const intent = readText(event.data, "adapter_id") || readText(event.data, "intent") || "deferred";
  const turnId = event.turn_id ?? state.currentTurnId;
  return {
    ...state,
    deferredNotice: {
      intent,
      profile: state.profile,
      message: DEFAULT_DEFERRED_MESSAGE,
      turnId
    }
  };
}

function resolveTurn(
  state: ChatViewState,
  event: AgentEvent,
  eventType: string
): { state: ChatViewState; turnId?: string } {
  if (event.turn_id) return { state, turnId: event.turn_id };
  if (state.currentTurnId) return { state, turnId: state.currentTurnId };
  return { state: addDebugWarning(state, `${eventType} arrived without turn_id and no active turn.`, event), turnId: undefined };
}

function maybeRekeyActiveTurn(state: ChatViewState, eventTurnId: string): ChatViewState {
  if (!state.currentTurnId || state.currentTurnId === eventTurnId) return state;
  const activeAssistant = state.messages.find(
    (message) => message.role === "assistant" && message.turnId === state.currentTurnId && message.id === state.currentAssistantMessageId
  );
  if (!activeAssistant || activeAssistant.role !== "assistant" || activeAssistant.text || activeAssistant.artifacts.length > 0 || activeAssistant.status !== "streaming") return state;
  return {
    ...state,
    currentTurnId: eventTurnId,
    messages: state.messages.map((message) =>
      message.turnId === state.currentTurnId ? { ...message, turnId: eventTurnId } : message
    ),
    activeStatus: state.activeStatus?.turnId === state.currentTurnId ? { ...state.activeStatus, turnId: eventTurnId } : state.activeStatus
  };
}

function ensureAssistantMessage(state: ChatViewState, turnId: string): ChatViewState {
  const existing = state.messages.find((message) => message.role === "assistant" && message.turnId === turnId);
  if (existing) {
    return { ...state, currentAssistantMessageId: state.currentTurnId === turnId ? existing.id : state.currentAssistantMessageId };
  }
  const assistantMessage: ChatMessageView = {
    id: createId("msg"),
    turnId,
    role: "assistant",
    text: "",
    status: "streaming",
    createdAt: now(),
    artifacts: []
  };
  return {
    ...state,
    messages: [...state.messages, assistantMessage],
    currentAssistantMessageId: state.currentTurnId === turnId ? assistantMessage.id : state.currentAssistantMessageId
  };
}

function appendAssistantText(
  state: ChatViewState,
  turnId: string,
  text: string,
  options: { status?: "streaming" | "done" | "error"; closeStatus?: boolean } = {}
): ChatViewState {
  return {
    ...state,
    messages: state.messages.map((message) =>
      message.role === "assistant" && message.turnId === turnId
        ? { ...message, text: appendConservativeDelta(message.text, text), status: options.status ?? message.status }
        : message
    ),
    activeStatus: options.closeStatus && state.activeStatus?.turnId === turnId ? undefined : state.activeStatus
  };
}

function appendConservativeDelta(current: string, incoming: string): string {
  if (!incoming) return current;
  if (incoming.startsWith(current)) return `${current}${incoming.slice(current.length)}`;
  if (current.endsWith(incoming)) return current;
  return `${current}${incoming}`;
}

function attachArtifact(state: ChatViewState, turnId: string, artifact: ArtifactRecord | null): ChatViewState {
  if (!artifact) return addDebugWarning(state, "artifact.created event missing artifact payload.");
  const alreadyKnown = state.artifacts.some((item) => item.artifactId === artifact.artifactId);
  return {
    ...state,
    messages: state.messages.map((message) => {
      if (message.role !== "assistant" || message.turnId !== turnId) return message;
      if (message.artifacts.some((item) => item.artifactId === artifact.artifactId)) return message;
      return { ...message, artifacts: [...message.artifacts, artifact] };
    }),
    artifacts: alreadyKnown ? state.artifacts : [...state.artifacts, artifact],
    activeStatus: state.activeStatus?.turnId === turnId ? undefined : state.activeStatus
  };
}

function addDebugWarning(state: ChatViewState, message: string, event?: AgentEvent): ChatViewState {
  const warning: DebugWarning = { id: createId("warn"), message, event, createdAt: now() };
  return { ...state, debugWarnings: [...state.debugWarnings, warning] };
}

function assistantIdForTurn(state: ChatViewState, turnId: string): string | undefined {
  return state.messages.find((message) => message.role === "assistant" && message.turnId === turnId)?.id;
}

function statusText(state: string): string | null {
  if (state === "intent_detecting") return "正在理解你的问题……";
  if (state === "context_strategy_deciding") return "正在准备回答……";
  if (state === "context_resolving") return "正在读取当前页面……";
  if (state === "executing_chat") return "已连接模型，等待首个回答片段……";
  if (state === "streaming_response") return "正在生成回答……";
  if (state === "artifact_rendering") return "正在生成结果……";
  return null;
}

function readArtifact(data: Record<string, unknown> | undefined): ArtifactRecord | null {
  const artifact = data?.artifact;
  if (typeof artifact === "object" && artifact !== null && !Array.isArray(artifact)) return artifact as ArtifactRecord;
  return null;
}

function readText(data: Record<string, unknown> | undefined, key: string): string {
  const value = data?.[key];
  return typeof value === "string" ? value : "";
}

function sanitizeUserText(value: string): string {
  let next = value;
  for (const term of TECHNICAL_TERMS) {
    next = next.replaceAll(term, "");
  }
  return next;
}

function now(): string {
  return new Date().toISOString();
}

function createId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
}
