import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");
const runId = process.env.NAVIA_V3_RUN_ID;
if (!runId) throw new Error("NAVIA_V3_RUN_ID is required");

const runRoot = path.join(
  repoRoot,
  "docs/active/project/evidence/v3_media_companion/v3-1-page-session-baseline/runs",
  runId
);
const rawPath = path.join(runRoot, "raw-observations.json");
const screenshotRoot = path.join(runRoot, "screenshots");
const profileRoot = path.join(repoRoot, ".tmp", `${runId}-profile`);

const selection = [
  { bvid: "BV1yLuwzpEt2", primaryClass: "subtitle", expectedOutcome: "success" },
  { bvid: "BV1VG4117775", primaryClass: "subtitle", expectedOutcome: "success" },
  { bvid: "BV1Bt411D78C", primaryClass: "subtitle", expectedOutcome: "success" },
  { bvid: "BV1CiFMenEye", primaryClass: "subtitle", expectedOutcome: "success" },
  { bvid: "BV1Fh1VYFEDu", primaryClass: "subtitle", expectedOutcome: "success" },
  { bvid: "BV1iv411j7wL", primaryClass: "subtitle", expectedOutcome: "success" },
  { bvid: "BV1ZpYd66ELP", primaryClass: "asr", expectedOutcome: "success" },
  { bvid: "BV1BfNVeBENc", primaryClass: "asr", expectedOutcome: "success" },
  { bvid: "BV1zv1ZBCErv", primaryClass: "asr", expectedOutcome: "success" },
  { bvid: "BV1PA4m1w7ya", primaryClass: "multipart", expectedOutcome: "success" },
  { bvid: "BV1vt1sBgEzc", primaryClass: "restricted", expectedOutcome: "blocked" },
  { bvid: "BV1goA2zrEEq", primaryClass: "low_signal", expectedOutcome: "degraded" }
];

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function fail(message) {
  throw new Error(message);
}

function ensure(condition, message) {
  if (!condition) fail(message);
}

function evidenceFor(observation, primaryClass) {
  if (primaryClass === "subtitle") {
    ensure(observation.subtitleHtmlContributorExcerpt?.includes("字幕制作者"), `${observation.bvid}: subtitle contributor missing`);
    ensure(/主字幕/.test((observation.subtitleDomCandidates || []).map((item) => item.text).join(" ")), `${observation.bvid}: player subtitle language UI missing`);
    return [
      "page_html:subtitle_contributor",
      "player_dom:main_subtitle_language_option",
      `player_wbi_response_sha256:${observation.playerWbiResponseSha256}`
    ];
  }
  if (primaryClass === "asr") {
    ensure((observation.subtitleItems || []).length === 0, `${observation.bvid}: ASR sample has subtitle items`);
    ensure(!observation.subtitleHtmlContributorExcerpt, `${observation.bvid}: ASR sample has page subtitle contributor`);
    return [
      "player_api:subtitle_items_zero",
      "page_html:subtitle_contributor_absent",
      `player_wbi_response_sha256:${observation.playerWbiResponseSha256}`
    ];
  }
  if (primaryClass === "multipart") {
    ensure(observation.partCount > 1, `${observation.bvid}: multipart sample has one part`);
    ensure(observation.parts.length === observation.partCount, `${observation.bvid}: part list incomplete`);
    return [`page_identity:part_count=${observation.partCount}`, "view_api:parts_complete"];
  }
  if (primaryClass === "restricted") {
    ensure(observation.restrictionSignals?.includes("充电专属"), `${observation.bvid}: exclusive marker missing`);
    ensure(observation.restrictionSignals?.includes("即可观看"), `${observation.bvid}: viewing restriction missing`);
    return ["page_text:exclusive_video", "page_text:subscription_required"];
  }
  if (primaryClass === "low_signal") {
    ensure(/全程无解说|无人声|纯音乐无字幕|无解说、无背景音乐/.test(observation.classificationExcerpt || ""), `${observation.bvid}: low-signal evidence missing`);
    return ["page_text:no_narration", "expected_pipeline:degraded"];
  }
  fail(`${observation.bvid}: unknown primary class`);
}

const raw = JSON.parse(fs.readFileSync(rawPath, "utf-8"));
ensure(raw.runId === runId, "runId mismatch");
ensure(raw.browser?.profileClass === "fresh_temporary_public", "browser profile class mismatch");
ensure(!fs.existsSync(profileRoot), "temporary Chrome profile still exists");
ensure(Array.isArray(raw.observations) && raw.observations.length >= 12, "raw observations incomplete");

const observationByBvid = new Map(raw.observations.map((observation) => [observation.bvid, observation]));
fs.mkdirSync(screenshotRoot, { recursive: true, mode: 0o700 });

const samples = selection.map((selected, index) => {
  const observation = observationByBvid.get(selected.bvid);
  ensure(observation, `${selected.bvid}: observation missing`);
  ensure(observation.navigationStatus === 200, `${selected.bvid}: navigation failed`);
  ensure(observation.cid && /^\d+$/.test(observation.cid), `${selected.bvid}: cid missing`);
  ensure(observation.title && observation.author, `${selected.bvid}: identity incomplete`);
  ensure(observation.durationSeconds > 0, `${selected.bvid}: duration invalid`);
  const observationForHash = { ...observation };
  delete observationForHash.observationSha256;
  ensure(sha256(canonicalJson(observationForHash)) === observation.observationSha256, `${selected.bvid}: observation hash mismatch`);
  const sourceScreenshot = path.join(runRoot, observation.screenshotPath);
  ensure(fs.existsSync(sourceScreenshot), `${selected.bvid}: screenshot missing`);
  ensure(sha256(fs.readFileSync(sourceScreenshot)) === observation.screenshotSha256, `${selected.bvid}: source screenshot hash mismatch`);
  const sampleId = `v3-sample-${String(index + 1).padStart(2, "0")}`;
  const targetScreenshot = path.join(screenshotRoot, `${sampleId}.png`);
  fs.copyFileSync(sourceScreenshot, targetScreenshot);
  const screenshotSha256 = sha256(fs.readFileSync(targetScreenshot));
  return {
    sampleId,
    url: `https://www.bilibili.com/video/${observation.bvid}`,
    bvid: observation.bvid,
    cid: observation.cid,
    partCount: observation.partCount,
    durationSeconds: observation.durationSeconds,
    title: observation.title,
    author: observation.author,
    primaryClass: selected.primaryClass,
    expectedOutcome: selected.expectedOutcome,
    subtitleEvidence: selected.primaryClass === "subtitle" ? "page_player_item" : selected.primaryClass === "restricted" ? "restricted" : "none",
    classificationEvidence: evidenceFor(observation, selected.primaryClass),
    observedAt: observation.observedAt,
    observationSha256: observation.observationSha256,
    screenshotPath: `screenshots/${sampleId}.png`,
    screenshotSha256
  };
});

ensure(new Set(samples.map((sample) => sample.url)).size === 12, "sample URLs are not unique");
ensure(new Set(samples.map((sample) => sample.bvid)).size === 12, "sample BVIDs are not unique");
ensure(samples.some((sample) => sample.bvid === "BV1ZpYd66ELP" && sample.primaryClass === "asr"), "anchor ASR sample missing");
const counts = Object.fromEntries(["subtitle", "asr", "multipart", "restricted", "low_signal"].map((key) => [key, samples.filter((sample) => sample.primaryClass === key).length]));
ensure(canonicalJson(counts) === canonicalJson({ subtitle: 6, asr: 3, multipart: 1, restricted: 1, low_signal: 1 }), `class denominator mismatch: ${JSON.stringify(counts)}`);

const registry = {
  schemaVersion: "v3-bilibili-sample-registry/v1",
  revision: 1,
  runId,
  browser: raw.browser,
  createdAt: raw.createdAt,
  samples
};
const serialized = `${JSON.stringify(registry, null, 2)}\n`;
const secretPatterns = [
  /SESSDATA\s*[=:]/i,
  /bili_jct\s*[=:]/i,
  /DedeUserID\s*[=:]/i,
  /Authorization\s*[=:]\s*Bearer/i,
  /Cookie\s*:/i
];
ensure(secretPatterns.every((pattern) => !pattern.test(serialized)), "registry secret scan failed");
fs.writeFileSync(path.join(runRoot, "sample-registry.json"), serialized, { mode: 0o600 });
fs.writeFileSync(path.join(runRoot, "registry-verification.json"), `${JSON.stringify({
  schemaVersion: "v3-bilibili-sample-registry-verification/v1",
  runId,
  passed: true,
  counts,
  uniqueUrls: 12,
  uniqueBvids: 12,
  observationHashesVerified: 12,
  screenshotHashesVerified: 12,
  temporaryProfileDeleted: true,
  secretScanHits: 0,
  registrySha256: sha256(serialized)
}, null, 2)}\n`, { mode: 0o600 });

process.stdout.write(`${JSON.stringify({ runId, counts, registrySha256: sha256(serialized) }, null, 2)}\n`);
