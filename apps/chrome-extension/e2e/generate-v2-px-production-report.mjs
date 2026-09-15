import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs, refForBytes, validateJsonSchema, writeAtomic, writeJson } from "./lib/v2PxPipelineIo.mjs";
import { buildProductionReport, createPendingHumanReview, renderCandidateHtml } from "./lib/v2PxProductionReport.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");
const contractsRoot = path.join(repoRoot, "docs/active/project/contracts");

function outputRef(outputRoot, relativePath, mediaType) {
  const bytes = fs.readFileSync(path.join(outputRoot, relativePath));
  return refForBytes("validation_run", relativePath, bytes, mediaType);
}

function assertCandidate(validation) {
  const statuses = validation.ruleResults.reduce((result, item) => ({ ...result, [item.status]: (result[item.status] ?? 0) + 1 }), {});
  if (validation.machinePassed !== true || validation.finalPassed !== false || validation.humanReviewStatus !== "pending") throw new Error("ProductionValidation is not a pending machine-passed candidate.");
  if (statuses.passed !== 61 || statuses.pending !== 2 || (statuses.failed ?? 0) !== 0 || (statuses.not_applicable ?? 0) !== 0) throw new Error(`Unexpected RuleResult denominator: ${JSON.stringify(statuses)}`);
  if (!Object.entries(validation.gateResults).every(([gate, status]) => status === (gate === "G7" ? "pending" : "passed"))) throw new Error("ProductionValidation gate statuses are not G1-G6 passed and G7 pending.");
}

function auditDocuments(validation) {
  return {
    "audits/prd-coverage-review.md": `# T03 PRD 覆盖复核\n\n- sourceRunId: \`${validation.sourceRunId}\`\n- G1-G6: 机器检查通过。\n- G7: 等待独立 Human Review。\n- 范围：仅 V2-PX 三入口、Route A、生命周期、架构边界、状态与可访问性；不包含 RKM/RAG/自动维护。\n- 结论：自动候选可送审，不构成 PX-5、PX-6 或 V2 最终通过。\n`,
    "audits/architecture-review.md": `# T03 架构复核\n\n- 数据流：sealed raw -> ArtifactReader -> DerivedFacts -> shared semantic/AST -> ProductionValidation -> pending Human Review -> pure Report。\n- 扫描快照：\`${validation.sourceRunId}\` 所绑定 repository snapshot。\n- G4: ${validation.gateResults.G4}。\n- 结论：机器架构检查通过，最终门禁等待独立审查。\n`,
    "audits/false-green-audit.md": `# T03 防假绿复核\n\n- 63 条规则：61 passed / 2 human-only pending。\n- production mutations：${validation.productionMutationResults.passed}/${validation.productionMutationResults.total} passed。\n- contract regression：${validation.contractRegression.passed}/${validation.contractRegression.total} passed。\n- finalPassed=false；Human Review=pending。\n- 禁止把机器候选提升为产品通过。\n`,
    "logs/semantic-validator.log": `${JSON.stringify({ validationRunId: validation.validationRunId, sourceRunId: validation.sourceRunId, machinePassed: validation.machinePassed, humanReviewStatus: validation.humanReviewStatus, finalPassed: validation.finalPassed, gateResults: validation.gateResults, ruleStatuses: validation.ruleResults.map(({ ruleId, status, failureCode }) => ({ ruleId, status, failureCode })) }, null, 2)}\n`
  };
}

export function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv, ["derived", "validation", "output-root"]);
  const outputRoot = path.resolve(args["output-root"]);
  const derivedPath = path.resolve(args.derived);
  const validationPath = path.resolve(args.validation);
  if (path.dirname(derivedPath) !== outputRoot || path.dirname(validationPath) !== outputRoot) throw new Error("--derived and --validation must be direct children of --output-root.");
  const derived = JSON.parse(fs.readFileSync(derivedPath, "utf8"));
  const validation = JSON.parse(fs.readFileSync(validationPath, "utf8"));
  validateJsonSchema(path.join(contractsRoot, "v2_px_derived_facts.schema.json"), derived);
  validateJsonSchema(path.join(contractsRoot, "v2_px_production_validation.schema.json"), validation);
  assertCandidate(validation);

  const humanReview = createPendingHumanReview();
  writeJson(path.join(outputRoot, "human-review.pending.json"), humanReview);
  validateJsonSchema(path.join(contractsRoot, "v2_external_brain_human_review.schema.json"), humanReview);

  for (const [relativePath, content] of Object.entries(auditDocuments(validation))) writeAtomic(path.join(outputRoot, relativePath), Buffer.from(content, "utf8"));
  const html = renderCandidateHtml({ derived, validation, humanReview });
  writeAtomic(path.join(outputRoot, "acceptance-report.html"), Buffer.from(html, "utf8"));

  const references = {
    derived: outputRef(outputRoot, path.basename(derivedPath), "application/json"),
    productionValidation: outputRef(outputRoot, path.basename(validationPath), "application/json"),
    humanReview: outputRef(outputRoot, "human-review.pending.json", "application/json"),
    auditArtifacts: {
      acceptanceHtml: outputRef(outputRoot, "acceptance-report.html", "text/html"),
      prdReview: outputRef(outputRoot, "audits/prd-coverage-review.md", "text/markdown"),
      architectureReview: outputRef(outputRoot, "audits/architecture-review.md", "text/markdown"),
      falseGreenAudit: outputRef(outputRoot, "audits/false-green-audit.md", "text/markdown"),
      semanticValidatorLog: outputRef(outputRoot, "logs/semantic-validator.log", "text/plain")
    }
  };
  const report = buildProductionReport({ derived, validation, humanReview, references });
  writeJson(path.join(outputRoot, "report.json"), report);
  validateJsonSchema(path.join(contractsRoot, "v2_external_brain_report.schema.json"), report);
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.exitCode = main(); } catch (error) { console.error(error.stack ?? error.message); process.exitCode = 1; }
}
