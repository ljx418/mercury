import React, { useEffect } from "react";
import type { ChatSession } from "./runtimeClient";
import { SessionHistoryList } from "./sessionHistoryView";

export function SessionHistoryOverlay({
  sessions,
  currentSessionId,
  switchingSession,
  creatingSession,
  deletingSessionId,
  clearingSessions,
  canCreateSession,
  error,
  onClose,
  onSelect,
  onCreate,
  onDelete,
  onClear
}: {
  sessions: ChatSession[];
  currentSessionId?: string;
  switchingSession: boolean;
  creatingSession: boolean;
  deletingSessionId?: string;
  clearingSessions: boolean;
  canCreateSession: boolean;
  error: string | null;
  onClose: () => void;
  onSelect: (sessionId: string) => void;
  onCreate: () => void;
  onDelete: (sessionId: string) => void;
  onClear: () => void;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <>
      <button
        className="session-history-backdrop"
        type="button"
        aria-label="关闭聊天历史记录"
        data-testid="session-history-backdrop"
        onClick={onClose}
      />
      <div
        className="session-menu session-history-panel"
        data-testid="session-menu"
        role="dialog"
        aria-modal="true"
        aria-labelledby="session-history-title"
      >
        <div className="session-menu-header">
          <span id="session-history-title">聊天历史记录</span>
          <div className="session-menu-header-actions">
            <button className="session-menu-clear" type="button" disabled={sessions.length === 0 || clearingSessions || switchingSession} onClick={onClear}>
              {clearingSessions ? "清空中…" : "清空"}
            </button>
            <button className="session-menu-close" type="button" aria-label="关闭会话菜单" onClick={onClose}>×</button>
          </div>
        </div>
        {error ? <div className="session-menu-error">{error}</div> : null}
        {switchingSession ? <div className="session-menu-loading">正在加载会话……</div> : null}
        <div className="session-menu-list">
          <SessionHistoryList
            sessions={sessions}
            currentSessionId={currentSessionId}
            disabled={switchingSession || clearingSessions || Boolean(deletingSessionId)}
            onSelect={onSelect}
            onDelete={onDelete}
            deletingSessionId={deletingSessionId}
          />
        </div>
        <div className="session-menu-footer">
          <button
            className="session-menu-new"
            type="button"
            data-testid="new-session"
            disabled={!canCreateSession || creatingSession}
            onClick={onCreate}
          >
            <span aria-hidden="true">＋</span>
            <span>新聊天</span>
          </button>
        </div>
      </div>
    </>
  );
}
