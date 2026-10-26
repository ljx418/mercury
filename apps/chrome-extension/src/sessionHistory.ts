import type { ChatSession } from "./runtimeClient";

const FUTURE_VISIBLE_COUNT_KEYS = [
  "visibleMessageCount",
  "visibleUserMessageCount",
  "visibleAssistantMessageCount",
  "userMessageCount",
  "assistantMessageCount"
] as const;

export function getSessionDisplayTitle(session: ChatSession | null | undefined): string {
  const title = session?.title?.trim();
  return title || "新会话";
}

export function hasVisibleHistory(session: ChatSession): boolean {
  if (session.archived === true) return false;

  const futureVisibleCount = visibleCountFromFutureSummaryFields(session);
  if (futureVisibleCount !== null) return futureVisibleCount > 0;

  return session.messageCount > 0;
}

export function shouldReuseActiveSessionForNewChat(
  session: ChatSession | null | undefined,
  renderedMessageCount = 0
): boolean {
  return Boolean(session && session.archived !== true && renderedMessageCount === 0 && !hasVisibleHistory(session));
}

export function getHistorySessions(sessions: ChatSession[]): ChatSession[] {
  return sessions.filter(hasVisibleHistory).sort((left, right) => sessionSortTimestamp(right) - sessionSortTimestamp(left));
}

export function getSessionHistorySubtitle(session: ChatSession): string {
  const excerpt = session.lastMessageExcerpt?.trim();
  if (excerpt && session.hasArtifacts) return `${excerpt} · Artifact`;
  if (excerpt) return excerpt;
  if (session.hasArtifacts) return "Artifact";
  return "普通聊天";
}

function visibleCountFromFutureSummaryFields(session: ChatSession): number | null {
  const record = session as ChatSession & Record<string, unknown>;
  let total = 0;
  let found = false;
  for (const key of FUTURE_VISIBLE_COUNT_KEYS) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      total += value;
      found = true;
    }
  }
  return found ? total : null;
}

function sessionSortTimestamp(session: ChatSession): number {
  const timestamp = Date.parse(session.lastMessageAt ?? session.updatedAt ?? session.createdAt);
  return Number.isNaN(timestamp) ? 0 : timestamp;
}
