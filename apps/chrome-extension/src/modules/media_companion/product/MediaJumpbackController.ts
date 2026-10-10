import {
  MEDIA_COLLECT_CONTEXT_MESSAGE_TYPE,
  MEDIA_READ_PLAYBACK_MESSAGE_TYPE,
  MEDIA_SEEK_MESSAGE_TYPE,
} from "../../../contentBridge";
import type { MediaBridgeResponse, MediaPageContext, MediaPlaybackSnapshot } from "../contracts";

export type MediaJumpbackOrigin =
  | "outline" | "timeline" | "mindmap" | "ask_citation" | "evidence_drawer"
  | "chapter" | "moment" | "frame" | "mindmap_node";

export type MediaSeekReceipt = {
  origin: MediaJumpbackOrigin;
  requestedMs: number;
  observedMs: number;
  deltaMs: number;
  outcome: "located" | "fallback" | "blocked";
  pageIdentityMatched: boolean;
  observedAt: string;
  failureCode: string | null;
};

export class MediaJumpbackController {
  async read(sourceIdentity: string): Promise<MediaPlaybackSnapshot | null> {
    const binding = parseSourceIdentity(sourceIdentity);
    const match = await this.boundPortalTab(binding);
    if (!match) return null;
    try {
      return await this.message<MediaPlaybackSnapshot>(match.tab.id!, { type: MEDIA_READ_PLAYBACK_MESSAGE_TYPE });
    } catch {
      return null;
    }
  }

  async seek(sourceIdentity: string, requestedMs: number, origin: MediaJumpbackOrigin): Promise<MediaSeekReceipt> {
    const binding = parseSourceIdentity(sourceIdentity);
    const match = await this.boundPortalTab(binding);
    if (!match) return blocked(origin, requestedMs, "V3_MEDIA_PAGE_IDENTITY_INCOMPLETE");
    const { tab, context } = match;
    if (!Number.isInteger(requestedMs) || requestedMs < 0 || requestedMs > Math.round(context.durationSeconds * 1000)) {
      return blocked(origin, requestedMs, "V3_MEDIA_SEEK_INVALID", true);
    }
    try {
      await this.message<MediaPlaybackSnapshot>(tab.id!, { type: MEDIA_SEEK_MESSAGE_TYPE, seconds: requestedMs / 1000 });
      await new Promise((resolve) => setTimeout(resolve, 150));
      const playback = await this.message<MediaPlaybackSnapshot>(tab.id!, { type: MEDIA_READ_PLAYBACK_MESSAGE_TYPE });
      const observedMs = Math.round(playback.currentTimeSeconds * 1000);
      const deltaMs = Math.abs(observedMs - requestedMs);
      return {
        origin, requestedMs, observedMs, deltaMs,
        outcome: deltaMs <= 2000 ? "located" : "fallback",
        pageIdentityMatched: true, observedAt: playback.observedAt,
        failureCode: deltaMs <= 2000 ? null : "V3_MEDIA_SEEK_DELTA_EXCEEDED",
      };
    } catch (error) {
      return blocked(origin, requestedMs, failureCode(error), true);
    }
  }

  private async boundPortalTab(binding: { mediaId: string; playbackUnitId: string; partIndex: number }): Promise<{ tab: chrome.tabs.Tab; context: MediaPageContext } | null> {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    for (const tab of tabs) {
      if (!tab.id || !tab.url?.startsWith("https://www.bilibili.com/video/")) continue;
      try {
        const context = await this.message<MediaPageContext>(tab.id, { type: MEDIA_COLLECT_CONTEXT_MESSAGE_TYPE });
        if (context.mediaId === binding.mediaId
          && context.playbackUnitId === binding.playbackUnitId
          && context.part.index === binding.partIndex) return { tab, context };
      } catch {
        // Continue across portal tabs; only an exact task identity may receive a seek.
      }
    }
    return null;
  }

  private async message<T>(tabId: number, message: object): Promise<T> {
    const response = await chrome.tabs.sendMessage(tabId, message) as MediaBridgeResponse<T>;
    if (!response?.ok) throw new Error(response?.failureCode ?? "V3_MEDIA_PLAYBACK_UNAVAILABLE");
    return response.value;
  }
}

function parseSourceIdentity(value: string): { mediaId: string; playbackUnitId: string; partIndex: number } {
  const match = /^portal:[a-z0-9_-]+:([^:]+):([^:]+):(?:p)?(\d+)$/.exec(value);
  if (!match) throw new Error("V3_MEDIA_PAGE_IDENTITY_INCOMPLETE");
  return { mediaId: match[1], playbackUnitId: match[2], partIndex: Number(match[3]) };
}

function blocked(origin: MediaJumpbackOrigin, requestedMs: number, code: string, matched = false): MediaSeekReceipt {
  return {
    origin, requestedMs, observedMs: 0, deltaMs: Math.max(0, requestedMs), outcome: "blocked",
    pageIdentityMatched: matched, observedAt: new Date().toISOString(), failureCode: code,
  };
}

function failureCode(error: unknown): string {
  const candidate = error instanceof Error ? error.message.split(":", 1)[0] : "V3_MEDIA_PLAYBACK_UNAVAILABLE";
  return candidate.startsWith("V3_MEDIA_") ? candidate : "V3_MEDIA_PLAYBACK_UNAVAILABLE";
}
