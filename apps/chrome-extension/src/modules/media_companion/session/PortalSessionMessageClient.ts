import type { MediaConsentPolicyRecord, PortalSessionBrokerResult } from "./contracts";

export const PORTAL_SESSION_MESSAGE_TYPE = "navia.mediaSession" as const;

export type PortalSessionCommandMessage =
  | { type: typeof PORTAL_SESSION_MESSAGE_TYPE; command: "get_policy"; adapterId: string }
  | { type: typeof PORTAL_SESSION_MESSAGE_TYPE; command: "record_grant"; adapterId: string }
  | { type: typeof PORTAL_SESSION_MESSAGE_TYPE; command: "record_denial"; adapterId: string }
  | { type: typeof PORTAL_SESSION_MESSAGE_TYPE; command: "revoke_policy"; adapterId: string }
  | { type: typeof PORTAL_SESSION_MESSAGE_TYPE; command: "inspect_capability"; adapterId: string; policyRevision: number };

export type PortalSessionMessageResponse<T> =
  | { ok: true; value: T }
  | { ok: false; failureCode: string };

export interface PortalSessionMessageTransport {
  sendMessage(message: PortalSessionCommandMessage): Promise<unknown>;
}

export class PortalSessionMessageClient {
  readonly #transport: PortalSessionMessageTransport;

  constructor(transport: PortalSessionMessageTransport) {
    this.#transport = transport;
  }

  getPolicy(adapterId: string): Promise<PortalSessionMessageResponse<MediaConsentPolicyRecord>> {
    return this.#send({ type: PORTAL_SESSION_MESSAGE_TYPE, command: "get_policy", adapterId });
  }

  recordGrant(adapterId: string): Promise<PortalSessionMessageResponse<MediaConsentPolicyRecord>> {
    return this.#send({ type: PORTAL_SESSION_MESSAGE_TYPE, command: "record_grant", adapterId });
  }

  recordDenial(adapterId: string): Promise<PortalSessionMessageResponse<MediaConsentPolicyRecord>> {
    return this.#send({ type: PORTAL_SESSION_MESSAGE_TYPE, command: "record_denial", adapterId });
  }

  revokePolicy(adapterId: string): Promise<PortalSessionMessageResponse<MediaConsentPolicyRecord>> {
    return this.#send({ type: PORTAL_SESSION_MESSAGE_TYPE, command: "revoke_policy", adapterId });
  }

  inspectCapability(adapterId: string, policyRevision: number): Promise<PortalSessionMessageResponse<PortalSessionBrokerResult>> {
    return this.#send({
      type: PORTAL_SESSION_MESSAGE_TYPE,
      command: "inspect_capability",
      adapterId,
      policyRevision
    });
  }

  async #send<T>(message: PortalSessionCommandMessage): Promise<PortalSessionMessageResponse<T>> {
    const response = await this.#transport.sendMessage(message);
    if (!response || typeof response !== "object" || Array.isArray(response)) {
      return { ok: false, failureCode: "V3_MEDIA_SESSION_READ_FAILED" };
    }
    const record = response as Record<string, unknown>;
    if (record.ok === true && "value" in record) {
      return { ok: true, value: record.value as T };
    }
    return {
      ok: false,
      failureCode: typeof record.failureCode === "string"
        ? record.failureCode
        : "V3_MEDIA_SESSION_READ_FAILED"
    };
  }
}

