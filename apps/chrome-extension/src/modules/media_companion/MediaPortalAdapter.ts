import type {
  MediaPageContext,
  MediaPlaybackSnapshot,
  MediaPortalCapability
} from "./contracts";

export type MediaPortalEnvironment = {
  document: Document;
  href: string;
  now?: () => Date;
};

export interface MediaPortalAdapter {
  readonly adapterId: string;
  readonly adapterRevision: number;
  readonly platform: string;
  readonly capabilities: readonly MediaPortalCapability[];

  match(href: string): boolean;
  collect(environment: MediaPortalEnvironment): Promise<MediaPageContext>;
  readPlayback(environment: MediaPortalEnvironment): MediaPlaybackSnapshot;
  seek(environment: MediaPortalEnvironment, seconds: number): MediaPlaybackSnapshot;
}

