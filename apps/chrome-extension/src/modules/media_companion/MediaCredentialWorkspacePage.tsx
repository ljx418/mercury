import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import {
  bootstrapMediaCaptureGrant,
  bootstrapMediaCredentialChannel,
  cancelMediaTranscriptProjection,
  resolveMediaAcquisition,
  executeMediaAcquisition,
  getMediaCaptureEligibility,
  recordMediaCaptureRouteFailure,
  cancelLocalMediaImport,
  createLocalMediaImport,
  getLocalMediaImport,
  type MediaAcquisitionInput
} from "../../runtimeClient";
import { createLocalImportRuntimeClient, localImportSessionGeneration } from "./createLocalImportRuntimeClient";
import { hasPublishedMediaProjection, localImportEntryEligible, mediaNavigationIdentity } from "./localImportEntry";
import { LocalMediaImportCard } from "./settings/LocalMediaImportCard";
import { LocalRuntimeAccess, type LocalRuntimeAccessChange } from "../knowledge_workspace/LocalRuntimeAccess";
import { MediaConsentCard } from "./MediaConsentCard";
import { MediaCredentialLeaseCard, type MediaCredentialLeaseUiState } from "./MediaCredentialLeaseCard";
import { MediaCaptureMessageClient, TrustedTabCaptureCard } from "./capture";
import {
  MediaAcquisitionClient,
  MediaAcquisitionStatusCard,
  MediaTranscriptQuickCard,
  createChromeMediaContextCollector,
  mediaSourceIdentity,
  waitForMediaTranscript,
  useMediaAcquisitionTask,
  type MediaAcquisitionUiState
} from "./acquisition";
import { resolveMediaPortalAdapter } from "./MediaPortalRegistry";
import {
  BILIBILI_CONSENT_SCOPE_ITEMS,
  BILIBILI_SESSION_POLICY_DEFINITION,
  PortalCredentialChannelClient,
  PortalCredentialMessageClient,
  PortalPermissionClient,
  PortalSessionMessageClient,
  createBilibiliBrowserSessionRegistry,
  isPortalCredentialLease,
  type MediaConsentPolicyRecord,
  type PortalCredentialLease,
  type PortalSessionCapability
} from "./session";

export function MediaCredentialWorkspacePage() {
  const registry = useMemo(() => createBilibiliBrowserSessionRegistry(), []);
  const permissionClient = useMemo(() => new PortalPermissionClient({ registry, permissionsApi: chrome.permissions }), [registry]);
  const sessionMessages = useMemo(() => new PortalSessionMessageClient({ sendMessage: (message) => chrome.runtime.sendMessage(message) }), []);
  const credentialClient = useMemo(() => {
    const messages = new PortalCredentialMessageClient({ sendMessage: (message) => chrome.runtime.sendMessage(message) });
    return new PortalCredentialChannelClient({ runtime: { createChannel: bootstrapMediaCredentialChannel }, messages });
  }, []);
  const captureMessages = useMemo(() => new MediaCaptureMessageClient((message) => chrome.runtime.sendMessage(message)), []);
  const acquisitionClient = useMemo(() => new MediaAcquisitionClient({
    collectCurrentContext: createChromeMediaContextCollector(),
    resolve: resolveMediaAcquisition,
    execute: executeMediaAcquisition,
    recordPublicSubtitleFailure: recordMediaCaptureRouteFailure
  }), []);
  const [adapterId, setAdapterId] = useState<string | null>(null);
  const [policy, setPolicy] = useState<MediaConsentPolicyRecord | null>(null);
  const [capability, setCapability] = useState<PortalSessionCapability | null>(null);
  const [busy, setBusy] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [runtimeConnected, setRuntimeConnected] = useState(false);
  const [credentialState, setCredentialState] = useState<MediaCredentialLeaseUiState>("idle");
  const [lease, setLease] = useState<PortalCredentialLease | null>(null);
  const [authoritativeTaskId, setAuthoritativeTaskId] = useState<string | null>(null);
  const [credentialError, setCredentialError] = useState<string | null>(null);
  const [captureEligibility, setCaptureEligibility] = useState<Awaited<ReturnType<typeof getMediaCaptureEligibility>> | null>(null);
  const [captureState, setCaptureState] = useState<"awaiting_user" | "starting" | "capturing" | "stopping" | "transcribing" | "succeeded" | "failed">("awaiting_user");
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [acquisitionState, setAcquisitionState] = useState<MediaAcquisitionUiState>("idle");
  const [acquisitionInput, setAcquisitionInput] = useState<MediaAcquisitionInput | null>(null);
  const [acquisitionFailure, setAcquisitionFailure] = useState<string | null>(null);
  const [acquisitionSourceIdentity, setAcquisitionSourceIdentity] = useState<string | null>(null);
  const acquisitionSourceIdentityRef = useRef<string | null>(null);
  const navigationIdentityRef = useRef<string | null>(null);
  const [taskActionState, setTaskActionState] = useState<"cancelling" | "retrying" | null>(null);
  const taskAuthority = useMediaAcquisitionTask({ taskId: authoritativeTaskId ?? lease?.taskId, sourceIdentity: acquisitionSourceIdentity });
  // WP-B: ONE client per page identity, built by the production factory so the
  // Runtime URL, the bearer and the session generation have a single source.
  const localImportClient = useMemo(() => createLocalImportRuntimeClient(), []);
  const taskId = authoritativeTaskId ?? lease?.taskId ?? null;
  const sourceIdentity = acquisitionSourceIdentity;

  useEffect(() => {
    acquisitionSourceIdentityRef.current = acquisitionSourceIdentity;
  }, [acquisitionSourceIdentity]);

  async function monitorTranscript(taskId: string) {
    setAcquisitionState("transcribing");
    try {
      const task = await waitForMediaTranscript(taskId);
      if (task.state !== "succeeded") throw new Error(task.result?.failureCode ?? "V3_MEDIA_TRANSCRIPT_PROCESS_FAILED");
      setAcquisitionState("succeeded");
      setCaptureState("succeeded");
    } catch (error) {
      setAcquisitionState("failed");
      setCaptureState("failed");
      setAcquisitionFailure(error instanceof Error ? error.message : "V3_MEDIA_TRANSCRIPT_PROCESS_FAILED");
    }
  }

  async function refresh(nextAdapterId = adapterId) {
    if (!nextAdapterId) return;
    setBusy(true);
    setSessionError(null);
    try {
      const policyResponse = await sessionMessages.getPolicy(nextAdapterId);
      if (!policyResponse.ok) throw new Error(policyResponse.failureCode);
      setPolicy(policyResponse.value);
      if (policyResponse.value.status !== "granted") {
        setCapability(null);
        setCredentialState("idle");
        setLease(null);
        return;
      }
      const capabilityResponse = await sessionMessages.inspectCapability(nextAdapterId, policyResponse.value.policyRevision);
      if (!capabilityResponse.ok) throw new Error(capabilityResponse.failureCode);
      if (!capabilityResponse.value.ok) throw new Error(capabilityResponse.value.failureCode);
      setCapability(capabilityResponse.value.capability);
    } catch (error) {
      setCapability(null);
      setSessionError(error instanceof Error ? error.message : "会话候选检查失败");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    let active = true;
    void chrome.tabs.query({ currentWindow: true }).then((tabs) => {
      const matched = tabs.map((tab) => resolveMediaPortalAdapter(tab.url ?? "")).find(Boolean);
      if (!active || !matched) return;
      setAdapterId(matched.adapterId);
      void refresh(matched.adapterId);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!runtimeConnected || !adapterId) return;
    let active = true;
    let revision = 0;
    const collector = createChromeMediaContextCollector();

    const clearOldIdentity = () => {
      void localImportClient.abandonAll();
      acquisitionSourceIdentityRef.current = null;
      setAcquisitionSourceIdentity(null);
      setAuthoritativeTaskId(null);
      setLease(null);
      setCredentialState("idle");
      setAcquisitionState("idle");
      setAcquisitionInput(null);
      setAcquisitionFailure(null);
      setCaptureEligibility(null);
      setCaptureState("awaiting_user");
      setCaptureError(null);
    };

    const refreshIdentity = async () => {
      const requestRevision = ++revision;
      try {
        const context = await collector();
        if (!active || requestRevision !== revision) return;
        const nextIdentity = mediaSourceIdentity(context);
        const previousIdentity = acquisitionSourceIdentityRef.current;
        if (previousIdentity && previousIdentity !== nextIdentity) clearOldIdentity();
        acquisitionSourceIdentityRef.current = nextIdentity;
        setAcquisitionSourceIdentity(nextIdentity);
      } catch {
        // A navigation boundary already clears the old identity. A content
        // script that is still loading must not restore stale ownership.
      }
    };

    const inspectActiveTab = async () => {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!active) return;
      const tab = tabs.find((candidate) => typeof candidate.id === "number");
      const nextNavigation = mediaNavigationIdentity(tab?.url ?? "");
      if (navigationIdentityRef.current && nextNavigation && navigationIdentityRef.current !== nextNavigation) {
        clearOldIdentity();
      }
      navigationIdentityRef.current = nextNavigation;
      await refreshIdentity();
    };

    const onUpdated: Parameters<typeof chrome.tabs.onUpdated.addListener>[0] = (_tabId, changeInfo, tab) => {
      if (!tab.active) return;
      const nextNavigation = mediaNavigationIdentity(changeInfo.url ?? tab.url ?? "");
      if (changeInfo.url && navigationIdentityRef.current && nextNavigation !== navigationIdentityRef.current) {
        clearOldIdentity();
        navigationIdentityRef.current = nextNavigation;
      }
      if (changeInfo.status === "complete" || Boolean(changeInfo.url)) void refreshIdentity();
    };
    const onActivated = () => { void inspectActiveTab(); };

    void inspectActiveTab();
    chrome.tabs.onUpdated?.addListener(onUpdated);
    chrome.tabs.onActivated?.addListener(onActivated);
    return () => {
      active = false;
      revision += 1;
      chrome.tabs.onUpdated?.removeListener(onUpdated);
      chrome.tabs.onActivated?.removeListener(onActivated);
    };
  }, [runtimeConnected, adapterId, localImportClient]);

  async function authorize() {
    if (!adapterId || busy) return;
    setBusy(true);
    setSessionError(null);
    try {
      const permission = await permissionClient.request(adapterId);
      const response = permission.namedPermissionGranted && permission.hostPermissionGranted
        ? await sessionMessages.recordGrant(adapterId)
        : await sessionMessages.recordDenial(adapterId);
      if (!response.ok) throw new Error(response.failureCode);
      setPolicy(response.value);
      await refresh(adapterId);
    } catch (error) {
      setSessionError(error instanceof Error ? error.message : "浏览器权限请求失败");
    } finally {
      setBusy(false);
    }
  }

  async function deny() {
    if (!adapterId || busy) return;
    setBusy(true);
    try {
      const response = await sessionMessages.recordDenial(adapterId);
      if (!response.ok) throw new Error(response.failureCode);
      setPolicy(response.value);
      setCapability(null);
      setCredentialState("idle");
      setLease(null);
      setAcquisitionState("idle");
      setAcquisitionInput(null);
      setAcquisitionFailure(null);
      setCaptureEligibility(null);
      setAcquisitionSourceIdentity(null);
    } catch (error) {
      setSessionError(error instanceof Error ? error.message : "无法保存授权决定");
    } finally {
      setBusy(false);
    }
  }

  async function revoke() {
    if (!adapterId || busy) return;
    setBusy(true);
    try {
      const response = await sessionMessages.revokePolicy(adapterId);
      if (!response.ok) throw new Error(response.failureCode);
      setPolicy(response.value);
      setCapability(null);
      setCredentialState("idle");
      setLease(null);
      setAcquisitionState("idle");
      setAcquisitionInput(null);
      setAcquisitionFailure(null);
      setCaptureEligibility(null);
      setAcquisitionSourceIdentity(null);
    } catch (error) {
      setSessionError(error instanceof Error ? error.message : "撤销授权失败");
    } finally {
      setBusy(false);
    }
  }

  function onRuntimeAccess(change: LocalRuntimeAccessChange) {
    setRuntimeConnected(change.status === "connected");
    if (change.status !== "connected") {
      setCredentialState("idle");
      setLease(null);
      setCredentialError(null);
      setAcquisitionState("idle");
      setAcquisitionInput(null);
      setAcquisitionFailure(null);
      setAcquisitionSourceIdentity(null);
    }
  }

  async function establish() {
    if (adapterId !== "bilibili" || policy?.status !== "granted" || capability?.status !== "available" || !runtimeConnected) return;
    setCredentialState("establishing");
    setLease(null);
    setCredentialError(null);
    try {
      const result = await credentialClient.establish({
        taskId: `media_task_${crypto.randomUUID().replace(/-/g, "")}`,
        adapterId: BILIBILI_SESSION_POLICY_DEFINITION.adapterId,
        policyId: BILIBILI_SESSION_POLICY_DEFINITION.policyId,
        policyRevision: BILIBILI_SESSION_POLICY_DEFINITION.policyRevision,
        credentialNameSetSha256: BILIBILI_SESSION_POLICY_DEFINITION.credentialNameSetSha256
      });
      if (!result.ok) throw new Error(result.failureCode);
      if (!isPortalCredentialLease(result.value)) throw new Error("V3_MEDIA_CREDENTIAL_TRANSPORT_FAILED");
      setLease(result.value);
      setCredentialState("ready");
      setAcquisitionState("starting");
      try {
        const acquisition = await acquisitionClient.start(result.value, {
          policyId: BILIBILI_SESSION_POLICY_DEFINITION.policyId,
          policyRevision: BILIBILI_SESSION_POLICY_DEFINITION.policyRevision
        });
        setAuthoritativeTaskId(acquisition.taskId);
        if (acquisition.disposition !== "created") {
          const messages = new PortalCredentialMessageClient({ sendMessage: (message) => chrome.runtime.sendMessage(message) });
          const revoked = await messages.revokeLease(result.value.leaseId);
          if (!revoked.ok) throw new Error(revoked.failureCode);
          setLease(null);
        }
        setAcquisitionInput(acquisition.execution?.input ?? null);
        setAcquisitionSourceIdentity(mediaSourceIdentity(acquisition.context));
        setAcquisitionFailure(acquisition.failureCode);
        setAcquisitionState(acquisition.status);
        setCaptureEligibility(acquisition.eligibility);
        if (acquisition.execution?.transcript) void monitorTranscript(acquisition.execution.transcript.taskId);
      } catch (error) {
        setCaptureEligibility(null);
        setAcquisitionState("failed");
        setAcquisitionFailure(error instanceof Error ? error.message : "V3_MEDIA_TASK_INVALID");
      }
    } catch (error) {
      setCredentialState("failed");
      setCredentialError(error instanceof Error ? error.message : "V3_MEDIA_CREDENTIAL_TRANSPORT_FAILED");
    }
  }

  async function startCapture(event: MouseEvent<HTMLButtonElement>) {
    const trustedClick = event.nativeEvent.isTrusted;
    const userActivation = navigator.userActivation?.isActive === true;
    if (!trustedClick || !userActivation || !captureEligibility?.captureFallbackEligible || !lease) {
      setCaptureState("failed");
      setCaptureError("V3_MEDIA_CAPTURE_BACKGROUND_FORBIDDEN");
      return;
    }
    setCaptureState("starting");
    setCaptureError(null);
    try {
      const candidates = (await chrome.tabs.query({ currentWindow: true }))
        .filter((tab) => typeof tab.id === "number" && tab.url?.startsWith("https://www.bilibili.com/video/"));
      if (candidates.length !== 1) throw new Error("V3_MEDIA_CAPTURE_TAB_INVALID");
      const tab = candidates[0];
      const hash = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))))
        .map((byte) => byte.toString(16).padStart(2, "0")).join("");
      const capability = await bootstrapMediaCaptureGrant({
        taskId: lease.taskId,
        adapterId: lease.adapterId,
        pageIdentitySha256: await hash(tab.url!),
        tabId: tab.id!,
        tabIdSha256: await hash(String(tab.id)),
        surface: "workspace"
      });
      const response = await captureMessages.start({
        trustedClick,
        userActivation,
        grant: capability.grant,
        ticket: capability.ticket,
        sourceIdentity: acquisitionSourceIdentity ?? `portal:${lease.adapterId}:current:current:current`,
        acquisitionRecordId: `mar_${crypto.randomUUID().replace(/-/g, "")}`
      });
      if (!response.ok) throw new Error(response.failureCode);
      setCaptureState("capturing");
    } catch (error) {
      setCaptureState("failed");
      setCaptureError(error instanceof Error ? error.message : "V3_MEDIA_CAPTURE_START_FAILED");
    }
  }

  async function stopCapture(reason: "completed" | "cancelled") {
    setCaptureState("stopping");
    const response = await captureMessages.stop(reason);
    if (!response.ok) {
      setCaptureState("failed");
      setCaptureError(response.failureCode);
      return false;
    }
    if (response.state === "transcribing") {
      setCaptureState("transcribing");
      void monitorTranscript(response.transcript.taskId);
    } else {
      setCaptureState("awaiting_user");
    }
    return true;
  }

  async function cancelCurrentTask() {
    const projection = taskAuthority.projection;
    if (!projection || taskActionState) return;
    const startedAt = Date.now();
    setTaskActionState("cancelling");
    setCaptureError(null);
    try {
      if (projection.state === "capturing" && !(await stopCapture("cancelled"))) return;
      await cancelMediaTranscriptProjection(projection.taskId);
      setCaptureState("awaiting_user");
    } catch (error) {
      setCaptureError(error instanceof Error ? error.message : "V3_MEDIA_TASK_CANCEL_FAILED");
    } finally {
      const remaining = 600 - (Date.now() - startedAt);
      if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
      setTaskActionState(null);
    }
  }

  async function retryCurrentTask() {
    if (taskActionState) return;
    setTaskActionState("retrying");
    setCaptureError(null);
    setAcquisitionFailure(null);
    setCaptureEligibility(null);
    setCaptureState("awaiting_user");
    try {
      await establish();
    } finally {
      setTaskActionState(null);
    }
  }

  if (!adapterId) {
    return <main className="media-workspace-shell"><section className="media-workspace-empty" role="status"><h1>没有可用的当前视频</h1><p>请在同一浏览器窗口打开受支持的 B站视频详情页后重试。</p></section></main>;
  }

  const disabledReason = policy?.status !== "granted"
    ? "请先完成五项用途授权"
    : capability?.status !== "available"
      ? "请先刷新并确认当前浏览器会话候选"
      : !runtimeConnected
        ? "请先连接本机 Runtime"
        : null;

  return <main className="media-workspace-shell" data-testid="media-workspace-root">
    <header className="media-workspace-header">
      <div><span>V3 MEDIA COMPANION</span><h1>当前视频安全会话</h1></div>
      <a href="#/media/current" aria-current="page">当前视频</a>
    </header>
    <div className="media-workspace-content">
      <p className="media-workspace-boundary">当前视频任务优先使用授权字幕与媒体；三条路线均失败后才允许可信标签页音频回退。</p>
      <MediaConsentCard
        portalLabel="B站"
        policy={policy}
        capability={capability}
        scopes={BILIBILI_CONSENT_SCOPE_ITEMS}
        busy={busy}
        error={sessionError}
        onAuthorize={() => void authorize()}
        onDeny={() => void deny()}
        onRevoke={() => void revoke()}
        onRefresh={() => void refresh()}
      />
      {policy?.status === "granted" ? <LocalRuntimeAccess title="本机 Runtime 安全会话" onChange={onRuntimeAccess} /> : null}
      <MediaCredentialLeaseCard
        portalLabel="B站"
        state={credentialState}
        lease={lease}
        error={credentialError}
        disabled={disabledReason !== null}
        disabledReason={disabledReason}
        onStart={() => void establish()}
      />
      {taskAuthority.projection ? <MediaTranscriptQuickCard
        projection={taskAuthority.projection}
        actionState={taskActionState}
        credentialBinding={lease ? `${lease.leaseId}:${lease.envelopeId}` : undefined}
        onOpenWorkspace={() => { window.location.hash = `#/media/transcript/${taskAuthority.projection!.taskId}`; }}
        onCancel={() => void cancelCurrentTask()}
        onRetry={() => void retryCurrentTask()}
      /> : <MediaAcquisitionStatusCard state={acquisitionState} input={acquisitionInput} failureCode={acquisitionFailure ?? taskAuthority.error} />}
      {captureEligibility?.captureFallbackEligible ? <TrustedTabCaptureCard
        failures={captureEligibility.failures}
        state={captureState}
        error={captureError}
        onStart={(event) => void startCapture(event)}
        onFinish={() => void stopCapture("completed")}
        onCancel={() => void cancelCurrentTask()}
      /> : null}
      {/* WP-B: the explicit local import is a LAST RESORT. The single frozen
          predicate decides whether it is offered at all. */}
      {localImportEntryEligible({
        captureFallbackEligible: captureEligibility?.captureFallbackEligible === true,
        captureState,
        acquisitionState,
        hasProjection: hasPublishedMediaProjection(taskAuthority.projection),
        taskId,
        sourceIdentity
      }) ? (
        <LocalMediaImportCard
          eligible
          blockedReason="当前三种自动方式都不可用，可以选择一个本地视频文件继续。"
          taskId={taskId ?? ""}
          sourceIdentity={sourceIdentity ?? ""}
          client={localImportClient}
          generation={localImportSessionGeneration}
        />
      ) : null}
    </div>
  </main>;
}
