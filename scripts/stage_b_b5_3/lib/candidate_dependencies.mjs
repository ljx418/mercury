// The CANDIDATE DEPENDENCY AUTHORITY.
//
// ONE object binds the product dependency inputs of a sealed candidate: the
// managed tools, the ASR root, the vision Provider source database and the
// extension build root.
//
// The object is resolved ONCE, from the TOOL root (the original repository),
// and it is handed to the child as EXPLICIT environment values. The snapshot
// child therefore resolves the SAME inputs as the preflight, even though its
// own module-local repository root is the snapshot.
//
// The SAFE identity of a dependency is a count and a digest: never a path,
// never a database name, never a credential, never a Provider identity and
// never a secret. The PRIVATE form of the object (the resolved paths) stays
// outside the public package; only the identities are published.
//
// A missing, changed, inaccessible or mismatched dependency is an
// EXTERNAL-INPUT BLOCK with a stable allowlisted code, and it stops before
// the authorization consumption, the Cookie read, the Chrome launch, the
// Runtime startup and the source attempt.

import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

import { resolveOwnedProductPaths, visionProviderHelper } from "./owned_session.mjs";

/** The candidate-dependency schema version. */
export const CANDIDATE_DEPENDENCY_SCHEMA = "v3-5.10-b6-candidate-dependencies/v1";

/**
 * The stable dependency failure codes.
 *
 * They are the ONLY codes a dependency or preflight refusal may carry. A
 * generic `Error`, an exception message, a path, a database name, a
 * credential and a Provider identity are never a final code.
 */
export const CANDIDATE_DEPENDENCY_CODE = Object.freeze({
  MISSING: "B6_DEPENDENCY_INPUT_MISSING",
  UNREADABLE: "B6_DEPENDENCY_INPUT_UNREADABLE",
  DRIFTED: "B6_DEPENDENCY_INPUT_DRIFTED",
  MISMATCH: "B6_DEPENDENCY_INPUT_MISMATCH",
  ENV_INCOMPLETE: "B6_DEPENDENCY_ENV_INCOMPLETE",
  PREFLIGHT: "B6_DEPENDENCY_PREFLIGHT_INVALID",
});

/** The dependency kinds of a candidate. */
export const CANDIDATE_DEPENDENCY_KIND = Object.freeze({
  MANAGED_TOOLS: "managedTools",
  ASR_ROOT: "asrRoot",
  VISION_PROVIDER_DB: "visionProviderSourceDb",
  EXTENSION_ROOT: "extensionRoot",
});

/** The child environment variable of every dependency. */
export const CANDIDATE_DEPENDENCY_ENV = Object.freeze({
  MANAGED_TOOLS: "NAVIA_MEDIA_TOOL_ROOT",
  ASR_ROOT: "NAVIA_ASR_ROOT",
  VISION_PROVIDER_DB: "NAVIA_WP_B_VISION_PROVIDER_DB",
  EXTENSION_ROOT: "NAVIA_WP_B_EXTENSION_ROOT",
});

/** The EXACT key set of one public dependency identity. */
export const CANDIDATE_DEPENDENCY_IDENTITY_KEYS = Object.freeze({
  [CANDIDATE_DEPENDENCY_KIND.MANAGED_TOOLS]: ["kind", "present", "fileCount", "treeSha256"],
  [CANDIDATE_DEPENDENCY_KIND.ASR_ROOT]: ["kind", "present", "fileCount", "treeSha256"],
  [CANDIDATE_DEPENDENCY_KIND.VISION_PROVIDER_DB]: ["kind", "present", "providerMetadataSha256"],
  [CANDIDATE_DEPENDENCY_KIND.EXTENSION_ROOT]: ["kind", "present", "fileCount", "treeSha256"],
});

/** The environment variable that carries the prepared dependency object. */
export const CANDIDATE_DEPENDENCY_FILE_ENV = "NAVIA_B6_CANDIDATE_DEPENDENCIES";

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

/**
 * The METADATA identity of a directory tree.
 *
 * The product dependency trees hold large models and binaries: their
 * CONTENT is not a stable identity (the models are installed once and the
 * databases grow), so the tree is sealed by its path, size, type and
 * timestamps. The small files are sealed by their content as well.
 */
function directoryIdentity(directory, { hashContents = null } = {}) {
  const entries = [];
  const stack = [directory];
  let fileCount = 0;
  while (stack.length > 0) {
    const current = stack.pop();
    let stat = null;
    try {
      stat = fs.lstatSync(current);
    } catch {
      return { present: false, fileCount: 0, treeSha256: null };
    }
    const relative = path.relative(directory, current).split(path.sep).join("/");
    if (stat.isSymbolicLink()) {
      entries.push(`${relative}\tl\t${stat.size}\t${stat.mtimeMs}\t${stat.ctimeMs}`);
      continue;
    }
    if (stat.isDirectory()) {
      let children = [];
      try {
        children = fs.readdirSync(current);
      } catch {
        return { present: false, fileCount: 0, treeSha256: null };
      }
      for (const child of children) stack.push(path.join(current, child));
      continue;
    }
    if (!stat.isFile()) continue;
    fileCount += 1;
    const executable = (stat.mode & 0o111) !== 0;
    const small = stat.size <= 1024 * 1024;
    let digest = "metadata-sealed";
    if (hashContents ? hashContents({ relative, size: stat.size, executable }) : (executable || small)) {
      try {
        digest = sha256(fs.readFileSync(current));
      } catch {
        return { present: false, fileCount: 0, treeSha256: null };
      }
    }
    entries.push(`${relative}\tf\t${stat.size}\t${stat.mtimeMs}\t${stat.ctimeMs}\t${digest}`);
  }
  if (fileCount === 0) {
    return { present: false, fileCount: 0, treeSha256: null };
  }
  entries.sort();
  return { present: true, fileCount, treeSha256: sha256(entries.join("\n")) };
}

/**
 * The default provider metadata probe.
 *
 * It uses the PRODUCT's own owner of the selected and verified Provider
 * metadata and it digests the owned copy. The copy holds the metadata row
 * only: the secret itself stays in the OS credential store. The probe never
 * returns the Provider identity.
 */
export function defaultProviderMetadataProbe(sourceDb, { ownedRoot } = {}) {
  if (!sourceDb || !fs.existsSync(sourceDb) || !fs.statSync(sourceDb).isFile()) {
    return { present: false, sha256: null };
  }
  if (!ownedRoot) return { present: false, sha256: null };
  try {
    const prepared = visionProviderHelper.prepareOwnedVisionProviderMetadata({
      sourceDb,
      ownedRoot,
    });
    const bytes = fs.readFileSync(prepared.dbPath);
    return { present: true, sha256: sha256(bytes) };
  } catch {
    return { present: false, sha256: null };
  }
}

/**
 * Resolve the candidate dependency object.
 *
 * The resolution uses the PRODUCT's own path owner
 * (`resolveOwnedProductPaths`) with an EXPLICIT repository root: the tool
 * root of the candidate. The child environment values are the resolved
 * paths, and they are what the snapshot child must consume.
 *
 * @returns {object} the dependency object (the private form)
 */
export function resolveCandidateDependencies({
  repositoryRoot,
  environment = process.env,
  ownedRoot = null,
  providerMetadataProbe = null,
  identityMode = "identity",
} = {}) {
  const root = path.resolve(repositoryRoot ?? process.cwd());
  const productPaths = resolveOwnedProductPaths({ environment, repositoryRoot: root });
  const probe = providerMetadataProbe ?? defaultProviderMetadataProbe;

  const managedTools = directoryIdentity(productPaths.managedTools);
  const asrRoot = directoryIdentity(productPaths.asrRoot);
  // The extension build is the EXECUTED bundle: its CONTENT is its identity.
  const extensionRoot = directoryIdentity(productPaths.extensionRoot, { hashContents: () => true });
  // The RESOLUTION mode never probes the Provider metadata: the child checks
  // the resolution and the presence, and the preflight checks the identity.
  const provider = identityMode === "resolution"
    ? {
      present: Boolean(productPaths.visionProviderSourceDb)
        && fs.existsSync(productPaths.visionProviderSourceDb)
        && fs.statSync(productPaths.visionProviderSourceDb).isFile(),
      sha256: null,
    }
    : probe(productPaths.visionProviderSourceDb, { ownedRoot });

  const dependencies = {
    [CANDIDATE_DEPENDENCY_KIND.MANAGED_TOOLS]: {
      kind: CANDIDATE_DEPENDENCY_KIND.MANAGED_TOOLS,
      present: managedTools.present === true,
      fileCount: managedTools.fileCount,
      treeSha256: managedTools.treeSha256,
    },
    [CANDIDATE_DEPENDENCY_KIND.ASR_ROOT]: {
      kind: CANDIDATE_DEPENDENCY_KIND.ASR_ROOT,
      present: asrRoot.present === true,
      fileCount: asrRoot.fileCount,
      treeSha256: asrRoot.treeSha256,
    },
    [CANDIDATE_DEPENDENCY_KIND.VISION_PROVIDER_DB]: {
      kind: CANDIDATE_DEPENDENCY_KIND.VISION_PROVIDER_DB,
      present: provider.present === true,
      providerMetadataSha256: provider.sha256 ?? null,
    },
    [CANDIDATE_DEPENDENCY_KIND.EXTENSION_ROOT]: {
      kind: CANDIDATE_DEPENDENCY_KIND.EXTENSION_ROOT,
      present: extensionRoot.present === true,
      fileCount: extensionRoot.fileCount,
      treeSha256: extensionRoot.treeSha256,
    },
  };

  const childEnvironment = {
    [CANDIDATE_DEPENDENCY_ENV.MANAGED_TOOLS]: productPaths.managedTools,
    [CANDIDATE_DEPENDENCY_ENV.ASR_ROOT]: productPaths.asrRoot,
    [CANDIDATE_DEPENDENCY_ENV.VISION_PROVIDER_DB]: productPaths.visionProviderSourceDb,
    [CANDIDATE_DEPENDENCY_ENV.EXTENSION_ROOT]: productPaths.extensionRoot,
  };

  return {
    schemaVersion: CANDIDATE_DEPENDENCY_SCHEMA,
    dependencies,
    // The PRIVATE form: the resolved paths. They never enter the public
    // package.
    paths: {
      [CANDIDATE_DEPENDENCY_KIND.MANAGED_TOOLS]: productPaths.managedTools,
      [CANDIDATE_DEPENDENCY_KIND.ASR_ROOT]: productPaths.asrRoot,
      [CANDIDATE_DEPENDENCY_KIND.VISION_PROVIDER_DB]: productPaths.visionProviderSourceDb,
      [CANDIDATE_DEPENDENCY_KIND.EXTENSION_ROOT]: productPaths.extensionRoot,
    },
    childEnvironment,
  };
}

/**
 * The PUBLIC projection of a dependency object.
 *
 * It carries the safe identities only: no path, no database name, no
 * credential and no Provider identity.
 */
export function publicDependencyIdentities(dependencies) {
  const projected = {};
  for (const kind of Object.keys(CANDIDATE_DEPENDENCY_IDENTITY_KEYS)) {
    const identity = dependencies?.[kind] ?? null;
    if (!isPlainObject(identity)) {
      projected[kind] = null;
      continue;
    }
    const entry = {};
    for (const key of CANDIDATE_DEPENDENCY_IDENTITY_KEYS[kind]) {
      entry[key] = identity[key] ?? null;
    }
    projected[kind] = entry;
  }
  return projected;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasExactKeys(value, keys) {
  if (!isPlainObject(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length
    && actual.every((key, index) => key === expected[index]);
}

function dependencyObjectShapeDefects(value, { mode = "identity" } = {}) {
  const codes = [];
  const kinds = Object.keys(CANDIDATE_DEPENDENCY_IDENTITY_KEYS);
  const variables = Object.values(CANDIDATE_DEPENDENCY_ENV);
  if (!hasExactKeys(value, ["schemaVersion", "dependencies", "paths", "childEnvironment"])
    || value.schemaVersion !== CANDIDATE_DEPENDENCY_SCHEMA
    || !hasExactKeys(value.dependencies, kinds)
    || !hasExactKeys(value.paths, kinds)
    || !hasExactKeys(value.childEnvironment, variables)) {
    return [CANDIDATE_DEPENDENCY_CODE.ENV_INCOMPLETE];
  }
  for (const kind of kinds) {
    const identity = value.dependencies[kind];
    if (!hasExactKeys(identity, CANDIDATE_DEPENDENCY_IDENTITY_KEYS[kind])
      || identity.kind !== kind
      || typeof identity.present !== "boolean") {
      codes.push(CANDIDATE_DEPENDENCY_CODE.ENV_INCOMPLETE);
      continue;
    }
    const expectedPath = value.paths[kind];
    const variable = Object.entries(CANDIDATE_DEPENDENCY_KIND)
      .find(([, candidateKind]) => candidateKind === kind)?.[0] ?? null;
    const envName = variable ? CANDIDATE_DEPENDENCY_ENV[variable] : null;
    const childPath = envName ? value.childEnvironment[envName] : null;
    if (typeof expectedPath !== "string" || !path.isAbsolute(expectedPath)
      || typeof childPath !== "string" || path.resolve(childPath) !== path.resolve(expectedPath)) {
      codes.push(CANDIDATE_DEPENDENCY_CODE.ENV_INCOMPLETE);
    }
    if (!identity.present) continue;
    if (kind === CANDIDATE_DEPENDENCY_KIND.VISION_PROVIDER_DB) {
      if (mode === "identity"
        && (typeof identity.providerMetadataSha256 !== "string"
          || !/^[0-9a-f]{64}$/.test(identity.providerMetadataSha256))) {
        codes.push(CANDIDATE_DEPENDENCY_CODE.ENV_INCOMPLETE);
      }
    } else if (!Number.isInteger(identity.fileCount) || identity.fileCount <= 0
      || typeof identity.treeSha256 !== "string" || !/^[0-9a-f]{64}$/.test(identity.treeSha256)) {
      codes.push(CANDIDATE_DEPENDENCY_CODE.ENV_INCOMPLETE);
    }
  }
  return [...new Set(codes)].sort();
}

/**
 * The defects of a dependency object against an EXPECTED object.
 *
 * The comparison is by IDENTITY for the content and by RESOLUTION for the
 * paths. A dependency that vanished, a dependency whose identity changed and
 * a child that resolved another dependency are three different defects.
 */
export function candidateDependencyDefects(resolved, {
  expected = null,
  requireComplete = true,
  mode = "identity",
} = {}) {
  const codes = dependencyObjectShapeDefects(resolved, { mode });
  if (codes.length > 0) return { ok: false, codes };
  const dependencies = resolved.dependencies ?? {};
  for (const kind of Object.keys(CANDIDATE_DEPENDENCY_IDENTITY_KEYS)) {
    const identity = dependencies[kind] ?? null;
    if (!isPlainObject(identity)) {
      codes.push(CANDIDATE_DEPENDENCY_CODE.ENV_INCOMPLETE);
      continue;
    }
    if (identity.present !== true) {
      codes.push(CANDIDATE_DEPENDENCY_CODE.MISSING);
      continue;
    }
    if (expected) {
      const expectedIdentity = expected.dependencies?.[kind] ?? null;
      if (!isPlainObject(expectedIdentity)) {
        codes.push(CANDIDATE_DEPENDENCY_CODE.ENV_INCOMPLETE);
        continue;
      }
      const keys = CANDIDATE_DEPENDENCY_IDENTITY_KEYS[kind];
      for (const key of keys) {
        if (key === "kind" || key === "present") continue;
        // The RESOLUTION mode never compares the Provider metadata digest:
        // the child does not probe the product database.
        if (mode === "resolution" && key === "providerMetadataSha256") continue;
        if ((identity[key] ?? null) !== (expectedIdentity[key] ?? null)) {
          codes.push(CANDIDATE_DEPENDENCY_CODE.DRIFTED);
          break;
        }
      }
    }
  }
  if (expected) {
    // The RESOLUTION parity: the child must consume the dependency that the
    // preparation bound. A child that falls back to its own module-local
    // root resolves ANOTHER dependency and is refused.
    for (const kind of Object.keys(CANDIDATE_DEPENDENCY_IDENTITY_KEYS)) {
      const expectedPath = expected.paths?.[kind] ?? null;
      const resolvedPath = resolved.paths?.[kind] ?? null;
      if (!expectedPath || !resolvedPath) {
        if (requireComplete) codes.push(CANDIDATE_DEPENDENCY_CODE.ENV_INCOMPLETE);
        continue;
      }
      if (path.resolve(expectedPath) !== path.resolve(resolvedPath)) {
        codes.push(CANDIDATE_DEPENDENCY_CODE.MISMATCH);
      }
    }
  }
  return { ok: codes.length === 0, codes: [...new Set(codes)].sort() };
}

/**
 * The PRIMARY code of a dependency defect list.
 *
 * The order is fixed, so the terminal code of a machine receipt is a stable
 * enum and never depends on the order in which the defects were found.
 */
export function primaryDependencyCode(codes) {
  const priority = [
    CANDIDATE_DEPENDENCY_CODE.ENV_INCOMPLETE,
    CANDIDATE_DEPENDENCY_CODE.MISMATCH,
    CANDIDATE_DEPENDENCY_CODE.MISSING,
    CANDIDATE_DEPENDENCY_CODE.DRIFTED,
    CANDIDATE_DEPENDENCY_CODE.UNREADABLE,
    CANDIDATE_DEPENDENCY_CODE.PREFLIGHT,
  ];
  const list = Array.isArray(codes) ? codes : [];
  for (const code of priority) {
    if (list.includes(code)) return code;
  }
  return list[0] ?? CANDIDATE_DEPENDENCY_CODE.ENV_INCOMPLETE;
}

/**
 * The child environment of a dependency object.
 *
 * The values are the explicit paths the snapshot child must consume.
 */
export function dependencyChildEnvironment(resolved) {
  const childEnvironment = resolved?.childEnvironment ?? {};
  const next = {};
  for (const variable of Object.values(CANDIDATE_DEPENDENCY_ENV)) {
    const value = childEnvironment[variable] ?? null;
    if (typeof value === "string" && value) next[variable] = path.resolve(value);
  }
  return next;
}

/**
 * Verify the candidate dependency parity of a CHILD.
 *
 * The child resolves the dependencies with its OWN module-local root as the
 * fallback: an explicit binding wins, and a missing binding falls back to
 * the child's own root, which is the snapshot and never the product state.
 * The comparison with the prepared object is what detects that fallback.
 *
 * @returns {{ok: boolean, codes: string[], resolved: object|null, expected: object|null}}
 */
export function verifyCandidateDependencies({
  environment = process.env,
  childRoot,
  dependencyFile,
  mode = "resolution",
  providerMetadataProbe = null,
  ownedRoot = null,
} = {}) {
  const read = readCandidateDependencyFile(dependencyFile);
  if (!read.ok) {
    return { ok: false, codes: read.codes, resolved: null, expected: null };
  }
  let resolved = null;
  try {
    resolved = resolveCandidateDependencies({
      repositoryRoot: childRoot,
      environment,
      ownedRoot,
      providerMetadataProbe,
      identityMode: mode === "identity" ? "identity" : "resolution",
    });
  } catch {
    // Product path resolution is an external-input boundary. An exception
    // must never escape as an implementation-specific Error name or text.
    return {
      ok: false,
      codes: [CANDIDATE_DEPENDENCY_CODE.UNREADABLE],
      resolved: null,
      expected: read.object,
    };
  }
  const verdict = candidateDependencyDefects(resolved, { expected: read.object, mode });
  return { ok: verdict.ok, codes: verdict.codes, resolved, expected: read.object };
}

/**
 * The DEPENDENCY CHECK of the production preflight.
 *
 * The preflight resolves the product dependency inputs ONCE and it validates
 * the EXACT object that the snapshot child will consume. A difference is an
 * external-input block: every external counter stays zero.
 *
 * @returns {{ok: boolean, codes: string[], identities: object}}
 */
export function preflightDependencyCheck({
  environment = process.env,
  repositoryRoot,
  dependencyFile = null,
  ownedRoot = null,
  providerMetadataProbe = null,
} = {}) {
  let resolved = null;
  try {
    resolved = resolveCandidateDependencies({
      repositoryRoot,
      environment,
      ownedRoot,
      providerMetadataProbe,
      identityMode: "identity",
    });
  } catch {
    return {
      ok: false,
      codes: [CANDIDATE_DEPENDENCY_CODE.UNREADABLE],
      identities: publicDependencyIdentities(null),
      resolved: null,
    };
  }
  const identities = publicDependencyIdentities(resolved.dependencies);
  if (!dependencyFile) {
    // Before a prepared object exists the preflight still has to prove that
    // all product inputs are complete. It cannot prove child parity yet, but
    // it must never report a missing dependency as a green preflight.
    const completeness = candidateDependencyDefects(resolved, { mode: "identity" });
    return { ok: completeness.ok, codes: completeness.codes, identities, resolved };
  }
  const parity = verifyCandidateDependencies({
    environment,
    childRoot: repositoryRoot,
    dependencyFile,
    mode: "identity",
    ownedRoot,
    providerMetadataProbe,
  });
  return {
    ok: parity.ok,
    codes: parity.codes,
    identities,
    resolved,
  };
}

/**
 * Write the PRIVATE dependency object.
 *
 * It holds the resolved paths, so it lives in the owned private root and it
 * never enters the public package.
 */
export function writeCandidateDependencyFile(file, resolved) {
  const target = path.resolve(file);
  fs.mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 });
  fs.writeFileSync(
    target,
    `${JSON.stringify({
      schemaVersion: CANDIDATE_DEPENDENCY_SCHEMA,
      dependencies: resolved.dependencies,
      paths: resolved.paths,
      childEnvironment: resolved.childEnvironment,
    }, null, 2)}\n`,
    { mode: 0o600 },
  );
  return target;
}

/**
 * Read the PRIVATE dependency object.
 *
 * A missing or malformed file is a defect of the candidate path, never a
 * silent fallback.
 */
export function readCandidateDependencyFile(file) {
  if (!file) {
    return { ok: false, codes: [CANDIDATE_DEPENDENCY_CODE.ENV_INCOMPLETE], object: null };
  }
  let parsed = null;
  try {
    parsed = JSON.parse(fs.readFileSync(path.resolve(file), "utf8"));
  } catch {
    return { ok: false, codes: [CANDIDATE_DEPENDENCY_CODE.UNREADABLE], object: null };
  }
  if (dependencyObjectShapeDefects(parsed, { mode: "identity" }).length > 0) {
    return { ok: false, codes: [CANDIDATE_DEPENDENCY_CODE.UNREADABLE], object: null };
  }
  return { ok: true, codes: [], object: parsed };
}
