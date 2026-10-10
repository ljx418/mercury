import { describe, expect, it, vi } from "vitest";
import type { PortalCredentialChannelRecord } from "../contracts";
import { PortalCredentialMessageRouter } from "../PortalCredentialMessageRouter";

const extensionId = "a".repeat(32);
const extensionBaseUrl = `chrome-extension://${extensionId}/`;
const binding = "b".repeat(64);
const channel: PortalCredentialChannelRecord = {
  schemaVersion: "portal-credential-channel-record/v1",
  channelId: `pch_${"1".repeat(32)}`,
  taskId: `media_task_${"2".repeat(32)}`,
  adapterId: "example",
  policyId: "example-media-consent/v1",
  policyRevision: 1,
  browserSessionBindingSha256: binding,
  extensionOriginSha256: "3".repeat(64),
  credentialNameSetSha256: "4".repeat(64),
  transport: "authenticated_loopback_one_shot",
  oneShot: true,
  channelTokenPersisted: false,
  issuedAt: "2026-09-17T10:00:00Z",
  expiresAt: "2026-09-17T10:00:20Z",
  status: "issued",
  failureCode: null
};
const exchangeMessage = {
  type: "navia.mediaCredential" as const,
  command: "exchange_channel" as const,
  channelToken: "A".repeat(43),
  channel
};

describe("PortalCredentialMessageRouter", () => {
  it.each([
    ["sidepanel.html", false],
    ["workspace.html", true]
  ])("accepts trusted %s and invokes the handler once", async (documentPath, hasTab) => {
    const exchange = vi.fn(async () => ({ ok: true as const, value: { leaseId: "public-only" } }));
    const router = new PortalCredentialMessageRouter({
      runtimeId: extensionId,
      extensionBaseUrl,
      getBrowserSessionBindingSha256: async () => binding,
      exchange,
      revokeLease: vi.fn(async () => true)
    });
    await expect(router.handle(exchangeMessage, {
      id: extensionId,
      url: `${extensionBaseUrl}${documentPath}?route=media`,
      hasTab
    })).resolves.toEqual({ ok: true, value: { leaseId: "public-only" } });
    expect(exchange).toHaveBeenCalledOnce();
  });

  it("accepts the in-page Navia surface only on a registered portal tab", async () => {
    const exchange = vi.fn(async () => ({ ok: true as const, value: { leaseId: "public-only" } }));
    const router = new PortalCredentialMessageRouter({
      runtimeId: extensionId,
      extensionBaseUrl,
      isTrustedEmbeddedTabUrl: (url) => url.startsWith("https://www.bilibili.com/video/"),
      getBrowserSessionBindingSha256: async () => binding,
      exchange,
      revokeLease: vi.fn(async () => true)
    });
    await expect(router.handle(exchangeMessage, {
      id: extensionId,
      url: `${extensionBaseUrl}sidepanel.html?naviaInPage=1`,
      hasTab: true,
      tabUrl: "https://www.bilibili.com/video/BV1ZpYd66ELP"
    })).resolves.toEqual({ ok: true, value: { leaseId: "public-only" } });
    expect(exchange).toHaveBeenCalledOnce();
  });

  it.each([
    ["content_script", { id: extensionId, url: "https://www.example.com/watch", hasTab: true }],
    ["external_extension", { id: "b".repeat(32), url: `${extensionBaseUrl}sidepanel.html`, hasTab: false }],
    ["sidepanel_opened_as_tab", { id: extensionId, url: `${extensionBaseUrl}sidepanel.html`, hasTab: true }],
    ["embedded_surface_on_unregistered_tab", { id: extensionId, url: `${extensionBaseUrl}sidepanel.html?naviaInPage=1`, hasTab: true, tabUrl: "https://example.com/" }],
    ["options_page", { id: extensionId, url: `${extensionBaseUrl}options.html`, hasTab: false }],
    ["missing_url", { id: extensionId, hasTab: false }]
  ])("rejects %s before exchange", async (_name, sender) => {
    const exchange = vi.fn();
    const router = new PortalCredentialMessageRouter({
      runtimeId: extensionId,
      extensionBaseUrl,
      getBrowserSessionBindingSha256: async () => binding,
      exchange,
      revokeLease: vi.fn(async () => true)
    });
    await expect(router.handle(exchangeMessage, sender)).resolves.toEqual({ ok: false, failureCode: "V3_MEDIA_POLICY_NOT_GRANTED" });
    expect(exchange).not.toHaveBeenCalled();
  });

  it("rejects extra fields and a binding mismatch before exchange", async () => {
    const exchange = vi.fn();
    const router = new PortalCredentialMessageRouter({
      runtimeId: extensionId,
      extensionBaseUrl,
      getBrowserSessionBindingSha256: async () => binding,
      exchange,
      revokeLease: vi.fn(async () => true)
    });
    const sender = { id: extensionId, url: `${extensionBaseUrl}sidepanel.html`, hasTab: false };
    await expect(router.handle({ ...exchangeMessage, host: "attacker.invalid" }, sender))
      .resolves.toEqual({ ok: false, failureCode: "V3_MEDIA_ENVELOPE_INVALID" });
    await expect(router.handle({ ...exchangeMessage, channel: { ...channel, browserSessionBindingSha256: "c".repeat(64) } }, sender))
      .resolves.toEqual({ ok: false, failureCode: "V3_MEDIA_CHANNEL_INVALID" });
    expect(exchange).not.toHaveBeenCalled();
  });

  it("returns only the public service-worker binding", async () => {
    const router = new PortalCredentialMessageRouter({
      runtimeId: extensionId,
      extensionBaseUrl,
      getBrowserSessionBindingSha256: async () => binding,
      exchange: vi.fn(),
      revokeLease: vi.fn(async () => true)
    });
    await expect(router.handle(
      { type: "navia.mediaCredential", command: "get_browser_session_binding" },
      { id: extensionId, url: `${extensionBaseUrl}workspace.html`, hasTab: true }
    )).resolves.toEqual({ ok: true, value: { browserSessionBindingSha256: binding } });
  });

  it("revokes a task lease through the background-only handle", async () => {
    const revokeLease = vi.fn(async () => true);
    const router = new PortalCredentialMessageRouter({
      runtimeId: extensionId,
      extensionBaseUrl,
      getBrowserSessionBindingSha256: async () => binding,
      exchange: vi.fn(),
      revokeLease
    });
    const leaseId = `pcl_${"9".repeat(32)}`;
    await expect(router.handle(
      { type: "navia.mediaCredential", command: "revoke_lease", leaseId },
      { id: extensionId, url: `${extensionBaseUrl}sidepanel.html`, hasTab: false }
    )).resolves.toEqual({ ok: true, value: { revoked: true } });
    expect(revokeLease).toHaveBeenCalledWith(leaseId);
  });
});
