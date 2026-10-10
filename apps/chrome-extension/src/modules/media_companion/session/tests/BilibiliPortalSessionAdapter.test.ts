import { describe, expect, it, vi } from "vitest";
import { BilibiliPortalSessionAdapter } from "../bilibili/BilibiliPortalSessionAdapter";
import {
  BILIBILI_ALLOWED_COOKIE_NAMES,
  BILIBILI_COOKIE_NAME_SET_SHA256,
  BILIBILI_SESSION_POLICY_DEFINITION
} from "../bilibili/bilibiliCookiePolicy";
import { MEDIA_CONSENT_POLICY_SCHEMA_VERSION } from "../contracts";

const policy = {
  schemaVersion: MEDIA_CONSENT_POLICY_SCHEMA_VERSION,
  policyId: BILIBILI_SESSION_POLICY_DEFINITION.policyId,
  adapterId: BILIBILI_SESSION_POLICY_DEFINITION.adapterId,
  policyRevision: 1,
  status: "granted" as const,
  scopeGrants: BILIBILI_SESSION_POLICY_DEFINITION.consentScopeIds.map((scopeId) => ({ scopeId, granted: true })),
  decidedAt: "2026-09-17T08:00:00Z",
  revokedAt: null
};
const context = {
  policy,
  permissionState: { namedPermissionGranted: true, hostPermissionGranted: true },
  observedAt: new Date("2026-09-17T08:00:05Z")
};

describe("BilibiliPortalSessionAdapter", () => {
  it("keeps the frozen policy exact", () => {
    expect(BILIBILI_ALLOWED_COOKIE_NAMES).toHaveLength(9);
    expect(new Set(BILIBILI_ALLOWED_COOKIE_NAMES).size).toBe(9);
    expect(BILIBILI_ALLOWED_COOKIE_NAMES).toContain("SESSDATA");
    expect(BILIBILI_COOKIE_NAME_SET_SHA256).toBe("67166981712c0b024632614b43d1c7d4ecf7e23c2557b6f76dc58318a7530fc2");
  });

  it("returns available from a nonempty required Cookie without exposing names or values", async () => {
    const secret = "never-serialize-this-value";
    const getAll = vi.fn(async () => [
      { name: "SESSDATA", value: secret, domain: ".bilibili.com" },
      { name: "bili_jct", value: "second-secret", domain: ".bilibili.com" },
      { name: "unknown", value: "ignored", domain: ".bilibili.com" },
      { name: "DedeUserID", value: "wrong-domain", domain: ".example.com" }
    ]);
    const capability = await new BilibiliPortalSessionAdapter({ getAll }).inspectCapability(context);
    expect(getAll).toHaveBeenCalledWith({ domain: ".bilibili.com" });
    expect(capability).toMatchObject({
      status: "available",
      credentialCount: 2,
      credentialNameSetSha256: BILIBILI_COOKIE_NAME_SET_SHA256,
      serverValidated: false,
      failureCode: null
    });
    const serialized = JSON.stringify(capability);
    expect(serialized).not.toContain(secret);
    expect(serialized).not.toContain("SESSDATA");
    expect(serialized).not.toContain("bili_jct");
  });

  it("returns unavailable when the required Cookie is missing or empty", async () => {
    const adapter = new BilibiliPortalSessionAdapter({
      getAll: vi.fn(async () => [
        { name: "SESSDATA", value: "", domain: ".bilibili.com" },
        { name: "bili_jct", value: "nonempty", domain: ".bilibili.com" }
      ])
    });
    await expect(adapter.inspectCapability(context)).resolves.toMatchObject({
      status: "unavailable",
      credentialCount: 1,
      serverValidated: false,
      failureCode: "V3_MEDIA_SESSION_COOKIE_MISSING"
    });
  });

  it("does not call the Cookie API when policy or browser permissions are not granted", async () => {
    const getAll = vi.fn(async () => []);
    const adapter = new BilibiliPortalSessionAdapter({ getAll });
    await expect(adapter.inspectCapability({
      ...context,
      permissionState: { namedPermissionGranted: true, hostPermissionGranted: false }
    })).rejects.toThrow("V3_MEDIA_SESSION_POLICY_MISMATCH");
    expect(getAll).not.toHaveBeenCalled();
  });

  it("propagates a browser read failure for the Broker to convert to a closed capability", async () => {
    const adapter = new BilibiliPortalSessionAdapter({
      getAll: vi.fn(async () => { throw new Error("browser read failed"); })
    });
    await expect(adapter.inspectCapability(context)).rejects.toThrow("browser read failed");
  });
});

