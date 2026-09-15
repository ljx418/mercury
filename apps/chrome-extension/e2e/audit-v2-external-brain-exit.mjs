import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");
const px5Root = path.join(repoRoot, "docs/active/project/evidence/v2_external_brain_productization/px-5");
const px6Root = path.join(repoRoot, "docs/active/project/evidence/v2_external_brain_productization/px-6");
fs.mkdirSync(px6Root, { recursive: true });
const sha256 = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const rel = (absolute) => path.relative(repoRoot, absolute).replaceAll(path.sep, "/");
const ref = (absolute) => ({ path: rel(absolute), sha256: sha256(fs.readFileSync(absolute)) });
const readJson = (absolute) => JSON.parse(fs.readFileSync(absolute, "utf8"));
const issues = [];

const validator = spawnSync(process.execPath, [path.join(__dirname, "validate-v2-external-brain-production-evidence.mjs")], { cwd: repoRoot, encoding: "utf8", maxBuffer: 20 * 1024 * 1024 });
let validatorResult = null;
try { validatorResult = JSON.parse(validator.stdout); } catch { issues.push(`production validator output is not JSON: ${validator.stderr || validator.stdout}`); }
if (validator.status !== 0 || !validatorResult?.passed) issues.push("PX-5 production validator did not pass");

const reportPath = path.join(px5Root, "report.json");
const humanPath = path.join(px5Root, "human-review.json");
const report = readJson(reportPath);
const human = readJson(humanPath);
if (report.passed !== false || report.claim !== "V2-PX External Brain Productization acceptance did not pass.") issues.push("final Report was promoted before human review");
if (human.status !== "pending" || human.reviewer || human.reviewedAt) issues.push("Human Review was signed by automation");

const drawioPath = path.join(repoRoot, "docs/active/project/design/v2-memory-personal-knowledge-base-gap.drawio");
const drawio = fs.readFileSync(drawioPath, "utf8");
const pageCount = (drawio.match(/<diagram\b/g) || []).length;
if (pageCount !== 8) issues.push(`Drawio page count ${pageCount} != 8`);
if (!drawio.includes("PX-5 真实 Chrome E2E【已实现 / 自动候选通过】") || !drawio.includes("Human Review 待人类执行")) issues.push("Drawio stage state is stale");

const requiredDocs = [
  "docs/active/project/01-prd.md",
  "docs/active/project/02-architecture.md",
  "docs/active/project/stage-gates/v2-external-brain-productization.md",
  "docs/active/project/design/v2-px-5-development-plan.md",
  "docs/active/project/design/v2-px-5-acceptance-plan.md",
  "docs/active/project/design/v2-px-6-development-plan.md",
  "docs/active/project/design/v2-px-6-acceptance-plan.md",
  "docs/active/project/stage-gates/v2-px-6-preimplementation-audit.md",
  "docs/active/project/evidence/v2_external_brain_productization/px-5/acceptance.md",
  "docs/active/project/evidence/v2_external_brain_productization/px-5/prd-review.md",
  "docs/active/project/evidence/v2_external_brain_productization/px-5/architecture-review.md",
  "docs/active/project/evidence/v2_external_brain_productization/px-5/false-green-audit.md",
  "docs/active/project/evidence/v2_external_brain_productization/px-5/independent-audit.md"
];
for (const item of requiredDocs) if (!fs.existsSync(path.join(repoRoot, item))) issues.push(`missing authority/audit document: ${item}`);

const evidenceIndex = {
  schemaVersion: "v2-px-6-evidence-index/v1",
  generatedAt: new Date().toISOString(),
  status: issues.length ? "blocked" : "waiting_for_human_review",
  px5Validator: validatorResult,
  authorities: requiredDocs.map((item) => ref(path.join(repoRoot, item))),
  machineEvidence: [reportPath, humanPath, drawioPath, path.join(px5Root, "sample-manifest.json"), path.join(px5Root, "architecture-scan-manifest.json"), path.join(px5Root, "automated-gate-results.json"), path.join(px5Root, "acceptance-report.html")].map(ref),
  issues
};
const indexPath = path.join(px6Root, "evidence-index.json");
fs.writeFileSync(indexPath, `${JSON.stringify(evidenceIndex, null, 2)}\n`);

const checklist = `# PX-6 人工产品核查清单

机器状态：${issues.length ? "BLOCKED" : "PASS，等待人工核查"}

- [ ] 从 Side Panel 打开工作台，进入 Source Library。
- [ ] 查看当前来源，确认 Source Detail 的标题、sourceId、breadcrumb 一致。
- [ ] 在 Ask、Graph 等有效上下文点击“在工作台中打开”，确认保留上下文。
- [ ] 核查 Sources / Ask / Trace / Graph / Permission / Forget 的可读性与操作反馈。
- [ ] 核查 360/420 Side Panel 与 768/1280 Workspace 无遮挡、截断和阻塞。
- [ ] 核查 Runtime offline、Adapter blocked、data_service unreachable、source failed 不被合并。
- [ ] 核查 Forget 后 Library / Ask / Graph / Trace 均不返回来源，重开显示 SOURCE_NOT_FOUND。
- [ ] 确认最终声明不扩大为完整外脑、RAG、自动遗忘或 V3。

通过后需在 Human Review v3 中提供真实 reviewer、reviewedAt 和各 Gate evidence；自动化不得代填。
`;
fs.writeFileSync(path.join(px6Root, "human-review-checklist.md"), checklist);

const thumbs = ["sidepanel-360.png", "sidepanel-420.png", "workspace-library-768.png", "workspace-library-1280.png", "workspace-source-detail-1280.png", "workspace-forget-1-1280.png", "workspace-runtime-offline-1280.png"].map((name) => `<figure><img src="../px-5/screenshots/${name}" alt="${name}"><figcaption>${name}</figcaption></figure>`).join("");
fs.writeFileSync(path.join(px6Root, "final-review.html"), `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>V2-PX-6 人工出门审查</title><style>body{margin:0;font:15px system-ui;color:#17211e;background:#f5f7f6}main{max-width:1180px;margin:auto;background:#fff;padding:32px;min-height:100vh}h1{font-size:28px}.gate{border-left:4px solid #b37b00;background:#fff7df;padding:14px}.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.stats div{border:1px solid #cbd6d2;padding:12px}.gallery{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}figure{margin:0;border:1px solid #ccd6d2;padding:8px}img{width:100%;height:auto}table{width:100%;border-collapse:collapse}td,th{border:1px solid #ccd6d2;padding:8px;text-align:left}@media(max-width:700px){.stats,.gallery{grid-template-columns:1fr}}</style><main><h1>V2-PX-6 人工出门审查</h1><p class="gate">机器验收已通过；最终产品报告仍为未通过，等待人类完成下列体验核查并签署。</p><section class="stats"><div><strong>12</strong><br>真实来源</div><div><strong>${report.summary.scenariosTotal}</strong><br>结构场景</div><div><strong>77/77</strong><br>Chrome 断言</div><div><strong>0/0</strong><br>Axe serious/critical</div></section><h2>范围</h2><table><tr><th>已证明</th><td>双容器入口、五路由四恢复、Workspace 管理组件、权限、持久遗忘、四域状态、响应式与可访问性自动检查</td></tr><tr><th>待人工</th><td>可读性、信息层级、操作手感、异常解释、最终声明边界</td></tr><tr><th>未承诺</th><td>真实 data_service、完整外脑、RAG、自动遗忘/Dream Cycle、V3 视频理解</td></tr></table><h2>截图证据</h2><div class="gallery">${thumbs}</div><h2>最小体验路径</h2><ol><li>Side Panel 的 Knowledge 页点击“打开工作台”。</li><li>在来源库进入详情，打开 Trace，再进入 Ask 和 Graph。</li><li>授权并撤销一个测试路径。</li><li>对一次性来源执行 Forget，核对四面验证和重开错误。</li><li>审阅服务离线/阻塞截图和四种 viewport。</li></ol><p>完整机器报告：<a href="../px-5/acceptance-report.html">PX-5 自动化验收候选</a></p></main></html>`);

const result = { passed: issues.length === 0, stage: "V2-PX-6-automated-exit-audit", status: issues.length ? "BLOCKED" : "WAITING_FOR_HUMAN_REVIEW", humanReviewStatus: human.status, finalReportPassed: report.passed, drawioPages: pageCount, evidenceIndex: ref(indexPath), issues };
fs.writeFileSync(path.join(px6Root, "exit-audit.json"), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
if (issues.length) process.exitCode = 2;
