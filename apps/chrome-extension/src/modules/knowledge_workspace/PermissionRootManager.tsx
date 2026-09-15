import { useEffect, useRef, useState } from "react";
import { importKnowledgeFiles, scanKnowledgePermission, type PermissionRoot, type PermissionGrantInput, type PermissionScan } from "../../runtimeClient";

export function PermissionRootManager({ workspaceId, permissions, loading, error, sessionGeneration = 0, onGrant, onRevoke, onImported }: {
  workspaceId: string;
  permissions: PermissionRoot[];
  loading: boolean;
  error: string | null;
  sessionGeneration?: number;
  onGrant: (input: PermissionGrantInput) => Promise<void>;
  onRevoke: (permissionRootId: string) => Promise<void>;
  onImported: () => void;
}) {
  const [name, setName] = useState("");
  const [path, setPath] = useState("");
  const [scope, setScope] = useState<"single_file" | "directory">("single_file");
  const [scan, setScan] = useState<PermissionScan | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [imported, setImported] = useState<string[]>([]);
  const [activeRootId, setActiveRootId] = useState<string | null>(null);
  const importKey = useRef<{ signature: string; key: string } | null>(null);

  function resetTransient() {
    setScan(null);
    setSelected([]);
    setImported([]);
    setActiveRootId(null);
    importKey.current = null;
  }

  useEffect(() => {
    resetTransient();
    setLocalError(null);
  }, [sessionGeneration, workspaceId]);

  async function scanRoot(id: string) {
    setBusy(true); setLocalError(null); resetTransient(); setActiveRootId(id);
    try { setScan(await scanKnowledgePermission(id, workspaceId)); }
    catch (failure) { setLocalError(failure instanceof Error ? failure.message : "扫描失败"); }
    finally { setBusy(false); }
  }
  async function importFiles() {
    if (!scan || !selected.length) return;
    const signature = JSON.stringify([scan.scanId, [...selected].sort()]);
    if (importKey.current?.signature !== signature) importKey.current = { signature, key: `ui-import-${crypto.randomUUID()}` };
    setBusy(true); setLocalError(null);
    try {
      const result = await importKnowledgeFiles(scan.permissionRootId, { workspaceId, scanId: scan.scanId, fileIds: selected }, importKey.current.key);
      setImported(result.sources.map((source) => source.sourceId));
      onImported();
    } catch (failure) { setLocalError(failure instanceof Error ? failure.message : "导入失败"); }
    finally { setBusy(false); }
  }
  async function grantRoot() {
    const normalizedPath = path.trim();
    if (!normalizedPath.startsWith("/")) {
      setLocalError("请输入 Runtime POSIX 绝对路径");
      return;
    }
    setLocalError(null);
    resetTransient();
    try {
      await onGrant({ workspaceId, displayName: name.trim(), path: normalizedPath, scope });
      setPath("");
    } catch (failure) {
      setLocalError(failure instanceof Error ? failure.message : "授权失败");
    }
  }
  async function revokeRoot(permissionRootId: string) {
    setBusy(true);
    setLocalError(null);
    try {
      await onRevoke(permissionRootId);
      if (permissionRootId === activeRootId) resetTransient();
    } catch (failure) {
      setLocalError(failure instanceof Error ? failure.message : "撤销失败");
    } finally {
      setBusy(false);
    }
  }
  const disabled = busy || loading;
  const activeScan = scan && activeRootId === scan.permissionRootId && permissions.some((item) => item.permissionRootId === scan.permissionRootId && item.state === "granted") ? scan : null;
  return (
    <section className="route-panel permission-manager" data-testid="route-permissions">
      <p className="eyebrow">PermissionRoot</p><h2>显式授权</h2><p className="scope-note">授权只允许后续用户触发的导入；不会自动扫描，不删除既有 source。</p>
      <form className="permission-form" onSubmit={(event) => { event.preventDefault(); void grantRoot(); }}>
        <label><span>授权名称</span><input value={name} onChange={(event) => setName(event.target.value)} /></label>
        <label><span>Runtime 绝对路径</span><input aria-invalid={Boolean(path.trim() && !path.trim().startsWith("/"))} value={path} autoComplete="off" onChange={(event) => { setPath(event.target.value); if (localError === "请输入 Runtime POSIX 绝对路径") setLocalError(null); }} placeholder="/home/user/document.md" /></label>
        <label><span>授权范围</span><select value={scope} onChange={(event) => setScope(event.target.value as typeof scope)}><option value="single_file">单个文件</option><option value="directory">目录</option></select></label>
        <button disabled={disabled || !name.trim() || !path.trim()} type="submit">授权</button>
      </form>
      {error || localError ? <p className="knowledge-error" role="alert">{error ?? localError}</p> : null}
      <div className="permission-list">{permissions.map((item) => <article key={item.permissionRootId}><div><strong>{item.displayName}</strong><span>{item.redactedPath}</span><small>{item.state} · {item.scope}</small></div><button disabled={disabled || item.state !== "granted"} onClick={() => void scanRoot(item.permissionRootId)} type="button">扫描</button><button disabled={disabled || item.state === "revoked"} onClick={() => void revokeRoot(item.permissionRootId)} type="button">撤销</button></article>)}{!permissions.length ? <p className="empty-copy">当前 Runtime 会话没有授权记录。</p> : null}</div>
      {activeScan ? <fieldset><legend>待导入文件</legend>{activeScan.files.map((file) => <label key={file.fileId} style={{ display: "flex", gap: 8, margin: "8px 0" }}><input type="checkbox" disabled={disabled} checked={selected.includes(file.fileId)} onChange={(event) => setSelected((ids) => event.target.checked ? [...ids, file.fileId] : ids.filter((id) => id !== file.fileId))} /><span>{file.displayName} · {file.sizeBytes} bytes</span></label>)}<button type="button" disabled={disabled || !selected.length} onClick={() => void importFiles()}>{busy ? "处理中" : "导入所选文件"}</button></fieldset> : null}
      {imported.length ? <p role="status">已导入 {imported.length} 个来源：{imported.join(", ")}</p> : null}
    </section>
  );
}
