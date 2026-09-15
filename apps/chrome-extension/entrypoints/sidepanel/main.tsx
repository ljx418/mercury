import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";
import type { ExtractedPageContext } from "../../src/pageContext";
import type { AgentEvent } from "../../src/sse";
import { AssistantMessage } from "../../src/modules/chat_renderer/AssistantMessage";
import { DeferredCapabilityNotice } from "../../src/modules/chat_renderer/DeferredCapabilityNotice";
import { InlineStatusRow } from "../../src/modules/chat_renderer/InlineStatusRow";
import { UserMessage } from "../../src/modules/chat_renderer/UserMessage";
import { chatViewReducer, createChatViewState } from "../../src/modules/chat_renderer/chatViewReducer";
import type { ChatMessageView } from "../../src/modules/chat_renderer/chatViewTypes";
import { canSubmitChatInput, shouldSubmitOnKeyDown } from "../../src/chatInputShortcuts";
import { createChatProviderTestCollector, type ChatProviderTestStatus } from "../../src/settingsDiagnostics";
import { chatStreamOptions, resolveChatProviderDraft } from "../../src/chatProviderSelection";
import { TurnNavigatorView } from "../../src/TurnNavigatorView";
import { KnowledgeQuickSurface, type QuickWorkspaceRequest } from "../../src/modules/knowledge_workspace/KnowledgeQuickSurface";
import { LocalRuntimeAccess, type LocalRuntimeAccessChange } from "../../src/modules/knowledge_workspace/LocalRuntimeAccess";
import { SaveToKnowledgeCard } from "../../src/modules/knowledge_workspace/SaveToKnowledgeCard";
import {
  getHistorySessions,
  getSessionDisplayTitle,
  shouldReuseActiveSessionForNewChat
} from "../../src/sessionHistory";
import { SessionHistoryOverlay } from "../../src/sessionHistoryOverlay";
import { deriveConversationTurns, groupMessagesByTurn, shouldShowTurnNavigator } from "../../src/turnNavigator";
import {
  checkRuntimeHealth,
  checkPiSidecarHealth,
  createKnowledgeStatusPoller,
  askKnowledgeSources,
  createChatSession,
  deleteProvider,
  forgetKnowledgeSource,
  getKnowledgeServiceStatus,
  getKnowledgeGraph,
  getKnowledgeSource,
  getChatSessionMessages,
  getLastSessionId,
  getSettings,
  grantKnowledgePermission,
  importProvider,
  isForgetSourceVerified,
  isRuntimeRequestError,
  isStaleRuntimeRequestError,
  listChatSessions,
  listKnowledgeSources,
  listKnowledgeWorkspaces,
  patchSettings,
  revokeKnowledgePermission,
  restoreChatSessionMessages,
  saveCurrentPageToKnowledge,
  streamRuntimeChat,
  submitRuntimePageContext,
  testProvider,
  type ChatSession,
  type ChatIntent,
  type ChatProviderConfig,
  type CoreProviderId,
  type KnowledgeOperation,
  type KnowledgeGraph,
  type KnowledgeQueryResult,
  type KnowledgeWorkspace,
  type KnowledgeServiceStatus,
  type KnowledgeSource,
  type PermissionRoot,
  type ForgetSourceResult,
  type LLMProviderConfig,
  type MercurySettings,
  type PiSidecarHealth,
  type ProviderTestResult,
  type RuntimeStatus
} from "../../src/runtimeClient";

declare const __NAVIA_E2E_BRIDGE__: boolean;

type SideView = "chat" | "knowledge" | "agent" | "debug" | "settings";
type ModeState = "chat" | "agent_checking" | "agent_ready" | "agent_unavailable";
type PageContextState = "unknown" | "capture_ready" | "capturing" | "captured" | "stale" | "unsupported" | "failed";
type ChatTurnState =
  | "idle"
  | "user_submitted"
  | "intent_detecting"
  | "context_strategy_deciding"
  | "context_resolving"
  | "capability_boundary"
  | "executing_chat"
  | "streaming_response"
  | "artifact_rendering"
  | "done"
  | "error";
type SessionState = {
  currentSessionId?: string;
  sessions: ChatSession[];
  loadingSessions: boolean;
  creatingSession: boolean;
  switchingSession: boolean;
};
const DEFAULT_DEEPSEEK_MODELS = ["deepseek-v4-flash", "deepseek-v4-pro", "deepseek-chat", "deepseek-reasoner"];
const CORE_PROVIDERS: CoreProviderId[] = ["piagent", "llm_direct", "mock"];
const CHAT_PROVIDER_TEST_PROMPT = "请只用普通文本回复 pong，不调用任何工具。";
const CHAT_PROVIDER_TEST_TIMEOUT_MS = 20_000;

function App() {
  const [runtimeStatus, setRuntimeStatus] = useState<RuntimeStatus>("checking");
  const [sessionState, setSessionState] = useState<SessionState>({
    sessions: [],
    loadingSessions: false,
    creatingSession: false,
    switchingSession: false
  });
  const [sessionMenuOpen, setSessionMenuOpen] = useState(false);
  const [sessionSwitchError, setSessionSwitchError] = useState<string | null>(null);
  const [pageContext, setPageContext] = useState<ExtractedPageContext | null>(null);
  const [pageContextState, setPageContextState] = useState<PageContextState>("unknown");
  const [knowledgeStatus, setKnowledgeStatus] = useState<KnowledgeServiceStatus | null>(null);
  const [knowledgeStatusLoading, setKnowledgeStatusLoading] = useState(false);
  const [knowledgeStatusError, setKnowledgeStatusError] = useState<string | null>(null);
  const [knowledgeSource, setKnowledgeSource] = useState<KnowledgeSource | null>(null);
  const [knowledgeOperation, setKnowledgeOperation] = useState<KnowledgeOperation | null>(null);
  const [knowledgeSaving, setKnowledgeSaving] = useState(false);
  const [knowledgeSaveError, setKnowledgeSaveError] = useState<string | null>(null);
  const [knowledgeWorkspaces, setKnowledgeWorkspaces] = useState<KnowledgeWorkspace[]>([]);
  const [knowledgeSources, setKnowledgeSources] = useState<KnowledgeSource[]>([]);
  const [selectedKnowledgeWorkspaceId, setSelectedKnowledgeWorkspaceId] = useState("ws_default");
  const [selectedKnowledgeSource, setSelectedKnowledgeSource] = useState<KnowledgeSource | null>(null);
  const [knowledgeWorkspaceLoading, setKnowledgeWorkspaceLoading] = useState(false);
  const [knowledgeWorkspaceError, setKnowledgeWorkspaceError] = useState<string | null>(null);
  const [knowledgeAskQuestion, setKnowledgeAskQuestion] = useState("");
  const [knowledgeAskLoading, setKnowledgeAskLoading] = useState(false);
  const [knowledgeAskError, setKnowledgeAskError] = useState<string | null>(null);
  const [knowledgeQueryResult, setKnowledgeQueryResult] = useState<KnowledgeQueryResult | null>(null);
  const [knowledgeGraph, setKnowledgeGraph] = useState<KnowledgeGraph | null>(null);
  const [knowledgePermissions, setKnowledgePermissions] = useState<PermissionRoot[]>([]);
  const [permissionName, setPermissionName] = useState("");
  const [permissionPath, setPermissionPath] = useState("");
  const [governanceLoading, setGovernanceLoading] = useState(false);
  const [governanceError, setGovernanceError] = useState<string | null>(null);
  const [forgetResult, setForgetResult] = useState<ForgetSourceResult | null>(null);
  const [chatTurnState, setChatTurnState] = useState<ChatTurnState>("idle");
  const [pageSubmitted, setPageSubmitted] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<string>("未提交页面上下文");
  const [modeState, setModeState] = useState<ModeState>("chat");
  const [input, setInput] = useState("");
  const [settings, setSettings] = useState<MercurySettings | null>(null);
  const [settingsStatus, setSettingsStatus] = useState<"idle" | "loading" | "saving" | "testing" | "error">("idle");
  const [settingsMessage, setSettingsMessage] = useState("尚未加载设置。");
  const [settingsDiagnosticEvent, setSettingsDiagnosticEvent] = useState<AgentEvent | null>(null);
  const [sidecarHealth, setSidecarHealth] = useState<PiSidecarHealth | null>(null);
  const [providerTestResult, setProviderTestResult] = useState<ProviderTestResult | null>(null);
  const [providerDraft, setProviderDraft] = useState({
    displayName: "DeepSeek",
    baseUrl: "https://api.deepseek.com",
    apiKey: "",
    defaultModel: "deepseek-v4-flash"
  });
  const [chatProviderDraft, setChatProviderDraft] = useState<ChatProviderConfig>({
    coreProvider: "piagent",
    llmProviderId: undefined,
    model: "deepseek-v4-flash"
  });
  const [chatView, dispatchChatView] = useReducer(chatViewReducer, undefined, () => createChatViewState("chat"));
  const [streamStatus, setStreamStatus] = useState("idle");
  const [activeView, setActiveView] = useState<SideView>("chat");
  const [turnNavigatorOpen, setTurnNavigatorOpen] = useState(false);
  const [turnNavigatorVisible, setTurnNavigatorVisible] = useState(false);
  const [activeHighlightedTurnId, setActiveHighlightedTurnId] = useState<string | null>(null);
  const [isComposing, setIsComposing] = useState(false);
  const [isSubmittingChat, setIsSubmittingChat] = useState(false);
  const isSubmittingChatRef = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const sessionPickerRef = useRef<HTMLButtonElement | null>(null);
  const overflowRafRef = useRef<number | null>(null);
  const overflowDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const e2eStateRef = useRef<Record<string, unknown>>({});
  const e2eHandlersRef = useRef<E2EHandlers>({});
  const canChat = runtimeStatus === "online" && streamStatus !== "streaming";
  const isStreamingOrExecuting = streamStatus === "streaming" || chatTurnState === "executing_chat" || chatTurnState === "streaming_response";
  const canStartChatAction = canChat && !isSubmittingChat && !isStreamingOrExecuting;
  const canSubmitCurrentInput = canSubmitChatInput({ value: input, canChat, isSubmitting: isSubmittingChat, isStreamingOrExecuting });
  const sessionId = sessionState.currentSessionId ?? null;
  const currentSession = sessionState.sessions.find((session) => session.id === sessionState.currentSessionId) ?? null;
  const visibleSessionMenuSessions = getHistorySessions(sessionState.sessions);
  const turnAnchors = useMemo(() => deriveConversationTurns(chatView.messages), [chatView.messages]);
  const messageGroups = useMemo(() => groupMessagesByTurn(chatView.messages), [chatView.messages]);

  function normalizeView(value: string | null | undefined): SideView {
    if (value === "agent" || value === "debug" || value === "settings" || value === "chat" || value === "knowledge") return value;
    return "chat";
  }

  function syncView(nextView: SideView) {
    setActiveView(nextView);
    setModeState(nextView === "agent" ? (runtimeStatus === "online" ? "agent_ready" : "agent_unavailable") : "chat");
    const nextHash = `#${nextView}`;
    if (window.location.hash !== nextHash) {
      window.history.replaceState(null, "", nextHash);
    }
  }

  function clearKnowledgeSensitiveState() {
    setKnowledgeStatus(null);
    setKnowledgeStatusError(null);
    setKnowledgeSource(null);
    setKnowledgeOperation(null);
    setKnowledgeSources([]);
    setSelectedKnowledgeSource(null);
    setKnowledgeWorkspaceError(null);
    setKnowledgeAskQuestion("");
    setKnowledgeAskError(null);
    setKnowledgeQueryResult(null);
    setKnowledgeGraph(null);
    setKnowledgePermissions([]);
    setGovernanceError(null);
    setForgetResult(null);
  }

  function handleKnowledgeRuntimeAccessChange(change: LocalRuntimeAccessChange) {
    clearKnowledgeSensitiveState();
    if (change.status === "connected") {
      setRuntimeStatus("online");
      void refreshKnowledgeStatus();
      void refreshKnowledgeWorkspace();
    }
  }

  async function checkRuntime() {
    setRuntimeStatus("checking");
    try {
      const online = await checkRuntimeHealth();
      setRuntimeStatus(online ? "online" : "offline");
      if (online) await restoreLastSession();
      return online;
    } catch {
      setRuntimeStatus("offline");
      return false;
    }
  }

  async function refreshKnowledgeStatus() {
    if (runtimeStatus === "offline") {
      setKnowledgeStatus(null);
      setKnowledgeStatusError("Runtime offline，无法读取 V2 knowledge status。");
      return;
    }
    setKnowledgeStatusLoading(true);
    setKnowledgeStatusError(null);
    try {
      const status = await getKnowledgeServiceStatus();
      setKnowledgeStatus(status);
    } catch (error) {
      if (isStaleRuntimeRequestError(error)) return;
      setKnowledgeStatus(null);
      setKnowledgeStatusError(error instanceof Error ? error.message : "V2 knowledge status 读取失败。");
    } finally {
      setKnowledgeStatusLoading(false);
    }
  }

  async function saveCurrentPageToKnowledgeBase() {
    if (!pageContext) {
      setKnowledgeSaveError("请先读取当前页面。");
      return;
    }
    if (runtimeStatus !== "online") {
      setKnowledgeSaveError("Runtime offline，无法保存到知识库。");
      return;
    }
    setKnowledgeSaving(true);
    setKnowledgeSaveError(null);
    try {
      const result = await saveCurrentPageToKnowledge(pageContext);
      setKnowledgeSource(result.source);
      setKnowledgeOperation(result.operation);
      setSelectedKnowledgeSource(result.source);
      setSelectedKnowledgeWorkspaceId(result.source.workspaceId);
      setKnowledgeStatus((current) => current ? { ...current, sourceBuildStatus: result.source.status } : current);
      void refreshKnowledgeWorkspace(result.source.workspaceId, result.source.sourceId);
    } catch (error) {
      if (isStaleRuntimeRequestError(error)) return;
      setKnowledgeSaveError(error instanceof Error ? error.message : "保存到知识库失败。");
    } finally {
      setKnowledgeSaving(false);
    }
  }

  async function refreshKnowledgeWorkspace(workspaceId = selectedKnowledgeWorkspaceId, preferredSourceId?: string) {
    if (runtimeStatus !== "online") {
      setKnowledgeWorkspaceError("Runtime offline，无法加载 Knowledge Workspace。");
      return;
    }
    setKnowledgeWorkspaceLoading(true);
    setKnowledgeWorkspaceError(null);
    try {
      const [workspaces, sources] = await Promise.all([
        listKnowledgeWorkspaces(),
        listKnowledgeSources(workspaceId)
      ]);
      setKnowledgeWorkspaces(workspaces);
      setKnowledgeSources(sources);
      const nextSelected = preferredSourceId
        ? sources.find((source) => source.sourceId === preferredSourceId)
        : sources.find((source) => source.sourceId === selectedKnowledgeSource?.sourceId) ?? sources[0] ?? null;
      setSelectedKnowledgeSource(nextSelected ?? null);
      setSelectedKnowledgeWorkspaceId(workspaceId);
      setKnowledgeGraph(await getKnowledgeGraph(workspaceId));
    } catch (error) {
      if (isStaleRuntimeRequestError(error)) return;
      setKnowledgeWorkspaceError(error instanceof Error ? error.message : "Knowledge Workspace 加载失败。");
    } finally {
      setKnowledgeWorkspaceLoading(false);
    }
  }

  async function openKnowledgeWorkspace(request: QuickWorkspaceRequest = {
    origin: "open_workspace",
    routeIntent: "source_library",
    workspaceId: selectedKnowledgeWorkspaceId
  }) {
    setKnowledgeWorkspaceError(null);
    try {
      const response = await chrome.runtime.sendMessage({
        type: "OPEN_NAVIA_KNOWLEDGE_WORKSPACE",
        requestId: crypto.randomUUID(),
        hostStrategy: "extension_workspace_page",
        origin: request.origin,
        routeIntent: request.routeIntent,
        workspaceId: request.workspaceId,
        ...(request.sourceId ? { sourceId: request.sourceId } : {}),
        reusePolicy: "focus_existing_or_create"
      }) as { outcome?: string; errorCode?: string } | undefined;
      if (!response || !["created_new", "focused_existing"].includes(String(response.outcome))) {
        setKnowledgeWorkspaceError(`Workspace 打开失败：${response?.errorCode ?? "OPEN_WORKSPACE_FAILED"}`);
      }
    } catch (error) {
      setKnowledgeWorkspaceError(
        `Workspace 打开失败：${error instanceof Error ? error.message : "OPEN_WORKSPACE_FAILED"}`
      );
    }
  }

  async function selectKnowledgeWorkspace(workspaceId: string) {
    setSelectedKnowledgeWorkspaceId(workspaceId);
    setSelectedKnowledgeSource(null);
    await refreshKnowledgeWorkspace(workspaceId);
  }

  async function selectKnowledgeSource(sourceId: string) {
    const cached = knowledgeSources.find((source) => source.sourceId === sourceId);
    if (cached) setSelectedKnowledgeSource(cached);
    try {
      setSelectedKnowledgeSource(await getKnowledgeSource(sourceId));
    } catch (error) {
      if (isStaleRuntimeRequestError(error)) return;
      setKnowledgeWorkspaceError(error instanceof Error ? error.message : "Source detail 加载失败。");
    }
  }

  async function askKnowledgeWorkspace() {
    const question = knowledgeAskQuestion.trim();
    if (!question) {
      setKnowledgeAskError("请输入问题。");
      return;
    }
    if (runtimeStatus !== "online") {
      setKnowledgeAskError("Runtime offline，无法执行 Ask with Sources。");
      return;
    }
    setKnowledgeAskLoading(true);
    setKnowledgeAskError(null);
    try {
      const result = await askKnowledgeSources({
        workspaceId: selectedKnowledgeWorkspaceId,
        question,
        sourceIds: selectedKnowledgeSource ? [selectedKnowledgeSource.sourceId] : undefined
      });
      setKnowledgeQueryResult(result);
    } catch (error) {
      if (isStaleRuntimeRequestError(error)) return;
      setKnowledgeAskError(error instanceof Error ? error.message : "Ask with Sources 失败。");
    } finally {
      setKnowledgeAskLoading(false);
    }
  }

  async function refreshKnowledgeGraph() {
    if (runtimeStatus !== "online") return;
    try {
      setKnowledgeGraph(await getKnowledgeGraph(selectedKnowledgeWorkspaceId));
    } catch (error) {
      if (isStaleRuntimeRequestError(error)) return;
      setKnowledgeWorkspaceError(error instanceof Error ? error.message : "Knowledge Graph 加载失败。");
    }
  }

  async function grantPermissionRoot() {
    if (runtimeStatus !== "online") {
      setGovernanceError("Runtime offline，无法授权。");
      return;
    }
    if (!permissionPath.trim().startsWith("/")) {
      setGovernanceError("请输入 Runtime POSIX 绝对路径");
      return;
    }
    setGovernanceLoading(true);
    setGovernanceError(null);
    try {
      const result = await grantKnowledgePermission({
        displayName: permissionName.trim() || "User selected source",
        workspaceId: selectedKnowledgeWorkspaceId,
        path: permissionPath.trim(),
        scope: "single_file"
      });
      setKnowledgePermissions((current) => [result.permissionRoot, ...current.filter((item) => item.permissionRootId !== result.permissionRoot.permissionRootId)]);
      setPermissionName("");
      setPermissionPath("");
    } catch (error) {
      if (isStaleRuntimeRequestError(error)) return;
      setGovernanceError(error instanceof Error ? error.message : "PermissionRoot 授权失败。");
    } finally {
      setGovernanceLoading(false);
    }
  }

  async function revokePermissionRoot(permissionRootId: string) {
    setGovernanceLoading(true);
    setGovernanceError(null);
    try {
      const result = await revokeKnowledgePermission(permissionRootId);
      setKnowledgePermissions((current) => current.map((item) => item.permissionRootId === permissionRootId ? result.permissionRoot : item));
    } catch (error) {
      if (isStaleRuntimeRequestError(error)) return;
      setGovernanceError(error instanceof Error ? error.message : "PermissionRoot 撤销失败。");
    } finally {
      setGovernanceLoading(false);
    }
  }

  async function forgetSelectedKnowledgeSource() {
    if (!selectedKnowledgeSource) return;
    setGovernanceLoading(true);
    setGovernanceError(null);
    try {
      const result = await forgetKnowledgeSource(selectedKnowledgeSource.sourceId, "forget");
      setForgetResult(result);
      if (!isForgetSourceVerified(result)) {
        setGovernanceError("遗忘未完成");
        return;
      }
      await refreshKnowledgeWorkspace(selectedKnowledgeSource.workspaceId);
    } catch (error) {
      if (isStaleRuntimeRequestError(error)) return;
      setGovernanceError(isRuntimeRequestError(error) && error.code === "INVALID_RUNTIME_RESPONSE" ? "遗忘未完成" : error instanceof Error ? error.message : "Forget Source 失败。");
    } finally {
      setGovernanceLoading(false);
    }
  }

  async function ensureSession() {
    if (sessionState.currentSessionId) return sessionState.currentSessionId;
    const session = await createNewSession({ resetView: false });
    return session.id;
  }

  async function loadSettings() {
    setSettingsStatus("loading");
    setSettingsMessage("正在加载 LLM 设置...");
    try {
      const next = await getSettings();
      setSettings(next);
      const provider = getDefaultProvider(next);
      const chatProvider = resolveChatProviderDraft(next);
      setProviderDraft({
        displayName: provider?.name ?? "DeepSeek",
        baseUrl: provider?.baseUrl ?? "https://api.deepseek.com",
        apiKey: "",
        defaultModel: provider?.defaultModel ?? next.defaultModel ?? "deepseek-v4-flash"
      });
      setChatProviderDraft(chatProvider);
      setSettingsStatus("idle");
      setSettingsMessage(provider ? "LLM 设置已加载。" : "尚未配置默认 Provider，请先填写 API Key 并保存。");
      if (chatProvider.coreProvider === "piagent") void refreshSidecarHealth();
    } catch (error) {
      setSettingsStatus("error");
      setSettingsMessage(error instanceof Error ? error.message : "设置加载失败。");
    }
  }

  async function refreshSidecarHealth(options: { force?: boolean } = {}): Promise<PiSidecarHealth | null> {
    if (runtimeStatus === "offline") return sidecarHealth;
    try {
      const health = await checkPiSidecarHealth(options);
      setSidecarHealth(health);
      return health;
    } catch {
      const fallback: PiSidecarHealth = {
        status: "unavailable",
        provider: "piagent",
        sidecar: "unreachable",
        recoverable: true,
        code: "piagent_sidecar_unavailable",
        message: "Pi Sidecar 未启动或暂不可用。",
        nextSteps: ["启动 Pi Sidecar", "检查 DeepSeek Provider / model", "或在 Settings 中手动切换到 LLM Direct"],
        checkedAt: new Date().toISOString()
      };
      setSidecarHealth(fallback);
      return fallback;
    }
  }

  async function restoreLastSession() {
    setSessionState((current) => ({ ...current, loadingSessions: true }));
    try {
      const sessions = await listChatSessions();
      const lastSessionId = await getLastSessionId();
      const selected = sessions.find((session) => session.id === lastSessionId) ?? sessions[0] ?? null;
      if (!selected) {
        await createNewSession({ resetView: true, sessions });
        return;
      }
      setSessionState((current) => ({ ...current, sessions, currentSessionId: selected.id, loadingSessions: false }));
      await hydrateSession(selected.id);
    } catch (error) {
      setSessionState((current) => ({ ...current, loadingSessions: false }));
      dispatchChatView({
        type: "system_message",
        kind: "error",
        text: error instanceof Error ? `会话加载失败：${error.message}` : "会话加载失败。"
      });
    }
  }

  async function createNewSession(options: { resetView: boolean; sessions?: ChatSession[] } = { resetView: true }): Promise<ChatSession> {
    setSessionState((current) => ({ ...current, creatingSession: true }));
    setSessionMenuOpen(false);
    setSessionSwitchError(null);
    try {
      const session = await createChatSession({ profile: "chat", source: "sidepanel" });
      setSessionState((current) => ({
        ...current,
        currentSessionId: session.id,
        sessions: [session, ...(options.sessions ?? current.sessions).filter((item) => item.id !== session.id)],
        loadingSessions: false,
        creatingSession: false
      }));
      setInput("");
      setPageSubmitted(false);
      setSubmitStatus(pageContext ? "新会话尚未提交页面上下文" : "未提交页面上下文");
      setPageContextState(pageContext ? "capture_ready" : "unknown");
      if (options.resetView) dispatchChatView({ type: "reset" });
      window.setTimeout(() => textareaRef.current?.focus(), 0);
      return session;
    } catch (error) {
      setSessionState((current) => ({ ...current, loadingSessions: false, creatingSession: false }));
      throw error;
    }
  }

  async function startNewSession(): Promise<ChatSession | null> {
    if (shouldReuseActiveSessionForNewChat(currentSession)) {
      setSessionMenuOpen(false);
      setSessionSwitchError(null);
      setInput("");
      setPageSubmitted(false);
      setSubmitStatus(pageContext ? "新会话尚未提交页面上下文" : "未提交页面上下文");
      setPageContextState(pageContext ? "capture_ready" : "unknown");
      dispatchChatView({ type: "reset" });
      window.setTimeout(() => textareaRef.current?.focus(), 0);
      return currentSession;
    }
    return createNewSession({ resetView: true });
  }

  async function switchSession(nextSessionId: string) {
    if (nextSessionId === sessionState.currentSessionId || sessionState.switchingSession) return;
    setSessionSwitchError(null);
    setSessionState((current) => ({ ...current, switchingSession: true }));
    setInput("");
    try {
      await hydrateSession(nextSessionId);
      setSessionMenuOpen(false);
      window.setTimeout(() => textareaRef.current?.focus(), 0);
    } catch {
      setSessionSwitchError("会话加载失败，请重试。");
    } finally {
      setSessionState((current) => ({ ...current, switchingSession: false }));
    }
  }

  function closeSessionMenu(options: { restoreFocus?: boolean } = { restoreFocus: true }) {
    setSessionMenuOpen(false);
    setSessionSwitchError(null);
    if (options.restoreFocus) {
      window.setTimeout(() => sessionPickerRef.current?.focus(), 0);
    }
  }

  const clearHighlightTimer = useCallback(() => {
    if (highlightTimerRef.current) {
      clearTimeout(highlightTimerRef.current);
      highlightTimerRef.current = null;
    }
  }, []);

  function selectTurnFromNavigator(turnId: string) {
    setTurnNavigatorOpen(false);
    const target = document.getElementById(turnDomId(turnId));
    if (!target) return;
    target.scrollIntoView({ block: "start", behavior: "smooth" });
    clearHighlightTimer();
    setActiveHighlightedTurnId(turnId);
    highlightTimerRef.current = setTimeout(() => {
      setActiveHighlightedTurnId(null);
      highlightTimerRef.current = null;
    }, 1500);
    window.setTimeout(() => textareaRef.current?.focus(), 0);
  }

  async function hydrateSession(nextSessionId: string) {
    const restored = await getChatSessionMessages(nextSessionId);
    const messages = restoreChatSessionMessages(restored);
    dispatchChatView(messages.length > 0 ? { type: "restore_messages", messages } : { type: "reset" });
    setSessionState((current) => ({
      ...current,
      currentSessionId: restored.session.id,
      sessions: [restored.session, ...current.sessions.filter((session) => session.id !== restored.session.id)]
    }));
    applySessionPageRef(restored.session);
  }

  function applySessionPageRef(session: ChatSession) {
    if (!session.pageRef) {
      setPageSubmitted(false);
      setSubmitStatus("此会话暂无页面上下文");
      return;
    }
    setPageContext({
      url: session.pageRef.url,
      title: session.pageRef.title,
      domain: session.pageRef.domain,
      captured_at: session.pageRef.capturedAt,
      headings: [],
      visible_text: "",
      cleaned_text: ""
    });
    setPageSubmitted(true);
    setPageContextState("captured");
    setSubmitStatus(`已恢复：${session.pageRef.title}`);
  }

  async function refreshChatSessions() {
    try {
      const sessions = await listChatSessions();
      setSessionState((current) => ({ ...current, sessions }));
    } catch {
      // Session refresh is non-critical after a completed stream.
    }
  }

  async function captureCurrentPage() {
    setSubmitStatus("正在读取当前页面...");
    setPageContextState("capturing");
    try {
      const context = await readCurrentPageContext();
      setPageContext(context);
      setPageSubmitted(false);
      setPageContextState("capture_ready");
      setSubmitStatus(`已读取页面：${context.title}`);
    } catch (error) {
      setPageContextState(error instanceof PageUnsupportedError ? "unsupported" : "failed");
      setSubmitStatus(`读取失败：${error instanceof Error ? error.message : "未知错误"}`);
    }
  }

  async function submitPageContext() {
    if (!pageContext) {
      setSubmitStatus("请先读取当前页面");
      return;
    }
    try {
      const id = await ensureSession();
      const result = await submitRuntimePageContext(pageContext, id);
      setPageSubmitted(result.ok);
      setPageContextState(result.ok ? "captured" : "failed");
      setSubmitStatus(result.ok ? `已提交：${result.pageId}` : result.message ?? "提交失败");
      if (result.ok) await refreshChatSessions();
    } catch {
      setPageSubmitted(false);
      setPageContextState("failed");
      setSubmitStatus("Runtime 不可用，无法提交页面上下文");
    }
  }

  async function saveProvider() {
    if (runtimeStatus !== "online") {
      setSettingsStatus("error");
      setSettingsMessage("Runtime offline，无法保存 Provider。");
      return;
    }
    if (!providerDraft.apiKey.trim()) {
      setSettingsStatus("error");
      setSettingsMessage("请输入 API Key。");
      return;
    }
    setSettingsStatus("saving");
    setSettingsMessage("正在保存 Provider...");
    try {
      const result = await importProvider({
        providerType: "deepseek",
        displayName: providerDraft.displayName.trim() || "DeepSeek",
        baseUrl: providerDraft.baseUrl.trim() || "https://api.deepseek.com",
        apiKey: providerDraft.apiKey.trim(),
        defaultModel: providerDraft.defaultModel.trim() || "deepseek-v4-flash",
        models: DEFAULT_DEEPSEEK_MODELS
      });
      setSettings(result.settings);
      setProviderTestResult(null);
      setProviderDraft((current) => ({ ...current, apiKey: "" }));
      setSettingsStatus("idle");
      setSettingsMessage(`API Key 已配置并保存成功。${result.provider.name ? `（${result.provider.name}）` : ""}`);
    } catch (error) {
      setSettingsStatus("error");
      setSettingsMessage(error instanceof Error ? error.message : "Provider 保存失败。");
    }
  }

  async function runProviderTest() {
    const provider = getDefaultProvider(settings);
    if (!provider) {
      setSettingsStatus("error");
      setSettingsMessage("请先保存 Provider。");
      return;
    }
    setSettingsStatus("testing");
    setSettingsMessage("正在测试连接...");
    try {
      const result = await testProvider(provider.id);
      setProviderTestResult(result);
      setSettingsStatus(result.status === "ok" ? "idle" : "error");
      setSettingsMessage(
        result.status === "ok"
          ? `API Key 校验成功，连接正常。${result.latencyMs ? `（${result.latencyMs}ms）` : ""}`
          : result.error?.message ?? result.message
      );
      await loadSettings();
    } catch (error) {
      setSettingsStatus("error");
      setSettingsMessage(error instanceof Error ? error.message : "连接测试失败。");
    }
  }

  async function removeProvider() {
    const provider = getDefaultProvider(settings);
    if (!provider) return;
    setSettingsStatus("saving");
    setSettingsMessage("正在删除 Provider...");
    try {
      const result = await deleteProvider(provider.id);
      setSettings(result.settings);
      setProviderTestResult(null);
      setSettingsStatus("idle");
      setSettingsMessage("Provider 已删除。");
    } catch (error) {
      setSettingsStatus("error");
      setSettingsMessage(error instanceof Error ? error.message : "Provider 删除失败。");
    }
  }

  async function saveChatProvider() {
    if (runtimeStatus !== "online") {
      setSettingsStatus("error");
      setSettingsMessage("Runtime offline，无法保存 Chat Provider。");
      return;
    }
    setSettingsStatus("saving");
    setSettingsMessage("正在保存 Chat Provider...");
    try {
      await patchSettings({
        coreProvider: chatProviderDraft.coreProvider,
        chatProvider: chatProviderDraft
      });
      const next = await getSettings();
      setSettings(next);
      setChatProviderDraft(resolveChatProviderDraft(next));
      setSettingsStatus("idle");
      setSettingsMessage("Chat Provider 组合已保存。");
    } catch (error) {
      setSettingsStatus("error");
      setSettingsMessage(error instanceof Error ? error.message : "Chat Provider 保存失败。");
    }
  }

  async function testChatProvider() {
    if (runtimeStatus !== "online") {
      setSettingsStatus("error");
      setSettingsMessage("Runtime offline，无法测试 Chat Provider。");
      return;
    }
    setSettingsStatus("testing");
    setSettingsMessage("正在测试 Chat Provider...");
    const collector = createChatProviderTestCollector();
    try {
      const id = await ensureSession();
      await withTimeout(
        streamRuntimeChat(id, CHAT_PROVIDER_TEST_PROMPT, (event) => {
          const status = collector.accept(event);
          if (isTerminalChatProviderTestStatus(status)) {
            throw new ChatProviderTestTerminalError();
          }
        }, { ...chatProviderDraft, intentHint: "general_chat", autoContext: false, profile: "chat" }),
        CHAT_PROVIDER_TEST_TIMEOUT_MS
      );
      const result = collector.finalize("complete");
      setSettingsDiagnosticEvent(result.rawEvent ?? null);
      setSettingsStatus(result.status === "ok" ? "idle" : "error");
      setSettingsMessage(result.message);
    } catch (error) {
      if (error instanceof ChatProviderTestTerminalError) {
        const result = collector.finalize("complete");
        setSettingsDiagnosticEvent(result.rawEvent ?? null);
        setSettingsStatus("error");
        setSettingsMessage(result.message);
        return;
      }
      const result = error instanceof ChatProviderTestTimeoutError ? collector.finalize("timeout") : null;
      setSettingsStatus("error");
      setSettingsDiagnosticEvent(result?.rawEvent ?? null);
      setSettingsMessage(result?.message ?? (error instanceof Error ? error.message : "Chat Provider 测试失败。"));
    }
  }

  async function submitMessage() {
    if (
      !canSubmitChatInput({
        value: input,
        canChat,
        isSubmitting: isSubmittingChatRef.current || isSubmittingChat,
        isStreamingOrExecuting
      })
    ) {
      return;
    }
    isSubmittingChatRef.current = true;
    setIsSubmittingChat(true);
    try {
      await sendChat(input);
    } finally {
      isSubmittingChatRef.current = false;
      setIsSubmittingChat(false);
      textareaRef.current?.focus();
    }
  }

  function handleInputKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    const shouldSubmit = shouldSubmitOnKeyDown({
      key: event.key,
      shiftKey: event.shiftKey,
      metaKey: event.metaKey,
      ctrlKey: event.ctrlKey,
      eventIsComposing: (event as React.KeyboardEvent<HTMLTextAreaElement> & { isComposing?: boolean }).isComposing,
      nativeIsComposing: event.nativeEvent?.isComposing,
      composingState: isComposing
    });
    if (!shouldSubmit) return;
    event.preventDefault();
    void submitMessage();
  }

  async function sendChat(message: string, intentHint?: ChatIntent, retriedAfterCapture = false) {
    const trimmed = message.trim();
    if (!trimmed) return;
    if (runtimeStatus !== "online") {
      dispatchChatView({ type: "system_message", kind: "error", text: "Runtime offline，请启动 Local Runtime 后重试。" });
      return;
    }
    setChatTurnState("intent_detecting");
    const intent = intentHint ?? detectChatIntent(trimmed);
    const turnId = createClientTurnId();
    dispatchChatView({ type: "start_turn", turnId, text: trimmed, intentHint: intent });
    setInput("");
    if (isDeferredIntent(intent)) {
      setChatTurnState("capability_boundary");
    } else {
      setChatTurnState("context_strategy_deciding");
    }
    if (intentRequiresPageContext(intent, trimmed)) {
      setChatTurnState("context_resolving");
      dispatchChatView({ type: "agent_event", event: syntheticEvent("state.transition", turnId, { from: "context_strategy_deciding", to: "context_resolving" }) });
      const contextResult = await ensurePageContext();
      if (!contextResult.ok) {
        dispatchChatView({ type: "agent_event", event: syntheticEvent("error", turnId, { message: contextResult.message, recoverable: true }) });
        setChatTurnState("error");
        return;
      }
    }
    const id = await ensureSession();
    setChatTurnState("executing_chat");
    setStreamStatus("streaming");
    try {
      if (chatProviderDraft.coreProvider === "piagent") {
        await refreshSidecarHealth();
      }
      await streamRuntimeChat(
        id,
        trimmed,
        async (event) => {
          if (
            event.type === "error" &&
            event.data.code === "page_context_auto_capture_required" &&
            event.data.action === "capture_page_and_retry" &&
            !retriedAfterCapture
          ) {
            const contextResult = await ensurePageContext({ forceRefresh: true });
            if (contextResult.ok) {
              await streamRuntimeChat(
                id,
                trimmed,
                (nextEvent) => dispatchChatView({ type: "agent_event", event: nextEvent }),
                chatStreamOptions(intent, false, chatProviderDraft)
              );
            } else {
              dispatchChatView({ type: "agent_event", event: syntheticEvent("error", turnId, { message: contextResult.message, recoverable: true }) });
            }
            return;
          }
          dispatchChatView({ type: "agent_event", event });
        },
        chatStreamOptions(intent, intentRequiresPageContext(intent, trimmed), chatProviderDraft)
      );
      await refreshChatSessions();
      setStreamStatus("done");
      setChatTurnState("done");
    } catch (error) {
      setRuntimeStatus("offline");
      setStreamStatus("error");
      setChatTurnState("error");
      dispatchChatView({
        type: "agent_event",
        event: syntheticEvent("error", turnId, { message: `连接 Runtime 失败：${error instanceof Error ? error.message : "unknown error"}`, recoverable: true })
      });
    }
  }

  async function ensurePageContext(options: { forceRefresh?: boolean } = {}): Promise<{ ok: true } | { ok: false; message: string }> {
    try {
      const currentUrl = await getActiveTabUrl();
      const reusable = pageSubmitted && pageContext && currentUrl && isSamePageUrl(pageContext.url, currentUrl);
      if (reusable && !options.forceRefresh) return { ok: true };
      setPageContextState(options.forceRefresh || pageContext ? "stale" : "capture_ready");
      setPageContextState("capturing");
      const context = await readCurrentPageContext();
      setPageContext(context);
      const id = await ensureSession();
      setSubmitStatus("正在提交页面上下文...");
      const result = await submitRuntimePageContext(context, id);
      setPageSubmitted(result.ok);
      setPageContextState(result.ok ? "captured" : "failed");
      setSubmitStatus(result.ok ? `已提交：${result.pageId}` : result.message ?? "提交失败");
      if (result.ok) await refreshChatSessions();
      return result.ok ? { ok: true } : { ok: false, message: result.message ?? "页面读取失败，可重试或继续普通聊天。" };
    } catch (error) {
      const unsupported = error instanceof PageUnsupportedError;
      setPageContextState(unsupported ? "unsupported" : "failed");
      const message = unsupported
        ? "当前页面无法读取，但你仍可以普通聊天。如果你希望我基于页面内容回答，可以复制正文给我，或换一个普通网页。"
        : `页面读取失败：${error instanceof Error ? error.message : "未知错误"}。你仍可以继续普通聊天。`;
      setSubmitStatus(message);
      return { ok: false, message };
    }
  }

  e2eStateRef.current = {
    runtimeStatus,
    sessionId,
    pageContextState,
    chatTurnState,
    streamStatus,
    activeView,
    pageSubmitted,
    submitStatus,
    pageTitle: pageContext?.title ?? null,
    domSignalBlockCount: pageContext?.dom_signals?.blocks?.length ?? 0,
    domSignalLinkCount: pageContext?.dom_signals?.links?.length ?? 0,
    pageStateHints: pageContext?.dom_signals?.pageStateHints ?? [],
    messageCount: chatView.messages.length,
    debugEventCount: chatView.debugEvents.length,
    deferredNotice: Boolean(chatView.deferredNotice),
    activeStatus: chatView.activeStatus?.text ?? null
  };

  e2eHandlersRef.current = {
    checkRuntime,
    newSession: startNewSession,
    captureCurrentPage,
    submitPageContext,
    sendChat,
    syncView
  };

  useEffect(() => {
    if (!__NAVIA_E2E_BRIDGE__) return;
    const port = chrome.runtime.connect({ name: "navia.e2e.sidepanel" });
    const observedEntryTargets: Record<string, QuickWorkspaceRequest["origin"]> = {
      "view-source": "view_source",
      "open-workspace": "open_workspace",
      "open-in-workspace": "open_in_workspace",
      "ask-current-workspace": "open_in_workspace"
    };
    const observeTrustedEntry = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-testid]") : null;
      const testId = target?.dataset.testid;
      const origin = testId ? observedEntryTargets[testId] : undefined;
      if (!event.isTrusted || !target || !testId || !origin) return;
      port.postMessage({
        type: "navia.e2e.r2.dom_action",
        actionId: `act_${crypto.randomUUID().replace(/-/g, "")}`,
        eventType: event.type,
        isTrusted: event.isTrusted,
        origin,
        target: `[data-testid='${testId}']`,
        priorPath: location.href,
        sourceObservedAt: new Date(event.timeStamp > Date.now() ? Date.now() : performance.timeOrigin + event.timeStamp).toISOString(),
        sourceMonotonicMs: event.timeStamp
      });
    };
    document.addEventListener("click", observeTrustedEntry, true);
    const onMessage = (message: unknown) => {
      if (!isE2ECommandMessage(message)) return;
      void executeE2ECommand(message.command)
        .then((result) => {
          port.postMessage({
            type: "navia.e2e.response",
            commandId: message.commandId,
            ok: true,
            result,
            snapshot: e2eStateRef.current
          });
        })
        .catch((error) => {
          port.postMessage({
            type: "navia.e2e.response",
            commandId: message.commandId,
            ok: false,
            error: error instanceof Error ? error.message : "E2E command failed",
            snapshot: e2eStateRef.current
          });
        });
    };
    port.onMessage.addListener(onMessage);
    return () => {
      document.removeEventListener("click", observeTrustedEntry, true);
      port.onMessage.removeListener(onMessage);
      port.disconnect();
    };
  }, []);

  async function executeE2ECommand(command: unknown): Promise<Record<string, unknown>> {
    if (!isE2ECommand(command)) throw new Error("Invalid E2E command.");
    const handlers = e2eHandlersRef.current;
    if (command.action === "snapshot") return { snapshot: e2eStateRef.current };
    if (command.action === "panel_identity") return panelIdentitySnapshot();
    if (command.action === "check_runtime") {
      await handlers.checkRuntime?.();
      return { action: command.action };
    }
    if (command.action === "new_session") {
      const session = await handlers.newSession?.();
      return { action: command.action, sessionId: session?.id ?? null };
    }
    if (command.action === "view") {
      handlers.syncView?.(command.view);
      return { action: command.action, view: command.view };
    }
    if (command.action === "capture") {
      await handlers.captureCurrentPage?.();
      return { action: command.action };
    }
    if (command.action === "submit") {
      await handlers.submitPageContext?.();
      return { action: command.action };
    }
    if (command.action === "summarize") {
      await handlers.sendChat?.("总结当前页面", "summarize_page");
      return { action: command.action };
    }
    if (command.action === "question") {
      await handlers.sendChat?.(command.message ?? "这个页面的核心目标是什么？", "page_qa");
      return { action: command.action };
    }
    if (command.action === "mindmap") {
      await handlers.sendChat?.("生成当前页面的思维导图", "mindmap_page");
      return { action: command.action };
    }
    if (command.action === "source_cards_snapshot") {
      const scope = latestEvidenceCardScope();
      const evidenceCardCount = scope.querySelectorAll("[data-testid^='evidence-card-node-']").length;
      const evidenceCardLabels = evidenceCardLabelsSnapshot(scope);
      const readingMap = readingMapSnapshot();
      const sourceEvidence = sourceEvidenceSnapshot();
      return {
        action: command.action,
        sourceCards: sourceCardsSnapshot(),
        evidenceCardCount,
        evidenceCardLabels,
        containsEvidenceCardMindmap: evidenceCardCount > 0,
        containsReadingMap: readingMap.visible,
        readingMapNavCount: readingMap.navCount,
        readingMapDetailText: readingMap.detailText,
        containsSourcePanel: Boolean(document.querySelector("[data-testid='mindmap-source-panel']")),
        sourceEvidenceVisible: sourceEvidence.visible,
        sourceEvidenceText: sourceEvidence.text
      };
    }
    if (command.action === "jumpback_source_card") {
      return await jumpbackSourceCard(command.index ?? 0);
    }
    if (command.action === "t01_dom") {
      return executeT01DomCommand(command);
    }
    if (command.action === "t01_secret_scan") {
      return await inspectT01SecretExposure(command.secret);
    }
    throw new Error(`Unsupported E2E command: ${command.action}`);
  }

  useEffect(() => {
    checkRuntime();
    void loadSettings();
  }, []);

  useEffect(() => {
    const poller = createKnowledgeStatusPoller({
      onStatus(status) {
        setRuntimeStatus("online");
        setKnowledgeStatus(status);
        setKnowledgeStatusError(null);
      },
      onOffline(error) {
        if (isStaleRuntimeRequestError(error)) return;
        setRuntimeStatus(isRuntimeRequestError(error) && error.kind !== "transport" ? "online" : "offline");
        setKnowledgeStatus(null);
        setKnowledgeStatusError(isRuntimeRequestError(error) && error.kind === "authentication"
          ? "会话认证失效，请重新输入 Runtime 令牌"
          : "Runtime offline，V2 knowledge status 由前端本地推断。");
        setKnowledgeSource(null);
        setKnowledgeOperation(null);
      }
    });
    poller.start();
    return () => poller.stop();
  }, []);

  const measureTurnNavigator = useCallback(() => {
    const container = messagesRef.current;
    const nextVisible = container
      ? shouldShowTurnNavigator({
          turnCount: turnAnchors.length,
          clientHeight: container.clientHeight,
          scrollHeight: container.scrollHeight
        })
      : false;
    setTurnNavigatorVisible((current) => (current === nextVisible ? current : nextVisible));
    if (!nextVisible) setTurnNavigatorOpen(false);
  }, [turnAnchors.length]);

  const scheduleTurnNavigatorMeasure = useCallback(() => {
    if (overflowDebounceRef.current) clearTimeout(overflowDebounceRef.current);
    overflowDebounceRef.current = setTimeout(() => {
      if (overflowRafRef.current !== null) cancelAnimationFrame(overflowRafRef.current);
      overflowRafRef.current = requestAnimationFrame(() => {
        overflowRafRef.current = null;
        measureTurnNavigator();
      });
    }, 80);
  }, [measureTurnNavigator]);

  useEffect(() => {
    scheduleTurnNavigatorMeasure();
  }, [chatView.messages, chatView.activeStatus, scheduleTurnNavigatorMeasure]);

  useEffect(() => {
    const container = messagesRef.current;
    if (!container) return;
    const resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => scheduleTurnNavigatorMeasure()) : null;
    resizeObserver?.observe(container);
    window.addEventListener("resize", scheduleTurnNavigatorMeasure);
    scheduleTurnNavigatorMeasure();
    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", scheduleTurnNavigatorMeasure);
    };
  }, [scheduleTurnNavigatorMeasure]);

  useEffect(() => {
    setTurnNavigatorOpen(false);
    setActiveHighlightedTurnId(null);
    clearHighlightTimer();
  }, [clearHighlightTimer, sessionId]);

  useEffect(() => {
    return () => {
      clearHighlightTimer();
      if (overflowDebounceRef.current) clearTimeout(overflowDebounceRef.current);
      if (overflowRafRef.current !== null) cancelAnimationFrame(overflowRafRef.current);
    };
  }, [clearHighlightTimer]);

  useEffect(() => {
    const applyHash = () => {
      const nextView = normalizeView(window.location.hash.replace(/^#/, ""));
      setActiveView(nextView);
      setModeState(nextView === "agent" ? (runtimeStatus === "online" ? "agent_ready" : "agent_unavailable") : "chat");
    };
    applyHash();
    window.addEventListener("hashchange", applyHash);
    return () => window.removeEventListener("hashchange", applyHash);
  }, [runtimeStatus]);

  useEffect(() => {
    if (runtimeStatus !== "online") return;
    if (activeView === "settings" || activeView === "debug") {
      void refreshSidecarHealth();
    }
  }, [activeView, runtimeStatus]);

  useEffect(() => {
    if (runtimeStatus !== "online") {
      setKnowledgeStatus(null);
      setKnowledgeStatusError(runtimeStatus === "offline" ? "Runtime offline，V2 knowledge status 由前端本地推断。" : null);
      setKnowledgeWorkspaces([]);
      setKnowledgeSources([]);
      setSelectedKnowledgeSource(null);
      return;
    }
    void refreshKnowledgeStatus();
  }, [runtimeStatus]);

  useEffect(() => {
    if (runtimeStatus !== "online" || activeView !== "knowledge") return;
    void refreshKnowledgeWorkspace();
  }, [activeView, runtimeStatus]);

  return (
    <main className="shell shell-layout" data-testid="navia-sidepanel-root">
      <section className="main-pane">
        <header className={`topbar unified-topbar ${activeView === "chat" ? "chat-topbar" : "view-topbar"}`}>
          {activeView === "chat" ? (
            <>
              <p className="topbar-status topbar-status-sr" data-testid="runtime-status">
                Runtime {runtimeStatus} · Page {pageContextState} · {chatTurnState}
              </p>
              <div className="topbar-brand-lockup">
                <div className="brand-row">
                  <span className="brand-title">Navia</span>
                  <span className="brand-badge">V1 MVP</span>
                </div>
                <span className={`runtime-status-pill runtime-status-${runtimeStatus}`}>
                  Runtime {runtimeStatus === "online" ? "连通正常" : runtimeStatus === "checking" ? "检查中" : "离线"}
                </span>
              </div>
              <div className="session-picker-wrap topbar-session-picker">
                <button
                  ref={sessionPickerRef}
                  className="session-picker-trigger"
                  type="button"
                  data-testid="session-picker"
                  disabled={runtimeStatus !== "online" || sessionState.loadingSessions}
                  aria-expanded={sessionMenuOpen}
                  aria-label="切换会话"
                  title="切换会话"
                  onClick={() => {
                    setSessionSwitchError(null);
                    setSessionMenuOpen(!sessionMenuOpen);
                  }}
                >
                  <span className="session-title-text">{getSessionDisplayTitle(currentSession)}</span>
                  <span className="session-caret">⌄</span>
                </button>
              </div>
            </>
          ) : (
            <div className="topbar-view-copy">
              <span className="topbar-view-title">{activeView === "agent" ? "Agent" : activeView === "knowledge" ? "Knowledge" : activeView === "debug" ? "Debug" : "设置"}</span>
              <p className="topbar-status" data-testid="runtime-status">
                Runtime {runtimeStatus} · Page {pageContextState} · {chatTurnState}
              </p>
            </div>
          )}
        </header>

        {activeView === "chat" && sessionMenuOpen ? (
          <SessionHistoryOverlay
            sessions={visibleSessionMenuSessions}
            currentSessionId={sessionState.currentSessionId}
            switchingSession={sessionState.switchingSession}
            creatingSession={sessionState.creatingSession}
            canCreateSession={runtimeStatus === "online" && !isStreamingOrExecuting}
            error={sessionSwitchError}
            onClose={() => closeSessionMenu()}
            onSelect={switchSession}
            onCreate={() => void startNewSession()}
          />
        ) : null}

        {activeView === "chat" ? (
          <section className="chat-stage">
            <section className="current-page-card" data-testid="current-page-context-card" aria-label="Current page context">
              <div className="current-page-copy">
                <span className="current-page-kicker">当前上下文</span>
                <strong title={pageContext?.title ?? undefined}>{pageContext?.title ?? "等待读取当前网页"}</strong>
                <span>{pageSubmitted ? submitStatus : pageContext ? "页面已读取，尚未提交上下文。" : "点击读取当前页面后，Navia 会基于网页内容回答。"}</span>
              </div>
              <div className="current-page-status">
                <span className={`context-state context-state-${pageContextState}`}>{pageStateLabel(pageContextState)}</span>
                <span>{pageContext?.domain ?? "host page"}</span>
              </div>
            </section>
            <SaveToKnowledgeCard
              runtimeStatus={runtimeStatus}
              pageContext={pageContext}
              serviceStatus={knowledgeStatus}
              serviceLoading={knowledgeStatusLoading}
              serviceError={knowledgeStatusError}
              source={knowledgeSource}
              operation={knowledgeOperation}
              saving={knowledgeSaving}
              saveError={knowledgeSaveError}
              onRefreshStatus={() => void refreshKnowledgeStatus()}
              onSave={() => void saveCurrentPageToKnowledgeBase()}
            />
            <div className="messages-frame">
              <div className="messages" aria-live="polite" ref={messagesRef}>
                {messageGroups.map((group) => {
                  if (group.kind === "single") return renderChatMessage(group.message);
                  return (
                    <div
                      className={`conversation-turn ${activeHighlightedTurnId === group.turnId ? "highlight" : ""}`}
                      data-turn-id={group.turnId}
                      id={turnDomId(group.turnId)}
                      key={group.turnId}
                    >
                      {group.messages.map((message) => renderChatMessage(message))}
                    </div>
                  );
                })}
                {chatView.activeStatus ? <InlineStatusRow status={chatView.activeStatus} /> : null}
                {chatView.deferredNotice ? <DeferredCapabilityNotice notice={chatView.deferredNotice} /> : null}
              </div>
              <TurnNavigatorView
                turns={turnAnchors}
                visible={turnNavigatorVisible}
                open={turnNavigatorOpen}
                onToggle={() => setTurnNavigatorOpen((current) => !current)}
                onClose={() => setTurnNavigatorOpen(false)}
                onSelect={selectTurnFromNavigator}
              />
            </div>

            <div className="composer-stack">
              <div className="toolbar panel-strip pill-strip" data-testid="native-action-strip" aria-label="Navia quick actions">
                <button data-testid="read-current-page" disabled={runtimeStatus !== "online"} onClick={captureCurrentPage} type="button">读取当前页面</button>
                <button data-testid="submit-page-context" disabled={runtimeStatus !== "online"} onClick={submitPageContext} type="button">提交上下文</button>
                <button data-testid="summarize-page" disabled={!canStartChatAction} onClick={() => sendChat("总结当前页面", "summarize_page")} type="button">总结</button>
                <button data-testid="mindmap-page" disabled={!canStartChatAction} onClick={() => sendChat("生成当前页面的思维导图", "mindmap_page")} type="button">Mindmap</button>
                <button data-testid="explain-selection" disabled={!canStartChatAction} onClick={() => sendChat("解释选中内容", "explain_selection")} type="button">解释选区</button>
              </div>

              <form
                className="chat-form composer-container"
                onSubmit={(event) => {
                  event.preventDefault();
                  void submitMessage();
                }}
              >
                <textarea
                  data-testid="chat-input"
                  ref={textareaRef}
                  value={input}
                  onChange={(event) => {
                    setInput(event.target.value);
                    event.currentTarget.style.height = "auto";
                    event.currentTarget.style.height = `${Math.min(event.currentTarget.scrollHeight, 160)}px`;
                  }}
                  onCompositionStart={() => setIsComposing(true)}
                  onCompositionEnd={() => setIsComposing(false)}
                  onKeyDown={handleInputKeyDown}
                  placeholder={runtimeStatus === "online" ? "问点什么…" : "请先连接 Runtime。"}
                  rows={2}
                />
                <button data-testid="send-message" disabled={!canSubmitCurrentInput} title="Enter 发送，Shift+Enter 换行" type="submit">发送</button>
              </form>
            </div>
          </section>
        ) : null}

        {activeView === "agent" ? (
          <section className="view-panel">
            <div className="panel-heading">
              <div>
                <h2>Agent</h2>
                <p className="muted">Agent 模式入口已预留，工具执行与长任务会在后续版本开放。</p>
              </div>
            </div>
            <div className="debug-grid">
              <div className="debug-card">
                <dt>Mode</dt>
                <dd>{modeState}</dd>
              </div>
              <div className="debug-card">
                <dt>Runtime</dt>
                <dd>{runtimeStatus}</dd>
              </div>
              <div className="debug-card">
                <dt>Profile</dt>
                <dd>{settings?.defaultProfile ?? "chat"}</dd>
              </div>
              <div className="debug-card">
                <dt>Tools</dt>
                <dd>disabled</dd>
              </div>
            </div>
            <div className="debug-log">
              <p className="muted">
                {runtimeStatus === "online"
                  ? "Agent 模式当前只做能力边界展示，不执行工具、不创建 AgentTask。你仍可继续使用 Chat 完成普通问答、页面总结、Mindmap 和解释选区。"
                  : "Agent 模式暂不可用。请先启动本地 Runtime；Chat 也会在 Runtime 恢复后继续可用。"}
              </p>
              <p className="muted">暂未开放：天气查询、实时搜索、Deep Research、PPT 生成、Code Task、本地文件和命令工具。</p>
            </div>
          </section>
        ) : null}

        {activeView === "knowledge" ? (
          <><LocalRuntimeAccess workspaceId={selectedKnowledgeWorkspaceId} onChange={handleKnowledgeRuntimeAccessChange} />
          <KnowledgeQuickSurface
            runtimeStatus={runtimeStatus}
            pageContext={pageContext}
            serviceStatus={knowledgeStatus}
            serviceLoading={knowledgeStatusLoading}
            serviceError={knowledgeStatusError}
            currentPageSource={knowledgeSource}
            selectedSource={selectedKnowledgeSource}
            operation={knowledgeOperation}
            saving={knowledgeSaving}
            saveError={knowledgeSaveError}
            workspaces={knowledgeWorkspaces}
            selectedWorkspaceId={selectedKnowledgeWorkspaceId}
            sourcesLoading={knowledgeWorkspaceLoading}
            sourcesError={knowledgeWorkspaceError}
            workspaceActionError={knowledgeWorkspaceError}
            onRefreshStatus={() => void refreshKnowledgeStatus()}
            onRefreshSources={() => void refreshKnowledgeWorkspace()}
            onSave={() => void saveCurrentPageToKnowledgeBase()}
            onSelectWorkspace={(workspaceId) => void selectKnowledgeWorkspace(workspaceId)}
            onOpenWorkspace={(request) => void openKnowledgeWorkspace(request)}
          />
          </>
        ) : null}

        {activeView === "debug" ? (
          <section className="view-panel">
            <div className="panel-heading">
              <div>
                <h2>Debug</h2>
                <p className="muted">用于查看运行状态、页面提交与消息流。</p>
              </div>
              <button className="ghost-button" onClick={checkRuntime} type="button">重连</button>
            </div>
            <div className="debug-grid">
              <div className="debug-card" data-testid="debug-runtime">
                <dt>Runtime</dt>
                <dd>{runtimeStatus}</dd>
              </div>
              <div className="debug-card">
                <dt>Session</dt>
                <dd>{sessionId ?? "未创建"}</dd>
              </div>
              <div className="debug-card" data-testid="debug-page-state">
                <dt>Page</dt>
                <dd>{pageContextState} · {pageContext?.title ?? "尚未读取"}</dd>
              </div>
              <div className="debug-card">
                <dt>Mode</dt>
                <dd>{modeState}</dd>
              </div>
              <div className="debug-card">
                <dt>Stream</dt>
                <dd>{streamStatus} · {chatTurnState}</dd>
              </div>
              <div className="debug-card" data-testid="debug-core-provider">
                <dt>Core Provider</dt>
                <dd>{formatCoreProvider(settings?.profiles?.chat?.coreProvider ?? settings?.chatProvider?.coreProvider ?? chatProviderDraft.coreProvider)}</dd>
              </div>
              <div className="debug-card" data-testid="debug-sidecar-health">
                <dt>Pi Sidecar</dt>
                <dd>{sidecarHealthLabel(sidecarHealth)}</dd>
              </div>
            </div>
            <div className="debug-log" data-testid="debug-log">
              <p className="muted">Runtime: {runtimeStatus}</p>
              <p className="muted">Stream: {streamStatus}</p>
              <p className="muted">Settings: {settingsStatus}</p>
              <p className="muted">{submitStatus}</p>
              <p className="muted">
                Provider test: {providerTestResult ? providerTestResult.message : "未执行"}
              </p>
              <p className="muted">
                Reconnect: {runtimeStatus === "checking" ? "checking" : runtimeStatus === "online" ? "online" : "offline"}
              </p>
              <p className="muted">
                Reconnect note: {runtimeStatus === "offline" ? "请启动本地 Runtime 后点击重连。" : runtimeStatus === "online" ? "Runtime 已连接。" : "正在检查 Runtime..."}
              </p>
              <p className="muted">
                Profile config: {settings?.profiles?.chat?.coreProvider && settings?.chatProvider?.coreProvider && settings.profiles.chat.coreProvider !== settings.chatProvider.coreProvider
                  ? `profiles.chat=${settings.profiles.chat.coreProvider} / chatProvider=${settings.chatProvider.coreProvider}`
                  : "profiles.chat 与 chatProvider 未发现冲突"}
              </p>
              <p className="muted">
                Provider/model: {getProviderById(settings, settings?.profiles?.chat?.llmProviderId ?? settings?.chatProvider?.llmProviderId)?.name ?? "未配置"} / {settings?.profiles?.chat?.model ?? settings?.chatProvider?.model ?? "未配置"}
              </p>
              <p className="muted">
                Pi Sidecar: {sidecarHealthLabel(sidecarHealth)}
              </p>
              <p className="muted">{settingsMessage}</p>
              <p className="muted">Raw events: {chatView.debugEvents.length}</p>
              <p className="muted">Reducer warnings: {chatView.debugWarnings.length}</p>
              <p className="muted">
                Settings diagnostic event: {settingsDiagnosticEvent ? JSON.stringify(settingsDiagnosticEvent) : "none"}
              </p>
            </div>
          </section>
        ) : null}

        {activeView === "settings" ? (
          <section className="view-panel">
            <div className="panel-heading panel-heading-tight">
              <div>
                <h2>LLM 设置</h2>
                <p className="muted">次级配置区，可在此保存、测试或删除 Provider。</p>
              </div>
            </div>
            <div className="settings-summary">
              <div>
                <dt>当前 Provider</dt>
                <dd>{getDefaultProvider(settings)?.name ?? "未配置"}</dd>
              </div>
              <div>
                <dt>默认模型</dt>
                <dd>{getDefaultProvider(settings)?.defaultModel ?? providerDraft.defaultModel}</dd>
              </div>
            </div>
            <div className="settings-grid">
              <label>
                <span>显示名称</span>
                <input
                  value={providerDraft.displayName}
                  onChange={(event) => setProviderDraft((current) => ({ ...current, displayName: event.target.value }))}
                  autoComplete="off"
                />
              </label>
              <label>
                <span>Base URL</span>
                <input
                  value={providerDraft.baseUrl}
                  onChange={(event) => setProviderDraft((current) => ({ ...current, baseUrl: event.target.value }))}
                  autoComplete="off"
                />
              </label>
              <label>
                <span>API Key</span>
                <input
                  type="password"
                  value={providerDraft.apiKey}
                  onChange={(event) => setProviderDraft((current) => ({ ...current, apiKey: event.target.value }))}
                  autoComplete="off"
                  placeholder="sk-..."
                />
              </label>
              <label>
                <span>默认模型</span>
                <select
                  value={providerDraft.defaultModel}
                  onChange={(event) => setProviderDraft((current) => ({ ...current, defaultModel: event.target.value }))}
                >
                  {(getDefaultProvider(settings)?.models ?? DEFAULT_DEEPSEEK_MODELS).map((model) => (
                    <option value={model} key={model}>{model}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="settings-summary">
              <div>
                <dt>API Key</dt>
                <dd>{getDefaultProvider(settings)?.apiKeyMasked ?? "未配置"}</dd>
              </div>
              <div>
                <dt>连接状态</dt>
                <dd>{getDefaultProvider(settings)?.testStatus?.status ?? "untested"}</dd>
              </div>
            </div>
            <div className="panel-heading panel-heading-tight settings-subheading">
              <div>
                <h2>Chat Provider</h2>
                <p className="muted">选择聊天使用的 CoreProvider / LLM Provider / Model。</p>
              </div>
            </div>
            <div className="settings-summary">
              <div>
                <dt>Core</dt>
                <dd>{formatCoreProvider(settings?.profiles?.chat?.coreProvider ?? settings?.chatProvider?.coreProvider ?? settings?.coreProvider ?? chatProviderDraft.coreProvider)}</dd>
              </div>
              <div>
                <dt>Runtime 当前生效配置</dt>
                <dd>
                  {getProviderById(settings, settings?.profiles?.chat?.llmProviderId ?? settings?.chatProvider?.llmProviderId)?.name ?? "未配置"} / {settings?.profiles?.chat?.model ?? settings?.chatProvider?.model ?? "未配置"}
                </dd>
              </div>
            </div>
            <div className="settings-summary">
              <div>
                <dt>草稿 Core</dt>
                <dd>{formatCoreProvider(chatProviderDraft.coreProvider)}</dd>
              </div>
              <div>
                <dt>草稿 Model</dt>
                <dd>{getProviderById(settings, chatProviderDraft.llmProviderId)?.name ?? "未配置"} / {chatProviderDraft.model ?? "未配置"}</dd>
              </div>
            </div>
            <div className="settings-summary" data-testid="settings-sidecar-health">
              <div>
                <dt>Pi Sidecar</dt>
                <dd>{sidecarHealthLabel(sidecarHealth)}</dd>
              </div>
              <div>
                <dt>PiAgent 下一步</dt>
                <dd>{sidecarNextStepText(sidecarHealth)}</dd>
              </div>
            </div>
            <div className="settings-grid">
              <label>
                <span>Core Provider</span>
                <select
                  value={chatProviderDraft.coreProvider}
                  onChange={(event) => setChatProviderDraft((current) => ({ ...current, coreProvider: event.target.value as CoreProviderId }))}
                >
                  {CORE_PROVIDERS.map((provider) => (
                    <option value={provider} key={provider}>{formatCoreProvider(provider)}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>LLM Provider</span>
                <select
                  value={chatProviderDraft.llmProviderId ?? ""}
                  onChange={(event) => {
                    const provider = getProviderById(settings, event.target.value);
                    setChatProviderDraft((current) => ({
                      ...current,
                      llmProviderId: provider?.id,
                      model: provider?.defaultModel ?? current.model
                    }));
                  }}
                >
                  <option value="">未配置</option>
                  {(settings?.providers ?? []).map((provider) => (
                    <option value={provider.id} key={provider.id}>{provider.name}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Chat Model</span>
                <select
                  value={chatProviderDraft.model ?? ""}
                  onChange={(event) => setChatProviderDraft((current) => ({ ...current, model: event.target.value }))}
                >
                  {(getProviderById(settings, chatProviderDraft.llmProviderId)?.models ?? DEFAULT_DEEPSEEK_MODELS).map((model) => (
                    <option value={model} key={model}>{model}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="quick-actions settings-actions">
              <button disabled={runtimeStatus !== "online" || settingsStatus === "saving" || settingsStatus === "testing"} onClick={saveProvider} type="button">
                保存 Provider
              </button>
              <button disabled={runtimeStatus !== "online" || settingsStatus === "saving" || settingsStatus === "testing"} onClick={runProviderTest} type="button">
                测试连接
              </button>
              <button disabled={runtimeStatus !== "online" || settingsStatus === "saving" || !getDefaultProvider(settings)} onClick={removeProvider} type="button">
                删除 Provider
              </button>
              <button disabled={runtimeStatus !== "online" || settingsStatus === "saving" || settingsStatus === "testing"} onClick={saveChatProvider} type="button">
                保存 Chat Provider
              </button>
              <button disabled={runtimeStatus !== "online" || settingsStatus === "saving" || settingsStatus === "testing"} onClick={testChatProvider} type="button">
                测试 Chat Provider
              </button>
            </div>
            <div className="settings-feedback" role="status" aria-live="polite">
              <p className="muted settings-feedback-message">{settingsMessage}</p>
              {providerTestResult ? (
                <p className="muted settings-feedback-submessage">
                  Provider test: {providerTestResult.message}
                </p>
              ) : null}
            </div>
          </section>
        ) : null}
      </section>

      <aside className="tool-rail" aria-label="Side tools">
        <button
          className={`tool-button ${activeView === "chat" ? "active" : ""}`}
          data-testid="nav-chat-tab"
          type="button"
          aria-current={activeView === "chat" ? "true" : undefined}
          onClick={() => syncView("chat")}
        >
          <span className="tool-glyph" aria-hidden="true">C</span>
          <span className="tool-label">Chat</span>
        </button>
        <button
          className={`tool-button ${activeView === "knowledge" ? "active" : ""}`}
          data-testid="nav-knowledge-tab"
          type="button"
          aria-current={activeView === "knowledge" ? "true" : undefined}
          onClick={() => syncView("knowledge")}
        >
          <span className="tool-glyph" aria-hidden="true">K</span>
          <span className="tool-label">Know</span>
        </button>
        <button
          className={`tool-button ${activeView === "agent" ? "active" : ""}`}
          data-testid="nav-agent-tab"
          type="button"
          aria-current={activeView === "agent" ? "true" : undefined}
          onClick={() => syncView("agent")}
        >
          <span className="tool-glyph" aria-hidden="true">A</span>
          <span className="tool-label">Agent</span>
        </button>
        <button
          className={`tool-button ${activeView === "debug" ? "active" : ""}`}
          data-testid="nav-debug-tab"
          type="button"
          aria-current={activeView === "debug" ? "true" : undefined}
          onClick={() => syncView("debug")}
        >
          <span className="tool-glyph" aria-hidden="true">D</span>
          <span className="tool-label">Debug</span>
        </button>
        <button
          className={`tool-button ${activeView === "settings" ? "active" : ""}`}
          data-testid="nav-settings-tab"
          type="button"
          aria-current={activeView === "settings" ? "true" : undefined}
          onClick={() => syncView("settings")}
        >
          <span className="tool-glyph" aria-hidden="true">S</span>
          <span className="tool-label">Set</span>
        </button>
      </aside>
    </main>
  );
}

function pageStateLabel(state: PageContextState): string {
  if (state === "captured") return "已解析";
  if (state === "capturing") return "解析中";
  if (state === "capture_ready") return "可读取";
  if (state === "stale") return "需刷新";
  if (state === "unsupported") return "不支持";
  if (state === "failed") return "失败";
  return "未解析";
}

function renderChatMessage(message: ChatMessageView): React.ReactNode {
  if (message.role === "user") return <UserMessage message={message} key={message.id} />;
  if (message.role === "assistant") return <AssistantMessage message={message} key={message.id} />;
  return (
    <article className={`message system ${message.kind}`} key={message.id}>
      <pre>{message.text}</pre>
    </article>
  );
}

function turnDomId(turnId: string): string {
  return `conversation-turn-${turnId.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
}

type E2ECommand =
  | { action: "snapshot" }
  | { action: "panel_identity" }
  | { action: "check_runtime" }
  | { action: "new_session" }
  | { action: "view"; view: SideView }
  | { action: "capture" }
  | { action: "submit" }
  | { action: "summarize" }
  | { action: "question"; message?: string }
  | { action: "mindmap" }
  | { action: "source_cards_snapshot" }
  | { action: "jumpback_source_card"; index?: number }
  | { action: "t01_dom"; operation: "click" | "fill" | "text" | "count"; testId: string; value?: string }
  | { action: "t01_secret_scan"; secret: string };

type E2EHandlers = {
  checkRuntime?: () => Promise<boolean>;
  newSession?: () => Promise<ChatSession | null>;
  captureCurrentPage?: () => Promise<void>;
  submitPageContext?: () => Promise<void>;
  sendChat?: (message: string, intentHint?: ChatIntent, retriedAfterCapture?: boolean) => Promise<void>;
  syncView?: (nextView: SideView) => void;
};

function isE2ECommandMessage(value: unknown): value is { type: string; commandId: string; command: unknown } {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return record.type === "navia.e2e.command" && typeof record.commandId === "string";
}

function isE2ECommand(value: unknown): value is E2ECommand {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  const action = record.action;
  if (action === "view") {
    return record.view === "chat" || record.view === "agent" || record.view === "debug" || record.view === "settings";
  }
  if (action === "t01_dom") {
    return (
      (record.operation === "click" || record.operation === "fill" || record.operation === "text" || record.operation === "count") &&
      typeof record.testId === "string" &&
      (record.value === undefined || typeof record.value === "string")
    );
  }
  if (action === "t01_secret_scan") return typeof record.secret === "string" && record.secret.length >= 32;
  return (
    action === "snapshot" ||
    action === "panel_identity" ||
    action === "check_runtime" ||
    action === "new_session" ||
    action === "capture" ||
    action === "submit" ||
    action === "summarize" ||
    action === "question" ||
    action === "mindmap" ||
    action === "source_cards_snapshot" ||
    (action === "jumpback_source_card" && (record.index === undefined || typeof record.index === "number"))
  );
}

const T01_E2E_TEST_IDS = new Set([
  "navia-sidepanel-root",
  "read-current-page",
  "current-page-context-card",
  "nav-knowledge-tab",
  "local-runtime-token-input",
  "local-runtime-connect",
  "local-runtime-disconnect",
  "local-runtime-status",
  "local-runtime-error",
  "save-current-source",
  "quick-source-identity",
  "open-workspace",
  "view-source"
]);

function executeT01DomCommand(command: Extract<E2ECommand, { action: "t01_dom" }>): Record<string, unknown> {
  if (!T01_E2E_TEST_IDS.has(command.testId)) throw new Error(`T01 testid is not allowed: ${command.testId}`);
  const elements = Array.from(document.querySelectorAll<HTMLElement>(`[data-testid="${CSS.escape(command.testId)}"]`));
  if (command.operation === "count") return { action: command.action, operation: command.operation, testId: command.testId, count: elements.length };
  const element = elements[0];
  if (!element) throw new Error(`T01 DOM element not found: ${command.testId}`);
  if (command.operation === "click") {
    element.click();
    return { action: command.action, operation: command.operation, testId: command.testId };
  }
  if (command.operation === "text") {
    return { action: command.action, operation: command.operation, testId: command.testId, text: element.textContent ?? "" };
  }
  if (!(element instanceof HTMLInputElement) || command.testId !== "local-runtime-token-input") {
    throw new Error(`T01 fill is not allowed for: ${command.testId}`);
  }
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  if (!setter) throw new Error("Native input value setter is unavailable.");
  setter.call(element, command.value ?? "");
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
  return { action: command.action, operation: command.operation, testId: command.testId };
}

async function inspectT01SecretExposure(secret: string): Promise<Record<string, unknown>> {
  const storage: Record<string, unknown> = {};
  for (const area of ["local", "session", "sync"] as const) {
    try { storage[area] = await chrome.storage[area].get(null); }
    catch { storage[area] = null; }
  }
  let databases: Array<{ name?: string; version?: number }> = [];
  try { databases = await indexedDB.databases(); } catch { databases = []; }
  const input = document.querySelector<HTMLInputElement>("[data-testid='local-runtime-token-input']");
  return {
    action: "t01_secret_scan",
    urlContains: location.href.includes(secret),
    referrerContains: document.referrer.includes(secret),
    localStorageContains: JSON.stringify({ ...localStorage }).includes(secret),
    sessionStorageContains: JSON.stringify({ ...sessionStorage }).includes(secret),
    chromeStorageContains: JSON.stringify(storage).includes(secret),
    indexedDbContains: JSON.stringify(databases).includes(secret),
    bodyTextContains: (document.body.innerText || "").includes(secret),
    inputValueEmpty: !input || input.value === ""
  };
}

function sourceCardsSnapshot(): Array<{ index: number; testId: string | null; nodeId: string; sourceRefIds: string[]; label: string; excerpt: string }> {
  const scope = latestMindmapScope();
  return Array.from(scope.querySelectorAll<HTMLButtonElement>("[data-testid^='mindmap-source-card-']")).map((button, index) => {
    const label = button.querySelector("span")?.textContent?.trim() ?? button.textContent?.trim() ?? "";
    const excerpt = button.querySelector("small")?.textContent?.trim() ?? "";
    return {
      index,
      testId: button.getAttribute("data-testid"),
      nodeId: button.dataset.nodeId ?? "",
      sourceRefIds: (button.dataset.sourceRefIds ?? "").split(",").map((item) => item.trim()).filter(Boolean),
      label,
      excerpt
    };
  });
}

function evidenceCardLabelsSnapshot(scope: ParentNode): string[] {
  return Array.from(scope.querySelectorAll<HTMLButtonElement>("[data-testid^='evidence-card-node-']"))
    .map((button) => button.querySelector("strong")?.textContent?.replace(/\s+/g, " ").trim() ?? "")
    .filter(Boolean)
    .slice(0, 20);
}

function sourceEvidenceSnapshot(): { visible: boolean; text: string } {
  const scope = latestMindmapScope();
  const element = Array.from(scope.querySelectorAll<HTMLElement>("[data-testid='mindmap-source-evidence']")).at(-1) ?? null;
  if (!element) return { visible: false, text: "" };
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);
  const visible =
    rect.width > 0 &&
    rect.height > 0 &&
    style.display !== "none" &&
    style.visibility !== "hidden" &&
    Number(style.opacity || "1") > 0;
  return {
    visible,
    text: element.textContent?.replace(/\s+/g, " ").trim() ?? ""
  };
}

function readingMapSnapshot(): { visible: boolean; navCount: number; detailText: string } {
  const scope = latestEvidenceCardScope();
  const map = scope.querySelector<HTMLElement>("[data-testid='reading-map']");
  const nav = scope.querySelector<HTMLElement>("[data-testid='reading-map-nav']");
  const detail = scope.querySelector<HTMLElement>("[data-testid='reading-map-detail']");
  if (!map) return { visible: false, navCount: 0, detailText: "" };
  const rect = map.getBoundingClientRect();
  const style = window.getComputedStyle(map);
  return {
    visible: rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity || "1") > 0,
    navCount: nav ? nav.querySelectorAll("[data-testid^='reading-map-nav-']").length : 0,
    detailText: detail?.textContent?.replace(/\s+/g, " ").trim() ?? ""
  };
}

function panelIdentitySnapshot(): Record<string, unknown> {
  const root = document.querySelector<HTMLElement>("[data-testid='navia-sidepanel-root']");
  const scope = latestEvidenceCardScope();
  const evidenceCardCount = scope.querySelectorAll("[data-testid^='evidence-card-node-']").length;
  const evidenceCardLabels = evidenceCardLabelsSnapshot(scope);
  const readingMap = readingMapSnapshot();
  const sourceEvidence = sourceEvidenceSnapshot();
  const bodyText = scope.textContent?.replace(/\s+/g, " ").trim() ?? "";
  return {
    locationHref: window.location.href,
    title: document.title,
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight
    },
    hasNaviaRoot: Boolean(root),
    naviaRootVisible: Boolean(root && root.getBoundingClientRect().width > 0 && root.getBoundingClientRect().height > 0),
    evidenceCardCount,
    evidenceCardLabels,
    containsEvidenceCardMindmap: evidenceCardCount > 0,
    containsReadingMap: readingMap.visible,
    readingMapNavCount: readingMap.navCount,
    readingMapDetailText: readingMap.detailText,
    containsSourcePanel: Boolean(document.querySelector("[data-testid='mindmap-source-panel']")),
    sourceEvidenceVisible: sourceEvidence.visible,
    sourceEvidenceText: sourceEvidence.text,
    visibleTextSample: bodyText.slice(0, 320)
  };
}

async function jumpbackSourceCard(index: number): Promise<Record<string, unknown>> {
  const scope = latestMindmapScope();
  const cards = Array.from(scope.querySelectorAll<HTMLButtonElement>("[data-testid^='mindmap-source-card-']"));
  const card = cards[index];
  if (!card) {
    throw new Error(`Mindmap source card not found at index ${index}.`);
  }
  card.click();
  const startedAt = Date.now();
  let evidenceText = "";
  while (Date.now() - startedAt < 10_000) {
    evidenceText = sourceEvidenceSnapshot().text;
    if (evidenceText.includes("已定位并高亮来源") || evidenceText.includes("未能定位到原文位置")) {
      break;
    }
    await new Promise((resolve) => window.setTimeout(resolve, 150));
  }
  return {
    action: "jumpback_source_card",
    index,
    sourceCards: sourceCardsSnapshot(),
    evidenceText,
    sourceEvidenceVisible: sourceEvidenceSnapshot().visible,
    status: evidenceText.includes("已定位并高亮来源") ? "highlighted" : evidenceText.includes("未能定位到原文位置") ? "fallback_shown" : "blocked"
  };
}

function latestMindmapScope(): ParentNode {
  const panels = Array.from(document.querySelectorAll<HTMLElement>("[data-testid='mindmap-source-panel']"));
  return panels.at(-1) ?? document;
}

function latestEvidenceCardScope(): ParentNode {
  const mindmaps = Array.from(document.querySelectorAll<HTMLElement>("[data-testid='evidence-card-mindmap']"));
  const latest = mindmaps.at(-1) ?? null;
  return latest?.closest(".artifact-inline-card") ?? latest ?? document;
}

function isTerminalChatProviderTestStatus(status: ChatProviderTestStatus): boolean {
  return (
    status === "tool_boundary" ||
    status === "provider_error" ||
    status === "pi_rpc_no_text" ||
    status === "pi_normalizer_no_delta" ||
    status === "provider_auth_failed" ||
    status === "piagent_provider_config_missing"
  );
}

class PageUnsupportedError extends Error {}

async function readCurrentPageContext(): Promise<ExtractedPageContext> {
  const tab = await resolveReadableTab();
  if (!tab.id || !tab.url) {
    throw new Error("无法定位当前标签页。");
  }
  if (!/^https?:|^file:/.test(tab.url)) {
    throw new PageUnsupportedError("当前页面无法读取，但你仍可以普通聊天。");
  }

  let context: ExtractedPageContext | null = null;
  try {
    const response = await chrome.tabs.sendMessage(tab.id, { type: "navia.extractPageContext" });
    if (response?.ok) context = response.context;
  } catch {
    context = null;
  }

  if (!context) {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractPageContextInTab
    });
    context = result?.result as ExtractedPageContext | null;
  }

  if (!context) {
    throw new Error("页面未返回上下文。");
  }
  return context;
}

async function resolveReadableTab(): Promise<chrome.tabs.Tab> {
  const e2eTabId = getE2ETabId();
  if (e2eTabId && /^\d+$/.test(e2eTabId)) {
    const tab = await chrome.tabs.get(Number(e2eTabId));
    if (tab?.id) return tab;
  }
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function detectChatIntent(message: string): ChatIntent {
  const normalized = message.trim().toLowerCase();
  if (/(天气|weather|气温)/i.test(normalized)) return "weather_lookup";
  if (/(搜索|search|查一下|google|联网)/i.test(normalized)) return "web_search";
  if (/(新闻|news|资讯|实时)/i.test(normalized)) return "realtime_news";
  if (/(deep research|深度研究|深入研究)/i.test(normalized)) return "deep_research";
  if (/(ppt|幻灯片|演示文稿)/i.test(normalized)) return "slide_generation";
  if (/(code task|代码任务|改代码|写代码)/i.test(normalized)) return "code_task";
  if (/(mindmap|mermaid|思维导图|脑图)/i.test(normalized)) return "mindmap_page";
  if (/(总结|summary|summarize)/i.test(normalized)) return "summarize_page";
  if (/(解释选区|解释选中|selection|selected text)/i.test(normalized)) return "explain_selection";
  if (/(当前页面|这个页面|这页|这篇|这篇文章|这段|上面内容|文章)/i.test(normalized)) return "page_qa";
  if (/(改写|rewrite|润色)/i.test(normalized)) return "rewrite";
  return "general_chat";
}

function isDeferredIntent(intent: ChatIntent): boolean {
  return (
    intent === "weather_lookup" ||
    intent === "web_search" ||
    intent === "realtime_news" ||
    intent === "deep_research" ||
    intent === "slide_generation" ||
    intent === "code_task"
  );
}

function createClientTurnId(): string {
  return `turn_ui_${crypto.randomUUID().replaceAll("-", "")}`;
}

function syntheticEvent(type: string, turnId: string, data: Record<string, unknown>): AgentEvent {
  return {
    event_id: `evt_ui_${crypto.randomUUID().replaceAll("-", "")}`,
    session_id: "sess_ui",
    turn_id: turnId,
    type,
    data
  };
}

function intentRequiresPageContext(intent: ChatIntent, message: string): boolean {
  if (intent === "page_qa" || intent === "summarize_page" || intent === "mindmap_page" || intent === "explain_selection") return true;
  return /(当前页面|这个页面|这页|这篇|这篇文章|这段|上面内容)/i.test(message);
}

function extractPageContextInTab(): ExtractedPageContext {
  const normalizeText = (text: string) => text.replace(/\s+/g, " ").trim();
  const cssEscape = (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, "\\$&");
  const cssPath = (node: Element): string => {
    const parts: string[] = [];
    let current: Element | null = node;
    while (current && current.nodeType === Node.ELEMENT_NODE && parts.length < 5) {
      let part = current.tagName.toLowerCase();
      if (current.id) {
        part += `#${cssEscape(current.id)}`;
        parts.unshift(part);
        break;
      }
      const className = String(current.getAttribute("class") || "")
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((item) => `.${cssEscape(item)}`)
        .join("");
      part += className;
      const parent = current.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter((item) => item.tagName === current?.tagName);
        if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(current) + 1})`;
      }
      parts.unshift(part);
      current = current.parentElement;
    }
    return parts.join(" > ");
  };
  const pageStateHints = (text: string, title: string, href: string) => {
    const haystack = `${title} ${href} ${text.slice(0, 1200)}`.toLowerCase();
    const hints: string[] = [];
    if (/请先登录|扫码登录|登录后.{0,12}(查看|继续|评论|发布)|需要登录|未登录|sign in to|login to|please log in/.test(haystack)) {
      hints.push("auth_gated");
    }
    if (/验证码|安全验证|滑动验证|人机验证|verify you are human|verification required|captcha/.test(haystack)) {
      hints.push("verification_gated");
    }
    if (/404|not found|页面不见了|无法浏览|isn'?t available/.test(haystack)) hints.push("not_found");
    if (/弹幕|倍速|字幕|播放|video|bilibili|小红书|red/.test(haystack)) hints.push("media_dom_limited");
    return Array.from(new Set(hints));
  };
  const classifyLink = (href: string, text: string) => {
    const lowered = `${href} ${text}`.toLowerCase();
    if (/video|bvid|直播|play|watch/.test(lowered)) return "media_link";
    if (/explore|note|item|post|article|shtml|read/.test(lowered)) return "content_link";
    if (/login|passport|account|signin/.test(lowered)) return "auth_link";
    return "link";
  };
  const classifyBlock = (node: HTMLElement, text: string) => {
    const marker = `${node.tagName} ${node.className || ""} ${node.getAttribute("role") || ""} ${text.slice(0, 160)}`.toLowerCase();
    if (/login|验证码|扫码|sign in/.test(marker)) return "auth_block";
    if (/404|not found|页面不见了|无法浏览/.test(marker)) return "not_found_block";
    if (/video|bvid|弹幕|播放|字幕|倍速/.test(marker)) return "media_block";
    if (/card|item|feed|note|li/.test(marker)) return "feed_card";
    return "content_block";
  };
  const url = window.location.href;
  const parsedUrl = new URL(url);
  const headings = Array.from(document.querySelectorAll("h1,h2,h3"))
    .slice(0, 80)
    .map((node) => ({
      level: Number(node.tagName.slice(1)),
      text: normalizeText(node.textContent ?? "")
    }))
    .filter((heading) => heading.text.length > 0);
  const selection = document.getSelection()?.toString();
  const body = document.body;
  const rawVisibleText = body ? body.innerText || body.textContent || "" : "";
  const visibleText = normalizeText(rawVisibleText);
  const meta = Array.from(document.querySelectorAll<HTMLMetaElement>("meta[name], meta[property]"))
    .map((node) => ({
      name: normalizeText(node.getAttribute("name") || node.getAttribute("property") || ""),
      content: normalizeText(node.getAttribute("content") || "")
    }))
    .filter((item) => item.name && item.content)
    .slice(0, 40);
  const canonical = document.querySelector<HTMLLinkElement>("link[rel='canonical']");
  if (canonical?.href) meta.push({ name: "canonical", content: canonical.href });
  const linkKeys = new Set<string>();
  const links = Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href]"))
    .map((node) => ({
      text: normalizeText(node.textContent || node.getAttribute("aria-label") || node.getAttribute("title") || ""),
      href: node.href,
      selector: cssPath(node),
      role: classifyLink(node.href, node.textContent || "")
    }))
    .filter((item) => item.text.length >= 2 && item.href)
    .filter((item) => {
      const key = `${item.text.slice(0, 80)}|${item.href.replace(/#.*$/, "")}`;
      if (linkKeys.has(key)) return false;
      linkKeys.add(key);
      return true;
    })
    .slice(0, 160);
  const blockKeys = new Set<string>();
  const blocks = Array.from(
    document.querySelectorAll<HTMLElement>("article,[role='article'],main section,li,[class*='card'],[class*='item'],[class*='video'],[class*='note'],[class*='feed']")
  )
    .map((node) => {
      const text = normalizeText(node.innerText || node.textContent || "");
      const firstLink = node.querySelector<HTMLAnchorElement>("a[href]");
      return {
        text: text.slice(0, 520),
        selector: cssPath(node),
        href: firstLink?.href,
        role: classifyBlock(node, text)
      };
    })
    .filter((item) => item.text.length >= 16 && item.text.length <= 900)
    .filter((item) => {
      const key = item.text.slice(0, 120);
      if (blockKeys.has(key)) return false;
      blockKeys.add(key);
      return true;
    })
    .slice(0, 120);

  return {
    url,
    title: document.title || parsedUrl.hostname,
    domain: parsedUrl.hostname,
    captured_at: new Date().toISOString(),
    headings,
    selected_text: selection ? normalizeText(selection) : undefined,
    visible_text: visibleText.slice(0, 24000),
    cleaned_text: visibleText.slice(0, 24000),
    dom_signals: {
      meta,
      links,
      blocks,
      pageStateHints: pageStateHints(visibleText, document.title, url)
    }
  };
}

function getDefaultProvider(settings: MercurySettings | null): LLMProviderConfig | null {
  const providers = settings?.providers ?? [];
  return providers.find((provider) => provider.id === settings?.defaultProviderId) ?? providers[0] ?? null;
}

function getProviderById(settings: MercurySettings | null, providerId: string | undefined): LLMProviderConfig | null {
  if (!providerId) return null;
  return (settings?.providers ?? []).find((provider) => provider.id === providerId) ?? null;
}

function formatCoreProvider(provider: CoreProviderId | string | null | undefined): string {
  if (provider === "piagent") return "PiAgent Core";
  if (provider === "llm_direct") return "LLM Direct";
  if (provider === "mock") return "Mock";
  if (provider === "custom") return "Custom";
  return "未配置";
}

function sidecarHealthLabel(health: PiSidecarHealth | null): string {
  if (!health) return "未检查";
  if (health.status === "ok") return "ok · reachable";
  return `${health.code ?? "piagent_sidecar_unavailable"} · recoverable`;
}

function sidecarNextStepText(health: PiSidecarHealth | null): string {
  if (!health) return "打开 Settings / Debug 或发送 PiAgent 消息时检查。";
  if (health.status === "ok") return "PiAgent Sidecar 可用。";
  return (health.nextSteps ?? ["启动 Pi Sidecar", "检查 DeepSeek Provider / model", "或手动切换到 LLM Direct"]).join(" / ");
}

async function getActiveTabUrl(): Promise<string | null> {
  try {
    const e2eTabId = getE2ETabId();
    if (e2eTabId && /^\d+$/.test(e2eTabId)) {
      const tab = await chrome.tabs.get(Number(e2eTabId));
      return typeof tab?.url === "string" ? tab.url : null;
    }
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return typeof tab?.url === "string" ? tab.url : null;
  } catch {
    return null;
  }
}

function getE2ETabId(): string | null {
  if (!__NAVIA_E2E_BRIDGE__) return null;
  return new URLSearchParams(window.location.search).get("naviaE2ETabId");
}

class ChatProviderTestTerminalError extends Error {}
class ChatProviderTestTimeoutError extends Error {}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new ChatProviderTestTimeoutError("Chat Provider test timeout.")), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

function isSamePageUrl(restoredUrl: string, currentUrl: string): boolean {
  try {
    const restored = new URL(restoredUrl);
    const current = new URL(currentUrl);
    restored.hash = "";
    current.hash = "";
    return restored.toString() === current.toString();
  } catch {
    return restoredUrl === currentUrl;
  }
}

createRoot(document.getElementById("root")!).render(<App />);
