export const PORTAL_CREDENTIAL_CHANNEL_SCHEMA_VERSION = "portal-credential-channel-record/v1" as const;
export const PORTAL_CREDENTIAL_LEASE_SCHEMA_VERSION = "portal-credential-lease/v1" as const;
export const CREDENTIAL_TRANSPORT_AUDIT_SCHEMA_VERSION = "credential-transport-audit/v1" as const;
export const PORTAL_CREDENTIAL_CHANNEL_TTL_MS = 20_000;
export const PORTAL_CREDENTIAL_LEASE_TTL_MS = 60_000;
export const PORTAL_CREDENTIAL_MAX_ENVELOPE_BYTES = 32_768;

export const MEDIA_CREDENTIAL_FAILURE_CODES = [
  "V3_MEDIA_RUNTIME_AUTH_REQUIRED",
  "V3_MEDIA_RUNTIME_ORIGIN_MISMATCH",
  "V3_MEDIA_CHANNEL_INVALID",
  "V3_MEDIA_CHANNEL_EXPIRED",
  "V3_MEDIA_CHANNEL_REPLAYED",
  "V3_MEDIA_ENVELOPE_INVALID",
  "V3_MEDIA_ENVELOPE_TOO_LARGE",
  "V3_MEDIA_ENVELOPE_EXPIRED",
  "V3_MEDIA_ENVELOPE_REPLAYED",
  "V3_MEDIA_POLICY_NOT_GRANTED",
  "V3_MEDIA_POLICY_REVISION_MISMATCH",
  "V3_MEDIA_CREDENTIAL_SET_INVALID",
  "V3_MEDIA_LEASE_TASK_MISMATCH",
  "V3_MEDIA_LEASE_EXPIRED",
  "V3_MEDIA_LEASE_REVOKED",
  "V3_MEDIA_SECRET_CLEANUP_FAILED",
  "V3_MEDIA_CREDENTIAL_TRANSPORT_FAILED"
] as const;

export type MediaCredentialFailureCode = typeof MEDIA_CREDENTIAL_FAILURE_CODES[number];
export type CredentialContractSchemaFailureCode = "SCHEMA_ADDITIONAL_PROPERTY" | "SCHEMA_CONST_MISMATCH";

export type PortalCredentialChannelStatus = "issued" | "consumed" | "expired" | "revoked" | "failed";
export type PortalCredentialLeaseState = "active" | "consumed" | "expired" | "revoked" | "failed";

export type PortalCredentialChannelRecord = {
  schemaVersion: typeof PORTAL_CREDENTIAL_CHANNEL_SCHEMA_VERSION;
  channelId: string;
  taskId: string;
  adapterId: string;
  policyId: string;
  policyRevision: number;
  browserSessionBindingSha256: string;
  extensionOriginSha256: string;
  credentialNameSetSha256: string;
  transport: "authenticated_loopback_one_shot";
  oneShot: true;
  channelTokenPersisted: false;
  issuedAt: string;
  expiresAt: string;
  status: PortalCredentialChannelStatus;
  failureCode: MediaCredentialFailureCode | null;
};

export type PortalCredentialLease = {
  schemaVersion: typeof PORTAL_CREDENTIAL_LEASE_SCHEMA_VERSION;
  leaseId: string;
  envelopeId: string;
  taskId: string;
  adapterId: string;
  policyId: string;
  policyRevision: number;
  browserSessionBindingSha256: string;
  credentialNameSetSha256: string;
  credentialCount: number;
  transportMode: "one_shot_envelope";
  secretStorage: "runtime_process_memory_only";
  serverValidationStatus: "not_performed";
  issuedAt: string;
  expiresAt: string;
  state: PortalCredentialLeaseState;
  failureCode: MediaCredentialFailureCode | null;
};

export type CredentialTransportAuditRecord = {
  schemaVersion: typeof CREDENTIAL_TRANSPORT_AUDIT_SCHEMA_VERSION;
  requestBodyBytes: number;
  requestAttemptCount: 1;
  requestBodyLogged: false;
  eventStorePayloadWritten: false;
  traceArgumentWritten: false;
  exceptionBodyWritten: false;
  retryBodyPersisted: false;
  rawCredentialValueHashed: false;
  persistentSecretHitCount: 0;
  publicSecretHitCount: 0;
  genericRuntimeProxyDenied: true;
  contentScriptDenied: true;
  exactOriginBound: true;
  replayRejected: true;
  expiredChannelRejected: true;
  runtimeRestartClearedLeases: true;
  revocationClearedLease: true;
};

export type CredentialTransportContractSet = {
  channel: PortalCredentialChannelRecord;
  lease: PortalCredentialLease;
  transportAudit: CredentialTransportAuditRecord;
};

export type CredentialTransportShapeValidation =
  | { valid: true; value: CredentialTransportContractSet }
  | { valid: false; failureCode: CredentialContractSchemaFailureCode };

export type CredentialTransportSemanticValidation =
  | { valid: true }
  | { valid: false; failureCode: MediaCredentialFailureCode };
