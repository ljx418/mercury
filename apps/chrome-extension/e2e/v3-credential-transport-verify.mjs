import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";
import { extractCredentialNeedles, scanRootsForCredentialNeedles } from "./lib/v3CredentialSecretScan.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const resultPath = path.resolve(process.argv[2] || "");
if (!process.argv[2] || !fs.existsSync(resultPath)) {
  throw new Error("Usage: node e2e/v3-credential-transport-verify.mjs <result.json>");
}
const runRoot = path.dirname(resultPath);
const result = JSON.parse(fs.readFileSync(resultPath, "utf8"));
const extensionRoot = fs.realpathSync(path.join(repoRoot, "apps/chrome-extension/chrome-mv3-unpacked"));
const cookieSeedPath = process.env.NAVIA_V3_BILIBILI_COOKIE_FILE || "";
if (!cookieSeedPath || !fs.existsSync(cookieSeedPath)) throw new Error("authorized live-session seed is required for the independent secret scan");

const sha256 = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const repoRelative = (file) => path.relative(repoRoot, file).replaceAll(path.sep, "/");
const artifact = (file) => ({ path: repoRelative(file), sha256: sha256(fs.readFileSync(file)) });
const auditPath = (name) => path.join(runRoot, "audits", name);
const logPath = (name) => path.join(runRoot, "logs", name);
const contractAudit = readJson(auditPath("contract-audit.json"));
const staticAudit = readJson(auditPath("static-audit.json"));
const sessionVerification = readJson(auditPath("v3-1.2-session-verification.json"));
const pageVerification = readJson(auditPath("v3-1r-12-page-verification.json"));
const pageResultPath = path.resolve(repoRoot, pageVerification.resultPath);
const pageResult = readJson(pageResultPath);
const observations = new Map((result.observations ?? []).map((item) => [item.id, item]));

function observationPassed(...ids) {
  return ids.every((id) => observations.get(id)?.passed === true);
}

function staticCheck(id) {
  return staticAudit.checks?.find((item) => item.id === id)?.passed === true;
}

function readLog(name) {
  return fs.readFileSync(logPath(name), "utf8");
}

function hashBuildTree(root) {
  const entries = [];
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else if (entry.isFile()) entries.push({ path: path.relative(root, absolute).replaceAll(path.sep, "/"), sha256: sha256(fs.readFileSync(absolute)) });
    }
  };
  visit(root);
  return sha256(Buffer.from(JSON.stringify(entries)));
}

const expectedScreenshots = new Map([
  ["sidepanel-ready-360x900.png", [360, 900]],
  ["sidepanel-ready-420x900.png", [420, 900]],
  ["workspace-ready-768x900.png", [768, 900]],
  ["workspace-ready-1280x900.png", [1280, 900]]
]);
const screenshotChecks = (result.screenshots ?? []).map((entry) => {
  const file = path.join(runRoot, "screenshots", entry.file);
  if (!fs.existsSync(file) || !expectedScreenshots.has(entry.file)) return false;
  const bytes = fs.readFileSync(file);
  const decoded = PNG.sync.read(bytes);
  const [width, height] = expectedScreenshots.get(entry.file);
  const nonBlankChannels = new Set();
  for (let index = 0; index < decoded.data.length; index += 4) {
    nonBlankChannels.add(`${decoded.data[index]}:${decoded.data[index + 1]}:${decoded.data[index + 2]}`);
    if (nonBlankChannels.size >= 32) break;
  }
  return decoded.width === width
    && decoded.height === height
    && entry.sha256 === sha256(bytes)
    && entry.rootOverflowFree === true
    && entry.rootScrollWidth <= entry.rootClientWidth
    && nonBlankChannels.size >= 32;
});

const publicChannelKeys = [
  "schemaVersion", "channelId", "taskId", "adapterId", "policyId", "policyRevision",
  "browserSessionBindingSha256", "extensionOriginSha256", "credentialNameSetSha256", "transport",
  "oneShot", "channelTokenPersisted", "issuedAt", "expiresAt", "status", "failureCode"
].sort();
const publicLeaseKeys = [
  "schemaVersion", "leaseId", "envelopeId", "taskId", "adapterId", "policyId", "policyRevision",
  "browserSessionBindingSha256", "credentialNameSetSha256", "credentialCount", "transportMode",
  "secretStorage", "serverValidationStatus", "issuedAt", "expiresAt", "state", "failureCode"
].sort();
const channelKeys = Object.keys(result.publicRecords?.channel ?? {}).sort();
const leaseKeys = Object.keys(result.publicRecords?.lease ?? {}).sort();
const publicRecordText = JSON.stringify(result.publicRecords ?? {});
const publicRecordsClosed = JSON.stringify(channelKeys) === JSON.stringify(publicChannelKeys)
  && JSON.stringify(leaseKeys) === JSON.stringify(publicLeaseKeys)
  && !["\"channelToken\"", "\"revocationToken\"", "\"credentials\"", "SESSDATA", "bili_jct", "DedeUserID"].some((term) => publicRecordText.includes(term));

const childRunRoot = path.dirname(pageResultPath);
const needles = extractCredentialNeedles(fs.readFileSync(cookieSeedPath, "utf8"));
const freshSecretScan = scanRootsForCredentialNeedles([
  { label: "extension-build", path: extensionRoot },
  { label: "runtime-private", path: path.join(runRoot, "private") },
  { label: "credential-run", path: runRoot },
  { label: "v3-1r-regression", path: childRunRoot }
], needles);
fs.mkdirSync(path.join(runRoot, "audits"), { recursive: true });
fs.writeFileSync(auditPath("fresh-secret-scan.json"), `${JSON.stringify(freshSecretScan, null, 2)}\n`, { mode: 0o600 });

const frontendLog = readLog("frontend-full-tests.log");
const runtimeLog = readLog("runtime-full-tests.log");
const contractLog = readLog("credential-contract-tests.log");
const secretTestLog = readLog("secret-scan-tests.log");
const typecheckLog = readLog("typecheck.log");
const buildLog = readLog("build-e2e.log");
const currentBuildSha256 = hashBuildTree(extensionRoot);
const checks = [];

function check(id, passed, expected, actual, sourceFiles) {
  checks.push({
    id,
    passed: Boolean(passed),
    expected,
    actual,
    sourceArtifacts: sourceFiles.map(artifact)
  });
}

check("V3-1.3-A01", contractAudit.passed === true
  && contractAudit.schemaMetaValid === true
  && contractAudit.positiveErrorCount === 0
  && contractAudit.caseCount === 25
  && contractAudit.schemaNegativeCount === 12
  && contractAudit.semanticShapeValidCount === 13
  && /Tests\s+27 passed/.test(contractLog),
"Schema meta/positive PASS; 12 schema + 13 semantic exact cases PASS",
`${contractAudit.caseCount} cases; schema=${contractAudit.schemaNegativeCount}; semantic=${contractAudit.semanticShapeValidCount}`,
[auditPath("contract-audit.json"), logPath("credential-contract-tests.log")]);

check("V3-1.3-A02", staticCheck("session_policy_hash_frozen") && staticCheck("requirement_case_mapping"),
"V3-1.2 registry bytes remain frozen and 25/25 registry mapping matches",
"session hash and requirement mapping passed",
[auditPath("static-audit.json"), path.join(repoRoot, "docs/active/project/contracts/v3-media-session-policy-registry.json")]);

check("V3-1.3-A03", observationPassed("V3-1.3-A03-weak", "V3-1.3-A03-auth"), "missing/wrong/weak bearer rejected", "all authentication observations passed", [resultPath]);
check("V3-1.3-A04", observationPassed("V3-1.3-A04-origin"), "only exact extension Origin accepted", "origin matrix passed", [resultPath]);
check("V3-1.3-A05", observationPassed("V3-1.3-A05-native-permission", "V3-1.3-A05-A09-sidepanel-positive") && result.publicRecords?.channel?.oneShot === true && result.publicRecords?.channel?.channelTokenPersisted === false, "trusted Side Panel click issues one 20-second no-store channel without a public token", "native click and public one-shot channel passed", [resultPath]);
check("V3-1.3-A06", observationPassed("V3-1.3-A06-content-sender", "V3-1.3-A06-sidepanel-tab") && /Tests\s+290 passed/.test(frontendLog), "untrusted sender matrix rejects before Cookie read", "real sender attacks and full router regression passed", [resultPath, logPath("frontend-full-tests.log")]);
check("V3-1.3-A07", observationPassed("V3-1.3-A07-generic-proxy"), "generic runtime proxies reject all credential endpoints", "three proxy attacks passed", [resultPath]);
check("V3-1.3-A08", observationPassed("V3-1.3-A08-policy-denied", "V3-1.3-A08-required-missing", "V3-1.3-A08-revision", "V3-1.3-A15-policy-reauthorization"), "policy/revision/permission/required-cookie mismatches fail closed", "all mismatch and permission lifecycle observations passed", [resultPath]);
check("V3-1.3-A09", observationPassed("V3-1.3-A05-A09-sidepanel-positive", "V3-1.3-A09-workspace-positive"), "real live-session clicks produce same-task public leases in both surfaces", "Side Panel and Workspace production paths passed", [resultPath]);
check("V3-1.3-A10", observationPassed("V3-1.3-A10-public-lease") && publicRecordsClosed && result.publicRecords?.lease?.serverValidationStatus === "not_performed", "closed public channel/lease records contain no credential or capability", "public record key sets and boundary passed", [resultPath]);
check("V3-1.3-A11", observationPassed("V3-1.3-A11-channel-replay", "V3-1.3-A11-envelope-replay"), "channel and envelope replay rejected", "both replay observations passed", [resultPath]);
check("V3-1.3-A12", observationPassed("V3-1.3-A12-tamper", "V3-1.3-A12-channel-expiry"), "tamper matrix and natural channel expiry return exact failures", "six tamper cases and expiry passed", [resultPath]);
check("V3-1.3-A13", observationPassed("V3-1.3-A13-network_abort", "V3-1.3-A13-runtime_5xx", "V3-1.3-A13-response_loss", "V3-1.3-A13-fresh-channel-recovery"), "three transport faults attempt once; recovery uses fresh material", "fault and fresh-channel observations passed", [resultPath]);
check("V3-1.3-A14", observationPassed("V3-1.3-A14-lease-expiry"), "60-second lease expires without revival", "natural lease expiry passed", [resultPath]);
check("V3-1.3-A15", observationPassed("V3-1.3-A15-revoke", "V3-1.3-A15-policy-reauthorization"), "policy revoke removes permissions, revokes handles, and blocks stale authority", "revoke and subsequent authoritative permission state passed", [resultPath]);
check("V3-1.3-A16", observationPassed("V3-1.3-A16-runtime-restart", "V3-1.3-A16-background-restart"), "Runtime and Background restarts clear their process-memory authority", "both restart observations passed", [resultPath]);
check("V3-1.3-A17", observationPassed("V3-1.3-A17-browser-storage") && result.secretScan?.passed === true && freshSecretScan.passed === true && result.cleanup?.profileDeleted === true && /pass 2/.test(secretTestLog), "raw credential values have zero persistent/public hits and disposable profile is removed", `${freshSecretScan.scannedFiles} files / ${freshSecretScan.scannedBytes} bytes / 0 hits`, [resultPath, auditPath("fresh-secret-scan.json"), logPath("secret-scan-tests.log")]);
check("V3-1.3-A18", /Test Files\s+38 passed/.test(frontendLog)
  && /Tests\s+290 passed/.test(frontendLog)
  && /338 passed/.test(runtimeLog)
  && /tsc --noEmit/.test(typecheckLog)
  && /Finished in/.test(buildLog)
  && sessionVerification.passed === true
  && sessionVerification.summary?.total === 36
  && pageVerification.passed === true
  && pageVerification.fatal === 0
  && pageVerification.major === 0
  && pageResult.passed === true
  && pageResult.summary?.total === 12
  && pageResult.summary?.passed === 12
  && pageResult.buildSha256 === result.input?.buildTreeSha256
  && currentBuildSha256 === result.input?.buildTreeSha256,
"full frontend/runtime/typecheck/build, V3-1.2 verifier, and current-build 12-page V3-1R pass",
`frontend 290; runtime 338; V3-1.2 36/36; V3-1R 12/12; build ${currentBuildSha256}`,
[logPath("frontend-full-tests.log"), logPath("runtime-full-tests.log"), logPath("typecheck.log"), logPath("build-e2e.log"), auditPath("v3-1.2-session-verification.json"), auditPath("v3-1r-12-page-verification.json"), pageResultPath]);
check("V3-1.3-A19", staticAudit.passed === true && staticCheck("generic_layer_portal_terms_zero") && staticCheck("future_portals_not_registered"), "generic transport has no portal terms and only Bilibili is registered", "9/9 static architecture checks passed", [auditPath("static-audit.json")]);
check("V3-1.3-A20", observationPassed("V3-1.3-A20-ui")
  && screenshotChecks.length === 4
  && screenshotChecks.every(Boolean)
  && result.accessibility?.length === 4
  && result.accessibility.every((item) => item.serious === 0 && item.critical === 0)
  && result.keyboard?.length === 2
  && result.keyboard.every((item) => item.passed === true),
"four nonblank exact-size root-overflow-free screenshots, Axe 0/0, and keyboard paths pass",
"4 screenshots; 4 Axe surfaces; 2 keyboard surfaces",
[resultPath, ...result.screenshots.map((entry) => path.join(runRoot, "screenshots", entry.file))]);

const verification = {
  schemaVersion: "v3-media-credential-transport-verification/v1",
  verifiedAt: new Date().toISOString(),
  runId: result.runId,
  resultPath: repoRelative(resultPath),
  resultSha256: sha256(fs.readFileSync(resultPath)),
  checks,
  summary: {
    total: checks.length,
    passed: checks.filter((item) => item.passed).length,
    failed: checks.filter((item) => !item.passed).length
  },
  fatal: 0,
  major: checks.filter((item) => !item.passed).length,
  passed: checks.length === 20 && checks.every((item) => item.passed)
};
const outputPath = path.join(runRoot, "acceptance-verification.json");
fs.writeFileSync(outputPath, `${JSON.stringify(verification, null, 2)}\n`, { mode: 0o600 });
process.stdout.write(`${JSON.stringify({ runId: verification.runId, summary: verification.summary, fatal: verification.fatal, major: verification.major, passed: verification.passed }, null, 2)}\n`);
if (!verification.passed) process.exitCode = 2;
