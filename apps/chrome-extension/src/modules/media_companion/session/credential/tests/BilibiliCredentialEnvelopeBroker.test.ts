import { describe, expect, it, vi } from "vitest";
import { BILIBILI_COOKIE_NAME_SET_SHA256 } from "../../bilibili/bilibiliCookiePolicy";
import type { PortalCredentialChannelRecord, PortalCredentialLease } from "../contracts";
import { BilibiliCredentialEnvelopeBroker, type BrowserCredentialCookie } from "../bilibili/BilibiliCredentialEnvelopeBroker";
import { isCredentialTransportPath } from "../isCredentialTransportPath";

const markerSecret = "test-only-secret-never-production";
const channel: PortalCredentialChannelRecord = {
  schemaVersion: "portal-credential-channel-record/v1",
  channelId: `pch_${"1".repeat(32)}`,
  taskId: `media_task_${"2".repeat(32)}`,
  adapterId: "bilibili",
  policyId: "bilibili-media-consent/v1",
  policyRevision: 1,
  browserSessionBindingSha256: "3".repeat(64),
  extensionOriginSha256: "4".repeat(64),
  credentialNameSetSha256: BILIBILI_COOKIE_NAME_SET_SHA256,
  transport: "authenticated_loopback_one_shot",
  oneShot: true,
  channelTokenPersisted: false,
  issuedAt: "2026-09-17T10:00:00Z",
  expiresAt: "2026-09-17T10:00:20Z",
  status: "issued",
  failureCode: null
};
const lease: PortalCredentialLease = {
  schemaVersion: "portal-credential-lease/v1",
  leaseId: `pcl_${"5".repeat(32)}`,
  envelopeId: `pce_${"6".repeat(32)}`,
  taskId: channel.taskId,
  adapterId: channel.adapterId,
  policyId: channel.policyId,
  policyRevision: channel.policyRevision,
  browserSessionBindingSha256: channel.browserSessionBindingSha256,
  credentialNameSetSha256: channel.credentialNameSetSha256,
  credentialCount: 2,
  transportMode: "one_shot_envelope",
  secretStorage: "runtime_process_memory_only",
  serverValidationStatus: "not_performed",
  issuedAt: "2026-09-17T10:00:05Z",
  expiresAt: "2026-09-17T10:01:05Z",
  state: "active",
  failureCode: null
};
const policy = {
  schemaVersion: "media-consent-policy/v1" as const,
  policyId: "bilibili-media-consent/v1",
  adapterId: "bilibili",
  policyRevision: 1,
  status: "granted" as const,
  scopeGrants: [
    "bilibili_session_access",
    "temporary_media_download",
    "audio_local_processing",
    "frame_local_processing",
    "selected_frame_cloud_vision"
  ].map((scopeId) => ({ scopeId, granted: true })),
  decidedAt: "2026-09-17T09:59:00Z",
  revokedAt: null
};
const cookies: BrowserCredentialCookie[] = [
  { name: "SESSDATA", value: markerSecret, domain: ".bilibili.com", path: "/", secure: true, httpOnly: true, sameSite: "no_restriction" },
  { name: "bili_jct", value: "test-only-csrf", domain: ".bilibili.com", path: "/", secure: true, httpOnly: false, sameSite: "lax" },
  { name: "attacker", value: "must-not-pass", domain: ".bilibili.com", path: "/", secure: true, httpOnly: false, sameSite: "lax" },
  { name: "sid", value: "wrong-domain", domain: ".attacker.invalid", path: "/", secure: true, httpOnly: false, sameSite: "lax" }
];

function makeBroker(options: {
  status?: "granted" | "denied";
  cookieRows?: BrowserCredentialCookie[];
  fetch?: typeof fetch;
  now?: Date;
} = {}) {
  const cookieApi = { getAll: vi.fn(async () => options.cookieRows ?? cookies) };
  const fetchMock = options.fetch ?? vi.fn(async () => new Response(JSON.stringify({
    ok: true,
    data: { lease, revocationToken: "test-only-revocation-handle" }
  }), { status: 201, headers: { "Content-Type": "application/json" } }));
  const broker = new BilibiliCredentialEnvelopeBroker({
    policyReader: { getPolicy: vi.fn(async () => ({ ...policy, status: options.status ?? "granted" })) },
    permissionReader: { contains: vi.fn(async () => ({ namedPermissionGranted: true, hostPermissionGranted: true })) },
    cookieApi,
    fetch: fetchMock,
    now: () => options.now ?? new Date("2026-09-17T10:00:05Z")
  });
  return { broker, cookieApi, fetchMock };
}

const message = {
  type: "navia.mediaCredential" as const,
  command: "exchange_channel" as const,
  channelToken: "A".repeat(43),
  channel
};

describe("BilibiliCredentialEnvelopeBroker", () => {
  it("reads the Cookie Store once, filters the frozen set, and sends one dedicated request", async () => {
    const { broker, cookieApi, fetchMock } = makeBroker();
    const result = await broker.exchange(message);
    expect(result).toEqual({ ok: true, value: lease });
    expect(JSON.stringify(result)).not.toContain(markerSecret);
    expect(cookieApi.getAll).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = (fetchMock as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("http://127.0.0.1:17861/v1/media/credential-leases");
    expect(init).toMatchObject({ method: "POST", cache: "no-store", credentials: "omit", redirect: "error", referrerPolicy: "no-referrer" });
    expect((init.headers as Record<string, string>).Authorization).toBe(`Navia-Media-Channel ${"A".repeat(43)}`);
    const body = JSON.parse(String(init.body));
    expect(body.credentials.map((item: { name: string }) => item.name)).toEqual(["SESSDATA", "bili_jct"]);
    expect(body.credentials).not.toEqual(expect.arrayContaining([expect.objectContaining({ name: "attacker" })]));
    expect(broker.revocationHandleCount()).toBe(1);
    expect(broker.revocationDiagnostics()).toEqual({
      handleCount: 1,
      attemptCount: 0,
      succeededCount: 0,
      failedCount: 0
    });
  });

  it("anchors envelope issue time to the Runtime channel when the browser clock is behind", async () => {
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      expect(Date.parse(body.issuedAt)).toBe(Date.parse(channel.issuedAt));
      expect(Date.parse(body.expiresAt)).toBeLessThanOrEqual(Date.parse(channel.expiresAt));
      return new Response(JSON.stringify({
        ok: true,
        data: { lease, revocationToken: "test-only-revocation-handle" }
      }), { status: 201, headers: { "Content-Type": "application/json" } });
    });
    const { broker } = makeBroker({
      fetch: fetchMock as typeof fetch,
      now: new Date("2026-09-17T09:59:59.950Z")
    });

    await expect(broker.exchange(message)).resolves.toEqual({ ok: true, value: lease });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("rejects policy denial before reading Cookie Store", async () => {
    const { broker, cookieApi, fetchMock } = makeBroker({ status: "denied" });
    await expect(broker.exchange(message)).resolves.toEqual({ ok: false, failureCode: "V3_MEDIA_POLICY_NOT_GRANTED" });
    expect(cookieApi.getAll).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a missing required credential without a Runtime request", async () => {
    const { broker, cookieApi, fetchMock } = makeBroker({ cookieRows: cookies.filter((cookie) => cookie.name !== "SESSDATA") });
    await expect(broker.exchange(message)).resolves.toEqual({ ok: false, failureCode: "V3_MEDIA_CREDENTIAL_SET_INVALID" });
    expect(cookieApi.getAll).toHaveBeenCalledOnce();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not retry the envelope after a transport failure", async () => {
    const fetchMock = vi.fn(async () => { throw new TypeError("network interrupted"); });
    const { broker } = makeBroker({ fetch: fetchMock as typeof fetch });
    await expect(broker.exchange(message)).resolves.toEqual({ ok: false, failureCode: "V3_MEDIA_CREDENTIAL_TRANSPORT_FAILED" });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(broker.revocationHandleCount()).toBe(0);
  });

  it("binds the default browser fetch receiver", async () => {
    const receiverSensitiveFetch = vi.fn(function (this: unknown) {
      if (this !== globalThis) throw new TypeError("Illegal invocation");
      return Promise.resolve(new Response(JSON.stringify({
        ok: true,
        data: { lease, revocationToken: "test-only-revocation-handle" }
      }), { status: 201, headers: { "Content-Type": "application/json" } }));
    });
    vi.stubGlobal("fetch", receiverSensitiveFetch);
    try {
      const broker = new BilibiliCredentialEnvelopeBroker({
        policyReader: { getPolicy: vi.fn(async () => policy) },
        permissionReader: { contains: vi.fn(async () => ({ namedPermissionGranted: true, hostPermissionGranted: true })) },
        cookieApi: { getAll: vi.fn(async () => cookies) },
        now: () => new Date("2026-09-17T10:00:05Z")
      });
      await expect(broker.exchange(message)).resolves.toEqual({ ok: true, value: lease });
      expect(receiverSensitiveFetch).toHaveBeenCalledOnce();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("rejects an oversized envelope before fetch", async () => {
    const oversized = [{ ...cookies[0], value: "x".repeat(33_000) }];
    const { broker, fetchMock } = makeBroker({ cookieRows: oversized });
    await expect(broker.exchange(message)).resolves.toEqual({ ok: false, failureCode: "V3_MEDIA_ENVELOPE_TOO_LARGE" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("revokes a lease once and drops the local handle before observing the response", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ok: true,
        data: { lease, revocationToken: "test-only-revocation-handle" }
      }), { status: 201, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, data: { lease: { ...lease, state: "revoked" } } }), { status: 200 }));
    const { broker } = makeBroker({ fetch: fetchMock as typeof fetch });
    await expect(broker.exchange(message)).resolves.toEqual({ ok: true, value: lease });
    await expect(broker.revokeLease(lease.leaseId)).resolves.toBe(true);
    await expect(broker.revokeLease(lease.leaseId)).resolves.toBe(false);
    expect(broker.revocationHandleCount()).toBe(0);
    expect(broker.revocationDiagnostics()).toEqual({
      handleCount: 0,
      attemptCount: 1,
      succeededCount: 1,
      failedCount: 0
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe(`http://127.0.0.1:17861/v1/media/credential-leases/${lease.leaseId}`);
    expect(init).toMatchObject({ method: "DELETE", cache: "no-store", credentials: "omit", redirect: "error", referrerPolicy: "no-referrer" });
    expect((init.headers as Record<string, string>).Authorization).toBe("Navia-Media-Revoke test-only-revocation-handle");
  });

  it("does not retry revoke after a network failure and still discards the handle", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ok: true,
        data: { lease, revocationToken: "test-only-revocation-handle" }
      }), { status: 201, headers: { "Content-Type": "application/json" } }))
      .mockRejectedValueOnce(new TypeError("network interrupted"));
    const { broker } = makeBroker({ fetch: fetchMock as typeof fetch });
    await broker.exchange(message);
    await expect(broker.revokeAll()).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(broker.revocationHandleCount()).toBe(0);
    expect(broker.revocationDiagnostics()).toEqual({
      handleCount: 0,
      attemptCount: 1,
      succeededCount: 0,
      failedCount: 1
    });
  });

  it("filters permission and Cookie lifecycle events to the registered Bilibili policy", () => {
    const { broker } = makeBroker();
    expect(broker.isRelevantPermissionRemoval({ permissions: ["cookies"] })).toBe(true);
    expect(broker.isRelevantPermissionRemoval({ origins: ["https://*.bilibili.com/*"] })).toBe(true);
    expect(broker.isRelevantPermissionRemoval({ origins: ["https://*.youtube.com/*"] })).toBe(false);
    expect(broker.isRelevantCookieChange({ name: "SESSDATA", domain: ".bilibili.com" })).toBe(true);
    expect(broker.isRelevantCookieChange({ name: "attacker", domain: ".bilibili.com" })).toBe(false);
    expect(broker.isRelevantCookieChange({ name: "SESSDATA", domain: ".attacker.invalid" })).toBe(false);
  });
});

describe("isCredentialTransportPath", () => {
  it.each([
    "/v1/media/credential-channels",
    "/v1/media/credential-leases",
    `/v1/media/credential-leases/pcl_${"a".repeat(32)}`,
    "/v1/media/credential-leases?query=forbidden"
  ])("denies %s in generic proxies", (path) => expect(isCredentialTransportPath(path)).toBe(true));

  it.each(["/v1/health", "/v1/media/tasks", "/v1/media/credential-leases/not-a-lease"])(
    "does not overblock %s",
    (path) => expect(isCredentialTransportPath(path)).toBe(false)
  );
});
