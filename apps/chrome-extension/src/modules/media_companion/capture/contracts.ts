export const MEDIA_CAPTURE_MESSAGE_TYPE = "navia.mediaCapture" as const;
export const MEDIA_CAPTURE_OFFSCREEN_MESSAGE_TYPE = "navia.mediaCapture.offscreen" as const;

export type MediaCaptureSurface = "side_panel" | "workspace";

export type MediaCaptureBinding = {
  taskId: string;
  adapterId: string;
  pageIdentitySha256: string;
  tabId: number;
  tabIdSha256: string;
  surface: MediaCaptureSurface;
};

export type PublicMediaCaptureGrant = Omit<MediaCaptureBinding, "tabId"> & {
  grantId: string;
  issuedAt: string;
  expiresAt: string;
  oneShot: true;
  persisted: false;
  state: "issued" | "consumed" | "expired" | "revoked" | "failed";
};

export type StartMediaCaptureMessage = {
  type: typeof MEDIA_CAPTURE_MESSAGE_TYPE;
  command: "arm";
  trustedClick: true;
  userActivation: true;
  grant: PublicMediaCaptureGrant;
  ticket: string;
  sourceIdentity: string;
  acquisitionRecordId: string;
};

export type StatusMediaCaptureMessage = {
  type: typeof MEDIA_CAPTURE_MESSAGE_TYPE;
  command: "status";
};

export type StopMediaCaptureMessage = {
  type: typeof MEDIA_CAPTURE_MESSAGE_TYPE;
  command: "stop";
  reason: "completed" | "cancelled" | "navigation" | "tab_closed" | "consent_revoked" | "runtime_disconnected" | "timeout" | "failed";
};

export type MediaCaptureMessage = StartMediaCaptureMessage | StopMediaCaptureMessage | StatusMediaCaptureMessage;

export type MediaCaptureResponse =
  | { ok: true; state: "armed" | "starting" | "capturing" | "stopped"; grantId?: string }
  | { ok: true; state: "transcribing"; transcript: { taskId: string; state: string } }
  | { ok: false; failureCode: string };

export const CAPTURE_ROUTE_ORDER = [
  "credentialed_subtitle",
  "credentialed_media_asr",
  "public_or_page_subtitle"
] as const;

export type CaptureRouteFailure = {
  route: typeof CAPTURE_ROUTE_ORDER[number];
  failureCode: string;
};

export function captureFallbackEligible(failures: readonly CaptureRouteFailure[]): boolean {
  return failures.length === CAPTURE_ROUTE_ORDER.length
    && failures.every((failure, index) =>
      failure.route === CAPTURE_ROUTE_ORDER[index]
      && /^V3_MEDIA_[A-Z0-9_]{3,80}$/.test(failure.failureCode)
    );
}
