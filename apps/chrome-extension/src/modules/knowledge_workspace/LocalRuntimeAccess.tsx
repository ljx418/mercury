import { useEffect, useRef, useState } from "react";
import {
  clearLocalRuntimeSession,
  getLocalRuntimeSessionSnapshot,
  isRuntimeRequestError,
  listKnowledgePermissions,
  setLocalRuntimeToken,
  subscribeLocalRuntimeSession
} from "../../runtimeClient";
import "./localRuntimeAccess.css";

export type LocalRuntimeAccessState = "connecting" | "connected" | "authentication_required" | "offline";

export type LocalRuntimeAccessChange = {
  status: LocalRuntimeAccessState;
  generation: number;
};

export function LocalRuntimeAccess({ workspaceId = "ws_default", onChange }: {
  workspaceId?: string;
  onChange: (change: LocalRuntimeAccessChange) => void;
}) {
  const initialSession = getLocalRuntimeSessionSnapshot();
  const [token, setToken] = useState("");
  const [hasSessionToken, setHasSessionToken] = useState(initialSession.hasToken);
  const [status, setStatus] = useState<LocalRuntimeAccessState>(initialSession.hasToken ? "connected" : "authentication_required");
  const [error, setError] = useState<string | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => subscribeLocalRuntimeSession((snapshot) => {
    setHasSessionToken(snapshot.hasToken);
    if (!snapshot.hasToken) {
      setStatus("authentication_required");
      onChangeRef.current({ status: "authentication_required", generation: snapshot.generation });
      return;
    }
    onChangeRef.current({ status: "connecting", generation: snapshot.generation });
  }), []);

  async function connect() {
    setStatus("connecting");
    setError(null);
    if (token.length >= 32) {
      setLocalRuntimeToken(token);
      setToken("");
    }
    try {
      await listKnowledgePermissions(workspaceId);
      const snapshot = getLocalRuntimeSessionSnapshot();
      setStatus("connected");
      onChangeRef.current({ status: "connected", generation: snapshot.generation });
    } catch (failure) {
      if (isRuntimeRequestError(failure) && failure.kind === "stale") return;
      const authenticationFailure = isRuntimeRequestError(failure) && failure.kind === "authentication";
      const transportFailure = isRuntimeRequestError(failure) && failure.kind === "transport";
      if (!authenticationFailure && !transportFailure) clearLocalRuntimeSession();
      const nextStatus: LocalRuntimeAccessState = transportFailure ? "offline" : "authentication_required";
      const nextError = transportFailure
        ? "Runtime 当前不可达"
        : authenticationFailure
          ? "会话认证失效，请重新输入 Runtime 令牌"
          : failure instanceof Error ? failure.message : "会话认证失效，请重新输入 Runtime 令牌";
      setStatus(nextStatus);
      setError(nextError);
      onChangeRef.current({ status: nextStatus, generation: getLocalRuntimeSessionSnapshot().generation });
    }
  }

  function disconnect() {
    clearLocalRuntimeSession();
    setStatus("authentication_required");
    setError(null);
  }

  const connected = status === "connected";
  return <section className="local-runtime-access" data-testid="local-runtime-access" aria-label="本地 Runtime 会话认证">
    <strong>本地文件访问</strong>
    {connected ? <div><span data-testid="local-runtime-status" role="status">本页面会话已认证</span><button data-testid="local-runtime-disconnect" type="button" onClick={disconnect}>断开会话</button></div> :
      <form onSubmit={(event) => { event.preventDefault(); void connect(); }}>
        <label><span>Runtime 会话令牌</span><input data-testid="local-runtime-token-input" type="password" autoComplete="off" value={token} onChange={(event) => setToken(event.target.value)} /></label>
        <button data-testid="local-runtime-connect" type="submit" disabled={status === "connecting" || (!hasSessionToken && token.length < 32)}>{status === "connecting" ? "认证中" : status === "offline" && hasSessionToken && token.length < 32 ? "重新连接" : "连接会话"}</button>
      </form>}
    {!connected ? <span data-testid="local-runtime-status" role="status">{status === "offline" ? "Runtime 当前不可达" : status === "connecting" ? "正在验证会话" : "需要 Runtime 会话令牌"}</span> : null}
    {error ? <p data-testid="local-runtime-error" role="alert">{error}</p> : null}
  </section>;
}
