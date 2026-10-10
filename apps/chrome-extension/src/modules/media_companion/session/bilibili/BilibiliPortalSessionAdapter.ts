import type { PortalSessionAdapter, PortalSessionAdapterContext } from "../PortalSessionAdapter";
import {
  PORTAL_SESSION_CAPABILITY_SCHEMA_VERSION,
  PORTAL_SESSION_CAPABILITY_TTL_MS,
  type PortalSessionCapability
} from "../contracts";
import {
  BILIBILI_ALLOWED_COOKIE_NAMES,
  BILIBILI_REQUIRED_SESSION_COOKIE_NAMES,
  BILIBILI_SESSION_POLICY_DEFINITION,
  isBilibiliCookieDomain
} from "./bilibiliCookiePolicy";

export type BilibiliBrowserCookie = {
  name: string;
  value: string;
  domain: string;
};

export interface BilibiliCookieApi {
  getAll(details: { domain: string }): Promise<BilibiliBrowserCookie[]>;
}

const allowedCookieNames = new Set<string>(BILIBILI_ALLOWED_COOKIE_NAMES);
const requiredCookieNames = new Set<string>(BILIBILI_REQUIRED_SESSION_COOKIE_NAMES);

export class BilibiliPortalSessionAdapter implements PortalSessionAdapter {
  readonly definition = BILIBILI_SESSION_POLICY_DEFINITION;
  readonly #cookieApi: BilibiliCookieApi;

  constructor(cookieApi: BilibiliCookieApi) {
    this.#cookieApi = cookieApi;
  }

  async inspectCapability(context: PortalSessionAdapterContext): Promise<PortalSessionCapability> {
    if (
      context.policy.status !== "granted"
      || context.policy.policyId !== this.definition.policyId
      || context.policy.policyRevision !== this.definition.policyRevision
      || context.policy.adapterId !== this.definition.adapterId
      || context.policy.scopeGrants.some((scope) => !scope.granted)
      || !context.permissionState.namedPermissionGranted
      || !context.permissionState.hostPermissionGranted
    ) {
      throw new Error("V3_MEDIA_SESSION_POLICY_MISMATCH");
    }

    let browserCookies: BilibiliBrowserCookie[] = [];
    try {
      browserCookies = await this.#cookieApi.getAll({ domain: ".bilibili.com" });
      const presentNames = new Set<string>();
      for (const cookie of browserCookies) {
        if (
          isBilibiliCookieDomain(cookie.domain)
          && allowedCookieNames.has(cookie.name)
          && cookie.value.length > 0
        ) {
          presentNames.add(cookie.name);
        }
      }
      const available = [...requiredCookieNames].every((name) => presentNames.has(name));
      const observedAt = context.observedAt;
      return {
        schemaVersion: PORTAL_SESSION_CAPABILITY_SCHEMA_VERSION,
        adapterId: this.definition.adapterId,
        sessionAdapterId: this.definition.sessionAdapterId,
        policyId: this.definition.policyId,
        policyRevision: this.definition.policyRevision,
        status: available ? "available" : "unavailable",
        permissionState: { ...context.permissionState },
        credentialCount: presentNames.size,
        credentialNameSetSha256: this.definition.credentialNameSetSha256,
        serverValidated: false,
        observedAt: observedAt.toISOString(),
        expiresAt: new Date(observedAt.getTime() + PORTAL_SESSION_CAPABILITY_TTL_MS).toISOString(),
        failureCode: available ? null : "V3_MEDIA_SESSION_COOKIE_MISSING"
      };
    } finally {
      browserCookies = [];
    }
  }
}

