import type {
  ForgetSourceResult,
  KnowledgeGraph,
  KnowledgeQueryResult,
  KnowledgeServiceStatus,
  KnowledgeSource,
  KnowledgeWorkspace,
  PermissionRoot,
  RuntimeStatus
} from "../../runtimeClient";
import { KnowledgeBuildStatus } from "./KnowledgeBuildStatus";
import { ServiceStatusBanner } from "./ServiceStatusBanner";

type KnowledgeWorkspaceShellProps = {
  runtimeStatus: RuntimeStatus;
  serviceStatus: KnowledgeServiceStatus | null;
  serviceLoading?: boolean;
  serviceError?: string | null;
  workspaces: KnowledgeWorkspace[];
  sources: KnowledgeSource[];
  selectedWorkspaceId: string;
  selectedSource: KnowledgeSource | null;
  loading?: boolean;
  error?: string | null;
  askQuestion: string;
  askLoading?: boolean;
  askError?: string | null;
  queryResult: KnowledgeQueryResult | null;
  graph: KnowledgeGraph | null;
  permissions: PermissionRoot[];
  permissionName: string;
  permissionPath: string;
  governanceLoading?: boolean;
  governanceError?: string | null;
  forgetResult: ForgetSourceResult | null;
  onRefreshStatus: () => void;
  onRefreshWorkspace: () => void;
  onOpenWorkspace?: () => void;
  onSelectWorkspace: (workspaceId: string) => void;
  onSelectSource: (sourceId: string) => void;
  onAskQuestionChange: (value: string) => void;
  onAskSources: () => void;
  onRefreshGraph: () => void;
  onPermissionNameChange: (value: string) => void;
  onPermissionPathChange: (value: string) => void;
  onGrantPermission: () => void;
  onRevokePermission: (permissionRootId: string) => void;
  onForgetSelectedSource: () => void;
};

export function KnowledgeWorkspaceShell({
  runtimeStatus,
  serviceStatus,
  serviceLoading = false,
  serviceError = null,
  workspaces,
  sources,
  selectedWorkspaceId,
  selectedSource,
  loading = false,
  error = null,
  askQuestion,
  askLoading = false,
  askError = null,
  queryResult,
  graph,
  permissions,
  permissionName,
  permissionPath,
  governanceLoading = false,
  governanceError = null,
  forgetResult,
  onRefreshStatus,
  onRefreshWorkspace,
  onOpenWorkspace,
  onSelectWorkspace,
  onSelectSource,
  onAskQuestionChange,
  onAskSources,
  onRefreshGraph,
  onPermissionNameChange,
  onPermissionPathChange,
  onGrantPermission,
  onRevokePermission,
  onForgetSelectedSource
}: KnowledgeWorkspaceShellProps) {
  const activeWorkspace = workspaces.find((workspace) => workspace.workspaceId === selectedWorkspaceId) ?? workspaces[0] ?? null;
  return (
    <section className="knowledge-workspace-shell" data-testid="v2-knowledge-workspace">
      <div className="panel-heading">
        <div>
          <h2>Knowledge</h2>
          <p className="muted">V2 个人知识库工作台壳层：来源、状态、证据和后续问答入口。</p>
        </div>
        <div className="knowledge-heading-actions">
          {onOpenWorkspace ? (
            <button className="primary-button" onClick={onOpenWorkspace} type="button">打开工作台</button>
          ) : null}
          <button className="ghost-button" disabled={loading} onClick={onRefreshWorkspace} type="button">
            {loading ? "刷新中" : "刷新"}
          </button>
        </div>
      </div>
      <ServiceStatusBanner
        runtimeStatus={runtimeStatus}
        status={serviceStatus}
        loading={serviceLoading}
        error={serviceError}
        onRefresh={onRefreshStatus}
      />
      <div className="knowledge-workspace-grid">
        <aside className="knowledge-workspace-sidebar" aria-label="Workspace and source library">
          <label className="knowledge-select-label">
            <span>Workspace</span>
            <select value={selectedWorkspaceId} onChange={(event) => onSelectWorkspace(event.target.value)}>
              {workspaces.map((workspace) => (
                <option value={workspace.workspaceId} key={workspace.workspaceId}>
                  {workspace.name}
                </option>
              ))}
            </select>
          </label>
          <div className="knowledge-library-header">
            <strong>Source Library</strong>
            <span>{sources.length} sources</span>
          </div>
          <div className="knowledge-source-list">
            {sources.length === 0 ? (
              <p className="muted">暂无已保存来源。请回到 Chat 读取并保存当前页。</p>
            ) : (
              sources.map((source) => (
                <button
                  className={`knowledge-source-row ${selectedSource?.sourceId === source.sourceId ? "active" : ""}`}
                  key={source.sourceId}
                  onClick={() => onSelectSource(source.sourceId)}
                  type="button"
                >
                  <strong>{source.title ?? source.sourceId}</strong>
                  <span>{source.status} · rev {source.revision}</span>
                </button>
              ))
            )}
          </div>
        </aside>
        <article className="knowledge-source-detail" aria-label="Knowledge source detail">
          {error ? <p className="knowledge-error">{error}</p> : null}
          {activeWorkspace ? (
            <div className="knowledge-workspace-summary">
              <div>
                <dt>Workspace</dt>
                <dd>{activeWorkspace.name}</dd>
              </div>
              <div>
                <dt>Sources</dt>
                <dd>{activeWorkspace.sourceCount}</dd>
              </div>
              <div>
                <dt>Pending</dt>
                <dd>{activeWorkspace.pendingBuildCount}</dd>
              </div>
            </div>
          ) : null}
          {selectedSource ? (
            <>
              <div className="knowledge-detail-title">
                <p className="knowledge-eyebrow">Source detail</p>
                <h3>{selectedSource.title ?? selectedSource.sourceId}</h3>
                <span>{selectedSource.originUrl ?? selectedSource.sourceType}</span>
              </div>
              <KnowledgeBuildStatus source={selectedSource} operation={null} status={serviceStatus} />
              <div className="knowledge-evidence-list">
                <strong>Evidence refs</strong>
                {(selectedSource.evidenceRefs ?? []).slice(0, 6).map((ref, index) => (
                  <div className="knowledge-evidence-row" key={`${selectedSource.sourceId}-${index}`}>
                    <span>{String(ref.locatorType ?? "fallback_text")}</span>
                    <p>{String(ref.textQuote ?? ref.fallbackText ?? ref.evidenceRefId ?? "No evidence text")}</p>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="knowledge-empty-state">
              <strong>选择一个 source 查看详情</strong>
              <p>V2-4 只实现工作台壳层；Ask with Sources、Graph Canvas、PermissionRoot 和 ForgetSource 将在后续子阶段实现。</p>
            </div>
          )}
        </article>
      </div>
      <div className="knowledge-qa-graph-grid">
        <section className="knowledge-ask-panel" aria-label="Ask with sources">
          <div className="knowledge-section-heading">
            <div>
              <strong>Ask with Sources</strong>
              <span>基于当前 workspace / 选中 source 的证据回答</span>
            </div>
            <button disabled={!sources.length || askLoading} onClick={onAskSources} type="button">
              {askLoading ? "回答中" : "提问"}
            </button>
          </div>
          <textarea
            value={askQuestion}
            onChange={(event) => onAskQuestionChange(event.target.value)}
            placeholder={sources.length ? "基于已保存来源问一个问题…" : "保存来源后可用"}
            rows={3}
          />
          {askError ? <p className="knowledge-error">{askError}</p> : null}
          {queryResult ? (
            <div className={`knowledge-answer-card knowledge-answer-card-${queryResult.status}`}>
              <strong>{queryResult.status === "degraded" ? "Degraded answer" : "Source-backed answer"}</strong>
              <p>{queryResult.answer || queryResult.degradedReason || "暂无可回答内容。"}</p>
              <small>{queryResult.evidenceRefs?.length ?? 0} evidence refs</small>
            </div>
          ) : null}
        </section>
        <section className="knowledge-graph-panel" aria-label="Knowledge graph">
          <div className="knowledge-section-heading">
            <div>
              <strong>Knowledge Graph</strong>
              <span>V2-5 轻量图谱预览，非完整 RAG 图谱</span>
            </div>
            <button disabled={!sources.length} onClick={onRefreshGraph} type="button">刷新图谱</button>
          </div>
          {graph && graph.nodes.length ? (
            <div className="knowledge-graph-preview">
              {graph.nodes.slice(0, 10).map((node) => (
                <span className={`knowledge-graph-node knowledge-graph-node-${node.type}`} key={node.id} title={node.id}>
                  {node.label}
                </span>
              ))}
              <small>{graph.edges.length} edges · {graph.status}</small>
            </div>
          ) : (
            <p className="muted">暂无图谱节点。保存 source 后刷新图谱。</p>
          )}
        </section>
      </div>
      <div className="knowledge-governance-grid">
        <section className="knowledge-permission-panel" aria-label="Permission roots">
          <div className="knowledge-section-heading">
            <div>
              <strong>PermissionRoot</strong>
              <span>显式授权记录；不会默认读取本地文件</span>
            </div>
            <button disabled={governanceLoading} onClick={onGrantPermission} type="button">
              {governanceLoading ? "处理中" : "授权"}
            </button>
          </div>
          <div className="knowledge-permission-form">
            <input value={permissionName} onChange={(event) => onPermissionNameChange(event.target.value)} placeholder="授权名称" />
            <input value={permissionPath} onChange={(event) => onPermissionPathChange(event.target.value)} placeholder="脱敏路径，例如 ~/Documents/project" />
          </div>
          {governanceError ? <p className="knowledge-error">{governanceError}</p> : null}
          <div className="knowledge-permission-list">
            {permissions.length ? permissions.map((permission) => (
              <div className="knowledge-permission-row" key={permission.permissionRootId}>
                <div>
                  <strong>{permission.displayName}</strong>
                  <span>{permission.redactedPath} · {permission.state}</span>
                </div>
                <button disabled={permission.state === "revoked" || governanceLoading} onClick={() => onRevokePermission(permission.permissionRootId)} type="button">
                  撤销
                </button>
              </div>
            )) : <p className="muted">暂无授权。V2-6 只记录显式授权，不执行扫描。</p>}
          </div>
        </section>
        <section className="knowledge-forget-panel" aria-label="Forget source">
          <div className="knowledge-section-heading">
            <div>
              <strong>Forget Source</strong>
              <span>删除 / 遗忘必须影响 Library、Ask、Graph、Trace</span>
            </div>
            <button disabled={!selectedSource || selectedSource.status === "forgotten" || governanceLoading} onClick={onForgetSelectedSource} type="button">
              遗忘当前 source
            </button>
          </div>
          {forgetResult ? (
            <div className="knowledge-forget-verification">
              <strong>Forget verification</strong>
              <span>library {String(forgetResult.verification.libraryAbsent)}</span>
              <span>ask {String(forgetResult.verification.askAbsent)}</span>
              <span>graph {String(forgetResult.verification.graphAbsent)}</span>
              <span>trace {String(forgetResult.verification.traceAbsent)}</span>
            </div>
          ) : (
            <p className="muted">选择一个 source 后可执行遗忘验证。此操作仍走 Runtime mock governance。</p>
          )}
        </section>
      </div>
    </section>
  );
}
