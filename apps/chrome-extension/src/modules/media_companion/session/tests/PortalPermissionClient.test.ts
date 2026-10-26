import { describe, expect, it, vi } from "vitest";
import type { PortalSessionAdapter } from "../PortalSessionAdapter";
import { PortalPermissionClient } from "../PortalPermissionClient";
import { PortalSessionRegistry } from "../PortalSessionRegistry";
import type { PortalSessionPolicyDefinition } from "../contracts";

const definition: PortalSessionPolicyDefinition = {
  adapterId: "example",
  sessionAdapterId: "example-session",
  policyId: "example-media-consent/v1",
  policyRevision: 1,
  permissionDescriptor: { permissions: ["cookies"], origins: ["https://media.example/*"] },
  consentScopeIds: ["example_session_access"],
  credentialNameSetSha256: "a".repeat(64)
};
const adapter: PortalSessionAdapter = {
  definition,
  async inspectCapability() { throw new Error("not used"); }
};

function setup(requestResult = true, containsResults = [false, false, true, true]) {
  const permissionsApi = {
    request: vi.fn(async () => requestResult),
    contains: vi.fn(async () => containsResults.shift() ?? true),
    remove: vi.fn(async () => true)
  };
  return {
    client: new PortalPermissionClient({
      registry: new PortalSessionRegistry([adapter]),
      permissionsApi
    }),
    permissionsApi
  };
}

describe("PortalPermissionClient", () => {
  it("requests only the build-time descriptor when either permission class is missing, then rechecks both", async () => {
    const { client, permissionsApi } = setup();
    await expect(client.request("example")).resolves.toEqual({
      namedPermissionGranted: true,
      hostPermissionGranted: true
    });
    expect(permissionsApi.request).toHaveBeenCalledWith({
      permissions: ["cookies"],
      origins: ["https://media.example/*"]
    });
    expect(permissionsApi.contains).toHaveBeenNthCalledWith(1, { permissions: ["cookies"] });
    expect(permissionsApi.contains).toHaveBeenNthCalledWith(2, { origins: ["https://media.example/*"] });
    expect(permissionsApi.contains).toHaveBeenNthCalledWith(3, { permissions: ["cookies"] });
    expect(permissionsApi.contains).toHaveBeenNthCalledWith(4, { origins: ["https://media.example/*"] });
  });

  it("does not claim permission after Chrome rejects the trusted request", async () => {
    const { client, permissionsApi } = setup(false, [false, false]);
    await expect(client.request("example")).resolves.toEqual({
      namedPermissionGranted: false,
      hostPermissionGranted: false
    });
    expect(permissionsApi.contains).toHaveBeenCalledTimes(2);
  });

  it("is idempotent when both permission classes are already granted", async () => {
    const { client, permissionsApi } = setup(true, [true, true]);
    await expect(client.request("example")).resolves.toEqual({
      namedPermissionGranted: true,
      hostPermissionGranted: true
    });
    expect(permissionsApi.request).not.toHaveBeenCalled();
    expect(permissionsApi.contains).toHaveBeenCalledTimes(2);
  });

  it("removes only the registered descriptor and rejects unknown adapters", async () => {
    const { client, permissionsApi } = setup();
    await expect(client.remove("example")).resolves.toBe(true);
    expect(permissionsApi.remove).toHaveBeenCalledWith({
      permissions: ["cookies"],
      origins: ["https://media.example/*"]
    });
    await expect(client.request("unknown")).rejects.toThrow("V3_MEDIA_SESSION_ADAPTER_UNSUPPORTED");
  });
});

