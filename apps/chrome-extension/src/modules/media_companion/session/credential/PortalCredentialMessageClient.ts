import type { PortalCredentialChannelRecord, PortalCredentialLease } from "./contracts";

export const PORTAL_CREDENTIAL_MESSAGE_TYPE = "navia.mediaCredential" as const;

export type PortalCredentialMessage =
  | { type: typeof PORTAL_CREDENTIAL_MESSAGE_TYPE; command: "get_browser_session_binding" }
  | { type: typeof PORTAL_CREDENTIAL_MESSAGE_TYPE; command: "revoke_lease"; leaseId: string }
  | {
      type: typeof PORTAL_CREDENTIAL_MESSAGE_TYPE;
      command: "exchange_channel";
      channelToken: string;
      channel: PortalCredentialChannelRecord;
    };

export type PortalCredentialMessageResponse<T> =
  | { ok: true; value: T }
  | { ok: false; failureCode: string };

export interface PortalCredentialMessageTransport {
  sendMessage(message: PortalCredentialMessage): Promise<unknown>;
}

export class PortalCredentialMessageClient {
  readonly #transport: PortalCredentialMessageTransport;

  constructor(transport: PortalCredentialMessageTransport) {
    this.#transport = transport;
  }

  getBrowserSessionBinding(): Promise<PortalCredentialMessageResponse<{ browserSessionBindingSha256: string }>> {
    return this.#send({ type: PORTAL_CREDENTIAL_MESSAGE_TYPE, command: "get_browser_session_binding" });
  }

  exchangeChannel(
    channelToken: string,
    channel: PortalCredentialChannelRecord
  ): Promise<PortalCredentialMessageResponse<PortalCredentialLease>> {
    return this.#send({
      type: PORTAL_CREDENTIAL_MESSAGE_TYPE,
      command: "exchange_channel",
      channelToken,
      channel
    });
  }

  revokeLease(leaseId: string): Promise<PortalCredentialMessageResponse<{ revoked: true }>> {
    return this.#send({ type: PORTAL_CREDENTIAL_MESSAGE_TYPE, command: "revoke_lease", leaseId });
  }

  async #send<T>(message: PortalCredentialMessage): Promise<PortalCredentialMessageResponse<T>> {
    const response = await this.#transport.sendMessage(message);
    if (!response || typeof response !== "object" || Array.isArray(response)) {
      return { ok: false, failureCode: "V3_MEDIA_CREDENTIAL_TRANSPORT_FAILED" };
    }
    const record = response as Record<string, unknown>;
    if (record.ok === true && "value" in record) return { ok: true, value: record.value as T };
    return {
      ok: false,
      failureCode: typeof record.failureCode === "string"
        ? record.failureCode
        : "V3_MEDIA_CREDENTIAL_TRANSPORT_FAILED"
    };
  }
}
