import type { ExtractedPageContext } from "./pageContext";
import type { AgentEvent } from "./sse";
import { parseSseBlocks } from "./sse";
import { isPortalCredentialChannelRecord } from "./modules/media_companion/session/credential/validateCredentialTransportContracts";
import type {
  PortalCredentialChannelBootstrap,
  PortalCredentialChannelBootstrapResult
} from "./modules/media_companion/session/credential/PortalCredentialChannelClient";
import type { MediaCaptureBinding, PublicMediaCaptureGrant } from "./modules/media_companion/capture";

declare const __NAVIA_E2E_BRIDGE__: boolean;

export const RUNTIME_URL = "http://127.0.0.1:17861";
export const LAST_SESSION_STORAGE_KEY = "navia_last_session_id";

export type RuntimeStatus = "checking" | "online" | "offline";
export type ChatRole = "user" | "assistant" | "system";
export type ProviderTestStatus = "ok" | "error";

export type LLMProviderConfig = {
  id: string;
  type: string;
  name: string;
  baseUrl: string;
  models: string[];
  defaultModel: string;
  isDefault: boolean;
  apiKeyMasked: string;
  testStatus: ProviderTestResult | { status: "untested"; message: string } | null;
  createdAt: string;
  updatedAt: string;
};

export type VisionProviderConfig = {
  id: string;
  adapterKind: "openai_responses" | "minimax_chat_completions";
  name: string;
  baseUrl: string;
  model: string;
  secretRef: string;
  secretStorage: "os_keyring" | "windows_credential_vault";
  credentialConfigured: boolean;
  apiKeyMasked: string;
  testStatus: VisionProviderTestResult | { status: "untested"; message: string } | null;
  createdAt: string;
  updatedAt: string;
  selected: boolean;
};

export type VisionProviderDescriptor = {
  id: string;
  adapterKind: VisionProviderConfig["adapterKind"];
  name: string;
  baseUrl: string;
  models: string[];
  defaultModel: string;
};

export type VisionProviderSettings = {
  providers: VisionProviderConfig[];
  catalog: VisionProviderDescriptor[];
  selectedProviderId: string | null;
};

export type VisionProviderTestResult = {
  status: "ok";
  model: string;
  latencyMs: number;
  usage: { input_tokens: number; output_tokens: number; total_tokens: number };
  observation: { summary: string; containsText: boolean; dominantColors: string[] };
  imageSha256: string;
  containsUserContent: false;
  store: false;
  testedAt: string;
};

export type MercurySettings = {
  providers: LLMProviderConfig[];
  defaultProviderId: string | null;
  defaultModel: string | null;
  coreProvider?: CoreProviderId | null;
  chatProvider?: ChatProviderConfig | null;
  defaultProfile?: RuntimeProfile | null;
  profiles?: Record<RuntimeProfile, ProfileConfig> | null;
  settingsMigration?: Record<string, boolean> | null;
  updatedAt: string;
};

export type AsrInstallationState =
  | "not_installed"
  | "qualification_required"
  | "checking"
  | "downloading"
  | "verifying"
  | "installing"
  | "self_testing"
  | "ready"
  | "cancelling"
  | "cancelled"
  | "failed"
  | "corrupt";

export type AsrProviderDescriptor = {
  providerId: string;
  name: string;
  engine: string;
  engineVersion: string;
  locality: "local_only";
  status: "ready" | "qualification_required" | "qualification_pending";
  description: string;
  runtimeKind?: "python_local" | "native_process";
  capabilities?: string[];
};

export type AsrModelDescriptor = {
  modelId: string;
  providerId: string;
  name: string;
  repository: string;
  revision: string;
  license: string;
  installKind: "bundled" | "remote_verified" | "qualification_required";
  installable: boolean;
  selectable: boolean;
  bundled: boolean;
  fallbackOnly: boolean;
  quality: { status: "fallback_only" | "failed_current_gate" | "not_evaluated" | "qualification_pending" | "development_baseline" | "production_qualified"; note: string; gateVersion?: string; qualificationRunId?: string };
  runtimeKind?: "python_local" | "native_process";
  capabilities?: string[];
  resources: {
    downloadBytes: number;
    diskBytes: number;
    estimatedPeakRamBytes: number;
    requiresGpu: boolean;
    recommendedCpuCores: number;
    vramBytes: number;
    installationFreeSpaceRequiredBytes?: number;
    platformDownloadBytes?: { linuxX64: number; windowsX64: number };
  };
  installation: { state: AsrInstallationState; verifiedAt: string | null };
};

export type AsrCatalog = {
  schemaVersion: "v3-asr-model-catalog/v1";
  providers: AsrProviderDescriptor[];
  models: AsrModelDescriptor[];
  lowResourceBaseline: { cpuCores: number; ramBytes: number; gpuRequired: boolean };
};

export type AsrSelection = {
  schemaVersion: "v3-asr-selection/v1";
  requestedModelId: string;
  effectiveModelId: string | null;
  fallbackActive: boolean;
  fallbackReason: string | null;
  updatedAt: string;
};

export type AsrInstallationJob = {
  schemaVersion: "v3-asr-installation-job/v1";
  jobId: string;
  modelId: string;
  source: "remote" | "offline_package";
  state: AsrInstallationState;
  bytesCompleted: number;
  bytesTotal: number;
  percent: number;
  bytesPerSecond: number;
  etaSeconds: number | null;
  message: string;
  failureCode: string | null;
  sequence: number;
  history: Array<{ state: AsrInstallationState; sequence: number; at: string }>;
  createdAt: string;
  updatedAt: string;
  finishedAt: string | null;
};

export type CoreProviderId = "mock" | "llm_direct" | "piagent" | "custom";
export type RuntimeProfile = "chat" | "agent";

export type ToolPolicy = {
  mode: "disabled" | "approval_allowlist";
  allowedTools: string[];
};

export type ProfileConfig = {
  profile: RuntimeProfile;
  coreProvider: CoreProviderId;
  llmProviderId?: string;
  model?: string;
  toolPolicy: ToolPolicy;
  enabled: boolean;
};

export type ChatProviderConfig = {
  coreProvider: CoreProviderId;
  llmProviderId?: string;
  model?: string;
};

export type ChatIntent =
  | "general_chat"
  | "page_qa"
  | "summarize_page"
  | "mindmap_page"
  | "explain_selection"
  | "rewrite"
  | "translate"
  | "weather_lookup"
  | "web_search"
  | "realtime_news"
  | "deep_research"
  | "slide_generation"
  | "code_task"
  | "unknown";

export type ProviderTestResult =
  | {
      status: "ok";
      latencyMs: number;
      message: string;
    }
  | {
      status: "error";
      latencyMs?: number;
      message: string;
      error?: { message: string };
    };

export type PiSidecarHealth = {
  status: "ok" | "unavailable";
  provider: "piagent";
  sidecar: "reachable" | "unreachable";
  recoverable?: boolean;
  code?: string;
  message?: string;
  nextSteps?: string[];
  checkedAt: string;
};

export type ArtifactRecord = {
  artifactId: string;
  type: string;
  sourcePageId?: string;
  turnId: string;
  toolCallId: string;
  source?: string;
  content: string;
  metadata?: Record<string, unknown>;
};

export type ChatMessage = {
  id: string;
  role: ChatRole;
  text: string;
  turnId?: string;
  artifact?: ArtifactRecord;
  artifacts?: ArtifactRecord[];
};

export type RestoredMessage = {
  message_id: string;
  turn_id?: string;
  role: ChatRole;
  content: string;
};

export type RestoredSession = {
  session_id: string;
  activePage?: {
    url: string;
    title: string;
    domain: string;
    captured_at?: string;
  } | null;
  messages?: RestoredMessage[];
  artifacts?: ArtifactRecord[];
};

export type PageRef = {
  id: string;
  url: string;
  title: string;
  domain: string;
  capturedAt: string;
  contentHash?: string;
};

export type ChatSession = {
  id: string;
  title: string;
  profile: RuntimeProfile;
  createdAt: string;
  updatedAt: string;
  lastMessageAt?: string;
  pageRef?: PageRef | null;
  messageCount: number;
  archived?: boolean;
  lastMessageExcerpt?: string;
  hasArtifacts?: boolean;
};

export type ChatMessageRecord = {
  id: string;
  sessionId: string;
  turnId?: string;
  role: ChatRole;
  kind?: "normal" | "status" | "deferred" | "error";
  content: string;
  createdAt: string;
  artifactIds?: string[];
  pageContextId?: string;
};

export type ChatSessionMessagesResponse = {
  session: ChatSession;
  messages: ChatMessageRecord[];
  artifacts: ArtifactRecord[];
};

export type StructuredPageDebug = Record<string, unknown>;

export type KnowledgeServiceStatus = {
  schemaVersion: string;
  observedAt: string;
  frontendInferredRuntimeStatus: RuntimeStatus;
  runtimeStatus: RuntimeStatus;
  adapterStatus: "ready" | "degraded" | "blocked" | "unchecked" | "not_configured";
  dataServiceStatus: "unchecked" | "connected" | "degraded" | "auth_required" | "unreachable" | "version_mismatch" | "blocked_by_policy";
  sourceBuildStatus?: "not_saved" | "queued" | "ingesting" | "building" | "trace_ready" | "degraded" | "failed" | "forgotten";
  capabilities?: Record<string, boolean>;
  userAction?: string;
  message?: string;
  redactionApplied?: boolean;
};

export type KnowledgeSource = {
  contentSnapshot?: { encoding: "utf8"; text: string; byteLength: number; sha256: string };
  permissionRootId?: string;
  sourceId: string;
  workspaceId: string;
  sourceType: string;
  title?: string;
  originUrl?: string;
  status: NonNullable<KnowledgeServiceStatus["sourceBuildStatus"]>;
  revision: number;
  operationId?: string;
  evidenceRefs?: Array<Record<string, unknown>>;
  createdAt: string;
  updatedAt?: string;
};

export type KnowledgeOperation = {
  operationId: string;
  operationType: string;
  status: "queued" | "running" | "succeeded" | "degraded" | "failed" | "cancelled";
  sourceId?: string;
  workspaceId?: string;
  idempotencyKey?: string;
  createdAt: string;
  updatedAt?: string;
};

export type SaveKnowledgeSourceResult = {
  source: KnowledgeSource;
  operation: KnowledgeOperation;
  idempotentReplay: boolean;
};

export type KnowledgeWorkspace = {
  workspaceId: string;
  name: string;
  description?: string;
  sourceCount: number;
  pendingBuildCount: number;
  traceCoverage: number;
  createdAt: string;
  updatedAt?: string;
};

export type V3KnowledgeDraft = {
  schemaVersion: "v3-knowledge-draft/v1";
  draftId: string;
  state: "editing" | "cancelled" | "saved";
  sourceRefs: Array<{ url: string; kind?: string; anchor?: string; timestampMs?: number }>;
  title: string;
  summary: string;
  body: string;
  tags: string[];
  customFields: Record<string, string>;
  provenance: Record<string, unknown>;
  createdFromContextHash: string;
  revision: number;
  itemId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type V3KnowledgeItem = {
  schemaVersion: "v3-knowledge-item/v1";
  itemId: string;
  sourceRefs: V3KnowledgeDraft["sourceRefs"];
  title: string;
  summary: string;
  body: string;
  tags: string[];
  customFields: Record<string, string>;
  priority: number;
  lifecycleState: "active" | "aging" | "archived";
  revision: number;
  createdAt: string;
  updatedAt: string;
};

export type KnowledgeQueryResult = {
  workspaceId: string;
  question: string;
  answer: string;
  status: "source_supported" | "degraded" | string;
  degradedReason?: string;
  evidenceRefs: Array<Record<string, unknown>>;
};

export type KnowledgeGraph = {
  workspaceId: string;
  nodes: Array<{ id: string; label: string; type: string }>;
  edges: Array<{ id: string; from: string; to: string; type: string }>;
  status: "ready" | "degraded" | string;
};

export type PermissionRoot = {
  workspaceId: string;
  permissionRootId: string;
  displayName: string;
  redactedPath: string;
  state: "granted" | "revoked" | string;
  scope: "single_file" | "directory" | "workspace_export" | string;
  createdAt: string;
  revokedAt?: string;
};

export type PermissionResult = {
  permissionRoot: PermissionRoot;
  operation?: KnowledgeOperation;
};

export type PermissionGrantInput = { workspaceId: string; displayName: string; path: string; scope: "single_file" | "directory" };
export type PermissionScan = { scanId: string; workspaceId: string; permissionRootId: string; files: Array<{ fileId: string; displayName: string; sizeBytes: number; sha256: string }> };

export type RuntimeRequestErrorKind = "transport" | "authentication" | "api" | "stale";

export class RuntimeRequestError extends Error {
  readonly kind: RuntimeRequestErrorKind;
  readonly httpStatus?: number;
  readonly code?: string;
  readonly reason?: string;
  readonly requestId?: string;

  constructor(input: {
    kind: RuntimeRequestErrorKind;
    message: string;
    httpStatus?: number;
    code?: string;
    reason?: string;
    requestId?: string;
  }) {
    super(input.message);
    this.name = "RuntimeRequestError";
    this.kind = input.kind;
    this.httpStatus = input.httpStatus;
    this.code = input.code;
    this.reason = input.reason;
    this.requestId = input.requestId;
  }
}

export function isRuntimeRequestError(error: unknown): error is RuntimeRequestError {
  return error instanceof RuntimeRequestError;
}

export function isStaleRuntimeRequestError(error: unknown): error is RuntimeRequestError {
  return isRuntimeRequestError(error) && error.kind === "stale";
}

export type LocalRuntimeSessionSnapshot = Readonly<{
  hasToken: boolean;
  generation: number;
  runtimeInstanceId: string | null;
}>;

type LocalRuntimeSessionListener = (snapshot: LocalRuntimeSessionSnapshot) => void;

const localRuntimeSession = {
  token: "",
  generation: 0,
  controllers: new Map<number, AbortController>(),
  runtimeInstanceId: null as string | null
};
const localRuntimeSessionListeners = new Set<LocalRuntimeSessionListener>();
let localRuntimeControllerId = 0;

function publishLocalRuntimeSession(): void {
  const snapshot = getLocalRuntimeSessionSnapshot();
  for (const listener of localRuntimeSessionListeners) listener(snapshot);
}

function replaceLocalRuntimeToken(token: string): void {
  localRuntimeSession.generation += 1;
  for (const controller of localRuntimeSession.controllers.values()) controller.abort();
  localRuntimeSession.controllers.clear();
  localRuntimeSession.token = token;
  if (!token) localRuntimeSession.runtimeInstanceId = null;
  publishLocalRuntimeSession();
}

export function setLocalRuntimeToken(token: string): void {
  replaceLocalRuntimeToken(token);
}

export function clearLocalRuntimeSession(): void {
  replaceLocalRuntimeToken("");
}

export function hasLocalRuntimeToken(): boolean {
  return Boolean(localRuntimeSession.token);
}

export type CompanionSession = {
  schemaVersion: "navia-companion-session/v1";
  sessionId: string;
  runtimeInstanceId: string;
  extensionOriginSha256: string;
  issuedAt: string;
  expiresAt: string;
  persisted: false;
};

function assertExtensionDocument(): void {
  if (typeof location === "undefined" || location.protocol !== "chrome-extension:") {
    throw new RuntimeRequestError({
      kind: "api",
      message: "本机伴侣会话仅允许由 Navia 扩展建立。",
      code: "V3_COMPANION_ORIGIN_MISMATCH"
    });
  }
}

export async function bootstrapLocalRuntimeSession(): Promise<CompanionSession> {
  assertExtensionDocument();
  let response: Response;
  try {
    response = await fetch(`${RUNTIME_URL}/v1/companion/sessions`, {
      method: "POST",
      cache: "no-store",
      credentials: "omit",
      redirect: "error",
      referrerPolicy: "no-referrer"
    });
  } catch (error) {
    throw new RuntimeRequestError({
      kind: "transport",
      message: error instanceof Error ? error.message : "Navia 本机伴侣未启动。",
      code: "V3_COMPANION_OFFLINE",
      reason: "companion_transport_failed"
    });
  }
  const value = await response.json() as ApiResponse<CompanionSession & { token?: string }>;
  const session = value.data;
  const token = session?.token;
  if (!response.ok || !value.ok || !session || typeof token !== "string") {
    throw new RuntimeRequestError({
      kind: response.status === 401 || response.status === 403 ? "authentication" : "api",
      message: value.error?.message ?? "无法建立本机伴侣会话。",
      httpStatus: response.status,
      code: value.error?.code
    });
  }
  if (session.schemaVersion !== "navia-companion-session/v1"
      || !/^runtime_[a-f0-9]{32}$/.test(session.runtimeInstanceId)
      || !/^comp_session_[a-f0-9]{32}$/.test(session.sessionId)
      || !/^[A-Za-z0-9_-]{43,86}$/.test(token)
      || session.persisted !== false) {
    throw new RuntimeRequestError({ kind: "api", message: "本机伴侣返回了无效会话。", code: "INVALID_RUNTIME_RESPONSE" });
  }
  localRuntimeSession.runtimeInstanceId = session.runtimeInstanceId;
  replaceLocalRuntimeToken(token);
  const { token: _secret, ...publicSession } = session;
  return publicSession;
}

async function companionAuthenticatedRequest(path: string, method: "DELETE" | "POST"): Promise<void> {
  assertExtensionDocument();
  if (!localRuntimeSession.token) return;
  const token = localRuntimeSession.token;
  const response = await fetch(`${RUNTIME_URL}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
    credentials: "omit",
    redirect: "error",
    referrerPolicy: "no-referrer"
  });
  if (!response.ok) {
    const value = await response.json() as ApiResponse<unknown>;
    throw new RuntimeRequestError({
      kind: response.status === 401 || response.status === 403 ? "authentication" : "api",
      message: value.error?.message ?? "本机伴侣请求失败。",
      httpStatus: response.status,
      code: value.error?.code
    });
  }
}

export async function revokeLocalRuntimeSession(): Promise<void> {
  try {
    await companionAuthenticatedRequest("/v1/companion/sessions/current", "DELETE");
  } finally {
    clearLocalRuntimeSession();
  }
}

export async function stopLocalRuntime(): Promise<void> {
  try {
    await companionAuthenticatedRequest("/v1/companion/stop", "POST");
  } finally {
    clearLocalRuntimeSession();
  }
}

export async function bootstrapMediaCredentialChannel(
  input: PortalCredentialChannelBootstrap
): Promise<PortalCredentialChannelBootstrapResult> {
  if (!localRuntimeSession.token) {
    throw new RuntimeRequestError({
      kind: "authentication",
      message: "请先连接本机 Runtime。",
      code: "V3_MEDIA_RUNTIME_AUTH_REQUIRED",
      reason: "runtime_token_missing"
    });
  }
  if (typeof location === "undefined" || location.protocol !== "chrome-extension:") {
    throw new RuntimeRequestError({
      kind: "api",
      message: "媒体凭据通道仅允许在 Navia 扩展页面创建。",
      code: "V3_MEDIA_RUNTIME_ORIGIN_MISMATCH",
      reason: "extension_document_required"
    });
  }
  const generation = localRuntimeSession.generation;
  const requestId = `req_${crypto.randomUUID().replace(/-/g, "")}`;
  let response: Response;
  try {
    response = await fetch(`${RUNTIME_URL}/v1/media/credential-channels`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${localRuntimeSession.token}`,
        "Content-Type": "application/json",
        "X-Request-ID": requestId
      },
      body: JSON.stringify(input),
      cache: "no-store",
      credentials: "omit",
      redirect: "error",
      referrerPolicy: "no-referrer"
    });
  } catch (error) {
    throw new RuntimeRequestError({
      kind: "transport",
      message: error instanceof Error ? error.message : "Runtime 当前不可达",
      code: "V3_MEDIA_CREDENTIAL_TRANSPORT_FAILED",
      reason: "channel_bootstrap_transport_failed",
      requestId
    });
  }
  if (generation !== localRuntimeSession.generation) throw staleRuntimeRequestError(requestId);
  let body: ApiResponse<{ channelToken: string; channel: unknown }>;
  try {
    body = JSON.parse(await response.text()) as ApiResponse<{ channelToken: string; channel: unknown }>;
  } catch {
    throw new RuntimeRequestError({ kind: "api", message: "Runtime 返回了无效响应。", code: "INVALID_RUNTIME_RESPONSE", requestId });
  }
  if (!response.ok || !body.ok || !body.data) {
    throw new RuntimeRequestError({
      kind: response.status === 401 ? "authentication" : "api",
      message: body.error?.message ?? "凭据通道创建失败。",
      httpStatus: response.status,
      code: body.error?.code,
      requestId
    });
  }
  if (!/^[A-Za-z0-9_-]{43}$/.test(body.data.channelToken) || !isPortalCredentialChannelRecord(body.data.channel)) {
    throw new RuntimeRequestError({ kind: "api", message: "Runtime 返回了无效凭据通道。", code: "INVALID_RUNTIME_RESPONSE", requestId });
  }
  return {
    channelToken: body.data.channelToken,
    channel: body.data.channel as PortalCredentialChannelBootstrapResult["channel"]
  };
}

export async function bootstrapMediaCaptureGrant(
  input: MediaCaptureBinding
): Promise<{ ticket: string; grant: PublicMediaCaptureGrant }> {
  if (!localRuntimeSession.token) {
    throw new RuntimeRequestError({
      kind: "authentication",
      message: "请先连接本机 Runtime。",
      code: "V3_MEDIA_RUNTIME_AUTH_REQUIRED",
      reason: "runtime_token_missing"
    });
  }
  if (typeof location === "undefined" || location.protocol !== "chrome-extension:") {
    throw new RuntimeRequestError({
      kind: "api",
      message: "标签页捕获授权仅允许由 Navia 扩展页面创建。",
      code: "V3_MEDIA_CAPTURE_ORIGIN_MISMATCH",
      reason: "extension_document_required"
    });
  }
  const generation = localRuntimeSession.generation;
  const requestId = `req_${crypto.randomUUID().replace(/-/g, "")}`;
  let response: Response;
  try {
    response = await fetch(`${RUNTIME_URL}/v1/media/capture-grants`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${localRuntimeSession.token}`,
        "Content-Type": "application/json",
        "X-Request-ID": requestId
      },
      body: JSON.stringify(input),
      cache: "no-store",
      credentials: "omit",
      redirect: "error",
      referrerPolicy: "no-referrer"
    });
  } catch (error) {
    throw new RuntimeRequestError({
      kind: "transport",
      message: error instanceof Error ? error.message : "Runtime 当前不可达",
      code: "V3_MEDIA_CAPTURE_RUNTIME_DISCONNECTED",
      reason: "capture_grant_transport_failed",
      requestId
    });
  }
  if (generation !== localRuntimeSession.generation) throw staleRuntimeRequestError(requestId);
  const body = JSON.parse(await response.text()) as ApiResponse<{ ticket: string; grant: PublicMediaCaptureGrant }>;
  if (!response.ok || !body.ok || !body.data || typeof body.data.ticket !== "string" || body.data.ticket.length < 43) {
    throw new RuntimeRequestError({
      kind: response.status === 401 ? "authentication" : "api",
      message: body.error?.message ?? "Runtime 拒绝了标签页捕获授权。",
      code: body.error?.code ?? "V3_MEDIA_CAPTURE_GRANT_INVALID",
      reason: "capture_grant_rejected",
      requestId
    });
  }
  return body.data;
}

export type MediaCaptureEligibility = {
  taskId: string;
  failures: Array<{ route: "credentialed_subtitle" | "credentialed_media_asr" | "public_or_page_subtitle"; failureCode: string }>;
  captureFallbackEligible: boolean;
};

export type MediaAcquisitionTask = {
  schemaVersion: "media-acquisition-task/v1";
  taskId: string;
  sourceIdentity: string;
  adapterId: string;
  mediaId: string;
  playbackUnitId: string;
  partId: string;
  state: "created" | "acquiring" | "capturing" | "transcribing" | "cleaning" | "succeeded" | "degraded" | "blocked" | "failed" | "cancelled";
  consentPolicyId: string;
  consentPolicyRevision: number;
  failureCode: string | null;
};

export type MediaAcquisitionInput = {
  route: "credentialed_subtitle" | "credentialed_media_asr";
  artifact: { artifactId: string; kind: string; byteLength: number; sha256: string };
  fallbackReasonCodes: string[];
};

export type MediaAcquisitionExecution = {
  task: MediaAcquisitionTask;
  outcome: "input_acquired" | "awaiting_public_subtitle";
  input: MediaAcquisitionInput | null;
  failures: MediaCaptureEligibility["failures"];
  transcript?: MediaTranscriptTask | null;
};

export type MediaTranscriptTask = {
  taskId: string;
  state: "queued" | "loading_model" | "transcribing" | "validating" | "cleaning" | "succeeded" | "failed" | "cancelled";
  result?: { status: string; segmentCount: number; failureCode: string | null } | null;
};

export type MediaTranscriptProjection = {
  schemaVersion: "v3-media-transcript-projection/v1";
  taskId: string;
  sourceIdentity: string;
  adapterId: string;
  revision: number;
  updatedAt: string;
  state: "created" | "acquiring" | "awaiting_trusted_capture" | "capturing" | "transcribing" | "validating" | "cleaning" | "succeeded" | "degraded" | "blocked" | "failed" | "cancelled";
  route: "credentialed_subtitle" | "credentialed_media_asr" | "public_or_page_subtitle" | "trusted_tab_capture_asr" | "none";
  progressPercent: number;
  failureCode: string | null;
  terminal: boolean;
  cleanupStatus: "not_applicable" | "pending" | "complete";
  canCancel: boolean;
  canRetry: boolean;
  failures: MediaCaptureEligibility["failures"];
  segments: Array<{ segmentId: string; startMs: number; endMs: number; text: string }>;
  resources?: {
    temporaryDiskPeakBytes?: number;
    cpuCoreLimit?: number;
    memoryLimitBytes?: number;
    peakRssBytes?: number;
    elapsedMs?: number;
    gpuUsed?: boolean;
  } | null;
};

export type MediaOutlineEvidence = {
  evidenceId: string;
  taskId: string;
  kind: string;
  timestampStartMs: number;
  timestampEndMs: number;
  contentSha256: string;
  relativeArtifactRef: string;
};

export type MediaOutlineSection = {
  sectionId: string;
  title: string;
  summary: string;
  startMs: number;
  endMs: number;
  evidenceIds: string[];
};

export type MediaOutlineProjections = {
  schemaVersion: "v3-media-outline-taskstore/v2";
  task: { taskId: string; sourceIdentity: string; state: "ready" | "degraded"; revision: number; knowledgeImportStatus: "deferred_to_v4" };
  evidenceCatalog: MediaOutlineEvidence[];
  outline: { outlineId: string; taskId: string; taskRevision: number; title: string; summary: string; sections: MediaOutlineSection[]; contentSha256: string };
  timeline: Array<{ segmentId: string; outlineId: string; sectionId: string; sequence: number; startMs: number; endMs: number; evidenceIds: string[] }>;
  mindmap: { projectionId: string; outlineId: string; taskId: string; contentSha256: string; nodes: Array<{ nodeId: string; parentNodeId: string | null; sectionId: string | null; label: string; evidenceIds: string[] }> };
  terminalFailureCode: string | null;
};

export type MediaOutlineTask = {
  taskId: string;
  sourceIdentity: string;
  state: "created" | "acquiring" | "transcribing" | "extracting_frames" | "analyzing_vision" | "synthesizing" | "ready" | "degraded" | "blocked" | "failed" | "cancelled";
  revision: number;
  createdAt: string;
  updatedAt: string;
  knowledgeImportStatus: "deferred_to_v4";
  terminalFailureCode: string | null;
  currentOutlineId: string | null;
  projections?: MediaOutlineProjections | null;
  events?: Array<{ sequence: number; taskRevision: number; eventType: string; createdAt: string }>;
};

export type MediaAskResult = {
  answerId: string;
  taskId: string;
  taskRevision: number;
  question: string;
  answer: string;
  evidenceIds: string[];
  status: "answered" | "insufficient_evidence" | "blocked";
  failureCode: string | null;
  createdAt: string;
  category?: "factual" | "visual" | "cross_chapter";
  answerBlocks?: Array<{ text: string; evidenceIds: string[]; timestampMs: number }>;
  retrievalPlanSha256?: string;
  executionMode?: "local_deterministic";
};

export type MediaComprehensionEvidence = MediaOutlineEvidence & {
  thumbnailAvailable: boolean;
  excerpt: string;
};

export type MediaComprehensionChapter = {
  chapterId: string;
  parentChapterId: string | null;
  depth: number;
  order: number;
  startMs: number;
  endMs: number;
  title: string;
  thesis: string;
  keyPoints: string[];
  evidenceIds: string[];
  representativeFrameEvidenceId: string | null;
};

export type MediaComprehensionProjection = {
  schemaVersion: "v3-media-workspace-comprehension-projection/v1";
  task: {
    taskId: string;
    taskRevision: number;
    sourceIdentity: string;
    mediaDurationMs: number;
    outlineId: string;
  };
  authorization: {
    groundedTextCloudStatus: "disabled";
    providerId: null;
    modelId: null;
    outboundDerivedTextSha256: null;
    rawMediaUploadCount: 0;
  };
  evidenceCatalog: MediaComprehensionEvidence[];
  outline: {
    outlineId: string;
    taskId: string;
    taskRevision: number;
    title: string;
    summary: string;
    chapters: MediaComprehensionChapter[];
    contentSha256: string;
  };
  timeline: {
    projectionId: string;
    outlineId: string;
    chapterIds: string[];
    moments: Array<{
      momentId: string;
      chapterId: string;
      timestampMs: number;
      kind: "chapter" | "key_point" | "frame" | "quote";
      title: string;
      evidenceIds: string[];
      frameEvidenceId: string | null;
    }>;
    contentSha256: string;
  };
  mindmap: {
    projectionId: string;
    outlineId: string;
    nodes: Array<{
      nodeId: string;
      parentNodeId: string | null;
      depth: number;
      kind: "root" | "chapter" | "key_point" | "evidence";
      label: string;
      chapterId: string | null;
      timestampMs: number | null;
      evidenceIds: string[];
    }>;
    contentSha256: string;
  };
};

export type MediaExportManifest = {
  exportId: string;
  taskId: string;
  taskRevision: number;
  format: "json_bundle" | "markdown_zip";
  filename: string;
  artifactSha256: string;
  memberIndex: Array<{ name: string; byteLength: number; sha256: string }>;
  memberIndexSha256: string;
  byteLength: number;
  createdAt: string;
  knowledgeImportStatus: "deferred_to_v4";
};

async function privilegedMediaJson<T>(path: string, method: "GET" | "POST" | "DELETE", body?: unknown): Promise<T> {
  if (!localRuntimeSession.token) {
    throw new RuntimeRequestError({ kind: "authentication", message: "请先连接本机 Runtime。", code: "V3_MEDIA_RUNTIME_AUTH_REQUIRED" });
  }
  if (typeof location === "undefined" || location.protocol !== "chrome-extension:") {
    throw new RuntimeRequestError({ kind: "api", message: "媒体任务状态仅允许在 Navia 扩展页面读取。", code: "V3_MEDIA_CAPTURE_ORIGIN_MISMATCH" });
  }
  const generation = localRuntimeSession.generation;
  const requestId = `req_${crypto.randomUUID().replace(/-/g, "")}`;
  const response = await fetch(`${RUNTIME_URL}${path}`, {
    method,
    headers: {
      "Authorization": `Bearer ${localRuntimeSession.token}`,
      "Content-Type": "application/json",
      "X-Request-ID": requestId
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
    credentials: "omit",
    redirect: "error",
    referrerPolicy: "no-referrer"
  });
  if (generation !== localRuntimeSession.generation) throw staleRuntimeRequestError(requestId);
  const value = JSON.parse(await response.text()) as ApiResponse<T>;
  if (!response.ok || !value.ok || value.data == null) {
    throw new RuntimeRequestError({ kind: response.status === 401 ? "authentication" : "api", message: value.error?.message ?? "媒体任务请求失败。", code: value.error?.code });
  }
  return value.data as T;
}

export function createMediaAcquisition(input: {
  taskId: string;
  sourceIdentity: string;
  adapterId: string;
  mediaId: string;
  playbackUnitId: string;
  partId: string;
  consentPolicyId: string;
  consentPolicyRevision: number;
}) {
  return privilegedMediaJson<{ task: MediaAcquisitionTask }>("/v1/media/acquisitions", "POST", input);
}

export function executeMediaAcquisition(taskId: string) {
  return privilegedMediaJson<MediaAcquisitionExecution>(`/v1/media/acquisitions/${encodeURIComponent(taskId)}/execute`, "POST");
}

export function getMediaAcquisition(taskId: string) {
  return privilegedMediaJson<{ task: MediaAcquisitionTask }>(`/v1/media/acquisitions/${encodeURIComponent(taskId)}`, "GET");
}

export function cancelMediaAcquisition(taskId: string) {
  return privilegedMediaJson<{ task: MediaAcquisitionTask }>(`/v1/media/acquisitions/${encodeURIComponent(taskId)}`, "DELETE");
}

export function getMediaTranscript(taskId: string) {
  return privilegedMediaJson<{ task: MediaTranscriptTask; segments?: Array<{ segmentId: string; startMs: number; endMs: number; text: string }> }>(
    `/v1/media/transcripts/${encodeURIComponent(taskId)}`,
    "GET"
  );
}

export function getMediaCaptureEligibility(taskId: string) {
  return privilegedMediaJson<MediaCaptureEligibility>(`/v1/media/capture-eligibility/${encodeURIComponent(taskId)}`, "GET");
}

export function getMediaTranscriptProjection(taskId: string) {
  return privilegedMediaJson<{ projection: MediaTranscriptProjection }>(
    `/v1/media/task-projections/${encodeURIComponent(taskId)}`,
    "GET"
  ).then((value) => value.projection);
}

export function getLatestMediaTranscriptProjection(sourceIdentity: string) {
  return privilegedMediaJson<{ projection: MediaTranscriptProjection }>(
    `/v1/media/task-projections?sourceIdentity=${encodeURIComponent(sourceIdentity)}`,
    "GET"
  ).then((value) => value.projection);
}

export function cancelMediaTranscriptProjection(taskId: string) {
  return privilegedMediaJson<{ projection: MediaTranscriptProjection }>(
    `/v1/media/task-projections/${encodeURIComponent(taskId)}`,
    "DELETE"
  ).then((value) => value.projection);
}

export function recordMediaCaptureRouteFailure(
  taskId: string,
  failure: MediaCaptureEligibility["failures"][number]
) {
  return privilegedMediaJson<MediaCaptureEligibility>(
    `/v1/media/capture-eligibility/${encodeURIComponent(taskId)}/failures`,
    "POST",
    failure
  );
}

export function listMediaOutlineTasks(limit = 50) {
  return privilegedMediaJson<{ tasks: MediaOutlineTask[] }>(
    `/v1/media/outline-tasks?limit=${encodeURIComponent(String(limit))}`,
    "GET"
  ).then((value) => value.tasks);
}

export function getMediaOutlineTask(taskId: string) {
  return privilegedMediaJson<{ task: MediaOutlineTask }>(
    `/v1/media/outline-tasks/${encodeURIComponent(taskId)}`,
    "GET"
  ).then((value) => value.task);
}

export function getMediaWorkspaceComprehension(taskId: string, revision: number) {
  return privilegedMediaJson<{ projection: MediaComprehensionProjection }>(
    `/v1/media/tasks/${encodeURIComponent(taskId)}/comprehension?revision=${encodeURIComponent(String(revision))}`,
    "GET"
  ).then((value) => value.projection);
}

export async function downloadMediaEvidenceThumbnail(taskId: string, evidenceId: string): Promise<Blob> {
  if (!localRuntimeSession.token) {
    throw new RuntimeRequestError({ kind: "authentication", message: "请先连接本机 Runtime。", code: "V3_MEDIA_RUNTIME_AUTH_REQUIRED" });
  }
  const response = await fetch(
    `${RUNTIME_URL}/v1/media/tasks/${encodeURIComponent(taskId)}/evidence/${encodeURIComponent(evidenceId)}/thumbnail`,
    {
      headers: { Authorization: `Bearer ${localRuntimeSession.token}` },
      cache: "no-store",
      credentials: "omit",
      redirect: "error",
      referrerPolicy: "no-referrer"
    }
  );
  if (!response.ok) {
    const value = await response.json() as ApiResponse<unknown>;
    throw new RuntimeRequestError({ kind: "api", message: value.error?.message ?? "代表帧读取失败。", code: value.error?.code });
  }
  return response.blob();
}

export function materializeMediaOutlineTask(taskId: string) {
  return privilegedMediaJson<{ task: MediaOutlineTask }>(
    `/v1/media/outline-tasks/${encodeURIComponent(taskId)}/materialize`,
    "POST"
  ).then((value) => value.task);
}

export function materializeVisualMediaOutlineTask(taskId: string, credentialLeaseId: string) {
  return privilegedMediaJson<{ task: MediaOutlineTask }>(
    `/v1/media/outline-tasks/${encodeURIComponent(taskId)}/materialize-visual`,
    "POST",
    { credentialLeaseId }
  ).then((value) => value.task);
}

export function cancelMediaOutlineTask(taskId: string, expectedRevision: number) {
  return privilegedMediaJson<{ task: MediaOutlineTask }>(
    `/v1/media/outline-tasks/${encodeURIComponent(taskId)}/cancel`,
    "POST",
    { expectedRevision }
  ).then((value) => value.task);
}

export function retryMediaOutlineTask(taskId: string, expectedRevision: number) {
  return privilegedMediaJson<{ task: MediaOutlineTask }>(
    `/v1/media/outline-tasks/${encodeURIComponent(taskId)}/retry`,
    "POST",
    { expectedRevision }
  ).then((value) => value.task);
}

export function askMediaOutlineTask(taskId: string, expectedRevision: number, question: string) {
  return privilegedMediaJson<{ result: MediaAskResult }>(
    `/v1/media/outline-tasks/${encodeURIComponent(taskId)}/ask`,
    "POST",
    { expectedRevision, question }
  ).then((value) => value.result);
}

export function listMediaOutlineTaskAsks(taskId: string, revision: number) {
  return privilegedMediaJson<{ results: MediaAskResult[] }>(
    `/v1/media/outline-tasks/${encodeURIComponent(taskId)}/asks?revision=${encodeURIComponent(String(revision))}`,
    "GET"
  ).then((value) => value.results);
}

export function createMediaOutlineExport(
  taskId: string,
  expectedRevision: number,
  format: MediaExportManifest["format"]
) {
  return privilegedMediaJson<{ manifest: MediaExportManifest }>(
    `/v1/media/outline-tasks/${encodeURIComponent(taskId)}/exports`,
    "POST",
    { expectedRevision, format }
  ).then((value) => value.manifest);
}

export async function downloadMediaOutlineExport(taskId: string, manifest: MediaExportManifest): Promise<Blob> {
  if (!localRuntimeSession.token) {
    throw new RuntimeRequestError({ kind: "authentication", message: "请先连接本机 Runtime。", code: "V3_MEDIA_RUNTIME_AUTH_REQUIRED" });
  }
  const response = await fetch(
    `${RUNTIME_URL}/v1/media/outline-tasks/${encodeURIComponent(taskId)}/exports/${encodeURIComponent(manifest.exportId)}`,
    {
      headers: { Authorization: `Bearer ${localRuntimeSession.token}` },
      cache: "no-store",
      credentials: "omit",
      redirect: "error",
      referrerPolicy: "no-referrer"
    }
  );
  if (!response.ok) {
    const value = await response.json() as ApiResponse<unknown>;
    throw new RuntimeRequestError({ kind: "api", message: value.error?.message ?? "导出文件读取失败。", code: value.error?.code });
  }
  return response.blob();
}

export function getLocalRuntimeSessionSnapshot(): LocalRuntimeSessionSnapshot {
  return Object.freeze({
    hasToken: Boolean(localRuntimeSession.token),
    generation: localRuntimeSession.generation,
    runtimeInstanceId: localRuntimeSession.runtimeInstanceId
  });
}

export function subscribeLocalRuntimeSession(listener: LocalRuntimeSessionListener): () => void {
  localRuntimeSessionListeners.add(listener);
  return () => localRuntimeSessionListeners.delete(listener);
}

export type ForgetSourceResult = {
  forgetRequest: Record<string, unknown>;
  verification: {
    verificationId: string;
    forgetRequestId: string;
    sourceId: string;
    libraryAbsent: boolean;
    askAbsent: boolean;
    graphAbsent: boolean;
    traceAbsent: boolean;
    verifiedAt: string;
  };
  operation: KnowledgeOperation;
};

type ApiResponse<T> = {
  ok: boolean;
  data: T | null;
  request_id?: string;
  error?: { message?: string; code?: string; details?: Record<string, unknown> };
};

export async function checkRuntimeHealth(): Promise<boolean> {
  const body = await runtimeJson<{ status: string }>({ path: "/v1/health" });
  return Boolean(body.ok);
}

let piSidecarHealthCache: { value: PiSidecarHealth; expiresAt: number } | null = null;

export async function checkPiSidecarHealth(options: { force?: boolean } = {}): Promise<PiSidecarHealth> {
  const now = Date.now();
  if (!options.force && piSidecarHealthCache && piSidecarHealthCache.expiresAt > now) {
    return piSidecarHealthCache.value;
  }
  const body = unwrapApiResponse(await runtimeJson<PiSidecarHealth>({ path: "/v1/pi/sidecar/health" }));
  piSidecarHealthCache = { value: body, expiresAt: now + 8_000 };
  return body;
}

export async function createRuntimeSession(source: string): Promise<string> {
  const body = unwrapApiResponse(await runtimeJson<{ session_id: string }>({
    path: "/v1/sessions",
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: { client: "chrome-extension", metadata: { source } }
  }));
  const id = body.session_id;
  await chrome.storage.local.set({ [LAST_SESSION_STORAGE_KEY]: id });
  return id;
}

export async function listChatSessions(): Promise<ChatSession[]> {
  const body = await runtimeJson<{ sessions: ChatSession[] }>({ path: "/v1/chat/sessions" });
  return unwrapApiResponse(body).sessions;
}

export async function createChatSession(input: { title?: string; profile?: RuntimeProfile; pageRef?: PageRef; source?: string } = {}): Promise<ChatSession> {
  const body = await runtimeJson<{ session: ChatSession }>({
    path: "/v1/chat/sessions",
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: input
  });
  const session = unwrapApiResponse(body).session;
  await chrome.storage.local.set({ [LAST_SESSION_STORAGE_KEY]: session.id });
  return session;
}

export async function getChatSession(sessionId: string): Promise<ChatSession | null> {
  const body = await runtimeJson<{ session: ChatSession }>({ path: `/v1/chat/sessions/${sessionId}` });
  if (!body.ok) return null;
  return unwrapApiResponse(body).session;
}

export async function patchChatSession(
  sessionId: string,
  input: Partial<Pick<ChatSession, "title" | "profile" | "archived" | "pageRef">>
): Promise<ChatSession> {
  const body = await runtimeJson<{ session: ChatSession }>({
    path: `/v1/chat/sessions/${sessionId}`,
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: input
  });
  return unwrapApiResponse(body).session;
}

export async function archiveChatSession(sessionId: string): Promise<ChatSession> {
  const body = await runtimeJson<{ session: ChatSession }>({
    path: `/v1/chat/sessions/${sessionId}`,
    method: "DELETE"
  });
  return unwrapApiResponse(body).session;
}

export async function getChatSessionMessages(sessionId: string): Promise<ChatSessionMessagesResponse> {
  const body = await runtimeJson<ChatSessionMessagesResponse>({ path: `/v1/chat/sessions/${sessionId}/messages` });
  return unwrapApiResponse(body);
}

export async function getLastSessionId(): Promise<string | null> {
  const stored = await chrome.storage.local.get(LAST_SESSION_STORAGE_KEY);
  const id = stored[LAST_SESSION_STORAGE_KEY];
  return typeof id === "string" && id.startsWith("sess_") ? id : null;
}

export async function getSettings(): Promise<MercurySettings> {
  const body = await runtimeJson<MercurySettings>({ path: "/v1/settings" });
  return unwrapApiResponse(body);
}

export async function patchSettings(
  input: Partial<
    Pick<MercurySettings, "defaultProviderId" | "defaultModel" | "coreProvider" | "chatProvider" | "defaultProfile" | "profiles">
  >
): Promise<MercurySettings> {
  const body = await runtimeJson<MercurySettings>({
    path: "/v1/settings",
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: input
  });
  return unwrapApiResponse(body);
}

export async function getAsrCatalog(): Promise<AsrCatalog> {
  return unwrapApiResponse(await runtimeJson<AsrCatalog>({ path: "/v1/asr/catalog" }));
}

export async function getAsrSettings(): Promise<AsrSelection> {
  return unwrapApiResponse(await runtimeJson<AsrSelection>({ path: "/v1/asr/settings" }));
}

export async function patchAsrSettings(requestedModelId: string): Promise<AsrSelection> {
  return unwrapApiResponse(await runtimeJson<AsrSelection>({
    path: "/v1/asr/settings",
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: { requestedModelId }
  }));
}

export async function startAsrModelInstallation(modelId: string): Promise<AsrInstallationJob> {
  const body = unwrapApiResponse(await runtimeJson<{ job: AsrInstallationJob }>({
    path: "/v1/asr/installations",
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: { modelId }
  }));
  return body.job;
}

export async function getAsrModelInstallation(jobId: string): Promise<AsrInstallationJob> {
  const body = unwrapApiResponse(await runtimeJson<{ job: AsrInstallationJob }>({
    path: `/v1/asr/installations/${encodeURIComponent(jobId)}`
  }));
  return body.job;
}

export async function cancelAsrModelInstallation(jobId: string): Promise<AsrInstallationJob> {
  const body = unwrapApiResponse(await runtimeJson<{ job: AsrInstallationJob }>({
    path: `/v1/asr/installations/${encodeURIComponent(jobId)}`,
    method: "DELETE"
  }));
  return body.job;
}

export async function uninstallAsrModel(modelId: string): Promise<AsrSelection> {
  return unwrapApiResponse(await runtimeJson<AsrSelection>({
    path: `/v1/asr/models/${encodeURIComponent(modelId)}`,
    method: "DELETE"
  }));
}

export async function importAsrModelPackage(modelId: string, packageFile: File): Promise<AsrInstallationJob> {
  if (shouldUseRuntimeProxy()) {
    throw new RuntimeRequestError({ kind: "api", message: "离线模型包只能从 Navia 扩展页面导入。", code: "CREDENTIAL_SCOPE_VIOLATION" });
  }
  const requestId = `req_${crypto.randomUUID().replace(/-/g, "")}`;
  const response = await fetch(`${RUNTIME_URL}/v1/asr/models/import/${encodeURIComponent(modelId)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/octet-stream", "X-Request-ID": requestId },
    body: packageFile,
    redirect: "error"
  });
  const body = (await response.json()) as ApiResponse<{ job: AsrInstallationJob }>;
  return unwrapApiResponse(body).job;
}

export async function importProvider(input: {
  providerType?: string;
  displayName?: string;
  type?: string;
  name?: string;
  baseUrl: string;
  apiKey: string;
  defaultModel: string;
  models?: string[];
}): Promise<{ settings: MercurySettings; provider: LLMProviderConfig }> {
  const body = await runtimeJson<{ settings: MercurySettings; provider: LLMProviderConfig }>({
    path: "/v1/llm/providers/import",
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: {
      type: input.type ?? input.providerType ?? "deepseek",
      name: input.name ?? input.displayName ?? "DeepSeek",
      baseUrl: input.baseUrl,
      apiKey: input.apiKey,
      defaultModel: input.defaultModel,
      models: input.models
    }
  });
  return unwrapApiResponse(body);
}

export async function deleteProvider(providerId: string): Promise<{ settings: MercurySettings }> {
  const body = await runtimeJson<MercurySettings>({
    path: `/v1/llm/providers/${providerId}`,
    method: "DELETE"
  });
  return { settings: unwrapApiResponse(body) };
}

export async function testProvider(providerId: string): Promise<ProviderTestResult> {
  const body = await runtimeJson<{ result: ProviderTestResult; provider: LLMProviderConfig }>({
    path: `/v1/llm/providers/${providerId}/test`,
    method: "POST"
  });
  return unwrapApiResponse(body).result;
}

export async function listVisionProviders(): Promise<VisionProviderSettings> {
  const body = await runtimeJson<VisionProviderSettings>({ path: "/v1/vision/providers" });
  return unwrapApiResponse(body);
}

export async function saveVisionProvider(provider: VisionProviderDescriptor, model: string, apiKey: string): Promise<VisionProviderConfig> {
  const body = await runtimeJson<{ provider: VisionProviderConfig }>({
    path: `/v1/vision/providers/${provider.id}`,
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: {
      adapterKind: provider.adapterKind,
      name: provider.name,
      baseUrl: provider.baseUrl,
      model,
      apiKey
    }
  });
  return unwrapApiResponse(body).provider;
}

export async function testVisionProvider(providerId: string): Promise<{ result: VisionProviderTestResult; provider: VisionProviderConfig }> {
  return unwrapApiResponse(await runtimeJson<{ result: VisionProviderTestResult; provider: VisionProviderConfig }>({
    path: `/v1/vision/providers/${providerId}/test`,
    method: "POST"
  }));
}

export async function selectVisionProvider(providerId: string): Promise<VisionProviderConfig> {
  return unwrapApiResponse(await runtimeJson<{ provider: VisionProviderConfig }>({
    path: `/v1/vision/providers/${providerId}/select`,
    method: "PATCH"
  })).provider;
}

export async function deleteVisionProvider(providerId: string): Promise<void> {
  unwrapApiResponse(await runtimeJson<{ deleted: boolean; providerId: string }>({
    path: `/v1/vision/providers/${providerId}`,
    method: "DELETE"
  }));
}

export async function clearLastSessionId() {
  await chrome.storage.local.remove(LAST_SESSION_STORAGE_KEY);
}

export async function restoreRuntimeSession(sessionId: string): Promise<RestoredSession | null> {
  const body = await runtimeJson<RestoredSession>({ path: `/v1/sessions/${sessionId}` });
  if (!body.ok) {
    await clearLastSessionId();
    return null;
  }
  return unwrapApiResponse(body);
}

export async function submitRuntimePageContext(
  context: ExtractedPageContext,
  sessionId: string
): Promise<{ ok: boolean; pageId?: string; structuredPage?: StructuredPageDebug; message?: string }> {
  const body = await runtimeJson<{ page_id: string; structuredPage?: StructuredPageDebug }>({
    path: "/v1/page/context",
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: { ...context, session_id: sessionId }
  });
  if (!body.ok) return { ok: false, message: body.error?.message ?? "PageContext submit failed." };
  const data = unwrapApiResponse(body);
  await chrome.storage.local.set({ [LAST_SESSION_STORAGE_KEY]: sessionId });
  return { ok: true, pageId: data.page_id, structuredPage: data.structuredPage };
}

export async function getKnowledgeServiceStatus(): Promise<KnowledgeServiceStatus> {
  return unwrapApiResponse(await runtimeJson<KnowledgeServiceStatus>({ path: "/v1/knowledge/status" }));
}

export type KnowledgeStatusPollerOptions = {
  load?: () => Promise<KnowledgeServiceStatus>;
  onStatus: (status: KnowledgeServiceStatus) => void;
  onOffline: (error: unknown) => void;
  onlineIntervalMs?: number;
  offlineDelaysMs?: readonly number[];
  scheduler?: Pick<typeof globalThis, "setTimeout" | "clearTimeout">;
};

export function createKnowledgeStatusPoller(options: KnowledgeStatusPollerOptions) {
  const load = options.load ?? getKnowledgeServiceStatus;
  const onlineIntervalMs = options.onlineIntervalMs ?? 5_000;
  const offlineDelaysMs = options.offlineDelaysMs ?? [1_000, 2_000, 4_000, 8_000];
  const scheduler = options.scheduler ?? globalThis;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = true;
  let inFlight = false;
  let refreshPending = false;
  let offlineAttempt = 0;

  const clearTimer = () => {
    if (timer !== undefined) scheduler.clearTimeout(timer);
    timer = undefined;
  };
  const schedule = (delay: number) => {
    clearTimer();
    timer = scheduler.setTimeout(() => void poll(), delay) as ReturnType<typeof setTimeout>;
  };
  const poll = async () => {
    if (stopped || inFlight) return;
    inFlight = true;
    let nextDelay = onlineIntervalMs;
    try {
      const status = await load();
      if (stopped) return;
      offlineAttempt = 0;
      options.onStatus(status);
    } catch (error) {
      if (stopped) return;
      options.onOffline(error);
      nextDelay = offlineDelaysMs[Math.min(offlineAttempt, offlineDelaysMs.length - 1)] ?? 8_000;
      offlineAttempt += 1;
    } finally {
      inFlight = false;
      if (!stopped) {
        const delay = refreshPending ? 0 : nextDelay;
        refreshPending = false;
        schedule(delay);
      }
    }
  };

  return {
    start() {
      if (!stopped) return;
      stopped = false;
      void poll();
    },
    requestNow() {
      if (stopped) return;
      clearTimer();
      if (inFlight) refreshPending = true;
      else void poll();
    },
    stop() {
      stopped = true;
      refreshPending = false;
      clearTimer();
    }
  };
}

export async function listKnowledgeWorkspaces(): Promise<KnowledgeWorkspace[]> {
  const body = unwrapApiResponse(await runtimeJson<{ workspaces: KnowledgeWorkspace[]; cursor: string | null }>({ path: "/v1/knowledge/workspaces" }));
  return body.workspaces;
}

export async function createV3KnowledgeDraft(context: ExtractedPageContext): Promise<V3KnowledgeDraft> {
  const body = (context.cleaned_text || context.visible_text || context.title).slice(0, 100_000).trim();
  const contextHash = await sha256Hex(new TextEncoder().encode(`${context.url}\n${context.title}\n${body}`));
  return unwrapApiResponse(await runtimeJson<{ draft: V3KnowledgeDraft }>({
    path: "/v3/knowledge/drafts", method: "POST", headers: { "Content-Type": "application/json" },
    body: {
      sourceRefs: [{ url: context.url, kind: "web_page", anchor: "main" }],
      title: context.title,
      summary: body.slice(0, 280),
      body,
      tags: [],
      customFields: {},
      provenance: { contextType: "web_page", adapterId: "web_page", capturedAt: context.captured_at },
      createdFromContextHash: contextHash
    }
  })).draft;
}

export async function updateV3KnowledgeDraft(draft: V3KnowledgeDraft): Promise<V3KnowledgeDraft> {
  return unwrapApiResponse(await runtimeJson<{ draft: V3KnowledgeDraft }>({
    path: `/v3/knowledge/drafts/${encodeURIComponent(draft.draftId)}`, method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: { revision: draft.revision, title: draft.title, summary: draft.summary, body: draft.body, tags: draft.tags, customFields: draft.customFields }
  })).draft;
}

export async function cancelV3KnowledgeDraft(draftId: string): Promise<V3KnowledgeDraft> {
  return unwrapApiResponse(await runtimeJson<{ draft: V3KnowledgeDraft }>({
    path: `/v3/knowledge/drafts/${encodeURIComponent(draftId)}/cancel`, method: "POST"
  })).draft;
}

export async function saveV3KnowledgeDraft(draftId: string): Promise<{ draft: V3KnowledgeDraft; item: V3KnowledgeItem; idempotentReplay: boolean }> {
  return unwrapApiResponse(await runtimeJson<{ draft: V3KnowledgeDraft; item: V3KnowledgeItem; idempotentReplay: boolean }>({
    path: `/v3/knowledge/drafts/${encodeURIComponent(draftId)}/save`, method: "POST"
  }));
}

export async function listV3KnowledgeItems(sort = "updated_desc"): Promise<V3KnowledgeItem[]> {
  return unwrapApiResponse(await runtimeJson<{ items: V3KnowledgeItem[] }>({
    path: `/v3/knowledge/items?sort=${encodeURIComponent(sort)}`
  })).items;
}

export async function updateV3KnowledgeItem(item: V3KnowledgeItem): Promise<V3KnowledgeItem> {
  return unwrapApiResponse(await runtimeJson<{ item: V3KnowledgeItem }>({
    path: `/v3/knowledge/items/${encodeURIComponent(item.itemId)}`, method: "PATCH",
    headers: { "Content-Type": "application/json" }, body: item
  })).item;
}

export async function deleteV3KnowledgeItem(itemId: string): Promise<{ itemId: string; deleted: boolean; deletionScope: "local_single_store" }> {
  return unwrapApiResponse(await runtimeJson<{ itemId: string; deleted: boolean; deletionScope: "local_single_store" }>({
    path: `/v3/knowledge/items/${encodeURIComponent(itemId)}`, method: "DELETE"
  }));
}

export async function listKnowledgeSources(workspaceId = "ws_default"): Promise<KnowledgeSource[]> {
  const body = unwrapApiResponse(await runtimeJson<{ workspaceId: string; sources: KnowledgeSource[]; cursor: string | null }>({
    path: `/v1/knowledge/sources?workspaceId=${encodeURIComponent(workspaceId)}`
  }));
  return body.sources;
}

export async function getKnowledgeSource(sourceId: string): Promise<KnowledgeSource> {
  const body = unwrapApiResponse(await runtimeJson<{ source: KnowledgeSource }>({ path: `/v1/knowledge/sources/${encodeURIComponent(sourceId)}` }));
  return body.source;
}

export async function askKnowledgeSources(input: { workspaceId: string; question: string; sourceIds?: string[] }): Promise<KnowledgeQueryResult> {
  return unwrapApiResponse(await runtimeJson<KnowledgeQueryResult>({
    path: "/v1/knowledge/query",
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: {
      workspaceId: input.workspaceId,
      question: input.question,
      sourceIds: input.sourceIds
    }
  }));
}

export async function getKnowledgeGraph(workspaceId = "ws_default"): Promise<KnowledgeGraph> {
  return unwrapApiResponse(await runtimeJson<KnowledgeGraph>({
    path: `/v1/knowledge/graph?workspaceId=${encodeURIComponent(workspaceId)}`
  }));
}

export async function grantKnowledgePermission(input: PermissionGrantInput): Promise<PermissionResult> {
  return unwrapApiResponse(await runtimeJson<PermissionResult>({
    path: "/v1/knowledge/permissions",
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: input
  }));
}

export async function listKnowledgePermissions(workspaceId: string): Promise<PermissionRoot[]> {
  return unwrapApiResponse(await runtimeJson<{ permissions: PermissionRoot[] }>({ path: `/v1/knowledge/permissions?workspaceId=${encodeURIComponent(workspaceId)}` })).permissions;
}

export async function scanKnowledgePermission(permissionRootId: string, workspaceId: string): Promise<PermissionScan> {
  return unwrapApiResponse(await runtimeJson<PermissionScan>({ path: `/v1/knowledge/permissions/${encodeURIComponent(permissionRootId)}/scan`, method: "POST", headers: { "Content-Type": "application/json" }, body: { workspaceId } }));
}

export async function importKnowledgeFiles(permissionRootId: string, input: { workspaceId: string; scanId: string; fileIds: string[] }, idempotencyKey: string): Promise<{ sources: KnowledgeSource[]; operations: KnowledgeOperation[]; idempotentReplay: boolean }> {
  return unwrapApiResponse(await runtimeJson<{ sources: KnowledgeSource[]; operations: KnowledgeOperation[]; idempotentReplay: boolean }>({ path: `/v1/knowledge/permissions/${encodeURIComponent(permissionRootId)}/imports`, method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey }, body: input }));
}

export async function revokeKnowledgePermission(permissionRootId: string): Promise<PermissionResult> {
  return unwrapApiResponse(await runtimeJson<PermissionResult>({
    path: `/v1/knowledge/permissions/${encodeURIComponent(permissionRootId)}`,
    method: "DELETE"
  }));
}

export async function forgetKnowledgeSource(sourceId: string, confirmationText: string): Promise<ForgetSourceResult> {
  const body = await runtimeJson<ForgetSourceResult>({
    path: `/v1/knowledge/sources/${encodeURIComponent(sourceId)}/forget`,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: { confirmationText }
  });
  const result = unwrapApiResponse(body);
  if (!isForgetSourceResult(result)) {
    throw new RuntimeRequestError({
      kind: "api",
      message: "Forget Source 返回了无效的验证结果。",
      code: "INVALID_RUNTIME_RESPONSE",
      reason: "forget_verification_shape_invalid",
      requestId: body.request_id
    });
  }
  return result;
}

export function isForgetSourceResult(value: unknown): value is ForgetSourceResult {
  if (!value || typeof value !== "object") return false;
  const result = value as Partial<ForgetSourceResult>;
  const verification = result.verification;
  const operation = result.operation;
  return Boolean(
    verification
    && typeof verification === "object"
    && typeof verification.verificationId === "string"
    && typeof verification.forgetRequestId === "string"
    && typeof verification.sourceId === "string"
    && typeof verification.libraryAbsent === "boolean"
    && typeof verification.askAbsent === "boolean"
    && typeof verification.graphAbsent === "boolean"
    && typeof verification.traceAbsent === "boolean"
    && typeof verification.verifiedAt === "string"
    && operation
    && typeof operation === "object"
    && typeof operation.operationId === "string"
    && typeof operation.operationType === "string"
    && typeof operation.status === "string"
    && typeof operation.createdAt === "string"
  );
}

export function isForgetSourceVerified(value: unknown): value is ForgetSourceResult {
  return isForgetSourceResult(value)
    && value.operation.status === "succeeded"
    && value.verification.libraryAbsent === true
    && value.verification.askAbsent === true
    && value.verification.graphAbsent === true
    && value.verification.traceAbsent === true;
}

export async function saveCurrentPageToKnowledge(context: ExtractedPageContext): Promise<SaveKnowledgeSourceResult> {
  const snapshotText = (context.cleaned_text || context.visible_text || context.title).slice(0, 24_000);
  const snapshotBytes = new TextEncoder().encode(snapshotText);
  const snapshotSha256 = await sha256Hex(snapshotBytes);
  const idempotencyKey = knowledgeIdempotencyKey(context, snapshotSha256);
  const candidate = {
    candidateId: `cand_${crypto.randomUUID().replace(/-/g, "")}`,
    workspaceId: "ws_default",
    sourceType: "web_page",
    title: context.title,
    url: context.url,
    pageId: `page_${hashString(`${context.url}:${context.captured_at}`)}`,
    createdAt: context.captured_at || new Date().toISOString(),
    idempotencyKey,
    artifactIds: [],
    sourceRefs: knowledgeEvidenceRefs(context),
    contentSnapshot: {
      encoding: "utf8",
      text: snapshotText,
      byteLength: snapshotBytes.byteLength,
      sha256: snapshotSha256
    }
  };
  return unwrapApiResponse(await runtimeJson<SaveKnowledgeSourceResult>({
    path: "/v1/knowledge/sources",
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
    body: candidate
  }));
}

export async function streamRuntimeChat(
  sessionId: string | null,
  message: string,
  onEvent: (event: AgentEvent) => void | Promise<void>,
  overrides?: {
    coreProvider?: CoreProviderId;
    llmProviderId?: string;
    model?: string;
    intentHint?: ChatIntent;
    autoContext?: boolean;
    pageId?: string;
    pageContextRef?: string;
    profile?: RuntimeProfile;
  }
): Promise<void> {
  const request = {
    path: "/v1/chat/stream",
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: {
      ...(sessionId ? { session_id: sessionId } : {}),
      message,
      source: "typed",
      request_id: `req_${crypto.randomUUID().replace(/-/g, "")}`,
      ...overrides
    }
  };
  if (shouldUseRuntimeProxy()) return streamRuntimeChatViaProxy(request, onEvent);
  const response = await fetch(`${RUNTIME_URL}/v1/chat/stream`, {
    method: request.method,
    headers: request.headers,
    body: JSON.stringify(request.body)
  });
  if (!response.body) throw new Error("SSE response body is empty.");
  await readSse(response.body, onEvent);
}

export function restoreMessages(restored: RestoredSession): ChatMessage[] {
  const artifactsByTurn = new Map((restored.artifacts ?? []).map((artifact) => [artifact.turnId, artifact]));
  return (restored.messages ?? [])
    .filter((message) => message.role === "user" || message.role === "assistant" || message.role === "system")
    .map((message) => ({
      id: message.message_id,
      role: message.role,
      text: message.content,
      turnId: message.turn_id,
      artifact: message.turn_id ? artifactsByTurn.get(message.turn_id) : undefined
    }));
}

export function restoreChatSessionMessages(restored: ChatSessionMessagesResponse): ChatMessage[] {
  const artifactsByTurn = new Map<string, ArtifactRecord[]>();
  for (const artifact of restored.artifacts ?? []) {
    const existing = artifactsByTurn.get(artifact.turnId) ?? [];
    existing.push(artifact);
    artifactsByTurn.set(artifact.turnId, existing);
  }
  return (restored.messages ?? [])
    .filter((message) => message.role === "user" || message.role === "assistant" || message.role === "system")
    .map((message) => {
      const artifacts = message.turnId ? artifactsByTurn.get(message.turnId) ?? [] : [];
      return {
        id: message.id,
        role: message.role,
        text: message.content,
        turnId: message.turnId,
        artifact: artifacts[0],
        artifacts
      };
    });
}

async function readSse(stream: ReadableStream<Uint8Array>, onEvent: (event: AgentEvent) => void | Promise<void>) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parsed = parseSseBlocks(buffer);
    buffer = parsed.remainder;
    for (const event of parsed.events) {
      await onEvent(event);
    }
  }
}

type RuntimeRequest = {
  path: string;
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
};

type RuntimeProxyResponse<T> = {
  ok: boolean;
  response?: { status: number; ok: boolean; body: ApiResponse<T> };
  error?: string;
};

async function runtimeJson<T>(request: RuntimeRequest): Promise<ApiResponse<T>> {
  const knowledgeRequest = request.path.startsWith("/v1/knowledge/") || request.path.startsWith("/v3/knowledge/");
  const visionProviderRequest = request.path.startsWith("/v1/vision/providers");
  const authenticatedRequest = knowledgeRequest || visionProviderRequest;
  const requestId = `req_${crypto.randomUUID().replace(/-/g, "")}`;
  const generation = localRuntimeSession.generation;
  const controllerId = knowledgeRequest ? ++localRuntimeControllerId : null;
  const controller = knowledgeRequest ? new AbortController() : null;
  if (controllerId !== null && controller) localRuntimeSession.controllers.set(controllerId, controller);

  const headers = {
    ...request.headers,
    "X-Request-ID": requestId,
    ...(authenticatedRequest && localRuntimeSession.token
      ? { Authorization: `Bearer ${localRuntimeSession.token}` }
      : {})
  };
  const preparedRequest = { ...request, headers };
  let responseBytesObserved = false;

  try {
    if (authenticatedRequest && shouldUseRuntimeProxy() && localRuntimeSession.token) {
      throw new RuntimeRequestError({
        kind: "api",
        message: "会话凭据仅允许在 Navia 扩展页面使用。",
        code: "CREDENTIAL_SCOPE_VIOLATION",
        reason: "content_script_proxy_forbidden",
        requestId
      });
    }
    if (shouldUseRuntimeProxy()) {
      const proxied = (await chrome.runtime.sendMessage({
        type: "navia.runtimeFetch",
        request: preparedRequest
      })) as RuntimeProxyResponse<T>;
      if (!proxied.ok || !proxied.response) {
        throw new RuntimeRequestError({
          kind: "transport",
          message: proxied.error ?? "Runtime proxy failed.",
          reason: "runtime_proxy_failed",
          requestId
        });
      }
      if (knowledgeRequest && generation !== localRuntimeSession.generation) throw staleRuntimeRequestError(requestId);
      return classifyRuntimeResponse(proxied.response.body, proxied.response.status, requestId, authenticatedRequest);
    }

    const requestBody = preparedRequest.body === undefined ? undefined : JSON.stringify(preparedRequest.body);
    const requestObservation = emitR2RuntimeObservation({
      phase: "request",
      method: preparedRequest.method ?? "GET",
      url: `${RUNTIME_URL}${preparedRequest.path}`,
      requestId,
      contentType: request.headers?.["Content-Type"] ?? request.headers?.["content-type"] ?? null,
      bodyBase64: requestBody === undefined || visionProviderRequest ? null : bytesToBase64(new TextEncoder().encode(requestBody)),
      secretBodyRedacted: visionProviderRequest,
      containsPrivatePath: Boolean(preparedRequest.body && typeof preparedRequest.body === "object" && "path" in preparedRequest.body)
    });
    const responsePromise = fetch(`${RUNTIME_URL}${preparedRequest.path}`, {
      method: preparedRequest.method ?? "GET",
      headers: preparedRequest.headers,
      body: requestBody,
      signal: controller?.signal
    });
    await requestObservation;
    const response = await responsePromise;
    if (knowledgeRequest && generation !== localRuntimeSession.generation) throw staleRuntimeRequestError(requestId);
    let body: ApiResponse<T>;
    try {
      const responseBytes = new Uint8Array(await response.arrayBuffer());
      responseBytesObserved = true;
      await emitR2RuntimeObservation({
        phase: "response",
        method: preparedRequest.method ?? "GET",
        url: `${RUNTIME_URL}${preparedRequest.path}`,
        requestId,
        status: response.status,
        contentType: response.headers.get("content-type"),
        bodyBase64: bytesToBase64(responseBytes)
      });
      body = JSON.parse(new TextDecoder().decode(responseBytes)) as ApiResponse<T>;
    } catch {
      throw new RuntimeRequestError({
        kind: "api",
        message: "Runtime 返回了无效的 JSON。",
        httpStatus: response.status,
        code: "INVALID_RUNTIME_RESPONSE",
        reason: "invalid_json",
        requestId
      });
    }
    if (knowledgeRequest && generation !== localRuntimeSession.generation) throw staleRuntimeRequestError(body.request_id ?? requestId);
    return classifyRuntimeResponse(body, response.status, requestId, authenticatedRequest);
  } catch (error) {
    if (!responseBytesObserved) {
      await emitR2RuntimeObservation({
        phase: "transport_failure",
        method: preparedRequest.method ?? "GET",
        url: `${RUNTIME_URL}${preparedRequest.path}`,
        requestId,
        error: error instanceof Error ? error.message : "Runtime transport failed"
      });
    }
    if (isRuntimeRequestError(error)) throw error;
    if (knowledgeRequest && (generation !== localRuntimeSession.generation || isAbortError(error))) {
      throw staleRuntimeRequestError(requestId);
    }
    throw new RuntimeRequestError({
      kind: "transport",
      message: error instanceof Error ? error.message : "Runtime 当前不可达",
      reason: "runtime_transport_failed",
      requestId
    });
  } finally {
    if (controllerId !== null) localRuntimeSession.controllers.delete(controllerId);
  }
}

async function emitR2RuntimeObservation(observation: Record<string, unknown>): Promise<void> {
  if (typeof __NAVIA_E2E_BRIDGE__ === "undefined" || !__NAVIA_E2E_BRIDGE__) return;
  if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) return;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const acknowledgement = await chrome.runtime.sendMessage({ type: "navia.e2e.r2.runtime_observation", observation });
      if (acknowledgement?.ok === true) return;
    } catch {
      // Retry only the E2E transport; the Background de-duplicates phase/requestId.
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

function classifyRuntimeResponse<T>(body: ApiResponse<T>, status: number, fallbackRequestId: string, authenticatedRequest: boolean): ApiResponse<T> {
  if (!authenticatedRequest) return body;
  const requestId = body.request_id ?? fallbackRequestId;
  const code = body.error?.code;
  const detailsReason = body.error?.details?.reason;
  const reason = typeof detailsReason === "string" ? detailsReason : body.error?.message;
  if (status === 401 || status === 403) {
    const error = new RuntimeRequestError({
      kind: "authentication",
      message: body.error?.message ?? "会话认证失效，请重新输入 Runtime 令牌",
      httpStatus: status,
      code,
      reason,
      requestId
    });
    clearLocalRuntimeSession();
    throw error;
  }
  if (status < 200 || status >= 300 || !body.ok || body.data === null) {
    throw new RuntimeRequestError({
      kind: "api",
      message: body.error?.message ?? `Runtime request failed with HTTP ${status}.`,
      httpStatus: status,
      code,
      reason,
      requestId
    });
  }
  return body;
}

function staleRuntimeRequestError(requestId: string): RuntimeRequestError {
  return new RuntimeRequestError({
    kind: "stale",
    message: "Runtime 会话已变化，忽略旧请求结果。",
    code: "STALE_RUNTIME_SESSION",
    reason: "credential_generation_changed",
    requestId
  });
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException
    ? error.name === "AbortError"
    : error instanceof Error && error.name === "AbortError";
}

function shouldUseRuntimeProxy(): boolean {
  return typeof chrome !== "undefined" && Boolean(chrome.runtime?.sendMessage) && window.location.protocol !== "chrome-extension:";
}

function knowledgeIdempotencyKey(context: ExtractedPageContext, snapshotSha256: string): string {
  return `navia-v2-${hashString(`${context.url}:${snapshotSha256}`)}`;
}

function knowledgeEvidenceRefs(context: ExtractedPageContext): Array<Record<string, unknown>> {
  const firstBlock = context.dom_signals?.blocks?.find((block) => block.text?.trim());
  const textQuote = (firstBlock?.text || context.cleaned_text || context.visible_text || context.title).slice(0, 500);
  const ref: Record<string, unknown> = {
    evidenceRefId: `ev_${hashString(`${context.url}:${textQuote}`)}`,
    sourceId: "src_pending",
    locatorType: firstBlock?.selector ? "dom_selector" : "fallback_text",
    selector: firstBlock?.selector,
    textQuote,
    status: firstBlock?.selector ? "located" : "fallback_shown",
    fallbackText: textQuote,
    redactionApplied: true
  };
  return [Object.fromEntries(Object.entries(ref).filter(([, value]) => value !== undefined))];
}

function hashString(value: string): string {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash).toString(36).padStart(8, "0");
}

async function sha256Hex(value: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", Uint8Array.from(value).buffer);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function streamRuntimeChatViaProxy(request: RuntimeRequest, onEvent: (event: AgentEvent) => void | Promise<void>): Promise<void> {
  const port = chrome.runtime.connect({ name: "navia.runtimeStream" });
  let buffer = "";
  let eventChain = Promise.resolve();
  return new Promise((resolve, reject) => {
    port.onMessage.addListener((message) => {
      if (message?.type === "chunk" && typeof message.text === "string") {
        buffer += message.text;
        const parsed = parseSseBlocks(buffer);
        buffer = parsed.remainder;
        eventChain = parsed.events.reduce((chain, event) => chain.then(() => onEvent(event)), eventChain);
        void eventChain.catch((error) => {
          port.disconnect();
          reject(error instanceof Error ? error : new Error("Runtime stream event handling failed."));
        });
        return;
      }
      if (message?.type === "done") {
        void eventChain
          .then(() => {
            port.disconnect();
            resolve();
          })
          .catch((error) => {
            port.disconnect();
            reject(error instanceof Error ? error : new Error("Runtime stream event handling failed."));
          });
        return;
      }
      if (message?.type === "error") {
        port.disconnect();
        reject(new Error(String(message.message ?? "Runtime stream proxy failed.")));
      }
    });
    port.postMessage({ type: "navia.runtimeStream", request });
  });
}

function unwrapApiResponse<T>(body: ApiResponse<T>): T {
  if (!body.ok || body.data === null) {
    const detailsReason = body.error?.details?.reason;
    throw new RuntimeRequestError({
      kind: "api",
      message: body.error?.message ?? "Runtime request failed.",
      code: body.error?.code,
      reason: typeof detailsReason === "string" ? detailsReason : body.error?.message,
      requestId: body.request_id
    });
  }
  return body.data;
}
