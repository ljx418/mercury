import type {
  MediaSessionContractPair,
  MediaSessionSemanticValidation,
  PortalSessionPolicyDefinition
} from "./contracts";

function sameStringSet(actual: readonly string[], expected: readonly string[]): boolean {
  if (actual.length !== expected.length) return false;
  const actualSet = new Set(actual);
  if (actualSet.size !== actual.length) return false;
  return expected.every((item) => actualSet.has(item));
}

export function validateMediaSessionContracts(
  pair: MediaSessionContractPair,
  definition: PortalSessionPolicyDefinition
): MediaSessionSemanticValidation {
  const { policy, capability } = pair;
  const scopeIds = policy.scopeGrants.map((scope) => scope.scopeId);

  if (!sameStringSet(scopeIds, definition.consentScopeIds)) {
    return { valid: false, failureCode: "V3_MEDIA_SESSION_SCOPE_SET_INVALID" };
  }
  if (
    policy.adapterId !== definition.adapterId
    || capability.adapterId !== policy.adapterId
    || capability.sessionAdapterId !== definition.sessionAdapterId
  ) {
    return { valid: false, failureCode: "V3_MEDIA_SESSION_ADAPTER_MISMATCH" };
  }
  if (
    policy.policyId !== definition.policyId
    || capability.policyId !== policy.policyId
    || policy.policyRevision !== definition.policyRevision
    || capability.policyRevision !== policy.policyRevision
  ) {
    return { valid: false, failureCode: "V3_MEDIA_SESSION_POLICY_MISMATCH" };
  }
  if (policy.status === "revoked" && capability.status !== "revoked") {
    return { valid: false, failureCode: "V3_MEDIA_SESSION_REVOKED" };
  }

  const observedAt = Date.parse(capability.observedAt);
  const expiresAt = Date.parse(capability.expiresAt);
  if (!Number.isFinite(observedAt) || !Number.isFinite(expiresAt) || expiresAt <= observedAt) {
    return { valid: false, failureCode: "V3_MEDIA_SESSION_OBSERVATION_EXPIRED" };
  }

  if (capability.status === "available") {
    if (!capability.permissionState.namedPermissionGranted || !capability.permissionState.hostPermissionGranted) {
      return { valid: false, failureCode: "V3_MEDIA_SESSION_CAPABILITY_INCONSISTENT" };
    }
    if (capability.credentialCount === null || capability.credentialCount <= 0 || capability.credentialNameSetSha256 === null) {
      return { valid: false, failureCode: "V3_MEDIA_SESSION_CAPABILITY_INCONSISTENT" };
    }
    if (capability.failureCode !== null) {
      return { valid: false, failureCode: "V3_MEDIA_SESSION_CAPABILITY_INCONSISTENT" };
    }
  }

  if (
    capability.credentialNameSetSha256 !== null
    && capability.credentialNameSetSha256 !== definition.credentialNameSetSha256
  ) {
    return { valid: false, failureCode: "V3_MEDIA_SESSION_NAME_SET_INVALID" };
  }

  if (
    capability.status === "permission_required"
    && (capability.credentialCount !== null || capability.credentialNameSetSha256 !== null)
  ) {
    return { valid: false, failureCode: "V3_MEDIA_SESSION_CAPABILITY_INCONSISTENT" };
  }

  return { valid: true };
}

