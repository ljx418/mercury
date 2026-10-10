import { describe, expect, it } from "vitest";
import {
  MEDIA_CONSENT_POLICY_SCHEMA_VERSION,
  PORTAL_SESSION_CAPABILITY_SCHEMA_VERSION,
  type MediaSessionContractPair,
  type PortalSessionPolicyDefinition
} from "../contracts";
import { validateMediaSessionContracts } from "../validateMediaSessionContracts";

const definition: PortalSessionPolicyDefinition = {
  adapterId: "example",
  sessionAdapterId: "example-session",
  policyId: "example-media-consent/v1",
  policyRevision: 1,
  permissionDescriptor: { permissions: ["cookies"], origins: ["https://media.example/*"] },
  consentScopeIds: ["scope_one", "scope_two"],
  credentialNameSetSha256: "a".repeat(64)
};
const base: MediaSessionContractPair = {
  policy: {
    schemaVersion: MEDIA_CONSENT_POLICY_SCHEMA_VERSION,
    policyId: definition.policyId,
    adapterId: definition.adapterId,
    policyRevision: 1,
    status: "granted",
    scopeGrants: definition.consentScopeIds.map((scopeId) => ({ scopeId, granted: true })),
    decidedAt: "2026-09-17T08:00:00Z",
    revokedAt: null
  },
  capability: {
    schemaVersion: PORTAL_SESSION_CAPABILITY_SCHEMA_VERSION,
    adapterId: definition.adapterId,
    sessionAdapterId: definition.sessionAdapterId,
    policyId: definition.policyId,
    policyRevision: 1,
    status: "available",
    permissionState: { namedPermissionGranted: true, hostPermissionGranted: true },
    credentialCount: 2,
    credentialNameSetSha256: definition.credentialNameSetSha256,
    serverValidated: false,
    observedAt: "2026-09-17T08:00:05Z",
    expiresAt: "2026-09-17T08:00:35Z",
    failureCode: null
  }
};

describe("validateMediaSessionContracts", () => {
  it("accepts the frozen positive shape", () => {
    expect(validateMediaSessionContracts(structuredClone(base), definition)).toEqual({ valid: true });
  });

  it.each([
    ["V3S-N-005", (pair: MediaSessionContractPair) => pair.policy.scopeGrants.pop(), "V3_MEDIA_SESSION_SCOPE_SET_INVALID"],
    ["V3S-N-006", (pair: MediaSessionContractPair) => { pair.capability.permissionState.hostPermissionGranted = false; }, "V3_MEDIA_SESSION_CAPABILITY_INCONSISTENT"],
    ["V3S-N-007", (pair: MediaSessionContractPair) => { pair.capability.credentialCount = null; }, "V3_MEDIA_SESSION_CAPABILITY_INCONSISTENT"],
    ["V3S-N-008", (pair: MediaSessionContractPair) => { pair.capability.credentialNameSetSha256 = "0".repeat(64); }, "V3_MEDIA_SESSION_NAME_SET_INVALID"],
    ["V3S-N-009", (pair: MediaSessionContractPair) => { pair.capability.expiresAt = "2026-09-17T08:00:04Z"; }, "V3_MEDIA_SESSION_OBSERVATION_EXPIRED"],
    ["V3S-N-010", (pair: MediaSessionContractPair) => { pair.capability.adapterId = "other"; }, "V3_MEDIA_SESSION_ADAPTER_MISMATCH"],
    ["V3S-N-011", (pair: MediaSessionContractPair) => { pair.policy.status = "revoked"; }, "V3_MEDIA_SESSION_REVOKED"],
    ["V3S-N-012", (pair: MediaSessionContractPair) => { pair.capability.status = "permission_required"; }, "V3_MEDIA_SESSION_CAPABILITY_INCONSISTENT"]
  ])("rejects semantic fixture %s with the exact failure code", (_id, mutate, failureCode) => {
    const pair = structuredClone(base);
    mutate(pair);
    expect(validateMediaSessionContracts(pair, definition)).toEqual({ valid: false, failureCode });
  });
});

