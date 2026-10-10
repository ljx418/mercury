import type { PortalSessionRegistry } from "./PortalSessionRegistry";
import {
  createClosedCapability,
  createDefaultConsentPolicy,
  type MediaConsentPolicyReader,
  type PortalPermissionReader,
  type PortalSessionBrokerResult,
  type PortalSessionInspectionRequest
} from "./contracts";
import { validateMediaSessionContracts } from "./validateMediaSessionContracts";

export type PortalSessionBrokerDependencies = {
  registry: PortalSessionRegistry;
  policyReader: MediaConsentPolicyReader;
  permissionReader: PortalPermissionReader;
  now?: () => Date;
};

export class PortalSessionBroker {
  readonly #dependencies: PortalSessionBrokerDependencies;

  constructor(dependencies: PortalSessionBrokerDependencies) {
    this.#dependencies = dependencies;
  }

  async inspectCapability(request: PortalSessionInspectionRequest): Promise<PortalSessionBrokerResult> {
    const adapter = this.#dependencies.registry.resolve(request.adapterId);
    if (!adapter) {
      return { ok: false, failureCode: "V3_MEDIA_SESSION_ADAPTER_UNSUPPORTED" };
    }

    const { definition } = adapter;
    const now = this.#dependencies.now?.() ?? new Date();
    const persistedPolicy = await this.#dependencies.policyReader.getPolicy(request.adapterId);
    const policy = persistedPolicy ?? createDefaultConsentPolicy(definition);

    if (
      request.policyRevision !== definition.policyRevision
      || policy.policyRevision !== definition.policyRevision
      || policy.policyId !== definition.policyId
      || policy.adapterId !== definition.adapterId
    ) {
      return {
        ok: true,
        capability: createClosedCapability({
          definition,
          status: "unknown",
          failureCode: "V3_MEDIA_SESSION_POLICY_MISMATCH",
          now
        })
      };
    }

    if (policy.status === "denied") {
      return {
        ok: true,
        capability: createClosedCapability({
          definition,
          status: "permission_denied",
          failureCode: "V3_MEDIA_SESSION_PERMISSION_DENIED",
          now
        })
      };
    }
    if (policy.status === "revoked") {
      return {
        ok: true,
        capability: createClosedCapability({
          definition,
          status: "revoked",
          failureCode: "V3_MEDIA_SESSION_REVOKED",
          now
        })
      };
    }
    if (policy.status !== "granted") {
      return {
        ok: true,
        capability: createClosedCapability({
          definition,
          status: "permission_required",
          failureCode: "V3_MEDIA_SESSION_PERMISSION_REQUIRED",
          now
        })
      };
    }

    const scopeIds = policy.scopeGrants.map((scope) => scope.scopeId);
    const scopeSet = new Set(scopeIds);
    const exactScopeSet = scopeIds.length === definition.consentScopeIds.length
      && scopeSet.size === scopeIds.length
      && definition.consentScopeIds.every((scopeId) => scopeSet.has(scopeId));
    if (!exactScopeSet || policy.scopeGrants.some((scope) => !scope.granted)) {
      return {
        ok: true,
        capability: createClosedCapability({
          definition,
          status: "permission_required",
          failureCode: exactScopeSet
            ? "V3_MEDIA_SESSION_SCOPE_NOT_GRANTED"
            : "V3_MEDIA_SESSION_SCOPE_SET_INVALID",
          now
        })
      };
    }

    let permissionState;
    try {
      permissionState = await this.#dependencies.permissionReader.contains(definition.permissionDescriptor);
    } catch {
      return {
        ok: true,
        capability: createClosedCapability({
          definition,
          status: "unknown",
          failureCode: "V3_MEDIA_SESSION_READ_FAILED",
          now
        })
      };
    }
    if (!permissionState.namedPermissionGranted || !permissionState.hostPermissionGranted) {
      return {
        ok: true,
        capability: createClosedCapability({
          definition,
          status: "revoked",
          failureCode: "V3_MEDIA_SESSION_REVOKED",
          permissionState,
          now
        })
      };
    }

    try {
      const capability = await adapter.inspectCapability({ policy, permissionState, observedAt: now });
      const validation = validateMediaSessionContracts({ policy, capability }, definition);
      if (!validation.valid) {
        return {
          ok: true,
          capability: createClosedCapability({
            definition,
            status: "unknown",
            failureCode: validation.failureCode,
            permissionState,
            now
          })
        };
      }
      return { ok: true, capability };
    } catch {
      return {
        ok: true,
        capability: createClosedCapability({
          definition,
          status: "unknown",
          failureCode: "V3_MEDIA_SESSION_READ_FAILED",
          permissionState,
          now
        })
      };
    }
  }
}

