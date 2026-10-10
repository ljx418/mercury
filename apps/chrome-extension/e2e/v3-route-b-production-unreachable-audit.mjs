import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const productionFiles = [
  "services/local-runtime/navia_runtime/app.py",
  "services/local-runtime/navia_runtime/modules/media_companion/acquisition/__init__.py",
  "services/local-runtime/navia_runtime/modules/media_companion/acquisition/contracts.py",
  "services/local-runtime/navia_runtime/modules/media_companion/acquisition/coordinator.py",
  "services/local-runtime/navia_runtime/modules/media_companion/acquisition/subtitle_resolver.py",
  "services/local-runtime/navia_runtime/modules/media_companion/acquisition/bilibili/acquirer.py",
  "services/local-runtime/navia_runtime/modules/media_companion/acquisition/downloaders/yt_dlp.py",
  "docs/active/project/contracts/v3-media-portal-registry.json"
];
const forbidden = [
  "acceptanceFaultScenario", "audited_subtitle_failure", "subtitle_body_http_503",
  "subtitle_body_http_403", "subtitle_body_empty", "productionConfigReachable", "V3_MEDIA_FAULT", "FAULT_ENABLED",
  "v3_route_b_sample_registry", "sample_registry import"
];
const hits = [];
for (const relative of productionFiles) {
  const text = fs.readFileSync(path.join(repoRoot, relative), "utf8");
  for (const needle of forbidden) {
    if (text.includes(needle)) hits.push({ relative, needle });
  }
}
const result = {
  schemaVersion: "v3-route-b-production-unreachable-audit/v1",
  scannedFiles: productionFiles.length,
  forbiddenNeedles: forbidden.length,
  hitCount: hits.length,
  hits,
  passed: hits.length === 0
};
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
if (!result.passed) process.exitCode = 2;
