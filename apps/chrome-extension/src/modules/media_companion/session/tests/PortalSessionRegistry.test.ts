import { describe, expect, it } from "vitest";
import type { PortalSessionAdapter } from "../PortalSessionAdapter";
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

function adapter(overrides: Partial<PortalSessionPolicyDefinition> = {}): PortalSessionAdapter {
  return {
    definition: { ...definition, ...overrides },
    async inspectCapability() {
      throw new Error("not used");
    }
  };
}

describe("PortalSessionRegistry", () => {
  it("resolves only build-time registered adapters", () => {
    const registry = new PortalSessionRegistry([adapter()]);
    expect(registry.resolve("example")?.definition.sessionAdapterId).toBe("example-session");
    expect(registry.resolve("not-registered")).toBeNull();
    expect(registry.list()).toHaveLength(1);
  });

  it("fails closed on duplicate adapter or session adapter ids", () => {
    expect(() => new PortalSessionRegistry([adapter(), adapter()])).toThrow("V3_MEDIA_SESSION_ADAPTER_DUPLICATE");
    expect(() => new PortalSessionRegistry([
      adapter(),
      adapter({ adapterId: "second" })
    ])).toThrow("V3_MEDIA_SESSION_ADAPTER_DUPLICATE");
  });
});

