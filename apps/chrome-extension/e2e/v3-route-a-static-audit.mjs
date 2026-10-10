import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");
const appRoot = path.join(repoRoot, "apps/chrome-extension");
const manifestPath = process.env.NAVIA_V3_EXTENSION_MANIFEST || path.join(appRoot, "chrome-mv3-unpacked/manifest.json");
const registryPath = path.join(repoRoot, "docs/active/project/contracts/v3-media-portal-registry.json");
const fixturePath = path.join(repoRoot, "docs/active/project/fixtures/v3-media-companion-contract-fixtures.json");
const outputPath = process.env.NAVIA_V3_ROUTE_A_AUDIT_OUTPUT || "";
const expectedPortalMatch = "https://www.bilibili.com/video/*";
const expectedPortalResourceMatch = "https://www.bilibili.com/*";

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function ensure(condition, message) {
  if (!condition) throw new Error(message);
}

function isGlobalHttpMatch(value) {
  const normalized = String(value).trim().toLowerCase();
  return normalized === "<all_urls>" || normalized === "http://*/*" || normalized === "https://*/*" || normalized === "*://*/*";
}

function writeResult(result) {
  const serialized = `${JSON.stringify(result, null, 2)}\n`;
  if (outputPath) {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, serialized, { mode: 0o600 });
  }
  process.stdout.write(serialized);
}

const manifest = readJson(manifestPath);
const registryBytes = fs.readFileSync(registryPath);
const registry = JSON.parse(registryBytes.toString("utf8"));
const fixtures = readJson(fixturePath);
const backgroundSource = fs.readFileSync(path.join(appRoot, "entrypoints/background/index.ts"), "utf8");
const contentEntrySource = fs.readFileSync(path.join(appRoot, "entrypoints/content/index.ts"), "utf8");
const registrySource = fs.readFileSync(path.join(appRoot, "src/modules/media_companion/MediaPortalRegistry.ts"), "utf8");
const allManifestMatches = [
  ...(manifest.host_permissions || []),
  ...(manifest.optional_host_permissions || []),
  ...(manifest.content_scripts || []).flatMap((entry) => entry.matches || []),
  ...(manifest.web_accessible_resources || []).flatMap((entry) => entry.matches || [])
];
const checks = [];
const check = (id, passed, detail) => {
  checks.push({ id, passed: Boolean(passed), detail });
  ensure(passed, `${id}: ${detail}`);
};

check("V3-1.1-STATIC-01", fs.existsSync(manifestPath), `build manifest exists: ${manifestPath}`);
check("V3-1.1-STATIC-02", allManifestMatches.every((value) => !isGlobalHttpMatch(value)), "0 global/equivalent HTTP(S) match patterns");
check(
  "V3-1.1-STATIC-03",
  JSON.stringify(manifest.host_permissions || []) === JSON.stringify(["http://127.0.0.1:17861/*", "http://localhost:17861/*"]),
  `host_permissions=${JSON.stringify(manifest.host_permissions || [])}`
);
check(
  "V3-1.1-STATIC-04",
  !(manifest.permissions || []).includes("cookies")
    && JSON.stringify(manifest.optional_permissions || []) === JSON.stringify(["cookies"])
    && JSON.stringify(manifest.optional_host_permissions || []) === JSON.stringify(["https://*.bilibili.com/*"]),
  "cookies remains optional and the optional host scope is the frozen Bilibili wildcard"
);
check(
  "V3-1.1-STATIC-05",
  (manifest.content_scripts || []).length === 2
    && (manifest.content_scripts || []).every((entry) => JSON.stringify(entry.matches) === JSON.stringify([expectedPortalMatch]))
    && (manifest.content_scripts || []).filter((entry) => entry.world === "MAIN").length === 1,
  `content script matches=${JSON.stringify((manifest.content_scripts || []).map((entry) => entry.matches))}`
);
check(
  "V3-1.1-STATIC-06",
  (manifest.web_accessible_resources || []).every((entry) => JSON.stringify(entry.matches) === JSON.stringify([expectedPortalResourceMatch])),
  `WAR matches=${JSON.stringify((manifest.web_accessible_resources || []).map((entry) => entry.matches))}`
);
check("V3-1.1-STATIC-07", !backgroundSource.includes("chrome.tabs.onUpdated") && !backgroundSource.includes("chrome.tabs.onActivated"), "0 tab lifecycle implicit injection listeners");
check("V3-1.1-STATIC-08", contentEntrySource.includes(expectedPortalMatch) && contentEntrySource.includes("bridge_only"), "content entry has narrow static match and bridge-only fallback mode");
check("V3-1.1-STATIC-09", registry.registryMode === "build_time_closed_set" && registry.adapters.length === 1 && registry.adapters[0].adapterId === "bilibili", "machine registry is closed and contains only bilibili");
check(
  "V3-1.1-STATIC-10",
  registry.adapters[0].status === "v3_1_1_page_adapter_implemented_candidate"
    && JSON.stringify(registry.adapters[0].capabilities) === JSON.stringify([
      "page_identity",
      "public_transcript_discovery",
      "playback_read",
      "playback_seek"
    ])
    && JSON.stringify(registry.adapters[0].plannedCapabilities) === JSON.stringify(["session_capability"]),
  "registry claims only the V3-1.1 page adapter candidate; session capability remains planned"
);
check("V3-1.1-STATIC-11", registrySource.includes("BilibiliMediaPortalAdapter") && !/Youtube|YouTube|Xiaohongshu|XiaoHongShu/.test(registrySource), "code registry imports only the Bilibili adapter");
const registrySha256 = sha256(registryBytes);
const fixtureRegistryArtifact = fixtures.positiveInstances[0].instance.validation.portalRegistryArtifact;
check("V3-1.1-STATIC-12", fixtureRegistryArtifact.sha256 === registrySha256, `registry raw hash=${registrySha256}`);
check("V3-1.1-STATIC-13", JSON.stringify(fixtureRegistryArtifact.adapterIds) === JSON.stringify(["bilibili"]), "fixture adapterIds match machine registry");

writeResult({
  schemaVersion: "v3-route-a-static-audit/v1",
  generatedAt: new Date().toISOString(),
  passed: checks.every((item) => item.passed),
  manifestPath: path.relative(repoRoot, manifestPath).replaceAll(path.sep, "/"),
  manifestSha256: sha256(fs.readFileSync(manifestPath)),
  portalRegistrySha256: registrySha256,
  checks
});
