export type TranscriptAvailability = "available" | "unavailable" | "restricted" | "unknown";

export type MediaPagePart = {
  id: string;
  index: number;
  count: number;
  label: string | null;
};

export type MediaPageContext = {
  platform: string;
  adapterId: string;
  adapterRevision: number;
  canonicalUrl: string;
  mediaId: string;
  playbackUnitId: string;
  part: MediaPagePart;
  title: string;
  author: string;
  durationSeconds: number;
  currentTimeSeconds: number;
  transcriptAvailability: TranscriptAvailability;
  observedAt: string;
};

export type MediaPlaybackSnapshot = {
  currentTimeSeconds: number;
  durationSeconds: number;
  paused: boolean;
  observedAt: string;
};

export type MediaPortalCapability =
  | "page_identity"
  | "public_transcript_discovery"
  | "session_capability"
  | "playback_read"
  | "playback_seek";

export type MediaCollectionFailureCode =
  | "V3_MEDIA_PORTAL_UNSUPPORTED"
  | "V3_MEDIA_PORTAL_AMBIGUOUS"
  | "V3_MEDIA_PAGE_IDENTITY_INCOMPLETE"
  | "V3_MEDIA_PLAYBACK_UNAVAILABLE"
  | "V3_MEDIA_SEEK_INVALID";

export type MediaBridgeResponse<T> =
  | { ok: true; adapterId: string; value: T }
  | { ok: false; failureCode: MediaCollectionFailureCode; error: string };

