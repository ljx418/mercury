import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ChatSession } from "./runtimeClient";
import { shouldReuseActiveSessionForNewChat } from "./sessionHistory";
import { SessionHistoryOverlay } from "./sessionHistoryOverlay";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let container: HTMLDivElement | null = null;

afterEach(() => {
  if (root) act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

function session(id: string, title: string): ChatSession {
  return {
    id,
    title,
    profile: "chat",
    createdAt: "2026-10-11T00:00:00Z",
    updatedAt: "2026-10-11T00:00:00Z",
    lastMessageAt: "2026-10-11T00:00:00Z",
    pageRef: null,
    messageCount: 2,
    archived: false,
    lastMessageExcerpt: "摘要",
    hasArtifacts: false
  };
}

async function renderOverlay() {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  const handlers = { onDelete: vi.fn(), onClear: vi.fn(), onCreate: vi.fn(), onSelect: vi.fn(), onClose: vi.fn() };
  await act(async () => root?.render(
    <SessionHistoryOverlay
      sessions={[session("sess_1", "第一条"), session("sess_2", "第二条")]}
      currentSessionId="sess_1"
      switchingSession={false}
      creatingSession={false}
      clearingSessions={false}
      canCreateSession={true}
      error={null}
      {...handlers}
    />
  ));
  return handlers;
}

describe("SessionHistoryOverlay", () => {
  it("does not reuse a stale empty summary when messages are rendered", () => {
    const staleSummary = { ...session("sess_1", "新会话"), messageCount: 0, lastMessageExcerpt: undefined };
    expect(shouldReuseActiveSessionForNewChat(staleSummary, 2)).toBe(false);
    expect(shouldReuseActiveSessionForNewChat(staleSummary, 0)).toBe(true);
  });

  it("exposes per-session delete and clear-all actions", async () => {
    const handlers = await renderOverlay();

    const deleteButton = container!.querySelector<HTMLButtonElement>('button[aria-label="删除会话：第一条"]')!;
    const clearButton = Array.from(container!.querySelectorAll("button")).find((button) => button.textContent === "清空")!;
    await act(async () => deleteButton.click());
    await act(async () => clearButton.click());

    expect(handlers.onDelete).toHaveBeenCalledWith("sess_1");
    expect(handlers.onClear).toHaveBeenCalledTimes(1);
  });

  it("keeps the new-session command outside the scroll list", async () => {
    await renderOverlay();

    const list = container!.querySelector(".session-menu-list")!;
    const footer = container!.querySelector(".session-menu-footer")!;
    const newSession = container!.querySelector('[data-testid="new-session"]')!;
    expect(list.contains(newSession)).toBe(false);
    expect(footer.contains(newSession)).toBe(true);
  });
});
