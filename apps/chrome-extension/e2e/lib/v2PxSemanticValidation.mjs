import { JSDOM } from "jsdom";
import ts from "typescript";
import { sha256 } from "./v2PxArtifactReader.mjs";

const unique = (values) => [...new Set(values)];
const sorted = (values) => [...values].sort((left, right) => left.localeCompare(right, "en"));
const equal = (left, right) => JSON.stringify(left) === JSON.stringify(right);

export function readRuleRegistry(validationSchema) {
  const entries = validationSchema?.["x-navia-rule-registry"];
  if (!Array.isArray(entries)) throw new Error("Validation Contracts rule registry is missing.");
  const ids = entries.map((entry) => entry.ruleId);
  if (new Set(ids).size !== entries.length) throw new Error("Validation Contracts contains duplicate RuleId values.");
  for (const entry of entries) {
    if (!/^PX_RULE_[A-Z0-9_]+$/.test(entry.ruleId)) throw new Error(`Invalid RuleId: ${entry.ruleId}`);
    if (!/^(?:SCHEMA_VALIDATION_FAILED|PX_[A-Z0-9_]+)$/.test(entry.failureCode)) throw new Error(`Invalid FailureCode: ${entry.failureCode}`);
    if (!['schema', 'semantic'].includes(entry.enforcementLayer)) throw new Error(`Invalid enforcement layer: ${entry.enforcementLayer}`);
  }
  return entries.map((entry) => ({ ...entry }));
}

export function runRuleEngine({ registryEntries, evaluate, pendingRuleIds = [] }) {
  const pending = new Set(pendingRuleIds);
  return registryEntries.map((entry) => {
    if (pending.has(entry.ruleId)) return { ...entry, status: "pending", failureCode: entry.failureCode };
    const outcome = evaluate(entry.ruleId, entry);
    const passed = outcome === true || outcome?.passed === true;
    return { ...entry, status: passed ? "passed" : "failed", failureCode: passed ? null : entry.failureCode, evidenceRefs: outcome?.evidenceRefs ?? [], notes: outcome?.notes ?? "" };
  });
}

export function scanTypeScriptArchitecture({ manifest, artifactBytes, artifactValid }) {
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
    && artifactValid(manifest.rulesetArtifact) && artifactValid(manifest.allowlistArtifact);
  if (!scopeValid) return { scopeValid: false, violations: 0, findings: [] };

  const ruleset = JSON.parse(artifactBytes(manifest.rulesetArtifact.path).toString("utf8"));
  const allowlist = JSON.parse(artifactBytes(manifest.allowlistArtifact.path).toString("utf8"));
  const expectedAlgorithms = new Set(["typescript_ast_import_specifier_literal_v2", "typescript_ast_call_new_expression_and_endpoint_normalization_v2"]);
  if (!ruleset.checks?.length || !ruleset.checks.every((check) => expectedAlgorithms.has(check.algorithm)) || !equal(sorted(ruleset.nonOverridableRules || []), sorted(allowlist.forbiddenOverrides || []))) return { scopeValid: false, violations: 0, findings: [] };

  const findings = [];
  const importRule = ruleset.checks.find((check) => check.checkId === "architecture_dependency_boundary");
  const callRule = ruleset.checks.find((check) => check.checkId === "architecture_forbidden_call_scan");
  if (!importRule || !callRule) return { scopeValid: false, violations: 0, findings: [] };
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
    if (ts.isElementAccessExpression(node)) { const property = staticString(node.argumentExpression); return property ? `${calleeName(node.expression)}.${property}`.replace(/^(window|globalThis)\./, "") : ""; }
    return "";
  };
  const endpointFromArray = (node) => ts.isArrayLiteralExpression(node) ? node.elements[0] : null;
  const invocation = (node) => {
    const directName = calleeName(node.expression);
    if (directName === "Reflect.apply") return { name: calleeName(node.arguments?.[0]), endpointNode: endpointFromArray(node.arguments?.[2]) };
    const wrapped = /\.(call|apply|bind)$/.exec(directName);
    if (!wrapped) return { name: directName, endpointNode: node.arguments?.[0] };
    return { name: directName.slice(0, -(wrapped[1].length + 1)), endpointNode: wrapped[1] === "apply" ? endpointFromArray(node.arguments?.[1]) : node.arguments?.[1] };
  };
  const staticEndpoint = (node) => {
    const literal = staticString(node); if (literal != null) return literal;
    if ((ts.isNewExpression(node) || ts.isCallExpression(node)) && calleeName(node.expression) === "URL") {
      const target = staticString(node.arguments?.[0]); const base = staticString(node.arguments?.[1]);
      if (target == null) return null;
      try { return base == null ? new URL(target).href : new URL(target, base).href; } catch { return null; }
    }
    return null;
  };
  const endpointForbidden = (endpoint) => {
    if (!endpoint) return false;
    try {
      const url = new URL(endpoint); const host = url.hostname.replace(/^\[|\]$/g, "");
      return callRule.forbiddenEndpointPolicy.schemes.includes(url.protocol.replace(/:$/, "")) && callRule.forbiddenEndpointPolicy.loopbackHosts.includes(host) && Number(url.port || 0) === callRule.forbiddenEndpointPolicy.port && url.pathname.startsWith(callRule.forbiddenEndpointPolicy.pathPrefix);
    } catch { return false; }
  };
  const add = (path, kind, detail) => findings.push({ path, kind, detail });
  const scanScript = (source, sourcePath, scriptKind) => {
    const file = ts.createSourceFile(sourcePath, source, ts.ScriptTarget.Latest, true, scriptKind);
    for (const diagnostic of file.parseDiagnostics) add(sourcePath, "parse", String(diagnostic.messageText));
    const visit = (node) => {
      let specifier = null;
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) specifier = staticString(node.moduleSpecifier);
      if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) specifier = staticString(node.arguments[0]);
      if (specifier && importRule.forbiddenImportFragments.some((fragment) => specifier.includes(fragment))) add(sourcePath, "forbidden_import", specifier);
      if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
        const resolved = ts.isCallExpression(node) ? invocation(node) : { name: calleeName(node.expression), endpointNode: node.arguments?.[0] };
        const names = ts.isNewExpression(node) ? normalizedConstructorNames : unique([...normalizedCallNames, ...normalizedConstructorNames]);
        if (names.includes(resolved.name)) {
          if (["KnowledgeItem", "EvidenceRef", "graphRelation"].includes(resolved.name)) add(sourcePath, "forbidden_fact_creation", resolved.name);
          else { const endpoint = staticEndpoint(resolved.endpointNode); if (endpointForbidden(endpoint) || (!endpoint && ["WebSocket", "EventSource", "XMLHttpRequest"].includes(resolved.name))) add(sourcePath, "forbidden_endpoint", endpoint ?? resolved.name); }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(file);
  };
  for (const item of manifest.trackedPaths) {
    if (!/\.(?:[cm]?[jt]sx?|html)$/.test(item.path)) continue;
    if (item.path.endsWith(".html")) {
      const document = new JSDOM(item.inlineSource.content).window.document;
      for (const [index, script] of [...document.querySelectorAll("script")].entries()) {
        const src = script.getAttribute("src");
        if (src && (importRule.forbiddenImportFragments.some((fragment) => src.includes(fragment)) || endpointForbidden(src))) add(item.path, "forbidden_script", src);
        if (script.textContent.trim()) scanScript(script.textContent, `${item.path}#script-${index + 1}`, ts.ScriptKind.JS);
      }
    } else scanScript(item.inlineSource.content, item.path, item.path.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  }
  return { scopeValid: true, violations: findings.length, findings };
}

