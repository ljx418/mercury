import { describe, expect, it, vi } from "vitest";
import { PortalCredentialChannelClient } from "../PortalCredentialChannelClient";

describe("PortalCredentialChannelClient", () => {
  it("gets the public binding, bootstraps once, and forwards the transient channel once", async () => {
    const binding = "b".repeat(64);
    const channel = { browserSessionBindingSha256: binding } as any;
    const runtime = { createChannel: vi.fn(async () => ({ channelToken: "A".repeat(43), channel })) };
    const messages = {
      getBrowserSessionBinding: vi.fn(async () => ({ ok: true as const, value: { browserSessionBindingSha256: binding } })),
      exchangeChannel: vi.fn(async () => ({ ok: false as const, failureCode: "V3_MEDIA_CREDENTIAL_TRANSPORT_FAILED" }))
    };
    const client = new PortalCredentialChannelClient({ runtime, messages });
    await expect(client.establish({
      taskId: `media_task_${"1".repeat(32)}`,
      adapterId: "example",
      policyId: "example-media-consent/v1",
      policyRevision: 1,
      credentialNameSetSha256: "c".repeat(64)
    })).resolves.toEqual({ ok: false, failureCode: "V3_MEDIA_CREDENTIAL_TRANSPORT_FAILED" });
    expect(runtime.createChannel).toHaveBeenCalledOnce();
    expect(runtime.createChannel).toHaveBeenCalledWith(expect.objectContaining({ browserSessionBindingSha256: binding }));
    expect(messages.exchangeChannel).toHaveBeenCalledOnce();
  });

  it("does not bootstrap when the trusted binding request fails", async () => {
    const runtime = { createChannel: vi.fn() };
    const messages = {
      getBrowserSessionBinding: vi.fn(async () => ({ ok: false as const, failureCode: "V3_MEDIA_POLICY_NOT_GRANTED" })),
      exchangeChannel: vi.fn()
    };
    const client = new PortalCredentialChannelClient({ runtime, messages });
    await expect(client.establish({
      taskId: `media_task_${"1".repeat(32)}`,
      adapterId: "example",
      policyId: "example-media-consent/v1",
      policyRevision: 1,
      credentialNameSetSha256: "c".repeat(64)
    })).resolves.toEqual({ ok: false, failureCode: "V3_MEDIA_POLICY_NOT_GRANTED" });
    expect(runtime.createChannel).not.toHaveBeenCalled();
    expect(messages.exchangeChannel).not.toHaveBeenCalled();
  });
});
