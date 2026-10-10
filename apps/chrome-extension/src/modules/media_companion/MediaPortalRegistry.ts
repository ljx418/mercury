import type { MediaPortalAdapter, MediaPortalEnvironment } from "./MediaPortalAdapter";
import type { MediaPageContext, MediaPlaybackSnapshot } from "./contracts";
import { BilibiliMediaPortalAdapter } from "./adapters/bilibili/BilibiliMediaPortalAdapter";

const adapters: readonly MediaPortalAdapter[] = Object.freeze([
  new BilibiliMediaPortalAdapter()
]);

export function listMediaPortalAdapters(): readonly MediaPortalAdapter[] {
  return adapters;
}

export function resolveMediaPortalAdapter(href: string): MediaPortalAdapter | null {
  const matches = adapters.filter((adapter) => adapter.match(href));
  if (matches.length > 1) {
    throw new Error("V3_MEDIA_PORTAL_AMBIGUOUS: More than one media portal adapter matched the page.");
  }
  return matches[0] ?? null;
}

export async function collectMediaPageContext(environment: MediaPortalEnvironment): Promise<MediaPageContext> {
  const adapter = resolveMediaPortalAdapter(environment.href);
  if (!adapter) throw new Error("V3_MEDIA_PORTAL_UNSUPPORTED: No registered media portal adapter matched the page.");
  return adapter.collect(environment);
}

export function readMediaPlayback(environment: MediaPortalEnvironment): MediaPlaybackSnapshot {
  const adapter = resolveMediaPortalAdapter(environment.href);
  if (!adapter) throw new Error("V3_MEDIA_PORTAL_UNSUPPORTED: No registered media portal adapter matched the page.");
  return adapter.readPlayback(environment);
}

export function seekMediaPlayback(environment: MediaPortalEnvironment, seconds: number): MediaPlaybackSnapshot {
  const adapter = resolveMediaPortalAdapter(environment.href);
  if (!adapter) throw new Error("V3_MEDIA_PORTAL_UNSUPPORTED: No registered media portal adapter matched the page.");
  return adapter.seek(environment, seconds);
}

