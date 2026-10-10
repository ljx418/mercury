import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import AxeBuilder from "@axe-core/playwright";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../..");
const extensionRoot = fs.realpathSync(path.join(repoRoot, "apps/chrome-extension/chrome-mv3-unpacked"));
const runId = process.env.NAVIA_V3_2_6_UI_RUN_ID || `v3-2-6-ui-${new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")}`;
const runRoot = process.env.NAVIA_V3_2_6_UI_RUN_ROOT
  ? path.resolve(repoRoot, process.env.NAVIA_V3_2_6_UI_RUN_ROOT)
  : path.join(repoRoot, "docs/active/project/evidence/v3_media_companion/v3-2-media-acquisition/v3-2-6-fault-runs/runs", runId);
const privateRoot = path.join(runRoot, "private");
const publicRoot = path.join(runRoot, "public");
const profilePath = path.join(repoRoot, ".tmp", `navia-v3-2-6-${crypto.createHash("sha256").update(runId).digest("hex").slice(0, 12)}`);
const secureTaskRoot = path.join("/tmp", `navia-${crypto.createHash("sha256").update(runId).digest("hex").slice(0, 16)}`);
const sampleUrl = "https://www.bilibili.com/video/BV13W41137qV";
const taskId = `media_task_${crypto.createHash("sha256").update(runId).digest("hex").slice(0, 32)}`;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const ensure = (value, message) => { if (!value) throw new Error(message); };
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");

function confirmPermission(profile) {
  const profileName = path.basename(profile);
  const script = [
    "$OutputEncoding=[Console]::OutputEncoding=[System.Text.UTF8Encoding]::new()",
    "Add-Type -AssemblyName UIAutomationClient",
    "Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public static class NaviaFaultClick { [DllImport(\"user32.dll\")] public static extern bool SetForegroundWindow(IntPtr h); [DllImport(\"user32.dll\")] public static extern bool SetCursorPos(int x,int y); [DllImport(\"user32.dll\")] public static extern void mouse_event(uint f,uint x,uint y,uint d,UIntPtr e); }'",
    `$profile='${profileName}'`, "$deadline=[DateTime]::UtcNow.AddSeconds(20)", "$done=$false",
    "while([DateTime]::UtcNow -lt $deadline -and -not $done){",
    " $pi=Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'chrome.exe' -and $_.CommandLine -and $_.CommandLine.Contains($profile) -and -not $_.CommandLine.Contains('--type=') } | Select-Object -First 1",
    " if($pi){$p=Get-Process -Id $pi.ProcessId -ErrorAction SilentlyContinue; if($p -and $p.MainWindowHandle -ne 0){$root=[System.Windows.Automation.AutomationElement]::FromHandle($p.MainWindowHandle); $all=$root.FindAll([System.Windows.Automation.TreeScope]::Descendants,[System.Windows.Automation.Condition]::TrueCondition); foreach($e in $all){if($e.Current.ControlType.ProgrammaticName -eq 'ControlType.Button' -and ($e.Current.Name -eq '允许' -or $e.Current.Name -eq 'Allow')){$null=[NaviaFaultClick]::SetForegroundWindow($p.MainWindowHandle); $r=$e.Current.BoundingRectangle; $null=[NaviaFaultClick]::SetCursorPos([int]($r.Left+$r.Width/2),[int]($r.Top+$r.Height/2)); [NaviaFaultClick]::mouse_event(2,0,0,0,[UIntPtr]::Zero); Start-Sleep -Milliseconds 80; [NaviaFaultClick]::mouse_event(4,0,0,0,[UIntPtr]::Zero); $done=$true; break}}}}",
    " if(-not $done){Start-Sleep -Milliseconds 200}", "}", "if(-not $done){exit 2}"
  ].join("; ");
  const result = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], { encoding: "utf8", timeout: 25_000 });
  ensure(result.status === 0, "Bilibili host permission was not confirmed");
}

function stopProfileChrome(profile) {
  const profileName = path.basename(profile);
  const script = `$p='${profileName}'; Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'chrome.exe' -and $_.CommandLine -and $_.CommandLine.Contains($p) } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`;
  spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], { encoding: "utf8", timeout: 15_000 });
}

function startRuntime(extensionId, token) {
  const child = spawn("python3", ["-m", "uvicorn", "navia_runtime.app:app", "--host", "127.0.0.1", "--port", "17861", "--app-dir", "services/local-runtime"], {
    cwd: repoRoot,
    env: {
      ...process.env,
      NAVIA_DB_PATH: path.join(privateRoot, "runtime.sqlite3"),
      NAVIA_MEDIA_TASK_ROOT: path.join(secureTaskRoot, "media-tasks"),
      NAVIA_MEDIA_ASR_TASK_ROOT: path.join(secureTaskRoot, "media-asr-tasks"),
      NAVIA_LOCAL_FILES_TOKEN: token,
      NAVIA_LOCAL_FILES_EXTENSION_ID: extensionId
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let log = "";
  child.stdout.on("data", (chunk) => { log += chunk; });
  child.stderr.on("data", (chunk) => { log += chunk; });
  return { child, async stop() {
    if (child.exitCode === null) child.kill("SIGTERM");
    await Promise.race([new Promise((resolve) => child.once("exit", resolve)), wait(5_000)]);
    if (child.exitCode === null) child.kill("SIGKILL");
    fs.writeFileSync(path.join(privateRoot, "runtime.log"), log, { mode: 0o600 });
  }};
}

async function waitRuntime() {
  for (let index = 0; index < 100; index += 1) {
    try { if ((await fetch("http://127.0.0.1:17861/v1/health")).ok) return; } catch {}
    await wait(200);
  }
  throw new Error("Runtime health timeout");
}

async function connectRuntime(page, token) {
  void token;
  await page.locator("[data-testid='local-runtime-access']").waitFor({ timeout: 20_000 });
  for (let index = 0; index < 20; index += 1) {
    if (await page.getByText("本机伴侣已连接", { exact: true }).count()) return;
    const button = page.locator("[data-testid='local-runtime-connect']");
    if (await button.count() && await button.isEnabled()) await button.click();
    await page.waitForTimeout(500);
  }
  throw new Error("Runtime secure session did not connect");
}

async function seedFailedTask(origin, token, context) {
  const sourceIdentity = `portal:${context.adapterId}:${context.mediaId}:${context.playbackUnitId}:${context.part.id}`;
  const created = await fetch("http://127.0.0.1:17861/v1/media/acquisitions", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ taskId, sourceIdentity, adapterId: context.adapterId, mediaId: context.mediaId, playbackUnitId: context.playbackUnitId, partId: context.part.id, consentPolicyId: "bilibili-media-consent/v1", consentPolicyRevision: 1 })
  });
  ensure(created.status === 201, `task create failed: ${created.status}`);
  const executed = await fetch(`http://127.0.0.1:17861/v1/media/acquisitions/${taskId}/execute`, {
    method: "POST", headers: { Origin: origin, Authorization: `Bearer ${token}` }
  });
  const body = await executed.json();
  ensure(executed.status === 403 && body.error?.code === "V3_MEDIA_LEASE_REQUIRED", `missing lease did not fail closed: status=${executed.status} code=${body.error?.code ?? "none"}`);
  return body.error.code;
}

async function inspectSurface(page, surface, screenshotName) {
  const card = page.locator("[data-testid='media-transcript-quick-card'], [data-testid='media-transcript-workspace']").first();
  await card.waitFor({ timeout: 30_000 });
  await page.getByText("任务失败", { exact: true }).waitFor({ timeout: 30_000 });
  const text = await card.innerText();
  ensure(text.includes("V3_MEDIA_LEASE_REQUIRED"), `${surface} did not show the Runtime failure code`);
  ensure(!text.includes("转写已完成"), `${surface} showed a false success`);
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag22aa"]).analyze();
  const layout = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }));
  const target = path.join(publicRoot, screenshotName);
  await page.screenshot({ path: target, fullPage: false, animations: "disabled", timeout: 60_000 });
  return {
    surface, taskId: (await card.getAttribute("data-task-id")) ?? taskId, failureVisible: true,
    falseSuccessVisible: false, rootOverflow: layout.scrollWidth > layout.clientWidth,
    axeSerious: axe.violations.filter((item) => item.impact === "serious").length,
    axeCritical: axe.violations.filter((item) => item.impact === "critical").length,
    screenshotSha256: sha256(fs.readFileSync(target))
  };
}

async function main() {
  fs.rmSync(runRoot, { recursive: true, force: true });
  fs.rmSync(profilePath, { recursive: true, force: true });
  fs.rmSync(secureTaskRoot, { recursive: true, force: true });
  fs.mkdirSync(privateRoot, { recursive: true, mode: 0o700 });
  fs.mkdirSync(publicRoot, { recursive: true, mode: 0o700 });
  fs.mkdirSync(secureTaskRoot, { recursive: true, mode: 0o700 });
  process.env.NAVIA_T01_EXTENSION_ROOT = extensionRoot;
  process.env.NAVIA_T01_HEADLESS = "0";
  process.env.NAVIA_T01_FORCE_DEVICE_SCALE_FACTOR = "1";
  const helpers = await import(`./chrome-v2-t01-r1-frontend.mjs?v3-2-6=${Date.now()}`);
  const token = crypto.randomBytes(32).toString("base64url");
  let browser;
  let runtime;
  const result = { schemaVersion: "v3-2-6-fault-ui/v1", runId, taskId, sampleUrl, surfaces: [], checks: {}, passed: false };
  try {
    browser = await helpers.launchExtension(profilePath);
    const video = await browser.context.newPage();
    await video.goto(sampleUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await video.waitForTimeout(3_000);
    const worker = await helpers.extensionWorker(browser.context);
    const extensionId = await worker.evaluate(() => chrome.runtime.id);
    const origin = `chrome-extension://${extensionId}`;
    const contextResponse = await worker.evaluate(async () => {
      const candidates = (await chrome.tabs.query({ currentWindow: true })).filter((tab) => typeof tab.id === "number" && /^https:\/\/www\.bilibili\.com\/video\//.test(tab.url ?? ""));
      if (candidates.length !== 1) return { ok: false, failureCode: "V3_MEDIA_PORTAL_AMBIGUOUS" };
      return chrome.tabs.sendMessage(candidates[0].id, { type: "navia.media.collectPageContext" });
    });
    ensure(contextResponse?.ok, `real page context unavailable: ${contextResponse?.failureCode ?? "unknown"}`);
    result.pageIdentity = {
      adapterId: contextResponse.value.adapterId,
      mediaId: contextResponse.value.mediaId,
      playbackUnitId: contextResponse.value.playbackUnitId,
      partId: contextResponse.value.part.id
    };
    runtime = startRuntime(extensionId, token);
    await waitRuntime();

    const workspace = await browser.context.newPage();
    await workspace.setViewportSize({ width: 768, height: 900 });
    await workspace.goto(`${origin}/workspace.html#/media/current`, { waitUntil: "domcontentloaded" });
    await workspace.locator("[data-testid='media-consent-authorize']").click();
    confirmPermission(profilePath);
    await workspace.waitForTimeout(1_000);
    await workspace.reload({ waitUntil: "domcontentloaded" });
    await workspace.locator("[data-testid='local-runtime-access']").waitFor({ timeout: 20_000 });
    await connectRuntime(workspace, token);
    result.checks.seedFailureCode = await seedFailedTask(origin, token, contextResponse.value);

    await workspace.goto(`${origin}/workspace.html#/media/transcript/${taskId}`, { waitUntil: "domcontentloaded" });
    await connectRuntime(workspace, token);
    result.surfaces.push(await inspectSurface(workspace, "workspace", "workspace-failed-768x900.png"));

    const panel = await browser.context.newPage();
    await panel.setViewportSize({ width: 360, height: 900 });
    await panel.goto(`${origin}/sidepanel.html#chat`, { waitUntil: "domcontentloaded" });
    await video.bringToFront();
    await panel.reload({ waitUntil: "domcontentloaded" });
    await connectRuntime(panel, token);
    await video.bringToFront();
    await panel.evaluate(() => (document.querySelector("[data-testid='local-runtime-disconnect']") instanceof HTMLButtonElement)
      && document.querySelector("[data-testid='local-runtime-disconnect']").click());
    await panel.locator("[data-testid='local-runtime-connect']").waitFor({ timeout: 20_000 });
    await panel.evaluate(() => (document.querySelector("[data-testid='local-runtime-connect']") instanceof HTMLButtonElement)
      && document.querySelector("[data-testid='local-runtime-connect']").click());
    await panel.getByText("本机伴侣已连接", { exact: true }).waitFor({ timeout: 20_000 });
    try {
      result.surfaces.push(await inspectSurface(panel, "side_panel", "side-panel-failed-360x900.png"));
    } catch (error) {
      result.sidePanelDiagnostic = (await panel.locator("body").innerText()).slice(0, 4000);
      await panel.screenshot({ path: path.join(publicRoot, "side-panel-failed-diagnostic.png"), fullPage: false, animations: "disabled" });
      throw error;
    }
    result.checks.sameRuntimeTask = result.surfaces.every((item) => item.taskId === taskId);
    result.checks.machineReasonVisible = result.surfaces.every((item) => item.failureVisible);
    result.checks.noFalseSuccess = result.surfaces.every((item) => !item.falseSuccessVisible);
    result.checks.noOverflow = result.surfaces.every((item) => !item.rootOverflow);
    result.checks.axeZero = result.surfaces.every((item) => item.axeSerious === 0 && item.axeCritical === 0);
    result.passed = Object.values(result.checks).every((value) => value === true || value === "V3_MEDIA_LEASE_REQUIRED");
    ensure(result.passed, "fault UI acceptance failed");
  } catch (error) {
    result.failure = error instanceof Error ? error.message : "unknown";
    throw error;
  } finally {
    fs.writeFileSync(path.join(publicRoot, "ui-result.json"), `${JSON.stringify(result, null, 2)}\n`, { mode: 0o600 });
    if (runtime) await runtime.stop();
    if (browser) await browser.close().catch(() => undefined);
    stopProfileChrome(profilePath);
    await wait(500);
    fs.rmSync(profilePath, { recursive: true, force: true });
    fs.rmSync(secureTaskRoot, { recursive: true, force: true });
    const publicBytes = fs.readdirSync(publicRoot).flatMap((name) => fs.readFileSync(path.join(publicRoot, name)));
    ensure(!publicBytes.some((value) => value.includes(Buffer.from(token))), "Runtime token leaked into public evidence");
    fs.rmSync(privateRoot, { recursive: true, force: true });
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
