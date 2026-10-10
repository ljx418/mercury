import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { BILIBILI_COOKIE_NAME_SET_SHA256 } from "../../bilibili/bilibiliCookiePolicy";
import type { CredentialTransportContractSet } from "../contracts";
import { validateCredentialTransportContracts } from "../validateCredentialTransportContracts";

const positive: CredentialTransportContractSet = {
  channel: {
    schemaVersion: "portal-credential-channel-record/v1",
    channelId: "pch_11111111111111111111111111111111",
    taskId: "media_task_22222222222222222222222222222222",
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
    status: "consumed",
    failureCode: null
  },
  lease: {
    schemaVersion: "portal-credential-lease/v1",
    leaseId: "pcl_55555555555555555555555555555555",
    envelopeId: "pce_66666666666666666666666666666666",
    taskId: "media_task_22222222222222222222222222222222",
    adapterId: "bilibili",
    policyId: "bilibili-media-consent/v1",
    policyRevision: 1,
    browserSessionBindingSha256: "3".repeat(64),
    credentialNameSetSha256: BILIBILI_COOKIE_NAME_SET_SHA256,
    credentialCount: 5,
    transportMode: "one_shot_envelope",
    secretStorage: "runtime_process_memory_only",
    serverValidationStatus: "not_performed",
    issuedAt: "2026-09-17T10:00:05Z",
    expiresAt: "2026-09-17T10:01:05Z",
    state: "active",
    failureCode: null
  },
  transportAudit: {
    schemaVersion: "credential-transport-audit/v1",
    requestBodyBytes: 4096,
    requestAttemptCount: 1,
    requestBodyLogged: false,
    eventStorePayloadWritten: false,
    traceArgumentWritten: false,
    exceptionBodyWritten: false,
    retryBodyPersisted: false,
    rawCredentialValueHashed: false,
    persistentSecretHitCount: 0,
    publicSecretHitCount: 0,
    genericRuntimeProxyDenied: true,
    contentScriptDenied: true,
    exactOriginBound: true,
    replayRejected: true,
    expiredChannelRejected: true,
    runtimeRestartClearedLeases: true,
    revocationClearedLease: true
  }
};

type Mutation = (value: Record<string, any>) => void;

describe("validateCredentialTransportContracts", () => {
  it("accepts the frozen public positive contract", () => {
    expect(validateCredentialTransportContracts(structuredClone(positive), BILIBILI_COOKIE_NAME_SET_SHA256))
      .toEqual({ valid: true });
  });

  it.each<[string, Mutation, string]>([
    ["V3L-C-001", (v) => { v.channel.channelToken = "forbidden"; }, "SCHEMA_ADDITIONAL_PROPERTY"],
    ["V3L-C-002", (v) => { v.lease.cookieValue = "forbidden"; }, "SCHEMA_ADDITIONAL_PROPERTY"],
    ["V3L-C-003", (v) => { v.lease.cookieNames = ["forbidden"]; }, "SCHEMA_ADDITIONAL_PROPERTY"],
    ["V3L-C-004", (v) => { v.lease.revocationToken = "forbidden"; }, "SCHEMA_ADDITIONAL_PROPERTY"],
    ["V3L-C-005", (v) => { v.lease.serverValidationStatus = "validated"; }, "SCHEMA_CONST_MISMATCH"],
    ["V3L-C-006", (v) => { v.channel.oneShot = false; }, "SCHEMA_CONST_MISMATCH"],
    ["V3L-C-007", (v) => { v.transportAudit.requestAttemptCount = 2; }, "SCHEMA_CONST_MISMATCH"],
    ["V3L-C-008", (v) => { v.transportAudit.rawCredentialValueHashed = true; }, "SCHEMA_CONST_MISMATCH"],
    ["V3L-C-009", (v) => { v.transportAudit.persistentSecretHitCount = 1; }, "SCHEMA_CONST_MISMATCH"],
    ["V3L-C-010", (v) => { v.transportAudit.publicSecretHitCount = 1; }, "SCHEMA_CONST_MISMATCH"],
    ["V3L-C-011", (v) => { v.transportAudit.genericRuntimeProxyDenied = false; }, "SCHEMA_CONST_MISMATCH"],
    ["V3L-C-012", (v) => { v.transportAudit.contentScriptDenied = false; }, "SCHEMA_CONST_MISMATCH"]
  ])("rejects schema fixture %s with %s", (_id, mutate, failureCode) => {
    const value = structuredClone(positive) as unknown as Record<string, any>;
    mutate(value);
    expect(validateCredentialTransportContracts(value, BILIBILI_COOKIE_NAME_SET_SHA256))
      .toEqual({ valid: false, failureCode });
  });

  it.each<[string, Mutation, string]>([
    ["V3L-C-013", (v) => { v.lease.taskId = `media_task_${"a".repeat(32)}`; }, "V3_MEDIA_LEASE_TASK_MISMATCH"],
    ["V3L-C-014", (v) => { v.lease.adapterId = "youtube"; }, "V3_MEDIA_ENVELOPE_INVALID"],
    ["V3L-C-015", (v) => { v.lease.policyId = "other-media-consent/v1"; }, "V3_MEDIA_POLICY_NOT_GRANTED"],
    ["V3L-C-016", (v) => { v.lease.policyRevision = 2; }, "V3_MEDIA_POLICY_REVISION_MISMATCH"],
    ["V3L-C-017", (v) => { v.lease.browserSessionBindingSha256 = "a".repeat(64); }, "V3_MEDIA_CHANNEL_INVALID"],
    ["V3L-C-018", (v) => { v.lease.credentialNameSetSha256 = "a".repeat(64); }, "V3_MEDIA_CREDENTIAL_SET_INVALID"],
    ["V3L-C-019", (v) => { v.channel.expiresAt = "2026-09-17T10:00:21Z"; }, "V3_MEDIA_CHANNEL_EXPIRED"],
    ["V3L-C-020", (v) => { v.lease.expiresAt = "2026-09-17T10:01:06Z"; }, "V3_MEDIA_LEASE_EXPIRED"],
    ["V3L-C-021", (v) => { v.lease.issuedAt = "2026-09-17T09:59:59Z"; }, "V3_MEDIA_CHANNEL_INVALID"],
    ["V3L-C-022", (v) => { v.lease.issuedAt = "2026-09-17T10:00:21Z"; }, "V3_MEDIA_CHANNEL_EXPIRED"],
    ["V3L-C-023", (v) => { v.channel.status = "issued"; }, "V3_MEDIA_CHANNEL_INVALID"],
    ["V3L-C-024", (v) => { v.lease.failureCode = "V3_MEDIA_CREDENTIAL_TRANSPORT_FAILED"; }, "V3_MEDIA_CREDENTIAL_TRANSPORT_FAILED"],
    ["V3L-C-025", (v) => {
      v.channel.credentialNameSetSha256 = "a".repeat(64);
      v.lease.credentialNameSetSha256 = "a".repeat(64);
    }, "V3_MEDIA_CREDENTIAL_SET_INVALID"]
  ])("rejects semantic fixture %s with %s", (_id, mutate, failureCode) => {
    const value = structuredClone(positive) as unknown as Record<string, any>;
    mutate(value);
    expect(validateCredentialTransportContracts(value, BILIBILI_COOKIE_NAME_SET_SHA256))
      .toEqual({ valid: false, failureCode });
  });
});

describe("frozen RFC 6902 fixture file", () => {
  const fixturePath = path.resolve(
    process.cwd(),
    "../../docs/active/project/fixtures/v3-media-credential-lease-contract-fixtures.json"
  );
  const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8")) as {
    baseInstance: string;
    requirements: Array<{ requirementId: string; failureCode: string }>;
    cases: Array<{
      caseId: string;
      requirementId: string;
      patch?: { op: "add" | "replace"; path: string; value: unknown };
      patches?: Array<{ op: "add" | "replace"; path: string; value: unknown }>;
      expectedFailureCode: string;
    }>;
  };
  const repoRoot = path.resolve(process.cwd(), "../..");
  const basePath = path.resolve(repoRoot, fixture.baseInstance);
  if (!basePath.startsWith(`${repoRoot}${path.sep}`)) throw new Error("Fixture baseInstance escapes the repository root.");
  const baseInstance = JSON.parse(fs.readFileSync(basePath, "utf8")) as CredentialTransportContractSet;

  function applyPatch(input: CredentialTransportContractSet, patch: { op: "add" | "replace"; path: string; value: unknown }) {
    const output = structuredClone(input) as unknown as Record<string, any>;
    const segments = patch.path.slice(1).split("/").map((segment) => segment.replace(/~1/g, "/").replace(/~0/g, "~"));
    const key = segments.pop();
    if (!key) throw new Error(`Invalid fixture patch path: ${patch.path}`);
    let target: Record<string, any> = output;
    for (const segment of segments) target = target[segment] as Record<string, any>;
    target[key] = structuredClone(patch.value);
    return output;
  }

  function applyCase(input: CredentialTransportContractSet, testCase: { patch?: any; patches?: any[] }) {
    const patches = testCase.patches ?? (testCase.patch ? [testCase.patch] : []);
    if (patches.length === 0) throw new Error("Fixture case has no patch operation.");
    return patches.reduce((value, patch) => applyPatch(value, patch), structuredClone(input));
  }

  it("executes every authoritative case with the registered exact failure code", () => {
    expect(fixture.cases).toHaveLength(25);
    expect(fixture.requirements).toHaveLength(25);
    const requirementFailures = new Map(fixture.requirements.map((item) => [item.requirementId, item.failureCode]));
    for (const testCase of fixture.cases) {
      expect(requirementFailures.get(testCase.requirementId), testCase.caseId).toBe(testCase.expectedFailureCode);
      expect(
        validateCredentialTransportContracts(
          applyCase(baseInstance, testCase),
          BILIBILI_COOKIE_NAME_SET_SHA256
        ),
        testCase.caseId
      ).toEqual({ valid: false, failureCode: testCase.expectedFailureCode });
    }
  });
});
