import { isPortalCredentialChannelRecord } from "./validateCredentialTransportContracts";
import {
  PORTAL_CREDENTIAL_MESSAGE_TYPE,
  type PortalCredentialMessage,
  type PortalCredentialMessageResponse
} from "./PortalCredentialMessageClient";

export type PortalCredentialMessageSender = {
  id?: string;
  url?: string;
  hasTab: boolean;
  tabUrl?: string;
};

export type PortalCredentialMessageRouterDependencies = {
  runtimeId: string;
  extensionBaseUrl: string;
  getBrowserSessionBindingSha256(): Promise<string>;
  isTrustedEmbeddedTabUrl?(url: string): boolean;
  exchange(
    message: Extract<PortalCredentialMessage, { command: "exchange_channel" }>
  ): Promise<PortalCredentialMessageResponse<unknown>>;
  revokeLease(leaseId: string): Promise<boolean>;
};

const tokenPattern = /^[A-Za-z0-9_-]{43}$/;
const sha256Pattern = /^[a-f0-9]{64}$/;
const leaseIdPattern = /^pcl_[a-f0-9]{32}$/;

function failure(failureCode: string): PortalCredentialMessageResponse<never> {
  return { ok: false, failureCode };
}

function isTrustedExtensionDocument(sender: PortalCredentialMessageSender, dependencies: PortalCredentialMessageRouterDependencies) {
  if (sender.id !== dependencies.runtimeId || !sender.url) return false;
  if (!sender.url.startsWith(dependencies.extensionBaseUrl)) return false;
  const relativeUrl = sender.url.slice(dependencies.extensionBaseUrl.length);
  const relativePath = relativeUrl.split(/[?#]/, 1)[0];
  if (relativePath === "sidepanel.html") {
    if (!sender.hasTab) return true;
    const embeddedSurface = new URL(sender.url).searchParams.get("naviaInPage") === "1";
    return embeddedSurface
      && typeof sender.tabUrl === "string"
      && dependencies.isTrustedEmbeddedTabUrl?.(sender.tabUrl) === true;
  }
  return relativePath === "workspace.html";
}

function parseMessage(value: unknown): PortalCredentialMessage | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (record.type !== PORTAL_CREDENTIAL_MESSAGE_TYPE || typeof record.command !== "string") return null;
  if (record.command === "get_browser_session_binding") {
    return Object.keys(record).length === 2
      ? { type: PORTAL_CREDENTIAL_MESSAGE_TYPE, command: "get_browser_session_binding" }
      : null;
  }
  if (record.command === "revoke_lease") {
    return Object.keys(record).length === 3 && typeof record.leaseId === "string" && leaseIdPattern.test(record.leaseId)
      ? { type: PORTAL_CREDENTIAL_MESSAGE_TYPE, command: "revoke_lease", leaseId: record.leaseId }
      : null;
  }
  if (record.command !== "exchange_channel") return null;
  if (Object.keys(record).length !== 4 || typeof record.channelToken !== "string" || !tokenPattern.test(record.channelToken)) {
    return null;
  }
  if (!isPortalCredentialChannelRecord(record.channel)) return null;
  return {
    type: PORTAL_CREDENTIAL_MESSAGE_TYPE,
    command: "exchange_channel",
    channelToken: record.channelToken,
    channel: record.channel
  };
}

export class PortalCredentialMessageRouter {
  readonly #dependencies: PortalCredentialMessageRouterDependencies;

  constructor(dependencies: PortalCredentialMessageRouterDependencies) {
    this.#dependencies = dependencies;
  }

  async handle(rawMessage: unknown, sender: PortalCredentialMessageSender): Promise<PortalCredentialMessageResponse<unknown>> {
    if (!isTrustedExtensionDocument(sender, this.#dependencies)) {
      return failure("V3_MEDIA_POLICY_NOT_GRANTED");
    }
    const message = parseMessage(rawMessage);
    if (!message) return failure("V3_MEDIA_ENVELOPE_INVALID");
    try {
      const binding = await this.#dependencies.getBrowserSessionBindingSha256();
      if (!sha256Pattern.test(binding)) return failure("V3_MEDIA_CHANNEL_INVALID");
      if (message.command === "get_browser_session_binding") {
        return { ok: true, value: { browserSessionBindingSha256: binding } };
      }
      if (message.command === "revoke_lease") {
        return await this.#dependencies.revokeLease(message.leaseId)
          ? { ok: true, value: { revoked: true } }
          : failure("V3_MEDIA_LEASE_REVOKED");
      }
      if (message.channel.browserSessionBindingSha256 !== binding) {
        return failure("V3_MEDIA_CHANNEL_INVALID");
      }
      return await this.#dependencies.exchange(message);
    } catch {
      return failure("V3_MEDIA_CREDENTIAL_TRANSPORT_FAILED");
    }
  }
}
