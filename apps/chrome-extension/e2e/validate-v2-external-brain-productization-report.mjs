import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import { PNG } from "pngjs";
import ts from "typescript";
import { runRuleEngine, scanTypeScriptArchitecture } from "./lib/v2PxSemanticValidation.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(__dirname, "../../..");
const contractsRoot = path.join(repoRoot, "docs/active/project/contracts");
const fixtureRoot = path.join(contractsRoot, "fixtures/v2_external_brain");

const schemaFiles = {
  knowledge: "v2_knowledge_status.schema.json",
  workspace: "v2_external_brain_workspace_contracts.schema.json",
  manifest: "v2_external_brain_acceptance_manifest.schema.json",
  report: "v2_external_brain_report.schema.json",
  screenshot: "v2_external_brain_screenshot_metadata.schema.json",
  execution: "v2_external_brain_execution_observation.schema.json",
  human: "v2_external_brain_human_review.schema.json",
  validation: "v2_external_brain_validation_contracts.schema.json",
  architecture: "v2_external_brain_architecture_scan_manifest.schema.json"
};

const positivePath = path.join(fixtureRoot, "px-0.1b-positive-instances.json");
const payloadPath = path.join(fixtureRoot, "px-0.1b-positive-evidence-payload.json");
const fixturePath = path.join(fixtureRoot, "px-0.1-contract-fixtures.json");
const semanticSpecPath = path.join(repoRoot, "docs/active/project/design/v2-external-brain-productization-semantic-validator.md");
const validatorPath = fileURLToPath(import.meta.url);

const clone = (value) => structuredClone(value);
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
const equal = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const unique = (values) => [...new Set(values)];
const sorted = (values) => [...values].sort((a, b) => a.localeCompare(b, "en"));
const schemaValidationCache = new Map();

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function canonicalize(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value && typeof value === "object") {
    const keys = Object.keys(value).sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function decodePointer(pointer) {
  if (pointer === "") return [];
  if (!pointer.startsWith("/")) throw new Error(`invalid JSON Pointer: ${pointer}`);
  return pointer.slice(1).split("/").map((part) => part.replaceAll("~1", "/").replaceAll("~0", "~"));
}

function pointerGet(root, pointer) {
  let current = root;
  for (const part of decodePointer(pointer)) {
    if (current == null || !Object.prototype.hasOwnProperty.call(current, part)) {
      throw new Error(`JSON Pointer does not exist: ${pointer}`);
    }
    current = current[part];
  }
  return current;
}

function arrayIndex(key, length, { allowAppend = false } = {}) {
  if (allowAppend && key === "-") return length;
  if (!/^(?:0|[1-9][0-9]*)$/.test(key)) throw new Error(`invalid array index: ${key}`);
  const index = Number(key);
  const maximum = allowAppend ? length : length - 1;
  if (!Number.isSafeInteger(index) || index < 0 || index > maximum) throw new Error(`array index out of bounds: ${key}`);
  return index;
}

export function patchDocument(document, operations) {
  const output = clone(document);
  for (const operation of operations) {
    const parts = decodePointer(operation.path);
    if (!parts.length) throw new Error("root replacement is not supported by the fixture protocol");
    const key = parts.pop();
    let parent = output;
    for (const part of parts) {
      if (Array.isArray(parent)) arrayIndex(part, parent.length);
      if (parent == null || !Object.prototype.hasOwnProperty.call(parent, part)) {
        throw new Error(`patch parent does not exist: ${operation.path}`);
      }
      parent = parent[part];
    }
    if (operation.op === "remove") {
      if (Array.isArray(parent)) {
        const index = arrayIndex(key, parent.length);
        parent.splice(index, 1);
      } else {
        if (!Object.prototype.hasOwnProperty.call(parent, key)) throw new Error(`remove target does not exist: ${operation.path}`);
        delete parent[key];
      }
    } else if (operation.op === "replace") {
      if (Array.isArray(parent)) parent[arrayIndex(key, parent.length)] = clone(operation.value);
      else {
        if (!Object.prototype.hasOwnProperty.call(parent, key)) throw new Error(`replace target does not exist: ${operation.path}`);
        parent[key] = clone(operation.value);
      }
    } else if (operation.op === "add") {
      if (Array.isArray(parent)) {
        parent.splice(arrayIndex(key, parent.length, { allowAppend: true }), 0, clone(operation.value));
      } else parent[key] = clone(operation.value);
    } else throw new Error(`unsupported RFC 6902 operation: ${operation.op}`);
  }
  return output;
}

function artifactBytes(contract, artifactPath) {
  const record = contract?.artifactsByPath?.[artifactPath];
  if (!record) return null;
  let bytes;
  if (record.serialization === "base64_decoded_bytes_v1" || record.encoding === "base64") {
    const encoded = record.contentBase64;
    if (typeof encoded !== "string" || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded) || encoded.length % 4 !== 0) return null;
    bytes = Buffer.from(encoded, "base64");
  } else {
    if (typeof record.content !== "string") return null;
    bytes = Buffer.from(record.content, "utf8");
  }
  if (record.serialization === "navia_canonical_json_v1") {
    try {
      if (canonicalize(JSON.parse(record.content)) !== record.content) return null;
    } catch {
      return null;
    }
  }
  if (!/^[a-f0-9]{64}$/.test(record.sha256 || "") || sha256(bytes) !== record.sha256) return null;
  return bytes;
}

function artifactValid(contract, reference) {
  if (!reference || typeof reference.path !== "string" || !/^[a-f0-9]{64}$/.test(reference.sha256 || "")) return false;
  if (path.isAbsolute(reference.path) || reference.path.split("/").includes("..")) return false;
  const bytes = artifactBytes(contract, reference.path);
  return Boolean(bytes && sha256(bytes) === reference.sha256 && sha256(bytes) === contract.artifactsByPath[reference.path].sha256);
}

export function decodePng(bytes) {
  if (!bytes) return null;
  try {
    const decoded = PNG.sync.read(bytes, { checkCRC: true, skipRescale: false });
    if (decoded.data.length !== decoded.width * decoded.height * 4) return null;
    return { width: decoded.width, height: decoded.height, pixelBytes: decoded.data.length };
  } catch {
    return null;
  }
}

function schemaTargetForPointer(pointer) {
  if (pointer.startsWith("/workspaceCases/")) return "workspace";
  if (pointer.startsWith("/documents/acceptanceManifest")) return "manifest";
  if (pointer.startsWith("/documents/report")) return "report";
  if (pointer.startsWith("/documents/humanReview")) return "human";
  if (pointer.startsWith("/documents/knowledgeStatus")) return "knowledge";
  if (pointer.includes("ExecutionObservation") || pointer.includes("executionObservation") || pointer.includes("executionObservations") || pointer.endsWith("Observation")) return "execution";
  if (pointer.includes("screenshotMetadata") || pointer.includes("screenshotMetadatas")) return "screenshot";
  if (pointer.startsWith("/documents/architectureScanManifest")) return "architecture";
  throw new Error(`no schema mapping for ${pointer}`);
}

export function runSchemaRequests(requests) {
  const schemas = Object.fromEntries(Object.entries(schemaFiles).map(([key, file]) => [key, readJson(path.join(contractsRoot, file))]));
  const schemaBundleHash = sha256(Buffer.from(canonicalize(schemas)));
  const results = new Array(requests.length);
  const pending = [];
  requests.forEach((request, index) => {
    const cacheKey = sha256(Buffer.from(`${schemaBundleHash}\n${canonicalize(request)}`));
    const cached = schemaValidationCache.get(cacheKey);
    if (cached) results[index] = clone(cached);
    else pending.push({ cacheKey, index, request });
  });
  if (!pending.length) return results;

  const python = String.raw`
import json, sys
from jsonschema import Draft202012Validator
from referencing import Registry, Resource
payload=json.load(sys.stdin)
schemas=payload["schemas"]
registry=Registry()
for schema in schemas.values():
    Draft202012Validator.check_schema(schema)
    registry=registry.with_resource(schema["$id"], Resource.from_contents(schema))
results=[]
for req in payload["requests"]:
    schema=schemas[req["schema"]]
    if req.get("targetDef"):
        schema={"$schema":"https://json-schema.org/draft/2020-12/schema", "$id":schema["$id"]+"/target/"+req["targetDef"], "$ref":schema["$id"]+"#/$defs/"+req["targetDef"]}
    errors=list(Draft202012Validator(schema, registry=registry).iter_errors(req["instance"]))
    results.append({"valid":not errors,"error":errors[0].message if errors else None})
json.dump(results,sys.stdout)
`;
  const result = spawnSync("python3", ["-c", python], {
    cwd: repoRoot,
    encoding: "utf8",
    input: JSON.stringify({ schemas, requests: pending.map((item) => item.request) }),
    maxBuffer: 20 * 1024 * 1024
  });
  if (result.status !== 0) throw new Error(`jsonschema runner failed: ${result.stderr || result.stdout}`);
  const validated = JSON.parse(result.stdout);
  validated.forEach((validationResult, pendingIndex) => {
    const item = pending[pendingIndex];
    schemaValidationCache.set(item.cacheKey, clone(validationResult));
    results[item.index] = validationResult;
  });
  return results;
}

function canonicalRoute(route, workspaceId, sourceId) {
  const encodedWorkspace = encodeURIComponent(workspaceId);
  if (route === "source_library") return `#/knowledge/sources?workspaceId=${encodedWorkspace}`;
  if (route === "source_detail") return `#/knowledge/sources/${encodeURIComponent(sourceId)}?workspaceId=${encodedWorkspace}`;
  if (route === "ask") return `#/knowledge/ask?workspaceId=${encodedWorkspace}`;
  if (route === "graph") return `#/knowledge/graph?workspaceId=${encodedWorkspace}`;
  if (route === "permissions") return `#/knowledge/settings/permissions?workspaceId=${encodedWorkspace}`;
  return null;
}

function contextWithMutation(positive, basePointer, mutated) {
  const context = clone(positive);
  const parts = decodePointer(basePointer);
  let parent = context;
  for (const part of parts.slice(0, -1)) parent = parent[part];
  parent[parts.at(-1)] = clone(mutated);
  return context;
}

function sourceMap(context) {
  return new Map(context.documents.acceptanceManifest.sourceCorpus.map((source) => [source.sourceSampleId, source]));
}

function observationMap(context) {
  return new Map(context.documents.executionObservations.map((item) => [item.scenarioId, item]));
}

function screenshotMap(context) {
  return new Map(context.documents.screenshotMetadatas.map((item) => [item.scenarioId, item]));
}

function reportResultMap(context) {
  return new Map(context.documents.report.scenarioResults.map((item) => [item.scenarioId, item]));
}

function manifestScenarioMap(context) {
  return new Map(context.documents.acceptanceManifest.scenarios.map((item) => [item.scenarioId, item]));
}

export function architectureScan(context) {
  return scanTypeScriptArchitecture({
    manifest: context.documents.architectureScanManifest,
    artifactBytes: (artifactPath) => artifactBytes(context.virtualArtifactContract, artifactPath),
    artifactValid: (reference) => artifactValid(context.virtualArtifactContract, reference)
  });
  /* istanbul ignore next -- retained temporarily as a byte-compatible reference during T03 migration. */
  const manifest = context.documents.architectureScanManifest;
  const artifacts = context.virtualArtifactContract;
  const requiredRoots = [
    "apps/chrome-extension/entrypoints/sidepanel",
    "apps/chrome-extension/entrypoints/workspace",
    "apps/chrome-extension/src/modules/knowledge_workspace"
  ];
  const paths = manifest.trackedPaths.map((item) => item.path).sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
  const pathIndex = `${paths.join("\n")}\n`;
  const tree = `${[...manifest.trackedPaths].sort((a, b) => a.path < b.path ? -1 : 1).map((item) => `${item.mode} ${item.blobSha256} ${item.path}`).join("\n")}\n`;
  const scopeValid = equal(sorted(manifest.scanRoots), sorted(requiredRoots))
    && equal(sorted(manifest.excludedPaths), sorted(["node_modules", "dist", ".output"]))
    && manifest.canonicalPathIndex.content === pathIndex
    && manifest.canonicalPathIndex.sha256 === sha256(Buffer.from(pathIndex))
    && manifest.canonicalSourceTree.content === tree
    && manifest.canonicalSourceTree.sha256 === sha256(Buffer.from(tree))
    && manifest.trackedPaths.every((item) => item.inlineSource && item.inlineSource.sha256 === sha256(Buffer.from(item.inlineSource.content)) && item.blobSha256 === item.inlineSource.sha256)
    && artifactValid(artifacts, manifest.rulesetArtifact)
    && artifactValid(artifacts, manifest.allowlistArtifact);
  if (!scopeValid) return { scopeValid: false, violations: 0 };

  const ruleset = JSON.parse(artifactBytes(artifacts, manifest.rulesetArtifact.path).toString("utf8"));
  const allowlist = JSON.parse(artifactBytes(artifacts, manifest.allowlistArtifact.path).toString("utf8"));
  const expectedAlgorithms = new Set(["typescript_ast_import_specifier_literal_v2", "typescript_ast_call_new_expression_and_endpoint_normalization_v2"]);
  if (!ruleset.checks?.length || !ruleset.checks.every((check) => expectedAlgorithms.has(check.algorithm))
      || !equal(sorted(ruleset.nonOverridableRules || []), sorted(allowlist.forbiddenOverrides || []))) {
    return { scopeValid: false, violations: 0 };
  }

  let violations = 0;
  const importRule = ruleset.checks.find((check) => check.checkId === "architecture_dependency_boundary");
  const callRule = ruleset.checks.find((check) => check.checkId === "architecture_forbidden_call_scan");
  const normalizedCallNames = callRule.forbiddenCallNames.map((value) => value.replace(/^(window|globalThis)\./, ""));
  const normalizedConstructorNames = callRule.forbiddenConstructorNames.map((value) => value.replace(/^(window|globalThis)\./, ""));
  const staticString = (node) => {
    if (!node) return null;
    if (ts.isStringLiteralLike(node)) return node.text;
    if (ts.isParenthesizedExpression(node)) return staticString(node.expression);
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
      const left = staticString(node.left); const right = staticString(node.right);
      return left != null && right != null ? left + right : null;
    }
    return null;
  };
  const calleeName = (node) => {
    if (!node) return "";
    if (ts.isParenthesizedExpression(node)) return calleeName(node.expression);
    if (ts.isIdentifier(node)) return node.text;
    if (ts.isPropertyAccessExpression(node)) return `${calleeName(node.expression)}.${node.name.text}`.replace(/^(window|globalThis)\./, "");
    if (ts.isElementAccessExpression(node)) {
      const property = staticString(node.argumentExpression);
      return property ? `${calleeName(node.expression)}.${property}`.replace(/^(window|globalThis)\./, "") : "";
    }
    return "";
  };
  const endpointFromArray = (node) => ts.isArrayLiteralExpression(node) ? node.elements[0] : null;
  const invocation = (node) => {
    const directName = calleeName(node.expression);
    if (directName === "Reflect.apply") {
      return {
        name: calleeName(node.arguments?.[0]),
        endpointNode: endpointFromArray(node.arguments?.[2]),
        wrapped: true
      };
    }
    const wrapped = /\.(call|apply|bind)$/.exec(directName);
    if (!wrapped) return { name: directName, endpointNode: node.arguments?.[0], wrapped: false };
    const wrapper = wrapped[1];
    return {
      name: directName.slice(0, -(wrapper.length + 1)),
      endpointNode: wrapper === "apply" ? endpointFromArray(node.arguments?.[1]) : node.arguments?.[1],
      wrapped: true
    };
  };
  const staticEndpoint = (node) => {
    const literal = staticString(node);
    if (literal != null) return literal;
    if ((ts.isNewExpression(node) || ts.isCallExpression(node)) && calleeName(node.expression) === "URL") {
      const target = staticString(node.arguments?.[0]);
      const base = staticString(node.arguments?.[1]);
      if (target == null) return null;
      try { return base == null ? new URL(target).href : new URL(target, base).href; } catch { return null; }
    }
    return null;
  };
  const endpointForbidden = (endpoint) => {
    if (!endpoint) return false;
    try {
      const url = new URL(endpoint);
      const host = url.hostname.replace(/^\[|\]$/g, "");
      return callRule.forbiddenEndpointPolicy.schemes.includes(url.protocol.replace(/:$/, ""))
        && callRule.forbiddenEndpointPolicy.loopbackHosts.includes(host)
        && Number(url.port || 0) === callRule.forbiddenEndpointPolicy.port
        && url.pathname.startsWith(callRule.forbiddenEndpointPolicy.pathPrefix);
    } catch { return false; }
  };
  const scanScript = (source, sourcePath, scriptKind) => {
    const file = ts.createSourceFile(sourcePath, source, ts.ScriptTarget.Latest, true, scriptKind);
    violations += file.parseDiagnostics.length;
    const visit = (node) => {
      let specifier = null;
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) specifier = staticString(node.moduleSpecifier);
      if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) specifier = staticString(node.arguments[0]);
      if (specifier && importRule.forbiddenImportFragments.some((fragment) => specifier.includes(fragment))) violations += 1;
      if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
        const resolved = ts.isCallExpression(node) ? invocation(node) : { name: calleeName(node.expression), endpointNode: node.arguments?.[0], wrapped: false };
        const name = resolved.name;
        const names = ts.isNewExpression(node) ? normalizedConstructorNames : unique([...normalizedCallNames, ...normalizedConstructorNames]);
        if (names.includes(name)) {
          if (["KnowledgeItem", "EvidenceRef", "graphRelation"].includes(name)) violations += 1;
          else {
            const endpoint = staticEndpoint(resolved.endpointNode);
            if (endpointForbidden(endpoint) || (!endpoint && ["WebSocket", "EventSource", "XMLHttpRequest"].includes(name))) violations += 1;
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(file);
  };

  for (const item of manifest.trackedPaths) {
    if (!/\.(?:[cm]?[jt]sx?|html)$/.test(item.path)) continue;
    const source = item.inlineSource.content;
    if (item.path.endsWith(".html")) {
      const document = new JSDOM(source).window.document;
      for (const [index, script] of [...document.querySelectorAll("script")].entries()) {
        const scriptSource = script.getAttribute("src");
        if (scriptSource && (importRule.forbiddenImportFragments.some((fragment) => scriptSource.includes(fragment)) || endpointForbidden(scriptSource))) violations += 1;
        if (script.textContent.trim()) scanScript(script.textContent, `${item.path}#script-${index + 1}`, ts.ScriptKind.JS);
      }
    } else {
      scanScript(source, item.path, item.path.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    }
  }
  return { scopeValid: true, violations };
}

export function semanticRulePass(ruleId, context) {
  const manifest = context.documents.acceptanceManifest;
  const report = context.documents.report;
  const human = context.documents.humanReview;
  const observations = context.documents.executionObservations;
  const screenshots = context.documents.screenshotMetadatas;
  const sources = sourceMap(context);
  const manifestScenarios = manifestScenarioMap(context);
  const results = reportResultMap(context);
  const observationById = observationMap(context);
  const screenshotById = screenshotMap(context);
  const commands = new Map(report.testCommands.map((item) => [item.checkId, item]));
  const resultList = report.scenarioResults;

  switch (ruleId) {
    case "PX_RULE_REPORT_ISSUES_NOT_EMPTY":
      return !report.passed || (![...(report.fatalIssues || []), ...(report.majorIssues || []), ...(report.warnings || [])].length);
    case "PX_RULE_SOURCE_CORPUS_INVALID":
      return manifest.sourceCorpus.length >= 12 && unique(manifest.sourceCorpus.map((item) => item.sourceSampleId)).length === manifest.sourceCorpus.length;
    case "PX_RULE_SCENARIO_ID_DUPLICATED":
      return unique(manifest.scenarios.map((item) => item.scenarioId)).length === manifest.scenarios.length && unique(resultList.map((item) => item.scenarioId)).length === resultList.length;
    case "PX_RULE_SCENARIO_SET_MISMATCH":
      return equal(sorted(manifest.scenarios.map((item) => item.scenarioId)), sorted(resultList.map((item) => item.scenarioId)));
    case "PX_RULE_SUMMARY_RECOMPUTE_MISMATCH": { // PASS means no mismatch.
      const counts = {
        sourceCorpusTotal: manifest.sourceCorpus.length,
        uniqueRealWebSources: manifest.sourceCorpus.filter((item) => item.sourceKind === "real_web").length,
        uniqueExplicitLocalDocumentSources: manifest.sourceCorpus.filter((item) => item.sourceKind === "explicit_local_document").length,
        uniqueNoteMarkdownSources: manifest.sourceCorpus.filter((item) => item.sourceKind === "note_markdown").length,
        scenariosTotal: resultList.length,
        scenariosPassed: resultList.filter((item) => item.passed).length,
        entryPointsCovered: ["open_workspace", "view_source", "open_in_workspace"].filter((entry) => resultList.some((item) => item.entryPoint === entry)).length,
        routesCovered: unique(resultList.map((item) => item.routeIntent)).length,
        invalidOrForbiddenRecoverySamples: resultList.filter((item) => ["WORKSPACE_NOT_FOUND", "SOURCE_NOT_FOUND", "FORBIDDEN", "INVALID_ROUTE"].includes(item.errorCode)).length,
        idConsistencySamples: resultList.filter((item) => Object.values(item.observedIds || {}).filter((entry) => entry.status === "observed").length >= 4).length,
        statusFaultsCovered: unique(resultList.map((item) => item.faultInjection).filter((item) => item !== "none")).length,
        permissionSamples: resultList.filter((item) => item.permissionVerification).length,
        forgetSamples: resultList.filter((item) => item.forgetVerification).length
      };
      counts.routeDirectOpenReloadPairs = ["source_library", "source_detail", "ask", "graph", "permissions"].filter((route) => {
        const modes = new Set(resultList.filter((item) => item.routeIntent === route).flatMap((item) => item.successfulRecoveryModes || []));
        return modes.has("direct_open") && modes.has("reload");
      }).length;
      counts.v2RegressionPassed = commands.get("v2_regression")?.passed === true && commands.get("v2_regression")?.result?.assertionsPassed === commands.get("v2_regression")?.result?.assertionsTotal;
      return Object.entries(counts).every(([key, value]) => report.summary[key] === value);
    }
    case "PX_RULE_SOURCE_DISTRIBUTION_FAILED":
      return manifest.sourceCorpus.length >= 12 && ["real_web", "explicit_local_document", "note_markdown"].every((kind, index) => manifest.sourceCorpus.filter((item) => item.sourceKind === kind).length >= [6, 3, 3][index]) && manifest.scenarios.length >= 12;
    case "PX_RULE_SCENARIO_SOURCE_REFERENCE_INVALID":
      return [...manifest.scenarios, ...resultList].every((scenario) => scenario.sourceSampleIds.every((id) => sources.has(id)));
    case "PX_RULE_SOURCE_KIND_RECOMPUTE_MISMATCH":
      return resultList.every((item) => equal(sorted(item.sourceKinds), sorted(unique(item.sourceSampleIds.map((id) => sources.get(id)?.sourceKind)))));
    case "PX_RULE_ENTRY_COVERAGE_FAILED": {
      const counts = Object.fromEntries(["open_workspace", "view_source", "open_in_workspace"].map((entry) => [entry, resultList.filter((item) => item.entryPoint === entry && item.passed).length]));
      const traceReady = resultList.filter((item) => item.entryPoint === "view_source" && item.statusObservation.sourceBuildStatus === "trace_ready").length;
      return Object.values(counts).every((count) => count >= 2) && traceReady >= 3;
    }
    case "PX_RULE_ROUTE_COVERAGE_FAILED":
      return ["source_library", "source_detail", "ask", "graph", "permissions"].every((route) => {
        const modes = new Set(resultList.filter((item) => item.routeIntent === route).flatMap((item) => item.successfulRecoveryModes || []));
        return ["direct_open", "reload", "back", "reopen"].every((mode) => modes.has(mode));
      });
    case "PX_RULE_RECOVERY_COVERAGE_FAILED":
      return resultList.filter((item) => item.openOutcome === "recovered" && item.errorCode).length >= 2 && semanticRulePass("PX_RULE_ROUTE_COVERAGE_FAILED", context);
    case "PX_RULE_IDENTITY_OR_IDEMPOTENCY_FAILED":
      return observations.every((item) => item.ingestCounters.after === item.ingestCounters.before && item.containerObservations.filter((entry) => entry.ids.status === "observed").every((entry) => entry.ids.workspaceId === results.get(item.scenarioId)?.workspaceId)) && resultList.every((item) => !item.passed || item.duplicateIngestDetected === false);
    case "PX_RULE_STATUS_COVERAGE_FAILED":
      return ["runtime_offline", "adapter_blocked", "data_service_unreachable", "source_failed"].every((fault) => resultList.some((item) => item.faultInjection === fault));
    case "PX_RULE_GOVERNANCE_COVERAGE_FAILED":
      return resultList.filter((item) => item.entryPoint === "permission" && item.permissionVerification).length >= 3 && resultList.filter((item) => item.entryPoint === "forget" && item.forgetVerification).length >= 3;
    case "PX_RULE_SCREENSHOT_EVIDENCE_INVALID":
      return resultList.filter((item) => item.passed).every((item) => item.screenshotPaths?.length && item.screenshotPaths.every((value) => !value.includes("prototype") && !value.includes("v2_memory_personal_knowledge_base") && artifactBytes(context.virtualArtifactContract, value)));
    case "PX_RULE_SCREENSHOT_METADATA_MISMATCH": {
      const screenshotKeys = screenshots.map((shot) => `${shot.scenarioId}\u0000${shot.captureVariantId}`);
      if (new Set(screenshotKeys).size !== screenshotKeys.length) return false;
      return resultList.every((result) => {
        const scenario = manifestScenarios.get(result.scenarioId);
        const scenarioScreenshots = screenshots.filter((item) => item.scenarioId === result.scenarioId);
        const imagePaths = result.screenshotPaths;
        const metadataPaths = result.screenshotMetadataPaths;
        if (!scenario
          || !Array.isArray(imagePaths)
          || !Array.isArray(metadataPaths)
          || imagePaths.length === 0
          || imagePaths.length !== metadataPaths.length
          || imagePaths.length !== scenarioScreenshots.length
          || new Set(imagePaths).size !== imagePaths.length
          || new Set(metadataPaths).size !== metadataPaths.length) return false;
        return metadataPaths.every((metadataPath, index) => {
          const shot = scenarioScreenshots[index];
          const metadataBytes = artifactBytes(context.virtualArtifactContract, metadataPath);
          if (!shot || !metadataBytes) return false;
          let artifactMetadata;
          try { artifactMetadata = JSON.parse(metadataBytes.toString("utf8")); } catch { return false; }
          return canonicalize(artifactMetadata) === canonicalize(shot)
            && equal(shot.viewport, { ...scenario.viewport, deviceScaleFactor: shot.viewport.deviceScaleFactor })
            && imagePaths[index] === shot.imagePath
            && result.routeIntent === shot.routeIntent
            && result.resolvedPath === shot.resolvedPath
            && equal(result.observedIds, shot.observedIds)
            && equal(result.statusObservation, shot.statusObservation);
        });
      });
    }
    case "PX_RULE_ARTIFACT_PATH_OR_HASH_INVALID": { // Check every typed reference and path/hash pair.
      const references = [{ path: report.humanReview.recordPath, sha256: report.humanReview.recordSha256 }, ...Object.values(report.auditArtifacts), ...report.testCommands.map((item) => item.logArtifact), ...resultList.flatMap((item) => item.logArtifacts || [])];
      for (const item of resultList) references.push({ path: item.executionObservationPath, sha256: item.executionObservationSha256 });
      return references.every((item) => artifactValid(context.virtualArtifactContract, item));
    }
    case "PX_RULE_V2_REGRESSION_FAILED":
      return commands.get("v2_regression")?.passed === true && commands.get("v2_regression")?.result?.assertionsPassed === commands.get("v2_regression")?.result?.assertionsTotal;
    case "PX_RULE_FAULT_INJECTION_MISMATCH":
      return resultList.every((item) => manifestScenarios.get(item.scenarioId)?.faultInjection === item.faultInjection);
    case "PX_RULE_COVERAGE_TAG_SEMANTIC_MISMATCH":
      return resultList.every((item) => {
        const allowed = new Set([`entry_${item.entryPoint}`, `route_${item.routeIntent}`, "cross_container_identity", "tab_reuse", "permission_grant_revoke", "forget_four_surface", "invalid_id_recovery", "forbidden_id_recovery", "route_direct_open", "route_reload", item.faultInjection, item.faultInjection === "source_failed" ? "source_failed_or_degraded" : ""]);
        return item.coverageTags.every((tag) => allowed.has(tag));
      });
    case "PX_RULE_ACTION_ROUTE_MISMATCH":
      return resultList.every((item) => item.entryPoint === manifestScenarios.get(item.scenarioId)?.entryPoint) && resultList.every((item) => item.entryPoint !== "open_workspace" || item.routeIntent === "source_library") && resultList.every((item) => item.entryPoint !== "view_source" || (item.routeIntent === "source_detail" && item.sourceId));
    case "PX_RULE_EXPECTED_RESULT_MAPPING_MISMATCH":
      return resultList.every((item) => { const expected = manifestScenarios.get(item.scenarioId)?.expected; return expected && expected.openOutcome === item.openOutcome && expected.routeRecoveryResult === item.routeRecoveryResult && (expected.expectedErrorCode || null) === (item.errorCode || null); });
    case "PX_RULE_ROUTE_PATH_ID_MISMATCH":
      return resultList.every((item) => item.resolvedPath === canonicalRoute(item.routeIntent, item.workspaceId, item.sourceId));
    case "PX_RULE_ROUTE_ERROR_CODE_MISMATCH":
      return resultList.every((item) => { const expected = manifestScenarios.get(item.scenarioId)?.expected?.expectedErrorCode; return expected ? item.errorCode === expected : true; });
    case "PX_RULE_TAB_REUSE_SEQUENCE_INVALID":
      return observations.filter((item) => results.get(item.scenarioId)?.coverageTags.includes("tab_reuse")).every((item) => item.attempts.length >= 2 && item.attempts[0].backgroundResult.outcome === "created_new" && item.attempts[1].backgroundResult.outcome === "focused_existing" && item.attempts[0].backgroundResult.tabId === item.attempts[1].backgroundResult.tabId && item.ingestCounters.before === item.ingestCounters.after);
    case "PX_RULE_SCHEMA_CHECK_SET_MISMATCH": { const result = commands.get("schema_meta_validation")?.result; return result?.schemasChecked === unique(result?.schemaIds || []).length && result?.schemaIds?.length === 9; }
    case "PX_RULE_SEMANTIC_POSITIVE_BASE_INVALID": {
      const computedGateResults = computeGateResults(context);
      return observations.length === 29
        && screenshots.length === 29
        && equal(sorted(observations.map((item) => item.scenarioId)), sorted(resultList.map((item) => item.scenarioId)))
        && equal(report.gateResults, computedGateResults)
        && Object.values(computedGateResults).every(Boolean);
    }
    case "PX_RULE_ARCHITECTURE_CHECK_COVERAGE_MISSING":
      return ["architecture_dependency_boundary", "architecture_forbidden_call_scan"].every((id) => commands.get(id)?.passed && commands.get(id)?.result?.resultType === "architecture");
    case "PX_RULE_UX_ACCESSIBILITY_FAILED": {
      const axe = commands.get("axe_accessibility")?.result; const keyboard = commands.get("keyboard_accessibility")?.result;
      const viewports = ["viewport_sidepanel_360", "viewport_sidepanel_420", "viewport_workspace_768", "viewport_workspace_1280"].map((id) => commands.get(id)?.result);
      return axe?.serious === 0 && axe?.critical === 0 && keyboard?.assertionsPassed === keyboard?.assertionsTotal && keyboard?.focusReturnPassed && keyboard?.escapePassed && keyboard?.reducedMotionPassed && viewports.every((item) => item && item.overflowBlockers === 0 && item.overlapBlockers === 0 && item.documentScrollWidth <= item.containerScrollWidth);
    }
    case "PX_RULE_HUMAN_REVIEW_EVIDENCE_INVALID":
      return human.evidenceClass === report.evidenceClass && human.status === "passed" && !human.blockingIssues.length && Object.values(human.gateReviews).every((item) => item.status === "passed" && item.evidenceArtifacts.every((reference) => artifactValid(context.virtualArtifactContract, reference)));
    case "PX_RULE_ARCHITECTURE_BOUNDARY_FAILED": {
      const scan = architectureScan(context);
      return scan.scopeValid && scan.violations === 0 && ["architecture_dependency_boundary", "architecture_forbidden_call_scan"].every((id) => commands.get(id)?.result?.violations === 0);
    }
    case "PX_RULE_SCREENSHOT_DECODED_DIMENSION_MISMATCH":
      return screenshots.every((shot) => { const bytes = artifactBytes(context.virtualArtifactContract, shot.imagePath); const dimensions = decodePng(bytes); return dimensions && dimensions.width === shot.viewport.width && dimensions.height === shot.viewport.height && sha256(bytes) === shot.imageSha256; });
    case "PX_RULE_VIEWPORT_SURFACE_MAPPING_INVALID": { const mapping = { scenario_01: ["viewport_sidepanel_360", "side_panel", true, false], scenario_02: ["viewport_sidepanel_420", "side_panel", true, false], scenario_08: ["viewport_workspace_768", "workspace_page", false, true], scenario_03: ["viewport_workspace_1280", "workspace_page", false, true] }; return screenshots.every((shot) => { if (!mapping[shot.scenarioId]) return shot.captureMode !== "composite_review_only"; const [variant, surface, side, workspace] = mapping[shot.scenarioId]; return shot.captureMode === "product_surface" && shot.captureVariantId === variant && shot.captureSurface === surface && shot.containerEvidence.sidePanelVisible === side && shot.containerEvidence.workspaceVisible === workspace; }); }
    case "PX_RULE_REQUEST_ID_CORRELATION_INVALID":
      return observations.every((item) => item.attempts.every((attempt) => attempt.entryAction.requestId === attempt.backgroundResult.requestId));
    case "PX_RULE_OPEN_IN_WORKSPACE_CAUSALITY_INVALID":
      return observations.filter((item) => item.entryContext.status !== "not_applicable").every((item) => { const event = item.routeEvents.at(-1); return item.entryContext.status === "observed_valid" ? event.routeIntent === item.entryContext.priorRouteIntent && event.resolvedPath === item.entryContext.priorResolvedPath : event.routeIntent === "source_library" && item.attempts.at(-1).backgroundResult.errorCode === item.entryContext.fallbackReason; });
    case "PX_RULE_FORGET_DURABLE_IDENTITY_INVALID":
      return observations.filter((item) => item.forgetLifecycle).every((item) => item.forgetLifecycle.reopenChecks.every((check) => check.workspaceId === item.forgetLifecycle.workspaceId && check.sourceId === item.forgetLifecycle.sourceId) && item.attempts.every((attempt) => attempt.entryAction.workspaceId === item.forgetLifecycle.workspaceId && attempt.entryAction.sourceId === item.forgetLifecycle.sourceId));
    case "PX_RULE_ATTEMPT_SEQUENCE_INVALID":
      return observations.every((item) => item.attempts.every((attempt, index) => attempt.sequence === index + 1 && Date.parse(attempt.entryAction.observedAt) <= Date.parse(attempt.backgroundResult.observedAt) && (!index || Date.parse(item.attempts[index - 1].backgroundResult.observedAt) <= Date.parse(attempt.entryAction.observedAt))));
    case "PX_RULE_ROUTE_EVENT_IDENTITY_INVALID":
      return observations.every((item) => { const result = results.get(item.scenarioId); return Boolean(result) && item.routeEvents.every((event) => event.workspaceId === result.workspaceId && (!result.sourceId || event.sourceId === result.sourceId)); });
    case "PX_RULE_ARCHITECTURE_SCAN_SCOPE_INVALID": { const scan = architectureScan(context); if (!scan.scopeValid) return false; const architecture = context.virtualArtifactContract.architecture; return ["architecture_dependency_boundary", "architecture_forbidden_call_scan"].every((id) => { const value = commands.get(id)?.result; return value && value.repositoryCommit === architecture.repositoryCommit && value.sourceTreeSha256 === architecture.sourceTreeSha256 && equal(sorted(value.scanRoots), sorted(architecture.scanRoots)) && value.scannedPathIndexSha256 === architecture.scannedPathIndexSha256 && value.rulesetSha256 === architecture.rulesetSha256 && value.allowlistSha256 === architecture.allowlistSha256 && equal(sorted(value.excludedPaths), sorted(architecture.excludedPaths)); }); }
    case "PX_RULE_FIXTURE_EVIDENCE_PROMOTION_INVALID":
      return report.evidenceClass === "contract_fixture" ? report.acceptanceMode === "contract_fixture" && human.evidenceClass === "contract_fixture" && report.claim.includes("not product acceptance evidence") : !Object.keys(context.virtualArtifactContract.artifactsByPath).some((key) => key.startsWith("virtual/"));
    case "PX_RULE_SOURCE_FIXTURE_UNIQUENESS_INVALID": {
      const ids = manifest.sourceCorpus.map((item) => item.sourceSampleId); const keys = manifest.sourceCorpus.map((item) => `${item.originRef}\0${item.contentFingerprint.value}`);
      return unique(ids).length === ids.length && unique(keys).length === keys.length;
    }
    default:
      throw new Error(`semantic rule is not implemented: ${ruleId}`);
  }
}

function computeGateResults(context) {
  const gateRules = {
    G1_entry: [
      "PX_RULE_ENTRY_COVERAGE_FAILED",
      "PX_RULE_ACTION_ROUTE_MISMATCH",
      "PX_RULE_REQUEST_ID_CORRELATION_INVALID"
    ],
    G2_route: [
      "PX_RULE_ROUTE_COVERAGE_FAILED",
      "PX_RULE_RECOVERY_COVERAGE_FAILED",
      "PX_RULE_ROUTE_PATH_ID_MISMATCH",
      "PX_RULE_ROUTE_ERROR_CODE_MISMATCH",
      "PX_RULE_OPEN_IN_WORKSPACE_CAUSALITY_INVALID",
      "PX_RULE_ROUTE_EVENT_IDENTITY_INVALID"
    ],
    G3_lifecycle: [
      "PX_RULE_IDENTITY_OR_IDEMPOTENCY_FAILED",
      "PX_RULE_GOVERNANCE_COVERAGE_FAILED",
      "PX_RULE_TAB_REUSE_SEQUENCE_INVALID",
      "PX_RULE_FORGET_DURABLE_IDENTITY_INVALID",
      "PX_RULE_ATTEMPT_SEQUENCE_INVALID"
    ],
    G4_architecture: [
      "PX_RULE_ARCHITECTURE_CHECK_COVERAGE_MISSING",
      "PX_RULE_ARCHITECTURE_BOUNDARY_FAILED",
      "PX_RULE_ARCHITECTURE_SCAN_SCOPE_INVALID"
    ],
    G5_status: [
      "PX_RULE_STATUS_COVERAGE_FAILED",
      "PX_RULE_FAULT_INJECTION_MISMATCH"
    ],
    G6_ux_accessibility: [
      "PX_RULE_UX_ACCESSIBILITY_FAILED",
      "PX_RULE_SCREENSHOT_EVIDENCE_INVALID",
      "PX_RULE_SCREENSHOT_METADATA_MISMATCH",
      "PX_RULE_SCREENSHOT_DECODED_DIMENSION_MISMATCH",
      "PX_RULE_VIEWPORT_SURFACE_MAPPING_INVALID"
    ],
    G7_evidence: [
      "PX_RULE_REPORT_ISSUES_NOT_EMPTY",
      "PX_RULE_ARTIFACT_PATH_OR_HASH_INVALID",
      "PX_RULE_SCHEMA_CHECK_SET_MISMATCH",
      "PX_RULE_HUMAN_REVIEW_EVIDENCE_INVALID",
      "PX_RULE_FIXTURE_EVIDENCE_PROMOTION_INVALID",
      "PX_RULE_V2_REGRESSION_FAILED"
    ]
  };
  return Object.fromEntries(Object.entries(gateRules).map(([gate, ruleIds]) => [
    gate,
    ruleIds.every((ruleId) => semanticRulePass(ruleId, context))
  ]));
}

function positiveSchemaRequests(positive) {
  const requests = [
    ["manifest", positive.documents.acceptanceManifest], ["report", positive.documents.report],
    ["human", positive.documents.humanReview], ["knowledge", positive.documents.knowledgeStatusOffline],
    ["architecture", positive.documents.architectureScanManifest]
  ].map(([schema, instance]) => ({ schema, instance }));
  for (const instance of positive.documents.executionObservations) requests.push({ schema: "execution", instance });
  for (const instance of positive.documents.screenshotMetadatas) requests.push({ schema: "screenshot", instance });
  for (const item of positive.workspaceCases) requests.push({ schema: "workspace", targetDef: item.targetDef, instance: item.instance });
  return requests;
}

export function runContractFixtureSuite(options = {}) {
  const positive = options.positiveInstances ? clone(options.positiveInstances) : readJson(positivePath);
  const payload = options.positiveEvidencePayload ? clone(options.positiveEvidencePayload) : readJson(payloadPath);
  const fixtures = options.fixtureSuite ? clone(options.fixtureSuite) : readJson(fixturePath);
  const validationSchema = readJson(path.join(contractsRoot, schemaFiles.validation));
  const ruleRegistryEntries = validationSchema["x-navia-rule-registry"];
  const requirementRegistryEntries = validationSchema["x-navia-requirement-registry"];
  const ruleRegistry = new Map(ruleRegistryEntries.map((item) => [item.ruleId, item]));
  const requirementRegistry = new Map(requirementRegistryEntries.map((item) => [item.requirementId, item]));
  const semanticRules = [...ruleRegistry.values()].filter((item) => item.enforcementLayer === "semantic");
  const issues = [];
  const semanticResult = positive.documents.report.testCommands.find((item) => item.checkId === "semantic_validator").result;
  const fixtureCases = Array.isArray(fixtures?.cases) ? fixtures.cases : [];
  const fixtureRules = Array.isArray(fixtures?.rules) ? fixtures.rules : [];
  const expectedRuleIds = ruleRegistryEntries.map((item) => item.ruleId);
  const expectedSemanticRuleIds = ruleRegistryEntries.filter((item) => item.enforcementLayer === "semantic").map((item) => item.ruleId);
  const expectedRequirementIds = requirementRegistryEntries.map((item) => item.requirementId);
  const expectedPositiveIds = [
    "acceptanceManifest", "report", "humanReview", "knowledgeStatusOffline", "architectureScanManifest",
    ...positive.documents.executionObservations.map((item) => `execution:${item.scenarioId}`),
    ...positive.documents.screenshotMetadatas.map((item) => `screenshot:${item.scenarioId}`),
    ...positive.workspaceCases.map((item) => `workspace:${item.targetDef}`)
  ];
  const implementationArtifact = {
    path: path.relative(repoRoot, validatorPath).replaceAll(path.sep, "/"),
    sha256: sha256(fs.readFileSync(validatorPath))
  };

  if (sha256(fs.readFileSync(payloadPath)) !== semanticResult.positiveEvidencePayloadArtifact.sha256) issues.push("positive evidence payload hash mismatch");
  if (sha256(fs.readFileSync(fixturePath)) !== semanticResult.fixtureSuiteSha256) issues.push("fixture suite hash mismatch");
  if (sha256(fs.readFileSync(semanticSpecPath)) !== semanticResult.semanticSpecArtifact.sha256) issues.push("semantic specification hash mismatch");
  if (ruleRegistryEntries.length !== ruleRegistry.size || ruleRegistry.size !== 63 || semanticRules.length !== 41) issues.push("rule registry must contain 63 unique rules / 41 semantic rules");
  if (requirementRegistryEntries.length !== requirementRegistry.size || requirementRegistry.size !== 109) issues.push("requirement registry must contain 109 unique requirements");

  const fixtureSuiteSchema = runSchemaRequests([{ schema: "validation", targetDef: "FixtureSuite", instance: fixtures }])[0];
  if (!fixtureSuiteSchema.valid) issues.push(`FixtureSuite schema failed: ${fixtureSuiteSchema.error}`);
  const fixtureRuleSetValid = equal(sorted(fixtureRules), sorted(expectedRuleIds));
  if (!fixtureRuleSetValid) issues.push("FixtureSuite rules do not equal the frozen RuleId set");
  const fixtureRequirementIds = fixtureCases.map((item) => item.requirementId);
  const fixtureRequirementSetValid = unique(fixtureRequirementIds).length === fixtureRequirementIds.length && equal(sorted(fixtureRequirementIds), sorted(expectedRequirementIds));
  if (!fixtureRequirementSetValid) issues.push("FixtureSuite requirements do not equal the frozen RequirementId set");
  let fixtureRegistryValid = true;
  for (const fixture of fixtureCases) {
    const requirement = requirementRegistry.get(fixture.requirementId);
    if (!requirement || requirement.requirementKey !== fixture.requirementKey || requirement.ruleId !== fixture.ruleIdUnderTest || requirement.enforcementLayer !== fixture.expectedLayer || requirement.expectedPrimaryFailure !== fixture.expectedPrimaryFailure) {
      fixtureRegistryValid = false;
      issues.push(`${fixture.requirementId}: registry mismatch`);
    }
  }
  const fixtureSuiteClosed = fixtureSuiteSchema.valid && fixtureRuleSetValid && fixtureRequirementSetValid && fixtureRegistryValid;

  const positiveSchema = runSchemaRequests(positiveSchemaRequests(positive));
  positiveSchema.forEach((result, index) => { if (!result.valid) issues.push(`positive schema ${index + 1} failed: ${result.error}`); });
  const failedSemanticRules = runRuleEngine({ registryEntries: semanticRules, evaluate: (ruleId) => semanticRulePass(ruleId, positive) }).filter((result) => result.status === "failed").map((result) => ruleRegistry.get(result.ruleId));
  for (const rule of failedSemanticRules) issues.push(`positive semantic rule failed: ${rule.ruleId}`);

  if (semanticResult.ruleSetSha256 !== sha256(fs.readFileSync(path.join(contractsRoot, schemaFiles.validation)))) issues.push("SemanticResult ruleset hash mismatch");
  if (semanticResult.rulesChecked !== 63 || !equal(sorted(semanticResult.checkedRuleIds), sorted(expectedRuleIds))) issues.push("SemanticResult RuleId coverage mismatch");
  if (!equal(sorted(semanticResult.semanticRuleIdsCovered), sorted(expectedSemanticRuleIds))) issues.push("SemanticResult semantic RuleId coverage mismatch");
  if (!equal(semanticResult.positiveInstanceIdsChecked, expectedPositiveIds) || semanticResult.positiveInstanceIndexSha256 !== sha256(Buffer.from(JSON.stringify(expectedPositiveIds)))) issues.push("SemanticResult positive instance binding mismatch");
  if (!equal(sorted(semanticResult.fixtureRequirementIdsChecked), sorted(expectedRequirementIds))) issues.push("SemanticResult fixture requirement coverage mismatch");
  const computedGateResults = computeGateResults(positive);
  if (!equal(positive.documents.report.gateResults, computedGateResults)) issues.push("Report G1-G7 do not match recomputed gates");

  const reportCommands = new Map(positive.documents.report.testCommands.map((item) => [item.checkId, item]));
  const schemaMetaResult = reportCommands.get("schema_meta_validation")?.result;
  const schemaFixtureResult = reportCommands.get("schema_fixture_validation")?.result;
  const expectedFixtureValidationInstances = positiveSchema.length + fixtureCases.length + 1;
  const expectedSchemaIds = Object.values(schemaFiles).map((fileName) => fileName.replace(/\.schema\.json$/, ""));
  if (schemaMetaResult?.schemasChecked !== 9
    || schemaMetaResult?.instancesChecked !== 9
    || schemaMetaResult?.failures !== 0
    || !equal(sorted(schemaMetaResult?.schemaIds || []), sorted(expectedSchemaIds))) {
    issues.push("schema meta-validation result does not match the executed schema set");
  }
  if (schemaFixtureResult?.schemasChecked !== 9
    || schemaFixtureResult?.instancesChecked !== expectedFixtureValidationInstances
    || schemaFixtureResult?.failures !== 0
    || !equal(schemaFixtureResult?.positiveInstanceIdsChecked || [], expectedPositiveIds)
    || !equal(sorted(schemaFixtureResult?.fixtureRequirementIdsChecked || []), sorted(expectedRequirementIds))) {
    issues.push("schema fixture-validation result does not match the executed instance set");
  }

  const effectiveSemanticResult = {
    ...clone(semanticResult),
    validatorImplementationArtifact: implementationArtifact,
    failedRules: failedSemanticRules.map((rule) => rule.failureCode)
  };
  const effectiveSemanticSchema = runSchemaRequests([{ schema: "report", targetDef: "SemanticResult", instance: effectiveSemanticResult }])[0];
  if (!effectiveSemanticSchema.valid) issues.push(`effective SemanticResult schema failed: ${effectiveSemanticSchema.error}`);

  let fixtureRequests = [];
  if (fixtureSuiteClosed) {
    try {
      fixtureRequests = fixtureCases.map((fixture) => {
        const base = pointerGet(positive, fixture.base);
        const instance = patchDocument(base, fixture.patch);
        return { schema: schemaTargetForPointer(fixture.base), targetDef: fixture.targetDef, instance };
      });
    } catch (error) {
      issues.push(`RFC 6902 fixture execution failed: ${error.message}`);
      fixtureRequests = [];
    }
  }
  const schemaResults = fixtureRequests.length ? runSchemaRequests(fixtureRequests) : [];
  const caseResults = [];
  fixtureRequests.forEach((request, index) => {
    const fixture = fixtureCases[index];
    const schemaValid = schemaResults[index].valid;
    if (schemaValid !== fixture.expectedSchemaValid) issues.push(`${fixture.requirementId}: schema result ${schemaValid} != ${fixture.expectedSchemaValid}`);
    let actualPrimaryFailure = schemaValid ? null : "SCHEMA_VALIDATION_FAILED";
    let failedSemanticRuleIds = [];
    let semanticFailureCodes = [];
    if (schemaValid && fixture.expectedLayer === "semantic") {
      const mutated = fixtureRequests[index].instance;
      const context = contextWithMutation(positive, fixture.base, mutated);
      const rule = ruleRegistry.get(fixture.ruleIdUnderTest);
      const failed = semanticRules.filter((candidate) => !semanticRulePass(candidate.ruleId, context));
      failedSemanticRuleIds = failed.map((candidate) => candidate.ruleId);
      semanticFailureCodes = unique(failed.map((candidate) => candidate.failureCode));
      if (failedSemanticRuleIds.includes(fixture.ruleIdUnderTest)) actualPrimaryFailure = rule.failureCode;
      const unexpectedFailures = semanticFailureCodes.filter((failureCode) => failureCode !== fixture.expectedPrimaryFailure && !fixture.allowedWarnings.includes(failureCode));
      if (unexpectedFailures.length) issues.push(`${fixture.requirementId}: undeclared semantic failures ${unexpectedFailures.join(", ")}`);
    }
    if (actualPrimaryFailure !== fixture.expectedPrimaryFailure) issues.push(`${fixture.requirementId}: primary failure ${actualPrimaryFailure || "none"} != ${fixture.expectedPrimaryFailure}`);
    caseResults.push({ requirementId: fixture.requirementId, expectedLayer: fixture.expectedLayer, schemaValid, primaryFailure: actualPrimaryFailure, failedSemanticRuleIds, semanticFailureCodes });
  });

  return {
    passed: issues.length === 0,
    stage: "V2-PX-0.2-contract-fixture-validation",
    counts: { schemas: 9, positiveInstances: positiveSchema.length, fixtureSuiteRoots: 1, fixtureValidationInstances: positiveSchema.length + fixtureCases.length + 1, rules: ruleRegistry.size, semanticRules: semanticRules.length, fixtures: fixtureCases.length },
    implementationArtifact,
    effectiveSemanticResult,
    computedGateResults,
    frozenInputs: {
      semanticSpecSha256: sha256(fs.readFileSync(semanticSpecPath)),
      fixtureSuiteSha256: sha256(fs.readFileSync(fixturePath)),
      positiveEvidencePayloadSha256: sha256(fs.readFileSync(payloadPath))
    },
    issues,
    caseResults
  };
}

function main() {
  const contractMode = process.argv.includes("--contract-fixtures") || process.argv.length === 2;
  if (!contractMode) throw new Error("PX-0.2 currently accepts only --contract-fixtures; production evidence is introduced by PX-5");
  const result = runContractFixtureSuite();
  const output = process.argv.includes("--verbose") ? result : {
    passed: result.passed,
    stage: result.stage,
    counts: result.counts,
    implementationArtifact: result.implementationArtifact,
    frozenInputs: result.frozenInputs,
    computedGateResults: result.computedGateResults,
    semanticResultBinding: {
      ruleSetId: result.effectiveSemanticResult.ruleSetId,
      rulesChecked: result.effectiveSemanticResult.rulesChecked,
      semanticRulesCovered: result.effectiveSemanticResult.semanticRuleIdsCovered.length,
      positiveInstancesChecked: result.effectiveSemanticResult.positiveInstanceIdsChecked.length,
      fixtureRequirementsChecked: result.effectiveSemanticResult.fixtureRequirementIdsChecked.length,
      validatorImplementationArtifact: result.effectiveSemanticResult.validatorImplementationArtifact,
      failedRules: result.effectiveSemanticResult.failedRules
    },
    issues: result.issues,
    fixtureFailuresVerified: result.caseResults.filter((item) => item.primaryFailure).length
  };
  console.log(JSON.stringify(output, null, 2));
  if (!result.passed) process.exitCode = 2;
}

if (path.resolve(process.argv[1] || "") === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) { console.error(JSON.stringify({ passed: false, stage: "V2-PX-0.2-contract-fixture-validation", issues: [error.stack || error.message] }, null, 2)); process.exitCode = 2; }
}
