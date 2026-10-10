import { describe, expect, it, vi } from "vitest";
import type { PortalSessionAdapter } from "../PortalSessionAdapter";
import { PortalSessionBroker } from "../PortalSessionBroker";
import { PortalSessionRegistry } from "../PortalSessionRegistry";
import {
  MEDIA_CONSENT_POLICY_SCHEMA_VERSION,
  PORTAL_SESSION_CAPABILITY_SCHEMA_VERSION,
  type MediaConsentPolicyRecord,
  type PortalSessionCapability,
  type PortalSessionPolicyDefinition
} from "../contracts";

const NOW = new Date("2026-09-17T08:00:05Z");
const definition: PortalSessionPolicyDefinition = {
  adapterId: "example",
  sessionAdapterId: "example-session",
  policyId: "example-media-consent/v1",
  policyRevision: 1,
  permissionDescriptor: { permissions: ["cookies"], origins: ["https://media.example/*"] },
  consentScopeIds: ["example_session_access", "temporary_processing"],
  credentialNameSetSha256: "a".repeat(64)
};
const grantedPolicy: MediaConsentPolicyRecord = {
  schemaVersion: MEDIA_CONSENT_POLICY_SCHEMA_VERSION,
  policyId: definition.policyId,
  adapterId: definition.adapterId,
  policyRevision: 1,
  status: "granted",
  scopeGrants: definition.consentScopeIds.map((scopeId) => ({ scopeId, granted: true })),
  decidedAt: "2026-09-17T08:00:00Z",
  revokedAt: null
};

function availableCapability(): PortalSessionCapability {
  return {
    schemaVersion: PORTAL_SESSION_CAPABILITY_SCHEMA_VERSION,
    adapterId: definition.adapterId,
    sessionAdapterId: definition.sessionAdapterId,
    policyId: definition.policyId,
    policyRevision: 1,
    status: "available",
    permissionState: { namedPermissionGranted: true, hostPermissionGranted: true },
    credentialCount: 1,
    credentialNameSetSha256: definition.credentialNameSetSha256,
    serverValidated: false,
    observedAt: NOW.toISOString(),
    expiresAt: new Date(NOW.getTime() + 30_000).toISOString(),
    failureCode: null
  };
}

function setup(policy: MediaConsentPolicyRecord | null, permissionState = { namedPermissionGranted: true, hostPermissionGranted: true }) {
  const inspectCapability = vi.fn(async () => availableCapability());
  const adapter: PortalSessionAdapter = { definition, inspectCapability };
  const contains = vi.fn(async () => permissionState);
  const broker = new PortalSessionBroker({
    registry: new PortalSessionRegistry([adapter]),
    policyReader: { getPolicy: vi.fn(async () => policy) },
    permissionReader: { contains },
    now: () => NOW
  });
  return { broker, contains, inspectCapability };
}

describe("PortalSessionBroker", () => {
  it("returns unsupported without touching policy, permission, or adapter", async () => {
    const { broker, contains, inspectCapability } = setup(grantedPolicy);
    await expect(broker.inspectCapability({ adapterId: "unknown", policyRevision: 1 })).resolves.toEqual({
      ok: false,
      failureCode: "V3_MEDIA_SESSION_ADAPTER_UNSUPPORTED"
    });
    expect(contains).not.toHaveBeenCalled();
    expect(inspectCapability).not.toHaveBeenCalled();
  });

  it.each([
    ["not_granted", "V3_MEDIA_SESSION_PERMISSION_REQUIRED"],
    ["denied", "V3_MEDIA_SESSION_PERMISSION_DENIED"],
    ["revoked", "V3_MEDIA_SESSION_REVOKED"]
  ] as const)("fails closed for %s before permission and adapter reads", async (status, failureCode) => {
    const { broker, contains, inspectCapability } = setup({ ...grantedPolicy, status });
    const result = await broker.inspectCapability({ adapterId: "example", policyRevision: 1 });
    expect(result.ok && result.capability.failureCode).toBe(failureCode);
    expect(contains).not.toHaveBeenCalled();
    expect(inspectCapability).not.toHaveBeenCalled();
  });

  it("fails closed on revision or scope mismatch before browser reads", async () => {
    const first = setup(grantedPolicy);
    const revisionResult = await first.broker.inspectCapability({ adapterId: "example", policyRevision: 2 });
    expect(revisionResult.ok && revisionResult.capability.failureCode).toBe("V3_MEDIA_SESSION_POLICY_MISMATCH");
    expect(first.contains).not.toHaveBeenCalled();

    const second = setup({ ...grantedPolicy, scopeGrants: grantedPolicy.scopeGrants.slice(0, 1) });
    const scopeResult = await second.broker.inspectCapability({ adapterId: "example", policyRevision: 1 });
    expect(scopeResult.ok && scopeResult.capability.failureCode).toBe("V3_MEDIA_SESSION_SCOPE_SET_INVALID");
    expect(second.contains).not.toHaveBeenCalled();
    expect(second.inspectCapability).not.toHaveBeenCalled();
  });

  it("treats removed browser permissions as revoked and never calls the adapter", async () => {
    const { broker, inspectCapability } = setup(grantedPolicy, {
      namedPermissionGranted: true,
      hostPermissionGranted: false
    });
    const result = await broker.inspectCapability({ adapterId: "example", policyRevision: 1 });
    expect(result.ok && result.capability).toMatchObject({
      status: "revoked",
      failureCode: "V3_MEDIA_SESSION_REVOKED"
    });
    expect(inspectCapability).not.toHaveBeenCalled();
  });

  it("returns a schema-aligned available capability only after every gate", async () => {
    const { broker, contains, inspectCapability } = setup(grantedPolicy);
    const result = await broker.inspectCapability({ adapterId: "example", policyRevision: 1 });
    expect(result).toEqual({ ok: true, capability: availableCapability() });
    expect(contains).toHaveBeenCalledOnce();
    expect(inspectCapability).toHaveBeenCalledOnce();
  });
});

