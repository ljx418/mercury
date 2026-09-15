import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

export function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

export function normalizeArtifactPath(value, { allowVirtual = false } = {}) {
  if (typeof value !== "string" || !value.trim() || value.includes("\0")) throw new Error("Artifact path is required and cannot contain NUL.");
  const posix = value.replaceAll("\\", "/");
  if (posix.startsWith("/") || /^[A-Za-z]:\//.test(posix)) throw new Error(`Artifact path must be relative: ${value}`);
  const normalized = path.posix.normalize(posix);
  if (normalized === "." || normalized === ".." || normalized.startsWith("../") || normalized.includes("/../")) throw new Error(`Artifact path escapes its root: ${value}`);
  if (!allowVirtual && (normalized === "virtual" || normalized.startsWith("virtual/"))) throw new Error(`Production artifacts cannot be virtual: ${value}`);
  return normalized;
}

function assertNoSymlink(root, relativePath) {
  let current = path.resolve(root);
  for (const part of relativePath.split("/")) {
    current = path.join(current, part);
    const stat = fs.lstatSync(current);
    if (stat.isSymbolicLink()) throw new Error(`Symlink artifacts are not accepted: ${relativePath}`);
  }
}

export function resolveArtifactPath(root, relativePath, options) {
  const absoluteRoot = path.resolve(root);
  const normalized = normalizeArtifactPath(relativePath, options);
  const absolute = path.resolve(absoluteRoot, ...normalized.split("/"));
  if (absolute !== absoluteRoot && !absolute.startsWith(`${absoluteRoot}${path.sep}`)) throw new Error(`Artifact path escapes its root: ${relativePath}`);
  assertNoSymlink(absoluteRoot, normalized);
  return { absolute, normalized };
}

export function readArtifact(root, reference, { allowVirtual = false } = {}) {
  if (!reference || !/^[a-f0-9]{64}$/.test(reference.sha256 ?? "")) throw new Error("ArtifactRef.sha256 must be lowercase SHA-256.");
  const { absolute, normalized } = resolveArtifactPath(root, reference.path, { allowVirtual });
  const bytes = fs.readFileSync(absolute);
  const actualHash = sha256(bytes);
  if (actualHash !== reference.sha256) throw new Error(`Artifact hash mismatch for ${normalized}: ${actualHash}`);
  if (reference.byteLength !== undefined && bytes.length !== reference.byteLength) throw new Error(`Artifact length mismatch for ${normalized}: ${bytes.length}`);
  return { bytes, absolutePath: absolute, reference: { ...reference, path: normalized, byteLength: bytes.length } };
}

export function artifactRefFromRecord(record, artifactRoot = "source_run") {
  return { artifactRoot, path: normalizeArtifactPath(record.path), sha256: record.sha256, byteLength: record.byteLength, mediaType: record.mediaType };
}

function git(repoRoot, args, { encoding = null } = {}) {
  const result = spawnSync("git", ["-C", path.resolve(repoRoot), ...args], { encoding, maxBuffer: 64 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`git ${args[0]} failed: ${String(result.stderr)}`);
  return result.stdout;
}

export function readGitBlob(repoRoot, commit, relativePath) {
  if (!/^[a-f0-9]{40}$/.test(commit)) throw new Error(`Invalid snapshot commit: ${commit}`);
  const normalized = normalizeArtifactPath(relativePath, { allowVirtual: true });
  return Buffer.from(git(repoRoot, ["cat-file", "blob", `${commit}:${normalized}`]));
}

export function listGitPaths(repoRoot, commit, roots) {
  if (!/^[a-f0-9]{40}$/.test(commit)) throw new Error(`Invalid snapshot commit: ${commit}`);
  if (!Array.isArray(roots) || roots.length === 0) throw new Error("At least one Git scan root is required.");
  const normalizedRoots = roots.map((root) => normalizeArtifactPath(root, { allowVirtual: true }));
  const output = git(repoRoot, ["ls-tree", "-r", "-z", "--name-only", commit, "--", ...normalizedRoots]);
  return output.toString("utf8").split("\0").filter(Boolean).sort((left, right) => left.localeCompare(right, "en"));
}

export function listGitEntries(repoRoot, commit, roots) {
  if (!/^[a-f0-9]{40}$/.test(commit)) throw new Error(`Invalid snapshot commit: ${commit}`);
  const normalizedRoots = roots.map((root) => normalizeArtifactPath(root, { allowVirtual: true }));
  const output = git(repoRoot, ["ls-tree", "-r", "-z", commit, "--", ...normalizedRoots]);
  return output.toString("utf8").split("\0").filter(Boolean).map((line) => {
    const match = /^(\d+)\s+blob\s+[a-f0-9]+\t(.+)$/.exec(line);
    if (!match) throw new Error(`Unsupported Git tree entry: ${line}`);
    return { mode: match[1], path: normalizeArtifactPath(match[2], { allowVirtual: true }) };
  }).sort((left, right) => left.path.localeCompare(right.path, "en"));
}

export function makeArtifactRef(root, relativePath, mediaType) {
  const { bytes, reference } = readArtifact(root, {
    path: relativePath,
    sha256: sha256(fs.readFileSync(resolveArtifactPath(root, relativePath).absolute)),
    mediaType
  });
  return { artifactRoot: "validation_run", path: reference.path, sha256: sha256(bytes), byteLength: bytes.length, mediaType };
}
