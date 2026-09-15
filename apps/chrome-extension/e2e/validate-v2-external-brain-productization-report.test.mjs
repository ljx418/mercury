import { describe, expect, it } from "vitest";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import {
  architectureScan,
  decodePng,
  patchDocument,
  runContractFixtureSuite,
  semanticRulePass
} from "./validate-v2-external-brain-productization-report.mjs";

const fixturePath = path.resolve(
  process.cwd(),
  "../../docs/active/project/contracts/fixtures/v2_external_brain/px-0.1-contract-fixtures.json"
);
const positivePath = path.resolve(
  process.cwd(),
  "../../docs/active/project/contracts/fixtures/v2_external_brain/px-0.1b-positive-instances.json"
);
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");

function canonicalize(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function withSecondScreenshotPair() {
  const context = JSON.parse(fs.readFileSync(positivePath, "utf8"));
  const result = context.documents.report.scenarioResults.find((item) => item.scenarioId === "scenario_01");
  const screenshotIndex = context.documents.screenshotMetadatas.findIndex((item) => item.scenarioId === "scenario_01");
  const primary = context.documents.screenshotMetadatas[screenshotIndex];
  const secondary = structuredClone(primary);
  secondary.captureVariantId = "scenario_01_secondary";
  secondary.imagePath = "virtual/screenshots/scenario_01_secondary.png";
  const metadataPath = "fixtures/scenario_01/screen-secondary.json";
  context.documents.screenshotMetadatas.splice(screenshotIndex + 1, 0, secondary);
  context.virtualArtifactContract.artifactsByPath[secondary.imagePath] = structuredClone(
    context.virtualArtifactContract.artifactsByPath[primary.imagePath]
  );
  const content = canonicalize(secondary);
  context.virtualArtifactContract.artifactsByPath[metadataPath] = {
    encoding: "utf8",
    serialization: "navia_canonical_json_v1",
    content,
    sha256: sha256(Buffer.from(content))
  };
  result.screenshotPaths.push(secondary.imagePath);
  result.screenshotMetadataPaths.push(metadataPath);
  return context;
}

function architectureContextWithSource(filePath, source) {
  const context = JSON.parse(fs.readFileSync(positivePath, "utf8"));
  const manifest = context.documents.architectureScanManifest;
  const tracked = manifest.trackedPaths.find((item) => item.path === filePath);
  const sourceHash = sha256(Buffer.from(source));
  tracked.inlineSource.content = source;
  tracked.inlineSource.sha256 = sourceHash;
  tracked.blobSha256 = sourceHash;
  const tree = `${[...manifest.trackedPaths]
    .sort((left, right) => left.path.localeCompare(right.path, "en"))
    .map((item) => `${item.mode} ${item.blobSha256} ${item.path}`)
    .join("\n")}\n`;
  manifest.canonicalSourceTree.content = tree;
  manifest.canonicalSourceTree.sha256 = sha256(Buffer.from(tree));
  return context;
}

describe("V2-PX PX-0.2 semantic validator", () => {
  it("passes the frozen positive base and rejects all 109 registered fixtures", () => {
    const result = runContractFixtureSuite();
    expect(result.issues).toEqual([]);
    expect(result.passed).toBe(true);
    expect(result.counts).toEqual({
      schemas: 9,
      positiveInstances: 65,
      fixtureSuiteRoots: 1,
      fixtureValidationInstances: 175,
      rules: 63,
      semanticRules: 41,
      fixtures: 109
    });
    expect(result.caseResults).toHaveLength(109);
    expect(result.caseResults.every((item) => item.primaryFailure)).toBe(true);
    expect(result.computedGateResults).toEqual({
      G1_entry: true,
      G2_route: true,
      G3_lifecycle: true,
      G4_architecture: true,
      G5_status: true,
      G6_ux_accessibility: true,
      G7_evidence: true
    });
    expect(result.effectiveSemanticResult.validatorImplementationArtifact.path).toBe(
      "apps/chrome-extension/e2e/validate-v2-external-brain-productization-report.mjs"
    );
    expect(result.effectiveSemanticResult.validatorImplementationArtifact.path).not.toContain("virtual/");
    expect(result.effectiveSemanticResult.failedRules).toEqual([]);
  }, 120_000);

  it("is deterministic across repeated executions", () => {
    const first = runContractFixtureSuite();
    const second = runContractFixtureSuite();
    expect(second.counts).toEqual(first.counts);
    expect(second.issues).toEqual(first.issues);
    expect(second.caseResults).toEqual(first.caseResults);
  }, 120_000);

  it("fails closed when the frozen fixture registry mapping is malformed", () => {
    const fixtureSuite = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
    fixtureSuite.cases[0].expectedPrimaryFailure = "PX_UNKNOWN_FAILURE";
    const result = runContractFixtureSuite({ fixtureSuite });
    expect(result.passed).toBe(false);
    expect(result.issues.some((issue) => issue.includes("FixtureSuite schema failed") || issue.includes("PX-N-001: registry mismatch"))).toBe(true);
  }, 120_000);

  it("recomputes semantic rules and gates instead of trusting report booleans", () => {
    const positiveInstances = JSON.parse(fs.readFileSync(positivePath, "utf8"));
    positiveInstances.documents.executionObservations[0].attempts[0].backgroundResult.requestId = "request_tampered";
    const result = runContractFixtureSuite({ positiveInstances });
    expect(result.passed).toBe(false);
    expect(result.issues).toContain("positive semantic rule failed: PX_RULE_REQUEST_ID_CORRELATION_INVALID");
    expect(result.issues).toContain("Report G1-G7 do not match recomputed gates");
    expect(result.computedGateResults.G1_entry).toBe(false);
  }, 120_000);

  it("rejects malformed FixtureSuite roots before executing patches", () => {
    const base = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
    const variants = [];

    const unexpected = structuredClone(base);
    unexpected.unexpected = true;
    variants.push(unexpected);

    const unknownWarning = structuredClone(base);
    unknownWarning.cases[0].allowedWarnings = ["PX_UNKNOWN_WARNING"];
    variants.push(unknownWarning);

    const duplicate = structuredClone(base);
    duplicate.cases[1] = structuredClone(duplicate.cases[0]);
    variants.push(duplicate);

    const missing = structuredClone(base);
    missing.cases.pop();
    variants.push(missing);

    for (const fixtureSuite of variants) {
      const result = runContractFixtureSuite({ fixtureSuite });
      expect(result.passed).toBe(false);
      expect(result.issues.some((issue) => issue.includes("FixtureSuite"))).toBe(true);
      expect(result.caseResults).toEqual([]);
    }
  }, 120_000);

  it("implements strict RFC 6902 array indices and fails the suite closed", () => {
    expect(patchDocument(["a"], [{ op: "add", path: "/-", value: "b" }])).toEqual(["a", "b"]);
    expect(patchDocument(["a"], [{ op: "add", path: "/0", value: "b" }])).toEqual(["b", "a"]);
    expect(patchDocument(["a"], [{ op: "add", path: "/1", value: "b" }])).toEqual(["a", "b"]);
    for (const invalid of ["not-a-valid-array-index", "-1", "01", "2", "9007199254740992"]) {
      expect(() => patchDocument(["a"], [{ op: "add", path: `/${invalid}`, value: "b" }])).toThrow();
    }
    expect(() => patchDocument(["a"], [{ op: "remove", path: "/1" }])).toThrow();
    expect(() => patchDocument(["a"], [{ op: "replace", path: "/-", value: "b" }])).toThrow();

    const fixtureSuite = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
    fixtureSuite.cases.find((item) => item.requirementId === "PX-N-099").patch[0].path = "/testCommands/3/result/excludedPaths/not-a-valid-array-index";
    const result = runContractFixtureSuite({ fixtureSuite });
    expect(result.passed).toBe(false);
    expect(result.issues.some((issue) => issue.includes("RFC 6902 fixture execution failed"))).toBe(true);
    expect(result.caseResults).toEqual([]);
  }, 120_000);

  it("binds screenshot metadata paths to canonical artifact bytes", () => {
    const missing = JSON.parse(fs.readFileSync(positivePath, "utf8"));
    delete missing.virtualArtifactContract.artifactsByPath["fixtures/scenario_01/screen.json"];
    const missingResult = runContractFixtureSuite({ positiveInstances: missing });
    expect(missingResult.passed).toBe(false);
    expect(missingResult.issues).toContain("positive semantic rule failed: PX_RULE_SCREENSHOT_METADATA_MISMATCH");

    const mismatched = JSON.parse(fs.readFileSync(positivePath, "utf8"));
    const artifact = mismatched.virtualArtifactContract.artifactsByPath["fixtures/scenario_01/screen.json"];
    const parsed = JSON.parse(artifact.content);
    parsed.routeIntent = "ask";
    artifact.content = JSON.stringify(parsed);
    artifact.sha256 = sha256(Buffer.from(artifact.content));
    const mismatchResult = runContractFixtureSuite({ positiveInstances: mismatched });
    expect(mismatchResult.passed).toBe(false);
    expect(mismatchResult.issues).toContain("positive semantic rule failed: PX_RULE_SCREENSHOT_METADATA_MISMATCH");
  }, 180_000);

  it("enforces one-to-one screenshot and metadata pairing for every index", () => {
    const validMultiPair = withSecondScreenshotPair();
    expect(semanticRulePass("PX_RULE_SCREENSHOT_METADATA_MISMATCH", validMultiPair)).toBe(true);

    const duplicateImagePath = withSecondScreenshotPair();
    const duplicateResult = duplicateImagePath.documents.report.scenarioResults[0];
    const duplicateShot = duplicateImagePath.documents.screenshotMetadatas.find(
      (item) => item.scenarioId === "scenario_01" && item.captureVariantId === "scenario_01_secondary"
    );
    duplicateShot.imagePath = duplicateResult.screenshotPaths[0];
    duplicateShot.imageSha256 = duplicateImagePath.documents.screenshotMetadatas.find(
      (item) => item.scenarioId === "scenario_01" && item.captureVariantId === "viewport_sidepanel_360"
    ).imageSha256;
    duplicateResult.screenshotPaths[1] = duplicateResult.screenshotPaths[0];
    const duplicateMetadataArtifact = duplicateImagePath.virtualArtifactContract.artifactsByPath[
      duplicateResult.screenshotMetadataPaths[1]
    ];
    duplicateMetadataArtifact.content = canonicalize(duplicateShot);
    duplicateMetadataArtifact.sha256 = sha256(Buffer.from(duplicateMetadataArtifact.content));
    expect(semanticRulePass("PX_RULE_SCREENSHOT_METADATA_MISMATCH", duplicateImagePath)).toBe(false);

    const duplicateMetadataPath = withSecondScreenshotPair();
    duplicateMetadataPath.documents.report.scenarioResults[0].screenshotMetadataPaths[1] =
      duplicateMetadataPath.documents.report.scenarioResults[0].screenshotMetadataPaths[0];
    expect(semanticRulePass("PX_RULE_SCREENSHOT_METADATA_MISMATCH", duplicateMetadataPath)).toBe(false);

    const extraImage = JSON.parse(fs.readFileSync(positivePath, "utf8"));
    extraImage.documents.report.scenarioResults[0].screenshotPaths.push("virtual/screenshots/420x900.png");
    expect(semanticRulePass("PX_RULE_SCREENSHOT_METADATA_MISMATCH", extraImage)).toBe(false);

    const extraMetadata = JSON.parse(fs.readFileSync(positivePath, "utf8"));
    extraMetadata.documents.report.scenarioResults[0].screenshotMetadataPaths.push("fixtures/scenario_02/screen.json");
    expect(semanticRulePass("PX_RULE_SCREENSHOT_METADATA_MISMATCH", extraMetadata)).toBe(false);

    const reordered = withSecondScreenshotPair();
    reordered.documents.report.scenarioResults[0].screenshotPaths.reverse();
    expect(semanticRulePass("PX_RULE_SCREENSHOT_METADATA_MISMATCH", reordered)).toBe(false);

    const crossScenario = JSON.parse(fs.readFileSync(positivePath, "utf8"));
    crossScenario.documents.report.scenarioResults[0].screenshotMetadataPaths[0] = "fixtures/scenario_02/screen.json";
    expect(semanticRulePass("PX_RULE_SCREENSHOT_METADATA_MISMATCH", crossScenario)).toBe(false);

    const duplicateMetadata = JSON.parse(fs.readFileSync(positivePath, "utf8"));
    duplicateMetadata.documents.screenshotMetadatas.push(structuredClone(duplicateMetadata.documents.screenshotMetadatas[0]));
    expect(semanticRulePass("PX_RULE_SCREENSHOT_METADATA_MISMATCH", duplicateMetadata)).toBe(false);
  }, 180_000);

  it("fully decodes PNG data and rejects corrupt or truncated IDAT streams", () => {
    const valid = PNG.sync.write({ width: 2, height: 2, data: Buffer.alloc(16, 255) });
    expect(decodePng(valid)).toEqual({ width: 2, height: 2, pixelBytes: 16 });

    const corrupt = Buffer.from(valid);
    const idat = corrupt.indexOf(Buffer.from("IDAT"));
    corrupt[idat + 4] ^= 0xff;
    expect(decodePng(corrupt)).toBeNull();
    expect(decodePng(valid.subarray(0, valid.length - 8))).toBeNull();
  });

  it("detects normalized endpoint and HTML module-script G4 bypasses", () => {
    const tsxPath = "apps/chrome-extension/src/modules/knowledge_workspace/KnowledgeWorkspaceShell.tsx";
    const htmlPath = "apps/chrome-extension/entrypoints/workspace/index.html";
    const sources = [
      [tsxPath, 'fetch (new URL("http://localhost:17861/v1/query"));'],
      [tsxPath, 'globalThis.fetch(new URL("/v1/query", "http://127.0.0.1:17861"));'],
      [tsxPath, 'axios["post"](new URL("http://[::1]:17861/v1/query"));'],
      [tsxPath, 'fetch.call(globalThis, "http://localhost:17861/v1/query");'],
      [tsxPath, 'globalThis.fetch.apply(globalThis, ["http://127.0.0.1:17861/v1/query"]);'],
      [tsxPath, 'window.fetch.bind(window, "http://[::1]:17861/v1/query");'],
      [tsxPath, 'Reflect.apply(fetch, globalThis, ["http://localhost:17861/v1/query"]);'],
      [htmlPath, '<!doctype html><script type="module">fetch(new URL("http://localhost:17861/v1/query"));</script>']
    ];
    for (const [filePath, source] of sources) {
      const result = architectureScan(architectureContextWithSource(filePath, source));
      expect(result.scopeValid).toBe(true);
      expect(result.violations).toBeGreaterThan(0);
    }
  });
});
