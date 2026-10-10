import {
  CREDENTIAL_TRANSPORT_AUDIT_SCHEMA_VERSION,
  MEDIA_CREDENTIAL_FAILURE_CODES,
  PORTAL_CREDENTIAL_CHANNEL_SCHEMA_VERSION,
  PORTAL_CREDENTIAL_CHANNEL_TTL_MS,
  PORTAL_CREDENTIAL_LEASE_SCHEMA_VERSION,
  PORTAL_CREDENTIAL_LEASE_TTL_MS,
  PORTAL_CREDENTIAL_MAX_ENVELOPE_BYTES,
  type CredentialTransportContractSet,
  type CredentialTransportSemanticValidation,
  type CredentialTransportShapeValidation,
  type MediaCredentialFailureCode,
  type PortalCredentialChannelRecord,
  type PortalCredentialLease
} from "./contracts";

const sha256Pattern = /^[a-f0-9]{64}$/;
const channelIdPattern = /^pch_[a-f0-9]{32}$/;
const leaseIdPattern = /^pcl_[a-f0-9]{32}$/;
const envelopeIdPattern = /^pce_[a-f0-9]{32}$/;
const taskIdPattern = /^media_task_[a-f0-9]{32}$/;
const adapterIdPattern = /^[a-z][a-z0-9_-]{1,31}$/;
const policyIdPattern = /^[a-z0-9_-]+-media-consent\/v[1-9][0-9]*$/;
const failureCodes = new Set<string>(MEDIA_CREDENTIAL_FAILURE_CODES);

const channelKeys = [
  "schemaVersion", "channelId", "taskId", "adapterId", "policyId", "policyRevision",
  "browserSessionBindingSha256", "extensionOriginSha256", "credentialNameSetSha256", "transport",
  "oneShot", "channelTokenPersisted", "issuedAt", "expiresAt", "status", "failureCode"
] as const;
const leaseKeys = [
  "schemaVersion", "leaseId", "envelopeId", "taskId", "adapterId", "policyId", "policyRevision",
  "browserSessionBindingSha256", "credentialNameSetSha256", "credentialCount", "transportMode",
  "secretStorage", "serverValidationStatus", "issuedAt", "expiresAt", "state", "failureCode"
] as const;
const auditKeys = [
  "schemaVersion", "requestBodyBytes", "requestAttemptCount", "requestBodyLogged", "eventStorePayloadWritten",
  "traceArgumentWritten", "exceptionBodyWritten", "retryBodyPersisted", "rawCredentialValueHashed",
  "persistentSecretHitCount", "publicSecretHitCount", "genericRuntimeProxyDenied", "contentScriptDenied",
  "exactOriginBound", "replayRejected", "expiredChannelRejected", "runtimeRestartClearedLeases",
  "revocationClearedLease"
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value);
  return actual.length === keys.length && actual.every((key) => keys.includes(key));
}

function isDateTime(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function isFailureCode(value: unknown): value is MediaCredentialFailureCode | null {
  return value === null || (typeof value === "string" && failureCodes.has(value));
}

function channelShape(value: Record<string, unknown>): boolean {
  return value.schemaVersion === PORTAL_CREDENTIAL_CHANNEL_SCHEMA_VERSION
    && typeof value.channelId === "string" && channelIdPattern.test(value.channelId)
    && typeof value.taskId === "string" && taskIdPattern.test(value.taskId)
    && typeof value.adapterId === "string" && adapterIdPattern.test(value.adapterId)
    && typeof value.policyId === "string" && policyIdPattern.test(value.policyId)
    && Number.isInteger(value.policyRevision) && Number(value.policyRevision) >= 1
    && typeof value.browserSessionBindingSha256 === "string" && sha256Pattern.test(value.browserSessionBindingSha256)
    && typeof value.extensionOriginSha256 === "string" && sha256Pattern.test(value.extensionOriginSha256)
    && typeof value.credentialNameSetSha256 === "string" && sha256Pattern.test(value.credentialNameSetSha256)
    && value.transport === "authenticated_loopback_one_shot"
    && value.oneShot === true
    && value.channelTokenPersisted === false
    && isDateTime(value.issuedAt) && isDateTime(value.expiresAt)
    && ["issued", "consumed", "expired", "revoked", "failed"].includes(String(value.status))
    && isFailureCode(value.failureCode);
}

export function isPortalCredentialChannelRecord(value: unknown): value is PortalCredentialChannelRecord {
  return isRecord(value) && hasExactKeys(value, channelKeys) && channelShape(value);
}

function leaseShape(value: Record<string, unknown>): boolean {
  return value.schemaVersion === PORTAL_CREDENTIAL_LEASE_SCHEMA_VERSION
    && typeof value.leaseId === "string" && leaseIdPattern.test(value.leaseId)
    && typeof value.envelopeId === "string" && envelopeIdPattern.test(value.envelopeId)
    && typeof value.taskId === "string" && taskIdPattern.test(value.taskId)
    && typeof value.adapterId === "string" && adapterIdPattern.test(value.adapterId)
    && typeof value.policyId === "string" && policyIdPattern.test(value.policyId)
    && Number.isInteger(value.policyRevision) && Number(value.policyRevision) >= 1
    && typeof value.browserSessionBindingSha256 === "string" && sha256Pattern.test(value.browserSessionBindingSha256)
    && typeof value.credentialNameSetSha256 === "string" && sha256Pattern.test(value.credentialNameSetSha256)
    && Number.isInteger(value.credentialCount) && Number(value.credentialCount) >= 1 && Number(value.credentialCount) <= 9
    && value.transportMode === "one_shot_envelope"
    && value.secretStorage === "runtime_process_memory_only"
    && value.serverValidationStatus === "not_performed"
    && isDateTime(value.issuedAt) && isDateTime(value.expiresAt)
    && ["active", "consumed", "expired", "revoked", "failed"].includes(String(value.state))
    && isFailureCode(value.failureCode);
}

export function isPortalCredentialLease(value: unknown): value is PortalCredentialLease {
  return isRecord(value) && hasExactKeys(value, leaseKeys) && leaseShape(value);
}

function auditShape(value: Record<string, unknown>): boolean {
  return value.schemaVersion === CREDENTIAL_TRANSPORT_AUDIT_SCHEMA_VERSION
    && Number.isInteger(value.requestBodyBytes) && Number(value.requestBodyBytes) >= 1
    && Number(value.requestBodyBytes) <= PORTAL_CREDENTIAL_MAX_ENVELOPE_BYTES
    && value.requestAttemptCount === 1
    && value.requestBodyLogged === false
    && value.eventStorePayloadWritten === false
    && value.traceArgumentWritten === false
    && value.exceptionBodyWritten === false
    && value.retryBodyPersisted === false
    && value.rawCredentialValueHashed === false
    && value.persistentSecretHitCount === 0
    && value.publicSecretHitCount === 0
    && value.genericRuntimeProxyDenied === true
    && value.contentScriptDenied === true
    && value.exactOriginBound === true
    && value.replayRejected === true
    && value.expiredChannelRejected === true
    && value.runtimeRestartClearedLeases === true
    && value.revocationClearedLease === true;
}

export function validateCredentialTransportShape(input: unknown): CredentialTransportShapeValidation {
  if (!isRecord(input) || !hasExactKeys(input, ["channel", "lease", "transportAudit"])) {
    return { valid: false, failureCode: "SCHEMA_ADDITIONAL_PROPERTY" };
  }
  if (!isRecord(input.channel) || !isRecord(input.lease) || !isRecord(input.transportAudit)) {
    return { valid: false, failureCode: "SCHEMA_CONST_MISMATCH" };
  }
  if (
    !hasExactKeys(input.channel, channelKeys)
    || !hasExactKeys(input.lease, leaseKeys)
    || !hasExactKeys(input.transportAudit, auditKeys)
  ) {
    return { valid: false, failureCode: "SCHEMA_ADDITIONAL_PROPERTY" };
  }
  if (!channelShape(input.channel) || !leaseShape(input.lease) || !auditShape(input.transportAudit)) {
    return { valid: false, failureCode: "SCHEMA_CONST_MISMATCH" };
  }
  return { valid: true, value: input as CredentialTransportContractSet };
}

export function validateCredentialTransportSemantics(
  contracts: CredentialTransportContractSet,
  expectedCredentialNameSetSha256: string
): CredentialTransportSemanticValidation {
  const { channel, lease } = contracts;
  if (channel.taskId !== lease.taskId) return { valid: false, failureCode: "V3_MEDIA_LEASE_TASK_MISMATCH" };
  if (channel.adapterId !== lease.adapterId) return { valid: false, failureCode: "V3_MEDIA_ENVELOPE_INVALID" };
  if (channel.policyId !== lease.policyId) return { valid: false, failureCode: "V3_MEDIA_POLICY_NOT_GRANTED" };
  if (channel.policyRevision !== lease.policyRevision) {
    return { valid: false, failureCode: "V3_MEDIA_POLICY_REVISION_MISMATCH" };
  }
  if (channel.browserSessionBindingSha256 !== lease.browserSessionBindingSha256) {
    return { valid: false, failureCode: "V3_MEDIA_CHANNEL_INVALID" };
  }
  if (channel.credentialNameSetSha256 !== lease.credentialNameSetSha256) {
    return { valid: false, failureCode: "V3_MEDIA_CREDENTIAL_SET_INVALID" };
  }

  const channelIssuedAt = Date.parse(channel.issuedAt);
  const channelExpiresAt = Date.parse(channel.expiresAt);
  const leaseIssuedAt = Date.parse(lease.issuedAt);
  const leaseExpiresAt = Date.parse(lease.expiresAt);
  if (channelExpiresAt <= channelIssuedAt || channelExpiresAt - channelIssuedAt > PORTAL_CREDENTIAL_CHANNEL_TTL_MS) {
    return { valid: false, failureCode: "V3_MEDIA_CHANNEL_EXPIRED" };
  }
  if (leaseIssuedAt < channelIssuedAt) return { valid: false, failureCode: "V3_MEDIA_CHANNEL_INVALID" };
  if (leaseIssuedAt > channelExpiresAt) return { valid: false, failureCode: "V3_MEDIA_CHANNEL_EXPIRED" };
  if (leaseExpiresAt <= leaseIssuedAt || leaseExpiresAt - leaseIssuedAt > PORTAL_CREDENTIAL_LEASE_TTL_MS) {
    return { valid: false, failureCode: "V3_MEDIA_LEASE_EXPIRED" };
  }
  if (channel.status !== "consumed" || channel.failureCode !== null) {
    return { valid: false, failureCode: "V3_MEDIA_CHANNEL_INVALID" };
  }
  if (lease.state === "active" && lease.failureCode !== null) {
    return { valid: false, failureCode: "V3_MEDIA_CREDENTIAL_TRANSPORT_FAILED" };
  }
  if (
    channel.credentialNameSetSha256 !== expectedCredentialNameSetSha256
    || lease.credentialNameSetSha256 !== expectedCredentialNameSetSha256
  ) {
    return { valid: false, failureCode: "V3_MEDIA_CREDENTIAL_SET_INVALID" };
  }
  return { valid: true };
}

export function validateCredentialTransportContracts(
  input: unknown,
  expectedCredentialNameSetSha256: string
): CredentialTransportShapeValidation | CredentialTransportSemanticValidation {
  const shape = validateCredentialTransportShape(input);
  if (!shape.valid) return shape;
  return validateCredentialTransportSemantics(shape.value, expectedCredentialNameSetSha256);
}
