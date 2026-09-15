import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_REPOSITORY_ROOT = path.resolve(moduleDir, "../../../..");
export const T04_AUTHORIZATION_PATH = "docs/active/project/evidence/v2_external_brain_productization/px-5/t04-r4-snapshot-revalidation/t04.1-implementation-authorization.json";
export const T04_EXTERNAL_AUDIT_PATH = "docs/active/project/evidence/v2_external_brain_productization/px-5/t04-r4-snapshot-revalidation/t04.1-input-manifest-remediation-independent-document-audit.md";
export const T04_APPROVED_SCOPE = "T04.1 resolved-invocation remediation and complete T04-0..T04-7 rerun";
export const T04_USER_INSTRUCTION = "Implement the plan.";
export const T04_USER_INSTRUCTION_SHA256 = "9d4eca07d13e161a4368f619f36d20bbb0af84f871ac5519f977762e693eb1dc";
export const T04_EXTERNAL_AUDIT_SHA256 = "404fefd28a092244247dd842001c3f1f72a37746129984f78a6c8ca2d13f443b";

export function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function canonicalValue(value) {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalValue(value[key])]));
  }
  return value;
}

export function canonicalJson(value) {
  return JSON.stringify(canonicalValue(value));
}

export function normalizeRepositoryPath(value) {
  const normalized = String(value).replaceAll("\\", "/");
  if (!normalized || normalized.startsWith("/") || normalized.split("/").includes("..") || normalized.includes("\0")) {
    throw new Error(`Invalid repository-relative path: ${value}`);
  }
  return normalized.replace(/^\.\//, "");
}

function modeForStat(stat) {
  if (stat.isSymbolicLink()) return "120000";
  return (stat.mode & 0o111) !== 0 ? "100755" : "100644";
}

export function readRepositoryBytes(repositoryRoot, relativePath) {
  const clean = normalizeRepositoryPath(relativePath);
  const absolute = path.resolve(repositoryRoot, ...clean.split("/"));
  const relative = path.relative(path.resolve(repositoryRoot), absolute);
  if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error(`Path escapes repository: ${clean}`);
  const stat = fs.lstatSync(absolute);
  return {
    absolute,
    bytes: stat.isSymbolicLink() ? Buffer.from(fs.readlinkSync(absolute), "utf8") : fs.readFileSync(absolute),
    mode: modeForStat(stat)
  };
}

export function artifactRef(artifactRoot, rootPath, relativePath, mediaType = "application/octet-stream") {
  const clean = normalizeRepositoryPath(relativePath);
  const absolute = path.resolve(rootPath, ...clean.split("/"));
  const bytes = fs.readFileSync(absolute);
  return { artifactRoot, path: clean, sha256: sha256(bytes), byteLength: bytes.length, mediaType };
}

export function validateArtifactRef(ref, roots) {
  if (!ref || typeof ref !== "object") throw new Error("ArtifactRef is required.");
  const root = roots[ref.artifactRoot];
  if (!root) throw new Error(`Unknown artifact root: ${ref.artifactRoot}`);
  const actual = artifactRef(ref.artifactRoot, root, ref.path, ref.mediaType);
  if (actual.sha256 !== ref.sha256 || actual.byteLength !== ref.byteLength) {
    throw new Error(`Artifact bytes do not match ref: ${ref.artifactRoot}/${ref.path}`);
  }
  return actual;
}

function rebaseValidationRef(ref, replayRoot) {
  if (!ref || ref.artifactRoot !== "validation_run") {
    throw new Error("T04_INVOCATION_EVIDENCE_INVALID: source ArtifactRef must use validation_run.");
  }
  const resolved = artifactRef("replay_validation", replayRoot, ref.path, ref.mediaType);
  if (resolved.sha256 !== ref.sha256 || resolved.byteLength !== ref.byteLength) {
    throw new Error(`T04_INVOCATION_EVIDENCE_INVALID: source ArtifactRef bytes changed for ${ref.path}.`);
  }
  return resolved;
}

export function resolveReplayInvocationRecord(invocation, replayRoot) {
  const sourceInvocation = artifactRef("replay_validation", replayRoot, "invocation-record.json", "application/json");
  if (!invocation || !Array.isArray(invocation.steps) || invocation.steps.length !== 4) {
    throw new Error("T04_INVOCATION_EVIDENCE_INVALID: source invocation must contain four steps.");
  }
  return {
    schemaVersion: "v2-px-replay-invocation-record/v1",
    evidenceClass: invocation.evidenceClass,
    profile: invocation.profile,
    resolutionAlgorithm: "artifact_root_rebase_validation_to_replay_v1",
    sourceInvocation,
    validationRunId: invocation.validationRunId,
    sourceRunId: invocation.sourceRunId,
    recordedAt: invocation.recordedAt,
    steps: invocation.steps.map((step) => ({
      ...step,
      implementation: rebaseValidationRef(step.implementation, replayRoot),
      stdout: rebaseValidationRef(step.stdout, replayRoot),
      stderr: rebaseValidationRef(step.stderr, replayRoot)
    })),
    productionPackage: rebaseValidationRef(invocation.productionPackage, replayRoot),
    exitCode: invocation.exitCode,
    passed: invocation.passed,
    claimBoundary: invocation.claimBoundary
  };
}

export function validateResolvedReplayInvocation(resolved, replayRoot) {
  if (!resolved || resolved.schemaVersion !== "v2-px-replay-invocation-record/v1"
      || resolved.resolutionAlgorithm !== "artifact_root_rebase_validation_to_replay_v1") {
    throw new Error("T04_INVOCATION_EVIDENCE_INVALID: resolved invocation contract mismatch.");
  }
  const originalBytes = fs.readFileSync(path.join(replayRoot, "invocation-record.json"));
  const original = JSON.parse(originalBytes);
  const expected = resolveReplayInvocationRecord(original, replayRoot);
  if (canonicalJson(resolved) !== canonicalJson(expected)) {
    throw new Error("T04_INVOCATION_EVIDENCE_INVALID: resolved invocation does not match source bytes.");
  }
  return { originalSha256: sha256(originalBytes), resolved };
}

export function validateImplementationAuthorization(repositoryRoot = DEFAULT_REPOSITORY_ROOT) {
  const audit = readRepositoryBytes(repositoryRoot, T04_EXTERNAL_AUDIT_PATH);
  const authorization = readRepositoryBytes(repositoryRoot, T04_AUTHORIZATION_PATH);
  const auditSha = sha256(audit.bytes);
  const authorizationText = authorization.bytes.toString("utf8");
  const record = JSON.parse(authorizationText);
  if (auditSha !== T04_EXTERNAL_AUDIT_SHA256) throw new Error("T04_INDEPENDENT_AUDIT_REQUIRED: external audit hash mismatch.");
  if (!/Fatal\s*=\s*0/.test(audit.bytes.toString("utf8")) || !/Major\s*=\s*0/.test(audit.bytes.toString("utf8"))) {
    throw new Error("T04_INDEPENDENT_AUDIT_REQUIRED: external audit did not pass.");
  }
  if (authorizationText !== canonicalJson(record)) throw new Error("T04_INDEPENDENT_AUDIT_REQUIRED: authorization is not canonical JSON.");
  const expected = {
    schemaVersion: "v2-px-t04.1-implementation-authorization/v1",
    stage: "T04.1",
    decision: "approved",
    approvedScope: T04_APPROVED_SCOPE,
    userInstructionText: T04_USER_INSTRUCTION,
    userInstructionSha256: T04_USER_INSTRUCTION_SHA256,
    externalDocumentAuditSha256: auditSha
  };
  for (const [key, value] of Object.entries(expected)) {
    if (record[key] !== value) throw new Error(`T04_INDEPENDENT_AUDIT_REQUIRED: authorization ${key} mismatch.`);
  }
  if (sha256(Buffer.from(record.userInstructionText, "utf8")) !== record.userInstructionSha256) {
    throw new Error("T04_INDEPENDENT_AUDIT_REQUIRED: user instruction hash mismatch.");
  }
  if (record.userId !== "repository_owner_current_chat" || typeof record.authorizedAt !== "string" || Number.isNaN(Date.parse(record.authorizedAt)) || typeof record.recordedBy !== "string" || !record.recordedBy) {
    throw new Error("T04_INDEPENDENT_AUDIT_REQUIRED: incomplete authorization record.");
  }
  return {
    record,
    auditRef: { artifactRoot: "repository_snapshot", path: T04_EXTERNAL_AUDIT_PATH, sha256: auditSha, byteLength: audit.bytes.length, mediaType: "text/markdown" },
    authorizationRef: { artifactRoot: "repository_snapshot", path: T04_AUTHORIZATION_PATH, sha256: sha256(authorization.bytes), byteLength: authorization.bytes.length, mediaType: "application/json" }
  };
}

function scriptKindFor(filePath) {
  if (filePath.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (filePath.endsWith(".ts")) return ts.ScriptKind.TS;
  if (filePath.endsWith(".jsx")) return ts.ScriptKind.JSX;
  return ts.ScriptKind.JS;
}

export function relativeModuleSpecifiers(sourceText, filePath) {
  const ast = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true, scriptKindFor(filePath));
  const found = new Set();
  const add = (node) => {
    if (node && ts.isStringLiteralLike(node) && /^\.{1,2}\//.test(node.text)) found.add(node.text);
  };
  const visit = (node) => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) add(node.moduleSpecifier);
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) add(node.arguments[0]);
    ts.forEachChild(node, visit);
  };
  visit(ast);
  return [...found].sort();
}

function resolveRelativeModule(repositoryRoot, fromPath, specifier) {
  const base = path.posix.normalize(path.posix.join(path.posix.dirname(fromPath), specifier));
  const candidates = path.posix.extname(base)
    ? [base]
    : [base, ...[".mjs", ".js", ".ts", ".tsx", ".jsx", ".json"].map((suffix) => `${base}${suffix}`), ...[".mjs", ".js", ".ts", ".tsx"].map((suffix) => `${base}/index${suffix}`)];
  for (const candidate of candidates) {
    const clean = normalizeRepositoryPath(candidate);
    if (fs.existsSync(path.resolve(repositoryRoot, ...clean.split("/")))) return clean;
  }
  return null;
}

export function collectEsmImportGraph(repositoryRoot, entrypoints) {
  const queue = [...new Set(entrypoints.map(normalizeRepositoryPath))];
  const visited = new Set();
  const edges = [];
  const missingEdges = [];
  while (queue.length) {
    const current = queue.shift();
    if (visited.has(current)) continue;
    visited.add(current);
    const { bytes } = readRepositoryBytes(repositoryRoot, current);
    for (const specifier of relativeModuleSpecifiers(bytes.toString("utf8"), current)) {
      const resolvedPath = resolveRelativeModule(repositoryRoot, current, specifier);
      if (!resolvedPath) {
        missingEdges.push({ from: current, specifier });
        continue;
      }
      edges.push({ from: current, specifier, resolvedPath });
      if (!visited.has(resolvedPath)) queue.push(resolvedPath);
    }
  }
  return {
    files: [...visited].sort(),
    importEdges: edges.sort((a, b) => `${a.from}\0${a.specifier}`.localeCompare(`${b.from}\0${b.specifier}`)),
    missingEdges
  };
}

export function dependencyClosureSha256(files) {
  const text = [...files]
    .sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0)
    .map((file) => `${file.mode} ${file.sha256} ${file.byteLength} ${file.path}\n`)
    .join("");
  return sha256(Buffer.from(text, "utf8"));
}

export function buildDependencyClosure({ repositoryRoot = DEFAULT_REPOSITORY_ROOT, entrypoints, declaredArtifacts, lockfiles, describeFile, readFile }) {
  const graph = collectEsmImportGraph(repositoryRoot, entrypoints);
  const allPaths = [...new Set([...graph.files, ...declaredArtifacts.map(normalizeRepositoryPath), ...lockfiles.map(normalizeRepositoryPath)])].sort();
  const files = allPaths.map((relativePath) => {
    const description = describeFile(relativePath);
    if (!description?.role || !description?.sourceDisposition || !description?.sourceReferenceSha256) {
      throw new Error(`Missing dependency metadata for ${relativePath}`);
    }
    const { bytes, mode } = readFile ? readFile(relativePath, description) : readRepositoryBytes(repositoryRoot, relativePath);
    return { path: relativePath, mode, sha256: sha256(bytes), byteLength: bytes.length, ...description };
  });
  return {
    algorithm: "esm_relative_import_graph_plus_declared_artifacts_v1",
    entrypoints: [...new Set(entrypoints.map(normalizeRepositoryPath))].sort(),
    files,
    importEdges: graph.importEdges,
    declaredArtifacts: [...new Set(declaredArtifacts.map(normalizeRepositoryPath))].sort(),
    lockfiles: [...new Set(lockfiles.map(normalizeRepositoryPath))].sort(),
    missingEdges: graph.missingEdges,
    undeclaredReads: [],
    unexpectedFiles: [],
    closureSha256: dependencyClosureSha256(files)
  };
}

export function ensureEmptyDirectory(directory) {
  if (fs.existsSync(directory) && fs.readdirSync(directory).length > 0) {
    throw new Error("T04_OUTPUT_IMMUTABILITY_FAILED: output directory must be empty.");
  }
  fs.mkdirSync(directory, { recursive: true });
}

export function runCaptured(command, args, { cwd, env = process.env, maxBuffer = 128 * 1024 * 1024 } = {}) {
  const result = spawnSync(command, args, { cwd, env, encoding: null, maxBuffer });
  return {
    command,
    args: [...args],
    cwd,
    exitCode: result.status ?? 1,
    signal: result.signal ?? null,
    stdout: Buffer.from(result.stdout ?? ""),
    stderr: Buffer.from(result.stderr ?? ""),
    error: result.error ?? null
  };
}

export function requireSuccessful(result, failureCode, description) {
  if (result.exitCode !== 0 || result.signal || result.error) {
    const detail = result.error?.message || result.stderr.toString("utf8") || result.stdout.toString("utf8");
    throw new Error(`${failureCode}: ${description}: ${detail}`);
  }
  return result;
}

export function gitStatusBytes(repositoryRoot) {
  return requireSuccessful(
    runCaptured("git", ["status", "--porcelain=v2", "-z", "--untracked-files=all"], { cwd: repositoryRoot }),
    "T04_ISOLATION_BOUNDARY_FAILED",
    "cannot read main worktree status"
  ).stdout;
}

function copyDependencyFile(sourceRoot, snapshotRoot, file) {
  const source = readRepositoryBytes(sourceRoot, file.path);
  if (sha256(source.bytes) !== file.sha256 || source.bytes.length !== file.byteLength || source.mode !== file.mode) {
    throw new Error(`T04_DEPENDENCY_CLOSURE_INVALID: dependency changed before snapshot: ${file.path}`);
  }
  const target = path.resolve(snapshotRoot, ...file.path.split("/"));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  if (file.mode === "120000") {
    if (fs.existsSync(target)) fs.rmSync(target, { force: true });
    fs.symlinkSync(source.bytes.toString("utf8"), target);
  } else {
    fs.writeFileSync(target, source.bytes);
    fs.chmodSync(target, file.mode === "100755" ? 0o755 : 0o644);
  }
}

export function gitTreeIndex(repositoryRoot, commit) {
  const listing = requireSuccessful(
    runCaptured("git", ["ls-tree", "-rz", "--full-tree", "-r", commit], { cwd: repositoryRoot }),
    "T04_ISOLATION_BOUNDARY_FAILED",
    "cannot enumerate acceptance tree"
  ).stdout.toString("utf8");
  const parsed = [];
  for (const record of listing.split("\0").filter(Boolean)) {
    const match = /^(\d{6})\s+(blob|commit)\s+([0-9a-f]{40})\t(.+)$/.exec(record);
    if (!match) throw new Error(`T04_ISOLATION_BOUNDARY_FAILED: malformed git tree record: ${record}`);
    parsed.push({ mode: match[1], type: match[2], objectId: match[3], path: match[4] });
  }
  const objectIds = [...new Set(parsed.map((entry) => entry.objectId))];
  // Use one batch stream to avoid spawning one process per blob.
  const archive = spawnSync("git", ["cat-file", "--batch"], {
    cwd: repositoryRoot,
    input: Buffer.from(`${objectIds.join("\n")}\n`, "utf8"),
    encoding: null,
    maxBuffer: 512 * 1024 * 1024
  });
  if ((archive.status ?? 1) !== 0 || archive.signal || archive.error) {
    throw new Error(`T04_ISOLATION_BOUNDARY_FAILED: Git batch object read failed: ${archive.stderr?.toString("utf8") ?? archive.error?.message ?? "unknown"}`);
  }
  const objectBytes = new Map();
  let offset = 0;
  for (const objectId of objectIds) {
    const lineEnd = archive.stdout.indexOf(0x0a, offset);
    if (lineEnd < 0) throw new Error("T04_ISOLATION_BOUNDARY_FAILED: truncated Git batch header.");
    const [actualId, , rawSize] = archive.stdout.subarray(offset, lineEnd).toString("utf8").split(" ");
    const size = Number(rawSize);
    if (actualId !== objectId || !Number.isInteger(size) || size < 0) throw new Error("T04_ISOLATION_BOUNDARY_FAILED: malformed Git batch object.");
    const start = lineEnd + 1;
    const end = start + size;
    objectBytes.set(objectId, archive.stdout.subarray(start, end));
    offset = end + 1;
  }
  const entries = parsed.map((entry) => {
    const bytes = objectBytes.get(entry.objectId);
    return { ...entry, sha256: sha256(bytes), byteLength: bytes.length };
  });
  entries.sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
  const pathIndexBytes = Buffer.from(entries.map((entry) => `${entry.path}\n`).join(""), "utf8");
  const treeBytes = Buffer.from(entries.map((entry) => `${entry.mode} ${entry.sha256} ${entry.byteLength} ${entry.path}\n`).join(""), "utf8");
  return { entries, pathIndexBytes, treeSha256: sha256(treeBytes) };
}

export function buildFileIndex(rootPath, relativeRoot) {
  const cleanRoot = normalizeRepositoryPath(relativeRoot);
  const absoluteRoot = path.resolve(rootPath, ...cleanRoot.split("/"));
  if (!fs.existsSync(absoluteRoot)) throw new Error(`T04_ENVIRONMENT_NOT_REPRODUCIBLE: build root is missing: ${cleanRoot}`);
  const files = [];
  const visit = (directory) => {
    for (const item of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const absolute = path.join(directory, item.name);
      if (item.isDirectory()) visit(absolute);
      else {
        const relative = path.relative(rootPath, absolute).replaceAll(path.sep, "/");
        const stat = fs.lstatSync(absolute);
        const bytes = stat.isSymbolicLink() ? Buffer.from(fs.readlinkSync(absolute), "utf8") : fs.readFileSync(absolute);
        files.push({ path: relative, mode: modeForStat(stat), sha256: sha256(bytes), byteLength: bytes.length });
      }
    }
  };
  visit(absoluteRoot);
  files.sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
  return {
    algorithm: "recursive_raw_bytes_path_sorted_v1",
    root: cleanRoot,
    files,
    contentSha256: sha256(Buffer.from(files.map((file) => `${file.mode} ${file.sha256} ${file.byteLength} ${file.path}\n`).join(""), "utf8"))
  };
}

export function createAcceptanceSnapshot({ repositoryRoot = DEFAULT_REPOSITORY_ROOT, baseCommit, closure, snapshotRoot, bundlePath }) {
  if (fs.existsSync(snapshotRoot)) fs.rmSync(snapshotRoot, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(snapshotRoot), { recursive: true });
  requireSuccessful(
    runCaptured("git", ["worktree", "add", "--detach", snapshotRoot, baseCommit], { cwd: repositoryRoot }),
    "T04_ISOLATION_BOUNDARY_FAILED",
    "cannot create detached snapshot worktree"
  );
  const overlays = closure.files.filter((file) => file.sourceDisposition !== "product_base_commit");
  for (const file of overlays) copyDependencyFile(repositoryRoot, snapshotRoot, file);
  if (overlays.length) {
    requireSuccessful(
      runCaptured("git", ["add", "-f", "--", ...overlays.map((file) => file.path)], { cwd: snapshotRoot }),
      "T04_ISOLATION_BOUNDARY_FAILED",
      "cannot stage acceptance overlay"
    );
  }
  requireSuccessful(
    runCaptured("git", ["-c", "user.name=Navia T04", "-c", "user.email=t04@navia.local", "commit", "--allow-empty", "-m", "T04 isolated acceptance snapshot"], { cwd: snapshotRoot }),
    "T04_ISOLATION_BOUNDARY_FAILED",
    "cannot create local acceptance commit"
  );
  const acceptanceCommit = requireSuccessful(
    runCaptured("git", ["rev-parse", "HEAD"], { cwd: snapshotRoot }),
    "T04_ISOLATION_BOUNDARY_FAILED",
    "cannot resolve acceptance commit"
  ).stdout.toString("utf8").trim();
  fs.mkdirSync(path.dirname(bundlePath), { recursive: true });
  requireSuccessful(
    runCaptured("git", ["bundle", "create", bundlePath, "HEAD"], { cwd: snapshotRoot }),
    "T04_ISOLATION_BOUNDARY_FAILED",
    "cannot create snapshot bundle"
  );
  const importRoot = fs.mkdtempSync(path.join(os.tmpdir(), "navia-t04-bundle-import-"));
  try {
    requireSuccessful(runCaptured("git", ["init", "--bare", importRoot], { cwd: repositoryRoot }), "T04_ISOLATION_BOUNDARY_FAILED", "cannot create empty bundle verifier repository");
    requireSuccessful(runCaptured("git", ["fetch", bundlePath, "HEAD:refs/heads/t04-acceptance"], { cwd: importRoot }), "T04_ISOLATION_BOUNDARY_FAILED", "snapshot bundle is not importable");
    const importedCommit = requireSuccessful(runCaptured("git", ["rev-parse", "refs/heads/t04-acceptance"], { cwd: importRoot }), "T04_ISOLATION_BOUNDARY_FAILED", "imported commit is unreadable").stdout.toString("utf8").trim();
    if (importedCommit !== acceptanceCommit) throw new Error("T04_ISOLATION_BOUNDARY_FAILED: imported bundle commit mismatch.");
  } finally {
    fs.rmSync(importRoot, { recursive: true, force: true });
  }
  return { acceptanceCommit, overlays: overlays.map((file) => file.path), ...gitTreeIndex(snapshotRoot, acceptanceCommit) };
}
