import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const [rawPath, outputPath] = process.argv.slice(2).map((value) => value && path.resolve(value));
if (!rawPath || !outputPath) throw new Error("usage: node v3-5.1-fresh-probe-verify.mjs RAW OUTPUT");
const raw = JSON.parse(fs.readFileSync(rawPath, "utf8"));
const runRoot = path.dirname(rawPath);
const expected = new Map([
  ["BV1sMNtzJE5B", "long_form_interview"],
  ["BV1PA4m1w7ya", "tutorial_demonstration"],
  ["BV1ZpYd66ELP", "narrative_commentary_anchor"],
]);
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
const canonical = (value) => Array.isArray(value)
  ? `[${value.map(canonical).join(",")}]`
  : value && typeof value === "object"
    ? `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`
    : JSON.stringify(value);
const ensure = (value, message) => { if (!value) throw new Error(message); };

ensure(raw.schemaVersion === "v3-bilibili-probe-observations/v1", "raw schema mismatch");
ensure(Array.isArray(raw.observations) && raw.observations.length === 3, "exactly three observations are required");
ensure(raw.browser?.profileClass === "user_authorized_temporary_v3_2", "authorized temporary profile was not used");
ensure(new Set(raw.observations.map((item) => item.bvid)).size === 3, "BVIDs are not unique");

const samples = raw.observations.map((observation) => {
  ensure(expected.has(observation.bvid), `${observation.bvid}: unexpected sample`);
  ensure(observation.navigationStatus === 200 && !observation.navigationError, `${observation.bvid}: navigation failed`);
  ensure(/^\d+$/.test(observation.cid), `${observation.bvid}: CID missing`);
  ensure(Number.isInteger(observation.durationSeconds) && observation.durationSeconds > 0, `${observation.bvid}: duration invalid`);
  const observationForHash = { ...observation };
  delete observationForHash.observationSha256;
  ensure(sha256(canonical(observationForHash)) === observation.observationSha256, `${observation.bvid}: observation hash mismatch`);
  const screenshot = path.resolve(runRoot, observation.screenshotPath);
  ensure(screenshot.startsWith(`${runRoot}${path.sep}`) && fs.existsSync(screenshot), `${observation.bvid}: screenshot missing`);
  ensure(sha256(fs.readFileSync(screenshot)) === observation.screenshotSha256, `${observation.bvid}: screenshot hash mismatch`);
  return {
    sampleId: `v3-5.1-sample-${samplesLength(observation.bvid)}`,
    sampleClass: expected.get(observation.bvid),
    url: `https://www.bilibili.com/video/${observation.bvid}`,
    bvid: observation.bvid,
    cid: observation.cid,
    partIndex: observation.partIndex,
    partCount: observation.partCount,
    durationSeconds: observation.durationSeconds,
    title: observation.title,
    author: observation.author,
    observedAt: observation.observedAt,
    observationSha256: observation.observationSha256,
    screenshotSha256: observation.screenshotSha256,
  };
});

function samplesLength(bvid) {
  return String([...expected.keys()].indexOf(bvid) + 1).padStart(2, "0");
}

ensure(samples.some((sample) => sample.durationSeconds >= 1800), "at least one >=30 minute sample is required");
ensure(new Set(samples.map((sample) => sample.sampleClass)).size === 3, "three content classes are required");
const registry = {
  schemaVersion: "v3-5.1-fresh-sample-registry/v1",
  runId: raw.runId,
  browser: raw.browser,
  createdAt: raw.createdAt,
  sampleCount: samples.length,
  minimumDurationPassed: true,
  processScreenshotsRetained: false,
  groundedTextCloudStatus: "disabled",
  samples,
};
const serialized = `${JSON.stringify(registry, null, 2)}\n`;
for (const pattern of [/SESSDATA\s*[=:]/i, /bili_jct\s*[=:]/i, /Cookie\s*:/i, /Authorization\s*:/i]) {
  ensure(!pattern.test(serialized), "registry secret scan failed");
}
fs.mkdirSync(path.dirname(outputPath), { recursive: true, mode: 0o700 });
fs.writeFileSync(outputPath, serialized, { mode: 0o600 });
for (const observation of raw.observations) fs.unlinkSync(path.resolve(runRoot, observation.screenshotPath));
fs.writeFileSync(path.join(runRoot, "probe-verification.json"), `${JSON.stringify({
  schemaVersion: "v3-5.1-fresh-probe-verification/v1",
  runId: raw.runId,
  passed: true,
  observationHashesVerified: 3,
  screenshotHashesVerifiedBeforeDeletion: 3,
  processScreenshotsDeleted: true,
  minimumDurationPassed: true,
  secretScanHits: 0,
  registrySha256: sha256(serialized),
}, null, 2)}\n`, { mode: 0o600 });
console.log(JSON.stringify({ runId: raw.runId, passed: true, durations: samples.map((sample) => sample.durationSeconds), registrySha256: sha256(serialized) }, null, 2));
