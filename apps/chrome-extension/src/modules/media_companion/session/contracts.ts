export const MEDIA_CONSENT_POLICY_SCHEMA_VERSION = "media-consent-policy/v1" as const;
export const PORTAL_SESSION_CAPABILITY_SCHEMA_VERSION = "portal-session-capability/v1" as const;
export const PORTAL_SESSION_CAPABILITY_TTL_MS = 30_000;

export type MediaConsentPolicyStatus = "not_granted" | "granted" | "denied" | "revoked";
export type PortalSessionCapabilityStatus =
  | "permission_required"
  | "permission_denied"
  | "unavailable"
  | "available"
  | "revoked"
  | "unknown";

export type MediaSessionFailureCode =
  | "V3_MEDIA_SESSION_ADAPTER_UNSUPPORTED"
  | "V3_MEDIA_SESSION_PERMISSION_REQUIRED"
  | "V3_MEDIA_SESSION_PERMISSION_DENIED"
  | "V3_MEDIA_SESSION_SCOPE_NOT_GRANTED"
  | "V3_MEDIA_SESSION_COOKIE_MISSING"
  | "V3_MEDIA_SESSION_REVOKED"
  | "V3_MEDIA_SESSION_READ_FAILED"
  | "V3_MEDIA_SESSION_POLICY_MISMATCH"
  | "V3_MEDIA_SESSION_SCOPE_SET_INVALID"
  | "V3_MEDIA_SESSION_CAPABILITY_INCONSISTENT"
  | "V3_MEDIA_SESSION_NAME_SET_INVALID"
  | "V3_MEDIA_SESSION_OBSERVATION_EXPIRED"
  | "V3_MEDIA_SESSION_ADAPTER_MISMATCH";

export type ScopeGrant = {
  scopeId: string;
  granted: boolean;
};

export type MediaConsentPolicyRecord = {
  schemaVersion: typeof MEDIA_CONSENT_POLICY_SCHEMA_VERSION;
  policyId: string;
  adapterId: string;
  policyRevision: number;
  status: MediaConsentPolicyStatus;
  scopeGrants: ScopeGrant[];
  decidedAt: string | null;
  revokedAt: string | null;
};

export type PortalPermissionState = {
  namedPermissionGranted: boolean;
  hostPermissionGranted: boolean;
};

export type PortalPermissionDescriptor = {
  permissions: readonly chrome.runtime.ManifestPermission[];
  origins: readonly string[];
};

export type PortalSessionPolicyDefinition = {
  adapterId: string;
  sessionAdapterId: string;
  policyId: string;
  policyRevision: number;
  permissionDescriptor: PortalPermissionDescriptor;
  consentScopeIds: readonly string[];
  credentialNameSetSha256: string;
};

export type PortalSessionCapability = {
  schemaVersion: typeof PORTAL_SESSION_CAPABILITY_SCHEMA_VERSION;
  adapterId: string;
  sessionAdapterId: string;
  policyId: string;
  policyRevision: number;
  status: PortalSessionCapabilityStatus;
  permissionState: PortalPermissionState;
  credentialCount: number | null;
  credentialNameSetSha256: string | null;
  serverValidated: false;
  observedAt: string;
  expiresAt: string;
  failureCode: MediaSessionFailureCode | null;
};

export type PortalSessionInspectionRequest = {
  adapterId: string;
  policyRevision: number;
};

export type PortalSessionBrokerResult =
  | { ok: true; capability: PortalSessionCapability }
  | { ok: false; failureCode: "V3_MEDIA_SESSION_ADAPTER_UNSUPPORTED" };

export interface MediaConsentPolicyReader {
  getPolicy(adapterId: string): Promise<MediaConsentPolicyRecord | null>;
}

export interface PortalPermissionReader {
  contains(descriptor: PortalPermissionDescriptor): Promise<PortalPermissionState>;
}

export type MediaSessionContractPair = {
  policy: MediaConsentPolicyRecord;
  capability: PortalSessionCapability;
};

export type MediaSessionSemanticValidation =
  | { valid: true }
  | { valid: false; failureCode: MediaSessionFailureCode };

export function createDefaultConsentPolicy(definition: PortalSessionPolicyDefinition): MediaConsentPolicyRecord {
  return {
    schemaVersion: MEDIA_CONSENT_POLICY_SCHEMA_VERSION,
    policyId: definition.policyId,
    adapterId: definition.adapterId,
    policyRevision: definition.policyRevision,
    status: "not_granted",
    scopeGrants: definition.consentScopeIds.map((scopeId) => ({ scopeId, granted: false })),
    decidedAt: null,
    revokedAt: null
  };
}

export function createClosedCapability(input: {
  definition: PortalSessionPolicyDefinition;
  status: PortalSessionCapabilityStatus;
  failureCode: MediaSessionFailureCode;
  permissionState?: PortalPermissionState;
  now: Date;
}): PortalSessionCapability {
  return {
    schemaVersion: PORTAL_SESSION_CAPABILITY_SCHEMA_VERSION,
    adapterId: input.definition.adapterId,
    sessionAdapterId: input.definition.sessionAdapterId,
    policyId: input.definition.policyId,
    policyRevision: input.definition.policyRevision,
    status: input.status,
    permissionState: input.permissionState ?? {
      namedPermissionGranted: false,
      hostPermissionGranted: false
    },
    credentialCount: null,
    credentialNameSetSha256: null,
    serverValidated: false,
    observedAt: input.now.toISOString(),
    expiresAt: new Date(input.now.getTime() + PORTAL_SESSION_CAPABILITY_TTL_MS).toISOString(),
    failureCode: input.failureCode
  };
}
