import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import AxeBuilder from "@axe-core/playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");
const appRoot = path.join(repoRoot, "apps/chrome-extension");
const extensionRoot = fs.realpathSync(process.env.NAVIA_V3_EXTENSION_ROOT || path.join(appRoot, "chrome-mv3-unpacked"));
const evidenceRoot = path.join(repoRoot, "docs/active/project/evidence/v3_media_companion/v3-1-page-session-baseline");
const runId = process.env.NAVIA_V3_SESSION_RUN_ID || `v3-1.2-session-${new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")}`;
const runRoot = path.join(evidenceRoot, "v3-1.2-session-capability/runs", runId);
const screenshotRoot = path.join(runRoot, "screenshots");
const cookieSeedPath = process.env.NAVIA_V3_BILIBILI_COOKIE_FILE || "/mnt/c/Users/Administrator/Desktop/myCk.txt";
const anchorUrl = "https://www.bilibili.com/video/BV1ZpYd66ELP";
const sessionPolicyPath = path.join(repoRoot, "docs/active/project/contracts/v3-media-session-policy-registry.json");
const portalRegistryPath = path.join(repoRoot, "docs/active/project/contracts/v3-media-portal-registry.json");
const schemaPath = path.join(repoRoot, "docs/active/project/contracts/v3_media_session_contracts.schema.json");
const headless = process.env.NAVIA_V3_SESSION_HEADLESS !== "0";
const permissionPromptWaitMs = Number.parseInt(process.env.NAVIA_V3_SESSION_PERMISSION_PROMPT_WAIT_MS || "2000", 10);
const confirmNativePermissionPrompt = process.env.NAVIA_V3_SESSION_NATIVE_PERMISSION_CONFIRM === "1";

const allowedCookieNames = new Set([
  "DedeUserID",
  "DedeUserID__ckMd5",
  "SESSDATA",
  "b_nut",
  "bili_jct",
  "buvid3",
  "buvid4",
  "buvid_fp",
  "sid"
]);

const sha256 = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true, mode: 0o700 });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
}

function ensure(condition, message) {
  if (!condition) throw new Error(message);
}

function summarizeAxeViolations(violations) {
  return violations
    .filter((violation) => violation.impact === "serious" || violation.impact === "critical")
    .map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      targets: violation.nodes.flatMap((node) => node.target.map((target) => String(target)))
    }));
}

// Confirm the real Chrome permission bubble through native UI Automation; never grant via CDP.
function confirmChromePermissionPrompt(profilePath) {
  ensure(!headless, "native permission confirmation requires visible Chrome");
  const profileName = path.basename(profilePath);
  ensure(/^navia-t01-profile-[a-f0-9]{12}$/.test(profileName), "unexpected disposable profile name");
  const script = [
    "$OutputEncoding = [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()",
    "Add-Type -AssemblyName UIAutomationClient",
    "Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public static class NaviaNativeInput { [DllImport(\"user32.dll\")] public static extern bool SetProcessDPIAware(); [DllImport(\"user32.dll\")] public static extern bool SetForegroundWindow(IntPtr hWnd); [DllImport(\"user32.dll\")] public static extern bool SetCursorPos(int X, int Y); [DllImport(\"user32.dll\")] public static extern void mouse_event(uint flags, uint dx, uint dy, uint data, UIntPtr extra); }'",
    "$null = [NaviaNativeInput]::SetProcessDPIAware()",
    `$profileName = '${profileName}'`,
    "$deadline = [DateTime]::UtcNow.AddSeconds(15)",
    "$confirmed = $false",
    "while ([DateTime]::UtcNow -lt $deadline -and -not $confirmed) {",
    "  $processInfo = Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'chrome.exe' -and $_.CommandLine -and $_.CommandLine.Contains($profileName) -and -not $_.CommandLine.Contains('--type=') } | Select-Object -First 1",
    "  if ($processInfo) {",
    "    $process = Get-Process -Id $processInfo.ProcessId -ErrorAction SilentlyContinue",
    "    if ($process -and $process.MainWindowHandle -ne 0) {",
    "      $root = [System.Windows.Automation.AutomationElement]::FromHandle($process.MainWindowHandle)",
    "      $elements = $root.FindAll([System.Windows.Automation.TreeScope]::Descendants, [System.Windows.Automation.Condition]::TrueCondition)",
    "      foreach ($element in $elements) {",
    "        $name = $element.Current.Name",
    "        if ($element.Current.ControlType.ProgrammaticName -eq 'ControlType.Button' -and $element.Current.ClassName -eq 'MdTextButton' -and ($name -eq '允许' -or $name -eq 'Allow')) {",
    "          $parent = $element",
    "          $dialogName = ''",
    "          for ($index = 0; $index -lt 8; $index += 1) {",
    "            $parent = [System.Windows.Automation.TreeWalker]::ControlViewWalker.GetParent($parent)",
    "            if (-not $parent) { break }",
    "            if ($parent.Current.ControlType.ProgrammaticName -eq 'ControlType.Window') { $dialogName = $parent.Current.Name; break }",
    "          }",
    "          if ($dialogName -like '*Navia*' -and ($dialogName -like '*权限*' -or $dialogName -like '*permission*')) {",
    "            $rect = $element.Current.BoundingRectangle",
    "            $x = [int]($rect.Left + ($rect.Width / 2))",
    "            $y = [int]($rect.Top + ($rect.Height / 2))",
    "            $null = [NaviaNativeInput]::SetForegroundWindow($process.MainWindowHandle)",
    "            Start-Sleep -Milliseconds 200",
    "            $null = [NaviaNativeInput]::SetCursorPos($x, $y)",
    "            [NaviaNativeInput]::mouse_event(0x0002, 0, 0, 0, [UIntPtr]::Zero)",
    "            Start-Sleep -Milliseconds 100",
    "            [NaviaNativeInput]::mouse_event(0x0004, 0, 0, 0, [UIntPtr]::Zero)",
    "            $confirmed = $true",
    "            break",
    "          }",
    "        }",
    "      }",
    "    }",
    "  }",
    "  if (-not $confirmed) { Start-Sleep -Milliseconds 200 }",
    "}",
    "if (-not $confirmed) { exit 2 }",
    "Write-Output 'native_permission_confirmed=true'"
  ].join("; ");
  const result = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], {
    encoding: "utf8",
    timeout: 20_000
  });
  return result.status === 0 && result.stdout.includes("native_permission_confirmed=true");
}

function hashBuildTree(root) {
  const entries = [];
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else if (entry.isFile()) entries.push({
        path: path.relative(root, absolute).replaceAll(path.sep, "/"),
        sha256: sha256(fs.readFileSync(absolute))
      });
    }
  };
  visit(root);
  return sha256(Buffer.from(JSON.stringify(entries)));
}

function readAuthorizedLiveCookieSeed() {
  ensure(fs.existsSync(cookieSeedPath), "authorized live-session seed is missing");
  const parsed = JSON.parse(fs.readFileSync(cookieSeedPath, "utf8"));
  ensure(Array.isArray(parsed), "authorized live-session seed must be a JSON array");
  const cookies = [];
  const rawValues = [];
  for (const row of parsed) {
    if (!row || typeof row !== "object") continue;
    const name = typeof row.name === "string" ? row.name : "";
    const value = typeof row.value === "string" ? row.value : "";
    const domain = typeof row.domain === "string" ? row.domain.toLowerCase() : "";
    if (!allowedCookieNames.has(name) || !value) continue;
    const normalizedDomain = domain.replace(/^\./, "");
    ensure(normalizedDomain === "bilibili.com" || normalizedDomain.endsWith(".bilibili.com"), "authorized seed contains a non-Bilibili domain");
    const cookie = {
      name,
      value,
      domain: ".bilibili.com",
      path: typeof row.path === "string" ? row.path : "/",
      httpOnly: row.httpOnly === true,
      secure: row.secure === true
    };
    const sameSite = row.sameSite === "strict"
      ? "Strict"
      : row.sameSite === "lax"
        ? "Lax"
        : row.sameSite === "no_restriction"
          ? "None"
          : null;
    if (sameSite) cookie.sameSite = sameSite;
    if (Number.isFinite(row.expirationDate)) cookie.expires = row.expirationDate;
    cookies.push(cookie);
    rawValues.push(Buffer.from(value));
  }
  ensure(cookies.some((cookie) => cookie.name === "SESSDATA"), "authorized seed has no nonempty required session cookie");
  ensure(new Set(cookies.map((cookie) => cookie.name)).size === 9, "authorized seed does not contain the frozen nine-name set");
  return { cookies, rawValues };
}

function scanRootsForRawValues(roots, rawValues) {
  const hits = [];
  let scannedFiles = 0;
  const visit = (root, directory) => {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(root, absolute);
      else if (entry.isFile()) {
        scannedFiles += 1;
        const bytes = fs.readFileSync(absolute);
        if (rawValues.some((needle) => needle.length >= 8 && bytes.includes(needle))) {
          hits.push(path.relative(root, absolute).replaceAll(path.sep, "/"));
        }
      }
    }
  };
  for (const root of roots) visit(root, root);
  return { scannedFiles, hitCount: hits.length, hits };
}

async function loadChromeHelpers() {
  process.env.NAVIA_T01_EVIDENCE_ROOT = runRoot;
  process.env.NAVIA_T01_RUN_ID = runId;
  process.env.NAVIA_T01_EXTENSION_ROOT = extensionRoot;
  process.env.NAVIA_T01_HEADLESS = headless ? "1" : "0";
  return import(`./chrome-v2-t01-r1-frontend.mjs?v3session=${Date.now()}`);
}

async function extensionIdentity(worker) {
  return worker.evaluate(() => ({
    id: chrome.runtime.id,
    manifest: chrome.runtime.getManifest()
  }));
}

async function activeTabId(worker, expectedUrl) {
  return worker.evaluate(async (url) => {
    const tabs = await chrome.tabs.query({});
    return tabs.find((tab) => tab.url === url)?.id ?? tabs.find((tab) => tab.url?.startsWith("https://www.bilibili.com/video/"))?.id ?? null;
  }, expectedUrl);
}

async function openSidePanelDocument(context, extensionId, tabId, viewport) {
  const page = await context.newPage();
  await page.setViewportSize(viewport);
  await page.goto(`chrome-extension://${extensionId}/sidepanel.html?naviaE2ETabId=${tabId}`, { waitUntil: "domcontentloaded" });
  await page.locator("[data-testid='media-consent-card']").waitFor({ timeout: 20_000 });
  return page;
}

async function permissionsState(worker) {
  return worker.evaluate(async () => ({
    named: await chrome.permissions.contains({ permissions: ["cookies"] }),
    host: await chrome.permissions.contains({ origins: ["https://*.bilibili.com/*"] })
  }));
}

async function persistedPolicy(worker) {
  return worker.evaluate(async () => {
    const key = "navia.mediaConsentPolicy.bilibili";
    const stored = await chrome.storage.local.get(key);
    return stored[key] ?? null;
  });
}

async function mediaSessionDiagnostics(worker) {
  return worker.evaluate(() => globalThis.__naviaE2EMediaSessionDiagnostics?.() ?? null);
}

async function sendRawSessionMessage(page, message) {
  return page.evaluate((payload) => chrome.runtime.sendMessage(payload), message);
}

async function activeTestId(page) {
  return page.evaluate(() => document.activeElement instanceof HTMLElement
    ? document.activeElement.dataset.testid ?? null
    : null);
}

async function scanExtensionStorage(page, worker, rawValues) {
  const extensionStorage = await worker.evaluate(() => chrome.storage.local.get(null));
  const documentStorage = await page.evaluate(async () => ({
    localStorage: Object.entries(localStorage),
    sessionStorage: Object.entries(sessionStorage),
    indexedDbNames: typeof indexedDB.databases === "function"
      ? (await indexedDB.databases()).map((entry) => entry.name ?? "")
      : []
  }));
  const bytes = Buffer.from(JSON.stringify({ extensionStorage, documentStorage }));
  return {
    serializedBytes: bytes.length,
    rawValueHitCount: rawValues.filter((needle) => needle.length >= 8 && bytes.includes(needle)).length,
    localStorageEntryCount: documentStorage.localStorage.length,
    sessionStorageEntryCount: documentStorage.sessionStorage.length,
    indexedDbCount: documentStorage.indexedDbNames.length
  };
}

async function inspectCapabilityFromUi(page) {
  await page.locator("[data-testid='media-consent-refresh']").click();
  await page.waitForTimeout(750);
  return page.locator(".media-consent-status").textContent();
}

async function keyboardOrder(page) {
  await page.evaluate(() => {
    (document.activeElement instanceof HTMLElement ? document.activeElement : document.body).blur();
    document.body.focus();
  });
  const order = [];
  for (let index = 0; index < 30; index += 1) {
    await page.keyboard.press("Tab");
    const descriptor = await page.evaluate(() => {
      const active = document.activeElement;
      return active instanceof HTMLElement
        ? active.dataset.testid || active.getAttribute("aria-label") || active.textContent?.trim().slice(0, 40) || active.tagName
        : null;
    });
    if (descriptor) order.push(descriptor);
    if (order.includes("media-consent-authorize") && order.includes("media-consent-deny")) break;
  }
  return order;
}

async function capture(page, name) {
  const filePath = path.join(screenshotRoot, name);
  await page.screenshot({ path: filePath, fullPage: true });
  return {
    path: path.relative(runRoot, filePath).replaceAll(path.sep, "/"),
    sha256: sha256(fs.readFileSync(filePath)),
    viewport: page.viewportSize()
  };
}

async function validateServerSession(page) {
  const result = await page.evaluate(async () => {
    const response = await fetch("https://api.bilibili.com/x/web-interface/nav", {
      credentials: "include",
      headers: { accept: "application/json" }
    });
    const body = await response.json();
    return { httpStatus: response.status, code: body?.code ?? null, isLogin: body?.data?.isLogin === true };
  });
  return result;
}

async function runSegment({ helpers, segmentId, seedCookies, rawValues, expectAvailable }) {
  const profileSuffix = crypto.createHash("sha256").update(`${runId}:${segmentId}`).digest("hex").slice(0, 12);
  const profilePath = path.join(repoRoot, ".tmp", `navia-t01-profile-${profileSuffix}`);
  fs.rmSync(profilePath, { recursive: true, force: true });
  let launched = await helpers.launchExtension(profilePath);
  const checks = [];
  const screenshots = [];
  const attackObservations = [];
  let serverSession = null;
  let finalPolicy = null;
  let finalPermissions = null;
  let authorizationOutcome = null;
  let nativePermissionPromptConfirmed = false;
  let axe = null;
  let keyboard = [];
  let storageScan = null;
  const focusReturn = {};
  const cookieReadObservations = {};
  let restartObservation = null;
  try {
    if (seedCookies) await launched.context.addCookies(seedCookies);
    let host = await launched.context.newPage();
    await host.setViewportSize({ width: 1280, height: 900 });
    await host.goto(anchorUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await host.waitForTimeout(2_000);
    if (seedCookies) serverSession = await validateServerSession(host);
    let worker = await helpers.extensionWorker(launched.context);
    let identity = await extensionIdentity(worker);
    let tabId = await activeTabId(worker, host.url());
    ensure(Number.isInteger(tabId), `${segmentId}: Bilibili tab id unavailable`);
    let panel = await openSidePanelDocument(launched.context, identity.id, tabId, { width: 360, height: 900 });
    screenshots.push(await capture(panel, `${segmentId}-initial-360x900.png`));
    keyboard = await keyboardOrder(panel);
    checks.push({ id: "keyboard_authorize_and_deny_reachable", passed: keyboard.includes("media-consent-authorize") && keyboard.includes("media-consent-deny") });
    axe = await new AxeBuilder({ page: panel }).analyze();
    checks.push({ id: "axe_serious_critical_zero", passed: axe.violations.filter((item) => item.impact === "serious" || item.impact === "critical").length === 0 });

    await panel.locator("[data-testid='media-consent-deny']").click();
    await panel.getByText("已暂缓授权", { exact: true }).waitFor({ timeout: 10_000 });
    checks.push({ id: "explicit_denial_persisted", passed: (await persistedPolicy(worker))?.status === "denied" });
    focusReturn.afterDenial = await activeTestId(panel);
    checks.push({ id: "denial_focus_retained", passed: focusReturn.afterDenial === "media-consent-deny" });
    screenshots.push(await capture(panel, `${segmentId}-denied-360x900.png`));

    const deniedResponse = await sendRawSessionMessage(panel, {
      type: "navia.mediaSession",
      command: "inspect_capability",
      adapterId: "bilibili",
      policyRevision: 1
    });
    const extraFieldResponse = await sendRawSessionMessage(panel, {
      type: "navia.mediaSession",
      command: "inspect_capability",
      adapterId: "bilibili",
      policyRevision: 1,
      host: "https://attacker.invalid"
    });
    const unknownAdapterResponse = await sendRawSessionMessage(panel, {
      type: "navia.mediaSession",
      command: "inspect_capability",
      adapterId: "unknown_adapter",
      policyRevision: 1
    });
    const deniedDiagnostics = await mediaSessionDiagnostics(worker);
    attackObservations.push({
      phase: "denied",
      cookieReadCount: deniedDiagnostics?.cookieReadCount ?? null,
      capabilityStatus: deniedResponse?.value?.capability?.status ?? null,
      capabilityFailureCode: deniedResponse?.value?.capability?.failureCode ?? null,
      extraFieldFailureCode: extraFieldResponse?.failureCode ?? null,
      unknownAdapterFailureCode: unknownAdapterResponse?.value?.failureCode ?? null
    });
    checks.push({ id: "denied_inspect_fail_closed", passed: deniedResponse?.value?.capability?.status === "permission_denied" });
    checks.push({ id: "extra_fields_rejected", passed: extraFieldResponse?.ok === false && extraFieldResponse?.failureCode === "V3_MEDIA_SESSION_POLICY_MISMATCH" });
    checks.push({ id: "unknown_adapter_rejected", passed: unknownAdapterResponse?.value?.ok === false && unknownAdapterResponse?.value?.failureCode === "V3_MEDIA_SESSION_ADAPTER_UNSUPPORTED" });
    checks.push({ id: "denied_and_attack_cookie_read_zero", passed: deniedDiagnostics?.cookieReadCount === 0 });

    await panel.locator("[data-testid='media-consent-authorize']").click();
    if (confirmNativePermissionPrompt) {
      nativePermissionPromptConfirmed = confirmChromePermissionPrompt(profilePath);
      checks.push({ id: "native_permission_prompt_confirmed", passed: nativePermissionPromptConfirmed });
    }
    await panel.waitForTimeout(Number.isFinite(permissionPromptWaitMs) ? permissionPromptWaitMs : 2_000);
    finalPermissions = await permissionsState(worker);
    finalPolicy = await persistedPolicy(worker);
    authorizationOutcome = finalPermissions.named && finalPermissions.host && finalPolicy?.status === "granted"
      ? "granted"
      : finalPolicy?.status ?? "unknown";
    checks.push({ id: "trusted_click_optional_permissions_granted", passed: authorizationOutcome === "granted" });
    focusReturn.afterGrant = await activeTestId(panel);
    checks.push({ id: "grant_focus_moved_to_stable_action", passed: focusReturn.afterGrant === "media-consent-refresh" });

    if (authorizationOutcome === "granted") {
      const beforeMismatch = await mediaSessionDiagnostics(worker);
      const revisionMismatchResponse = await sendRawSessionMessage(panel, {
        type: "navia.mediaSession",
        command: "inspect_capability",
        adapterId: "bilibili",
        policyRevision: 2
      });
      const afterMismatch = await mediaSessionDiagnostics(worker);
      attackObservations.push({
        phase: "revision_mismatch",
        cookieReadCountBefore: beforeMismatch?.cookieReadCount ?? null,
        cookieReadCountAfter: afterMismatch?.cookieReadCount ?? null,
        capabilityStatus: revisionMismatchResponse?.value?.capability?.status ?? null,
        failureCode: revisionMismatchResponse?.value?.capability?.failureCode ?? null
      });
      checks.push({
        id: "revision_mismatch_fail_closed_without_cookie_read",
        passed: revisionMismatchResponse?.value?.capability?.status === "unknown"
          && revisionMismatchResponse?.value?.capability?.failureCode === "V3_MEDIA_SESSION_POLICY_MISMATCH"
          && beforeMismatch?.cookieReadCount === afterMismatch?.cookieReadCount
      });
      const beforeUiInspect = await mediaSessionDiagnostics(worker);
      const status = await inspectCapabilityFromUi(panel);
      const afterInspect = await mediaSessionDiagnostics(worker);
      cookieReadObservations.authorizedRefresh = {
        before: beforeUiInspect?.cookieReadCount ?? null,
        after: afterInspect?.cookieReadCount ?? null
      };
      checks.push({
        id: expectAvailable ? "live_seed_candidate_available" : "anonymous_candidate_unavailable",
        passed: expectAvailable ? status?.includes("已检测会话候选") : status?.includes("未检测到会话候选")
      });
      checks.push({
        id: "authorized_inspect_reads_cookie_once",
        passed: Number.isInteger(beforeUiInspect?.cookieReadCount)
          && afterInspect?.cookieReadCount === beforeUiInspect.cookieReadCount + 1
      });
      const beforeRestartStorage = await scanExtensionStorage(panel, worker, rawValues);
      checks.push({ id: "private_storage_secret_scan_before_restart", passed: beforeRestartStorage.rawValueHitCount === 0 });
      await panel.setViewportSize({ width: 420, height: 900 });
      screenshots.push(await capture(panel, `${segmentId}-capability-420x900.png`));
      await panel.reload({ waitUntil: "domcontentloaded" });
      await panel.locator("[data-testid='media-consent-card']").waitFor({ timeout: 10_000 });
      checks.push({ id: "reload_policy_restored", passed: (await persistedPolicy(worker))?.status === "granted" });
      await panel.close();

      let reopened = await openSidePanelDocument(launched.context, identity.id, tabId, { width: 360, height: 900 });
      checks.push({ id: "reopen_policy_restored", passed: (await persistedPolicy(worker))?.status === "granted" });
      await reopened.close();
      await host.close();
      await launched.close();

      launched = await helpers.launchExtension(profilePath);
      host = await launched.context.newPage();
      await host.setViewportSize({ width: 1280, height: 900 });
      await host.goto(anchorUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
      await host.waitForTimeout(1_000);
      worker = await helpers.extensionWorker(launched.context);
      identity = await extensionIdentity(worker);
      tabId = await activeTabId(worker, host.url());
      ensure(Number.isInteger(tabId), `${segmentId}: Bilibili tab id unavailable after restart`);
      const restartDiagnosticsBefore = await mediaSessionDiagnostics(worker);
      const restartPermissions = await permissionsState(worker);
      checks.push({ id: "browser_restart_policy_restored", passed: (await persistedPolicy(worker))?.status === "granted" });
      checks.push({ id: "browser_restart_permissions_authoritative", passed: restartPermissions.named === restartPermissions.host });
      checks.push({ id: "service_worker_restart_counter_reset", passed: restartDiagnosticsBefore?.cookieReadCount === 0 });

      reopened = await openSidePanelDocument(launched.context, identity.id, tabId, { width: 360, height: 900 });
      const restartDiagnosticsAfterOpen = await mediaSessionDiagnostics(worker);
      const restartStatus = await inspectCapabilityFromUi(reopened);
      const restartDiagnosticsAfter = await mediaSessionDiagnostics(worker);
      const permissionsPersisted = restartPermissions.named && restartPermissions.host;
      restartObservation = {
        permissionsPersisted,
        status: restartStatus,
        cookieReadCountBeforeOpen: restartDiagnosticsBefore?.cookieReadCount ?? null,
        cookieReadCountAfterOpen: restartDiagnosticsAfterOpen?.cookieReadCount ?? null,
        cookieReadCountAfterRefresh: restartDiagnosticsAfter?.cookieReadCount ?? null
      };
      cookieReadObservations.restartRefresh = {
        before: restartDiagnosticsAfterOpen?.cookieReadCount ?? null,
        after: restartDiagnosticsAfter?.cookieReadCount ?? null
      };
      checks.push({
        id: "browser_restart_capability_recomputed",
        passed: permissionsPersisted
          ? (expectAvailable ? restartStatus?.includes("已检测会话候选") : restartStatus?.includes("未检测到会话候选"))
            && Number.isInteger(restartDiagnosticsAfterOpen?.cookieReadCount)
            && restartDiagnosticsAfter?.cookieReadCount === restartDiagnosticsAfterOpen.cookieReadCount + 1
          : restartStatus?.includes("浏览器权限已移除")
            && restartDiagnosticsAfterOpen?.cookieReadCount === 0
            && restartDiagnosticsAfter?.cookieReadCount === 0
      });
      screenshots.push(await capture(reopened, `${segmentId}-restart-capability-360x900.png`));

      await reopened.locator("[data-testid='media-consent-revoke']").click();
      await reopened.getByText("已撤销", { exact: true }).waitFor({ timeout: 10_000 });
      focusReturn.afterRevoke = await activeTestId(reopened);
      checks.push({ id: "revoke_focus_moved_to_stable_action", passed: focusReturn.afterRevoke === "media-consent-authorize" });
      const revokedPermissions = await permissionsState(worker);
      checks.push({ id: "revoke_removed_permissions", passed: !revokedPermissions.named && !revokedPermissions.host });
      checks.push({ id: "revoke_policy_persisted", passed: (await persistedPolicy(worker))?.status === "revoked" });
      const beforeRevokedInspect = await mediaSessionDiagnostics(worker);
      const revokedResponse = await sendRawSessionMessage(reopened, {
        type: "navia.mediaSession",
        command: "inspect_capability",
        adapterId: "bilibili",
        policyRevision: 1
      });
      const afterRevokedInspect = await mediaSessionDiagnostics(worker);
      attackObservations.push({
        phase: "revoked",
        cookieReadCountBefore: beforeRevokedInspect?.cookieReadCount ?? null,
        cookieReadCountAfter: afterRevokedInspect?.cookieReadCount ?? null,
        capabilityStatus: revokedResponse?.value?.capability?.status ?? null,
        failureCode: revokedResponse?.value?.capability?.failureCode ?? null
      });
      checks.push({
        id: "revoked_inspect_fail_closed_without_cookie_read",
        passed: revokedResponse?.value?.capability?.status === "revoked"
          && revokedResponse?.value?.capability?.failureCode === "V3_MEDIA_SESSION_REVOKED"
          && beforeRevokedInspect?.cookieReadCount === afterRevokedInspect?.cookieReadCount
      });
      const afterRevokeStorage = await scanExtensionStorage(reopened, worker, rawValues);
      checks.push({ id: "private_storage_secret_scan_after_revoke", passed: afterRevokeStorage.rawValueHitCount === 0 });
      storageScan = {
        beforeRestart: beforeRestartStorage,
        afterRevoke: afterRevokeStorage,
        passed: beforeRestartStorage.rawValueHitCount === 0 && afterRevokeStorage.rawValueHitCount === 0
      };
      screenshots.push(await capture(reopened, `${segmentId}-revoked-360x900.png`));
      await reopened.close();
    }
    await host.close();
  } finally {
    await launched.close().catch(() => undefined);
    fs.rmSync(profilePath, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 });
  }
  return {
    segmentId,
    evidenceClass: seedCookies ? "user_authorized_live_session_seed" : "fresh_anonymous_profile",
    serverSession,
    authorizationOutcome,
    nativePermissionPromptConfirmed,
    permissions: finalPermissions,
    policyStatus: finalPolicy?.status ?? null,
    checks,
    screenshots,
    attackObservations,
    storageScan,
    focusReturn,
    cookieReadObservations,
    restartObservation,
    accessibility: {
      serious: axe?.violations.filter((item) => item.impact === "serious").length ?? null,
      critical: axe?.violations.filter((item) => item.impact === "critical").length ?? null,
      violations: axe ? summarizeAxeViolations(axe.violations) : [],
      keyboardOrder: keyboard
    },
    cleanup: { profileDeleted: !fs.existsSync(profilePath) },
    passed: checks.every((check) => check.passed) && !fs.existsSync(profilePath)
  };
}

async function main() {
  fs.rmSync(runRoot, { recursive: true, force: true });
  fs.mkdirSync(screenshotRoot, { recursive: true, mode: 0o700 });
  ensure(fs.existsSync(path.join(extensionRoot, "manifest.json")), "extension build is missing");
  const manifest = JSON.parse(fs.readFileSync(path.join(extensionRoot, "manifest.json"), "utf8"));
  ensure(JSON.stringify(manifest.optional_permissions) === JSON.stringify(["cookies"]), "optional named permission mismatch");
  ensure(JSON.stringify(manifest.optional_host_permissions) === JSON.stringify(["https://*.bilibili.com/*"]), "optional host permission mismatch");
  const seed = readAuthorizedLiveCookieSeed();
  const helpers = await loadChromeHelpers();
  const anonymous = await runSegment({ helpers, segmentId: "anonymous", seedCookies: null, rawValues: seed.rawValues, expectAvailable: false });
  const seeded = await runSegment({ helpers, segmentId: "live-seed", seedCookies: seed.cookies, rawValues: seed.rawValues, expectAvailable: true });
  const serviceInputValid = seeded.serverSession?.httpStatus === 200 && seeded.serverSession?.code === 0 && seeded.serverSession?.isLogin === true;
  const rawValueScan = scanRootsForRawValues([runRoot, extensionRoot], seed.rawValues);
  const result = {
    schemaVersion: "v3-media-session-capability-run/v1",
    runId,
    evidenceClass: "production_candidate",
    generatedAt: new Date().toISOString(),
    input: {
      buildTreeSha256: hashBuildTree(extensionRoot),
      portalRegistrySha256: sha256(fs.readFileSync(portalRegistryPath)),
      sessionPolicySha256: sha256(fs.readFileSync(sessionPolicyPath)),
      schemaSha256: sha256(fs.readFileSync(schemaPath)),
      anchorUrl,
      liveSeedEvidenceClass: "user_authorized_live_session_seed",
      liveSeedCookieCount: seed.cookies.length
    },
    serverInputValidation: {
      httpStatus: seeded.serverSession?.httpStatus ?? null,
      code: seeded.serverSession?.code ?? null,
      isLogin: seeded.serverSession?.isLogin === true,
      passed: serviceInputValid
    },
    segments: [anonymous, seeded],
    secretScan: {
      scannedFiles: rawValueScan.scannedFiles,
      hitCount: rawValueScan.hitCount,
      passed: rawValueScan.hitCount === 0
    },
    cleanup: {
      profilesDeleted: anonymous.cleanup.profileDeleted && seeded.cleanup.profileDeleted
    },
    passed: anonymous.passed && seeded.passed && serviceInputValid && rawValueScan.hitCount === 0
  };
  writeJson(path.join(runRoot, "result.json"), result);
  writeJson(path.join(runRoot, "secret-scan.json"), result.secretScan);
  seed.cookies.length = 0;
  seed.rawValues.length = 0;
  process.stdout.write(`${JSON.stringify({ runId, runRoot, passed: result.passed, serverInputValidation: result.serverInputValidation, segments: result.segments.map((segment) => ({ segmentId: segment.segmentId, passed: segment.passed, authorizationOutcome: segment.authorizationOutcome })), secretScan: result.secretScan }, null, 2)}\n`);
  if (!result.passed) process.exitCode = 2;
}

main().catch((error) => {
  writeJson(path.join(runRoot, "FAILED.json"), {
    schemaVersion: "v3-media-session-capability-failure/v1",
    runId,
    failedAt: new Date().toISOString(),
    error: error instanceof Error ? error.message : "collector failed"
  });
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 2;
});
