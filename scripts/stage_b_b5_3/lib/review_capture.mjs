// The B-6 review capture adapter (acceptance harness only).
//
// It is READ ONLY against the product. It never writes into the product, it
// never re-generates evidence, it never searches a directory for a file and
// it never mutates the Runtime or the task store.
//
// The capture happens AFTER the durable V2.1 publication has been validated
// and BEFORE the runner owner cleanup, so the captured evidence is provably
// the evidence the machine gate saw.
//
// THE FILESYSTEM TRANSACTION:
//
//   1. the capture root is an EXPLICIT, CANONICAL, OUTSIDE-REPOSITORY 0700
//      directory: every component is lstat'ed, a symlink is refused and the
//      realpath must not lie inside the repository;
//   2. the final directory MUST NOT exist: an existing destination is never
//      overwritten;
//   3. the payload is written into an EXCLUSIVE sibling staging directory,
//      every file is fsync'ed and every directory is fsync'ed;
//   4. the STAGING bundle is re-read and re-validated;
//   5. the staging directory is RENAMED ONCE onto the final directory;
//   6. a failure removes ONLY the owned staging directory.
//
// The PUBLIC receipt it returns carries the bundle hash, the review binding,
// the counts, the status and the stable failure codes ONLY: never a text,
// never an image byte, never a file name and never a private path.

import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";

import { sha256Hex } from "./v21_artifact.mjs";
import {
  REVIEW_BUNDLE_SCHEMA,
  REVIEW_BUNDLE_FILES,
  REVIEW_BUNDLE_MANIFEST,
  REVIEW_BUNDLE_PATH_GRAMMAR,
  REVIEW_BUNDLE_THUMBNAIL_DIR,
  SEEK_MAP_SCHEMA,
  deriveCaptureReceipt,
  encodeBundleFiles,
  encodeManifestText,
  evidenceCatalogSha256,
  isStrictPng,
  normalizeEvidenceText,
  validateReviewBundle,
} from "./review_bundle.mjs";

/** The capture receipt's schema version. */
export const CAPTURE_RECEIPT_SCHEMA = "v3-5.10-b6-capture-receipt/v1";

/** The stable capture failure codes. */
export const CAPTURE_FAILURE = Object.freeze({
  WORKSPACE: "B6_CAPTURE_WORKSPACE_UNAVAILABLE",
  EVIDENCE: "B6_CAPTURE_EVIDENCE_UNAVAILABLE",
  THUMBNAIL: "B6_CAPTURE_THUMBNAIL_UNAVAILABLE",
  SEEK: "B6_CAPTURE_SEEK_UNCLOSED",
  WRITE: "B6_CAPTURE_WRITE_FAILED",
  READ: "B6_CAPTURE_BUNDLE_UNREADABLE",
  VALIDATION: "B6_CAPTURE_BUNDLE_INVALID",
  ROOT: "B6_CAPTURE_ROOT_INVALID",
  DESTINATION: "B6_CAPTURE_DESTINATION_EXISTS",
  CONTAINMENT: "B6_CAPTURE_CONTAINMENT_VIOLATION",
  UNEXPECTED_FILE: "B6_CAPTURE_UNEXPECTED_FILE",
});

/** The interruption points of the transaction. They are a TEST seam only. */
export const CAPTURE_INTERRUPT_POINTS = Object.freeze([
  "after_payload_write",
  "after_manifest_write",
  "after_validation",
  "before_rename",
]);

const here = path.dirname(fileURLToPath(import.meta.url));
/** The repository root: the capture root may NEVER live inside it. */
export const REPO_ROOT = path.resolve(here, "../../..");

function lstatOrNull(target) {
  try {
    return fs.lstatSync(target);
  } catch {
    return null;
  }
}

/** TRUE when any existing component of an absolute path is a symlink. */
function hasSymlinkComponent(target) {
  const absolute = path.resolve(target);
  const parsed = path.parse(absolute);
  let cursor = parsed.root;
  const relative = absolute.slice(parsed.root.length);
  for (const part of relative.split(path.sep).filter(Boolean)) {
    cursor = path.join(cursor, part);
    const stat = lstatOrNull(cursor);
    if (stat?.isSymbolicLink()) return true;
  }
  return false;
}

/**
 * Resolve a RELATIVE ref inside the owned private root.
 *
 * The ref comes from the workspace metadata. The resolution is EXACT, it may
 * never escape the root and it may never traverse a SYMLINK. There is no
 * directory search.
 *
 * This is the LEXICAL resolution plus a symlink rejection. It is NOT the
 * containment proof: use `resolvePrivateFile` when a file is actually read.
 */
export function resolvePrivateRef(privateRoot, relativeRef) {
  if (typeof relativeRef !== "string" || !relativeRef.trim()) return null;
  if (path.isAbsolute(relativeRef)) return null;
  const normalized = relativeRef.split("/").filter((part) => part.length > 0);
  if (normalized.length === 0) return null;
  if (normalized.some((part) => part === ".." || part === ".")) return null;
  const root = path.resolve(privateRoot);
  const target = path.resolve(root, ...normalized);
  if (target === root || !target.startsWith(`${root}${path.sep}`)) return null;
  // A SYMLINK anywhere on the path is refused: the resolution may never
  // leave the root through a link.
  let cursor = root;
  for (const part of normalized) {
    cursor = path.join(cursor, part);
    const stat = lstatOrNull(cursor);
    if (stat && stat.isSymbolicLink()) return null;
  }
  return target;
}

/**
 * The STRICT resolution of a private file.
 *
 * It proves the containment: every component of the root and of the target
 * is lstat'ed (a symlink is refused), the target must be a REGULAR file and
 * its realpath must lie inside the realpath of the root.
 *
 * @returns {string|null} the absolute path, or null when the containment
 *   cannot be proven.
 */
export function resolvePrivateFile(privateRoot, relativeRef) {
  if (hasSymlinkComponent(privateRoot)) return null;
  const lexical = resolvePrivateRef(privateRoot, relativeRef);
  if (!lexical) return null;
  const rootStat = lstatOrNull(path.resolve(privateRoot));
  if (!rootStat || !rootStat.isDirectory() || rootStat.isSymbolicLink()) return null;
  const targetStat = lstatOrNull(lexical);
  if (!targetStat || !targetStat.isFile() || targetStat.isSymbolicLink()) return null;
  let realRoot;
  let realTarget;
  try {
    realRoot = fs.realpathSync(path.resolve(privateRoot));
    realTarget = fs.realpathSync(lexical);
  } catch {
    return null;
  }
  if (realTarget !== realRoot && !realTarget.startsWith(`${realRoot}${path.sep}`)) return null;
  return lexical;
}

/**
 * The CONTAINED capture root.
 *
 * The root must be an absolute, existing, canonical directory outside the
 * repository and it may not be accessible by the group or by others.
 *
 * @returns {{ok: boolean, path: string|null, code: string|null, detail: string|null}}
 */
export function resolveCaptureRoot(privateRootDirectory, { repoRoot = REPO_ROOT } = {}) {
  const refuse = (detail) => ({ ok: false, path: null, code: CAPTURE_FAILURE.ROOT, detail });
  if (typeof privateRootDirectory !== "string" || !privateRootDirectory) {
    return refuse("the private root must be an explicit absolute path");
  }
  if (!path.isAbsolute(privateRootDirectory)) {
    return refuse("the private root must be an absolute path");
  }
  if (hasSymlinkComponent(privateRootDirectory)) {
    return refuse("the private root has a symbolic-link component");
  }
  const stat = lstatOrNull(privateRootDirectory);
  if (stat && stat.isSymbolicLink()) {
    return refuse("the private root is a symbolic link");
  }
  if (!stat || !stat.isDirectory()) {
    return refuse("the private root does not exist or is not a directory");
  }
  let realRoot;
  let realRepo;
  try {
    realRoot = fs.realpathSync(privateRootDirectory);
    realRepo = fs.realpathSync(repoRoot);
  } catch {
    return refuse("the private root could not be canonicalized");
  }
  if (realRoot === realRepo || realRoot.startsWith(`${realRepo}${path.sep}`)) {
    return refuse("the private root is inside the repository");
  }
  if ((stat.mode & 0o077) !== 0) {
    return refuse("the private root is accessible by the group or by others");
  }
  return { ok: true, path: realRoot, code: null, detail: null };
}

/**
 * The seek map of a source.
 *
 * It is derived from the FROZEN derivative chapters and the captured
 * evidence. EVERY derivative chapter maps to EXACTLY ONE seek row that
 * repeats the chapter id, order, window and evidence set, and the row
 * carries a REAL PNG-backed frame of the same task:
 *
 *   1. a CITED frame whose window lies inside the chapter window;
 *   2. otherwise the NEAREST captured frame (the one that intersects the
 *      chapter window, or the closest one to the chapter start);
 *   3. otherwise the capture FAILS: a chapter without a PNG-backed frame is
 *      never reviewable.
 *
 * @returns {{ok: boolean, seekMap: object|null, code: string|null, detail: string|null}}
 */
export function buildSeekMap({ derivative, evidence, thumbnails, mediaDurationMs }) {
  const records = evidence ?? [];
  const byId = new Map(records.map((item) => [String(item.evidenceId), item]));
  const pngFrames = new Set(
    (thumbnails ?? []).map((item) => String(item.evidenceId)),
  );
  const frames = records
    .filter((item) => item?.kind === "frame" && pngFrames.has(String(item.evidenceId)))
    .sort((left, right) => String(left.evidenceId).localeCompare(String(right.evidenceId)));
  const duration = Number(mediaDurationMs);
  const chapters = [];
  for (const chapter of derivative?.chapters ?? []) {
    const cited = (chapter.evidenceIds ?? []).map(String);
    const inside = cited.find((evidenceId) => {
      const record = byId.get(evidenceId);
      if (!record || record.kind !== "frame" || !pngFrames.has(evidenceId)) return false;
      return Number(record.timestampStartMs) >= Number(chapter.startMs)
        && Number(record.timestampStartMs) < Number(chapter.endMs);
    });
    let representative = inside ?? null;
    if (!representative) {
      // The NEAREST captured frame: the intersecting one, or the closest one
      // to the chapter start. The order is deterministic.
      const distance = (record) => {
        const start = Number(record.timestampStartMs);
        const end = Number(record.timestampEndMs);
        if (start < Number(chapter.endMs) && end > Number(chapter.startMs)) return 0;
        if (start >= Number(chapter.endMs)) return start - Number(chapter.endMs);
        return Number(chapter.startMs) - end;
      };
      const nearest = [...frames].sort((left, right) => (
        distance(left) - distance(right)
        || String(left.evidenceId).localeCompare(String(right.evidenceId))
      ))[0];
      representative = nearest ? String(nearest.evidenceId) : null;
    }
    if (!representative) {
      return {
        ok: false,
        seekMap: null,
        code: CAPTURE_FAILURE.SEEK,
        detail: `the chapter ${String(chapter.chapterId)} has no PNG-backed frame of the task`,
      };
    }
    chapters.push({
      chapterId: chapter.chapterId ?? null,
      order: chapter.order ?? null,
      startMs: chapter.startMs ?? null,
      endMs: chapter.endMs ?? null,
      evidenceIds: cited,
      representativeFrameEvidenceId: representative,
      // The executable seek time lies INSIDE [startMs, endMs).
      seekTimeMs: Number(chapter.startMs),
    });
  }
  return {
    ok: true,
    seekMap: {
      schemaVersion: SEEK_MAP_SCHEMA,
      mediaDurationMs: Number.isFinite(duration) ? duration : null,
      chapters,
    },
    code: null,
    detail: null,
  };
}

/**
 * Write a file and fsync it. The file is created EXCLUSIVELY.
 */
function writeExclusive(target, bytes, mode = 0o600) {
  const handle = fs.openSync(target, "wx", mode);
  try {
    fs.writeFileSync(handle, bytes);
    fs.fsyncSync(handle);
  } finally {
    fs.closeSync(handle);
  }
}

/**
 * fsync a directory where the platform supports it.
 */
function syncDirectory(directory) {
  try {
    const handle = fs.openSync(directory, "r");
    try {
      fs.fsyncSync(handle);
    } finally {
      fs.closeSync(handle);
    }
  } catch {
    // The platform does not support the directory fsync: the rename is still
    // atomic, the durability guarantee is weaker and it is reported.
  }
}

/**
 * The workspace projection WITHOUT the Provider identity.
 *
 * The `authorization` block carries the provider id, the model id and the
 * outbound digest. The reviewer may not see them: the private bundle keeps
 * only the irreversible review binding of the published receipt.
 */
export function sanitizeWorkspace(workspace) {
  if (!workspace || typeof workspace !== "object") return workspace ?? null;
  const { authorization, ...rest } = workspace;
  return rest;
}

/**
 * Capture ONE private review bundle.
 *
 * @param {object} input
 * @param {object} input.source the frozen identity of the source
 * @param {Buffer} input.artifactBytes the exact durable V2.1 derivative bytes
 * @param {object} input.workspace the public workspace projection
 * @param {(relativeRef: string) => Promise<object>} input.readDerivedText reads the private derived-text metadata
 * @param {(evidenceId: string) => Promise<Buffer>} input.fetchThumbnail reads the PNG through the AUTHENTICATED product route
 * @param {string} input.privateRootDirectory the PRIVATE root the bundle is written into
 * @param {string|null} input.interruptAt a TEST seam: a simulated interruption point
 */
export async function captureReviewBundle({
  source,
  artifactBytes,
  workspace,
  readDerivedText,
  fetchThumbnail,
  privateRootDirectory,
  interruptAt = null,
}) {
  const fail = (code, detail, diagnosticCodes = [code]) => ({
    ok: false,
    code,
    detail,
    diagnosticCodes: [...new Set(diagnosticCodes.filter((value) => typeof value === "string" && value))].sort(),
    bundle: null,
    receipt: null,
  });

  // 0. The CONTAINED capture root.
  const root = resolveCaptureRoot(privateRootDirectory);
  if (!root.ok) {
    return fail(root.code, root.detail);
  }

  // 1. The workspace metadata: the public task facts and the evidence
  //    catalog with the relative refs.
  const workspaceTask = workspace?.task ?? null;
  const catalog = Array.isArray(workspace?.evidenceCatalog) ? workspace.evidenceCatalog : null;
  if (!workspaceTask || !catalog) {
    return fail(CAPTURE_FAILURE.WORKSPACE, "the workspace projection has no task facts or no evidence catalog");
  }
  if (workspaceTask.taskId !== source.taskId || workspaceTask.sourceIdentity !== source.sourceIdentity) {
    return fail(CAPTURE_FAILURE.WORKSPACE, "the workspace projection describes another task");
  }

  // 2. The derived text: read EXACTLY by the relative ref the workspace
  //    declares, from the runner-owned private root.
  const evidence = [];
  for (const item of catalog) {
    const metadata = await readDerivedText(item.relativeArtifactRef);
    if (!metadata || typeof metadata.text !== "string" || !metadata.text) {
      return fail(CAPTURE_FAILURE.EVIDENCE, `the derived text of ${String(item.evidenceId)} is unavailable`);
    }
    const textHash = sha256Hex(Buffer.from(normalizeEvidenceText(metadata.text), "utf8"));
    if (textHash !== item.contentSha256) {
      return fail(CAPTURE_FAILURE.EVIDENCE, `the derived text of ${String(item.evidenceId)} does not match its digest`);
    }
    evidence.push({
      evidenceId: item.evidenceId,
      taskId: item.taskId ?? source.taskId,
      kind: item.kind,
      timestampStartMs: item.timestampStartMs,
      timestampEndMs: item.timestampEndMs,
      contentSha256: item.contentSha256,
      text: metadata.text,
      thumbnailAvailable: Boolean(metadata.thumbnailRelativeRef),
    });
  }

  // 3. The thumbnails: ONLY through the authenticated product route.
  const thumbnails = [];
  for (const item of evidence) {
    if (!item.thumbnailAvailable) continue;
    const bytes = await fetchThumbnail(item.evidenceId);
    if (!isStrictPng(bytes)) {
      return fail(CAPTURE_FAILURE.THUMBNAIL, `the thumbnail of ${String(item.evidenceId)} is not a PNG`);
    }
    thumbnails.push({ evidenceId: item.evidenceId, sha256: sha256Hex(bytes), bytes });
  }

  // 4. The seek map: ONE row per derivative chapter, with a real frame.
  let derivative = null;
  try {
    derivative = JSON.parse(artifactBytes.toString("utf8"));
  } catch (error) {
    return fail(CAPTURE_FAILURE.VALIDATION, `the durable derivative is not JSON: ${String(error?.message ?? error).slice(0, 120)}`);
  }
  const seek = buildSeekMap({
    derivative,
    evidence,
    thumbnails,
    mediaDurationMs: workspaceTask.mediaDurationMs ?? derivative?.binding?.mediaDurationMs ?? null,
  });
  if (!seek.ok) {
    return fail(seek.code, seek.detail);
  }
  const seekMap = seek.seekMap;

  // 5. The bundle and the DERIVED capture receipt.
  const sanitizedWorkspace = sanitizeWorkspace(workspace);
  const bundle = {
    schemaVersion: REVIEW_BUNDLE_SCHEMA,
    source,
    artifact: artifactBytes,
    workspace: sanitizedWorkspace,
    evidence,
    thumbnails,
    seekMap,
    captureReceipt: deriveCaptureReceipt({
      source,
      artifact: artifactBytes,
      workspace: sanitizedWorkspace,
      evidence,
      thumbnails,
      seekMap,
    }),
    manifest: [],
  };
  const files = encodeBundleFiles(bundle);
  bundle.manifest = [...files.entries()].map(([name, bytes]) => ({
    path: name,
    sha256: sha256Hex(bytes),
    bytes,
  }));
  const manifestText = encodeManifestText(files);

  // 6. Validate BEFORE writing.
  const verdict = validateReviewBundle(bundle);
  if (!verdict.ok) {
    return fail(
      CAPTURE_FAILURE.VALIDATION,
      verdict.failures.map((failure) => `${failure.code}: ${failure.detail}`).join("; ").slice(0, 400),
      verdict.failures.map((failure) => failure.code),
    );
  }

  // 7. The TRANSACTION: an exclusive staging directory, a validated
  //    re-read and ONE atomic rename.
  const directoryName = `${source.order}-${source.bvid}`;
  const finalDirectory = path.join(root.path, directoryName);
  if (lstatOrNull(finalDirectory)) {
    return fail(CAPTURE_FAILURE.DESTINATION, `the destination ${directoryName} already exists`);
  }
  const staging = path.join(
    root.path,
    `.staging-${directoryName}-${process.pid}-${randomBytes(6).toString("hex")}`,
  );
  let stagingOwned = false;
  let stagedValidationFailure = null;
  try {
    // The staging directory is created EXCLUSIVELY: an existing name is a
    // refusal, never a reuse.
    fs.mkdirSync(staging, { mode: 0o700 });
    stagingOwned = true;
    fs.chmodSync(staging, 0o700);
    const thumbnailDirectory = path.join(staging, REVIEW_BUNDLE_THUMBNAIL_DIR);
    fs.mkdirSync(thumbnailDirectory, { mode: 0o700 });
    fs.chmodSync(thumbnailDirectory, 0o700);
    for (const item of thumbnails) {
      writeExclusive(path.join(thumbnailDirectory, `${item.evidenceId}.png`), item.bytes);
    }
    for (const [name, bytes] of files) {
      if (name.startsWith(`${REVIEW_BUNDLE_THUMBNAIL_DIR}/`)) continue;
      writeExclusive(path.join(staging, name), bytes);
    }
    syncDirectory(thumbnailDirectory);
    syncDirectory(staging);
    if (interruptAt === "after_payload_write") {
      throw new Error(`the simulated interruption at ${interruptAt}`);
    }

    writeExclusive(path.join(staging, REVIEW_BUNDLE_MANIFEST), Buffer.from(manifestText, "utf8"));
    syncDirectory(staging);
    if (interruptAt === "after_manifest_write") {
      throw new Error(`the simulated interruption at ${interruptAt}`);
    }

    // The STAGING bundle is re-read and re-validated before it is published.
    const staged = readReviewBundle(staging);
    const stagedVerdict = validateReviewBundle(staged);
    if (!stagedVerdict.ok) {
      stagedValidationFailure = stagedVerdict.failures.map((failure) => failure.code);
      throw new Error("the staged bundle did not validate");
    }
    if (interruptAt === "after_validation") {
      throw new Error(`the simulated interruption at ${interruptAt}`);
    }
    if (interruptAt === "before_rename") {
      throw new Error(`the simulated interruption at ${interruptAt}`);
    }

    // The destination is checked AGAIN: it must still not exist.
    if (lstatOrNull(finalDirectory)) {
      return fail(CAPTURE_FAILURE.DESTINATION, `the destination ${directoryName} already exists`);
    }
    fs.renameSync(staging, finalDirectory);
    stagingOwned = false;
    syncDirectory(root.path);
  } catch (error) {
    if (stagingOwned) {
      // ONLY the OWNED staging directory is removed.
      try {
        fs.rmSync(staging, { recursive: true, force: true });
      } catch {
        // The cleanup of the owned staging directory failed: the failure is
        // reported with the original error.
      }
    }
    if (stagedValidationFailure) {
      return fail(
        CAPTURE_FAILURE.VALIDATION,
        `the staged bundle does not validate: ${stagedValidationFailure.join(", ")}`,
        stagedValidationFailure,
      );
    }
    return fail(CAPTURE_FAILURE.WRITE, `the private bundle could not be published: ${String(error?.message ?? error).slice(0, 200)}`);
  }

  // 8. Re-read the published bundle and validate it once more.
  const reread = readReviewBundle(finalDirectory);
  const secondVerdict = validateReviewBundle(reread);
  if (!secondVerdict.ok) {
    return fail(
      CAPTURE_FAILURE.VALIDATION,
      `the published bundle does not validate: ${secondVerdict.failures.map((failure) => failure.code).join(", ")}`,
      secondVerdict.failures.map((failure) => failure.code),
    );
  }
  return {
    ok: true,
    code: null,
    detail: null,
    diagnosticCodes: [],
    bundle: reread,
    receipt: reread.captureReceipt,
  };
}

/**
 * Capture a bundle against the RUNNING product.
 *
 * The workspace metadata comes from the PUBLIC workspace route and the PNG
 * from the AUTHENTICATED thumbnail route. The derived text is read from the
 * runner-owned Runtime private root, EXACTLY by the relative ref the
 * workspace declares, through the STRICT containment proof.
 */
export async function captureFromRuntime({
  runtimePort,
  companionHeaders,
  taskId,
  artifactBytes,
  source,
  privateEvidenceRoot,
  privateRootDirectory,
  interruptAt = null,
}) {
  const fail = (code, detail) => ({
    ok: false,
    code,
    detail,
    diagnosticCodes: [code],
    bundle: null,
    receipt: null,
  });
  let workspace = null;
  try {
    const response = await fetch(
      `http://127.0.0.1:${runtimePort}/v1/media/tasks/${taskId}/comprehension`,
      { headers: companionHeaders },
    );
    if (!response.ok) {
      return fail(CAPTURE_FAILURE.WORKSPACE, `the workspace route answered ${response.status}`);
    }
    const payload = await response.json().catch(() => null);
    workspace = payload?.data?.projection ?? null;
  } catch (error) {
    return fail(CAPTURE_FAILURE.WORKSPACE, `the workspace route failed: ${String(error?.message ?? error).slice(0, 160)}`);
  }
  if (!workspace) {
    return fail(CAPTURE_FAILURE.WORKSPACE, "the workspace route returned no projection");
  }
  const readDerivedText = async (relativeRef) => {
    const target = resolvePrivateFile(privateEvidenceRoot, relativeRef);
    if (!target) return null;
    try {
      return JSON.parse(fs.readFileSync(target, "utf8"));
    } catch {
      return null;
    }
  };
  const fetchThumbnail = async (evidenceId) => {
    try {
      const response = await fetch(
        `http://127.0.0.1:${runtimePort}/v1/media/tasks/${taskId}/evidence/${evidenceId}/thumbnail`,
        { headers: companionHeaders },
      );
      if (!response.ok) return null;
      return Buffer.from(await response.arrayBuffer());
    } catch {
      return null;
    }
  };
  return captureReviewBundle({
    source,
    artifactBytes,
    workspace,
    readDerivedText,
    fetchThumbnail,
    privateRootDirectory,
    interruptAt,
  });
}

/**
 * Read a written private bundle back.
 *
 * The file names are the CONTRACTED ones: there is no directory search and
 * no ambiguity. The manifest path grammar is validated BEFORE any file is
 * opened, a symlinked payload is refused and a non-regular payload is
 * refused.
 */
export function readReviewBundle(directory) {
  if (hasSymlinkComponent(directory)) {
    throw new Error("the private bundle directory has a symbolic-link component");
  }
  const rootStat = lstatOrNull(directory);
  if (!rootStat || !rootStat.isDirectory() || rootStat.isSymbolicLink()) {
    throw new Error(`the private bundle directory is not a directory: ${String(directory)}`);
  }
  const manifestPath = path.join(directory, REVIEW_BUNDLE_MANIFEST);
  const manifestStat = lstatOrNull(manifestPath);
  if (!manifestStat || !manifestStat.isFile() || manifestStat.isSymbolicLink()) {
    throw new Error(`the private bundle has no readable manifest`);
  }
  const manifestText = fs.readFileSync(manifestPath, "utf8");
  const manifest = [];
  const declared = new Set();
  for (const line of manifestText.split("\n")) {
    if (!line.trim()) continue;
    const match = /^([0-9a-f]{64})  (\S+)$/.exec(line);
    if (!match) {
      throw new Error(`the private manifest carries a malformed line`);
    }
    const [, digest, name] = match;
    // The strict grammar is checked BEFORE any file is opened.
    if (!REVIEW_BUNDLE_PATH_GRAMMAR.test(name) || name.split("/").some((part) => part === "..")) {
      throw new Error(`the private manifest carries an invalid path`);
    }
    if (declared.has(name)) {
      throw new Error(`the private manifest lists ${name} twice`);
    }
    declared.add(name);
    const target = resolvePrivateFile(directory, name);
    if (!target) {
      throw new Error(`the private manifest names an unreadable payload: ${name}`);
    }
    const bytes = fs.readFileSync(target);
    if (sha256Hex(bytes) !== digest) {
      throw new Error(`the private payload ${name} does not match its digest`);
    }
    manifest.push({ path: name, sha256: digest, bytes });
  }
  // Every declared file is one of the CONTRACTED ones.
  const thumbnailNames = new Set(
    manifest
      .map((entry) => entry.path)
      .filter((name) => name.startsWith(`${REVIEW_BUNDLE_THUMBNAIL_DIR}/`)),
  );
  for (const entry of manifest) {
    if (!REVIEW_BUNDLE_FILES.includes(entry.path) && !thumbnailNames.has(entry.path)) {
      throw new Error(`the private manifest carries the undeclared file ${entry.path}`);
    }
  }
  for (const name of REVIEW_BUNDLE_FILES) {
    if (!declared.has(name)) {
      throw new Error(`the private bundle lacks ${name}`);
    }
  }
  // No UNDECLARED payload may sit in the bundle directory.
  const present = new Set();
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (entry.name !== REVIEW_BUNDLE_THUMBNAIL_DIR) {
        throw new Error(`the private bundle carries the unexpected directory ${entry.name}`);
      }
      continue;
    }
    present.add(entry.name);
  }
  if (!present.has(REVIEW_BUNDLE_MANIFEST)) {
    throw new Error("the private bundle lacks its manifest");
  }
  for (const name of present) {
    if (name === REVIEW_BUNDLE_MANIFEST) continue;
    if (!declared.has(name)) {
      throw new Error(`the private bundle carries the undeclared file ${name}`);
    }
  }
  for (const name of declared) {
    if (name.startsWith(`${REVIEW_BUNDLE_THUMBNAIL_DIR}/`)) continue;
    if (!present.has(name)) {
      throw new Error(`the private bundle lacks ${name}`);
    }
  }
  if (thumbnailNames.size > 0) {
    const thumbnailDirectory = path.join(directory, REVIEW_BUNDLE_THUMBNAIL_DIR);
    for (const entry of fs.readdirSync(thumbnailDirectory, { withFileTypes: true })) {
      if (!entry.isFile()) {
        throw new Error(`the private bundle carries a non-regular thumbnail ${entry.name}`);
      }
      if (!declared.has(`${REVIEW_BUNDLE_THUMBNAIL_DIR}/${entry.name}`)) {
        throw new Error(`the private bundle carries the undeclared thumbnail ${entry.name}`);
      }
    }
  }

  const read = (name) => manifest.find((entry) => entry.path === name).bytes;
  const captureReceipt = JSON.parse(read("capture-receipt.json").toString("utf8"));
  const source = JSON.parse(read("source.json").toString("utf8"));
  const thumbnails = [...thumbnailNames].sort().map((name) => {
    const entry = manifest.find((item) => item.path === name);
    return {
      evidenceId: path.basename(name, ".png"),
      sha256: entry.sha256,
      bytes: entry.bytes,
    };
  });
  return {
    schemaVersion: REVIEW_BUNDLE_SCHEMA,
    source,
    artifact: read("artifact.json"),
    workspace: JSON.parse(read("workspace.json").toString("utf8")),
    evidence: read("evidence.jsonl").toString("utf8")
      .split("\n").filter((line) => line.trim()).map((line) => JSON.parse(line)),
    thumbnails,
    seekMap: JSON.parse(read("seek-map.json").toString("utf8")),
    captureReceipt,
    manifest,
    manifestBytes: Buffer.from(manifestText, "utf8"),
  };
}
