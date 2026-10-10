import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");
const extensionRoot = fs.realpathSync(process.env.NAVIA_V3_EXTENSION_ROOT || path.join(repoRoot, "apps/chrome-extension/chrome-mv3-unpacked"));
const evidenceRoot = path.join(repoRoot, "docs/active/project/evidence/v3_media_companion/v3-1-page-session-baseline");
const sampleRegistryPath = path.join(evidenceRoot, "runs/v3-1p-bilibili-probe-20260917T041114Z/sample-registry.json");
const portalRegistryPath = path.join(repoRoot, "docs/active/project/contracts/v3-media-portal-registry.json");
const resultPath = path.resolve(process.argv[2] || "");
const authenticatedRegression = process.env.NAVIA_V3_AUTHENTICATED_REGRESSION === "1";
const cookieSeedPath = process.env.NAVIA_V3_BILIBILI_COOKIE_FILE || "";
const allowedCookieNames = new Set([
  "DedeUserID",
  "DedeUserID__ckMd5",
  "SESSDATA",
  "b_nut",
  "bili_jct",
  "buvid3",
  "buvid4",
  "buvid_fp",
  "sid"
]);

if (!process.argv[2] || !fs.existsSync(resultPath)) {
  throw new Error("Usage: node e2e/v3-media-page-verify.mjs <result.json>");
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function hashBuildTree(root) {
  const entries = [];
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else if (entry.isFile()) entries.push({
        path: path.relative(root, absolute).replaceAll(path.sep, "/"),
        sha256: sha256(fs.readFileSync(absolute))
      });
    }
  };
  visit(root);
  return sha256(canonicalJson(entries));
}

function readAuthorizedRawSecretValues() {
  if (!authenticatedRegression) return [];
  if (!cookieSeedPath || !fs.existsSync(cookieSeedPath)) throw new Error("authorized live-session seed is missing");
  const parsed = JSON.parse(fs.readFileSync(cookieSeedPath, "utf8"));
  if (!Array.isArray(parsed)) throw new Error("authorized live-session seed must be a JSON array");
  const accepted = parsed.filter((row) => {
    if (!row || typeof row !== "object" || !allowedCookieNames.has(row.name) || typeof row.value !== "string" || !row.value) return false;
    const domain = typeof row.domain === "string" ? row.domain.toLowerCase().replace(/^\./, "") : "";
    if (domain !== "bilibili.com" && !domain.endsWith(".bilibili.com")) throw new Error("authorized seed contains a non-Bilibili domain");
    return true;
  });
  if (!accepted.some((row) => row.name === "SESSDATA") || new Set(accepted.map((row) => row.name)).size !== allowedCookieNames.size) {
    throw new Error("authorized seed does not contain the frozen nine-name set");
  }
  return accepted.map((row) => Buffer.from(row.value));
}

function scanRootsForSecrets(roots, rawValues) {
  const patterns = [/SESSDATA\s*[=:]/i, /bili_jct\s*[=:]/i, /DedeUserID\s*[=:]/i, /Cookie\s*:/i, /Authorization\s*:\s*Bearer/i];
  const hits = [];
  let scannedFiles = 0;
  let scannedBytes = 0;
  const visit = (root, directory) => {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(root, absolute);
      else if (entry.isFile()) {
        scannedFiles += 1;
        const bytes = fs.readFileSync(absolute);
        scannedBytes += bytes.length;
        const relativePath = path.relative(root, absolute).replaceAll(path.sep, "/");
        if (rawValues.some((needle) => needle.length >= 8 && bytes.includes(needle))) {
          hits.push({ root: path.basename(root), path: relativePath, kind: "raw_value" });
        }
        if (!absolute.endsWith(".png")) {
          const text = bytes.toString("utf8");
          for (const pattern of patterns) {
            if (pattern.test(text)) hits.push({ root: path.basename(root), path: relativePath, kind: "credential_pattern" });
          }
        }
      }
    }
  };
  for (const root of roots) visit(root, root);
  return { scannedFiles, scannedBytes, hitCount: hits.length, hits };
}

const resultBytes = fs.readFileSync(resultPath);
const result = JSON.parse(resultBytes.toString("utf8"));
const runRoot = path.dirname(resultPath);
const collectorSecretScanPath = path.join(runRoot, "secret-scan.json");
const collectorSecretScan = fs.existsSync(collectorSecretScanPath)
  ? JSON.parse(fs.readFileSync(collectorSecretScanPath, "utf8"))
  : null;
const sampleRegistryBytes = fs.readFileSync(sampleRegistryPath);
const sampleRegistry = JSON.parse(sampleRegistryBytes.toString("utf8"));
const portalRegistryBytes = fs.readFileSync(portalRegistryPath);
const portalRegistry = JSON.parse(portalRegistryBytes.toString("utf8"));
const checks = [];
const check = (id, passed, detail) => checks.push({ id, passed: Boolean(passed), detail });
const rawSecretValues = readAuthorizedRawSecretValues();

const samplesById = new Map(sampleRegistry.samples.map((sample) => [sample.sampleId, sample]));
const observations = Array.isArray(result.observations) ? result.observations : [];
check("V3-1.1-VERIFY-01", result.schemaVersion === "v3-media-page-collector-run/v1" && result.evidenceClass === "production_candidate", "result contract and evidence class");
check("V3-1.1-VERIFY-02", path.basename(runRoot) === result.runId && !fs.existsSync(path.join(runRoot, "FAILED.json")), "single successful run namespace");
check("V3-1.1-VERIFY-03", result.sampleRegistrySha256 === sha256(sampleRegistryBytes), `sample registry ${result.sampleRegistrySha256}`);
check("V3-1.1-VERIFY-04", result.portalRegistrySha256 === sha256(portalRegistryBytes), `portal registry ${result.portalRegistrySha256}`);
check("V3-1.1-VERIFY-05", result.buildSha256 === hashBuildTree(extensionRoot), `build tree ${result.buildSha256}`);
check("V3-1.1-VERIFY-06", observations.length === 12 && new Set(observations.map((item) => item.sampleId)).size === 12 && new Set(observations.map((item) => item.url)).size === 12, "12 unique observations");
check(
  "V3-1.1-VERIFY-06A",
  authenticatedRegression
    ? result.sessionEvidenceClass === "user_authorized_live_session_seed_regression"
      && result.browser?.profileClass === "fresh_temporary_user_authorized_seed"
      && result.credentialSeedCookieCount === 9
      && result.serverInputValidation?.httpStatus === 200
      && result.serverInputValidation?.code === 0
      && result.serverInputValidation?.isLogin === true
      && result.serverInputValidation?.passed === true
    : result.sessionEvidenceClass === "anonymous_public_regression"
      && result.browser?.profileClass === "fresh_temporary_public"
      && result.credentialSeedCookieCount === 0
      && result.serverInputValidation === null,
  authenticatedRegression ? "authorized live-session evidence class and server validation" : "anonymous public evidence class"
);

let contextsValid = true;
let screenshotHashesValid = true;
let screenshotDimensionsValid = true;
let privacyCaptureValid = true;
let pageErrors = 0;
for (const observation of observations) {
  const sample = samplesById.get(observation.sampleId);
  const context = observation.response?.value;
  contextsValid &&= Boolean(
    sample
      && observation.passed === true
      && observation.response?.ok === true
      && observation.url === sample.url
      && context?.adapterId === "bilibili"
      && context?.platform === "bilibili"
      && context?.adapterRevision === 1
      && context?.mediaId === sample.bvid
      && context?.playbackUnitId === sample.cid
      && context?.part?.count === sample.partCount
      && context?.title === sample.title
      && context?.author === sample.author
      && Number.isFinite(context?.durationSeconds)
      && context.durationSeconds > 0
      && (sample.primaryClass === "restricted" || (
        Number.isFinite(observation.domObservation?.videoDuration)
        && Math.abs(context.durationSeconds - observation.domObservation.videoDuration) <= 2
      ))
      && observation.domObservation?.bridgeReady === "true"
      && observation.domObservation?.bridgeMode === "portal_auto"
      && observation.domObservation?.launcherPresent === true
      && !Object.hasOwn(context, "bvid")
      && !Object.hasOwn(context, "cid")
  );
  if (sample?.primaryClass === "subtitle") contextsValid &&= context?.transcriptAvailability === "available";
  if (sample?.primaryClass === "restricted") contextsValid &&= context?.transcriptAvailability === "restricted";
  if (sample?.bvid === "BV1ZpYd66ELP") contextsValid &&= context?.transcriptAvailability !== "available";
  pageErrors += observation.pageErrors?.length ?? 0;
  const screenshotPath = path.join(runRoot, observation.screenshotPath ?? "");
  if (!fs.existsSync(screenshotPath)) {
    screenshotHashesValid = false;
    screenshotDimensionsValid = false;
  } else {
    const screenshotBytes = fs.readFileSync(screenshotPath);
    screenshotHashesValid &&= sha256(screenshotBytes) === observation.screenshotSha256;
    try {
      const png = PNG.sync.read(screenshotBytes);
      screenshotDimensionsValid &&= png.width === 1280 && png.height === 900;
    } catch {
      screenshotDimensionsValid = false;
    }
  }
  const privacy = observation.privacyCapture;
  privacyCaptureValid &&= authenticatedRegression
    ? privacy?.mode === "top_account_region_excluded"
      && privacy?.sourceViewport?.width === 1280
      && privacy?.sourceViewport?.height === 1000
      && privacy?.clip?.x === 0
      && privacy?.clip?.y === 100
      && privacy?.clip?.width === 1280
      && privacy?.clip?.height === 900
      && privacy?.output?.width === 1280
      && privacy?.output?.height === 900
    : privacy?.mode === "full_viewport"
      && privacy?.clip?.y === 0
      && privacy?.output?.width === 1280
      && privacy?.output?.height === 900;
}
check("V3-1.1-VERIFY-07", contextsValid, "generic contexts match the frozen same-run sample facts");
check("V3-1.1-VERIFY-08", screenshotHashesValid, "12 screenshot hashes recomputed");
check("V3-1.1-VERIFY-08A", screenshotDimensionsValid, "12 screenshots decode as 1280x900 PNG");
check("V3-1.1-VERIFY-08B", privacyCaptureValid, authenticatedRegression ? "top 100px account region excluded" : "anonymous full viewport capture");
check("V3-1.1-VERIFY-09", pageErrors === 0, `page errors=${pageErrors}`);
check("V3-1.1-VERIFY-10", !result.ordinaryPage?.bridgeReady && !result.ordinaryPage?.launcherPresent && !result.ordinaryPage?.sidebarPresent, "ordinary page has zero static injection");

const multipartSample = sampleRegistry.samples.find((sample) => sample.primaryClass === "multipart");
const multipart = result.multipartPlayback;
check(
  "V3-1.1-VERIFY-11",
  multipart?.secondPartContext?.mediaId === multipartSample?.bvid
    && multipart?.secondPartContext?.part?.index === 2
    && multipart?.secondPartContext?.playbackUnitId !== multipartSample?.cid
    && Number.isFinite(multipart?.playback?.currentTimeSeconds)
    && Math.abs(multipart?.seek?.currentTimeSeconds - 10) <= 2
    && multipart?.invalidSeek?.failureCode === "V3_MEDIA_SEEK_INVALID",
  "multipart identity, playback, seek, and fail-closed invalid seek"
);
check("V3-1.1-VERIFY-12", result.cleanup?.profileDeleted === true && result.cleanup?.chromeClosed === true && result.cleanup?.temporaryMediaResidualCount === 0 && !fs.existsSync(path.join(repoRoot, ".tmp", `${result.runId}-profile`)), "profile and temporary media cleanup");
const secretScan = scanRootsForSecrets([runRoot, extensionRoot], rawSecretValues);
check(
  "V3-1.1-VERIFY-13",
  secretScan.hitCount === 0
    && collectorSecretScan?.hitCount === 0
    && collectorSecretScan?.passed === true,
  `secret hits=${secretScan.hitCount}; files=${secretScan.scannedFiles}; bytes=${secretScan.scannedBytes}`
);
check("V3-1.1-VERIFY-14", result.summary?.total === 12 && result.summary?.passed === 12 && result.summary?.failed === 0 && result.passed === true, "candidate summary 12/12");
check(
  "V3-1.1-VERIFY-15",
  portalRegistry.adapters?.length === 1
    && portalRegistry.adapters[0].adapterId === "bilibili"
    && portalRegistry.adapters[0].status === "v3_1_1_page_adapter_implemented_candidate"
    && JSON.stringify(portalRegistry.adapters[0].plannedCapabilities) === JSON.stringify(["session_capability"])
    && portalRegistry.extensionPolicy?.futureExamplesAreNotImplemented?.includes("youtube")
    && portalRegistry.extensionPolicy?.futureExamplesAreNotImplemented?.includes("xiaohongshu"),
  "Bilibili-only candidate with open future-adapter boundary"
);

const verification = {
  schemaVersion: "v3-media-page-acceptance-verification/v1",
  verifiedAt: new Date().toISOString(),
  runId: result.runId,
  resultPath: path.relative(repoRoot, resultPath).replaceAll(path.sep, "/"),
  resultSha256: sha256(resultBytes),
  fatal: 0,
  major: checks.filter((item) => !item.passed).length,
  checks,
  passed: checks.every((item) => item.passed)
};
const outputPath = path.join(runRoot, "acceptance-verification.json");
fs.writeFileSync(outputPath, `${JSON.stringify(verification, null, 2)}\n`, { mode: 0o600 });
process.stdout.write(`${JSON.stringify(verification, null, 2)}\n`);
if (!verification.passed) process.exitCode = 2;
