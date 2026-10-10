import type { MediaCaptureController } from "./MediaCaptureController";
import {
  MEDIA_CAPTURE_MESSAGE_TYPE,
  type MediaCaptureMessage,
  type MediaCaptureResponse,
  type PublicMediaCaptureGrant
} from "./contracts";

export type MediaCaptureSender = { id?: string; url?: string; hasTab: boolean; tabUrl?: string };

const DOCUMENTS = new Map([
  ["sidepanel.html", "side_panel"],
  ["workspace.html", "workspace"]
]);

function trustedSurface(sender: MediaCaptureSender, runtimeId: string, extensionBaseUrl: string, isTrustedEmbeddedTabUrl?: (url: string) => boolean) {
  if (sender.id !== runtimeId || !sender.url || !sender.url.startsWith(extensionBaseUrl)) return null;
  const path = sender.url.slice(extensionBaseUrl.length).split(/[?#]/, 1)[0];
  const surface = DOCUMENTS.get(path) ?? null;
  if (surface === "side_panel" && sender.hasTab) {
    const embeddedSurface = new URL(sender.url).searchParams.get("naviaInPage") === "1";
    if (!embeddedSurface || !sender.tabUrl || isTrustedEmbeddedTabUrl?.(sender.tabUrl) !== true) return null;
  }
  return surface;
}

function isGrant(value: unknown): value is PublicMediaCaptureGrant {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const keys = ["adapterId", "expiresAt", "grantId", "issuedAt", "oneShot", "pageIdentitySha256", "persisted", "state", "surface", "tabIdSha256", "taskId"];
  return Object.keys(record).sort().join("|") === keys.sort().join("|")
    && typeof record.grantId === "string"
    && /^mcg_[a-f0-9]{32}$/.test(record.grantId)
    && typeof record.taskId === "string"
    && /^media_task_[a-f0-9]{32}$/.test(record.taskId)
    && typeof record.adapterId === "string"
    && /^[a-z][a-z0-9_-]{1,31}$/.test(record.adapterId)
    && typeof record.pageIdentitySha256 === "string"
    && /^[a-f0-9]{64}$/.test(record.pageIdentitySha256)
    && typeof record.tabIdSha256 === "string"
    && /^[a-f0-9]{64}$/.test(record.tabIdSha256)
    && ["side_panel", "workspace"].includes(String(record.surface))
    && record.oneShot === true && record.persisted === false && record.state === "issued";
}

function parse(value: unknown): MediaCaptureMessage | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (record.type !== MEDIA_CAPTURE_MESSAGE_TYPE) return null;
  if (record.command === "arm") {
    const expected = ["acquisitionRecordId", "command", "grant", "sourceIdentity", "ticket", "trustedClick", "type", "userActivation"];
    if (Object.keys(record).sort().join("|") !== expected.sort().join("|") || !isGrant(record.grant)) return null;
    if (record.trustedClick !== true || record.userActivation !== true || typeof record.ticket !== "string" || record.ticket.length < 43) return null;
    if (typeof record.sourceIdentity !== "string" || !record.sourceIdentity || typeof record.acquisitionRecordId !== "string" || !record.acquisitionRecordId) return null;
    return record as MediaCaptureMessage;
  }
  if (record.command === "status") {
    return Object.keys(record).sort().join("|") === ["command", "type"].sort().join("|") ? record as MediaCaptureMessage : null;
  }
  if (record.command === "stop") {
    const reasons = ["completed", "cancelled", "navigation", "tab_closed", "consent_revoked", "runtime_disconnected", "timeout", "failed"];
    if (Object.keys(record).sort().join("|") !== ["command", "reason", "type"].sort().join("|") || !reasons.includes(String(record.reason))) return null;
    return record as MediaCaptureMessage;
  }
  return null;
}

export class MediaCaptureMessageRouter {
  constructor(
    private readonly runtimeId: string,
    private readonly extensionBaseUrl: string,
    private readonly controller: Pick<MediaCaptureController, "arm" | "stop" | "status">,
    private readonly isTrustedEmbeddedTabUrl?: (url: string) => boolean
  ) {}

  async handle(value: unknown, sender: MediaCaptureSender): Promise<MediaCaptureResponse> {
    const surface = trustedSurface(sender, this.runtimeId, this.extensionBaseUrl, this.isTrustedEmbeddedTabUrl);
    if (!surface) return { ok: false, failureCode: "V3_MEDIA_CAPTURE_BACKGROUND_FORBIDDEN" };
    const message = parse(value);
    if (!message) return { ok: false, failureCode: "V3_MEDIA_CAPTURE_MESSAGE_INVALID" };
    if (message.command === "arm" && message.grant.surface !== surface) {
      return { ok: false, failureCode: "V3_MEDIA_CAPTURE_BINDING_MISMATCH" };
    }
    if (message.command === "arm") return this.controller.arm(message);
    if (message.command === "status") return this.controller.status();
    return this.controller.stop(message);
  }
}
