import type { PortalCredentialChannelRecord } from "./contracts";
import type { PortalCredentialMessageClient, PortalCredentialMessageResponse } from "./PortalCredentialMessageClient";

export type PortalCredentialChannelInput = {
  taskId: string;
  adapterId: string;
  policyId: string;
  policyRevision: number;
  credentialNameSetSha256: string;
};

export type PortalCredentialChannelBootstrap = PortalCredentialChannelInput & {
  browserSessionBindingSha256: string;
};

export type PortalCredentialChannelBootstrapResult = {
  channelToken: string;
  channel: PortalCredentialChannelRecord;
};

export interface PortalCredentialRuntimeBootstrap {
  createChannel(input: PortalCredentialChannelBootstrap): Promise<PortalCredentialChannelBootstrapResult>;
}

export class PortalCredentialChannelClient {
  readonly #runtime: PortalCredentialRuntimeBootstrap;
  readonly #messages: Pick<PortalCredentialMessageClient, "getBrowserSessionBinding" | "exchangeChannel">;

  constructor(dependencies: {
    runtime: PortalCredentialRuntimeBootstrap;
    messages: Pick<PortalCredentialMessageClient, "getBrowserSessionBinding" | "exchangeChannel">;
  }) {
    this.#runtime = dependencies.runtime;
    this.#messages = dependencies.messages;
  }

  async establish(input: PortalCredentialChannelInput): Promise<PortalCredentialMessageResponse<unknown>> {
    const binding = await this.#messages.getBrowserSessionBinding();
    if (!binding.ok) return binding;
    const bootstrap = await this.#runtime.createChannel({
      ...input,
      browserSessionBindingSha256: binding.value.browserSessionBindingSha256
    });
    return this.#messages.exchangeChannel(bootstrap.channelToken, bootstrap.channel);
  }
}
