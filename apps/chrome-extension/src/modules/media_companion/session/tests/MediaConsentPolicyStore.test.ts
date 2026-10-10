import { describe, expect, it, vi } from "vitest";
import type { PortalSessionAdapter } from "../PortalSessionAdapter";
import { MediaConsentPolicyStore, type MediaConsentPolicyStorage } from "../MediaConsentPolicyStore";
import { PortalSessionRegistry } from "../PortalSessionRegistry";
import type { PortalSessionPolicyDefinition } from "../contracts";

const definition: PortalSessionPolicyDefinition = {
  adapterId: "example",
  sessionAdapterId: "example-session",
  policyId: "example-media-consent/v1",
  policyRevision: 1,
  permissionDescriptor: { permissions: ["cookies"], origins: ["https://media.example/*"] },
  consentScopeIds: ["scope_one", "scope_two"],
  credentialNameSetSha256: "a".repeat(64)
};
const adapter: PortalSessionAdapter = {
  definition,
  async inspectCapability() { throw new Error("not used"); }
};

function setup(seed: unknown = undefined) {
  const values: Record<string, unknown> = {};
  if (seed !== undefined) values["navia.mediaConsentPolicy.example"] = seed;
  const storage: MediaConsentPolicyStorage = {
    get: vi.fn(async (key) => ({ [key]: values[key] })),
    set: vi.fn(async (items) => { Object.assign(values, structuredClone(items)); })
  };
  const store = new MediaConsentPolicyStore({
    registry: new PortalSessionRegistry([adapter]),
    storage,
    now: () => new Date("2026-09-17T08:00:00Z")
  });
  return { store, storage, values };
}

describe("MediaConsentPolicyStore", () => {
  it("returns a closed not_granted default for missing or malformed storage", async () => {
    const { store } = setup({ cookieValue: "must-not-survive" });
    await expect(store.getPolicy("example")).resolves.toEqual({
      schemaVersion: "media-consent-policy/v1",
      policyId: definition.policyId,
      adapterId: "example",
      policyRevision: 1,
      status: "not_granted",
      scopeGrants: [
        { scopeId: "scope_one", granted: false },
        { scopeId: "scope_two", granted: false }
      ],
      decidedAt: null,
      revokedAt: null
    });
  });

  it("persists only the frozen policy fields for grant, denial, and revoke", async () => {
    const { store, values } = setup();
    const granted = await store.recordGrant("example");
    expect(granted.status).toBe("granted");
    expect(granted.scopeGrants.every((scope) => scope.granted)).toBe(true);
    expect(Object.keys(values["navia.mediaConsentPolicy.example"] as object).sort()).toEqual([
      "adapterId", "decidedAt", "policyId", "policyRevision", "revokedAt", "schemaVersion", "scopeGrants", "status"
    ]);

    expect((await store.recordDenial("example")).status).toBe("denied");
    const revoked = await store.revokePolicy("example");
    expect(revoked).toMatchObject({ status: "revoked", revokedAt: "2026-09-17T08:00:00.000Z" });
    expect(revoked.scopeGrants.every((scope) => !scope.granted)).toBe(true);
  });

  it("projects valid records and drops extra secret fields on read", async () => {
    const { store } = setup({
      schemaVersion: "media-consent-policy/v1",
      policyId: definition.policyId,
      adapterId: "example",
      policyRevision: 1,
      status: "granted",
      scopeGrants: definition.consentScopeIds.map((scopeId) => ({ scopeId, granted: true })),
      decidedAt: "2026-09-17T08:00:00Z",
      revokedAt: null,
      cookieValue: "must-not-return"
    });
    const policy = await store.getPolicy("example");
    expect(policy).not.toHaveProperty("cookieValue");
    expect(Object.keys(policy!).sort()).toEqual([
      "adapterId", "decidedAt", "policyId", "policyRevision", "revokedAt", "schemaVersion", "scopeGrants", "status"
    ]);
  });
});

