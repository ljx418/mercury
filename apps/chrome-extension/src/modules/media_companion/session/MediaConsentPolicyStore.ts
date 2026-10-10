import type { PortalSessionRegistry } from "./PortalSessionRegistry";
import {
  MEDIA_CONSENT_POLICY_SCHEMA_VERSION,
  createDefaultConsentPolicy,
  type MediaConsentPolicyReader,
  type MediaConsentPolicyRecord,
  type MediaConsentPolicyStatus,
  type PortalSessionPolicyDefinition
} from "./contracts";

export interface MediaConsentPolicyStorage {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
}

export type MediaConsentPolicyStoreDependencies = {
  registry: PortalSessionRegistry;
  storage: MediaConsentPolicyStorage;
  now?: () => Date;
};

const STORAGE_KEY_PREFIX = "navia.mediaConsentPolicy.";

function storageKey(adapterId: string): string {
  return `${STORAGE_KEY_PREFIX}${adapterId}`;
}

function projectPolicy(value: unknown, definition: PortalSessionPolicyDefinition): MediaConsentPolicyRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (
    record.schemaVersion !== MEDIA_CONSENT_POLICY_SCHEMA_VERSION
    || record.policyId !== definition.policyId
    || record.adapterId !== definition.adapterId
    || record.policyRevision !== definition.policyRevision
    || !["not_granted", "granted", "denied", "revoked"].includes(String(record.status))
    || !Array.isArray(record.scopeGrants)
  ) return null;

  const grants = record.scopeGrants.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const grant = item as Record<string, unknown>;
    if (typeof grant.scopeId !== "string" || typeof grant.granted !== "boolean") return null;
    return { scopeId: grant.scopeId, granted: grant.granted };
  });
  if (grants.some((grant) => grant === null)) return null;
  const scopeIds = grants.map((grant) => grant!.scopeId);
  const scopeSet = new Set(scopeIds);
  if (
    scopeIds.length !== definition.consentScopeIds.length
    || scopeSet.size !== scopeIds.length
    || !definition.consentScopeIds.every((scopeId) => scopeSet.has(scopeId))
  ) return null;

  const decidedAt = record.decidedAt;
  const revokedAt = record.revokedAt;
  if (!(decidedAt === null || typeof decidedAt === "string")) return null;
  if (!(revokedAt === null || typeof revokedAt === "string")) return null;

  return {
    schemaVersion: MEDIA_CONSENT_POLICY_SCHEMA_VERSION,
    policyId: definition.policyId,
    adapterId: definition.adapterId,
    policyRevision: definition.policyRevision,
    status: record.status as MediaConsentPolicyStatus,
    scopeGrants: grants.map((grant) => ({ ...grant! })),
    decidedAt,
    revokedAt
  };
}

export class MediaConsentPolicyStore implements MediaConsentPolicyReader {
  readonly #dependencies: MediaConsentPolicyStoreDependencies;

  constructor(dependencies: MediaConsentPolicyStoreDependencies) {
    this.#dependencies = dependencies;
  }

  async getPolicy(adapterId: string): Promise<MediaConsentPolicyRecord | null> {
    const adapter = this.#dependencies.registry.resolve(adapterId);
    if (!adapter) return null;
    const key = storageKey(adapterId);
    const stored = await this.#dependencies.storage.get(key);
    return projectPolicy(stored[key], adapter.definition) ?? createDefaultConsentPolicy(adapter.definition);
  }

  async recordGrant(adapterId: string): Promise<MediaConsentPolicyRecord> {
    return this.#recordDecision(adapterId, "granted");
  }

  async recordDenial(adapterId: string): Promise<MediaConsentPolicyRecord> {
    return this.#recordDecision(adapterId, "denied");
  }

  async revokePolicy(adapterId: string): Promise<MediaConsentPolicyRecord> {
    return this.#recordDecision(adapterId, "revoked");
  }

  async #recordDecision(adapterId: string, status: Exclude<MediaConsentPolicyStatus, "not_granted">) {
    const adapter = this.#dependencies.registry.resolve(adapterId);
    if (!adapter) throw new Error("V3_MEDIA_SESSION_ADAPTER_UNSUPPORTED");
    const now = (this.#dependencies.now?.() ?? new Date()).toISOString();
    const policy: MediaConsentPolicyRecord = {
      schemaVersion: MEDIA_CONSENT_POLICY_SCHEMA_VERSION,
      policyId: adapter.definition.policyId,
      adapterId: adapter.definition.adapterId,
      policyRevision: adapter.definition.policyRevision,
      status,
      scopeGrants: adapter.definition.consentScopeIds.map((scopeId) => ({
        scopeId,
        granted: status === "granted"
      })),
      decidedAt: now,
      revokedAt: status === "revoked" ? now : null
    };
    await this.#dependencies.storage.set({ [storageKey(adapterId)]: policy });
    return structuredClone(policy);
  }
}

