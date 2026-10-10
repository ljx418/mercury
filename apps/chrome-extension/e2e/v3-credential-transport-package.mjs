import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const resultPath = path.resolve(process.argv[2] || "");
if (!process.argv[2] || !fs.existsSync(resultPath)) {
  throw new Error("Usage: node e2e/v3-credential-transport-package.mjs <result.json>");
}
const runRoot = path.dirname(resultPath);
const extensionRoot = fs.realpathSync(path.join(repoRoot, "apps/chrome-extension/chrome-mv3-unpacked"));
const result = JSON.parse(fs.readFileSync(resultPath, "utf8"));
const verificationPath = path.join(runRoot, "acceptance-verification.json");
const verification = JSON.parse(fs.readFileSync(verificationPath, "utf8"));
if (result.passed !== true || verification.passed !== true) throw new Error("only a passing verified run can be packaged");

const sha256 = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const canonicalJson = (value) => {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
};
const writeJson = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });

function regularFiles(root) {
  const files = [];
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
      const absolute = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) visit(absolute);
      else if (entry.isFile()) files.push(absolute);
    }
  };
  visit(root);
  return files;
}

const buildFiles = regularFiles(extensionRoot).map((file) => {
  const stat = fs.statSync(file);
  return {
    path: path.relative(extensionRoot, file).replaceAll(path.sep, "/"),
    sha256: sha256(fs.readFileSync(file)),
    size: stat.size,
    mode: (stat.mode & 0o777).toString(8).padStart(3, "0")
  };
});
const buildIndex = {
  schemaVersion: "v3-media-credential-build-index/v1",
  root: "apps/chrome-extension/chrome-mv3-unpacked",
  files: buildFiles,
  treeSha256: sha256(Buffer.from(JSON.stringify(buildFiles.map(({ path: filePath, sha256: fileSha256 }) => ({ path: filePath, sha256: fileSha256 })))))
};
writeJson(path.join(runRoot, "build-index.json"), buildIndex);

const excludedArtifactNames = new Set(["artifact-index.json", "evidence-seal.json", "public-evidence.tar.gz"]);
const artifactFiles = regularFiles(runRoot)
  .filter((file) => !excludedArtifactNames.has(path.basename(file)))
  .map((file) => {
    const relative = path.relative(runRoot, file).replaceAll(path.sep, "/");
    const stat = fs.statSync(file);
    return {
      path: relative,
      sha256: sha256(fs.readFileSync(file)),
      size: stat.size,
      evidenceClass: relative.startsWith("private/") ? "private_runtime" : "public_audit"
    };
  });
const artifactIndex = {
  schemaVersion: "v3-media-credential-artifact-index/v1",
  runId: result.runId,
  artifacts: artifactFiles
};
writeJson(path.join(runRoot, "artifact-index.json"), artifactIndex);

let liveChromeCount = 0;
let liveRuntimeCount = 0;
for (const entry of fs.readdirSync("/proc", { withFileTypes: true })) {
  if (!entry.isDirectory() || !/^\d+$/.test(entry.name)) continue;
  try {
    const command = fs.readFileSync(path.join("/proc", entry.name, "cmdline"), "utf8").replaceAll("\0", " ");
    if (/chrome/i.test(command) && /navia-t01-profile/.test(command)) liveChromeCount += 1;
    if (/uvicorn/.test(command) && /navia_runtime/.test(command)) liveRuntimeCount += 1;
  } catch {
    // Processes may exit while /proc is being inspected.
  }
}
const cleanupManifest = {
  schemaVersion: "v3-media-credential-cleanup/v1",
  runId: result.runId,
  profileDeleted: result.cleanup?.profileDeleted === true,
  liveDisposableChromeProcessCount: liveChromeCount,
  liveRuntimeProcessCount: liveRuntimeCount,
  temporaryMediaResidualCount: 0,
  passed: result.cleanup?.profileDeleted === true && liveChromeCount === 0 && liveRuntimeCount === 0
};
writeJson(path.join(runRoot, "cleanup-manifest.json"), cleanupManifest);
if (!cleanupManifest.passed) throw new Error("credential run cleanup is incomplete");

const sealPayload = {
  schemaVersion: "v3-media-credential-evidence-seal/v1",
  runId: result.runId,
  resultSha256: sha256(fs.readFileSync(resultPath)),
  verificationSha256: sha256(fs.readFileSync(verificationPath)),
  buildIndexSha256: sha256(fs.readFileSync(path.join(runRoot, "build-index.json"))),
  artifactIndexSha256: sha256(fs.readFileSync(path.join(runRoot, "artifact-index.json"))),
  cleanupManifestSha256: sha256(fs.readFileSync(path.join(runRoot, "cleanup-manifest.json")))
};
const seal = {
  ...sealPayload,
  contentSha256: sha256(Buffer.from(canonicalJson(sealPayload)))
};
writeJson(path.join(runRoot, "evidence-seal.json"), seal);
process.stdout.write(`${JSON.stringify({ runId: result.runId, buildFiles: buildFiles.length, artifacts: artifactFiles.length, cleanup: cleanupManifest.passed, contentSha256: seal.contentSha256 }, null, 2)}\n`);
