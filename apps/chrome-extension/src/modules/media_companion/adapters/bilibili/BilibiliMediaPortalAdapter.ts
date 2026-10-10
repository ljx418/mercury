import type { MediaPortalAdapter, MediaPortalEnvironment } from "../../MediaPortalAdapter";
import type { MediaPageContext, MediaPlaybackSnapshot } from "../../contracts";
import { collectBilibiliPageState } from "./bilibiliPageState";
import { parseBilibiliVideoUrl } from "./bilibiliUrl";

export class BilibiliMediaPortalAdapter implements MediaPortalAdapter {
  readonly adapterId = "bilibili";
  readonly adapterRevision = 1;
  readonly platform = "bilibili";
  readonly capabilities = [
    "page_identity",
    "public_transcript_discovery",
    "playback_read",
    "playback_seek"
  ] as const;

  match(href: string): boolean {
    return parseBilibiliVideoUrl(href) !== null;
  }

  async collect(environment: MediaPortalEnvironment): Promise<MediaPageContext> {
    const state = collectBilibiliPageState(environment.document, environment.href);
    return {
      platform: this.platform,
      adapterId: this.adapterId,
      adapterRevision: this.adapterRevision,
      canonicalUrl: state.canonicalUrl,
      mediaId: state.bvid,
      playbackUnitId: state.cid,
      part: {
        id: `p${state.part.index}`,
        index: state.part.index,
        count: state.partCount,
        label: state.part.label
      },
      title: state.title,
      author: state.author,
      durationSeconds: state.durationSeconds,
      currentTimeSeconds: state.currentTimeSeconds,
      transcriptAvailability: state.transcriptAvailability,
      observedAt: (environment.now?.() ?? new Date()).toISOString()
    };
  }

  readPlayback(environment: MediaPortalEnvironment): MediaPlaybackSnapshot {
    const video = environment.document.querySelector<HTMLVideoElement>("video");
    if (!video || !Number.isFinite(video.duration) || video.duration <= 0) {
      throw new Error("V3_MEDIA_PLAYBACK_UNAVAILABLE: No finite video duration is available.");
    }
    return {
      currentTimeSeconds: finiteNonNegative(video.currentTime),
      durationSeconds: video.duration,
      paused: video.paused,
      observedAt: (environment.now?.() ?? new Date()).toISOString()
    };
  }

  seek(environment: MediaPortalEnvironment, seconds: number): MediaPlaybackSnapshot {
    const video = environment.document.querySelector<HTMLVideoElement>("video");
    if (!video || !Number.isFinite(video.duration) || video.duration <= 0) {
      throw new Error("V3_MEDIA_PLAYBACK_UNAVAILABLE: No finite video duration is available.");
    }
    if (!Number.isFinite(seconds) || seconds < 0 || seconds > video.duration) {
      throw new Error("V3_MEDIA_SEEK_INVALID: Seek target is outside the active playback unit.");
    }
    video.currentTime = seconds;
    return this.readPlayback(environment);
  }
}

function finiteNonNegative(value: number): number {
  return Number.isFinite(value) && value >= 0 ? value : 0;
}
