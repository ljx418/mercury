import type { MediaConsentPolicyReader, PortalPermissionReader } from "../../contracts";
import {
  BILIBILI_ALLOWED_COOKIE_NAMES,
  BILIBILI_COOKIE_NAME_SET_SHA256,
  BILIBILI_REQUIRED_SESSION_COOKIE_NAMES,
  BILIBILI_SESSION_POLICY_DEFINITION,
  isBilibiliCookieDomain
} from "../../bilibili/bilibiliCookiePolicy";
import {
  PORTAL_CREDENTIAL_MAX_ENVELOPE_BYTES,
  type PortalCredentialLease
} from "../contracts";
import type { PortalCredentialMessage, PortalCredentialMessageResponse } from "../PortalCredentialMessageClient";
import { isPortalCredentialLease } from "../validateCredentialTransportContracts";

export type BrowserCredentialCookie = {
  name: string;
  value: string;
  domain: string;
  path: string;
  secure: boolean;
  httpOnly: boolean;
  sameSite: "no_restriction" | "lax" | "strict" | "unspecified";
  expirationDate?: number;
};

export interface BrowserCredentialCookieApi {
  getAll(details: { domain: string }): Promise<BrowserCredentialCookie[]>;
}

type ExchangeMessage = Extract<PortalCredentialMessage, { command: "exchange_channel" }>;
type RuntimeLeaseResponse = {
  ok?: boolean;
  data?: { lease?: unknown; revocationToken?: unknown } | null;
  error?: { code?: unknown };
};

export class BilibiliCredentialEnvelopeBroker {
  readonly #policyReader: MediaConsentPolicyReader;
  readonly #permissionReader: PortalPermissionReader;
  readonly #cookieApi: BrowserCredentialCookieApi;
  readonly #fetch: typeof fetch;
  readonly #now: () => Date;
  readonly #onUnexpectedFailure?: (diagnostic: { stage: string; errorName: string; elapsedMs?: number; channelRemainingMs?: number }) => void;
  readonly #revocationTokens = new Map<string, string>();
  #revocationAttemptCount = 0;
  #revocationSucceededCount = 0;
  #revocationFailedCount = 0;

  constructor(dependencies: {
    policyReader: MediaConsentPolicyReader;
    permissionReader: PortalPermissionReader;
    cookieApi: BrowserCredentialCookieApi;
    fetch?: typeof fetch;
    now?: () => Date;
    onUnexpectedFailure?: (diagnostic: { stage: string; errorName: string; elapsedMs?: number; channelRemainingMs?: number }) => void;
  }) {
    this.#policyReader = dependencies.policyReader;
    this.#permissionReader = dependencies.permissionReader;
    this.#cookieApi = dependencies.cookieApi;
    this.#fetch = dependencies.fetch ?? globalThis.fetch.bind(globalThis);
    this.#now = dependencies.now ?? (() => new Date());
    this.#onUnexpectedFailure = dependencies.onUnexpectedFailure;
  }

  async exchange(message: ExchangeMessage): Promise<PortalCredentialMessageResponse<PortalCredentialLease>> {
    let credentials: Array<Record<string, unknown>> = [];
    let requestBody = "";
    let stage = "channel_validation";
    try {
      const definition = BILIBILI_SESSION_POLICY_DEFINITION;
      const { channel } = message;
      if (
        channel.status !== "issued"
        || channel.failureCode !== null
        || channel.adapterId !== definition.adapterId
        || channel.policyId !== definition.policyId
      ) return { ok: false, failureCode: "V3_MEDIA_CHANNEL_INVALID" };
      if (channel.policyRevision !== definition.policyRevision) {
        return { ok: false, failureCode: "V3_MEDIA_POLICY_REVISION_MISMATCH" };
      }
      if (channel.credentialNameSetSha256 !== BILIBILI_COOKIE_NAME_SET_SHA256) {
        return { ok: false, failureCode: "V3_MEDIA_CREDENTIAL_SET_INVALID" };
      }
      const channelIssuedAt = Date.parse(channel.issuedAt);
      const channelExpiresAt = Date.parse(channel.expiresAt);
      if (
        !Number.isFinite(channelIssuedAt)
        || !Number.isFinite(channelExpiresAt)
        || channelIssuedAt >= channelExpiresAt
      ) return { ok: false, failureCode: "V3_MEDIA_CHANNEL_INVALID" };

      stage = "policy_read";
      const policy = await this.#policyReader.getPolicy(definition.adapterId);
      if (
        !policy
        || policy.status !== "granted"
        || policy.policyId !== definition.policyId
        || policy.adapterId !== definition.adapterId
        || policy.scopeGrants.length !== definition.consentScopeIds.length
        || policy.scopeGrants.some((scope) => !scope.granted || !definition.consentScopeIds.includes(scope.scopeId))
      ) return { ok: false, failureCode: "V3_MEDIA_POLICY_NOT_GRANTED" };
      if (policy.policyRevision !== definition.policyRevision) {
        return { ok: false, failureCode: "V3_MEDIA_POLICY_REVISION_MISMATCH" };
      }

      stage = "permission_read";
      const permission = await this.#permissionReader.contains(definition.permissionDescriptor);
      if (!permission.namedPermissionGranted || !permission.hostPermissionGranted) {
        return { ok: false, failureCode: "V3_MEDIA_POLICY_NOT_GRANTED" };
      }

      stage = "cookie_read";
      let cookies = await this.#cookieApi.getAll({ domain: ".bilibili.com" });
      const byName = new Map<string, BrowserCredentialCookie>();
      for (const cookie of cookies) {
        if (
          BILIBILI_ALLOWED_COOKIE_NAMES.includes(cookie.name as typeof BILIBILI_ALLOWED_COOKIE_NAMES[number])
          && cookie.value.length > 0
          && isBilibiliCookieDomain(cookie.domain)
          && !byName.has(cookie.name)
        ) byName.set(cookie.name, cookie);
      }
      cookies = [];
      if (BILIBILI_REQUIRED_SESSION_COOKIE_NAMES.some((name) => !byName.has(name))) {
        byName.clear();
        return { ok: false, failureCode: "V3_MEDIA_CREDENTIAL_SET_INVALID" };
      }
      credentials = BILIBILI_ALLOWED_COOKIE_NAMES.flatMap((name) => {
        const cookie = byName.get(name);
        if (!cookie) return [];
        return [{
          name: cookie.name,
          value: cookie.value,
          domain: cookie.domain,
          path: cookie.path,
          secure: cookie.secure,
          httpOnly: cookie.httpOnly,
          sameSite: cookie.sameSite,
          expirationDate: Number.isFinite(cookie.expirationDate) ? cookie.expirationDate : null
        }];
      });
      byName.clear();

      stage = "envelope_build";
      const now = this.#now();
      if (now.getTime() >= channelExpiresAt) {
        return { ok: false, failureCode: "V3_MEDIA_CHANNEL_EXPIRED" };
      }
      // Runtime and browser are separate processes. Anchor the envelope to the
      // later clock so harmless sub-second skew cannot predate channel issue.
      const envelopeIssuedAt = Math.max(now.getTime(), channelIssuedAt);
      const envelope = {
        schemaVersion: "BilibiliCredentialEnvelope/v1",
        envelopeId: `pce_${crypto.randomUUID().replace(/-/g, "")}`,
        channelId: channel.channelId,
        taskId: channel.taskId,
        adapterId: channel.adapterId,
        sessionAdapterId: definition.sessionAdapterId,
        policyId: channel.policyId,
        policyRevision: channel.policyRevision,
        browserSessionBindingSha256: channel.browserSessionBindingSha256,
        credentialNameSetSha256: channel.credentialNameSetSha256,
        issuedAt: new Date(envelopeIssuedAt).toISOString(),
        expiresAt: new Date(Math.min(channelExpiresAt, envelopeIssuedAt + 15_000)).toISOString(),
        credentials
      };
      requestBody = JSON.stringify(envelope);
      if (new TextEncoder().encode(requestBody).byteLength > PORTAL_CREDENTIAL_MAX_ENVELOPE_BYTES) {
        return { ok: false, failureCode: "V3_MEDIA_ENVELOPE_TOO_LARGE" };
      }

      let response: Response;
      const fetchStartedAt = this.#now().getTime();
      const channelRemainingMs = channelExpiresAt - fetchStartedAt;
      try {
        stage = "lease_fetch";
        response = await this.#fetch("http://127.0.0.1:17861/v1/media/credential-leases", {
          method: "POST",
          headers: {
            "Authorization": `Navia-Media-Channel ${message.channelToken}`,
            "Content-Type": "application/json"
          },
          body: requestBody,
          cache: "no-store",
          credentials: "omit",
          redirect: "error",
          referrerPolicy: "no-referrer"
        });
      } catch (error) {
        this.#recordUnexpectedFailure(stage, error);
        return { ok: false, failureCode: "V3_MEDIA_CREDENTIAL_TRANSPORT_FAILED" };
      }
      let body: RuntimeLeaseResponse;
      try {
        stage = "lease_response_parse";
        body = JSON.parse(await response.text()) as RuntimeLeaseResponse;
      } catch (error) {
        this.#recordUnexpectedFailure(stage, error);
        return { ok: false, failureCode: "V3_MEDIA_CREDENTIAL_TRANSPORT_FAILED" };
      }
      if (!response.ok || body.ok !== true || !body.data) {
        this.#onUnexpectedFailure?.({
          stage: "lease_response_rejected",
          errorName: typeof body.error?.code === "string" ? body.error.code : `HTTP_${response.status}`,
          elapsedMs: Math.max(0, this.#now().getTime() - fetchStartedAt),
          channelRemainingMs
        });
        return {
          ok: false,
          failureCode: typeof body.error?.code === "string"
            ? body.error.code
            : "V3_MEDIA_CREDENTIAL_TRANSPORT_FAILED"
        };
      }
      if (!isPortalCredentialLease(body.data.lease) || typeof body.data.revocationToken !== "string") {
        return { ok: false, failureCode: "V3_MEDIA_CREDENTIAL_TRANSPORT_FAILED" };
      }
      this.#revocationTokens.set(body.data.lease.leaseId, body.data.revocationToken);
      return { ok: true, value: body.data.lease };
    } catch (error) {
      this.#recordUnexpectedFailure(stage, error);
      return { ok: false, failureCode: "V3_MEDIA_CREDENTIAL_TRANSPORT_FAILED" };
    } finally {
      credentials = [];
      requestBody = "";
    }
  }

  #recordUnexpectedFailure(stage: string, error: unknown): void {
    this.#onUnexpectedFailure?.({
      stage,
      errorName: error instanceof Error && error.name ? error.name : "UnknownError"
    });
  }

  revocationHandleCount(): number {
    return this.#revocationTokens.size;
  }

  revocationDiagnostics(): {
    handleCount: number;
    attemptCount: number;
    succeededCount: number;
    failedCount: number;
  } {
    return {
      handleCount: this.#revocationTokens.size,
      attemptCount: this.#revocationAttemptCount,
      succeededCount: this.#revocationSucceededCount,
      failedCount: this.#revocationFailedCount
    };
  }

  isRelevantCookieChange(cookie: Pick<BrowserCredentialCookie, "name" | "domain">): boolean {
    return BILIBILI_ALLOWED_COOKIE_NAMES.includes(cookie.name as typeof BILIBILI_ALLOWED_COOKIE_NAMES[number])
      && isBilibiliCookieDomain(cookie.domain);
  }

  isRelevantPermissionRemoval(permissions: {
    permissions?: chrome.runtime.ManifestPermission[];
    origins?: string[];
  }): boolean {
    return permissions.permissions?.includes("cookies") === true
      || permissions.origins?.includes("https://*.bilibili.com/*") === true;
  }

  async revokeLease(leaseId: string): Promise<boolean> {
    const revocationToken = this.#revocationTokens.get(leaseId);
    if (!revocationToken) return false;
    this.#revocationTokens.delete(leaseId);
    this.#revocationAttemptCount += 1;
    try {
      const response = await this.#fetch(`http://127.0.0.1:17861/v1/media/credential-leases/${leaseId}`, {
        method: "DELETE",
        headers: { "Authorization": `Navia-Media-Revoke ${revocationToken}` },
        cache: "no-store",
        credentials: "omit",
        redirect: "error",
        referrerPolicy: "no-referrer"
      });
      if (response.ok) {
        this.#revocationSucceededCount += 1;
        return true;
      }
      this.#revocationFailedCount += 1;
      return false;
    } catch {
      this.#revocationFailedCount += 1;
      return false;
    }
  }

  async revokeAll(): Promise<void> {
    const leaseIds = [...this.#revocationTokens.keys()];
    for (const leaseId of leaseIds) await this.revokeLease(leaseId);
  }
}
