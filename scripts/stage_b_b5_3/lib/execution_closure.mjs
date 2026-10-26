// The EXECUTION CLOSURE of a GC-B6 candidate.
//
// ONE owner for the executed bytes of a candidate.
//
// The closure is the SET of bytes the candidate actually executes: the
// Runtime package tree, the built extension bundle, the extension source,
// the extension entrypoints and public assets, the harness and the frozen
// contracts and configuration. The third-party dependency trees are not
// copied: they are declared as TOOL BINDINGS and pinned by their identity.
//
// A candidate is prepared by MATERIALIZING the closure into an exclusive,
// repository-external snapshot. The snapshot is the EXECUTION ROOT: the
// Runtime, the extension and the child harness run its bytes, and the
// manifest is verified against the SNAPSHOT before the authorization is
// consumed, after every source and at the closeout.
//
// A missing file, an extra executed file, a symbolic link, a mutable path, a
// digest drift, an unresolved import, an absent tool identity or a broken
// tool binding invalidates the candidate.

import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

/** The execution-closure manifest schema. */
export const EXECUTION_CLOSURE_SCHEMA = "v3-5.10-b6-execution-closure/v2";

/** The stable closure defect codes. */
export const EXECUTION_CLOSURE_FAILURE = Object.freeze({
  SCHEMA: "EXECUTION_CLOSURE_SCHEMA_INVALID",
  MISSING_FILE: "EXECUTION_CLOSURE_FILE_MISSING",
  EXTRA_FILE: "EXECUTION_CLOSURE_FILE_EXTRA",
  DRIFT: "EXECUTION_CLOSURE_FILE_DRIFT",
  SYMLINK: "EXECUTION_CLOSURE_SYMLINK",
  MUTABLE: "EXECUTION_CLOSURE_MUTABLE_PATH",
  OUTSIDE: "EXECUTION_CLOSURE_PATH_OUTSIDE",
  TOOL: "EXECUTION_CLOSURE_TOOL_IDENTITY_DRIFT",
  TOOL_MISSING: "EXECUTION_CLOSURE_TOOL_IDENTITY_MISSING",
  MISSING_ROOT: "EXECUTION_CLOSURE_ROOT_MISSING",
  UNRESOLVED: "EXECUTION_CLOSURE_UNRESOLVED_IMPORT",
  TOOL_BINDING: "EXECUTION_CLOSURE_TOOL_BINDING_INVALID",
  SNAPSHOT_EXTRA: "EXECUTION_CLOSURE_SNAPSHOT_EXTRA_FILE",
});

/**
 * The EXECUTED roots of a candidate.
 *
 * Every root is an executed input: the Runtime package tree, the exact
 * built extension bytes, the extension source, the extension entrypoints and
 * public assets, and the harness.
 */
export const EXECUTION_CLOSURE_ROOTS = Object.freeze([
  { key: "runtime", relative: "services/local-runtime/navia_runtime", kind: "runtime" },
  { key: "extensionSource", relative: "apps/chrome-extension/src", kind: "extension-source" },
  { key: "extensionEntrypoints", relative: "apps/chrome-extension/entrypoints", kind: "extension-entrypoints" },
  { key: "extensionPublic", relative: "apps/chrome-extension/public", kind: "extension-public" },
  { key: "extensionBuild", relative: "apps/chrome-extension/chrome-mv3-unpacked", kind: "extension-build" },
  { key: "extensionSessionLib", relative: "apps/chrome-extension/e2e/lib/v3WpBVisibleSession", kind: "extension-session-lib" },
  { key: "harness", relative: "scripts/stage_b_b5_3", kind: "harness" },
]);

/** The executed CONTRACT and CONFIGURATION inputs (files, not trees). */
export const EXECUTION_CLOSURE_FILES = Object.freeze([
  { key: "registry", relative: "docs/active/project/evidence/v3_media_companion/v3-completion/gc-b5r-source-set-rebaseline-2026-10-24/02-stage-b-six-video-registry-v2.json", kind: "contract" },
  { key: "extensionPackage", relative: "apps/chrome-extension/package.json", kind: "config" },
  { key: "extensionLock", relative: "apps/chrome-extension/pnpm-lock.yaml", kind: "config" },
  { key: "extensionWxtConfig", relative: "apps/chrome-extension/wxt.config.ts", kind: "config" },
  { key: "extensionTsConfig", relative: "apps/chrome-extension/tsconfig.json", kind: "config" },
  { key: "extensionToolkit", relative: "apps/chrome-extension/e2e/chrome-v2-t01-r1-frontend.mjs", kind: "harness" },
  { key: "runtimePackage", relative: "services/local-runtime/navia_runtime/__init__.py", kind: "contract" },
]);

/**
 * The TOOL BINDINGS of a candidate.
 *
 * A tool binding is a third-party dependency tree that the executed bytes
 * need at RUN time. It is not copied into the snapshot: the snapshot carries
 * a BINDING (a symbolic link to the pinned tree) and the manifest carries
 * the tree's IDENTITY. A broken or unidentifiable binding fails closed.
 */
export const EXECUTION_CLOSURE_TOOL_BINDINGS = Object.freeze([
  { key: "extensionNodeModules", relative: "apps/chrome-extension/node_modules", kind: "node-modules" },
]);

/**
 * The files that are NEVER part of a closure (a machine-independent list).
 *
 * The list is a rule about the FILE KIND, never about a file name: a build
 * cache, a dependency tree, a byte-code cache and a test corpus are not
 * executed product bytes.
 */
const EXCLUDED_DIRECTORIES = new Set([
  ".git", "node_modules", "__pycache__", ".pytest_cache", ".mypy_cache",
  ".venv", "venv", "dist", "build", ".next", ".cache",
  "test", "tests", "testdata", "__tests__",
]);

/** The Python package roots: an absolute import is resolved against them. */
const PYTHON_PACKAGE_ROOTS = Object.freeze(["services/local-runtime"]);

// The JavaScript import forms. The `from` of a CALL (`Buffer.from(...)`) is
// never an import: the keyword must not be preceded by an identifier
// character or a dot.
const JS_FROM_IMPORT = /(?:^|[^\w.$])(?:import|export)\s[^'"();]*?from\s*["']([^"']+)["']/g;
const JS_BARE_IMPORT = /(?:^|[^\w.$])import\s*["']([^"']+)["']/g;
const JS_DYNAMIC_IMPORT = /(?:^|[^\w.$])import\s*\(\s*["']([^"']+)["']\s*\)/g;
const PY_FROM_IMPORT = /(?:^|\n)\s*from\s+([A-Za-z0-9_.]+)\s+import\s/g;
const PY_IMPORT = /(?:^|\n)\s*import\s+([A-Za-z0-9_.]+)/g;

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function isExcluded(relative) {
  return relative.split("/").some((part) => EXCLUDED_DIRECTORIES.has(part));
}

function walkTree(root, relative, out) {
  const absolute = path.join(root, relative);
  if (!fs.existsSync(absolute)) return;
  const stack = [absolute];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const child = path.join(current, entry.name);
      const childRelative = path.relative(root, child).split(path.sep).join("/");
      if (isExcluded(childRelative)) continue;
      if (entry.isSymbolicLink()) {
        // A symbolic link inside an executed tree is a MUTABLE PATH: it is
        // recorded and the verifier refuses it.
        out.push({ relative: childRelative, kind: "symlink" });
        continue;
      }
      if (entry.isDirectory()) {
        stack.push(child);
        continue;
      }
      if (entry.isFile()) {
        out.push({ relative: childRelative, kind: "file" });
      }
    }
  }
}

/** The JavaScript import specifiers of ONE file. */
function jsImportSpecifiers(text) {
  const specifiers = [];
  for (const pattern of [JS_FROM_IMPORT, JS_BARE_IMPORT, JS_DYNAMIC_IMPORT]) {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) specifiers.push(match[1]);
  }
  return specifiers;
}

/** The Python import specifiers of ONE file. */
function pythonImportSpecifiers(text) {
  const specifiers = [];
  for (const pattern of [PY_FROM_IMPORT, PY_IMPORT]) {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) {
      if (match[1]) specifiers.push(match[1]);
    }
  }
  return specifiers;
}

/**
 * Resolve ONE local import target.
 *
 * The resolution is MECHANICAL: a JavaScript specifier is probed against the
 * contracted extensions and the index forms, a Python specifier against the
 * module form and the package form. An absent target is UNRESOLVED: the
 * closure may never hide it.
 */
function resolveLocalTarget(root, candidates) {
  for (const candidate of candidates) {
    if (!candidate) continue;
    const absolute = path.join(root, candidate);
    if (!fs.existsSync(absolute)) continue;
    const stat = fs.lstatSync(absolute);
    if (stat.isDirectory()) {
      for (const index of ["__init__.py", "index.mjs", "index.js"]) {
        const nested = path.posix.join(candidate, index);
        if (fs.existsSync(path.join(root, nested))) return nested;
      }
      continue;
    }
    return candidate;
  }
  return null;
}

/**
 * The LOCAL imports of ONE file.
 *
 * The JavaScript and the Python imports are resolved mechanically. A bare
 * package import is NOT a local file: it belongs to the dependency identity.
 */
function localImports(relative, text, root) {
  const imports = [];
  if (relative.endsWith(".mjs") || relative.endsWith(".js")) {
    for (const specifier of jsImportSpecifiers(text)) {
      if (!specifier.startsWith(".")) continue;
      const joined = path.posix.normalize(path.posix.join(path.posix.dirname(relative), specifier));
      imports.push({
        candidates: [
          joined,
          `${joined}.mjs`,
          `${joined}.js`,
          path.posix.join(joined, "index.mjs"),
          path.posix.join(joined, "index.js"),
        ],
        label: joined,
      });
    }
    return imports;
  }
  if (relative.endsWith(".py")) {
    const packageParts = path.posix.dirname(relative).split("/");
    for (const specifier of pythonImportSpecifiers(text)) {
      if (specifier.startsWith(".")) {
        // The LEVEL is the number of LEADING dots: one dot is the package
        // itself, two dots its parent, and so on.
        const levels = (specifier.match(/^\.+/)?.[0] ?? "").length;
        const base = packageParts.slice(0, Math.max(0, packageParts.length - levels + 1));
        const tail = specifier.replace(/^\.+/, "").split(".").filter(Boolean);
        if (tail.length === 0) continue;
        const moduleBase = [...base, ...tail].join("/");
        imports.push({
          candidates: [`${moduleBase}.py`, path.posix.join(moduleBase, "__init__.py")],
          label: moduleBase,
        });
        continue;
      }
      // An ABSOLUTE import is local only when it names a package under one
      // of the declared Python package roots.
      const tail = specifier.split(".").filter(Boolean);
      if (tail.length === 0) continue;
      for (const packageRoot of PYTHON_PACKAGE_ROOTS) {
        const top = path.posix.join(packageRoot, tail[0]);
        if (!fs.existsSync(path.join(root, top))) continue;
        const moduleBase = path.posix.join(packageRoot, ...tail);
        imports.push({
          candidates: [`${moduleBase}.py`, path.posix.join(moduleBase, "__init__.py")],
          label: moduleBase,
        });
        break;
      }
    }
  }
  return imports;
}

/**
 * Resolve the transitive local import closure of the executed roots.
 *
 * @returns {{files: Array<{relative: string, sha256: string, byteCount: number}>, unresolved: string[]}}
 */
export function resolveExecutionClosure({ repoRoot } = {}) {
  const root = path.resolve(repoRoot ?? process.cwd());
  const collected = new Map();
  const unresolved = new Set();
  const queue = [];
  for (const entry of EXECUTION_CLOSURE_ROOTS) {
    const absolute = path.join(root, entry.relative);
    if (!fs.existsSync(absolute)) {
      unresolved.add(`${entry.key}:${entry.relative}`);
      continue;
    }
    queue.push(entry.relative);
  }
  for (const entry of EXECUTION_CLOSURE_FILES) {
    const absolute = path.join(root, entry.relative);
    if (!fs.existsSync(absolute)) {
      unresolved.add(`${entry.key}:${entry.relative}`);
      continue;
    }
    const bytes = fs.readFileSync(absolute);
    collected.set(entry.relative, {
      relative: entry.relative,
      sha256: sha256(bytes),
      byteCount: bytes.length,
    });
  }
  const seen = new Set();
  while (queue.length > 0) {
    const relative = queue.pop();
    if (seen.has(relative)) continue;
    seen.add(relative);
    const absolute = path.join(root, relative);
    let stat = null;
    try {
      stat = fs.lstatSync(absolute);
    } catch {
      unresolved.add(relative);
      continue;
    }
    if (stat.isSymbolicLink()) {
      // A symbolic link is recorded and the verifier refuses it.
      collected.set(relative, { relative, sha256: null, byteCount: 0, symlink: true });
      continue;
    }
    if (stat.isDirectory()) {
      const members = [];
      walkTree(root, relative, members);
      for (const member of members) {
        if (member.kind === "symlink") {
          collected.set(member.relative, { relative: member.relative, sha256: null, byteCount: 0, symlink: true });
          continue;
        }
        const memberBytes = fs.readFileSync(path.join(root, member.relative));
        collected.set(member.relative, {
          relative: member.relative,
          sha256: sha256(memberBytes),
          byteCount: memberBytes.length,
        });
        if (member.relative.endsWith(".mjs") || member.relative.endsWith(".js") || member.relative.endsWith(".py")) {
          queue.push(member.relative);
        }
      }
      continue;
    }
    const bytes = fs.readFileSync(absolute);
    collected.set(relative, {
      relative,
      sha256: sha256(bytes),
      byteCount: bytes.length,
    });
    if (relative.endsWith(".mjs") || relative.endsWith(".js") || relative.endsWith(".py")) {
      const text = bytes.toString("utf8");
      for (const imported of localImports(relative, text, root)) {
        const resolved = resolveLocalTarget(root, imported.candidates);
        if (!resolved) {
          unresolved.add(imported.label);
          continue;
        }
        queue.push(resolved);
      }
    }
  }
  const files = [...collected.values()].sort((left, right) => left.relative.localeCompare(right.relative));
  return { files, unresolved: [...unresolved].sort() };
}

/**
 * The IDENTITY of the installed extension dependency tree.
 *
 * It is an identity, not a copy: the tree stays where it is and the
 * snapshot binds to it.
 */
const BYTE_TREE_CACHE = new Map();

function byteTreeIdentity({ roots = [], hashContents = () => true } = {}) {
  const normalizedRoots = roots
    .map(({ key, root }) => ({ key, root: path.resolve(root) }))
    .sort((left, right) => left.key.localeCompare(right.key));
  const cacheKey = JSON.stringify(normalizedRoots);
  const previous = BYTE_TREE_CACHE.get(cacheKey) ?? new Map();
  const next = new Map();
  const entries = [];

  const visit = (base, current, prefix) => {
    const names = fs.readdirSync(current).sort();
    for (const name of names) {
      const absolute = path.join(current, name);
      const relative = path.posix.join(prefix, path.relative(base, absolute).split(path.sep).join("/"));
      const stat = fs.lstatSync(absolute, { bigint: true });
      if (stat.isDirectory()) {
        visit(base, absolute, prefix);
        continue;
      }
      if (stat.isSymbolicLink()) {
        entries.push(`${relative}\tlink\t${fs.readlinkSync(absolute)}`);
        continue;
      }
      if (!stat.isFile()) continue;
      const signature = `${stat.size}:${stat.mtimeNs}:${stat.ctimeNs}`;
      const cached = previous.get(relative);
      const contentRequired = hashContents(relative);
      const digest = !contentRequired
        ? "metadata-sealed"
        : (cached?.signature === signature
          ? cached.digest
          : sha256(fs.readFileSync(absolute)));
      next.set(relative, { signature, digest });
      entries.push(`${relative}\tfile\t${signature}\t${digest}`);
    }
  };

  try {
    for (const { key, root } of normalizedRoots) {
      const real = fs.realpathSync(root);
      visit(real, real, key);
    }
  } catch {
    return null;
  }
  BYTE_TREE_CACHE.set(cacheKey, next);
  return {
    fileCount: entries.length,
    treeSha256: sha256(entries.join("\n")),
  };
}

function extensionDependencyTreeIdentity({ repoRoot }) {
  const root = path.resolve(repoRoot ?? process.cwd());
  const nodeModules = path.join(root, "apps/chrome-extension/node_modules");
  const playwrightRoot = path.join(nodeModules, "playwright");
  if (!fs.existsSync(playwrightRoot)) return null;
  const playwrightReal = fs.realpathSync(playwrightRoot);
  const directCore = path.join(nodeModules, "playwright-core");
  const siblingCore = path.join(path.dirname(playwrightReal), "playwright-core");
  const coreRoot = fs.existsSync(directCore) ? directCore : siblingCore;
  const packageRoots = [
    { key: "playwright", root: playwrightRoot },
    { key: "playwright-core", root: coreRoot },
  ].filter((entry) => fs.existsSync(entry.root));
  if (packageRoots.length !== 2) return null;
  return byteTreeIdentity({ roots: packageRoots });
}

function metadataTreeIdentity({ roots = [], hashContents = () => false } = {}) {
  const entries = [];
  try {
    for (const { key, root } of roots.sort((left, right) => left.key.localeCompare(right.key))) {
      const real = fs.realpathSync(root);
      const output = execFileSync("find", [
        real,
        "-printf",
        "%P\t%s\t%T@\t%C@\t%y\t%l\n",
      ], { encoding: "buffer", maxBuffer: 64 * 1024 * 1024 });
      const records = output.toString("utf8").split("\n");
      for (const record of records) {
        const [relativeRaw, size, mtime, ctime, type, link = ""] = record.split("\t");
        if (!relativeRaw || type === "d") continue;
        const relative = `${key}/${relativeRaw.split(path.sep).join("/")}`;
        const digest = type === "f" && hashContents(relative)
          ? sha256(fs.readFileSync(path.join(real, relativeRaw)))
          : "metadata-sealed";
        entries.push(`${relative}\t${type}\t${size}\t${mtime}\t${ctime}\t${link}\t${digest}`);
      }
    }
  } catch {
    return null;
  }
  entries.sort();
  return { fileCount: entries.length, treeSha256: sha256(entries.join("\n")) };
}

/**
 * The IDENTITY of the installed Runtime dependency tree.
 *
 * The installed distributions are read from the virtual environment: the
 * tree stays where it is and the snapshot binds to it.
 */
function runtimeDependencyTreeIdentity({ repoRoot }) {
  const root = path.resolve(repoRoot ?? process.cwd());
  const sitePackages = path.join(root, "services/local-runtime/.venv/lib/python3.12/site-packages");
  const python = path.join(root, "services/local-runtime/.venv/bin/python");
  if (!fs.existsSync(sitePackages) || !fs.existsSync(python)) return null;
  return metadataTreeIdentity({
    roots: [
      { key: "python", root: path.dirname(python) },
      { key: "site-packages", root: sitePackages },
    ],
    // Installed Python distributions already carry RECORD content hashes.
    // Hash those authorities and every executable in bin; seal all remaining
    // files by path/size/mtime/ctime so an in-stage byte change cannot be
    // hidden by preserving a package version.
    hashContents: (relative) => relative.startsWith("python/")
      || /\.dist-info\/(?:RECORD|METADATA|WHEEL|entry_points\.txt)$/.test(relative),
  });
}

/**
 * The tool and dependency identities of a candidate.
 *
 * They are IDENTITIES, not bytes: the third-party dependency trees are
 * pinned by their lockfile and their resolved versions, and they are not
 * copied into the snapshot.
 */
export function resolveToolIdentities({ repoRoot } = {}) {
  const root = path.resolve(repoRoot ?? process.cwd());
  const version = (command, args) => {
    try {
      return execFileSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim().split("\n")[0] ?? null;
    } catch {
      return null;
    }
  };
  const pythonVersion = (() => {
    const venv = path.join(root, "services/local-runtime/.venv/bin/python");
    if (!fs.existsSync(venv)) return null;
    return version(venv, ["--version"]);
  })();
  const extensionTree = extensionDependencyTreeIdentity({ repoRoot: root });
  const runtimeTree = runtimeDependencyTreeIdentity({ repoRoot: root });
  return {
    node: process.version,
    python: pythonVersion,
    platform: `${process.platform}-${process.arch}`,
    playwright: (() => {
      const file = path.join(root, "apps/chrome-extension/node_modules/playwright/package.json");
      if (!fs.existsSync(file)) return null;
      try {
        return JSON.parse(fs.readFileSync(file, "utf8")).version ?? null;
      } catch {
        return null;
      }
    })(),
    extensionDependencyTreeSha256: extensionTree?.treeSha256 ?? null,
    extensionDependencyCount: extensionTree?.fileCount ?? null,
    runtimeDependencyTreeSha256: runtimeTree?.treeSha256 ?? null,
    runtimeDependencyCount: runtimeTree?.fileCount ?? null,
  };
}

/** The tool identity fields that may never be absent. */
export const EXECUTION_CLOSURE_TOOL_IDENTITY_KEYS = Object.freeze([
  "node", "python", "platform", "playwright",
  "extensionDependencyTreeSha256", "extensionDependencyCount",
  "runtimeDependencyTreeSha256", "runtimeDependencyCount",
]);

/**
 * Build the execution-closure manifest of a candidate.
 */
export function buildExecutionClosureManifest({ repoRoot, runId = null } = {}) {
  const root = path.resolve(repoRoot ?? process.cwd());
  const closure = resolveExecutionClosure({ repoRoot: root });
  return {
    schemaVersion: EXECUTION_CLOSURE_SCHEMA,
    batch: "GC-B6 CANDIDATE EXECUTION CLOSURE",
    runId: runId ?? null,
    createdAtUtc: new Date().toISOString(),
    roots: EXECUTION_CLOSURE_ROOTS.map((entry) => ({ ...entry })),
    contractFiles: EXECUTION_CLOSURE_FILES.map((entry) => ({ ...entry })),
    toolBindings: EXECUTION_CLOSURE_TOOL_BINDINGS.map((entry) => ({ ...entry })),
    toolIdentities: resolveToolIdentities({ repoRoot: root }),
    fileCount: closure.files.length,
    files: closure.files,
    unresolved: closure.unresolved,
  };
}

/**
 * The defects of a manifest itself.
 *
 * An unresolved import, a missing root, an absent tool identity and a
 * symbolic link inside the executed bytes are all defects of the manifest:
 * the closure may never be built from an incomplete input.
 */
export function executionClosureManifestDefects(manifest) {
  const codes = [];
  if (!manifest || typeof manifest !== "object" || manifest.schemaVersion !== EXECUTION_CLOSURE_SCHEMA) {
    return { ok: false, codes: [EXECUTION_CLOSURE_FAILURE.SCHEMA] };
  }
  if (!Array.isArray(manifest.files) || manifest.files.length === 0) {
    codes.push(EXECUTION_CLOSURE_FAILURE.MISSING_ROOT);
  }
  if (Array.isArray(manifest.unresolved) && manifest.unresolved.length > 0) {
    codes.push(EXECUTION_CLOSURE_FAILURE.UNRESOLVED);
    // A MISSING ROOT is its own defect: the executed tree is not there.
    const rootKeys = new Set(EXECUTION_CLOSURE_ROOTS.map((entry) => entry.key));
    for (const entry of manifest.unresolved) {
      const key = String(entry).split(":")[0];
      if (rootKeys.has(key)) {
        codes.push(EXECUTION_CLOSURE_FAILURE.MISSING_ROOT);
        break;
      }
    }
  }
  for (const entry of manifest.files ?? []) {
    if (entry?.symlink === true) codes.push(EXECUTION_CLOSURE_FAILURE.SYMLINK);
    if (typeof entry?.relative === "string" && (entry.relative.startsWith("/") || entry.relative.includes(".."))) {
      codes.push(EXECUTION_CLOSURE_FAILURE.OUTSIDE);
    }
  }
  for (const key of EXECUTION_CLOSURE_TOOL_IDENTITY_KEYS) {
    const value = manifest.toolIdentities?.[key];
    if (value === null || value === undefined || value === "") {
      codes.push(EXECUTION_CLOSURE_FAILURE.TOOL_MISSING);
    }
  }
  return { ok: codes.length === 0, codes: [...new Set(codes)].sort() };
}

/**
 * Verify an execution-closure manifest against the working tree.
 *
 * The verification is a three-way comparison: the manifest's file SET, the
 * manifest's digests and the freshly RESOLVED closure. A missing file, an
 * extra executed file, a symbolic link or a digest drift is a defect.
 */
export function verifyExecutionClosure({ manifest, repoRoot } = {}) {
  const root = path.resolve(repoRoot ?? process.cwd());
  const codes = [];
  const manifestVerdict = executionClosureManifestDefects(manifest);
  if (!manifestVerdict.ok) {
    return {
      ok: false,
      codes: manifestVerdict.codes,
      drifted: [],
      missing: [],
      extra: [],
      unresolved: manifest.unresolved ?? [],
    };
  }
  const recorded = new Map((manifest.files ?? []).map((entry) => [entry.relative, entry]));
  const resolved = resolveExecutionClosure({ repoRoot: root });
  const current = new Map(resolved.files.map((entry) => [entry.relative, entry]));
  const missing = [];
  const extra = [];
  const drifted = [];
  for (const [relative, entry] of recorded) {
    if (!current.has(relative)) {
      missing.push(relative);
      continue;
    }
    const observed = current.get(relative);
    if (entry.symlink === true || observed.symlink === true) {
      codes.push(EXECUTION_CLOSURE_FAILURE.SYMLINK);
      drifted.push(relative);
      continue;
    }
    if (entry.sha256 !== observed.sha256) {
      drifted.push(relative);
    }
  }
  for (const relative of current.keys()) {
    if (!recorded.has(relative)) extra.push(relative);
  }
  if (missing.length > 0) codes.push(EXECUTION_CLOSURE_FAILURE.MISSING_FILE);
  if (extra.length > 0) codes.push(EXECUTION_CLOSURE_FAILURE.EXTRA_FILE);
  if (drifted.length > 0) codes.push(EXECUTION_CLOSURE_FAILURE.DRIFT);
  for (const relative of [...recorded.keys(), ...current.keys()]) {
    if (relative.startsWith("/") || relative.includes("..")) {
      codes.push(EXECUTION_CLOSURE_FAILURE.OUTSIDE);
      break;
    }
  }
  const observedTools = resolveToolIdentities({ repoRoot: root });
  for (const key of EXECUTION_CLOSURE_TOOL_IDENTITY_KEYS) {
    if (manifest.toolIdentities[key] !== observedTools[key]) {
      codes.push(EXECUTION_CLOSURE_FAILURE.TOOL);
    }
  }
  return {
    ok: codes.length === 0,
    codes: [...new Set(codes)].sort(),
    drifted: drifted.sort(),
    missing: missing.sort(),
    extra: extra.sort(),
    unresolved: resolved.unresolved,
  };
}

/**
 * Materialize the candidate into a uniquely owned, repository-external
 * snapshot.
 *
 * The snapshot holds a COPY of every executed file: the snapshot is
 * immutable by construction, because the copy is a new file and never a link
 * to the working tree. The tool bindings are the declared exception: they
 * are links to the pinned dependency trees.
 */
export function materializeExecutionSnapshot({ manifest, repoRoot, snapshotRoot, toolRoot = null } = {}) {
  const root = path.resolve(repoRoot ?? process.cwd());
  const tools = path.resolve(toolRoot ?? repoRoot ?? process.cwd());
  const target = path.resolve(snapshotRoot);
  const codes = [];
  if (fs.existsSync(target)) {
    return { ok: false, codes: [EXECUTION_CLOSURE_FAILURE.MUTABLE], snapshotRoot: target, fileCount: 0 };
  }
  const manifestVerdict = executionClosureManifestDefects(manifest);
  if (!manifestVerdict.ok) {
    return { ok: false, codes: manifestVerdict.codes, snapshotRoot: target, fileCount: 0 };
  }
  fs.mkdirSync(target, { recursive: true, mode: 0o700 });
  let fileCount = 0;
  for (const entry of manifest.files ?? []) {
    if (entry.symlink === true) {
      codes.push(EXECUTION_CLOSURE_FAILURE.SYMLINK);
      continue;
    }
    const source = path.join(root, entry.relative);
    if (!fs.existsSync(source)) {
      codes.push(EXECUTION_CLOSURE_FAILURE.MISSING_FILE);
      continue;
    }
    const destination = path.join(target, entry.relative);
    fs.mkdirSync(path.dirname(destination), { recursive: true, mode: 0o700 });
    fs.copyFileSync(source, destination);
    fs.chmodSync(destination, 0o600);
    fileCount += 1;
  }
  // The TOOL BINDINGS: a declared link to the pinned dependency tree.
  for (const binding of manifest.toolBindings ?? []) {
    const source = path.join(tools, binding.relative);
    if (!fs.existsSync(source)) {
      codes.push(EXECUTION_CLOSURE_FAILURE.TOOL_BINDING);
      continue;
    }
    const destination = path.join(target, binding.relative);
    fs.mkdirSync(path.dirname(destination), { recursive: true, mode: 0o700 });
    try {
      fs.symlinkSync(source, destination, "dir");
    } catch {
      codes.push(EXECUTION_CLOSURE_FAILURE.TOOL_BINDING);
    }
  }
  return { ok: codes.length === 0, codes: [...new Set(codes)].sort(), snapshotRoot: target, fileCount };
}

/**
 * Verify a MATERIALIZED snapshot against the manifest.
 *
 * The snapshot is verified on its own bytes: a symlink, a drifted digest, a
 * missing file or an EXTRA executable byte inside it is a defect. The extra
 * check is what makes the snapshot SEALED: a byte that appeared after the
 * materialization is an executed byte that the manifest does not know.
 */
export function verifyExecutionSnapshot({ manifest, snapshotRoot, toolRoot = null } = {}) {
  const target = path.resolve(snapshotRoot);
  const codes = [];
  const drifted = [];
  const missing = [];
  const extra = [];
  const manifestVerdict = executionClosureManifestDefects(manifest);
  if (!manifestVerdict.ok) {
    return {
      ok: false,
      codes: manifestVerdict.codes,
      drifted: [],
      missing: [],
      extra: [],
    };
  }
  const declared = new Set((manifest.files ?? []).map((entry) => entry.relative));
  const bindingPrefixes = (manifest.toolBindings ?? []).map((entry) => entry.relative);
  for (const entry of manifest.files ?? []) {
    if (entry.symlink === true) {
      codes.push(EXECUTION_CLOSURE_FAILURE.SYMLINK);
      continue;
    }
    const file = path.join(target, entry.relative);
    let stat = null;
    try {
      stat = fs.lstatSync(file);
    } catch {
      missing.push(entry.relative);
      continue;
    }
    if (stat.isSymbolicLink()) {
      codes.push(EXECUTION_CLOSURE_FAILURE.SYMLINK);
      drifted.push(entry.relative);
      continue;
    }
    if (sha256(fs.readFileSync(file)) !== entry.sha256) {
      drifted.push(entry.relative);
    }
  }
  // The EXTRA check: a file inside the snapshot that the manifest does not
  // declare is an executed byte the seal does not know.
  if (fs.existsSync(target)) {
    const present = [];
    walkTree(target, ".", present);
    for (const member of present) {
      if (member.kind === "symlink") {
        // A tool binding is the declared exception; any other link is a
        // mutable path.
        const isBinding = bindingPrefixes.some((prefix) => member.relative === prefix
          || member.relative.startsWith(`${prefix}/`));
        if (!isBinding) {
          codes.push(EXECUTION_CLOSURE_FAILURE.SYMLINK);
          drifted.push(member.relative);
        }
        continue;
      }
      if (bindingPrefixes.some((prefix) => member.relative === prefix
        || member.relative.startsWith(`${prefix}/`))) continue;
      if (!declared.has(member.relative)) extra.push(member.relative);
    }
  }
  // The TOOL BINDINGS must exist and must resolve.
  for (const binding of manifest.toolBindings ?? []) {
    const link = path.join(target, binding.relative);
    let stat = null;
    try {
      stat = fs.lstatSync(link);
    } catch {
      codes.push(EXECUTION_CLOSURE_FAILURE.TOOL_BINDING);
      continue;
    }
    if (!stat.isSymbolicLink()) {
      codes.push(EXECUTION_CLOSURE_FAILURE.TOOL_BINDING);
      continue;
    }
    let resolved = null;
    try {
      resolved = fs.realpathSync(link);
    } catch {
      codes.push(EXECUTION_CLOSURE_FAILURE.TOOL_BINDING);
      continue;
    }
    if (!fs.existsSync(resolved)) {
      codes.push(EXECUTION_CLOSURE_FAILURE.TOOL_BINDING);
    }
  }
  if (missing.length > 0) codes.push(EXECUTION_CLOSURE_FAILURE.MISSING_FILE);
  if (drifted.length > 0) codes.push(EXECUTION_CLOSURE_FAILURE.DRIFT);
  if (extra.length > 0) codes.push(EXECUTION_CLOSURE_FAILURE.SNAPSHOT_EXTRA);
  return {
    ok: codes.length === 0,
    codes: [...new Set(codes)].sort(),
    drifted: drifted.sort(),
    missing: missing.sort(),
    extra: extra.sort(),
  };
}

/**
 * The tree digest of ONE executed root.
 *
 * It is the proof that the Runtime, the extension and the child harness
 * executed the SNAPSHOT bytes: the digest of the tree they really used.
 */
export function executionTreeDigest({ productRoot, relative }) {
  const root = path.resolve(productRoot);
  const target = path.join(root, relative);
  if (!fs.existsSync(target)) return null;
  const members = [];
  walkTree(root, relative, members);
  const lines = members
    .filter((member) => member.kind === "file")
    .map((member) => `${member.relative}:${sha256(fs.readFileSync(path.join(root, member.relative)))}`)
    .sort();
  if (lines.length === 0) return null;
  return sha256(lines.join("\n"));
}

/**
 * The EXECUTION ROOT identities of a candidate.
 *
 * They name WHAT the candidate really executed: the product root source, the
 * digests of the executed trees and the digests of the executed harness
 * files. They never carry a path.
 */
export function resolveExecutionRootIdentities({ productRoot, repoRoot = null, runnerFile = null } = {}) {
  const product = path.resolve(productRoot);
  const runtimeTree = executionTreeDigest({ productRoot: product, relative: "services/local-runtime/navia_runtime" });
  const extensionTree = executionTreeDigest({ productRoot: product, relative: "apps/chrome-extension/chrome-mv3-unpacked" });
  const harnessTree = executionTreeDigest({ productRoot: product, relative: "scripts/stage_b_b5_3" });
  const runnerDigest = (() => {
    if (!runnerFile) return null;
    const file = path.resolve(runnerFile);
    if (!fs.existsSync(file)) return null;
    return sha256(fs.readFileSync(file));
  })();
  const protocol = (() => {
    const rubric = path.join(product, "scripts/stage_b_b5_3/protocol/review-rubric.v1.md");
    const prompt = path.join(product, "scripts/stage_b_b5_3/protocol/review-prompt.v1.md");
    const read = (file) => (fs.existsSync(file) ? sha256(fs.readFileSync(file)) : null);
    return { rubricSha256: read(rubric), promptSha256: read(prompt) };
  })();
  return {
    runtimeTreeSha256: runtimeTree,
    extensionTreeSha256: extensionTree,
    harnessTreeSha256: harnessTree,
    runnerFileSha256: runnerDigest,
    protocol,
  };
}
