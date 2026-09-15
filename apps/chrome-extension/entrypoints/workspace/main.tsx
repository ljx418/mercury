import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";
import {
  WorkspaceRouter,
  type WorkspaceRoute,
  type WorkspaceRouteIntent,
  type WorkspaceRouterRenderProps
} from "../../src/modules/knowledge_workspace/WorkspaceRouter";
import {
  type KnowledgeGraph,
  type KnowledgeQueryResult,
  type KnowledgeServiceStatus,
  type KnowledgeSource,
  type KnowledgeWorkspace,
  type PermissionRoot,
  type ForgetSourceResult,
  type RuntimeStatus,
  createKnowledgeStatusPoller,
  askKnowledgeSources,
  forgetKnowledgeSource,
  getKnowledgeGraph,
  grantKnowledgePermission,
  isForgetSourceVerified,
  isRuntimeRequestError,
  isStaleRuntimeRequestError,
  listKnowledgePermissions,
  type PermissionGrantInput,
  revokeKnowledgePermission
} from "../../src/runtimeClient";
import {
  resolveWorkspaceAuthority,
  type WorkspaceAuthorityErrorCode,
  type WorkspaceAuthorityResolution
} from "../../src/modules/knowledge_workspace/workspaceAuthority";
import { SourceLibraryPanel } from "../../src/modules/knowledge_workspace/SourceLibraryPanel";
import { SourceDetailReader } from "../../src/modules/knowledge_workspace/SourceDetailReader";
import { AskWithSourcesPanel } from "../../src/modules/knowledge_workspace/AskWithSourcesPanel";
import { EvidenceTraceDrawer } from "../../src/modules/knowledge_workspace/EvidenceTraceDrawer";
import { KnowledgeGraphCanvas } from "../../src/modules/knowledge_workspace/KnowledgeGraphCanvas";
import { PermissionRootManager } from "../../src/modules/knowledge_workspace/PermissionRootManager";
import { ForgetSourceDialog } from "../../src/modules/knowledge_workspace/ForgetSourceDialog";
import { DataServiceStatusCard } from "../../src/modules/knowledge_workspace/DataServiceStatusCard";
import { LocalRuntimeAccess, type LocalRuntimeAccessChange } from "../../src/modules/knowledge_workspace/LocalRuntimeAccess";

type AuthorityResolver = (route: WorkspaceRoute) => Promise<WorkspaceAuthorityResolution>;

const ROUTE_LABELS: Record<WorkspaceRouteIntent, string> = {
  source_library: "来源库",
  source_detail: "来源详情",
  ask: "证据问答",
  graph: "知识图谱",
  permissions: "权限"
};

function App() {
  return (
    <WorkspaceRouter>
      {(router) => <WorkspacePage router={router} />}
    </WorkspaceRouter>
  );
}

export function WorkspacePage({
  router,
  authorityResolver = resolveWorkspaceAuthority
}: {
  router: WorkspaceRouterRenderProps;
  authorityResolver?: AuthorityResolver;
}) {
  const route = router.resolution.ok ? router.resolution.route : null;
  const [runtimeStatus, setRuntimeStatus] = useState<RuntimeStatus>("checking");
  const [serviceStatus, setServiceStatus] = useState<KnowledgeServiceStatus | null>(null);
  const [workspaces, setWorkspaces] = useState<KnowledgeWorkspace[]>([]);
  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [selectedSource, setSelectedSource] = useState<KnowledgeSource | null>(null);
  const [graph, setGraph] = useState<KnowledgeGraph | null>(null);
  const [authorityError, setAuthorityError] = useState<WorkspaceAuthorityErrorCode | null>(null);
  const [recoveryWorkspaceId, setRecoveryWorkspaceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const [loadedPath, setLoadedPath] = useState<string | null>(null);
  const [queryResult, setQueryResult] = useState<KnowledgeQueryResult | null>(null);
  const [askLoading, setAskLoading] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<PermissionRoot[]>([]);
  const [governanceLoading, setGovernanceLoading] = useState(false);
  const [governanceError, setGovernanceError] = useState<string | null>(null);
  const [forgetResult, setForgetResult] = useState<ForgetSourceResult | null>(null);
  const [traceOpen, setTraceOpen] = useState(false);
  const [forgetOpen, setForgetOpen] = useState(false);
  const [runtimeSessionGeneration, setRuntimeSessionGeneration] = useState(0);
  const overlayTrigger = useRef<HTMLElement | null>(null);

  const refresh = useCallback(() => setRefreshToken((value) => value + 1), []);
  const clearKnowledgeSensitiveState = useCallback(() => {
    setServiceStatus(null);
    setSources([]);
    setSelectedSource(null);
    setGraph(null);
    setQueryResult(null);
    setAskError(null);
    setPermissions([]);
    setGovernanceError(null);
    setForgetResult(null);
    setTraceOpen(false);
    setForgetOpen(false);
    setLoadedPath(null);
  }, []);
  const handleRuntimeAccessChange = useCallback((change: LocalRuntimeAccessChange) => {
    setRuntimeSessionGeneration(change.generation);
    clearKnowledgeSensitiveState();
    if (change.status === "connected") {
      setRuntimeStatus("online");
      refresh();
    }
  }, [clearKnowledgeSensitiveState, refresh]);

  useEffect(() => {
    let observedOffline = false;
    const poller = createKnowledgeStatusPoller({
      onStatus(status) {
        setRuntimeStatus("online");
        setServiceStatus(status);
        if (observedOffline) {
          observedOffline = false;
          refresh();
        }
      },
      onOffline(error) {
        if (isStaleRuntimeRequestError(error)) return;
        observedOffline = true;
        setRuntimeStatus(isRuntimeRequestError(error) && error.kind !== "transport" ? "online" : "offline");
        setServiceStatus(null);
        setSources([]);
        setSelectedSource(null);
        setGraph(null);
      }
    });
    poller.start();
    return () => poller.stop();
  }, [refresh]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setAuthorityError(null);
      setRecoveryWorkspaceId(null);
      setLoadError(null);
      setSelectedSource(null);
      setGraph(null);
      setSources([]);
      setQueryResult(null);
      setPermissions([]);
      setLoadedPath(null);
      if (!route) return;
      setLoading(true);
      setRuntimeStatus("checking");
      try {
        const authority = await authorityResolver(route);
        if (cancelled) return;
        if (authority.kind === "offline") {
          setRuntimeStatus("offline");
          setServiceStatus(null);
          setWorkspaces([]);
          setSources([]);
          return;
        }
        setRuntimeStatus("online");
        setWorkspaces(authority.workspaces);
        if (authority.kind === "authority_error") {
          setAuthorityError(authority.errorCode);
          setRecoveryWorkspaceId(authority.recoveryWorkspaceId ?? null);
          setServiceStatus(null);
          setSources([]);
          return;
        }
        setServiceStatus(authority.serviceStatus);
        setSources(authority.sources);
        setSelectedSource(authority.selectedSource);
        setGraph(authority.graph);
        setLoadedPath(route.resolvedPath);
        if (route.routeIntent === "permissions") {
          try {
            const records = await listKnowledgePermissions(route.workspaceId);
            if (!cancelled) { setPermissions(records); setGovernanceError(null); }
          } catch (failure) {
            if (isStaleRuntimeRequestError(failure)) return;
            if (!cancelled) setGovernanceError(failure instanceof Error ? failure.message : "权限列表不可用");
          }
        }
      } catch (error) {
        if (isStaleRuntimeRequestError(error)) return;
        if (cancelled) return;
        setLoadError(error instanceof Error ? error.message : "Workspace 数据读取失败。");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [authorityResolver, route?.resolvedPath, refreshToken]);

  const activeWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.workspaceId === route?.workspaceId) ?? null,
    [route?.workspaceId, workspaces]
  );

  const rememberOverlayTrigger = () => { overlayTrigger.current = document.activeElement as HTMLElement | null; };
  const closeOverlay = (close: () => void) => {
    close();
    queueMicrotask(() => overlayTrigger.current?.focus());
  };
  const ask = async (question: string) => {
    if (!route) return;
    setAskLoading(true);
    setAskError(null);
    try {
      setQueryResult(await askKnowledgeSources({ workspaceId: route.workspaceId, question }));
    } catch (error) {
      if (isStaleRuntimeRequestError(error)) return;
      setAskError(error instanceof Error ? error.message : "Ask with Sources 失败。");
    } finally {
      setAskLoading(false);
    }
  };
  const refreshGraph = async () => {
    if (!route) return;
    try { setGraph(await getKnowledgeGraph(route.workspaceId)); }
    catch (error) {
      if (isStaleRuntimeRequestError(error)) return;
      setLoadError(error instanceof Error ? error.message : "Knowledge Graph 加载失败。");
    }
  };
  const grantPermission = async (input: PermissionGrantInput) => {
    setGovernanceLoading(true);
    setGovernanceError(null);
    try {
      const result = await grantKnowledgePermission(input);
      setPermissions((current) => [result.permissionRoot, ...current.filter((item) => item.permissionRootId !== result.permissionRoot.permissionRootId)]);
    } catch (error) {
      if (isStaleRuntimeRequestError(error)) return;
      setGovernanceError(error instanceof Error ? error.message : "PermissionRoot 授权失败。");
      throw error;
    } finally { setGovernanceLoading(false); }
  };
  const revokePermission = async (permissionRootId: string) => {
    setGovernanceLoading(true);
    setGovernanceError(null);
    try {
      const result = await revokeKnowledgePermission(permissionRootId);
      setPermissions((current) => current.map((item) => item.permissionRootId === permissionRootId ? result.permissionRoot : item));
    } catch (error) {
      if (isStaleRuntimeRequestError(error)) return;
      setGovernanceError(error instanceof Error ? error.message : "PermissionRoot 撤销失败。");
      throw error;
    } finally { setGovernanceLoading(false); }
  };
  const confirmForget = async () => {
    if (!route || !selectedSource) return;
    setGovernanceLoading(true);
    setGovernanceError(null);
    try {
      const result = await forgetKnowledgeSource(selectedSource.sourceId, "forget");
      setForgetResult(result);
      if (!isForgetSourceVerified(result)) {
        setGovernanceError("遗忘未完成");
        return;
      }
      setTraceOpen(false);
      setForgetOpen(false);
      router.navigate({ routeIntent: "source_library", workspaceId: route.workspaceId });
      refresh();
    } catch (error) {
      if (isStaleRuntimeRequestError(error)) return;
      setGovernanceError(isRuntimeRequestError(error) && error.code === "INVALID_RUNTIME_RESPONSE" ? "遗忘未完成" : error instanceof Error ? error.message : "Forget Source 失败。");
    } finally { setGovernanceLoading(false); }
  };

  if (!route) {
    return (
      <RouteError
        code="INVALID_ROUTE"
        detail={router.resolution.ok ? "" : router.resolution.attemptedPath}
        onRecover={() => router.recoverToLibrary()}
      />
    );
  }

  return (
    <div className="workspace-shell" data-testid="workspace-shell">
      <aside className="workspace-nav" aria-label="Knowledge Workspace 导航">
        <div className="workspace-brand">
          <span className="brand-mark" aria-hidden="true">N</span>
          <div><strong>Navia</strong><small>Knowledge Workspace</small></div>
        </div>
        <nav>
          {(["source_library", "ask", "graph", "permissions"] as const).map((intent) => (
            <button
              aria-current={route.routeIntent === intent || (intent === "source_library" && route.routeIntent === "source_detail") ? "page" : undefined}
              className={route.routeIntent === intent || (intent === "source_library" && route.routeIntent === "source_detail") ? "active" : ""}
              key={intent}
              onClick={() => router.navigate({ routeIntent: intent, workspaceId: route.workspaceId })}
              type="button"
            >
              {ROUTE_LABELS[intent]}
            </button>
          ))}
        </nav>
        <div className="workspace-nav-footer">
          <span>Workspace ID</span>
          <code>{route.workspaceId}</code>
        </div>
      </aside>

      <main className="workspace-main">
        <header className="workspace-header">
          <div>
            <p className="eyebrow">{ROUTE_LABELS[route.routeIntent]}</p>
            <h1>{activeWorkspace?.name ?? "Navia Knowledge"}</h1>
          </div>
          <button className="secondary-button" disabled={loading} onClick={refresh} type="button">
            {loading ? "正在刷新" : "刷新状态"}
          </button>
        </header>

        <DataServiceStatusCard runtimeStatus={runtimeStatus} status={serviceStatus} />
        <LocalRuntimeAccess workspaceId={route.workspaceId} onChange={handleRuntimeAccessChange} />

        {authorityError ? (
          <RouteError
            embedded
            code={authorityError}
            detail={route.resolvedPath}
            onRecover={recoveryWorkspaceId ? () => router.recoverToLibrary(recoveryWorkspaceId) : undefined}
            onRetry={refresh}
          />
        ) : runtimeStatus === "offline" ? (
          <OfflinePanel onRetry={refresh} />
        ) : loadError ? (
          <section className="notice-panel error" role="alert">
            <strong>Workspace 数据暂时不可用</strong>
            <p>{loadError}</p>
            <button onClick={refresh} type="button">重试</button>
          </section>
        ) : loading || loadedPath !== route.resolvedPath ? (
          <section className="loading-panel" aria-live="polite">正在从本地 Runtime 恢复 Workspace 权威状态…</section>
        ) : (
          <RouteContent
            route={route}
            sources={sources}
            source={selectedSource}
            graph={graph}
            navigate={router.navigate}
            activeWorkspace={activeWorkspace}
            queryResult={queryResult}
            askLoading={askLoading}
            askError={askError}
            permissions={permissions}
            runtimeSessionGeneration={runtimeSessionGeneration}
            governanceLoading={governanceLoading}
            governanceError={governanceError}
            onAsk={ask}
            onRefreshGraph={refreshGraph}
            onGrantPermission={grantPermission}
            onRevokePermission={revokePermission}
            onImported={() => {
              void listKnowledgePermissions(route.workspaceId)
                .then(setPermissions)
                .catch((error) => {
                  if (!isStaleRuntimeRequestError(error)) setGovernanceError(error instanceof Error ? error.message : "权限列表不可用");
                });
            }}
            onOpenTrace={() => { rememberOverlayTrigger(); setTraceOpen(true); }}
            onOpenForget={() => { rememberOverlayTrigger(); setForgetResult(null); setForgetOpen(true); }}
          />
        )}
      </main>
      <EvidenceTraceDrawer source={selectedSource} open={traceOpen} onClose={() => closeOverlay(() => setTraceOpen(false))} />
      <ForgetSourceDialog
        source={selectedSource}
        open={forgetOpen}
        loading={governanceLoading}
        error={governanceError}
        result={forgetResult}
        onCancel={() => closeOverlay(() => setForgetOpen(false))}
        onConfirm={() => void confirmForget()}
      />
    </div>
  );
}

function OfflinePanel({ onRetry }: { onRetry: () => void }) {
  return (
    <section className="notice-panel" data-testid="workspace-runtime-offline">
      <p className="eyebrow">Runtime offline</p>
      <h2>工作台页面已打开，但本地服务尚未连接</h2>
      <p>Navia 没有伪造 Adapter、data_service 或 source build 状态。启动本地 Runtime 后可在此重新连接。</p>
      <button onClick={onRetry} type="button">重新连接</button>
    </section>
  );
}

function RouteContent({
  route,
  sources,
  source,
  graph,
  navigate,
  activeWorkspace,
  queryResult,
  askLoading,
  askError,
  permissions,
  runtimeSessionGeneration,
  governanceLoading,
  governanceError,
  onAsk,
  onRefreshGraph,
  onGrantPermission,
  onRevokePermission,
  onImported,
  onOpenTrace,
  onOpenForget
}: {
  route: WorkspaceRoute;
  sources: KnowledgeSource[];
  source: KnowledgeSource | null;
  graph: KnowledgeGraph | null;
  navigate: WorkspaceRouterRenderProps["navigate"];
  activeWorkspace: KnowledgeWorkspace | null;
  queryResult: KnowledgeQueryResult | null;
  askLoading: boolean;
  askError: string | null;
  permissions: PermissionRoot[];
  runtimeSessionGeneration: number;
  governanceLoading: boolean;
  governanceError: string | null;
  onAsk: (question: string) => void;
  onRefreshGraph: () => void;
  onGrantPermission: (input: PermissionGrantInput) => Promise<void>;
  onRevokePermission: (permissionRootId: string) => Promise<void>;
  onImported: () => void;
  onOpenTrace: () => void;
  onOpenForget: () => void;
}) {
  if (route.routeIntent === "source_detail") {
    return source ? <SourceDetailReader source={source} onBack={() => navigate({ routeIntent: "source_library", workspaceId: route.workspaceId })} onOpenTrace={onOpenTrace} onForget={onOpenForget} /> : null;
  }

  if (route.routeIntent === "source_library") {
    return <SourceLibraryPanel workspace={activeWorkspace} sources={sources} onSelectSource={(sourceId) => navigate({ routeIntent: "source_detail", workspaceId: route.workspaceId, sourceId })} />;
  }

  if (route.routeIntent === "graph") {
    return <KnowledgeGraphCanvas graph={graph} onRefresh={onRefreshGraph} />;
  }
  if (route.routeIntent === "ask") return <AskWithSourcesPanel loading={askLoading} error={askError} result={queryResult} onAsk={onAsk} />;
  return <PermissionRootManager workspaceId={route.workspaceId} permissions={permissions} loading={governanceLoading} error={governanceError} sessionGeneration={runtimeSessionGeneration} onGrant={onGrantPermission} onRevoke={onRevokePermission} onImported={onImported} />;
}

function RouteError({ code, detail, embedded = false, onRecover, onRetry }: { code: string; detail: string; embedded?: boolean; onRecover?: () => void; onRetry?: () => void }) {
  const Element = embedded ? "section" : "main";
  return (
    <Element className="route-error-page" data-testid="workspace-route-error">
      <div className="route-error-code">{code}</div>
      <h1>无法打开这个 Knowledge route</h1>
      <p>Navia 没有加载默认 fixture，也没有改写 URL 中的稳定 ID。</p>
      <code>{detail}</code>
      <div className="error-actions">
        {onRecover ? <button onClick={onRecover} type="button">返回来源库</button> : <span>当前没有可恢复的 Workspace。</span>}
        {onRetry ? <button className="secondary-button" onClick={onRetry} type="button">重试</button> : null}
      </div>
    </Element>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("Workspace root element is missing.");
createRoot(root).render(<App />);
