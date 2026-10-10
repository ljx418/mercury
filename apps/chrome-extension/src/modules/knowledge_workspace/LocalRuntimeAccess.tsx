import { useEffect, useRef, useState } from "react";
import {
  clearLocalRuntimeSession,
  bootstrapLocalRuntimeSession,
  getLocalRuntimeSessionSnapshot,
  isRuntimeRequestError,
  listKnowledgePermissions,
  revokeLocalRuntimeSession,
  stopLocalRuntime,
  subscribeLocalRuntimeSession
} from "../../runtimeClient";
import "./localRuntimeAccess.css";

export type LocalRuntimeAccessState = "connecting" | "connected" | "authentication_required" | "offline";

export type LocalRuntimeAccessChange = {
  status: LocalRuntimeAccessState;
  generation: number;
  error?: string | null;
};

export function LocalRuntimeAccess({ workspaceId = "ws_default", title = "本地文件访问", mode = "full", retrySignal = 0, onChange }: {
  workspaceId?: string;
  title?: string;
  mode?: "full" | "automatic";
  retrySignal?: number;
  onChange: (change: LocalRuntimeAccessChange) => void;
}) {
  const [status, setStatus] = useState<LocalRuntimeAccessState>("connecting");
  const [error, setError] = useState<string | null>(null);
  const [runtimeInstanceId, setRuntimeInstanceId] = useState<string | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const unsubscribe = subscribeLocalRuntimeSession((snapshot) => {
      if (!snapshot.hasToken) return;
      onChangeRef.current({ status: "connecting", generation: snapshot.generation });
    });
    void connect();
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (retrySignal > 0) void connect();
  }, [retrySignal]);

  async function connect() {
    setStatus("connecting");
    setError(null);
    try {
      if (!getLocalRuntimeSessionSnapshot().hasToken) await bootstrapLocalRuntimeSession();
      await listKnowledgePermissions(workspaceId);
      const snapshot = getLocalRuntimeSessionSnapshot();
      setRuntimeInstanceId(snapshot.runtimeInstanceId);
      setStatus("connected");
      onChangeRef.current({ status: "connected", generation: snapshot.generation, error: null });
    } catch (failure) {
      if (isRuntimeRequestError(failure) && failure.kind === "stale") return;
      const authenticationFailure = isRuntimeRequestError(failure) && failure.kind === "authentication";
      const transportFailure = isRuntimeRequestError(failure) && failure.kind === "transport";
      const companionNotConfigured = isRuntimeRequestError(failure) && failure.code === "V3_COMPANION_NOT_CONFIGURED";
      clearLocalRuntimeSession();
      setRuntimeInstanceId(null);
      const nextStatus: LocalRuntimeAccessState = transportFailure ? "offline" : "authentication_required";
      const nextError = transportFailure
        ? "Navia 本机伴侣未启动，请先点击桌面图标启动。"
        : companionNotConfigured
          ? "本机伴侣尚未绑定 Navia 扩展，请重新运行桌面图标并完成一次性配置。"
        : authenticationFailure
          ? "本机伴侣配置与当前扩展不匹配。"
          : failure instanceof Error ? failure.message : "无法建立本机安全会话。";
      setStatus(nextStatus);
      setError(nextError);
      onChangeRef.current({ status: nextStatus, generation: getLocalRuntimeSessionSnapshot().generation, error: nextError });
    }
  }

  async function disconnect() {
    await revokeLocalRuntimeSession();
    setRuntimeInstanceId(null);
    setStatus("authentication_required");
    setError(null);
  }

  async function stop() {
    setStatus("connecting");
    setError(null);
    try {
      await stopLocalRuntime();
      setRuntimeInstanceId(null);
      setStatus("offline");
      onChangeRef.current({ status: "offline", generation: getLocalRuntimeSessionSnapshot().generation });
    } catch (failure) {
      setStatus("connected");
      setError(failure instanceof Error ? failure.message : "停止本机伴侣失败。请从桌面窗口退出。 ");
    }
  }

  const connected = status === "connected";
  if (mode === "automatic") return null;
  return <section className="local-runtime-access" data-testid="local-runtime-access" aria-label="本地 Runtime 会话认证">
    <strong>{title}</strong>
    {connected ? <div><span data-testid="local-runtime-status" role="status">本机伴侣已连接</span>{runtimeInstanceId ? <small data-testid="local-runtime-instance">实例 {runtimeInstanceId.slice(-8)}</small> : null}<button data-testid="local-runtime-disconnect" type="button" onClick={() => void disconnect()}>断开会话</button><button data-testid="local-runtime-stop" type="button" onClick={() => void stop()}>停止本机伴侣</button></div> :
      <div><button data-testid="local-runtime-connect" type="button" disabled={status === "connecting"} onClick={() => void connect()}>{status === "connecting" ? "正在连接" : "重新连接"}</button></div>}
    {!connected ? <span data-testid="local-runtime-status" role="status">{status === "offline" ? "本机伴侣未启动" : status === "connecting" ? "正在建立安全会话" : "本机伴侣需要重新配置"}</span> : null}
    {error ? <p data-testid="local-runtime-error" role="alert">{error}</p> : null}
  </section>;
}
