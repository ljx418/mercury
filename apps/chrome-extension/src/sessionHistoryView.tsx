import React from "react";
import type { ChatSession } from "./runtimeClient";
import { getSessionHistorySubtitle } from "./sessionHistory";

export function SessionHistoryList({
  sessions,
  currentSessionId,
  disabled,
  onSelect,
  onDelete,
  deletingSessionId
}: {
  sessions: ChatSession[];
  currentSessionId?: string;
  disabled: boolean;
  onSelect: (sessionId: string) => void;
  onDelete: (sessionId: string) => void;
  deletingSessionId?: string;
}) {
  return (
    <>
      {sessions.length === 0 ? (
        <div className="session-empty">
          <strong>还没有聊天记录</strong>
          <span>开始提问后，会话会出现在这里。</span>
        </div>
      ) : null}
      {sessions.map((session) => (
        <div className={`session-menu-entry ${session.id === currentSessionId ? "active" : ""}`} key={session.id}>
          <button
            className="session-menu-item"
            type="button"
            disabled={disabled}
            onClick={() => onSelect(session.id)}
          >
            <span className="session-menu-row">
              <span className="session-menu-title">{session.title || "新会话"}</span>
              <span className="session-time">{formatSessionTime(session.lastMessageAt ?? session.updatedAt)}</span>
            </span>
            <span className="session-menu-source">{getSessionHistorySubtitle(session)}</span>
          </button>
          <button
            className="session-menu-delete"
            type="button"
            aria-label={`删除会话：${session.title || "新会话"}`}
            title="删除这条会话"
            disabled={disabled}
            onClick={() => onDelete(session.id)}
          >
            {deletingSessionId === session.id ? "…" : "×"}
          </button>
        </div>
      ))}
    </>
  );
}

function formatSessionTime(value: string | undefined): string {
  if (!value) return "刚刚";
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return "刚刚";
  const diffMs = Date.now() - timestamp;
  if (diffMs < 60_000) return "刚刚";
  if (diffMs < 3_600_000) return `${Math.max(1, Math.floor(diffMs / 60_000))} 分钟前`;
  if (diffMs < 86_400_000) return `${Math.max(1, Math.floor(diffMs / 3_600_000))} 小时前`;
  return new Date(timestamp).toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" });
}
