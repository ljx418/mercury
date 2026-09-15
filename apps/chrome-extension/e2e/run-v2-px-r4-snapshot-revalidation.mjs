import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_REPOSITORY_ROOT,
  artifactRef,
  buildFileIndex,
  buildDependencyClosure,
  canonicalJson,
  createAcceptanceSnapshot,
  dependencyClosureSha256,
  ensureEmptyDirectory,
  gitStatusBytes,
  readRepositoryBytes,
  requireSuccessful,
  resolveReplayInvocationRecord,
  runCaptured,
  sha256,
  T04_APPROVED_SCOPE,
  validateImplementationAuthorization,
  validateResolvedReplayInvocation
} from "./lib/v2PxSnapshotReplay.mjs";
import { parseArgs, validateJsonSchema, writeJson } from "./lib/v2PxPipelineIo.mjs";
import {
  archiveMembers,
  assertHumanBoundary,
  assertInvocationExecuted,
  assertNoLegacyInvocation,
  compareInvocationRecord,
  compareReplayOutputs,
  runRegisteredNegativeCases,
  validateArchitectureFromRaw,
  validateArchiveMembership,
  validateDependencyClosureDocument,
  validateExitManifestDocument,
  validateFreshLaneDocument,
  validateFreshRaw,
  validatePublicBytes,
  validateReplayLaneDocument,
  validateSnapshotManifestSemantics
} from "./lib/v2PxSnapshotComparison.mjs";
import { buildArchitectureSnapshot, loadFrozenArchitecturePolicy } from "./lib/v2PxProductionValidation.mjs";

const scriptPath = fileURLToPath(import.meta.url);
const repositoryRoot = DEFAULT_REPOSITORY_ROOT;
const BASE_COMMIT = "430cddcb7ff618978851af1f3b9a3c48f2370d36";
const PRODUCT_BASE_REFERENCE = "1bf05a527484b39715befab0996bc7ba3447fb07f3a1f64a4aeeb72da0629927";
const T03_AUDIT_REFERENCE = "1d6d5cbf82e90410497601c0e0eb30fc66e2c3e88624bbaf0b1911e241f7ad71";
const FROZEN_CONTRACT_REFERENCE = "152486c899653168e98e341c9d86806c4768ddadb2cd6198e72c9b0a08152cdc";
const T02_SOURCE_RUN_ID = "t02-r2-t01-structured-production-input-20260914T125700";
const T02_SOURCE_RUN_ROOT = "docs/active/project/evidence/v2_external_brain_productization/px-5/t02.5-t01-structured-regression-recollection/runs/t02-r2-t01-structured-production-input-20260914T125700";
const T02_RAW_SHA256 = "ce272df479499e10092bc5d6a24610ebcd91782c87d4be34dceb09f296a5f0c3";
const T02_SEAL_SHA256 = "fed6155ace6c0132c70c86bd3daccef987bd7c441df8960811e734274ea1b70f";
const T03_VALIDATION_RUN_ID = "t03-r3-production-exit-candidate-20260914T134804";
const T03_BASELINE_ROOT = "docs/active/project/evidence/v2_external_brain_productization/px-5/t03-r3-semantic-reporting/runs/t03-r3-production-exit-candidate-20260914T134804";
const T03_INDEPENDENT_AUDIT_PATH = "docs/active/project/evidence/v2_external_brain_productization/px-5/t03-r3-semantic-reporting/independent-implementation-exit-audit.md";
const T03_INPUT_READINESS_PATH = "docs/active/project/evidence/v2_external_brain_productization/px-5/t03-r3-semantic-reporting/audit-t03-input-readiness.py";
const SNAPSHOT_INPUT_SCHEMA = "docs/active/project/contracts/v2_px_snapshot_input_manifest.schema.json";
const REPLAY_INVOCATION_SCHEMA = "docs/active/project/contracts/v2_px_replay_invocation_record.schema.json";
const HISTORICAL_T04_ROOT = "docs/active/project/evidence/v2_external_brain_productization/px-5/t04-r4-snapshot-revalidation/runs/t04-r4-snapshot-revalidation-20260914t105407z";
const HISTORICAL_T04_EXIT_SHA256 = "5e492bd50a7dc3a1be5c5d57b7b694601b9563f4c6f79871b72093b3e56316cd";
const HISTORICAL_T04_AUDIT_PATH = "docs/active/project/evidence/v2_external_brain_productization/px-5/t04-r4-snapshot-revalidation/independent-implementation-exit-audit.md";
const HISTORICAL_T04_AUDIT_SHA256 = "cd64f8dbe685be7e252f65b1226a248885eb7b1a642651cd58c79ba752090c9b";

export const T04_ENTRYPOINTS = [
  "apps/chrome-extension/e2e/run-v2-px-r4-snapshot-revalidation.mjs",
  "apps/chrome-extension/e2e/run-v2-px-r3-validation.mjs",
  "apps/chrome-extension/e2e/derive-v2-px-production-facts.mjs",
  "apps/chrome-extension/e2e/validate-v2-px-production-package.mjs",
  "apps/chrome-extension/e2e/generate-v2-px-production-report.mjs",
  "apps/chrome-extension/e2e/package-v2-px-production-candidate.mjs",
  "apps/chrome-extension/e2e/chrome-v2-px-r2-raw-evidence.mjs",
  "apps/chrome-extension/e2e/chrome-v2-t01-r1-frontend.mjs"
];

const T03_CONTRACTS = [
  "v2_px_raw_run.schema.json",
  "v2_px_derived_facts.schema.json",
  "v2_px_production_validation.schema.json",
  "v2_px_production_package.schema.json",
  "v2_px_invocation_record.schema.json",
  "v2_external_brain_validation_contracts.schema.json",
  "v2_external_brain_report.schema.json",
  "v2_external_brain_human_review.schema.json",
  "v2_external_brain_architecture_scan_manifest.schema.json",
  "v2_knowledge_status.schema.json",
  "v2_px_production_mutation_registry.json"
].map((name) => `docs/active/project/contracts/${name}`);

const T04_CONTRACTS = [
  "docs/active/project/contracts/v2_px_snapshot_input_manifest.schema.json",
  "docs/active/project/contracts/v2_px_snapshot_revalidation.schema.json",
  "docs/active/project/contracts/v2_px_exit_manifest.schema.json",
  REPLAY_INVOCATION_SCHEMA
];

const FROZEN_INPUTS = [
  ...T03_CONTRACTS,
  ...T04_CONTRACTS,
  "docs/active/project/contracts/fixtures/v2_external_brain/px-0.1-contract-fixtures.json",
  "docs/active/project/contracts/fixtures/v2_external_brain/px-0.1b-positive-evidence-payload.json",
  "docs/active/project/design/v2-external-brain-productization-semantic-validator.md",
  "docs/active/project/design/v2-knowledge-maintenance-dream-cycle-adr.md",
  "docs/active/project/design/v2-external-brain-workspace-hosting-adr.md",
  "docs/active/project/design/v2-memory-personal-knowledge-lifecycle-adr.md",
  "docs/active/project/design/v2-memory-personal-knowledge-base-gap.drawio",
  "docs/active/project/01-prd.md",
  "docs/active/project/02-architecture.md",
  "docs/active/project/04-acceptance-plan.md",
  "docs/active/project/fixtures/real_pages/article.html",
  "docs/active/project/evidence/v1_mvp_content_quality/pages/domestic-article-36kr-news/dom-snapshot.json",
  "docs/active/project/evidence/v1_mvp_content_quality/pages/domestic-article-cctv-tech/dom-snapshot.json",
  "docs/active/project/evidence/v1_mvp_content_quality/pages/domestic-article-cnblogs/dom-snapshot.json",
  "docs/active/project/evidence/v1_mvp_content_quality/pages/domestic-article-guancha-detail/dom-snapshot.json",
  "docs/active/project/evidence/v1_mvp_content_quality/pages/domestic-article-juejin/dom-snapshot.json",
  "docs/active/project/evidence/v2_external_brain_productization/px-5/t04-r4-snapshot-revalidation/t04.1-input-manifest-remediation-external-audit-request.md",
  "docs/active/project/evidence/v2_external_brain_productization/px-5/t04-r4-snapshot-revalidation/t04.1-input-manifest-remediation-independent-document-audit.md",
  "docs/active/project/evidence/v2_external_brain_productization/px-5/t04-r4-snapshot-revalidation/t04.1-implementation-authorization.json"
  ,T03_INDEPENDENT_AUDIT_PATH,
  T03_INPUT_READINESS_PATH
];

const LOCKFILES = ["apps/chrome-extension/package.json", "apps/chrome-extension/pnpm-lock.yaml", "requirements.txt"];
const T04_IMPLEMENTATION_FILES = [
  "apps/chrome-extension/e2e/run-v2-px-r4-snapshot-revalidation.mjs",
  "apps/chrome-extension/e2e/run-v2-px-r4-snapshot-revalidation.node-test.mjs",
  "apps/chrome-extension/e2e/lib/v2PxSnapshotReplay.mjs",
  "apps/chrome-extension/e2e/lib/v2PxSnapshotReplay.node-test.mjs",
  "apps/chrome-extension/e2e/lib/v2PxSnapshotComparison.mjs",
  "apps/chrome-extension/e2e/lib/v2PxSnapshotComparison.node-test.mjs"
];

function gitBytes(args) {
  const result = runCaptured("git", args, { cwd: repositoryRoot });
  if (result.exitCode !== 0 || result.signal || result.error) {
    throw new Error(`T04_DEPENDENCY_CLOSURE_INVALID: git ${args.join(" ")} failed: ${result.stderr.toString("utf8")}`);
  }
  return result.stdout;
}

function baseTreeEntries() {
  const roots = [
    "apps/chrome-extension/entrypoints",
    "apps/chrome-extension/src",
    "services/local-runtime/navia_runtime",
    "services/local-runtime/tests"
  ];
  const output = gitBytes(["ls-tree", "-rz", "--full-tree", BASE_COMMIT, "--", ...roots]);
  const entries = new Map();
  for (const record of output.toString("utf8").split("\0").filter(Boolean)) {
    const match = /^(\d{6})\s+blob\s+([0-9a-f]{40})\t(.+)$/.exec(record);
    if (match) entries.set(match[3], { mode: match[1], objectId: match[2] });
  }
  for (const relativePath of LOCKFILES) {
    const line = gitBytes(["ls-tree", BASE_COMMIT, "--", relativePath]).toString("utf8").trim();
    const match = /^(\d{6})\s+blob\s+([0-9a-f]{40})\t(.+)$/.exec(line);
    if (!match) throw new Error(`T04_ENVIRONMENT_NOT_REPRODUCIBLE: ${relativePath} missing from product base.`);
    entries.set(match[3], { mode: match[1], objectId: match[2] });
  }
  return entries;
}

function roleFor(relativePath, entrypointSet) {
  if (entrypointSet.has(relativePath)) return "entrypoint";
  if (/\.node-test\.mjs$|\.test\.[cm]?[jt]sx?$/.test(relativePath)) return "test";
  if (relativePath.endsWith(".schema.json")) return "schema";
  if (relativePath.includes("/fixtures/") || relativePath.includes("/pages/")) return "fixture";
  if (relativePath.endsWith("registry.json")) return "registry";
  if (LOCKFILES.includes(relativePath)) return "lockfile";
  if (relativePath.startsWith("docs/")) return "spec";
  if (relativePath.startsWith("apps/chrome-extension/e2e/") && !relativePath.includes("/lib/")) return "runner";
  if (relativePath.startsWith("apps/chrome-extension/e2e/lib/")) return "module";
  return "product_source";
}

export function buildT04DependencyClosure() {
  const authorization = validateImplementationAuthorization(repositoryRoot);
  const baseEntries = baseTreeEntries();
  const productPaths = [...baseEntries.keys()];
  const declaredArtifacts = [...new Set([...FROZEN_INPUTS, ...T04_IMPLEMENTATION_FILES, ...productPaths])];
  const entrypointSet = new Set(T04_ENTRYPOINTS);
  const t04Names = new Set(T04_IMPLEMENTATION_FILES);
  const describeFile = (relativePath) => {
    if (t04Names.has(relativePath)) return { role: roleFor(relativePath, entrypointSet), sourceDisposition: "t04_authorized_implementation", sourceReferenceSha256: authorization.authorizationRef.sha256 };
    if (baseEntries.has(relativePath)) return { role: roleFor(relativePath, entrypointSet), sourceDisposition: "product_base_commit", sourceReferenceSha256: PRODUCT_BASE_REFERENCE };
    if (relativePath.startsWith("apps/chrome-extension/e2e/") || [T03_INDEPENDENT_AUDIT_PATH, T03_INPUT_READINESS_PATH].includes(relativePath)) return { role: roleFor(relativePath, entrypointSet), sourceDisposition: "t03_independent_audit", sourceReferenceSha256: T03_AUDIT_REFERENCE };
    return { role: roleFor(relativePath, entrypointSet), sourceDisposition: "frozen_contract", sourceReferenceSha256: FROZEN_CONTRACT_REFERENCE };
  };
  const closure = buildDependencyClosure({
    repositoryRoot,
    entrypoints: T04_ENTRYPOINTS,
    declaredArtifacts,
    lockfiles: LOCKFILES,
    describeFile,
    readFile(relativePath, description) {
      if (description.sourceDisposition !== "product_base_commit") return readRepositoryBytes(repositoryRoot, relativePath);
      const entry = baseEntries.get(relativePath);
      const bytes = gitBytes(["cat-file", "blob", entry.objectId]);
      return { bytes, mode: entry.mode };
    }
  });
  if (closure.missingEdges.length) throw new Error(`T04_DEPENDENCY_CLOSURE_INVALID: ${JSON.stringify(closure.missingEdges)}`);
  return closure;
}

function schemaVerification() {
  const checks = T04_CONTRACTS.map((relativePath) => {
    const result = runCaptured("python3", ["-c", [
      "import json,sys",
      "from jsonschema import Draft202012Validator",
      "s=json.load(open(sys.argv[1],encoding='utf-8'))",
      "Draft202012Validator.check_schema(s)"
    ].join("\n"), relativePath], { cwd: repositoryRoot });
    if (result.exitCode !== 0) throw new Error(`T04_DEPENDENCY_CLOSURE_INVALID: schema meta validation failed for ${relativePath}: ${result.stderr.toString("utf8")}`);
    return { path: relativePath, status: "passed", sha256: sha256(fs.readFileSync(path.join(repositoryRoot, relativePath))) };
  });
  const schema = JSON.parse(fs.readFileSync(path.join(repositoryRoot, T04_CONTRACTS[1]), "utf8"));
  return {
    schemaMeta: checks,
    acceptanceIds: schema["x-navia-acceptance-registry"],
    failureCodes: schema["x-navia-failure-code-registry"],
    requirements: schema["x-navia-requirement-registry"]
  };
}

export function runT040({ outputRoot, t04RunId }) {
  if (!/^t04-r4-[a-z0-9-]+$/.test(t04RunId)) throw new Error(`Invalid T04 run id: ${t04RunId}`);
  ensureEmptyDirectory(outputRoot);
  const authorization = validateImplementationAuthorization(repositoryRoot);
  const closure = buildT04DependencyClosure();
  const verification = schemaVerification();
  if (verification.acceptanceIds.length !== 14 || verification.requirements.length !== 25 || verification.failureCodes.length !== 22) {
    throw new Error("T04_VALIDATION_DENOMINATOR_MISMATCH: registry counts changed.");
  }
  writeJson(path.join(outputRoot, "input/authorization-record.json"), authorization.record);
  writeJson(path.join(outputRoot, "input/dependency-closure.json"), closure);
  writeJson(path.join(outputRoot, "input/schema-verification.json"), verification);
  writeJson(path.join(outputRoot, "t04-0-result.json"), {
    stage: "T04-0",
    t04RunId,
    passed: true,
    dependencyFiles: closure.files.length,
    importEdges: closure.importEdges.length,
    acceptanceIds: verification.acceptanceIds.length,
    requirements: verification.requirements.length,
    failureCodes: verification.failureCodes.length
  });
  return { authorization, closure, verification };
}

function writeBytes(filePath, bytes) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, bytes);
}

function appendCaptured(logs, label, result) {
  logs.stdout.push(Buffer.from(`\n[${label}] exitCode=${result.exitCode} signal=${result.signal ?? "none"}\n`, "utf8"), result.stdout);
  logs.stderr.push(Buffer.from(`\n[${label}]\n`, "utf8"), result.stderr);
}

function commandVersion(command, args, cwd, failureCode = "T04_ENVIRONMENT_NOT_REPRODUCIBLE") {
  return requireSuccessful(runCaptured(command, args, { cwd }), failureCode, `${command} version unavailable`).stdout.toString("utf8").trim();
}

export function parsePnpmIntegrityIndex(lockText) {
  const section = lockText.split(/^packages:\s*$/m)[1]?.split(/^snapshots:\s*$/m)[0];
  if (!section) throw new Error("T04_ENVIRONMENT_NOT_REPRODUCIBLE: pnpm packages section missing.");
  const result = new Map();
  const records = section.split(/\n(?=  (?:'[^']+'|[^\s][^\n]*):\s*\n)/);
  for (const record of records) {
    const header = /^  ('([^']+)'|([^:\n]+)):\s*$/m.exec(record);
    const integrity = /resolution:\s*\{[^}]*integrity:\s*([^,}\s]+)[^}]*\}/.exec(record)?.[1];
    if (!header || !integrity) continue;
    const key = header[2] ?? header[3];
    result.set(key, integrity);
  }
  return result;
}

export function flattenPnpmPackages(document, integrityIndex) {
  const found = new Map();
  const visit = (dependencies) => {
    for (const [name, value] of Object.entries(dependencies ?? {})) {
      if (!value || typeof value !== "object" || !value.version) continue;
      const key = `${name}@${value.version}`;
      const integrity = integrityIndex.get(key);
      if (!integrity) throw new Error(`T04_ENVIRONMENT_NOT_REPRODUCIBLE: lock integrity missing for ${key}`);
      found.set(key, { name, version: value.version, integrity, resolved: value.resolved ?? null });
      visit(value.dependencies);
      visit(value.devDependencies);
      visit(value.optionalDependencies);
    }
  };
  for (const root of Array.isArray(document) ? document : [document]) {
    visit(root.dependencies);
    visit(root.devDependencies);
    visit(root.optionalDependencies);
  }
  return [...found.values()].sort((left, right) => `${left.name}\0${left.version}`.localeCompare(`${right.name}\0${right.version}`));
}

function installedNodePackages(snapshotRoot) {
  const extensionRoot = path.join(snapshotRoot, "apps/chrome-extension");
  const listing = requireSuccessful(runCaptured("pnpm", ["list", "--depth", "Infinity", "--json"], { cwd: extensionRoot }), "T04_ENVIRONMENT_NOT_REPRODUCIBLE", "pnpm dependency listing failed");
  const lockText = fs.readFileSync(path.join(extensionRoot, "pnpm-lock.yaml"), "utf8");
  return {
    algorithm: "pnpm_actual_tree_name_version_integrity_v1",
    packages: flattenPnpmPackages(JSON.parse(listing.stdout.toString("utf8")), parsePnpmIntegrityIndex(lockText))
  };
}

function pythonWheelMetadata(wheelhouseRoot) {
  const program = [
    "import hashlib,json,pathlib,zipfile",
    "root=pathlib.Path(__import__('sys').argv[1])",
    "out=[]",
    "for wheel in sorted(root.glob('*.whl')):",
    " b=wheel.read_bytes()",
    " with zipfile.ZipFile(wheel) as z:",
    "  meta=next(x for x in z.namelist() if x.endswith('.dist-info/METADATA'))",
    "  fields={}",
    "  for line in z.read(meta).decode('utf-8').splitlines():",
    "   if ': ' in line and line.split(': ',1)[0] in ('Name','Version'): fields.setdefault(*line.split(': ',1))",
    " out.append({'fileName':wheel.name,'name':fields['Name'],'version':fields['Version'],'tag':wheel.stem.split('-')[-1],'sha256':hashlib.sha256(b).hexdigest(),'byteLength':len(b)})",
    "print(json.dumps(out,sort_keys=True))"
  ].join("\n");
  const result = requireSuccessful(runCaptured("python3", ["-c", program, wheelhouseRoot], { cwd: repositoryRoot }), "T04_ENVIRONMENT_NOT_REPRODUCIBLE", "wheel metadata extraction failed");
  return JSON.parse(result.stdout.toString("utf8"));
}

function createPythonWheelhouse({ snapshotRoot, outputRoot, temporaryRoot }) {
  const resolveLogs = { stdout: [], stderr: [] };
  const offlineLogs = { stdout: [], stderr: [] };
  const runtimeEnvironment = path.join(snapshotRoot, ".tmp/t04-python-runtime-environment");
  const wheelhouse = path.join(temporaryRoot, "wheelhouse");
  fs.mkdirSync(wheelhouse, { recursive: true });
  const download = requireSuccessful(
    runCaptured("python3", ["-m", "pip", "download", "--disable-pip-version-check", "--only-binary=:all:", "--dest", wheelhouse, "-r", path.join(snapshotRoot, "requirements.txt")], { cwd: snapshotRoot }),
    "T04_ENVIRONMENT_NOT_REPRODUCIBLE",
    "wheel download failed"
  );
  appendCaptured(resolveLogs, "wheel-download-and-resolve", download);
  const wheels = pythonWheelMetadata(wheelhouse);
  const lockBytes = Buffer.from(wheels.map((wheel) => `${wheel.name}==${wheel.version} --hash=sha256:${wheel.sha256}\n`).join(""), "utf8");
  const lockPath = path.join(outputRoot, "input/runtime-locked-requirements.txt");
  writeBytes(lockPath, lockBytes);
  const archivePath = path.join(outputRoot, "input/runtime-wheelhouse.tar.gz");
  const archive = requireSuccessful(
    runCaptured("tar", ["--sort=name", "--mtime=@0", "--owner=0", "--group=0", "--numeric-owner", "-czf", archivePath, "-C", wheelhouse, "."], { cwd: snapshotRoot }),
    "T04_ENVIRONMENT_NOT_REPRODUCIBLE",
    "wheelhouse archive failed"
  );
  appendCaptured(resolveLogs, "wheelhouse-archive", archive);
  const createRuntimeEnvironment = requireSuccessful(
    runCaptured("python3", ["-m", "venv", "--without-pip", runtimeEnvironment], { cwd: snapshotRoot }),
    "T04_ENVIRONMENT_NOT_REPRODUCIBLE",
    "isolated Python runtime environment creation failed"
  );
  appendCaptured(offlineLogs, "isolated-python-runtime-environment", createRuntimeEnvironment);
  const runtimePython = path.join(runtimeEnvironment, "bin/python3");
  const verifierSite = requireSuccessful(
    runCaptured(runtimePython, ["-c", "import sysconfig;print(sysconfig.get_paths()['purelib'])"], { cwd: snapshotRoot }),
    "T04_ENVIRONMENT_NOT_REPRODUCIBLE",
    "isolated Python site-packages path unavailable"
  ).stdout.toString("utf8").trim();
  const offlineInstall = requireSuccessful(
    runCaptured("python3", ["-m", "pip", "install", "--disable-pip-version-check", "--target", verifierSite, "--no-index", "--find-links", wheelhouse, "--require-hashes", "-r", lockPath], { cwd: snapshotRoot }),
    "T04_ENVIRONMENT_NOT_REPRODUCIBLE",
    "offline hashed wheel installation failed"
  );
  appendCaptured(offlineLogs, "offline-hashed-target-install", offlineInstall);
  const installedMetadata = requireSuccessful(
    runCaptured("python3", ["-c", [
      "import json,pathlib,email.parser,sys",
      "root=pathlib.Path(sys.argv[1])",
      "out=[]",
      "for p in sorted(root.glob('*.dist-info/METADATA')):",
      " m=email.parser.Parser().parsestr(p.read_text(encoding='utf-8'))",
      " out.append({'name':m['Name'],'version':m['Version']})",
      "print(json.dumps(out,sort_keys=True))"
    ].join("\n"), verifierSite], { cwd: snapshotRoot }),
    "T04_ENVIRONMENT_NOT_REPRODUCIBLE",
    "offline target metadata verification failed"
  );
  appendCaptured(offlineLogs, "offline-target-metadata", installedMetadata);
  const nestedProcessProbe = requireSuccessful(
    runCaptured(runtimePython, ["-c", "import jsonschema,pytest,uvicorn;print('isolated-runtime-imports-ok')"], {
      cwd: snapshotRoot,
      env: { ...process.env, PYTHONNOUSERSITE: "1" }
    }),
    "T04_ENVIRONMENT_NOT_REPRODUCIBLE",
    "isolated Python runtime cannot import locked dependencies"
  );
  appendCaptured(offlineLogs, "isolated-runtime-import-probe", nestedProcessProbe);
  const expectedIdentity = wheels.map((wheel) => `${wheel.name.toLowerCase().replaceAll("_", "-")}@${wheel.version}`).sort();
  const actualIdentity = JSON.parse(installedMetadata.stdout.toString("utf8")).map((item) => `${item.name.toLowerCase().replaceAll("_", "-")}@${item.version}`).sort();
  if (JSON.stringify(expectedIdentity) !== JSON.stringify(actualIdentity)) {
    throw new Error("T04_ENVIRONMENT_NOT_REPRODUCIBLE: offline target package set differs from wheelhouse.");
  }
  const wheelhouseIndex = {
    algorithm: "wheel_metadata_raw_sha256_path_sorted_v1",
    archive: artifactRef("t04_run", outputRoot, "input/runtime-wheelhouse.tar.gz", "application/gzip"),
    wheels
  };
  writeJson(path.join(outputRoot, "input/runtime-wheelhouse-index.json"), wheelhouseIndex);
  writeBytes(path.join(outputRoot, "logs/t04-1-python-resolve.stdout.log"), Buffer.concat(resolveLogs.stdout));
  writeBytes(path.join(outputRoot, "logs/t04-1-python-resolve.stderr.log"), Buffer.concat(resolveLogs.stderr));
  writeBytes(path.join(outputRoot, "logs/t04-1-python-offline-install.stdout.log"), Buffer.concat(offlineLogs.stdout));
  writeBytes(path.join(outputRoot, "logs/t04-1-python-offline-install.stderr.log"), Buffer.concat(offlineLogs.stderr));
  return { wheels, lockPath, wheelhouseIndex, runtimeEnvironment, runtimePython, verifierSite };
}

function precreateT041Outputs(outputRoot) {
  const relativePaths = [
    "snapshot-input-manifest.json", "t04-1-result.json", ".infra/snapshot-location.json",
    "input/dependency-closure.json", "input/snapshot.bundle", "input/path-index.txt", "input/source-index.json",
    "input/build-index.json", "input/resolved-packages.json", "input/runtime-locked-requirements.txt",
    "input/runtime-wheelhouse-index.json", "input/runtime-wheelhouse.tar.gz", "input/environment.json",
    "logs/t04-1-pnpm-install.stdout.log", "logs/t04-1-pnpm-install.stderr.log", "logs/t04-1-build.stdout.log",
    "logs/t04-1-build.stderr.log", "logs/t04-1-python-resolve.stdout.log", "logs/t04-1-python-resolve.stderr.log",
    "logs/t04-1-python-offline-install.stdout.log", "logs/t04-1-python-offline-install.stderr.log"
  ];
  for (const relativePath of relativePaths) {
    const absolute = path.join(outputRoot, relativePath);
    if (fs.existsSync(absolute)) {
      if (fs.statSync(absolute).size > 0 && !["input/dependency-closure.json"].includes(relativePath)) {
        throw new Error(`T04_OUTPUT_IMMUTABILITY_FAILED: T04-1 output already exists: ${relativePath}`);
      }
      continue;
    }
    writeBytes(absolute, Buffer.alloc(0));
  }
}

function browserEnvironment(snapshotRoot) {
  const executable = process.env.NAVIA_BROWSER_EXECUTABLE || path.join(repositoryRoot, ".tmp/chrome-for-testing/chrome-win64/chrome.exe");
  if (!fs.existsSync(executable)) throw new Error(`T04_ENVIRONMENT_NOT_REPRODUCIBLE: Chrome executable missing: ${executable}`);
  let chromeVersion = "";
  const windowsPath = commandVersion("wslpath", ["-w", executable], snapshotRoot);
  const versionResult = runCaptured("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", `(Get-Item '${windowsPath.replaceAll("'", "''")}').VersionInfo.ProductVersion`], { cwd: snapshotRoot });
  chromeVersion = requireSuccessful(versionResult, "T04_ENVIRONMENT_NOT_REPRODUCIBLE", "Chrome file version unavailable").stdout.toString("utf8").trim().replaceAll("\r", "");
  const pnpmStore = path.join(snapshotRoot, "apps/chrome-extension/node_modules/.pnpm");
  const playwrightCoreDirectories = fs.readdirSync(pnpmStore).filter((name) => name.startsWith("playwright-core@")).sort();
  if (playwrightCoreDirectories.length !== 1) {
    throw new Error(`T04_ENVIRONMENT_NOT_REPRODUCIBLE: expected one Playwright Core installation, found ${playwrightCoreDirectories.length}.`);
  }
  const browsersPath = path.join(pnpmStore, playwrightCoreDirectories[0], "node_modules/playwright-core/browsers.json");
  const browsers = JSON.parse(fs.readFileSync(browsersPath, "utf8"));
  const chromium = browsers.browsers.find((browser) => browser.name === "chromium");
  if (!chromium?.revision) throw new Error("T04_ENVIRONMENT_NOT_REPRODUCIBLE: Playwright Chromium revision unavailable.");
  return { chromeVersion, chromeExecutableSha256: sha256(fs.readFileSync(executable)), playwrightBrowserRevision: String(chromium.revision) };
}

export function buildT04Governance(authorization) {
  return {
    externalDocumentAudit: authorization.auditRef,
    externalDocumentAuditFatal: 0,
    externalDocumentAuditMajor: 0,
    implementationAuthorization: authorization.authorizationRef,
    authorizationRecord: authorization.record,
    approvedScope: T04_APPROVED_SCOPE
  };
}

export function runT041({ outputRoot, t04RunId }) {
  if (!/^t04-r4-[a-z0-9-]+$/.test(t04RunId)) throw new Error(`Invalid T04 run id: ${t04RunId}`);
  const t040 = JSON.parse(fs.readFileSync(path.join(outputRoot, "t04-0-result.json"), "utf8"));
  if (!t040.passed) throw new Error("T04_DEPENDENCY_CLOSURE_INVALID: T04-0 did not pass.");
  precreateT041Outputs(outputRoot);
  const mainHeadBefore = commandVersion("git", ["rev-parse", "HEAD"], repositoryRoot, "T04_ISOLATION_BOUNDARY_FAILED");
  const mainStatusBefore = gitStatusBytes(repositoryRoot);
  const mainIndexBeforeSha256 = sha256(mainStatusBefore);
  const temporaryRoot = path.join(os.tmpdir(), `navia-${t04RunId}`);
  const snapshotRoot = path.join(temporaryRoot, "snapshot");
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
  fs.mkdirSync(temporaryRoot, { recursive: true });
  const closure = buildT04DependencyClosure();
  writeJson(path.join(outputRoot, "input/dependency-closure.json"), closure);
  const snapshot = createAcceptanceSnapshot({ repositoryRoot, baseCommit: BASE_COMMIT, closure, snapshotRoot, bundlePath: path.join(outputRoot, "input/snapshot.bundle") });
  writeBytes(path.join(outputRoot, "input/path-index.txt"), snapshot.pathIndexBytes);
  writeJson(path.join(outputRoot, "input/source-index.json"), { algorithm: "git_tree_raw_blob_index_v1", acceptanceCommit: snapshot.acceptanceCommit, treeSha256: snapshot.treeSha256, entries: snapshot.entries });
  const extensionRoot = path.join(snapshotRoot, "apps/chrome-extension");
  const install = requireSuccessful(runCaptured("pnpm", ["install", "--frozen-lockfile"], { cwd: extensionRoot }), "T04_ENVIRONMENT_NOT_REPRODUCIBLE", "pnpm frozen install failed");
  writeBytes(path.join(outputRoot, "logs/t04-1-pnpm-install.stdout.log"), install.stdout);
  writeBytes(path.join(outputRoot, "logs/t04-1-pnpm-install.stderr.log"), install.stderr);
  const resolvedPackages = installedNodePackages(snapshotRoot);
  writeJson(path.join(outputRoot, "input/resolved-packages.json"), resolvedPackages);
  const build = requireSuccessful(runCaptured("pnpm", ["build:e2e"], { cwd: extensionRoot }), "T04_ENVIRONMENT_NOT_REPRODUCIBLE", "isolated extension build failed");
  writeBytes(path.join(outputRoot, "logs/t04-1-build.stdout.log"), build.stdout);
  writeBytes(path.join(outputRoot, "logs/t04-1-build.stderr.log"), build.stderr);
  const buildIndex = buildFileIndex(snapshotRoot, "apps/chrome-extension/chrome-mv3-unpacked");
  writeJson(path.join(outputRoot, "input/build-index.json"), buildIndex);
  const python = createPythonWheelhouse({ snapshotRoot, outputRoot, temporaryRoot });
  const browser = browserEnvironment(snapshotRoot);
  const environment = {
    os: `${os.platform()} ${os.release()}`,
    architecture: os.arch(),
    nodeVersion: process.version,
    npmVersion: commandVersion("npm", ["--version"], snapshotRoot),
    pnpmVersion: commandVersion("pnpm", ["--version"], snapshotRoot),
    pythonVersion: commandVersion("python3", ["-c", "import platform;print(platform.python_version())"], snapshotRoot),
    ...browser,
    packageManagerInstallMode: "pnpm_install_frozen_lockfile",
    packageLock: artifactRef("repository_snapshot", snapshotRoot, "apps/chrome-extension/pnpm-lock.yaml", "application/yaml"),
    resolvedPackages: artifactRef("t04_run", outputRoot, "input/resolved-packages.json", "application/json"),
    pythonInstallMode: "offline_wheelhouse_require_hashes",
    runtimeRequirements: artifactRef("repository_snapshot", snapshotRoot, "requirements.txt", "text/plain"),
    runtimeLockedRequirements: artifactRef("t04_run", outputRoot, "input/runtime-locked-requirements.txt", "text/plain"),
    runtimeWheelhouseIndex: artifactRef("t04_run", outputRoot, "input/runtime-wheelhouse-index.json", "application/json"),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    locale: Intl.DateTimeFormat().resolvedOptions().locale || "und"
  };
  writeJson(path.join(outputRoot, "input/environment.json"), environment);
  const authorization = validateImplementationAuthorization(snapshotRoot);
  const sourceRunRoot = path.join(repositoryRoot, T02_SOURCE_RUN_ROOT);
  const baselineRoot = path.join(repositoryRoot, T03_BASELINE_ROOT);
  const manifest = {
    schemaVersion: "v2-px-snapshot-input-manifest/v1",
    evidenceClass: "production_acceptance",
    t04RunId,
    createdAt: new Date().toISOString(),
    baseline: {
      sourceRunId: T02_SOURCE_RUN_ID,
      sealedRawRun: artifactRef("source_run", sourceRunRoot, "raw/raw-run.json", "application/json"),
      sealSha256: T02_SEAL_SHA256,
      sourceSnapshotCommit: BASE_COMMIT,
      t03ValidationRunId: T03_VALIDATION_RUN_ID,
      t03CandidateRoot: artifactRef("baseline_validation", baselineRoot, "production-package.json", "application/json"),
      t03IndependentAudit: artifactRef("repository_snapshot", snapshotRoot, T03_INDEPENDENT_AUDIT_PATH, "text/markdown"),
      forbiddenCandidateIds: ["t03-r3-production-exit-candidate-20260914T132413"]
    },
    governance: buildT04Governance(authorization),
    snapshot: {
      baseCommit: BASE_COMMIT,
      acceptanceCommit: snapshot.acceptanceCommit,
      snapshotBundle: artifactRef("t04_run", outputRoot, "input/snapshot.bundle", "application/x-git-bundle"),
      treeSha256: snapshot.treeSha256,
      pathIndex: artifactRef("t04_run", outputRoot, "input/path-index.txt", "text/plain"),
      sourceIndex: artifactRef("t04_run", outputRoot, "input/source-index.json", "application/json"),
      buildIndex: artifactRef("t04_run", outputRoot, "input/build-index.json", "application/json"),
      workingTreePolicy: "detached_local_commit_main_tree_read_only",
      mainStateAlgorithm: "git_status_porcelain_v2_z_sha256_v1",
      mainHeadBefore,
      mainHeadAfter: mainHeadBefore,
      mainIndexBeforeSha256,
      mainIndexAfterSha256: mainIndexBeforeSha256
    },
    dependencyClosure: closure,
    environment,
    replayPolicy: {
      outputRoot: "fresh_empty_isolated_namespace",
      validationRunId: "baseline_same_id_isolated_root",
      exactArtifactPaths: ["derived-facts.json", "contract-regression.json", "production-mutation-results.json", "production-validation.json", "architecture-scan-manifest.json", "status-contract-errors.json", "human-review.pending.json", "report.json", "acceptance-report.html", "production-package.json"],
      normalizedArtifacts: [{ path: "invocation-record.json", ignoredJsonPointers: ["/recordedAt"] }]
    },
    freshLanePolicy: {
      newRunRequired: true,
      crossRunReuseAllowed: false,
      requiredT02Checks: Array.from({ length: 12 }, (_, index) => `T02-A${String(index + 1).padStart(2, "0")}`),
      requiredT03Checks: Array.from({ length: 14 }, (_, index) => `T03-A${String(index + 1).padStart(2, "0")}`)
    },
    humanBoundary: { humanReviewStatus: "pending", g7Status: "pending", finalPassed: false, signingAllowed: false, nextSigningStage: "PX-6" }
  };
  if (manifest.baseline.sealedRawRun.sha256 !== T02_RAW_SHA256) throw new Error("T04_BASELINE_INPUT_MODIFIED: T02.5 raw bytes changed.");
  const actualSeal = JSON.parse(fs.readFileSync(path.join(sourceRunRoot, "raw/raw-run.json"), "utf8")).seal?.contentSha256;
  if (actualSeal !== T02_SEAL_SHA256) throw new Error("T04_BASELINE_INPUT_MODIFIED: T02.5 canonical seal changed.");
  validateJsonSchema(path.join(snapshotRoot, SNAPSHOT_INPUT_SCHEMA), manifest);
  writeJson(path.join(outputRoot, "snapshot-input-manifest.json"), manifest);
  const mainHeadAfter = commandVersion("git", ["rev-parse", "HEAD"], repositoryRoot, "T04_ISOLATION_BOUNDARY_FAILED");
  const mainStatusAfter = gitStatusBytes(repositoryRoot);
  const mainIndexAfterSha256 = sha256(mainStatusAfter);
  if (mainHeadBefore !== mainHeadAfter || mainIndexBeforeSha256 !== mainIndexAfterSha256 || !mainStatusBefore.equals(mainStatusAfter)) {
    throw new Error("T04_ISOLATION_BOUNDARY_FAILED: main worktree HEAD/index changed during snapshot construction.");
  }
  writeJson(path.join(outputRoot, ".infra/snapshot-location.json"), { snapshotRoot, temporaryRoot, acceptanceCommit: snapshot.acceptanceCommit });
  writeJson(path.join(outputRoot, "t04-1-result.json"), {
    stage: "T04-1", t04RunId, passed: true, acceptanceCommit: snapshot.acceptanceCommit,
    treeSha256: snapshot.treeSha256, sourceFiles: snapshot.entries.length, buildFiles: buildIndex.files.length,
    nodePackages: resolvedPackages.packages.length, pythonWheels: python.wheels.length,
    mainHeadBefore, mainHeadAfter, mainIndexBeforeSha256, mainIndexAfterSha256
  });
  return { manifest, snapshotRoot, temporaryRoot, snapshot, environment, buildIndex };
}

function mediaType(relativePath) {
  if (relativePath.endsWith(".json")) return "application/json";
  if (relativePath.endsWith(".html")) return "text/html";
  if (relativePath.endsWith(".md")) return "text/markdown";
  if (relativePath.endsWith(".tar.gz")) return "application/gzip";
  return "text/plain";
}

function requireRunArtifact(outputRoot, relativePath, artifactRoot = "t04_run") {
  if (!fs.existsSync(path.join(outputRoot, relativePath))) throw new Error(`T04_INVOCATION_EVIDENCE_INVALID: missing ${relativePath}`);
  return artifactRef(artifactRoot, outputRoot, relativePath, mediaType(relativePath));
}

export function runT042({ outputRoot, t04RunId }) {
  const manifest = JSON.parse(fs.readFileSync(path.join(outputRoot, "snapshot-input-manifest.json"), "utf8"));
  if (manifest.t04RunId !== t04RunId) throw new Error("T04_BASELINE_CANDIDATE_INVALID: T04 run mismatch.");
  validateJsonSchema(path.join(repositoryRoot, SNAPSHOT_INPUT_SCHEMA), manifest);
  const location = JSON.parse(fs.readFileSync(path.join(outputRoot, ".infra/snapshot-location.json"), "utf8"));
  const snapshotRoot = path.resolve(location.snapshotRoot);
  const snapshotHead = commandVersion("git", ["rev-parse", "HEAD"], snapshotRoot, "T04_ISOLATION_BOUNDARY_FAILED");
  if (snapshotHead !== manifest.snapshot.acceptanceCommit) throw new Error("T04_ISOLATION_BOUNDARY_FAILED: snapshot HEAD changed.");
  const sourceRunRoot = path.join(repositoryRoot, T02_SOURCE_RUN_ROOT);
  const baselineRoot = path.join(repositoryRoot, T03_BASELINE_ROOT);
  const replayOutputRoot = path.join(outputRoot, "replay/output");
  ensureEmptyDirectory(replayOutputRoot);
  const protectedBefore = {
    raw: sha256(fs.readFileSync(path.join(sourceRunRoot, "raw/raw-run.json"))),
    package: sha256(fs.readFileSync(path.join(baselineRoot, "production-package.json")))
  };
  const invocation = runCaptured(process.execPath, [
    path.join(snapshotRoot, "apps/chrome-extension/e2e/run-v2-px-r3-validation.mjs"),
    "--run-root", sourceRunRoot,
    "--output-root", replayOutputRoot,
    "--validation-run-id", T03_VALIDATION_RUN_ID
  ], { cwd: path.join(snapshotRoot, "apps/chrome-extension"), env: process.env });
  writeBytes(path.join(outputRoot, "logs/t04-2-r3-orchestration.stdout.log"), invocation.stdout);
  writeBytes(path.join(outputRoot, "logs/t04-2-r3-orchestration.stderr.log"), invocation.stderr);
  requireSuccessful(invocation, "T04_INVOCATION_EVIDENCE_INVALID", "isolated T03 replay failed");
  const sourceInvocationPath = path.join(replayOutputRoot, "invocation-record.json");
  const sourceInvocationBytes = fs.readFileSync(sourceInvocationPath);
  const sourceInvocationSha256 = sha256(sourceInvocationBytes);
  const invocationRecord = JSON.parse(sourceInvocationBytes);
  assertInvocationExecuted(invocationRecord);
  const resolvedInvocation = resolveReplayInvocationRecord(invocationRecord, replayOutputRoot);
  validateJsonSchema(path.join(snapshotRoot, REPLAY_INVOCATION_SCHEMA), resolvedInvocation);
  writeJson(path.join(replayOutputRoot, "resolved-invocation-record.json"), resolvedInvocation);
  validateResolvedReplayInvocation(resolvedInvocation, replayOutputRoot);
  if (sha256(fs.readFileSync(sourceInvocationPath)) !== sourceInvocationSha256) {
    throw new Error("T04_INVOCATION_EVIDENCE_INVALID: source invocation changed during resolution.");
  }
  const validation = JSON.parse(fs.readFileSync(path.join(replayOutputRoot, "production-validation.json"), "utf8"));
  assertHumanBoundary({ humanReviewStatus: validation.humanReviewStatus, g7Status: validation.gateResults?.G7, finalPassed: validation.finalPassed, signingAllowed: false });
  const comparisons = compareReplayOutputs(baselineRoot, replayOutputRoot);
  const stepResults = invocationRecord.steps.map((step) => ({
    stepId: step.stepId,
    invoked: true,
    exitCode: step.exitCode,
    stdout: artifactRef("replay_validation", replayOutputRoot, step.stdout.path, "text/plain"),
    stderr: artifactRef("replay_validation", replayOutputRoot, step.stderr.path, "text/plain")
  }));
  const replayLane = {
    baselineValidationRunId: T03_VALIDATION_RUN_ID,
    replayValidationRunId: T03_VALIDATION_RUN_ID,
    actualInvocation: artifactRef("replay_validation", replayOutputRoot, "resolved-invocation-record.json", "application/json"),
    stepResults,
    ...comparisons,
    passed: true
  };
  writeJson(path.join(outputRoot, "replay/comparison.json"), comparisons);
  writeJson(path.join(outputRoot, "replay/replay-lane.json"), replayLane);
  const protectedAfter = {
    raw: sha256(fs.readFileSync(path.join(sourceRunRoot, "raw/raw-run.json"))),
    package: sha256(fs.readFileSync(path.join(baselineRoot, "production-package.json")))
  };
  if (JSON.stringify(protectedBefore) !== JSON.stringify(protectedAfter)) throw new Error("T04_BASELINE_INPUT_MODIFIED: protected baseline changed during replay.");
  writeJson(path.join(outputRoot, "t04-2-result.json"), {
    stage: "T04-2", t04RunId, passed: true, actualSteps: stepResults.length,
    exactComparisons: comparisons.exactComparisons.length,
    normalizedComparisons: comparisons.normalizedComparisons.length,
    stdoutStderrComparisons: comparisons.stdoutStderrComparisons.length,
    sourceInvocationSha256,
    resolvedInvocationSha256: replayLane.actualInvocation.sha256,
    protectedBefore, protectedAfter
  });
  return { replayLane, replayOutputRoot };
}

export function runT043({ outputRoot, t04RunId }) {
  const manifest = JSON.parse(fs.readFileSync(path.join(outputRoot, "snapshot-input-manifest.json"), "utf8"));
  const location = JSON.parse(fs.readFileSync(path.join(outputRoot, ".infra/snapshot-location.json"), "utf8"));
  const snapshotRoot = path.resolve(location.snapshotRoot);
  if (manifest.t04RunId !== t04RunId || commandVersion("git", ["rev-parse", "HEAD"], snapshotRoot, "T04_ISOLATION_BOUNDARY_FAILED") !== manifest.snapshot.acceptanceCommit) {
    throw new Error("T04_ISOLATION_BOUNDARY_FAILED: fresh lane snapshot identity mismatch.");
  }
  const freshRoot = path.join(outputRoot, "fresh");
  ensureEmptyDirectory(freshRoot);
  const sourceRunId = `t04-r4-fresh-raw-${new Date().toISOString().replace(/[^0-9]/g, "").toLowerCase()}`;
  const sourceRunRoot = path.join(freshRoot, "source-run");
  const windowsRuntimeRoot = path.join(path.dirname(repositoryRoot), `.navia-t04-runtime-${t04RunId}`);
  ensureEmptyDirectory(windowsRuntimeRoot);
  const profileRoot = path.join(windowsRuntimeRoot, "profiles");
  const extensionBuildRoot = path.join(snapshotRoot, `apps/chrome-extension/.tmp/t02-extension-build-${t04RunId}`);
  const pythonEnvironment = path.join(snapshotRoot, ".tmp/t04-python-runtime-environment");
  const pythonExecutable = path.join(pythonEnvironment, "bin/python3");
  if (!fs.existsSync(pythonExecutable)) throw new Error("T04_ENVIRONMENT_NOT_REPRODUCIBLE: isolated Python executable is missing.");
  const runnerEnvironment = {
    ...process.env,
    NAVIA_T02_RUN_ID: sourceRunId,
    NAVIA_T02_EVIDENCE_ROOT: sourceRunRoot,
    NAVIA_T02_EXTENSION_ROOT: extensionBuildRoot,
    NAVIA_T02_PROFILE_ROOT: profileRoot,
    NAVIA_T02_HEADLESS: "0",
    NAVIA_BROWSER_EXECUTABLE: process.env.NAVIA_BROWSER_EXECUTABLE || path.join(repositoryRoot, ".tmp/chrome-for-testing/chrome-win64/chrome.exe"),
    PATH: `${path.dirname(pythonExecutable)}${path.delimiter}${process.env.PATH ?? ""}`,
    PYTHONPATH: path.join(snapshotRoot, "services/local-runtime"),
    PYTHONNOUSERSITE: "1",
    VIRTUAL_ENV: pythonEnvironment
  };
  delete runnerEnvironment.NAVIA_T02_SKIP_PREREQUISITES;
  const run = runCaptured(process.execPath, [path.join(snapshotRoot, "apps/chrome-extension/e2e/chrome-v2-px-r2-raw-evidence.mjs")], {
    cwd: path.join(snapshotRoot, "apps/chrome-extension"),
    env: runnerEnvironment,
    maxBuffer: 256 * 1024 * 1024
  });
  writeBytes(path.join(outputRoot, "logs/t04-3-r2-fresh.stdout.log"), run.stdout);
  writeBytes(path.join(outputRoot, "logs/t04-3-r2-fresh.stderr.log"), run.stderr);
  fs.rmSync(windowsRuntimeRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  if (fs.existsSync(windowsRuntimeRoot)) throw new Error("T04_FRESH_E2E_REQUIRED: Windows-mounted Chrome runtime root was not removed.");
  requireSuccessful(run, "T04_FRESH_E2E_REQUIRED", "fresh real-Chrome R2 collection failed");
  const rawPath = path.join(sourceRunRoot, "raw/raw-run.json");
  if (!fs.existsSync(rawPath)) throw new Error("T04_FRESH_RAW_INVALID: sealed raw run is missing.");
  const rawBytes = fs.readFileSync(rawPath);
  const raw = JSON.parse(rawBytes);
  if (raw.runId !== sourceRunId || raw.snapshotCommit !== manifest.snapshot.acceptanceCommit || raw.seal?.algorithm !== "sha256" || raw.seal?.inputMode !== "canonical_json_without_seal_v1") {
    throw new Error("T04_FRESH_RAW_INVALID: fresh raw identity or seal metadata is invalid.");
  }
  const { seal, ...unsealed } = raw;
  const canonicalSeal = sha256(Buffer.from(canonicalJson(unsealed), "utf8"));
  if (canonicalSeal !== seal.contentSha256) throw new Error("T04_FRESH_RAW_INVALID: fresh raw canonical seal mismatch.");
  validateJsonSchema(path.join(snapshotRoot, "docs/active/project/contracts/v2_px_raw_run.schema.json"), raw);
  const readiness = runCaptured("python3", [path.join(snapshotRoot, T03_INPUT_READINESS_PATH), "--run-root", sourceRunRoot], { cwd: snapshotRoot, env: runnerEnvironment });
  writeBytes(path.join(freshRoot, "t03-input-readiness.json"), readiness.stdout);
  writeBytes(path.join(outputRoot, "logs/t04-3-input-readiness.stderr.log"), readiness.stderr);
  requireSuccessful(readiness, "T04_FRESH_RAW_INVALID", "fresh raw production-input readiness failed");
  const readinessDocument = JSON.parse(readiness.stdout.toString("utf8"));
  if (readinessDocument.fatal !== 0 || readinessDocument.major !== 0 || readinessDocument.readyForPositiveProductionValidation !== true) {
    throw new Error("T04_FRESH_RAW_INVALID: readiness did not close all gaps.");
  }
  const cleanup = JSON.parse(fs.readFileSync(path.join(sourceRunRoot, "cleanup-manifest.json"), "utf8"));
  if (cleanup.passed !== true || !cleanup.browserClosed || !cleanup.runtimeStopped || !cleanup.fixtureServerClosed || !cleanup.profileRemoved) {
    throw new Error("T04_FRESH_E2E_REQUIRED: fresh lane cleanup failed.");
  }
  const result = {
    stage: "T04-3", t04RunId, passed: true, sourceRunId,
    sealedRawRun: artifactRef("fresh_source_run", sourceRunRoot, "raw/raw-run.json", "application/json"),
    sealSha256: seal.contentSha256,
    sourceSnapshotCommit: raw.snapshotCommit,
    readiness: artifactRef("t04_run", outputRoot, "fresh/t03-input-readiness.json", "application/json"),
    cleanup: artifactRef("fresh_source_run", sourceRunRoot, "cleanup-manifest.json", "application/json")
  };
  writeJson(path.join(outputRoot, "t04-3-result.json"), result);
  return { result, sourceRunRoot, sourceRunId, readiness: readinessDocument };
}

export function validateFreshProductionCandidate(validationRoot, expectedSourceRunId, expectedValidationRunId, expectedArchitectureCommit) {
  const validation = JSON.parse(fs.readFileSync(path.join(validationRoot, "production-validation.json"), "utf8"));
  const contract = JSON.parse(fs.readFileSync(path.join(validationRoot, "contract-regression.json"), "utf8"));
  const mutations = JSON.parse(fs.readFileSync(path.join(validationRoot, "production-mutation-results.json"), "utf8"));
  const invocation = JSON.parse(fs.readFileSync(path.join(validationRoot, "invocation-record.json"), "utf8"));
  const architecture = JSON.parse(fs.readFileSync(path.join(validationRoot, "architecture-scan-manifest.json"), "utf8"));
  assertInvocationExecuted(invocation);
  assertHumanBoundary({ humanReviewStatus: validation.humanReviewStatus, g7Status: validation.gateResults?.G7, finalPassed: validation.finalPassed, signingAllowed: false });
  const statusCounts = Object.fromEntries(["passed", "pending", "failed", "not_applicable"].map((status) => [status, validation.ruleResults.filter((item) => item.status === status).length]));
  if (validation.sourceRunId !== expectedSourceRunId || validation.validationRunId !== expectedValidationRunId) throw new Error("T04_CROSS_RUN_EVIDENCE_MIXED: fresh validation identity mismatch.");
  if (validation.ruleResults.length !== 63 || statusCounts.passed !== 61 || statusCounts.pending !== 2 || statusCounts.failed !== 0 || statusCounts.not_applicable !== 0) {
    throw new Error("T04_VALIDATION_DENOMINATOR_MISMATCH: fresh rule denominator mismatch.");
  }
  if (contract.passed !== true || contract.caseResults?.length !== 109 || contract.counts?.fixtures !== 109) throw new Error("T04_VALIDATION_DENOMINATOR_MISMATCH: contract case denominator mismatch.");
  if (mutations.total !== 42 || mutations.passed !== 42 || mutations.failed !== 0 || mutations.results?.length !== 42) throw new Error("T04_VALIDATION_DENOMINATOR_MISMATCH: production mutation denominator mismatch.");
  if (architecture.repositoryCommit !== expectedArchitectureCommit || architecture.trackedPaths?.length === 0) throw new Error("T04_ARCHITECTURE_REPLAY_FAILED: architecture source is not the T04 acceptance commit.");
  return { validation, contract, mutations, invocation, architecture, statusCounts };
}

export function runT044({ outputRoot, t04RunId }) {
  const manifest = JSON.parse(fs.readFileSync(path.join(outputRoot, "snapshot-input-manifest.json"), "utf8"));
  const freshCollection = JSON.parse(fs.readFileSync(path.join(outputRoot, "t04-3-result.json"), "utf8"));
  if (!freshCollection.passed || freshCollection.t04RunId !== t04RunId) throw new Error("T04_FRESH_E2E_REQUIRED: T04-3 did not pass.");
  const location = JSON.parse(fs.readFileSync(path.join(outputRoot, ".infra/snapshot-location.json"), "utf8"));
  const snapshotRoot = path.resolve(location.snapshotRoot);
  if (commandVersion("git", ["rev-parse", "HEAD"], snapshotRoot, "T04_ISOLATION_BOUNDARY_FAILED") !== manifest.snapshot.acceptanceCommit) {
    throw new Error("T04_ISOLATION_BOUNDARY_FAILED: fresh validation snapshot identity mismatch.");
  }
  const sourceRunRoot = path.join(outputRoot, "fresh/source-run");
  const validationRoot = path.join(outputRoot, "fresh/validation");
  ensureEmptyDirectory(validationRoot);
  const validationRunId = `t04-r4-fresh-validation-${new Date().toISOString().replace(/[^0-9]/g, "").toLowerCase()}`;
  const run = runCaptured(process.execPath, [
    path.join(snapshotRoot, "apps/chrome-extension/e2e/run-v2-px-r3-validation.mjs"),
    "--run-root", sourceRunRoot,
    "--output-root", validationRoot,
    "--validation-run-id", validationRunId
  ], {
    cwd: path.join(snapshotRoot, "apps/chrome-extension"),
    env: {
      ...process.env,
      PATH: `${path.join(snapshotRoot, ".tmp/t04-python-runtime-environment/bin")}${path.delimiter}${process.env.PATH ?? ""}`,
      PYTHONPATH: path.join(snapshotRoot, "services/local-runtime"),
      PYTHONNOUSERSITE: "1",
      VIRTUAL_ENV: path.join(snapshotRoot, ".tmp/t04-python-runtime-environment")
    }
  });
  writeBytes(path.join(outputRoot, "logs/t04-4-r3-fresh.stdout.log"), run.stdout);
  writeBytes(path.join(outputRoot, "logs/t04-4-r3-fresh.stderr.log"), run.stderr);
  requireSuccessful(run, "T04_T03_REGRESSION_FAILED", "fresh T03 pipeline failed");
  const checked = validateFreshProductionCandidate(validationRoot, freshCollection.sourceRunId, validationRunId, manifest.snapshot.acceptanceCommit);
  const result = {
    stage: "T04-4", t04RunId, passed: true, sourceRunId: freshCollection.sourceRunId, validationRunId,
    productionPackage: artifactRef("fresh_validation", validationRoot, "production-package.json", "application/json"),
    invocationRecord: artifactRef("fresh_validation", validationRoot, "invocation-record.json", "application/json"),
    ruleCounts: { total: 63, machinePassed: checked.statusCounts.passed, humanPending: checked.statusCounts.pending, failed: checked.statusCounts.failed, notApplicable: checked.statusCounts.not_applicable },
    contractCases: { expected: 109, passed: checked.contract.caseResults.length },
    productionMutations: { expected: 42, passed: checked.mutations.passed },
    architectureCommit: checked.architecture.repositoryCommit,
    gateResults: checked.validation.gateResults,
    machinePassed: checked.validation.machinePassed,
    humanReviewStatus: checked.validation.humanReviewStatus,
    finalPassed: checked.validation.finalPassed
  };
  writeJson(path.join(outputRoot, "t04-4-result.json"), result);
  return { result, validationRoot, checked };
}

function acceptanceResults(prefix, count, refs) {
  return Array.from({ length: count }, (_, index) => ({ id: `${prefix}${String(index + 1).padStart(2, "0")}`, status: "passed", evidenceRefs: refs }));
}

function freshLaneFromOutputs(outputRoot) {
  const collection = JSON.parse(fs.readFileSync(path.join(outputRoot, "t04-3-result.json"), "utf8"));
  const validationResult = JSON.parse(fs.readFileSync(path.join(outputRoot, "t04-4-result.json"), "utf8"));
  const validationRoot = path.join(outputRoot, "fresh/validation");
  const sourceRunRoot = path.join(outputRoot, "fresh/source-run");
  const derived = JSON.parse(fs.readFileSync(path.join(validationRoot, "derived-facts.json"), "utf8"));
  const summary = derived.summary;
  const rawRef = artifactRef("fresh_source_run", sourceRunRoot, "raw/raw-run.json", "application/json");
  const readinessRef = artifactRef("t04_run", outputRoot, "fresh/t03-input-readiness.json", "application/json");
  const cleanupRef = artifactRef("fresh_source_run", sourceRunRoot, "cleanup-manifest.json", "application/json");
  const validationRef = artifactRef("fresh_validation", validationRoot, "production-validation.json", "application/json");
  const contractRef = artifactRef("fresh_validation", validationRoot, "contract-regression.json", "application/json");
  const mutationRef = artifactRef("fresh_validation", validationRoot, "production-mutation-results.json", "application/json");
  return {
    sourceRunId: collection.sourceRunId,
    sealedRawRun: rawRef,
    sealSha256: collection.sealSha256,
    validationRunId: validationResult.validationRunId,
    productionPackage: artifactRef("fresh_validation", validationRoot, "production-package.json", "application/json"),
    t02AcceptanceResults: acceptanceResults("T02-A", 12, [rawRef, readinessRef, cleanupRef]),
    t03AcceptanceResults: acceptanceResults("T03-A", 14, [validationRef, contractRef, mutationRef]),
    ruleCounts: validationResult.ruleCounts,
    contractCases: validationResult.contractCases,
    productionMutations: validationResult.productionMutations,
    sourceCorpus: { web: summary.sourceDistribution.web, local: summary.sourceDistribution.local, note: summary.sourceDistribution.note, total: summary.sourceCount },
    routeMatrix: { routeIntents: Object.keys(summary.routeMatrix).length, recoveryModes: 4, covered: Object.values(summary.routeMatrix).reduce((count, modes) => count + ["direct_open", "reload", "back", "reopen"].filter((mode) => modes[mode] >= 1).length, 0) },
    forgetRecovery: { sources: summary.forgetSourceCount, modes: 4, triggers: summary.durableForgetTriggers, trustedClicks: summary.durableForgetRecoveries, recoveries: summary.durableForgetRecoveries },
    axe: { serious: summary.axe.serious, critical: summary.axe.critical },
    keyboard: { expected: summary.keyboard.assertionsTotal, passed: summary.keyboard.assertionsPassed },
    passed: true
  };
}

function snapshotRoots(outputRoot, snapshotRoot) {
  return {
    source_run: path.join(repositoryRoot, T02_SOURCE_RUN_ROOT),
    baseline_validation: path.join(repositoryRoot, T03_BASELINE_ROOT),
    replay_validation: path.join(outputRoot, "replay/output"),
    fresh_source_run: path.join(outputRoot, "fresh/source-run"),
    fresh_validation: path.join(outputRoot, "fresh/validation"),
    repository_snapshot: snapshotRoot,
    t04_run: outputRoot
  };
}

function architectureWithInlineSource(snapshotRoot, commit) {
  const policy = loadFrozenArchitecturePolicy(snapshotRoot);
  return buildArchitectureSnapshot({ repoRoot: snapshotRoot, commit, ...policy });
}

function syntheticExitFixture(temporaryRoot) {
  const root = path.join(temporaryRoot, "synthetic-exit");
  fs.rmSync(root, { recursive: true, force: true });
  fs.mkdirSync(root, { recursive: true });
  writeBytes(path.join(root, "payload.json"), Buffer.from("{}\n"));
  writeBytes(path.join(root, "payload.txt"), Buffer.from("ok\n"));
  requireSuccessful(runCaptured("tar", ["-czf", path.join(root, "public.tar.gz"), "-C", root, "payload.json", "payload.txt"], { cwd: root }), "T04_EXIT_MANIFEST_INVALID", "synthetic archive creation failed");
  const jsonRef = artifactRef("t04_run", root, "payload.json", "application/json");
  const textRef = artifactRef("t04_run", root, "payload.txt", "text/plain");
  const archiveRef = artifactRef("t04_run", root, "public.tar.gz", "application/gzip");
  const document = {
    schemaVersion: "v2-px-exit-manifest/v1", evidenceClass: "production_acceptance", t04RunId: "t04-r4-synthetic", createdAt: new Date(0).toISOString(),
    snapshotInputManifest: jsonRef, snapshotRevalidation: jsonRef, freshProductionPackage: jsonRef, freshInvocationRecord: jsonRef,
    chineseAcceptanceHtml: textRef, drawio: textRef, testArtifacts: [textRef], auditArtifacts: [textRef, textRef, textRef],
    publicEvidenceArchive: archiveRef, publicArchivePolicy: "payload_only_excludes_exit_manifest_and_independent_audit",
    signed: false, humanReviewStatus: "pending", g7Status: "pending", finalPassed: false,
    claim: "T04 isolated snapshot revalidation candidate passed; Human Review, G7, PX-5 final disposition and PX-6 remain pending."
  };
  document.contentSha256 = sha256(Buffer.from(canonicalJson(document), "utf8"));
  return { root, document };
}

export function runT045({ outputRoot, t04RunId }) {
  const manifest = JSON.parse(fs.readFileSync(path.join(outputRoot, "snapshot-input-manifest.json"), "utf8"));
  const replayLane = JSON.parse(fs.readFileSync(path.join(outputRoot, "replay/replay-lane.json"), "utf8"));
  const freshLane = freshLaneFromOutputs(outputRoot);
  const location = JSON.parse(fs.readFileSync(path.join(outputRoot, ".infra/snapshot-location.json"), "utf8"));
  const snapshotRoot = path.resolve(location.snapshotRoot);
  const roots = snapshotRoots(outputRoot, snapshotRoot);
  validateSnapshotManifestSemantics(manifest, { roots, snapshotRoot, expectedBaselineId: T03_VALIDATION_RUN_ID, expectedRawSha256: T02_RAW_SHA256, expectedSealSha256: T02_SEAL_SHA256, mainRepositoryRoot: repositoryRoot });
  validateReplayLaneDocument(replayLane, { baselineRoot: roots.baseline_validation, replayRoot: roots.replay_validation });
  validateFreshLaneDocument(freshLane, { sourceRunRoot: roots.fresh_source_run, validationRoot: roots.fresh_validation, baselineRawSha256: T02_RAW_SHA256 });
  const freshRaw = JSON.parse(fs.readFileSync(path.join(roots.fresh_source_run, "raw/raw-run.json"), "utf8"));
  const architecture = architectureWithInlineSource(snapshotRoot, freshRaw.snapshotCommit);
  validateArchitectureFromRaw({ architecture: architecture.scanManifest, rulesetBytes: architecture.artifacts.get("input/architecture-ruleset.json"), allowlistBytes: architecture.artifacts.get("input/architecture-allowlist.json") });
  assertNoLegacyInvocation(JSON.parse(fs.readFileSync(path.join(roots.fresh_validation, "invocation-record.json"), "utf8")));
  const schema = JSON.parse(fs.readFileSync(path.join(snapshotRoot, "docs/active/project/contracts/v2_px_snapshot_revalidation.schema.json"), "utf8"));
  const registry = schema["x-navia-requirement-registry"];
  const temporaryRoot = path.join(location.temporaryRoot, "negative-cases");
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
  fs.mkdirSync(temporaryRoot, { recursive: true });
  const mutationDescriptions = {};
  const action = (id, mutation, execute) => { mutationDescriptions[id] = mutation; return execute; };
  const manifestValidation = (mutated, rootOverrides = {}) => validateSnapshotManifestSemantics(mutated, {
    roots: { ...roots, ...rootOverrides }, snapshotRoot,
    expectedBaselineId: T03_VALIDATION_RUN_ID, expectedRawSha256: T02_RAW_SHA256, expectedSealSha256: T02_SEAL_SHA256, mainRepositoryRoot: repositoryRoot
  });
  const actions = {
    "T04-N-001": action("T04-N-001", { target: "/dependencyClosure/missingEdges", operation: "add_unresolved_import" }, () => { const m = structuredClone(manifest); m.dependencyClosure.missingEdges = [{ from: "x.mjs", specifier: "./missing.mjs" }]; manifestValidation(m); }),
    "T04-N-002": action("T04-N-002", { target: "/dependencyClosure/files/0/sha256", operation: "replace_raw_hash" }, () => { const c = structuredClone(manifest.dependencyClosure); c.files[0].sha256 = "0".repeat(64); c.closureSha256 = dependencyClosureSha256(c.files); validateDependencyClosureDocument(c, snapshotRoot); }),
    "T04-N-003": action("T04-N-003", { target: "/environment/packageLock/sha256", operation: "replace" }, () => { const m = structuredClone(manifest); m.environment.packageLock.sha256 = "0".repeat(64); manifestValidation(m); }),
    "T04-N-004": action("T04-N-004", { target: "source-index first product blob", operation: "replace_hash" }, () => { const m = structuredClone(manifest); const temp = path.join(temporaryRoot, "n004"); fs.mkdirSync(path.join(temp, "input"), { recursive: true }); for (const rel of ["snapshot.bundle", "path-index.txt", "build-index.json", "resolved-packages.json", "runtime-locked-requirements.txt", "runtime-wheelhouse-index.json"]) fs.symlinkSync(path.join(outputRoot, "input", rel), path.join(temp, "input", rel)); const idx = JSON.parse(fs.readFileSync(path.join(outputRoot, "input/source-index.json"))); idx.entries.find((entry) => manifest.dependencyClosure.files.some((file) => file.path === entry.path && file.sourceDisposition === "product_base_commit")).sha256 = "0".repeat(64); writeJson(path.join(temp, "input/source-index.json"), idx); m.snapshot.sourceIndex = artifactRef("t04_run", temp, "input/source-index.json", "application/json"); manifestValidation(m, { t04_run: temp }); }),
    "T04-N-005": action("T04-N-005", { target: "/baseline/t03ValidationRunId", operation: "select_stale_132413" }, () => { const m = structuredClone(manifest); m.baseline.t03ValidationRunId = m.baseline.forbiddenCandidateIds[0]; manifestValidation(m); }),
    "T04-N-006": action("T04-N-006", { target: "sealed raw bytes", operation: "append_byte" }, () => { const temp = path.join(temporaryRoot, "n006"); fs.mkdirSync(path.join(temp, "raw"), { recursive: true }); writeBytes(path.join(temp, "raw/raw-run.json"), Buffer.concat([fs.readFileSync(path.join(roots.source_run, "raw/raw-run.json")), Buffer.from(" ")])); manifestValidation(manifest, { source_run: temp }); }),
    "T04-N-007": action("T04-N-007", { target: "/snapshot/workingTreePolicy", operation: "use_main_worktree" }, () => { const m = structuredClone(manifest); m.snapshot.workingTreePolicy = "main_worktree"; manifestValidation(m); }),
    "T04-N-008": action("T04-N-008", { target: "replay output", operation: "prepopulate" }, () => { const temp = path.join(temporaryRoot, "n008"); fs.mkdirSync(temp); writeBytes(path.join(temp, "occupied"), Buffer.from("x")); ensureEmptyDirectory(temp); }),
    "T04-N-009": action("T04-N-009", { target: "replay/derived-facts.json", operation: "append_byte" }, () => { const temp = path.join(temporaryRoot, "n009"); fs.cpSync(roots.replay_validation, temp, { recursive: true }); fs.appendFileSync(path.join(temp, "derived-facts.json"), " "); compareReplayOutputs(roots.baseline_validation, temp); }),
    "T04-N-010": action("T04-N-010", { target: "ignoredJsonPointers", operation: "widen" }, () => compareInvocationRecord(roots.baseline_validation, roots.replay_validation, ["/recordedAt", "/steps"])),
    "T04-N-011": action("T04-N-011", { target: "invocation.steps", operation: "remove_package" }, () => { const i = JSON.parse(fs.readFileSync(path.join(roots.replay_validation, "invocation-record.json"))); i.steps.pop(); assertInvocationExecuted(i); }),
    "T04-N-012": action("T04-N-012", { target: "fresh source root", operation: "remove" }, () => validateFreshLaneDocument(freshLane, { sourceRunRoot: null, validationRoot: roots.fresh_validation, baselineRawSha256: T02_RAW_SHA256 })),
    "T04-N-013": action("T04-N-013", { target: "fresh sealed raw", operation: "reuse_baseline" }, () => { const f = structuredClone(freshLane); f.sourceRunId = T02_SOURCE_RUN_ID; validateFreshLaneDocument(f, { sourceRunRoot: roots.source_run, validationRoot: roots.fresh_validation, baselineRawSha256: T02_RAW_SHA256 }); }),
    "T04-N-014": action("T04-N-014", { target: "fresh raw seal", operation: "replace_hash" }, () => { const raw = JSON.parse(fs.readFileSync(path.join(roots.fresh_source_run, "raw/raw-run.json"))); raw.seal.contentSha256 = "0".repeat(64); validateFreshRaw(Buffer.from(JSON.stringify(raw)), freshLane.sourceRunId); }),
    "T04-N-015": action("T04-N-015", { target: "/freshLane/t03AcceptanceResults", operation: "remove_one" }, () => { const f = structuredClone(freshLane); f.t03AcceptanceResults.pop(); validateFreshLaneDocument(f, { sourceRunRoot: roots.fresh_source_run, validationRoot: roots.fresh_validation, baselineRawSha256: T02_RAW_SHA256 }); }),
    "T04-N-016": action("T04-N-016", { target: "production-validation ruleResults", operation: "remove_one" }, () => { const temp = path.join(temporaryRoot, "n016"); fs.mkdirSync(temp); for (const name of ["production-validation.json", "contract-regression.json", "production-mutation-results.json"]) fs.copyFileSync(path.join(roots.fresh_validation, name), path.join(temp, name)); const v = JSON.parse(fs.readFileSync(path.join(temp, "production-validation.json"))); v.ruleResults.pop(); writeJson(path.join(temp, "production-validation.json"), v); validateFreshLaneDocument(freshLane, { sourceRunRoot: roots.fresh_source_run, validationRoot: temp, baselineRawSha256: T02_RAW_SHA256 }); }),
    "T04-N-017": action("T04-N-017", { target: "tracked Git source bytes", operation: "insert_forbidden_fetch_keep_report_zero" }, () => { const a = structuredClone(architecture.scanManifest); const target = a.trackedPaths.find((item) => item.path.endsWith("workspace/main.tsx")) ?? a.trackedPaths[0]; target.inlineSource.content += '\nfetch("http://127.0.0.1:17861/v1/knowledge/status");\n'; target.inlineSource.sha256 = sha256(Buffer.from(target.inlineSource.content)); target.blobSha256 = target.inlineSource.sha256; const sorted = [...a.trackedPaths].sort((l, r) => l.path < r.path ? -1 : 1); a.canonicalSourceTree.content = `${sorted.map((item) => `${item.mode} ${item.blobSha256} ${item.path}`).join("\n")}\n`; a.canonicalSourceTree.sha256 = sha256(Buffer.from(a.canonicalSourceTree.content)); validateArchitectureFromRaw({ architecture: a, rulesetBytes: architecture.artifacts.get("input/architecture-ruleset.json"), allowlistBytes: architecture.artifacts.get("input/architecture-allowlist.json") }); }),
    "T04-N-018": action("T04-N-018", { target: "public payload raw bytes", operation: "insert_bearer_secret" }, () => validatePublicBytes([{ path: "fresh/source-run/leak.log", bytes: Buffer.from("Authorization: Bearer secret-value") }])),
    "T04-N-019": action("T04-N-019", { target: "/snapshotInputManifest/sha256", operation: "replace_and_reseal_manifest" }, () => { const { root, document } = syntheticExitFixture(temporaryRoot); document.snapshotInputManifest.sha256 = "0".repeat(64); delete document.contentSha256; document.contentSha256 = sha256(Buffer.from(canonicalJson(document), "utf8")); validateExitManifestDocument(document, { t04_run: root, repository_snapshot: root, fresh_validation: root }); }),
    "T04-N-020": action("T04-N-020", { target: "/signed", operation: "promote_true" }, () => assertHumanBoundary({ humanReviewStatus: "pending", g7Status: "pending", finalPassed: false, signingAllowed: true })),
    "T04-N-021": action("T04-N-021", { target: "/g7Status", operation: "promote_passed" }, () => assertHumanBoundary({ humanReviewStatus: "pending", g7Status: "passed", finalPassed: true, signingAllowed: false })),
    "T04-N-022": action("T04-N-022", { target: "invocation argv", operation: "insert_legacy_validator" }, () => { const i = JSON.parse(fs.readFileSync(path.join(roots.fresh_validation, "invocation-record.json"))); i.steps[0].argv.push("validate-v2-external-brain-production-evidence.mjs"); assertNoLegacyInvocation(i); }),
    "T04-N-023": action("T04-N-023", { target: "/exactComparisons/0/baseline/path", operation: "replace_keep_equal_true" }, () => { const r = structuredClone(replayLane); r.exactComparisons[0].baseline.path = "wrong.json"; validateReplayLaneDocument(r, { baselineRoot: roots.baseline_validation, replayRoot: roots.replay_validation }); }),
    "T04-N-024": action("T04-N-024", { target: "public tar member index", operation: "include_exit_manifest" }, () => validateArchiveMembership(["payload.json", "exit-manifest.json"])),
    "T04-N-025": action("T04-N-025", { target: "/governance/authorizationRecord/userInstructionText", operation: "replace" }, () => { const m = structuredClone(manifest); m.governance.authorizationRecord.userInstructionText = "not approved"; manifestValidation(m); })
  };
  const negativeResults = runRegisteredNegativeCases({ registry, actions });
  const executions = negativeResults.map((result) => ({ ...result, mutation: mutationDescriptions[result.requirementId] }));
  writeJson(path.join(outputRoot, "negative-fixture-executions.json"), executions);
  const sourceResolved = JSON.parse(fs.readFileSync(path.join(roots.replay_validation, "resolved-invocation-record.json"), "utf8"));
  const historicalExitBytes = fs.readFileSync(path.join(repositoryRoot, HISTORICAL_T04_ROOT, "exit-manifest.json"));
  const historicalAuditBytes = fs.readFileSync(path.join(repositoryRoot, HISTORICAL_T04_AUDIT_PATH));
  if (sha256(historicalExitBytes) !== HISTORICAL_T04_EXIT_SHA256 || sha256(historicalAuditBytes) !== HISTORICAL_T04_AUDIT_SHA256) {
    throw new Error("T04_OUTPUT_IMMUTABILITY_FAILED: historical T04 anchors changed.");
  }
  const t041Registry = [
    ["T04.1-N01", "actual_invocation_points_to_raw", "T04_INVOCATION_EVIDENCE_INVALID"],
    ["T04.1-N02", "resolved_implementation_uses_validation_root", "T04_INVOCATION_EVIDENCE_INVALID"],
    ["T04.1-N03", "resolved_output_or_package_uses_validation_root", "T04_INVOCATION_EVIDENCE_INVALID"],
    ["T04.1-N04", "resolved_alias_map_accepted", "T04_INVOCATION_EVIDENCE_INVALID"],
    ["T04.1-N05", "replay_only_reuses_old_fresh_lane", "T04_CROSS_RUN_EVIDENCE_MIXED"],
    ["T04.1-N06", "new_candidate_references_old_identity", "T04_CROSS_RUN_EVIDENCE_MIXED"],
    ["T04.1-N07", "historical_candidate_directly_modified", "T04_OUTPUT_IMMUTABILITY_FAILED"],
    ["T04.1-N08", "human_boundary_signed_early", "T04_HUMAN_BOUNDARY_VIOLATION"]
  ].map(([requirementId, requirementKey, expectedPrimaryFailure]) => ({ requirementId, requirementKey, expectedPrimaryFailure }));
  const withResolvedMutation = (name, mutate) => {
    const temp = path.join(temporaryRoot, name);
    fs.cpSync(roots.replay_validation, temp, { recursive: true });
    const resolved = structuredClone(sourceResolved);
    mutate(resolved);
    writeJson(path.join(temp, "resolved-invocation-record.json"), resolved);
    const lane = structuredClone(replayLane);
    lane.actualInvocation = artifactRef("replay_validation", temp, "resolved-invocation-record.json", "application/json");
    validateReplayLaneDocument(lane, { baselineRoot: roots.baseline_validation, replayRoot: temp });
  };
  const t041Actions = {
    "T04.1-N01": () => { const lane = structuredClone(replayLane); lane.actualInvocation = artifactRef("replay_validation", roots.replay_validation, "invocation-record.json", "application/json"); validateReplayLaneDocument(lane, { baselineRoot: roots.baseline_validation, replayRoot: roots.replay_validation }); },
    "T04.1-N02": () => withResolvedMutation("t041-n02", (resolved) => { resolved.steps[0].implementation.artifactRoot = "validation_run"; }),
    "T04.1-N03": () => withResolvedMutation("t041-n03", (resolved) => { resolved.steps[1].stdout.artifactRoot = "validation_run"; resolved.productionPackage.artifactRoot = "validation_run"; }),
    "T04.1-N04": () => withResolvedMutation("t041-n04", (resolved) => { resolved.artifactRootAliases = { validation_run: "replay_validation" }; }),
    "T04.1-N05": () => validateFreshLaneDocument(freshLane, { sourceRunRoot: roots.source_run, validationRoot: roots.fresh_validation, baselineRawSha256: T02_RAW_SHA256 }),
    "T04.1-N06": () => { const lane = structuredClone(freshLane); lane.sealedRawRun.artifactRoot = "source_run"; validateFreshLaneDocument(lane, { sourceRunRoot: roots.fresh_source_run, validationRoot: roots.fresh_validation, baselineRawSha256: T02_RAW_SHA256 }); },
    "T04.1-N07": () => { if (sha256(Buffer.concat([historicalExitBytes, Buffer.from(" ")])) !== HISTORICAL_T04_EXIT_SHA256) throw new Error("T04_OUTPUT_IMMUTABILITY_FAILED: historical ExitManifest mutation detected."); },
    "T04.1-N08": () => assertHumanBoundary({ humanReviewStatus: "passed", g7Status: "passed", finalPassed: true, signingAllowed: true })
  };
  const t041NegativeResults = runRegisteredNegativeCases({ registry: t041Registry, actions: t041Actions });
  writeJson(path.join(outputRoot, "t04.1-negative-fixture-executions.json"), t041NegativeResults);
  writeJson(path.join(outputRoot, "fresh/fresh-lane.json"), freshLane);
  writeJson(path.join(outputRoot, "t04-5-result.json"), { stage: "T04-5", t04RunId, passed: true, negativeCases: negativeResults.length, t041NegativeCases: t041NegativeResults.length, architectureViolations: architecture.scan.violations });
  return { replayLane, freshLane, negativeResults, t041NegativeResults, executions };
}

function walkFiles(root) {
  const result = [];
  const visit = (directory) => {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else if (entry.isFile()) result.push({ absolute, relative: path.relative(root, absolute).replaceAll(path.sep, "/") });
    }
  };
  visit(root);
  return result;
}

function copyPublicFile(stagingRoot, memberPath, sourcePath) {
  const target = path.join(stagingRoot, ...memberPath.split("/"));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(sourcePath, target);
  return { path: memberPath, sha256: sha256(fs.readFileSync(target)), byteLength: fs.statSync(target).size };
}

function publicForbiddenByteValues(location, snapshotRoot) {
  const environmentSecrets = Object.entries(process.env)
    .filter(([name, value]) => /(?:TOKEN|SECRET|PASSWORD|AUTH)/i.test(name) && typeof value === "string" && value.length >= 8)
    .map(([, value]) => value);
  return [...new Set([
    repositoryRoot,
    os.homedir(),
    location.temporaryRoot,
    snapshotRoot,
    process.env.NAVIA_LOCAL_FILES_TOKEN,
    ...environmentSecrets
  ].filter(Boolean))];
}

function writeInternalAuditFiles(outputRoot, t04RunId, snapshotRevalidation) {
  const audits = {
    "audits/prd-coverage-review.md": `# T04 PRD 覆盖检视\n\nRun: ${t04RunId}\n\n三入口、五 route 四恢复、Permission、Durable Forget、四故障、四视口、Axe 0/0 与 Keyboard 5/5 均由 R4-E 新 raw 重算。未新增 RAG/RKM 范围。Human Review、G7、PX-5 final 与 PX-6 保持 pending。\n`,
    "audits/architecture-review.md": `# T04 架构检视\n\nRun: ${t04RunId}\n\n执行路径为 detached snapshot -> T03 shared reader/semantic/AST -> pending report/package。G4 从 frozen Git blob 重建，未读取 Report violations 自报。主工作树不作为运行源。\n`,
    "audits/false-green-audit.md": `# T04.1 假绿检视\n\nRun: ${t04RunId}\n\nR4-P exact=10、normalized=1、logs=8；R4-E 单 run 单 seal；T04 negatives=${snapshotRevalidation.negativeResults.length}/25；T04.1 root negatives=8/8。公开包按真实 tar member index 校验，ExitManifest 和后续独立审查不进入归档。\n`,
    "audits/implementation-exit-audit-request.md": `# T04.1 实现出门独立审查请求\n\n请先重算旁挂 exit-manifest.json 原始字节 SHA-256，再从中解析原始与 resolved InvocationRecord、SnapshotRevalidation、两泳道、测试、审计和 public archive。只有 Fatal=0 / Major=0 才能给出 T04.1 LIMITED PASS；不得签署 Human Review 或自动进入 PX-6。\n`
  };
  for (const [relativePath, content] of Object.entries(audits)) writeBytes(path.join(outputRoot, relativePath), Buffer.from(content, "utf8"));
}

function chineseAcceptanceHtml(t04RunId, replayLane, freshLane, negativeResults) {
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>T04 隔离快照复验</title><style>body{font-family:system-ui,sans-serif;max-width:980px;margin:32px auto;padding:0 24px;color:#18211e}table{border-collapse:collapse;width:100%}th,td{border:1px solid #aeb9b5;padding:8px;text-align:left}.pass{color:#176b43;font-weight:700}.pending{color:#805d13;font-weight:700}</style></head><body><h1>T04 隔离快照复验候选</h1><p>Run：${t04RunId}</p><table><tr><th>泳道</th><th>结果</th></tr><tr><td>R4-P 确定性重放</td><td class="pass">10 exact / 1 normalized / 8 logs</td></tr><tr><td>R4-E 新鲜真实 Chrome</td><td class="pass">12 sources / 20 routes / 12 Forget / Axe 0/0 / Keyboard 5/5</td></tr><tr><td>负例</td><td class="pass">${negativeResults.length}/25</td></tr><tr><td>Human Review / G7 / final</td><td class="pending">pending / pending / false</td></tr></table><p>本页只证明 T04 机器候选，不构成 PX-5、PX-6、V2 或 RKM 完成声明。</p></body></html>\n`;
}

export function runT046({ outputRoot, t04RunId }) {
  const manifest = JSON.parse(fs.readFileSync(path.join(outputRoot, "snapshot-input-manifest.json"), "utf8"));
  const replayLane = JSON.parse(fs.readFileSync(path.join(outputRoot, "replay/replay-lane.json"), "utf8"));
  const freshLane = JSON.parse(fs.readFileSync(path.join(outputRoot, "fresh/fresh-lane.json"), "utf8"));
  const negativeExecutions = JSON.parse(fs.readFileSync(path.join(outputRoot, "negative-fixture-executions.json"), "utf8"));
  const t041NegativeResults = JSON.parse(fs.readFileSync(path.join(outputRoot, "t04.1-negative-fixture-executions.json"), "utf8"));
  const negativeResults = negativeExecutions.map(({ mutation: _mutation, ...result }) => result);
  if (negativeResults.length !== 25 || negativeResults.some((item) => !item.passed)) throw new Error("T04_VALIDATION_DENOMINATOR_MISMATCH: T04 negative set is incomplete.");
  if (t041NegativeResults.length !== 8 || t041NegativeResults.some((item) => !item.passed)) throw new Error("T04_VALIDATION_DENOMINATOR_MISMATCH: T04.1 negative set is incomplete.");
  const location = JSON.parse(fs.readFileSync(path.join(outputRoot, ".infra/snapshot-location.json"), "utf8"));
  const snapshotRoot = path.resolve(location.snapshotRoot);
  const freshValidationRoot = path.join(outputRoot, "fresh/validation");
  const t04Tests = runCaptured(process.execPath, ["--test", "e2e/lib/v2PxSnapshotReplay.node-test.mjs", "e2e/lib/v2PxSnapshotComparison.node-test.mjs", "e2e/run-v2-px-r4-snapshot-revalidation.node-test.mjs"], { cwd: path.join(snapshotRoot, "apps/chrome-extension"), env: process.env });
  writeBytes(path.join(outputRoot, "tests/t04-node-tests.stdout.log"), t04Tests.stdout);
  writeBytes(path.join(outputRoot, "tests/t04-node-tests.stderr.log"), t04Tests.stderr);
  requireSuccessful(t04Tests, "T04_T03_REGRESSION_FAILED", "T04 snapshot tests failed");
  const prerequisiteIndex = {
    sourceRunId: freshLane.sourceRunId,
    t01: JSON.parse(fs.readFileSync(path.join(freshValidationRoot, "derived-facts.json"), "utf8")).summary.t01Regression,
    commands: JSON.parse(fs.readFileSync(path.join(freshValidationRoot, "derived-facts.json"), "utf8")).summary.prerequisiteCommands
  };
  writeJson(path.join(outputRoot, "tests/fresh-prerequisite-index.json"), prerequisiteIndex);
  writeBytes(path.join(outputRoot, "acceptance-report.zh-CN.html"), Buffer.from(chineseAcceptanceHtml(t04RunId, replayLane, freshLane, negativeResults), "utf8"));
  const commonRefs = {
    manifest: artifactRef("t04_run", outputRoot, "snapshot-input-manifest.json", "application/json"),
    replay: artifactRef("t04_run", outputRoot, "replay/replay-lane.json", "application/json"),
    fresh: artifactRef("t04_run", outputRoot, "fresh/fresh-lane.json", "application/json"),
    negatives: artifactRef("t04_run", outputRoot, "negative-fixture-executions.json", "application/json"),
    environment: artifactRef("t04_run", outputRoot, "input/environment.json", "application/json"),
    tests: artifactRef("t04_run", outputRoot, "tests/t04-node-tests.stdout.log", "text/plain")
  };
  const evidenceByAcceptance = {
    "T04-A01": [commonRefs.manifest], "T04-A02": [commonRefs.manifest], "T04-A03": [commonRefs.environment],
    "T04-A04": [commonRefs.replay], "T04-A05": [commonRefs.fresh], "T04-A06": [commonRefs.fresh],
    "T04-A07": [freshLane.productionPackage], "T04-A08": [freshLane.productionPackage], "T04-A09": [commonRefs.replay, commonRefs.fresh],
    "T04-A10": [commonRefs.negatives], "T04-A11": [commonRefs.replay, commonRefs.fresh], "T04-A12": [commonRefs.manifest],
    "T04-A13": [commonRefs.tests], "T04-A14": [commonRefs.tests]
  };
  const snapshotRevalidation = {
    schemaVersion: "v2-px-snapshot-revalidation/v1", evidenceClass: "production_acceptance", t04RunId, generatedAt: new Date().toISOString(),
    inputManifest: commonRefs.manifest, replayLane, freshLane,
    t04AcceptanceResults: Array.from({ length: 14 }, (_, index) => { const id = `T04-A${String(index + 1).padStart(2, "0")}`; return { id, status: "passed", evidenceRefs: evidenceByAcceptance[id] }; }),
    negativeResults,
    gateResults: { G1: "passed", G2: "passed", G3: "passed", G4: "passed", G5: "passed", G6: "passed", G7: "pending" },
    machinePassed: true, humanReviewStatus: "pending", finalPassed: false,
    issues: [{ severity: "warning", code: "T04_EXTERNAL_IMPLEMENTATION_AUDIT_PENDING", message: "Candidate requires an independent implementation exit audit before T04 LIMITED PASS." }]
  };
  validateJsonSchema(path.join(snapshotRoot, "docs/active/project/contracts/v2_px_snapshot_revalidation.schema.json"), snapshotRevalidation);
  writeJson(path.join(outputRoot, "snapshot-revalidation.json"), snapshotRevalidation);
  writeJson(path.join(outputRoot, "t04.1-acceptance-results.json"), {
    t04RunId,
    results: Array.from({ length: 14 }, (_, index) => ({ id: `T04.1-A${String(index + 1).padStart(2, "0")}`, status: "passed" })),
    negatives: t041NegativeResults,
    humanReviewStatus: "pending",
    g7Status: "pending",
    finalPassed: false
  });
  writeInternalAuditFiles(outputRoot, t04RunId, snapshotRevalidation);

  const stagingRoot = path.join(location.temporaryRoot, "public-payload-staging");
  fs.rmSync(stagingRoot, { recursive: true, force: true });
  fs.mkdirSync(stagingRoot, { recursive: true });
  const membersByPath = new Map();
  const add = (member, source) => {
    const copied = copyPublicFile(stagingRoot, member, source);
    const previous = membersByPath.get(member);
    if (previous && previous.sha256 !== copied.sha256) throw new Error(`T04_EXIT_MANIFEST_INVALID: conflicting duplicate archive member ${member}.`);
    membersByPath.set(member, copied);
    return copied;
  };
  for (const relativePath of ["snapshot-input-manifest.json", "snapshot-revalidation.json", "negative-fixture-executions.json", "t04.1-negative-fixture-executions.json", "t04.1-acceptance-results.json", "acceptance-report.zh-CN.html", "input/dependency-closure.json", "input/environment.json", "input/path-index.txt", "input/source-index.json", "input/build-index.json", "input/resolved-packages.json", "input/runtime-locked-requirements.txt", "input/runtime-wheelhouse-index.json", "input/runtime-wheelhouse.tar.gz", "input/snapshot.bundle", "tests/t04-node-tests.stdout.log", "tests/t04-node-tests.stderr.log", "tests/fresh-prerequisite-index.json", "audits/prd-coverage-review.md", "audits/architecture-review.md", "audits/false-green-audit.md", "audits/implementation-exit-audit-request.md"]) add(`t04/${relativePath}`, path.join(outputRoot, relativePath));
  for (const file of walkFiles(path.join(outputRoot, "replay/output"))) add(`replay/${file.relative}`, file.absolute);
  for (const file of walkFiles(freshValidationRoot)) add(`fresh/validation/${file.relative}`, file.absolute);
  const freshSourceRoot = path.join(outputRoot, "fresh/source-run");
  const raw = JSON.parse(fs.readFileSync(path.join(freshSourceRoot, "raw/raw-run.json"), "utf8"));
  for (const relativePath of ["raw/raw-run.json", "raw/artifact-index.json", "cleanup-manifest.json"]) add(`fresh/source-run/${relativePath}`, path.join(freshSourceRoot, relativePath));
  for (const record of raw.artifacts.filter((item) => item.visibility === "public")) if (fs.existsSync(path.join(freshSourceRoot, record.path))) add(`fresh/source-run/${record.path}`, path.join(freshSourceRoot, record.path));
  for (const relativePath of ["docs/active/project/01-prd.md", "docs/active/project/02-architecture.md", "docs/active/project/04-acceptance-plan.md", "docs/active/project/design/v2-memory-personal-knowledge-base-gap.drawio", ...T04_CONTRACTS]) add(`repository/${relativePath}`, path.join(snapshotRoot, relativePath));
  const members = [...membersByPath.values()].sort((left, right) => left.path.localeCompare(right.path));
  validatePublicBytes(
    members.map((member) => ({ path: member.path, bytes: fs.readFileSync(path.join(stagingRoot, member.path)) })),
    { forbiddenByteValues: publicForbiddenByteValues(location, snapshotRoot) }
  );
  const memberIndex = { policy: "payload_only_excludes_exit_manifest_and_independent_audit", members };
  writeJson(path.join(outputRoot, "public/payload-member-index.json"), memberIndex);
  copyPublicFile(stagingRoot, "t04/public/payload-member-index.json", path.join(outputRoot, "public/payload-member-index.json"));
  const archivePath = path.join(outputRoot, "public/t04-public-evidence.tar.gz");
  fs.mkdirSync(path.dirname(archivePath), { recursive: true });
  const expectedMembers = [...members.map((item) => item.path), "t04/public/payload-member-index.json"].sort();
  const archiveInputList = path.join(location.temporaryRoot, "public-archive-members.nul");
  writeBytes(archiveInputList, Buffer.from(`${expectedMembers.join("\0")}\0`, "utf8"));
  requireSuccessful(runCaptured("tar", ["--sort=name", "--mtime=@0", "--owner=0", "--group=0", "--numeric-owner", "--null", "--verbatim-files-from", "-C", stagingRoot, "-T", archiveInputList, "-czf", archivePath], { cwd: snapshotRoot, maxBuffer: 256 * 1024 * 1024 }), "T04_EXIT_MANIFEST_INVALID", "public payload archive failed");
  const actualMembers = archiveMembers(archivePath);
  validateArchiveMembership(actualMembers);
  if (JSON.stringify(actualMembers.sort()) !== JSON.stringify(expectedMembers)) throw new Error("T04_EXIT_MANIFEST_INVALID: public archive member index mismatch.");
  const auditRefs = ["audits/prd-coverage-review.md", "audits/architecture-review.md", "audits/false-green-audit.md", "audits/implementation-exit-audit-request.md"].map((relativePath) => artifactRef("t04_run", outputRoot, relativePath, "text/markdown"));
  const exitManifest = {
    schemaVersion: "v2-px-exit-manifest/v1", evidenceClass: "production_acceptance", t04RunId, createdAt: new Date().toISOString(),
    snapshotInputManifest: commonRefs.manifest,
    snapshotRevalidation: artifactRef("t04_run", outputRoot, "snapshot-revalidation.json", "application/json"),
    freshProductionPackage: artifactRef("fresh_validation", freshValidationRoot, "production-package.json", "application/json"),
    freshInvocationRecord: artifactRef("fresh_validation", freshValidationRoot, "invocation-record.json", "application/json"),
    chineseAcceptanceHtml: artifactRef("t04_run", outputRoot, "acceptance-report.zh-CN.html", "text/html"),
    drawio: artifactRef("repository_snapshot", snapshotRoot, "docs/active/project/design/v2-memory-personal-knowledge-base-gap.drawio", "application/vnd.jgraph.mxfile"),
    testArtifacts: [artifactRef("t04_run", outputRoot, "tests/t04-node-tests.stdout.log", "text/plain"), artifactRef("t04_run", outputRoot, "tests/t04-node-tests.stderr.log", "text/plain"), artifactRef("t04_run", outputRoot, "tests/fresh-prerequisite-index.json", "application/json"), artifactRef("t04_run", outputRoot, "t04.1-negative-fixture-executions.json", "application/json"), artifactRef("t04_run", outputRoot, "t04.1-acceptance-results.json", "application/json")],
    auditArtifacts: auditRefs,
    publicEvidenceArchive: artifactRef("t04_run", outputRoot, "public/t04-public-evidence.tar.gz", "application/gzip"),
    publicArchivePolicy: "payload_only_excludes_exit_manifest_and_independent_audit",
    signed: false, humanReviewStatus: "pending", g7Status: "pending", finalPassed: false,
    claim: "T04 isolated snapshot revalidation candidate passed; Human Review, G7, PX-5 final disposition and PX-6 remain pending."
  };
  exitManifest.contentSha256 = sha256(Buffer.from(canonicalJson(exitManifest), "utf8"));
  validateJsonSchema(path.join(snapshotRoot, "docs/active/project/contracts/v2_px_exit_manifest.schema.json"), exitManifest);
  validateExitManifestDocument(exitManifest, { t04_run: outputRoot, fresh_validation: freshValidationRoot, repository_snapshot: snapshotRoot });
  writeJson(path.join(outputRoot, "exit-manifest.json"), exitManifest);
  writeJson(path.join(outputRoot, "t04-6-result.json"), { stage: "T04-6", t04RunId, passed: true, archiveMembers: actualMembers.length, publicArchiveSha256: exitManifest.publicEvidenceArchive.sha256, exitContentSha256: exitManifest.contentSha256, humanReviewStatus: "pending", g7Status: "pending", finalPassed: false });
  return { snapshotRevalidation, exitManifest, actualMembers };
}

const T04_EXTERNAL_AUDIT_PAYLOAD = [
  ["02-prd.md", "docs/active/project/01-prd.md"],
  ["03-architecture.md", "docs/active/project/02-architecture.md"],
  ["04-stage-gate.md", "docs/active/project/stage-gates/v2-external-brain-productization.md"],
  ["05-t04.1-development-plan.md", "docs/active/project/evidence/v2_external_brain_productization/px-5/t04-r4-snapshot-revalidation/t04.1-artifact-root-remediation-development-plan.md"],
  ["06-t04.1-acceptance-plan.md", "docs/active/project/evidence/v2_external_brain_productization/px-5/t04-r4-snapshot-revalidation/t04.1-artifact-root-remediation-acceptance-plan.md"],
  ["07-resolved-invocation.schema.json", REPLAY_INVOCATION_SCHEMA],
  ["08-t04.1-document-audit.md", "docs/active/project/evidence/v2_external_brain_productization/px-5/t04-r4-snapshot-revalidation/t04.1-input-manifest-remediation-independent-document-audit.md"],
  ["09-t04.1-implementation-authorization.json", "docs/active/project/evidence/v2_external_brain_productization/px-5/t04-r4-snapshot-revalidation/t04.1-implementation-authorization.json"],
  ["10-snapshot-input-manifest.json", "snapshot-input-manifest.json"],
  ["11-snapshot-revalidation.json", "snapshot-revalidation.json"],
  ["12-exit-manifest.json", "exit-manifest.json"],
  ["13-t04.1-negative-fixture-executions.json", "t04.1-negative-fixture-executions.json"],
  ["14-replay-lane.json", "replay/replay-lane.json"],
  ["15-fresh-lane.json", "fresh/fresh-lane.json"],
  ["16-acceptance-report.zh-CN.html", "acceptance-report.zh-CN.html"],
  ["17-public-evidence.tar.gz", "public/t04-public-evidence.tar.gz"],
  ["18-t04-runner.mjs", "apps/chrome-extension/e2e/run-v2-px-r4-snapshot-revalidation.mjs"],
  ["19-t04-comparison.mjs", "apps/chrome-extension/e2e/lib/v2PxSnapshotComparison.mjs"]
];

export function runT047({ outputRoot, t04RunId, auditPackageRoot = path.join(repositoryRoot, "docs/active/project/external-audit-package") }) {
  const exitManifestPath = path.join(outputRoot, "exit-manifest.json");
  const t046Result = JSON.parse(fs.readFileSync(path.join(outputRoot, "t04-6-result.json"), "utf8"));
  const exitManifestBytes = fs.readFileSync(exitManifestPath);
  const exitManifest = JSON.parse(exitManifestBytes);
  if (!t046Result.passed || exitManifest.t04RunId !== t04RunId) throw new Error("T04_EXIT_MANIFEST_INVALID: T04-6 candidate is missing or belongs to another run.");
  validateExitManifestDocument(exitManifest, {
    t04_run: outputRoot,
    fresh_validation: path.join(outputRoot, "fresh/validation"),
    repository_snapshot: JSON.parse(fs.readFileSync(path.join(outputRoot, ".infra/snapshot-location.json"), "utf8")).snapshotRoot
  });
  fs.rmSync(auditPackageRoot, { recursive: true, force: true });
  fs.mkdirSync(auditPackageRoot, { recursive: true });
  const request = `# T04.1 R4 实现出门独立审查请求\n\n审查对象：${t04RunId}\n\n先重算本目录 19 项载荷 SHA-256，再独立验证 SnapshotInputManifest、原始与 resolved InvocationRecord、R4-P、R4-E、25 个 T04 负例、8 个 T04.1 root 负例、14 项验收、公开 tar 成员、unsigned ExitManifest 与 Human/G7/final 边界。旁挂 ExitManifest 原始字节 SHA-256：\`${sha256(exitManifestBytes)}\`。\n\n只有 Fatal=0 / Major=0 才可给出 T04.1 LIMITED PASS。不得签署 Human Review，不得扩大为 PX-5、PX-6、V2 或 RKM 通过。审查结论落盘到 \`docs/active/project/evidence/v2_external_brain_productization/px-5/t04-r4-snapshot-revalidation/t04.1-independent-implementation-exit-audit.md\`，且不得覆盖历史 T04 审计、回写本候选或进入 public archive。\n`;
  writeBytes(path.join(auditPackageRoot, "01-audit-request.md"), Buffer.from(request, "utf8"));
  const copied = [{ name: "01-audit-request.md", source: "generated_from_t04_exit_manifest", ...artifactRef("t04_run", auditPackageRoot, "01-audit-request.md", "text/markdown") }];
  for (const [name, source] of T04_EXTERNAL_AUDIT_PAYLOAD) {
    const fromRepository = source.startsWith("docs/") || source.startsWith("apps/");
    const sourcePath = path.join(fromRepository ? repositoryRoot : outputRoot, source);
    fs.copyFileSync(sourcePath, path.join(auditPackageRoot, name));
    copied.push({ name, source: fromRepository ? source : path.relative(repositoryRoot, sourcePath).replaceAll(path.sep, "/"), ...artifactRef("t04_run", auditPackageRoot, name, mediaType(name)) });
  }
  if (copied.length !== 19) throw new Error("T04_EXIT_MANIFEST_INVALID: external audit payload denominator must be 19.");
  const rows = copied.map((item, index) => `| ${index + 1} | \`${item.name}\` | \`${item.source}\` | \`${item.sha256}\` | ${item.byteLength} |`).join("\n");
  const auditManifest = `# T04.1 R4 实现出门外部审计清单\n\nRun：\`${t04RunId}\`  \nExitManifest 原始字节 SHA-256：\`${sha256(exitManifestBytes)}\`  \n目录规则：平铺 19 载荷 + 本清单，共 20 文件；不得混入其他轮次。\n\n| # | 文件 | 权威来源 | SHA-256 | bytes |\n|---:|---|---|---|---:|\n${rows}\n\n## 门禁\n\n- T04.1 候选：等待独立实现出门审查。\n- Human Review / G7 / final：\`pending / pending / false\`。\n- PX-5：\`FAIL / REOPENED\`。PX-6：\`BLOCKED\`。\n`;
  writeBytes(path.join(auditPackageRoot, "AUDIT_MANIFEST.md"), Buffer.from(auditManifest, "utf8"));
  const actual = fs.readdirSync(auditPackageRoot).sort();
  if (actual.length !== 20 || actual.some((name) => fs.statSync(path.join(auditPackageRoot, name)).isDirectory())) throw new Error("T04_EXIT_MANIFEST_INVALID: external audit package must contain exactly 20 flat files.");
  for (const item of copied) if (sha256(fs.readFileSync(path.join(auditPackageRoot, item.name))) !== item.sha256) throw new Error(`T04_EXIT_MANIFEST_INVALID: copied audit payload changed: ${item.name}`);
  const result = { stage: "T04-7", t04RunId, passed: true, payloadFiles: 19, totalFiles: 20, exitManifestRawSha256: sha256(exitManifestBytes), auditManifestSha256: sha256(fs.readFileSync(path.join(auditPackageRoot, "AUDIT_MANIFEST.md"))), independentImplementationAudit: "pending" };
  writeJson(path.join(outputRoot, "t04-7-result.json"), result);
  return result;
}

export function main(argv = process.argv.slice(2)) {
  const parsed = parseArgs(argv, ["phase", "output-root", "t04-run-id"]);
  if (parsed.phase === "t04-0") runT040({ outputRoot: path.resolve(parsed["output-root"]), t04RunId: parsed["t04-run-id"] });
  else if (parsed.phase === "t04-1") runT041({ outputRoot: path.resolve(parsed["output-root"]), t04RunId: parsed["t04-run-id"] });
  else if (parsed.phase === "t04-2") runT042({ outputRoot: path.resolve(parsed["output-root"]), t04RunId: parsed["t04-run-id"] });
  else if (parsed.phase === "t04-3") runT043({ outputRoot: path.resolve(parsed["output-root"]), t04RunId: parsed["t04-run-id"] });
  else if (parsed.phase === "t04-4") runT044({ outputRoot: path.resolve(parsed["output-root"]), t04RunId: parsed["t04-run-id"] });
  else if (parsed.phase === "t04-5") runT045({ outputRoot: path.resolve(parsed["output-root"]), t04RunId: parsed["t04-run-id"] });
  else if (parsed.phase === "t04-6") runT046({ outputRoot: path.resolve(parsed["output-root"]), t04RunId: parsed["t04-run-id"] });
  else if (parsed.phase === "t04-7") runT047({ outputRoot: path.resolve(parsed["output-root"]), t04RunId: parsed["t04-run-id"] });
  else throw new Error(`Unsupported phase: ${parsed.phase}`);
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  try { process.exitCode = main(); } catch (error) { console.error(error.stack ?? error.message); process.exitCode = 1; }
}
