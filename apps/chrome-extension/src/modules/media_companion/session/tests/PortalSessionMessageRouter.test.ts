import { describe, expect, it, vi } from "vitest";
import { PORTAL_SESSION_MESSAGE_TYPE } from "../PortalSessionMessageClient";
import { PortalSessionMessageRouter } from "../PortalSessionMessageRouter";

const trustedSender = {
  id: "extension-id",
  url: "chrome-extension://extension-id/sidepanel.html",
  hasTab: false
};

function setup(permissionState = { namedPermissionGranted: true, hostPermissionGranted: true }) {
  const policy = { adapterId: "bilibili", policyRevision: 1, status: "granted" };
  const dependencies = {
    runtimeId: "extension-id",
    extensionBaseUrl: "chrome-extension://extension-id/",
    policyStore: {
      getPolicy: vi.fn(async () => policy as never),
      recordGrant: vi.fn(async () => policy as never),
      recordDenial: vi.fn(async () => ({ ...policy, status: "denied" }) as never),
      revokePolicy: vi.fn(async () => ({ ...policy, status: "revoked" }) as never)
    },
    permissionClient: {
      containsForAdapter: vi.fn(async () => permissionState),
      remove: vi.fn(async () => true)
    },
    broker: {
      inspectCapability: vi.fn(async () => ({ ok: false, failureCode: "V3_MEDIA_SESSION_ADAPTER_UNSUPPORTED" } as const))
    }
  };
  return { router: new PortalSessionMessageRouter(dependencies), dependencies };
}

describe("PortalSessionMessageRouter", () => {
  it("rejects content scripts, external ids, and non-product extension documents before dependencies", async () => {
    for (const sender of [
      { ...trustedSender, url: "https://www.bilibili.com/video/BV1ZpYd66ELP", hasTab: true },
      { ...trustedSender, id: "other-extension" },
      { ...trustedSender, url: "chrome-extension://extension-id/options.html" }
    ]) {
      const { router, dependencies } = setup();
      await expect(router.handle({ type: PORTAL_SESSION_MESSAGE_TYPE, command: "get_policy", adapterId: "bilibili" }, sender)).resolves.toEqual({
        ok: false,
        failureCode: "V3_MEDIA_SESSION_PERMISSION_DENIED"
      });
      expect(dependencies.policyStore.getPolicy).not.toHaveBeenCalled();
    }
  });

  it("accepts an exact product extension document even when Chrome associates it with a tab", async () => {
    const { router, dependencies } = setup();
    const result = await router.handle({
      type: PORTAL_SESSION_MESSAGE_TYPE,
      command: "get_policy",
      adapterId: "bilibili"
    }, { ...trustedSender, hasTab: true });
    expect(result.ok).toBe(true);
    expect(dependencies.policyStore.getPolicy).toHaveBeenCalledOnce();
  });

  it.each(["host", "cookieName", "cookieValue", "credential"])("rejects the extra %s field before reads", async (field) => {
    const { router, dependencies } = setup();
    const message = {
      type: PORTAL_SESSION_MESSAGE_TYPE,
      command: "inspect_capability",
      adapterId: "bilibili",
      policyRevision: 1,
      [field]: "attacker-controlled"
    };
    await expect(router.handle(message, trustedSender)).resolves.toEqual({
      ok: false,
      failureCode: "V3_MEDIA_SESSION_POLICY_MISMATCH"
    });
    expect(dependencies.broker.inspectCapability).not.toHaveBeenCalled();
    expect(dependencies.permissionClient.containsForAdapter).not.toHaveBeenCalled();
  });

  it("records a grant only after both registered permissions are present", async () => {
    const denied = setup({ namedPermissionGranted: true, hostPermissionGranted: false });
    const message = { type: PORTAL_SESSION_MESSAGE_TYPE, command: "record_grant", adapterId: "bilibili" };
    await expect(denied.router.handle(message, trustedSender)).resolves.toEqual({
      ok: false,
      failureCode: "V3_MEDIA_SESSION_PERMISSION_REQUIRED"
    });
    expect(denied.dependencies.policyStore.recordGrant).not.toHaveBeenCalled();

    const granted = setup();
    const result = await granted.router.handle(message, trustedSender);
    expect(result.ok).toBe(true);
    expect(granted.dependencies.policyStore.recordGrant).toHaveBeenCalledOnce();
  });

  it("rechecks removal before persisting revoke", async () => {
    const { router, dependencies } = setup({ namedPermissionGranted: false, hostPermissionGranted: false });
    const result = await router.handle({
      type: PORTAL_SESSION_MESSAGE_TYPE,
      command: "revoke_policy",
      adapterId: "bilibili"
    }, trustedSender);
    expect(result.ok).toBe(true);
    expect(dependencies.permissionClient.remove).toHaveBeenCalledOnce();
    expect(dependencies.policyStore.revokePolicy).toHaveBeenCalledOnce();
  });

  it("forwards only the registered inspect fields to the Broker", async () => {
    const { router, dependencies } = setup();
    await router.handle({
      type: PORTAL_SESSION_MESSAGE_TYPE,
      command: "inspect_capability",
      adapterId: "bilibili",
      policyRevision: 1
    }, trustedSender);
    expect(dependencies.broker.inspectCapability).toHaveBeenCalledWith({ adapterId: "bilibili", policyRevision: 1 });
  });
});
