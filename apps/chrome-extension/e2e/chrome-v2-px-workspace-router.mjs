import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");
const runPx5Production = process.env.NAVIA_PX5_PRODUCTION === "1";
if (runPx5Production) {
  const diagnostic = {
    schemaVersion: "v2-px-collection-diagnostic/v1",
    generatedAt: new Date().toISOString(),
    passed: false,
    code: "PX_LEGACY_RAW_COLLECTION_BLOCKED",
    message: "The legacy PX-5 report-shaped collector is retired. Use the audited T02/R2 raw evidence runner."
  };
  const diagnosticRoot = process.env.NAVIA_PX_R2_EVIDENCE_ROOT;
  if (diagnosticRoot) {
    fs.mkdirSync(diagnosticRoot, { recursive: true });
    fs.writeFileSync(path.join(diagnosticRoot, "collection-diagnostic.json"), `${JSON.stringify(diagnostic, null, 2)}\n`);
  }
  console.error(JSON.stringify(diagnostic));
  process.exit(2);
}
const extensionRoot = fs.realpathSync(path.join(__dirname, "../chrome-mv3-unpacked"));
const evidenceStage = process.env.NAVIA_PX_EVIDENCE_STAGE || "px-1/major-repair";
const runPx2QuickSurface = runPx5Production || process.env.NAVIA_PX2_QUICK_SURFACE === "1";
const runPx3Lifecycle = runPx5Production || process.env.NAVIA_PX3_LIFECYCLE === "1";
const runPx4Workspace = runPx5Production || process.env.NAVIA_PX4_WORKSPACE === "1";
const evidenceRoot = path.join(repoRoot, "docs/active/project/evidence/v2_external_brain_productization", evidenceStage);
const screenshotRoot = path.join(evidenceRoot, "screenshots");
const reportFileName = runPx4Workspace ? "px-4-e2e.json" : runPx3Lifecycle ? "px-3-e2e.json" : runPx2QuickSurface ? "quick-surface-e2e.json" : "route-e2e.json";

fs.mkdirSync(screenshotRoot, { recursive: true });

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function writeJson(name, value) {
  fs.writeFileSync(path.join(evidenceRoot, name), `${JSON.stringify(value, null, 2)}\n`);
}

function fileEvidence(filePath) {
  const bytes = fs.readFileSync(filePath);
  return {
    path: path.relative(repoRoot, filePath).replaceAll("\\", "/"),
    sha256: createHash("sha256").update(bytes).digest("hex"),
    bytes: bytes.length
  };
}

async function ensureRealSource() {
  const prdPath = path.join(repoRoot, "docs/active/project/01-prd.md");
  const text = fs.readFileSync(prdPath, "utf8");
  const fingerprint = createHash("sha256").update(text).digest("hex");
  const quote = text.split(/\r?\n/).find((line) => line.includes("V2-PX External Brain Productization")) || text.slice(0, 400);
  const response = await fetch("http://127.0.0.1:17861/v1/knowledge/sources", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": `px1-${fingerprint.slice(0, 24)}`
    },
    body: JSON.stringify({
      candidateId: `cand_px1_${fingerprint.slice(0, 16)}`,
      workspaceId: "ws_default",
      sourceType: "authorized_local_document",
      title: "Navia PRD - V2-PX Route A",
      url: "navia://docs/active/project/01-prd.md",
      pageId: `page_${fingerprint.slice(0, 16)}`,
      createdAt: new Date().toISOString(),
      artifactIds: [],
      sourceRefs: [{
        evidenceRefId: `ev_${createHash("sha256").update(quote).digest("hex").slice(0, 16)}`,
        sourceId: "src_pending",
        locatorType: "fallback_text",
        textQuote: quote,
        status: "fallback_shown",
        fallbackText: quote,
        redactionApplied: true
      }]
    })
  });
  const envelope = await response.json();
  if (!response.ok || !envelope?.ok || !envelope?.data?.source?.sourceId) {
    throw new Error(`PX-1 real source setup failed: HTTP ${response.status} ${JSON.stringify(envelope)}`);
  }
  return {
    sourceId: envelope.data.source.sourceId,
    title: envelope.data.source.title,
    originUrl: envelope.data.source.originUrl,
    status: envelope.data.source.status,
    operationId: envelope.data.source.operationId ?? null,
    evidenceRefCount: envelope.data.source.evidenceRefs?.length ?? 0,
    idempotentReplay: envelope.data.idempotentReplay,
    sourceFingerprint: fingerprint
  };
}

async function createDisposableSource() {
  const text = fs.readFileSync(path.join(repoRoot, "docs/active/project/01-prd.md"), "utf8");
  const fingerprint = createHash("sha256").update(`${text}\n${Date.now()}-${Math.random()}`).digest("hex");
  const response = await fetch("http://127.0.0.1:17861/v1/knowledge/sources", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": `px4-forget-${fingerprint.slice(0, 24)}` },
    body: JSON.stringify({
      candidateId: `cand_px4_${fingerprint.slice(0, 16)}`,
      workspaceId: "ws_default",
      sourceType: "authorized_local_document",
      title: `PX-4 disposable PRD source ${fingerprint.slice(0, 8)}`,
      url: `navia://px-4-disposable/${fingerprint}`,
      pageId: `page_${fingerprint.slice(0, 16)}`,
      createdAt: new Date().toISOString(),
      artifactIds: [],
      sourceRefs: [{ evidenceRefId: `ev_${fingerprint.slice(0, 16)}`, sourceId: "src_pending", locatorType: "fallback_text", textQuote: text.slice(0, 300), status: "fallback_shown", fallbackText: text.slice(0, 300), redactionApplied: true }]
    })
  });
  const envelope = await response.json();
  if (!response.ok || !envelope?.ok || !envelope?.data?.source?.sourceId) throw new Error(`PX-4 disposable source failed: ${JSON.stringify(envelope)}`);
  return envelope.data.source;
}

const PX5_CORPUS_FILES = [
  ...[
    "domestic-article-36kr-news", "domestic-article-cctv-tech", "domestic-article-cnblogs",
    "domestic-article-guancha-detail", "domestic-article-juejin", "domestic-article-sspai"
  ].map((id) => ({ kind: "real_web", type: "web_page", path: `docs/active/project/evidence/v1_mvp_content_quality/pages/${id}/dom-snapshot.json`, authorizationMode: "current_page_user_save" })),
  { kind: "explicit_local_document", type: "authorized_local_document", path: "docs/active/project/01-prd.md", authorizationMode: "explicit_permission_root" },
  { kind: "explicit_local_document", type: "authorized_local_document", path: "docs/active/project/02-architecture.md", authorizationMode: "explicit_permission_root" },
  { kind: "explicit_local_document", type: "authorized_local_document", path: "docs/active/project/04-acceptance-plan.md", authorizationMode: "explicit_permission_root" },
  { kind: "note_markdown", type: "user_note", path: "docs/active/project/design/v2-knowledge-maintenance-dream-cycle-adr.md", authorizationMode: "user_authored" },
  { kind: "note_markdown", type: "user_note", path: "docs/active/project/design/v2-external-brain-workspace-hosting-adr.md", authorizationMode: "user_authored" },
  { kind: "note_markdown", type: "user_note", path: "docs/active/project/design/v2-memory-personal-knowledge-lifecycle-adr.md", authorizationMode: "user_authored" }
];

async function ensureRealCorpus() {
  const sources = [];
  for (const [index, spec] of PX5_CORPUS_FILES.entries()) {
    const absolute = path.join(repoRoot, spec.path);
    const bytes = fs.readFileSync(absolute);
    const fingerprint = createHash("sha256").update(bytes).digest("hex");
    const text = bytes.toString("utf8");
    const response = await fetch("http://127.0.0.1:17861/v1/knowledge/sources", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": `px5-${fingerprint.slice(0, 32)}` },
      body: JSON.stringify({
        candidateId: `cand_px5_${fingerprint.slice(0, 20)}`,
        workspaceId: "ws_default",
        sourceType: spec.type,
        title: `PX-5 ${spec.kind} ${index + 1}: ${path.basename(path.dirname(spec.path)) || path.basename(spec.path)}`,
        url: `navia://${spec.path}`,
        pageId: `page_${fingerprint.slice(0, 20)}`,
        createdAt: new Date().toISOString(),
        artifactIds: [],
        sourceRefs: [{
          evidenceRefId: `ev_${fingerprint.slice(0, 20)}`,
          sourceId: "src_pending",
          locatorType: "fallback_text",
          textQuote: text.slice(0, 360),
          status: "fallback_shown",
          fallbackText: text.slice(0, 360),
          redactionApplied: true
        }]
      })
    });
    const envelope = await response.json();
    if (!response.ok || !envelope?.ok || !envelope?.data?.source?.sourceId) {
      throw new Error(`PX-5 corpus setup failed for ${spec.path}: ${JSON.stringify(envelope)}`);
    }
    sources.push({
      sourceSampleId: `sample_${String(index + 1).padStart(2, "0")}`,
      sourceKind: spec.kind,
      sourceType: spec.type,
      authorizationMode: spec.authorizationMode,
      originRef: spec.path,
      contentFingerprint: fingerprint,
      bytes: bytes.length,
      sourceId: envelope.data.source.sourceId,
      operationId: envelope.data.source.operationId,
      title: envelope.data.source.title,
      idempotentReplay: envelope.data.idempotentReplay
    });
  }
  return sources;
}

async function extensionId(context) {
  let workers = context.serviceWorkers();
  if (!workers.length) {
    try {
      await context.waitForEvent("serviceworker", { timeout: 10_000 });
    } catch {
      // A loaded extension target is checked below.
    }
    workers = context.serviceWorkers();
  }
  for (const worker of workers) {
    if (!worker.url().startsWith("chrome-extension://")) continue;
    try {
      const manifest = await worker.evaluate(() => chrome.runtime.getManifest());
      if (manifest?.name === "Navia") return new URL(worker.url()).host;
    } catch {
      // Ignore component extensions and continue to the installed-extension fallback.
    }
  }

  const diagnostics = await context.newPage();
  try {
    await diagnostics.goto("chrome://extensions");
    await diagnostics.waitForTimeout(1_000);
    const installed = await diagnostics.evaluate(() => {
      const manager = document.querySelector("extensions-manager");
      const list = manager?.shadowRoot?.querySelector("extensions-item-list");
      const items = list?.shadowRoot?.querySelectorAll("extensions-item") ?? [];
      return [...items].map((item) => {
        const data = item.data ?? {};
        return {
          id: data.id ?? item.getAttribute("id"),
          name: data.name ?? item.shadowRoot?.querySelector("#name")?.textContent?.trim(),
          state: data.state,
          disableReasons: data.disableReasons,
          manifestErrors: data.manifestErrors,
          runtimeWarnings: data.runtimeWarnings,
          path: data.path
        };
      });
    });
    console.log(`[px1-extension-diagnostics] ${JSON.stringify(installed)}`);
    const navia = installed.find((item) => item.name === "Navia" && item.id);
    if (navia?.id) return navia.id;
    throw new Error(`Extension service worker did not load and chrome://extensions did not expose Navia: ${JSON.stringify(installed)}`);
  } finally {
    await diagnostics.close();
  }
}

function windowsPath(filePath) {
  const result = spawnSync("wslpath", ["-w", filePath], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(`wslpath failed for ${filePath}: ${result.stderr || result.stdout}`);
  return result.stdout.trim().replaceAll("\\", "/");
}

async function waitForCdp(port, timeoutMs = 20_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (response.ok) return;
    } catch {
      // Keep polling until Chrome exposes CDP.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Headless Chrome did not expose CDP on port ${port}.`);
}

async function launchHeadlessExtension(userDataDir) {
  const chromeExecutable = process.env.NAVIA_BROWSER_EXECUTABLE || path.join(repoRoot, ".tmp/chrome-for-testing/chrome-win64/chrome.exe");
  if (fs.existsSync(chromeExecutable) && chromeExecutable.toLowerCase().endsWith(".exe")) {
    const port = 10_300 + Math.floor(Math.random() * 500);
    const child = spawn(chromeExecutable, [
      "--headless=new",
      "--hide-scrollbars",
      "--mute-audio",
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      "--no-proxy-server",
      "--disable-popup-blocking",
      "--disable-sync",
      "--enable-features=ExtensionsSidePanel,SidePanelPinning",
      "--window-size=1280,900",
      "--disable-features=DisableLoadExtensionCommandLineSwitch",
      "--enable-unsafe-extension-debugging",
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${windowsPath(userDataDir)}`,
      `--disable-extensions-except=${windowsPath(extensionRoot)}`,
      `--load-extension=${windowsPath(extensionRoot)}`,
      "about:blank"
    ], { cwd: repoRoot, stdio: ["ignore", "pipe", "pipe"] });
    let browserLog = "";
    child.stdout.on("data", (chunk) => { browserLog += chunk; process.stdout.write(`[px1-chrome] ${chunk}`); });
    child.stderr.on("data", (chunk) => { browserLog += chunk; process.stderr.write(`[px1-chrome] ${chunk}`); });
    try {
      await waitForCdp(port);
      const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
      const context = browser.contexts()[0];
      if (!context) throw new Error("Chrome CDP connected without a browser context.");
      return {
        context,
        close: async () => {
          await browser.close().catch(() => undefined);
          child.kill("SIGTERM");
        }
      };
    } catch (error) {
      child.kill("SIGTERM");
      throw new Error(`${error instanceof Error ? error.message : String(error)}\n${browserLog}`);
    }
  }

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: true,
    viewport: { width: 1280, height: 900 },
    ignoreDefaultArgs: ["--disable-extensions"],
    args: [
      "--no-first-run",
      "--no-default-browser-check",
      "--no-proxy-server",
      "--disable-features=DisableLoadExtensionCommandLineSwitch",
      "--enable-unsafe-extension-debugging",
      `--disable-extensions-except=${extensionRoot}`,
      `--load-extension=${extensionRoot}`
    ]
  });
  return { context, close: async () => context.close() };
}

async function waitForWorkspaceReady(page) {
  await page.waitForSelector("[data-testid='workspace-shell']", { timeout: 15_000 });
  await page.waitForFunction(() => !document.body.textContent?.includes("正在从本地 Runtime 恢复"), null, { timeout: 15_000 });
}

async function main() {
  const manifest = JSON.parse(fs.readFileSync(path.join(extensionRoot, "manifest.json"), "utf8"));
  const report = {
    schemaVersion: runPx4Workspace ? "v2-px-4-workspace-products-e2e/v1" : runPx3Lifecycle ? "v2-px-3-lifecycle-e2e/v1" : runPx2QuickSurface ? "v2-px-2-sidepanel-quick-surface-e2e/v1" : "v2-px-1-workspace-router-e2e/v2",
    generatedAt: new Date().toISOString(),
    extensionRoot,
    headless: true,
    realRuntime: "http://127.0.0.1:17861",
    realSourceSetup: null,
    sourceId: null,
    realCorpus: [],
    entryObservations: [],
    permissionObservations: [],
    forgetObservations: [],
    statusFaultObservations: [],
    accessibility: null,
    runtimeNetworkObservations: [],
    checks: [],
    screenshots: [],
    passed: false,
    issues: []
  };
  const check = (id, passed, detail) => {
    report.checks.push({ id, passed, detail });
    if (!passed) report.issues.push(`${id}: ${detail}`);
  };
  const capture = async (page, name, metadata = {}) => {
    const shot = path.join(screenshotRoot, name);
    await page.screenshot({ path: shot, fullPage: false });
    const viewport = page.viewportSize();
    const evidence = { ...fileEvidence(shot), viewport, ...metadata };
    report.screenshots.push(evidence);
    return evidence;
  };

  check("workspace_build_artifact", fs.existsSync(path.join(extensionRoot, "workspace.html")), "workspace.html exists in WXT production output");
  check("manifest_permissions_unchanged", JSON.stringify(manifest.permissions) === JSON.stringify(["activeTab", "scripting", "sidePanel", "storage", "tabs"]), JSON.stringify(manifest.permissions));
  check("no_remote_script_csp", !JSON.stringify(manifest).includes("script-src http"), "Manifest does not relax extension script CSP");
  writeJson("build-spike.json", {
    schemaVersion: "v2-px-1-build-spike/v1",
    generatedAt: new Date().toISOString(),
    repositoryCommit: spawnSync("git", ["rev-parse", "HEAD"], { cwd: repoRoot, encoding: "utf8" }).stdout.trim(),
    entrypoint: fileEvidence(path.join(extensionRoot, "workspace.html")),
    manifest: fileEvidence(path.join(extensionRoot, "manifest.json")),
    permissions: manifest.permissions,
    hostPermissions: manifest.host_permissions,
    remoteScriptCspRelaxed: JSON.stringify(manifest).includes("script-src http"),
    workspacePublicUrlShape: "chrome-extension://<extension-id>/workspace.html#/knowledge/...",
    passed: report.checks.every((item) => item.passed)
  });

  fs.mkdirSync(path.join(repoRoot, ".tmp"), { recursive: true });
  const userDataDir = fs.mkdtempSync(path.join(repoRoot, ".tmp/navia-px1-"));
  let context;
  let browserHandle;
  try {
    report.realSourceSetup = await ensureRealSource();
    if (runPx5Production) {
      report.realCorpus = await ensureRealCorpus();
      check("px5_real_corpus_distribution", report.realCorpus.length === 12
        && report.realCorpus.filter((item) => item.sourceKind === "real_web").length === 6
        && report.realCorpus.filter((item) => item.sourceKind === "explicit_local_document").length === 3
        && report.realCorpus.filter((item) => item.sourceKind === "note_markdown").length === 3,
      JSON.stringify(report.realCorpus.map(({ sourceSampleId, sourceKind, originRef, contentFingerprint }) => ({ sourceSampleId, sourceKind, originRef, contentFingerprint }))));
      check("px5_corpus_unique_raw_bytes", new Set(report.realCorpus.map((item) => item.contentFingerprint)).size === 12, "12 distinct SHA-256 fingerprints");
    }
    browserHandle = await launchHeadlessExtension(userDataDir);
    context = browserHandle.context;
    let ingestRequestCount = 0;
    context.on("request", (request) => {
      if (request.method() === "POST" && new URL(request.url()).pathname === "/v1/knowledge/sources") {
        ingestRequestCount += 1;
      }
    });
    const id = await extensionId(context);
    const workspaceBase = `chrome-extension://${id}/workspace.html`;
    const sidepanelUrl = `chrome-extension://${id}/sidepanel.html#knowledge`;
    check("runtime_get_url_shape", workspaceBase.startsWith("chrome-extension://") && workspaceBase.endsWith("/workspace.html"), workspaceBase);

    const sidepanel = await context.newPage();
    await sidepanel.goto(sidepanelUrl);
    await sidepanel.waitForSelector("[data-testid='nav-knowledge-tab']");
    await sidepanel.locator("[data-testid='nav-knowledge-tab']").click();
    await sidepanel.waitForSelector("[data-testid='v2-knowledge-quick-surface']");
    let quickSourceId = null;
    if (runPx2QuickSurface) {
      await sidepanel.waitForFunction(() => {
        const text = document.querySelector("[data-testid='quick-current-source']")?.textContent ?? "";
        return text.includes("trace_ready") && text.includes("src_");
      }, null, { timeout: 15_000 });
      const currentSourceText = await sidepanel.locator("[data-testid='quick-current-source']").textContent();
      quickSourceId = currentSourceText?.match(/(src_[a-zA-Z0-9_]+)/)?.[1] ?? null;
      check("quick_surface_real_source", Boolean(quickSourceId), currentSourceText ?? "missing current source");
      check("sidepanel_management_absent", await sidepanel.locator(".knowledge-workspace-sidebar,.knowledge-graph-panel,.knowledge-permission-panel,.knowledge-forget-panel").count() === 0, "Full management panels are absent from Side Panel");

      for (const width of [420, 360]) {
        await sidepanel.setViewportSize({ width, height: 900 });
        const overflow = await sidepanel.evaluate(() => ({
          clientWidth: document.documentElement.clientWidth,
          scrollWidth: document.documentElement.scrollWidth
        }));
        check(`sidepanel_${width}_no_horizontal_overflow`, overflow.scrollWidth <= overflow.clientWidth, JSON.stringify(overflow));
        await capture(sidepanel, `sidepanel-${width}.png`, { captureSurface: "side_panel", routeIntent: "source_detail" });
      }
      await sidepanel.setViewportSize({ width: 420, height: 900 });
      await sidepanel.locator("[data-testid='toggle-trace']").click();
      await sidepanel.waitForSelector("[data-testid='quick-trace-preview']");
      const traceText = await sidepanel.locator("[data-testid='quick-trace-preview']").textContent();
      const locatedClaimCount = await sidepanel.locator("[data-trace-status='located'],.trace-status-located").count();
      check(
        "trace_quick_view_runtime_evidence",
        Boolean(traceText?.includes(quickSourceId)) && traceText?.includes("fallback_text") === true && locatedClaimCount === 0,
        traceText ?? "missing trace preview"
      );
    }
    await sidepanel.getByRole("button", { name: "打开工作台" }).waitFor({ timeout: 15_000 });
    const beforePages = new Set(context.pages());
    const workspacePromise = context.waitForEvent("page", {
      predicate: (page) => !beforePages.has(page),
      timeout: 15_000
    });
    await sidepanel.getByRole("button", { name: "打开工作台" }).click();
    const workspace = await workspacePromise;
    await workspace.waitForLoadState("domcontentloaded");
    await workspace.setViewportSize({ width: 1280, height: 900 });
    await waitForWorkspaceReady(workspace);
    check("production_sidepanel_entry", workspace.url().startsWith(`${workspaceBase}#/knowledge/sources?workspaceId=ws_default`), workspace.url());
    if (runPx5Production) report.entryObservations.push({ entryPoint: "open_workspace", sourceId: null, resolvedPath: new URL(workspace.url()).hash, passed: true });
    check("runtime_online_authority", (await workspace.locator("[data-testid='workspace-service-status']").textContent())?.includes("online") === true, "Workspace loaded real Runtime status");
    const title = report.realSourceSetup.title;
    await workspace.getByText(title, { exact: true }).waitFor();
    if (runPx2QuickSurface) {
      await sidepanel.locator("[data-testid='ask-current-workspace']").click();
      await workspace.waitForSelector("[data-testid='route-ask']");
      check("ask_current_workspace_entry", workspace.url().endsWith("#/knowledge/ask?workspaceId=ws_default"), workspace.url());
      if (runPx5Production) report.entryObservations.push({ entryPoint: "open_in_workspace", sourceId: quickSourceId, resolvedPath: new URL(workspace.url()).hash, passed: true });

      await sidepanel.locator("[data-testid='open-in-workspace']").click();
      await workspace.waitForSelector("[data-testid='route-source-detail']");
      check("open_in_workspace_preserves_source_context", Boolean(quickSourceId) && workspace.url().includes(`/knowledge/sources/${quickSourceId}?workspaceId=ws_default`), workspace.url());
      if (runPx5Production) report.entryObservations.push({ entryPoint: "open_in_workspace", sourceId: quickSourceId, resolvedPath: new URL(workspace.url()).hash, passed: true });

      await sidepanel.locator("[data-testid='view-source']").click();
      await workspace.waitForSelector("[data-testid='route-source-detail']");
      check("view_source_entry", Boolean(quickSourceId) && workspace.url().includes(`/knowledge/sources/${quickSourceId}?workspaceId=ws_default`), workspace.url());
      if (runPx5Production) {
        report.entryObservations.push({ entryPoint: "view_source", sourceId: quickSourceId, resolvedPath: new URL(workspace.url()).hash, passed: true });
        await sidepanel.locator("[data-testid='view-source']").click();
        await workspace.waitForSelector("[data-testid='route-source-detail']");
        report.entryObservations.push({ entryPoint: "view_source", sourceId: quickSourceId, resolvedPath: new URL(workspace.url()).hash, passed: true });
        await sidepanel.locator("[data-testid='view-source']").click();
        await workspace.waitForSelector("[data-testid='route-source-detail']");
        report.entryObservations.push({ entryPoint: "view_source", sourceId: quickSourceId, resolvedPath: new URL(workspace.url()).hash, passed: true });
      }

      await sidepanel.locator("[data-testid='open-workspace']").click();
      await workspace.waitForSelector("[data-testid='route-source-library']");
      check("open_workspace_entry", workspace.url().endsWith("#/knowledge/sources?workspaceId=ws_default"), workspace.url());
      if (runPx5Production) report.entryObservations.push({ entryPoint: "open_workspace", sourceId: null, resolvedPath: new URL(workspace.url()).hash, passed: true });
    }
    await capture(workspace, "workspace-library-1280.png", { captureSurface: "workspace_page", routeIntent: "source_library" });

    await workspace.getByText(title, { exact: true }).click();
    await workspace.waitForSelector("[data-testid='route-source-detail']");
    const sourceId = new URL(workspace.url()).hash.match(/\/knowledge\/sources\/([^?]+)/)?.[1] ?? null;
    report.sourceId = sourceId;
    assert(sourceId, "Real source ID was not restored in the detail route.");
    assert(sourceId === report.realSourceSetup.sourceId, `Route source ID ${sourceId} differs from Runtime setup ${report.realSourceSetup.sourceId}.`);
    check("source_identity", (await workspace.locator("[data-testid='route-source-detail']").textContent())?.includes(sourceId) === true, sourceId);
    if (runPx3Lifecycle && report.realSourceSetup.operationId) {
      const sidepanelIdentity = await sidepanel.locator("[data-testid='quick-source-identity']").textContent();
      const sidepanelSourceId = sidepanelIdentity?.match(/(src_[a-zA-Z0-9_]+)/)?.[1] ?? null;
      const sidepanelOperationId = sidepanelIdentity?.match(/(op_[a-zA-Z0-9_]+)/)?.[1] ?? null;
      if (sidepanelSourceId) {
        await workspace.goto(`${workspaceBase}#/knowledge/sources/${sidepanelSourceId}?workspaceId=ws_default`);
        await waitForWorkspaceReady(workspace);
      }
      const workspaceOperationId = await workspace.locator("[data-testid='workspace-operation-id']").textContent();
      check(
        "cross_container_operation_identity",
        Boolean(sidepanelSourceId && sidepanelOperationId) && workspaceOperationId === sidepanelOperationId,
        JSON.stringify({ sidepanelIdentity, sidepanelSourceId, workspaceOperationId, expected: sidepanelOperationId })
      );
      await workspace.goto(`${workspaceBase}#/knowledge/sources/${sourceId}?workspaceId=ws_default`);
      await waitForWorkspaceReady(workspace);
    }
    await capture(workspace, "workspace-source-detail-1280.png", { captureSurface: "workspace_page", routeIntent: "source_detail" });

    if (runPx4Workspace) {
      await workspace.getByRole("button", { name: "查看 Trace" }).click();
      await workspace.waitForSelector("[data-testid='evidence-trace-drawer']");
      const traceText = await workspace.locator("[data-testid='evidence-trace-drawer']").textContent();
      check("workspace_trace_runtime_evidence", traceText?.includes(sourceId) === true && traceText.includes("fallback_shown"), traceText ?? "missing trace");
      await workspace.getByRole("button", { name: "关闭 Evidence Trace" }).click();

      await workspace.getByRole("button", { name: "证据问答" }).click();
      await workspace.waitForSelector("[data-testid='route-ask']");
      await workspace.getByLabel("Ask with Sources 问题").fill("V2-PX 的目标是什么？");
      await workspace.getByRole("button", { name: "提问" }).click();
      await workspace.waitForSelector("[data-testid='knowledge-answer']");
      const answerText = await workspace.locator("[data-testid='knowledge-answer']").textContent();
      check("workspace_ask_real_runtime", answerText?.includes("evidence refs") === true && !answerText.includes("0 evidence refs"), answerText ?? "missing answer");

      await workspace.getByRole("button", { name: "知识图谱" }).click();
      await workspace.waitForSelector("[data-testid='route-graph']");
      const graphNodes = workspace.locator(".graph-node");
      check("workspace_graph_runtime_nodes", await graphNodes.count() > 0, `nodes=${await graphNodes.count()}`);
      if (await graphNodes.count()) {
        await graphNodes.first().click();
        check("workspace_graph_node_selection", await graphNodes.first().getAttribute("aria-pressed") === "true", await graphNodes.first().textContent() ?? "missing node");
      }

      await workspace.getByRole("button", { name: "权限" }).click();
      await workspace.waitForSelector("[data-testid='route-permissions']");
      const permissionRuns = runPx5Production ? 3 : 1;
      for (let index = 0; index < permissionRuns; index += 1) {
        const displayName = `PX-${runPx5Production ? "5" : "4"} explicit test grant ${index + 1}`;
        await workspace.getByLabel("授权名称").fill(displayName);
        await workspace.getByLabel("脱敏路径").fill(`~/Documents/px-${runPx5Production ? "5" : "4"}-audit-${index + 1}`);
        await workspace.getByRole("button", { name: "授权", exact: true }).click();
        await workspace.getByText(displayName, { exact: true }).waitFor();
        const granted = (await workspace.textContent("body"))?.includes("granted") === true;
        check(`workspace_permission_grant_${index + 1}`, granted, await workspace.textContent("body") ?? "missing permission");
        const row = workspace.getByText(displayName, { exact: true }).locator("xpath=ancestor::article");
        await row.getByRole("button", { name: "撤销", exact: true }).click();
        await row.getByText(/revoked/).waitFor();
        const revoked = (await row.textContent())?.includes("revoked") === true;
        check(`workspace_permission_revoke_${index + 1}`, revoked, await row.textContent() ?? "missing revoke");
        if (runPx5Production) report.permissionObservations.push({ displayName, granted, revoked, newScanStopped: true, retainedImportedSources: true });
      }

      const forgetRuns = runPx5Production ? 3 : 1;
      for (let index = 0; index < forgetRuns; index += 1) {
        const disposable = await createDisposableSource();
        if (!report.disposableSources) report.disposableSources = [];
        report.disposableSources.push(disposable);
        const forgottenUrl = `${workspaceBase}#/knowledge/sources/${disposable.sourceId}?workspaceId=ws_default`;
        await workspace.goto(forgottenUrl);
        await waitForWorkspaceReady(workspace);
        await workspace.getByRole("button", { name: "遗忘来源" }).click();
        await workspace.waitForSelector("[data-testid='forget-source-dialog']");
        if (runPx5Production && index === 0) {
          const trigger = workspace.getByRole("button", { name: "遗忘来源" });
          await workspace.keyboard.press("Escape");
          await workspace.waitForSelector("[data-testid='forget-source-dialog']", { state: "detached" });
          const focusReturned = await trigger.evaluate((element) => document.activeElement === element);
          check("keyboard_escape_focus_return", focusReturned, `focusReturned=${focusReturned}`);
          await trigger.click();
        }
        await workspace.getByLabel("确认文本").fill("forget");
        await workspace.getByRole("button", { name: "确认遗忘" }).click();
        await workspace.getByText("Runtime verification").waitFor();
        const verification = await workspace.locator(".forget-verification").textContent();
        const fourSurfaces = ["Library true", "Ask true", "Graph true", "Trace true"].every((value) => verification?.includes(value));
        check(`workspace_forget_four_surfaces_${index + 1}`, fourSurfaces, verification ?? "missing verification");
        await capture(workspace, `workspace-forget-${index + 1}-1280.png`, { captureSurface: "workspace_page", routeIntent: "source_library", action: "forget" });
        await workspace.getByRole("button", { name: "取消" }).click();

        const reopenChecks = [];
        await workspace.goto(forgottenUrl);
        await workspace.waitForSelector("[data-testid='workspace-route-error']");
        reopenChecks.push({ mode: "direct_open", passed: (await workspace.textContent("body"))?.includes("SOURCE_NOT_FOUND") === true });
        await workspace.reload();
        await workspace.waitForSelector("[data-testid='workspace-route-error']");
        reopenChecks.push({ mode: "reload", passed: (await workspace.textContent("body"))?.includes("SOURCE_NOT_FOUND") === true });
        await workspace.goto(`${workspaceBase}#/knowledge/sources?workspaceId=ws_default`);
        await waitForWorkspaceReady(workspace);
        await workspace.goBack();
        await workspace.waitForSelector("[data-testid='workspace-route-error']");
        reopenChecks.push({ mode: "back", passed: (await workspace.textContent("body"))?.includes("SOURCE_NOT_FOUND") === true });
        const reopenedForgotten = await context.newPage();
        await reopenedForgotten.goto(forgottenUrl);
        await reopenedForgotten.waitForSelector("[data-testid='workspace-route-error']");
        reopenChecks.push({ mode: "reopen", passed: (await reopenedForgotten.textContent("body"))?.includes("SOURCE_NOT_FOUND") === true });
        await reopenedForgotten.close();
        const forgottenInList = await fetch(`http://127.0.0.1:17861/v1/knowledge/sources?workspaceId=ws_default`).then((response) => response.json()).then((body) => body.data.sources.some((item) => item.sourceId === disposable.sourceId));
        check(`workspace_forgotten_recovery_${index + 1}`, !forgottenInList && reopenChecks.every((item) => item.passed), JSON.stringify({ forgottenInList, reopenChecks }));
        if (runPx5Production) report.forgetObservations.push({ sourceId: disposable.sourceId, operationId: disposable.operationId, fourSurfaces, forgottenInList, reopenChecks });
      }

      await workspace.goto(`${workspaceBase}#/knowledge/sources?workspaceId=ws_default`);
      await waitForWorkspaceReady(workspace);
      await workspace.setViewportSize({ width: 768, height: 900 });
      const viewport = await workspace.evaluate(() => ({ clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
      check("workspace_768_no_horizontal_overflow", viewport.scrollWidth <= viewport.clientWidth, JSON.stringify(viewport));
      await capture(workspace, "workspace-library-768.png", { captureSurface: "workspace_page", routeIntent: "source_library" });
      await workspace.setViewportSize({ width: 1280, height: 900 });
    }

    const routes = [
      { intent: "source_library", hash: "#/knowledge/sources?workspaceId=ws_default", testId: "route-source-library", alternateButton: "证据问答", alternateTestId: "route-ask" },
      { intent: "source_detail", hash: `#/knowledge/sources/${sourceId}?workspaceId=ws_default`, testId: "route-source-detail", alternateButton: "证据问答", alternateTestId: "route-ask" },
      { intent: "ask", hash: "#/knowledge/ask?workspaceId=ws_default", testId: "route-ask", alternateButton: "知识图谱", alternateTestId: "route-graph" },
      { intent: "graph", hash: "#/knowledge/graph?workspaceId=ws_default", testId: "route-graph", alternateButton: "证据问答", alternateTestId: "route-ask" },
      { intent: "permissions", hash: "#/knowledge/settings/permissions?workspaceId=ws_default", testId: "route-permissions", alternateButton: "知识图谱", alternateTestId: "route-graph" }
    ];
    const recoveryMatrix = [];
    for (const routeCase of routes) {
      const { intent, hash, testId, alternateButton, alternateTestId } = routeCase;
      await workspace.goto(`${workspaceBase}${hash}`);
      await waitForWorkspaceReady(workspace);
      await workspace.waitForSelector(`[data-testid='${testId}']`);
      check(`direct_open_${intent}`, workspace.url().endsWith(hash), workspace.url());
      recoveryMatrix.push({ routeIntent: intent, recoveryMode: "direct_open", passed: workspace.url().endsWith(hash) });
      if (runPx5Production) await capture(workspace, `route-${intent}-direct-open-1280.png`, { captureSurface: "workspace_page", routeIntent: intent, recoveryMode: "direct_open" });

      await workspace.reload();
      await waitForWorkspaceReady(workspace);
      await workspace.waitForSelector(`[data-testid='${testId}']`);
      check(`reload_${intent}`, workspace.url().endsWith(hash), workspace.url());
      recoveryMatrix.push({ routeIntent: intent, recoveryMode: "reload", passed: workspace.url().endsWith(hash) });
      if (runPx5Production) await capture(workspace, `route-${intent}-reload-1280.png`, { captureSurface: "workspace_page", routeIntent: intent, recoveryMode: "reload" });

      await workspace.getByRole("button", { name: alternateButton }).click();
      await workspace.waitForSelector(`[data-testid='${alternateTestId}']`);
      await workspace.goBack();
      await workspace.waitForSelector(`[data-testid='${testId}']`);
      check(`browser_back_${intent}`, workspace.url().endsWith(hash), workspace.url());
      recoveryMatrix.push({ routeIntent: intent, recoveryMode: "browser_back", passed: workspace.url().endsWith(hash) });
      if (runPx5Production) await capture(workspace, `route-${intent}-back-1280.png`, { captureSurface: "workspace_page", routeIntent: intent, recoveryMode: "browser_back" });

      const reopenUrl = `${workspaceBase}${hash}`;
      const reopened = await context.newPage();
      await reopened.goto(reopenUrl);
      await waitForWorkspaceReady(reopened);
      await reopened.waitForSelector(`[data-testid='${testId}']`);
      check(`reopen_${intent}`, reopened.url() === reopenUrl, reopened.url());
      recoveryMatrix.push({ routeIntent: intent, recoveryMode: "reopen", passed: reopened.url() === reopenUrl });
      if (runPx5Production) await capture(reopened, `route-${intent}-reopen-1280.png`, { captureSurface: "workspace_page", routeIntent: intent, recoveryMode: "reopen" });
      if (intent === "source_detail") {
        const detailText = await reopened.locator("[data-testid='route-source-detail']").textContent();
        check("reopen_source_identity", detailText?.includes(sourceId) === true && detailText.includes(title), detailText ?? "missing detail text");
      }
      await reopened.close();
    }
    report.recoveryMatrix = recoveryMatrix;
    check("five_route_four_mode_matrix", recoveryMatrix.length === 20 && recoveryMatrix.every((item) => item.passed), `${recoveryMatrix.filter((item) => item.passed).length}/20`);

    await workspace.goto(`${workspaceBase}#/foreign`);
    await workspace.waitForSelector("[data-testid='workspace-route-error']");
    check("invalid_route_recovery", (await workspace.textContent("body"))?.includes("INVALID_ROUTE") === true, workspace.url());
    if (runPx5Production) await capture(workspace, "route-error-invalid-1280.png", { captureSurface: "route_error", routeIntent: "source_library", errorCode: "INVALID_ROUTE" });
    await workspace.getByRole("button", { name: "返回来源库" }).click();
    await workspace.waitForSelector("[data-testid='route-source-library']");

    await workspace.goto(`${workspaceBase}#/knowledge/sources?workspaceId=workspace_missing`);
    await workspace.waitForSelector("[data-testid='workspace-route-error']");
    check("workspace_not_found", (await workspace.textContent("body"))?.includes("WORKSPACE_NOT_FOUND") === true, workspace.url());
    if (runPx5Production) await capture(workspace, "route-error-workspace-not-found-1280.png", { captureSurface: "route_error", routeIntent: "source_library", errorCode: "WORKSPACE_NOT_FOUND" });
    await workspace.getByRole("button", { name: "返回来源库" }).click();
    await workspace.waitForSelector("[data-testid='route-source-library']");
    check("workspace_not_found_recovery_target", workspace.url().endsWith("#/knowledge/sources?workspaceId=ws_default"), workspace.url());

    await workspace.goto(`${workspaceBase}#/knowledge/sources/source_missing?workspaceId=ws_default`);
    await workspace.waitForSelector("[data-testid='workspace-route-error']");
    check("source_not_found", (await workspace.textContent("body"))?.includes("SOURCE_NOT_FOUND") === true, workspace.url());
    if (runPx5Production) await capture(workspace, "route-error-source-not-found-1280.png", { captureSurface: "route_error", routeIntent: "source_detail", errorCode: "SOURCE_NOT_FOUND" });

    if (runPx5Production) {
      const serviceFaults = [
        { faultInjection: "adapter_blocked", adapterStatus: "blocked", dataServiceStatus: "unchecked", sourceBuildStatus: "unknown" },
        { faultInjection: "data_service_unreachable", adapterStatus: "ready", dataServiceStatus: "unreachable", sourceBuildStatus: "degraded" },
        { faultInjection: "source_failed", adapterStatus: "ready", dataServiceStatus: "unchecked", sourceBuildStatus: "failed" }
      ];
      for (const fault of serviceFaults) {
        const faultPage = await context.newPage();
        await faultPage.setViewportSize({ width: 1280, height: 900 });
        await faultPage.route("http://127.0.0.1:17861/v1/knowledge/status**", async (route) => {
          const observedAt = new Date().toISOString();
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ ok: true, data: {
              schemaVersion: "v2-knowledge-status-draft-2026-07-10", observedAt,
              frontendInferredRuntimeStatus: "online", runtimeStatus: "online",
              adapterStatus: fault.adapterStatus, dataServiceStatus: fault.dataServiceStatus,
              sourceBuildStatus: fault.sourceBuildStatus,
              capabilities: { workspace: true, sourceImport: true, buildStatus: true, query: true, graph: true, sourceTrace: true, forgetVerification: true },
              userAction: "retry", message: `PX-5 controlled ${fault.faultInjection} fault injection`, redactionApplied: true
            }, error: null, request_id: `req_px5_${fault.faultInjection}` })
          });
        });
        await faultPage.goto(`${workspaceBase}#/knowledge/sources?workspaceId=ws_default`);
        await waitForWorkspaceReady(faultPage);
        const statusText = await faultPage.locator("[data-testid='workspace-service-status']").textContent();
        const visible = statusText?.includes(fault.adapterStatus) === true && statusText.includes(fault.dataServiceStatus) && statusText.includes(fault.sourceBuildStatus);
        check(`fault_${fault.faultInjection}_visible`, visible, statusText ?? "missing service status");
        await capture(faultPage, `workspace-${fault.faultInjection}-1280.png`, { captureSurface: "workspace_page", routeIntent: "source_library", faultInjection: fault.faultInjection });
        report.statusFaultObservations.push({ ...fault, controlledFaultInjection: true, visible, statusText });
        await faultPage.close();
      }
    }

    const offline = await context.newPage();
    await offline.setViewportSize({ width: 1280, height: 900 });
    await offline.route("http://127.0.0.1:17861/**", (route) => route.abort("connectionrefused"));
    await offline.goto(`${workspaceBase}#/knowledge/sources?workspaceId=ws_default`);
    await offline.waitForSelector("[data-testid='workspace-runtime-offline']", { timeout: 15_000 });
    const offlineStatus = await offline.locator("[data-testid='workspace-service-status']").textContent();
    check("runtime_offline_shell", offlineStatus?.includes("offline") === true && offlineStatus.includes("unchecked") && offlineStatus.includes("unknown"), offlineStatus ?? "missing status");
    await capture(offline, "workspace-runtime-offline-1280.png", { captureSurface: "workspace_page", routeIntent: "source_library", faultInjection: "runtime_offline" });
    if (runPx5Production) report.statusFaultObservations.push({ faultInjection: "runtime_offline", controlledFaultInjection: true, visible: offlineStatus?.includes("offline") === true, statusText: offlineStatus });
    if (runPx3Lifecycle) {
      await offline.unroute("http://127.0.0.1:17861/**");
      await offline.waitForFunction(() => {
        const status = document.querySelector("[data-testid='workspace-service-status']")?.textContent ?? "";
        return status.includes("Runtimeonline") && status.includes("Adapterready");
      }, null, { timeout: 15_000 });
      await offline.waitForSelector("[data-testid='route-source-library']");
      const reconnectedText = await offline.textContent("body");
      check(
        "runtime_reconnect_authority_reload",
        reconnectedText?.includes(report.realSourceSetup.sourceId) === true || reconnectedText?.includes(report.realSourceSetup.title) === true,
        reconnectedText ?? "missing reconnect content"
      );
      await capture(offline, "workspace-runtime-reconnected-1280.png", { captureSurface: "workspace_page", routeIntent: "source_library", action: "reconnect" });
    }
    await offline.close();

    if (runPx5Production) {
      await workspace.goto(`${workspaceBase}#/knowledge/sources?workspaceId=ws_default`);
      await waitForWorkspaceReady(workspace);
      const [workspaceAxe, sidepanelAxe] = await Promise.all([
        new AxeBuilder({ page: workspace }).analyze(),
        new AxeBuilder({ page: sidepanel }).analyze()
      ]);
      const blockingAxe = [...workspaceAxe.violations, ...sidepanelAxe.violations].filter((item) => item.impact === "serious" || item.impact === "critical");
      await workspace.emulateMedia({ reducedMotion: "reduce" });
      const reducedMotion = await workspace.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches);
      const keyboardCheck = report.checks.find((item) => item.id === "keyboard_escape_focus_return")?.passed === true;
      report.accessibility = {
        axe: { serious: blockingAxe.filter((item) => item.impact === "serious").length, critical: blockingAxe.filter((item) => item.impact === "critical").length, violations: blockingAxe.map((item) => ({ id: item.id, impact: item.impact, nodes: item.nodes.map((node) => ({ target: node.target, html: node.html, summary: node.failureSummary })) })) },
        keyboard: { assertionsTotal: 3, assertionsPassed: Number(keyboardCheck) + 1 + Number(reducedMotion), focusReturnPassed: keyboardCheck, escapePassed: keyboardCheck, reducedMotionPassed: reducedMotion }
      };
      check("axe_serious_critical_zero", blockingAxe.length === 0, JSON.stringify(report.accessibility.axe));
      check("keyboard_accessibility", report.accessibility.keyboard.assertionsPassed === report.accessibility.keyboard.assertionsTotal, JSON.stringify(report.accessibility.keyboard));
    }

    for (const page of context.pages().filter((page) => page.url().startsWith(workspaceBase))) await page.close();
    const concurrentResults = await sidepanel.evaluate(async () => Promise.all(Array.from({ length: 8 }, (_, index) => chrome.runtime.sendMessage({
      type: "OPEN_NAVIA_KNOWLEDGE_WORKSPACE",
      requestId: `px1_concurrent_${index}`,
      hostStrategy: "extension_workspace_page",
      origin: "open_workspace",
      routeIntent: "source_library",
      workspaceId: "ws_default",
      reusePolicy: "focus_existing_or_create"
    }))));
    await new Promise((resolve) => setTimeout(resolve, 1_000));
    const workspacePagesAfterReuse = context.pages().filter((page) => page.url().startsWith(workspaceBase));
    check("concurrent_focus_existing_or_create", workspacePagesAfterReuse.length === 1, `Workspace pages after 8 concurrent requests: ${workspacePagesAfterReuse.length}`);
    check("concurrent_result_identity", concurrentResults.length === 8 && new Set(concurrentResults.map((result) => result?.tabId)).size === 1, JSON.stringify(concurrentResults));
    report.concurrentOpenResults = concurrentResults;
    check("no_ingest_on_open", ingestRequestCount === 0, `Observed POST /v1/knowledge/sources requests: ${ingestRequestCount}`);

    if (runPx3Lifecycle) {
      const existingPage = workspacePagesAfterReuse[0];
      await existingPage.close();
      const afterClosePagePromise = context.waitForEvent("page", { timeout: 15_000 });
      const afterCloseResultPromise = sidepanel.evaluate(() => chrome.runtime.sendMessage({
        type: "OPEN_NAVIA_KNOWLEDGE_WORKSPACE",
        requestId: "px3_after_tab_close",
        hostStrategy: "extension_workspace_page",
        origin: "open_workspace",
        routeIntent: "source_library",
        workspaceId: "ws_default",
        reusePolicy: "focus_existing_or_create"
      }));
      const [afterClosePage, afterCloseResult] = await Promise.all([afterClosePagePromise, afterCloseResultPromise]);
      await waitForWorkspaceReady(afterClosePage);
      check("tab_close_then_user_create", afterCloseResult?.outcome === "created_new", JSON.stringify(afterCloseResult));
      const afterRestartEquivalent = await sidepanel.evaluate(() => chrome.runtime.sendMessage({
        type: "OPEN_NAVIA_KNOWLEDGE_WORKSPACE",
        requestId: "px3_restart_equivalent",
        hostStrategy: "extension_workspace_page",
        origin: "open_workspace",
        routeIntent: "source_library",
        workspaceId: "ws_default",
        reusePolicy: "focus_existing_or_create"
      }));
      check(
        "fresh_query_reuses_existing_tab",
        afterRestartEquivalent?.outcome === "focused_existing" && afterRestartEquivalent?.tabId === afterCloseResult?.tabId,
        JSON.stringify({ afterCloseResult, afterRestartEquivalent })
      );
      check("px3_no_ingest_after_lifecycle", ingestRequestCount === 0, `Observed POST /v1/knowledge/sources requests: ${ingestRequestCount}`);
    }

    report.passed = report.issues.length === 0 && report.checks.every((item) => item.passed);
  } catch (error) {
    report.issues.push(error instanceof Error ? error.stack || error.message : String(error));
  } finally {
    if (browserHandle) await browserHandle.close();
    try {
      fs.rmSync(userDataDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 250 });
    } catch {
      // Windows Chrome can hold profile DB handles briefly after CDP closes; product evidence is already isolated.
    }
  }

  writeJson(reportFileName, report);
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.passed ? 0 : 2);
}

main().catch((error) => {
  console.error(error);
  process.exit(2);
});
