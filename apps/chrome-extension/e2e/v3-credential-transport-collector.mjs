import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import AxeBuilder from "@axe-core/playwright";
import { PNG } from "pngjs";
import { scanRootsForCredentialNeedles } from "./lib/v3CredentialSecretScan.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");
const appRoot = path.join(repoRoot, "apps/chrome-extension");
const extensionRoot = fs.realpathSync(process.env.NAVIA_V3_EXTENSION_ROOT || path.join(appRoot, "chrome-mv3-unpacked"));
const evidenceRoot = path.join(repoRoot, "docs/active/project/evidence/v3_media_companion/v3-1-page-session-baseline/v3-1.3-credential-transport");
const runId = process.env.NAVIA_V3_CREDENTIAL_RUN_ID || `v3-1.3-credential-${new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")}`;
const runRoot = path.join(evidenceRoot, "runs", runId);
const privateRoot = path.join(runRoot, "private");
const screenshotRoot = path.join(runRoot, "screenshots");
const cookieSeedPath = process.env.NAVIA_V3_BILIBILI_COOKIE_FILE || "/mnt/c/Users/Administrator/Desktop/myCk.txt";
const anchorUrl = "https://www.bilibili.com/video/BV1ZpYd66ELP";
const runtimeUrl = "http://127.0.0.1:17861";
const headless = process.env.NAVIA_V3_CREDENTIAL_HEADLESS !== "0";
const policyId = "bilibili-media-consent/v1";
const policyRevision = 1;
const adapterId = "bilibili";
const sessionAdapterId = "bilibili-cookie-session";
const credentialNameSetSha256 = "67166981712c0b024632614b43d1c7d4ecf7e23c2557b6f76dc58318a7530fc2";
const allowedCookieNames = new Set(["DedeUserID", "DedeUserID__ckMd5", "SESSDATA", "b_nut", "bili_jct", "buvid3", "buvid4", "buvid_fp", "sid"]);

const sha256 = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const ensure = (condition, message) => { if (!condition) throw new Error(message); };
let currentStage = "not-started";
const stage = (id) => {
  currentStage = id;
  process.stdout.write(`[v3-1.3-stage] ${id}\n`);
};

function confirmChromePermissionPrompt(profilePath) {
  ensure(!headless, "native permission confirmation requires visible Chrome");
  const profileName = path.basename(profilePath);
  ensure(/^navia-t01-profile-[a-f0-9]{12}$/.test(profileName), "unexpected disposable profile name");
  const script = [
    "$OutputEncoding = [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()",
    "Add-Type -AssemblyName UIAutomationClient",
    "Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public static class NaviaV3NativeInput { [DllImport(\"user32.dll\")] public static extern bool SetProcessDPIAware(); [DllImport(\"user32.dll\")] public static extern bool SetForegroundWindow(IntPtr hWnd); [DllImport(\"user32.dll\")] public static extern bool SetCursorPos(int X, int Y); [DllImport(\"user32.dll\")] public static extern void mouse_event(uint flags, uint dx, uint dy, uint data, UIntPtr extra); }'",
    "$null = [NaviaV3NativeInput]::SetProcessDPIAware()",
    `$profileName = '${profileName}'`,
    "$deadline = [DateTime]::UtcNow.AddSeconds(15)",
    "$confirmed = $false",
    "$candidateCount = 0",
    "$windowCandidateCount = 0",
    "$naviaWindowCandidateCount = 0",
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
    "          $candidateCount += 1",
    "          $parent = $element",
    "          $dialogName = ''",
    "          for ($index = 0; $index -lt 8; $index += 1) {",
    "            $parent = [System.Windows.Automation.TreeWalker]::ControlViewWalker.GetParent($parent)",
    "            if (-not $parent) { break }",
    "            if ($parent.Current.ControlType.ProgrammaticName -eq 'ControlType.Window') { $dialogName = $parent.Current.Name; $windowCandidateCount += 1; if ($dialogName -like '*Navia*') { $naviaWindowCandidateCount += 1 }; break }",
    "          }",
    "          if ($dialogName -like '*Navia*') {",
    "            $rect = $element.Current.BoundingRectangle",
    "            $x = [int]($rect.Left + ($rect.Width / 2))",
    "            $y = [int]($rect.Top + ($rect.Height / 2))",
    "            $null = [NaviaV3NativeInput]::SetForegroundWindow($process.MainWindowHandle)",
    "            Start-Sleep -Milliseconds 200",
    "            $null = [NaviaV3NativeInput]::SetCursorPos($x, $y)",
    "            [NaviaV3NativeInput]::mouse_event(0x0002, 0, 0, 0, [UIntPtr]::Zero)",
    "            Start-Sleep -Milliseconds 100",
    "            [NaviaV3NativeInput]::mouse_event(0x0004, 0, 0, 0, [UIntPtr]::Zero)",
    "            $confirmed = $true",
    "            break",
    "          }",
    "        }",
    "      }",
    "    }",
    "  }",
    "  if (-not $confirmed) { Start-Sleep -Milliseconds 200 }",
    "}",
    "if (-not $confirmed) { Write-Output ('native_permission_confirmed=false;candidateCount=' + $candidateCount + ';windowCandidateCount=' + $windowCandidateCount + ';naviaWindowCandidateCount=' + $naviaWindowCandidateCount); exit 2 }",
    "Write-Output 'native_permission_confirmed=true'"
  ].join("; ");
  const result = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], { encoding: "utf8", timeout: 20_000 });
  return {
    confirmed: result.status === 0 && result.stdout.includes("native_permission_confirmed=true"),
    diagnostic: result.stdout.trim().slice(0, 240)
  };
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true, mode: 0o700 });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
}

function readAuthorizedSeed() {
  ensure(fs.existsSync(cookieSeedPath), "authorized live-session seed is missing");
  const parsed = JSON.parse(fs.readFileSync(cookieSeedPath, "utf8"));
  ensure(Array.isArray(parsed), "authorized live-session seed must be a JSON array");
  const chromeCookies = [];
  const envelopeCredentials = [];
  const needles = [];
  for (const row of parsed) {
    if (!row || typeof row !== "object" || !allowedCookieNames.has(row.name) || typeof row.value !== "string" || !row.value) continue;
    const normalizedDomain = String(row.domain || "").toLowerCase().replace(/^\./, "");
    ensure(normalizedDomain === "bilibili.com" || normalizedDomain.endsWith(".bilibili.com"), "authorized seed contains a non-Bilibili domain");
    const sameSite = row.sameSite === "strict" ? "strict" : row.sameSite === "lax" ? "lax" : row.sameSite === "no_restriction" ? "no_restriction" : "unspecified";
    const expirationDate = Number.isFinite(row.expirationDate) ? row.expirationDate : null;
    chromeCookies.push({
      name: row.name,
      value: row.value,
      domain: ".bilibili.com",
      path: typeof row.path === "string" ? row.path : "/",
      httpOnly: row.httpOnly === true,
      secure: row.secure === true,
      ...(sameSite === "unspecified" ? {} : { sameSite: sameSite === "no_restriction" ? "None" : sameSite === "strict" ? "Strict" : "Lax" }),
      ...(expirationDate === null ? {} : { expires: expirationDate })
    });
    envelopeCredentials.push({
      name: row.name,
      value: row.value,
      domain: ".bilibili.com",
      path: typeof row.path === "string" ? row.path : "/",
      secure: row.secure === true,
      httpOnly: row.httpOnly === true,
      sameSite,
      expirationDate
    });
    if (Buffer.byteLength(row.value) >= 8) needles.push(Buffer.from(row.value));
  }
  ensure(chromeCookies.some((cookie) => cookie.name === "SESSDATA"), "authorized seed is missing the required credential");
  ensure(new Set(chromeCookies.map((cookie) => cookie.name)).size === 9, "authorized seed does not match the frozen nine-name registry");
  return { chromeCookies, envelopeCredentials, needles };
}

function startRuntime(extensionId, bearer, suffix) {
  const dbPath = path.join(privateRoot, `runtime-${suffix}.sqlite3`);
  const child = spawn("python3", ["-m", "uvicorn", "navia_runtime.app:app", "--host", "127.0.0.1", "--port", "17861", "--app-dir", "services/local-runtime"], {
    cwd: repoRoot,
    env: {
      ...process.env,
      NAVIA_DB_PATH: dbPath,
      NAVIA_LOCAL_FILES_TOKEN: bearer,
      NAVIA_LOCAL_FILES_EXTENSION_ID: extensionId
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let log = "";
  child.stdout.on("data", (chunk) => { log += chunk; });
  child.stderr.on("data", (chunk) => { log += chunk; });
  return {
    child,
    dbPath,
    stop: async () => {
      if (child.exitCode === null) {
        child.kill("SIGTERM");
        await Promise.race([new Promise((resolve) => child.once("exit", resolve)), wait(5_000)]);
        if (child.exitCode === null) child.kill("SIGKILL");
      }
      fs.writeFileSync(path.join(privateRoot, `runtime-${suffix}.log`), log, { mode: 0o600 });
    }
  };
}

async function waitForRuntime(timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${runtimeUrl}/v1/health`);
      if (response.ok) return;
    } catch {}
    await wait(200);
  }
  throw new Error("Runtime did not become healthy");
}

async function requestJson(pathname, { method = "GET", origin, authorization, body } = {}) {
  const response = await fetch(`${runtimeUrl}${pathname}`, {
    method,
    headers: {
      ...(origin ? { Origin: origin } : {}),
      ...(authorization ? { Authorization: authorization } : {}),
      ...(body === undefined ? {} : { "Content-Type": "application/json" })
    },
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body)
  });
  let value = null;
  try { value = await response.json(); } catch {}
  return { status: response.status, cacheControl: response.headers.get("cache-control"), value };
}

function publicFailure(response) {
  return response?.value?.error?.code ?? null;
}

async function issueChannel({ bearer, origin, binding, taskId = `media_task_${crypto.randomBytes(16).toString("hex")}`, mutation = {} }) {
  const body = {
    taskId,
    adapterId,
    policyId,
    policyRevision,
    browserSessionBindingSha256: binding,
    credentialNameSetSha256,
    ...mutation
  };
  const response = await requestJson("/v1/media/credential-channels", {
    method: "POST",
    origin,
    authorization: `Bearer ${bearer}`,
    body
  });
  return { body, response, token: response.value?.data?.channelToken ?? null, channel: response.value?.data?.channel ?? null };
}

function envelopeFor(channel, credentials, options = {}) {
  const localNow = Date.now();
  const channelIssued = Date.parse(channel.issuedAt);
  const channelExpiry = Date.parse(channel.expiresAt);
  ensure(Number.isFinite(channelIssued) && Number.isFinite(channelExpiry) && channelIssued < channelExpiry, "channel has an invalid time window");
  const issuedAt = Math.max(localNow, channelIssued);
  return {
    schemaVersion: "BilibiliCredentialEnvelope/v1",
    envelopeId: options.envelopeId ?? `pce_${crypto.randomBytes(16).toString("hex")}`,
    channelId: channel.channelId,
    taskId: channel.taskId,
    adapterId: channel.adapterId,
    sessionAdapterId,
    policyId: channel.policyId,
    policyRevision: channel.policyRevision,
    browserSessionBindingSha256: channel.browserSessionBindingSha256,
    credentialNameSetSha256: channel.credentialNameSetSha256,
    issuedAt: new Date(issuedAt).toISOString(),
    expiresAt: new Date(Math.min(channelExpiry - 250, issuedAt + 15_000)).toISOString(),
    credentials,
    ...options.mutation
  };
}

async function createDirectLease(channelIssue, credentials, origin, envelopeOptions = {}) {
  const envelope = envelopeFor(channelIssue.channel, credentials, envelopeOptions);
  const response = await requestJson("/v1/media/credential-leases", {
    method: "POST",
    origin,
    authorization: `Navia-Media-Channel ${channelIssue.token}`,
    body: envelope
  });
  return { response, envelopeId: envelope.envelopeId };
}

async function extensionIdentity(worker) {
  return worker.evaluate(() => ({ id: chrome.runtime.id }));
}

async function activeBilibiliTabId(worker) {
  return worker.evaluate(async () => (await chrome.tabs.query({})).find((tab) => tab.url?.startsWith("https://www.bilibili.com/video/"))?.id ?? null);
}

async function diagnostics(worker) {
  return worker.evaluate(() => globalThis.__naviaE2EMediaSessionDiagnostics?.() ?? null);
}

async function capture(page, name) {
  const filePath = path.join(screenshotRoot, name);
  const viewport = page.viewportSize();
  ensure(viewport, `viewport is unavailable for ${name}`);
  await page.screenshot({ path: filePath, fullPage: false });
  const bytes = fs.readFileSync(filePath);
  const decoded = PNG.sync.read(bytes);
  ensure(decoded.width === viewport.width && decoded.height === viewport.height, `${name} is ${decoded.width}x${decoded.height}, expected ${viewport.width}x${viewport.height}`);
  const layout = await page.evaluate(() => ({
    rootScrollWidth: document.documentElement.scrollWidth,
    rootClientWidth: document.documentElement.clientWidth
  }));
  return {
    file: name,
    sha256: sha256(bytes),
    viewport,
    ...layout,
    rootOverflowFree: layout.rootScrollWidth <= layout.rootClientWidth
  };
}

function windowsPath(filePath) {
  const result = spawnSync("wslpath", ["-w", filePath], { encoding: "utf8" });
  ensure(result.status === 0, "wslpath failed for native Side Panel capture");
  return result.stdout.trim();
}

function windowsChromeCommand(profilePath, commands) {
  const profileName = path.basename(profilePath).replaceAll("'", "''");
  const script = [
    "$ErrorActionPreference='Stop'",
    "Add-Type -AssemblyName System.Drawing",
    "Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public static class NaviaV3Native { [StructLayout(LayoutKind.Sequential)] public struct Rect { public int Left; public int Top; public int Right; public int Bottom; } [DllImport(\"user32.dll\")] public static extern bool SetProcessDPIAware(); [DllImport(\"user32.dll\")] public static extern bool GetWindowRect(IntPtr hWnd, out Rect rect); [DllImport(\"user32.dll\")] public static extern bool SystemParametersInfo(uint action, uint param, out Rect rect, uint update); [DllImport(\"user32.dll\")] public static extern bool SetForegroundWindow(IntPtr hWnd); [DllImport(\"user32.dll\")] public static extern bool ShowWindow(IntPtr hWnd, int command); [DllImport(\"user32.dll\")] public static extern bool MoveWindow(IntPtr hWnd, int x, int y, int width, int height, bool repaint); [DllImport(\"user32.dll\")] public static extern bool SetWindowPos(IntPtr hWnd, IntPtr insertAfter, int x, int y, int width, int height, uint flags); [DllImport(\"user32.dll\")] public static extern bool SetCursorPos(int X, int Y); [DllImport(\"user32.dll\")] public static extern void mouse_event(uint flags, uint dx, uint dy, uint data, UIntPtr extra); }'",
    "$null=[NaviaV3Native]::SetProcessDPIAware()",
    `$profileName='${profileName}'`,
    "$processInfo=Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'chrome.exe' -and $_.CommandLine -and $_.CommandLine.Contains($profileName) -and -not $_.CommandLine.Contains('--type=') } | Select-Object -First 1",
    "if (-not $processInfo) { throw 'V3 Chrome main process not found' }",
    "$process=Get-Process -Id $processInfo.ProcessId",
    "$handle=$process.MainWindowHandle",
    "$null=[NaviaV3Native]::ShowWindow($handle,9)",
    "$rect=New-Object NaviaV3Native+Rect",
    "if ($handle -eq 0 -or -not [NaviaV3Native]::GetWindowRect($handle,[ref]$rect)) { throw 'V3 Chrome bounds unavailable' }",
    "$null=[NaviaV3Native]::SetForegroundWindow($handle)",
    "$null=[NaviaV3Native]::SetWindowPos($handle,[IntPtr](-1),0,0,0,0,0x0003)",
    ...commands,
    "$null=[NaviaV3Native]::SetWindowPos($handle,[IntPtr](-2),0,0,0,0,0x0003)"
  ].join("; ");
  const result = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], {
    encoding: "utf8",
    timeout: 30_000
  });
  if (result.status !== 0) {
    const safeFailure = String(result.stderr || result.stdout || "unknown failure")
      .replace(/navia-t01-profile-[A-Za-z0-9_-]+/g, "<profile>")
      .replace(/[A-Za-z]:\\[^\r\n]+/g, "<path>")
      .split(/\r?\n/, 1)[0]
      .slice(0, 240);
    throw new Error(`Windows native Side Panel operation failed (status=${result.status}; ${safeFailure})`);
  }
  return result.stdout.trim();
}

class RawCdpTarget {
  constructor(socket) {
    this.socket = socket;
    this.nextMessageId = 0;
    this.pending = new Map();
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));
      if (!message.id) return;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      clearTimeout(pending.timeoutId);
      if (message.error) pending.reject(new Error(message.error.message));
      else pending.resolve(message.result);
    });
    const rejectPending = () => {
      for (const [id, pending] of this.pending) {
        clearTimeout(pending.timeoutId);
        pending.reject(new Error("native Side Panel CDP target closed"));
        this.pending.delete(id);
      }
    };
    socket.addEventListener("close", rejectPending);
    socket.addEventListener("error", rejectPending);
  }

  static async connect(port, urlFragment, timeoutMs = 15_000) {
    ensure(Number.isInteger(port), "native Side Panel CDP port is unavailable");
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then((response) => response.json());
      const target = targets
        .filter((item) => String(item.url).includes(urlFragment) && !String(item.url).includes("naviaInPage=1") && item.webSocketDebuggerUrl)
        .sort((left, right) => Number(String(right.url).includes("naviaE2ETabId=")) - Number(String(left.url).includes("naviaE2ETabId=")))[0];
      if (target) {
        const socket = new WebSocket(target.webSocketDebuggerUrl);
        await new Promise((resolve, reject) => {
          socket.addEventListener("open", resolve, { once: true });
          socket.addEventListener("error", reject, { once: true });
        });
        return new RawCdpTarget(socket);
      }
      await wait(200);
    }
    throw new Error(`native Side Panel CDP target not found: ${urlFragment}`);
  }

  send(method, params = {}, timeoutMs = 10_000) {
    const id = ++this.nextMessageId;
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`native Side Panel CDP command timed out: ${method}`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timeoutId });
      try {
        this.socket.send(JSON.stringify({ id, method, params }));
      } catch (error) {
        clearTimeout(timeoutId);
        this.pending.delete(id);
        reject(error);
      }
    });
  }

  async evaluate(expression) {
    const response = await this.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (response.exceptionDetails) throw new Error(response.exceptionDetails.text || "CDP evaluation failed");
    return response.result?.value;
  }

  async clickTestId(testId) {
    const point = await this.evaluate(`(() => { const element = document.querySelector(${JSON.stringify(`[data-testid='${testId}']`)}); if (!element) return { missing: true }; element.scrollIntoView({ block: "center", inline: "nearest" }); const rect = element.getBoundingClientRect(); return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, disabled: Boolean(element.disabled), width: innerWidth, height: innerHeight }; })()`);
    ensure(point && !point.missing && !point.disabled, `native Side Panel target is unavailable: ${testId}`);
    await this.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: point.x, y: point.y });
    await this.send("Input.dispatchMouseEvent", { type: "mousePressed", x: point.x, y: point.y, button: "left", clickCount: 1 });
    await this.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: point.x, y: point.y, button: "left", clickCount: 1 });
  }

  close() {
    this.socket.close();
  }
}

async function resizeNativeSidePanel(target, profilePath, desiredWidth, desiredHeight) {
  let metrics = await target.evaluate("({ width: innerWidth, height: innerHeight, scale: devicePixelRatio || 1 })");
  let nativeResizeDiagnostic = "not_required";
  if (Number(metrics.height) !== desiredHeight) {
    const physicalHeightDelta = Math.round((desiredHeight - Number(metrics.height)) * Number(metrics.scale));
    nativeResizeDiagnostic = windowsChromeCommand(profilePath, [
      "$width=$rect.Right-$rect.Left",
      "$height=($rect.Bottom-$rect.Top)+" + physicalHeightDelta,
      `$targetY=$rect.Top-${physicalHeightDelta}`,
      "$moved=[NaviaV3Native]::MoveWindow($handle,$rect.Left,$targetY,$width,$height,$true)",
      "if (-not $moved) { throw 'V3 Chrome resize failed' }",
      "Start-Sleep -Milliseconds 500",
      "$resized=New-Object NaviaV3Native+Rect",
      "$null=[NaviaV3Native]::GetWindowRect($handle,[ref]$resized)",
      "Write-Output ('moved=' + $moved + ';rect=' + $resized.Left + ',' + $resized.Top + ',' + $resized.Right + ',' + $resized.Bottom)"
    ]);
    await wait(750);
  }

  const splitterInsets = [60, 56, 64, 52, 68, 48, 72, 44, 76, 40, 80, 36, 84, 32, 88, 28, 92, 24, 96, 20, 100];
  for (const splitterInset of splitterInsets) {
    metrics = await target.evaluate("({ width: innerWidth, height: innerHeight, scale: devicePixelRatio || 1 })");
    if (Number(metrics.width) === desiredWidth) break;
    windowsChromeCommand(profilePath, [
      `$current=${Number(metrics.width)}`,
      `$desired=${desiredWidth}`,
      `$scale=${Number(metrics.scale)}`,
      `$splitterInset=${splitterInset}`,
      "$startX=$rect.Right-[Math]::Round($current*$scale)-$splitterInset",
      "$endX=$startX+[Math]::Round(($current-$desired)*$scale)",
      "$y=$rect.Top+[Math]::Round(($rect.Bottom-$rect.Top)/2)",
      "$null=[NaviaV3Native]::SetCursorPos($startX,$y)",
      "Start-Sleep -Milliseconds 180",
      "[NaviaV3Native]::mouse_event(0x0002,0,0,0,[UIntPtr]::Zero)",
      "Start-Sleep -Milliseconds 120",
      "$null=[NaviaV3Native]::SetCursorPos($endX,$y)",
      "Start-Sleep -Milliseconds 180",
      "[NaviaV3Native]::mouse_event(0x0004,0,0,0,[UIntPtr]::Zero)"
    ]);
    await wait(650);
  }
  metrics = await target.evaluate("({ width: innerWidth, height: innerHeight, scale: devicePixelRatio || 1 })");
  ensure(
    Number(metrics.width) === desiredWidth && Number(metrics.height) === desiredHeight,
    `native Side Panel viewport is ${metrics.width}x${metrics.height}, expected ${desiredWidth}x${desiredHeight}; ${nativeResizeDiagnostic}`
  );
  return { width: desiredWidth, height: desiredHeight, devicePixelRatio: Number(metrics.scale) };
}

async function captureNativeSidePanel(target, profilePath, name, width, height) {
  const viewport = await resizeNativeSidePanel(target, profilePath, width, height);
  ensure(viewport.devicePixelRatio === 1, `native Side Panel DPR is ${viewport.devicePixelRatio}, expected 1`);
  const filePath = path.join(screenshotRoot, name);
  const nativePath = windowsPath(filePath).replaceAll("'", "''");
  const nativeCaptureDiagnostic = windowsChromeCommand(profilePath, [
    `$cssWidth=${width}`,
    `$cssHeight=${height}`,
    `$scale=${viewport.devicePixelRatio}`,
    "$captureWidth=[Math]::Round($cssWidth*$scale)",
    "$captureHeight=[Math]::Round($cssHeight*$scale)",
    "$sourceX=$rect.Right-$captureWidth",
    "$sourceY=$rect.Bottom-$captureHeight",
    "$source=New-Object -TypeName System.Drawing.Bitmap -ArgumentList ([int]$captureWidth),([int]$captureHeight)",
    "$sourceGraphics=[System.Drawing.Graphics]::FromImage($source)",
    "try {",
    "  $sourceGraphics.CopyFromScreen($sourceX,$sourceY,0,0,$source.Size)",
    `  $source.Save('${nativePath}',[System.Drawing.Imaging.ImageFormat]::Png)`,
    `  if (-not (Test-Path -LiteralPath '${nativePath}')) { throw 'native screenshot was not written' }`,
    "  Write-Output ('capture=' + $sourceX + ',' + $sourceY + ',' + $captureWidth + ',' + $captureHeight)",
    "} finally {",
    "  $sourceGraphics.Dispose()",
    "  $source.Dispose()",
    "}"
  ]);
  ensure(fs.existsSync(filePath), `native Side Panel screenshot is missing after capture; ${nativeCaptureDiagnostic}`);
  const bytes = fs.readFileSync(filePath);
  const decoded = PNG.sync.read(bytes);
  ensure(decoded.width === width && decoded.height === height, `native Side Panel screenshot is ${decoded.width}x${decoded.height}, expected ${width}x${height}`);
  const layout = await target.evaluate("({ rootScrollWidth: document.documentElement.scrollWidth, rootClientWidth: document.documentElement.clientWidth })");
  fs.chmodSync(filePath, 0o600);
  return {
    file: name,
    sha256: sha256(bytes),
    viewport: { width, height },
    devicePixelRatio: viewport.devicePixelRatio,
    captureMode: "windows_native_surface_css_pixel_projection",
    surface: "native_side_panel",
    ...layout,
    rootOverflowFree: Number(layout.rootScrollWidth) <= Number(layout.rootClientWidth)
  };
}

async function nativeAxeObservation(target) {
  const axePlaywrightEntry = fileURLToPath(import.meta.resolve("@axe-core/playwright"));
  const axeSourcePath = path.resolve(path.dirname(axePlaywrightEntry), "../../../axe-core/axe.min.js");
  ensure(fs.existsSync(axeSourcePath), "axe-core runtime is unavailable");
  const axeSource = fs.readFileSync(axeSourcePath, "utf8");
  await target.evaluate(`(0, eval)(${JSON.stringify(axeSource)})`);
  return target.evaluate(`axe.run(document).then((result) => ({ serious: result.violations.filter((item) => item.impact === "serious").length, critical: result.violations.filter((item) => item.impact === "critical").length }))`);
}

async function nativeKeyboardObservation(target) {
  await target.evaluate("document.body.tabIndex=-1; document.body.focus(); true");
  const reachableTestIds = [];
  for (let index = 0; index < 80; index += 1) {
    await target.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9 });
    await target.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9 });
    const active = await target.evaluate("document.activeElement instanceof HTMLElement ? document.activeElement.dataset.testid ?? null : null");
    if (active && !reachableTestIds.includes(active)) reachableTestIds.push(active);
  }
  return {
    surface: "native_side_panel",
    reachableTestIds,
    passed: ["media-consent-refresh", "media-consent-revoke", "media-credential-start"].every((id) => reachableTestIds.includes(id))
  };
}

async function axeObservation(page) {
  const result = await new AxeBuilder({ page }).analyze();
  return {
    serious: result.violations.filter((item) => item.impact === "serious").length,
    critical: result.violations.filter((item) => item.impact === "critical").length
  };
}

async function pageKeyboardObservation(page) {
  await page.evaluate(() => {
    document.body.tabIndex = -1;
    document.body.focus();
  });
  const reachableTestIds = [];
  for (let index = 0; index < 40; index += 1) {
    await page.keyboard.press("Tab");
    const active = await page.evaluate(() => document.activeElement instanceof HTMLElement ? document.activeElement.dataset.testid ?? null : null);
    if (active && !reachableTestIds.includes(active)) reachableTestIds.push(active);
  }
  return {
    surface: "workspace",
    reachableTestIds,
    passed: ["media-consent-refresh", "media-consent-revoke", "media-credential-start"].every((id) => reachableTestIds.includes(id))
  };
}

async function connectRuntime(page, bearer) {
  const input = page.locator("[data-testid='local-runtime-token-input']");
  if (await input.count()) await input.fill(bearer, { timeout: 15_000 });
  const button = page.locator("[data-testid='local-runtime-connect']");
  if (await button.count()) await button.click({ timeout: 15_000 });
  await page.getByText("本页面会话已认证", { exact: true }).waitFor({ timeout: 20_000 });
}

async function credentialPermissionState(worker) {
  return worker.evaluate(async () => ({
    named: await chrome.permissions.contains({ permissions: ["cookies"] }),
    host: await chrome.permissions.contains({ origins: ["https://*.bilibili.com/*"] })
  }));
}

async function grantPolicy(page, profilePath, worker) {
  const before = await credentialPermissionState(worker);
  const authorize = page.locator("[data-testid='media-consent-authorize']");
  if (await authorize.count()) await authorize.click({ timeout: 15_000 });
  const nativePromptRequired = !before.named || !before.host;
  const nativePrompt = nativePromptRequired ? confirmChromePermissionPrompt(profilePath) : { confirmed: false, diagnostic: "not_required" };
  if (nativePromptRequired && !nativePrompt.confirmed) await page.waitForTimeout(1_000);
  const after = await credentialPermissionState(worker);
  ensure(
    after.named && after.host,
    `credential permissions are not granted after policy authorization; ${nativePrompt.diagnostic}; afterNamed=${after.named};afterHost=${after.host}`
  );
  await page.getByText("已检测会话候选", { exact: true }).waitFor({ timeout: 20_000 });
  return {
    before,
    after,
    nativePromptRequired,
    nativePromptConfirmed: nativePrompt.confirmed,
    browserAutoGranted: nativePromptRequired && !nativePrompt.confirmed && after.named && after.host
  };
}

async function establishFromUi(page, expected = "会话租约已就绪") {
  await page.locator("[data-testid='media-credential-start']").click({ timeout: 15_000 });
  await page.getByText(expected, { exact: true }).waitFor({ timeout: 20_000 });
  return page.evaluate(() => document.activeElement instanceof HTMLElement ? document.activeElement.dataset.testid ?? null : null);
}

async function connectNativeRuntime(driver, target, bearer) {
  await driver.fill("local-runtime-token-input", bearer);
  await target.clickTestId("local-runtime-connect");
  await driver.waitForText("local-runtime-status", "本页面会话已认证", 20_000);
}

async function establishFromNativeUi(driver, target, expected = "会话租约已就绪") {
  await target.clickTestId("media-credential-start");
  await driver.waitForText("media-credential-card", expected, 20_000);
  return target.evaluate("document.activeElement instanceof HTMLElement ? document.activeElement.dataset.testid ?? null : null");
}

async function contentSenderProbe(host) {
  return host.evaluate(() => new Promise((resolve) => {
    const probeId = crypto.randomUUID();
    const timeout = setTimeout(() => resolve({ ok: false, failureCode: "PROBE_TIMEOUT" }), 10_000);
    const listener = (event) => {
      if (event.source !== window || event.data?.type !== "navia.e2e.mediaCredential.senderProbeResult" || event.data?.probeId !== probeId) return;
      clearTimeout(timeout);
      window.removeEventListener("message", listener);
      resolve({ ok: event.data.ok, failureCode: event.data.failureCode });
    };
    window.addEventListener("message", listener);
    window.postMessage({ type: "navia.e2e.mediaCredential.senderProbe", command: "get_browser_session_binding", probeId }, window.location.origin);
  }));
}

async function runtimeMessage(page, message, timeoutMs = 10_000) {
  return page.evaluate(async ({ payload, timeout }) => Promise.race([
    chrome.runtime.sendMessage(payload),
    new Promise((resolve) => setTimeout(() => resolve({ ok: false, failureCode: "MESSAGE_TIMEOUT" }), timeout))
  ]), { payload: message, timeout: timeoutMs });
}

async function genericProxyAttacks(page) {
  return page.evaluate(async () => {
    const paths = ["/v1/media/credential-channels", "/v1/media/credential-leases", `/v1/media/credential-leases/pcl_${"a".repeat(32)}`];
    const results = [];
    for (const path of paths) {
      const response = await Promise.race([
        chrome.runtime.sendMessage({ type: "navia.runtimeFetch", request: { path, method: "POST" } }),
        new Promise((resolve) => setTimeout(() => resolve({ ok: false, error: "MESSAGE_TIMEOUT" }), 5_000))
      ]);
      results.push({ ok: response?.ok === true, error: response?.error ?? null });
    }
    return results;
  });
}

async function storageNeedleCount(page, worker, needles) {
  const extensionStorage = await worker.evaluate(() => chrome.storage.local.get(null));
  const documentStorage = await page.evaluate(async () => ({
    localStorage: Object.entries(localStorage),
    sessionStorage: Object.entries(sessionStorage),
    indexedDbNames: typeof indexedDB.databases === "function" ? (await indexedDB.databases()).map((entry) => entry.name ?? "") : []
  }));
  const bytes = Buffer.from(JSON.stringify({ extensionStorage, documentStorage }));
  return needles.filter((needle) => bytes.includes(needle)).length;
}

async function main() {
  fs.rmSync(runRoot, { recursive: true, force: true });
  fs.mkdirSync(privateRoot, { recursive: true, mode: 0o700 });
  fs.mkdirSync(screenshotRoot, { recursive: true, mode: 0o700 });
  ensure(fs.existsSync(path.join(extensionRoot, "manifest.json")), "E2E extension build is missing");
  const seed = readAuthorizedSeed();
  const runtimeBearer = crypto.randomBytes(32).toString("base64url");
  const binding = sha256(crypto.randomBytes(32));
  const profileSuffix = sha256(Buffer.from(runId)).slice(0, 12);
  const profilePath = path.join(repoRoot, ".tmp", `navia-t01-profile-${profileSuffix}`);
  fs.rmSync(profilePath, { recursive: true, force: true });
  process.env.NAVIA_T01_EVIDENCE_ROOT = runRoot;
  process.env.NAVIA_T01_RUN_ID = runId;
  process.env.NAVIA_T01_EXTENSION_ROOT = extensionRoot;
  process.env.NAVIA_T01_HEADLESS = headless ? "1" : "0";
  process.env.NAVIA_T01_FORCE_DEVICE_SCALE_FACTOR = "1";
  const helpers = await import(`./chrome-v2-t01-r1-frontend.mjs?v3credential=${Date.now()}`);
  let browser = null;
  let runtime = null;
  const observations = [];
  const screenshots = [];
  const accessibility = [];
  const keyboard = [];
  const publicRecords = { channel: null, lease: null };
  let profileDeleted = false;
  try {
    stage("launch-browser");
    browser = await helpers.launchExtension(profilePath);
    await browser.context.addCookies(seed.chromeCookies);
    let host = await browser.context.newPage();
    await host.goto(anchorUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await host.waitForTimeout(2_000);
    let worker = await helpers.extensionWorker(browser.context);
    const identity = await extensionIdentity(worker);
    const origin = `chrome-extension://${identity.id}`;
    const tabId = await activeBilibiliTabId(worker);
    ensure(Number.isInteger(tabId), "Bilibili tab id unavailable");
    let workspace = await browser.context.newPage();
    await workspace.setViewportSize({ width: 768, height: 900 });
    await workspace.goto(`${origin}/workspace.html#/media/current`, { waitUntil: "domcontentloaded" });
    await workspace.locator("[data-testid='media-workspace-root']").waitFor({ timeout: 20_000 });
    const nativePanelOpen = await helpers.openNativeSidePanel(browser.context, worker, host);
    const nativePanelDriver = helpers.createSidePanelDriver(nativePanelOpen.page, worker);
    await nativePanelDriver.waitForCount("media-consent-card", 1, 20_000);
    let nativePanelTarget = await RawCdpTarget.connect(browser.cdpPort, "/sidepanel.html");
    stage("weak-runtime");
    const weakRuntime = startRuntime(identity.id, "weak", "weak");
    await waitForRuntime();
    const weak = await requestJson("/v1/media/credential-channels", {
      method: "POST", origin, authorization: "Bearer weak", body: {
        taskId: `media_task_${crypto.randomBytes(16).toString("hex")}`, adapterId, policyId, policyRevision,
        browserSessionBindingSha256: binding, credentialNameSetSha256
      }
    });
    observations.push({ id: "V3-1.3-A03-weak", passed: publicFailure(weak) === "V3_MEDIA_RUNTIME_AUTH_REQUIRED", failureCode: publicFailure(weak) });
    await weakRuntime.stop();

    stage("strong-runtime-and-auth-negatives");
    runtime = startRuntime(identity.id, runtimeBearer, "strong-a");
    await waitForRuntime();
    const missingAuth = await requestJson("/v1/media/credential-channels", { method: "POST", origin, body: {} });
    const wrongAuth = await requestJson("/v1/media/credential-channels", { method: "POST", origin, authorization: "Bearer wrong", body: {} });
    const missingOrigin = await requestJson("/v1/media/credential-channels", { method: "POST", authorization: `Bearer ${runtimeBearer}`, body: {} });
    const wrongOrigin = await requestJson("/v1/media/credential-channels", { method: "POST", origin: `chrome-extension://${"b".repeat(32)}`, authorization: `Bearer ${runtimeBearer}`, body: {} });
    observations.push({ id: "V3-1.3-A03-auth", passed: [missingAuth, wrongAuth].every((item) => publicFailure(item) === "V3_MEDIA_RUNTIME_AUTH_REQUIRED") });
    observations.push({ id: "V3-1.3-A04-origin", passed: publicFailure(missingOrigin) === "V3_MEDIA_RUNTIME_ORIGIN_MISMATCH" && publicFailure(wrongOrigin) === "V3_MEDIA_RUNTIME_ORIGIN_MISMATCH" });

    stage("sender-and-proxy-negatives");
    stage("content-sender-negative");
    const contentProbe = await contentSenderProbe(host);
    observations.push({ id: "V3-1.3-A06-content-sender", passed: contentProbe.ok === false && contentProbe.failureCode === "V3_MEDIA_POLICY_NOT_GRANTED", failureCode: contentProbe.failureCode });
    stage("generic-proxy-negatives");
    const generic = await genericProxyAttacks(workspace);
    observations.push({ id: "V3-1.3-A07-generic-proxy", passed: generic.length === 3 && generic.every((item) => item.ok === false && item.error === "V3_MEDIA_CREDENTIAL_TRANSPORT_FAILED"), attempts: generic.length });
    const sidePanelTab = await browser.context.newPage();
    await sidePanelTab.goto(`${origin}/sidepanel.html?naviaE2ETabId=${tabId}`, { waitUntil: "domcontentloaded" });
    const sidePanelTabProbe = await runtimeMessage(sidePanelTab, { type: "navia.mediaCredential", command: "get_browser_session_binding" });
    observations.push({ id: "V3-1.3-A06-sidepanel-tab", passed: sidePanelTabProbe?.ok === false && sidePanelTabProbe?.failureCode === "V3_MEDIA_POLICY_NOT_GRANTED", failureCode: sidePanelTabProbe?.failureCode ?? null });
    await sidePanelTab.close();

    stage("trusted-binding-and-denied-exchange");
    const bindingResponse = await runtimeMessage(workspace, { type: "navia.mediaCredential", command: "get_browser_session_binding" });
    ensure(bindingResponse?.ok === true, "trusted document could not obtain browser session binding");
    const browserBinding = bindingResponse.value.browserSessionBindingSha256;
    const deniedIssue = await issueChannel({ bearer: runtimeBearer, origin, binding: browserBinding });
    const deniedBefore = await diagnostics(worker);
    const deniedExchange = await runtimeMessage(workspace, { type: "navia.mediaCredential", command: "exchange_channel", channelToken: deniedIssue.token, channel: deniedIssue.channel });
    const deniedAfter = await diagnostics(worker);
    observations.push({ id: "V3-1.3-A08-policy-denied", passed: deniedExchange?.ok === false && deniedExchange?.failureCode === "V3_MEDIA_POLICY_NOT_GRANTED" && deniedBefore.credentialCookieReadCount === deniedAfter.credentialCookieReadCount });

    stage("grant-connect-and-required-cookie-negative");
    const initialGrant = await grantPolicy(workspace, profilePath, worker);
    observations.push({
      id: "V3-1.3-A05-native-permission",
      passed: initialGrant.nativePromptRequired && initialGrant.nativePromptConfirmed && initialGrant.after.named && initialGrant.after.host
    });
    await nativePanelTarget.evaluate("location.reload(); true").catch(() => undefined);
    nativePanelTarget.close();
    await helpers.waitForSidePanelBridge(worker, 20_000);
    nativePanelTarget = await RawCdpTarget.connect(browser.cdpPort, "/sidepanel.html");
    await nativePanelDriver.waitForText("media-consent-card", "已检测会话候选", 20_000);
    await connectNativeRuntime(nativePanelDriver, nativePanelTarget, runtimeBearer);
    await connectRuntime(workspace, runtimeBearer);
    const missingRequired = seed.chromeCookies.find((cookie) => cookie.name === "SESSDATA");
    await worker.evaluate(() => chrome.cookies.remove({ url: "https://www.bilibili.com/", name: "SESSDATA" }));
    const missingBefore = await diagnostics(worker);
    await establishFromUi(workspace, "安全会话建立失败");
    const missingAfter = await diagnostics(worker);
    observations.push({ id: "V3-1.3-A08-required-missing", passed: missingAfter.credentialCookieReadCount === missingBefore.credentialCookieReadCount + 1 && missingAfter.credentialRevocationHandleCount === 0 });
    await browser.context.addCookies([missingRequired]);
    await workspace.locator("[data-testid='media-consent-refresh']").click();
    await workspace.getByText("已检测会话候选", { exact: true }).waitFor({ timeout: 20_000 });

    stage("sidepanel-positive");
    await host.bringToFront();
    await wait(750);
    await helpers.waitForSidePanelBridge(worker, 20_000);
    nativePanelTarget.close();
    nativePanelTarget = await RawCdpTarget.connect(browser.cdpPort, "/sidepanel.html");
    const positiveBefore = await diagnostics(worker);
    let focusAfterReady;
    try {
      focusAfterReady = await establishFromNativeUi(nativePanelDriver, nativePanelTarget);
    } catch (error) {
      const safeDiagnostic = await diagnostics(worker);
      throw new Error(`${error instanceof Error ? error.message : "native Side Panel establishment failed"}; credentialDiagnostic=${JSON.stringify(safeDiagnostic?.credentialLastFailure ?? null)}`);
    }
    const positiveAfter = await diagnostics(worker);
    observations.push({
      id: "V3-1.3-A05-A09-sidepanel-positive",
      passed: positiveAfter.credentialCookieReadCount === positiveBefore.credentialCookieReadCount + 1
        && positiveAfter.credentialRevocationHandleCount === positiveBefore.credentialRevocationHandleCount + 1
        && focusAfterReady === "media-credential-start",
      cookieReads: positiveAfter.credentialCookieReadCount - positiveBefore.credentialCookieReadCount,
      publicHandleDelta: positiveAfter.credentialRevocationHandleCount - positiveBefore.credentialRevocationHandleCount
    });
    screenshots.push(await captureNativeSidePanel(nativePanelTarget, profilePath, "sidepanel-ready-360x900.png", 360, 900));
    accessibility.push({ surface: "sidepanel-360", ...(await nativeAxeObservation(nativePanelTarget)) });
    keyboard.push(await nativeKeyboardObservation(nativePanelTarget));
    screenshots.push(await captureNativeSidePanel(nativePanelTarget, profilePath, "sidepanel-ready-420x900.png", 420, 900));
    accessibility.push({ surface: "sidepanel-420", ...(await nativeAxeObservation(nativePanelTarget)) });

    stage("workspace-positive");
    const workspaceBefore = await diagnostics(worker);
    const workspaceFocus = await establishFromUi(workspace);
    const workspaceAfter = await diagnostics(worker);
    observations.push({ id: "V3-1.3-A09-workspace-positive", passed: workspaceAfter.credentialCookieReadCount === workspaceBefore.credentialCookieReadCount + 1 && workspaceFocus === "media-credential-start" });
    keyboard.push(await pageKeyboardObservation(workspace));
    screenshots.push(await capture(workspace, "workspace-ready-768x900.png"));
    accessibility.push({ surface: "workspace-768", ...(await axeObservation(workspace)) });
    await workspace.setViewportSize({ width: 1280, height: 900 });
    screenshots.push(await capture(workspace, "workspace-ready-1280x900.png"));
    accessibility.push({ surface: "workspace-1280", ...(await axeObservation(workspace)) });
    observations.push({
      id: "V3-1.3-A20-ui",
      passed: accessibility.every((item) => item.serious === 0 && item.critical === 0)
        && keyboard.every((item) => item.passed)
        && screenshots.every((item) => item.rootOverflowFree)
        && screenshots.length === 4
    });

    stage("transport-faults-and-fresh-channel-recovery");
    const faultModes = [
      { id: "network_abort", handler: (route) => route.abort("failed") },
      { id: "runtime_5xx", handler: (route) => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ ok: false, error: { code: "V3_MEDIA_CREDENTIAL_TRANSPORT_FAILED" } }) }) },
      { id: "response_loss", handler: async (route) => {
        try { await route.fetch({ timeout: 15_000 }); } finally { await route.abort("failed"); }
      } }
    ];
    for (const mode of faultModes) {
      let attempts = 0;
      const handler = async (route) => { attempts += 1; await mode.handler(route); };
      await browser.context.route(`${runtimeUrl}/v1/media/credential-leases`, handler, { times: 1 });
      try {
        await establishFromUi(workspace, "安全会话建立失败");
        await workspace.waitForTimeout(500);
      } finally {
        await browser.context.unroute(`${runtimeUrl}/v1/media/credential-leases`, handler);
      }
      observations.push({ id: `V3-1.3-A13-${mode.id}`, passed: attempts === 1, requestAttemptCount: attempts });
    }
    const recoveryBefore = await diagnostics(worker);
    const recoveryFocus = await establishFromUi(workspace);
    const recoveryAfter = await diagnostics(worker);
    observations.push({
      id: "V3-1.3-A13-fresh-channel-recovery",
      passed: recoveryFocus === "media-credential-start"
        && recoveryAfter.credentialCookieReadCount === recoveryBefore.credentialCookieReadCount + 1
        && recoveryAfter.credentialRevocationHandleCount === recoveryBefore.credentialRevocationHandleCount + 1
    });

    stage("protocol-replay-and-tamper");
    const directReplayIssue = await issueChannel({ bearer: runtimeBearer, origin, binding });
    const malformed = await requestJson("/v1/media/credential-leases", { method: "POST", origin, authorization: `Navia-Media-Channel ${directReplayIssue.token}`, body: "{" });
    const replayed = await requestJson("/v1/media/credential-leases", { method: "POST", origin, authorization: `Navia-Media-Channel ${directReplayIssue.token}`, body: {} });
    observations.push({ id: "V3-1.3-A11-channel-replay", passed: publicFailure(malformed) === "V3_MEDIA_ENVELOPE_INVALID" && publicFailure(replayed) === "V3_MEDIA_CHANNEL_REPLAYED" });

    const sharedEnvelopeId = `pce_${crypto.randomBytes(16).toString("hex")}`;
    const firstEnvelopeIssue = await issueChannel({ bearer: runtimeBearer, origin, binding });
    const firstEnvelope = await createDirectLease(firstEnvelopeIssue, seed.envelopeCredentials, origin, { envelopeId: sharedEnvelopeId });
    const secondEnvelopeIssue = await issueChannel({ bearer: runtimeBearer, origin, binding });
    const secondEnvelope = await createDirectLease(secondEnvelopeIssue, seed.envelopeCredentials, origin, { envelopeId: sharedEnvelopeId });
    const firstLease = firstEnvelope.response.value?.data;
    publicRecords.channel = firstEnvelopeIssue.channel;
    publicRecords.lease = firstLease?.lease ?? null;
    observations.push({ id: "V3-1.3-A10-public-lease", passed: firstEnvelope.response.status === 201 && firstEnvelope.response.cacheControl === "no-store" && firstLease?.lease?.serverValidationStatus === "not_performed" && !JSON.stringify(firstLease.lease).includes("credentials") });
    observations.push({ id: "V3-1.3-A11-envelope-replay", passed: publicFailure(secondEnvelope.response) === "V3_MEDIA_ENVELOPE_REPLAYED" });
    await requestJson(`/v1/media/credential-leases/${firstLease.lease.leaseId}`, { method: "DELETE", origin, authorization: `Navia-Media-Revoke ${firstLease.revocationToken}` });

    const tamperCases = [
      ["task", { taskId: `media_task_${"f".repeat(32)}` }, "V3_MEDIA_LEASE_TASK_MISMATCH"],
      ["adapter", { adapterId: "youtube" }, "V3_MEDIA_ENVELOPE_INVALID"],
      ["policy", { policyId: "other-media-consent/v1" }, "V3_MEDIA_POLICY_NOT_GRANTED"],
      ["revision", { policyRevision: 2 }, "V3_MEDIA_POLICY_REVISION_MISMATCH"],
      ["binding", { browserSessionBindingSha256: "f".repeat(64) }, "V3_MEDIA_CHANNEL_INVALID"],
      ["nameset", { credentialNameSetSha256: "f".repeat(64) }, "V3_MEDIA_CREDENTIAL_SET_INVALID"]
    ];
    const tamperResults = [];
    for (const [id, mutation, expected] of tamperCases) {
      const issue = await issueChannel({ bearer: runtimeBearer, origin, binding });
      const attempt = await createDirectLease(issue, seed.envelopeCredentials, origin, { mutation });
      tamperResults.push({ id, passed: publicFailure(attempt.response) === expected, failureCode: publicFailure(attempt.response) });
    }
    const revisionIssue = await issueChannel({ bearer: runtimeBearer, origin, binding, mutation: { policyRevision: 2 } });
    observations.push({ id: "V3-1.3-A08-revision", passed: publicFailure(revisionIssue.response) === "V3_MEDIA_POLICY_REVISION_MISMATCH" });
    observations.push({ id: "V3-1.3-A12-tamper", passed: tamperResults.every((item) => item.passed), cases: tamperResults });

    stage("revoke-and-runtime-restart");
    await workspace.bringToFront();
    await workspace.waitForTimeout(500);
    const beforeRevoke = await diagnostics(worker);
    await workspace.locator("[data-testid='media-consent-revoke']").click();
    await workspace.getByText("已撤销", { exact: true }).waitFor({ timeout: 20_000 });
    await workspace.waitForTimeout(1_000);
    const afterRevoke = await diagnostics(worker);
    observations.push({ id: "V3-1.3-A15-revoke", passed: afterRevoke.credentialRevocationHandleCount === 0 && afterRevoke.credentialRevocationSucceededCount >= beforeRevoke.credentialRevocationSucceededCount + 2 });

    const renewedGrant = await grantPolicy(workspace, profilePath, worker);
    observations.push({
      id: "V3-1.3-A15-policy-reauthorization",
      passed: renewedGrant.nativePromptRequired
        && (renewedGrant.nativePromptConfirmed || renewedGrant.browserAutoGranted)
        && renewedGrant.after.named
        && renewedGrant.after.host,
      nativePromptConfirmed: renewedGrant.nativePromptConfirmed,
      browserAutoGranted: renewedGrant.browserAutoGranted
    });
    const disconnect = workspace.locator("[data-testid='local-runtime-disconnect']");
    if (await disconnect.count()) await disconnect.click();
    await connectRuntime(workspace, runtimeBearer);
    await establishFromUi(workspace);
    const beforeRuntimeRestart = await diagnostics(worker);
    await runtime.stop();
    runtime = startRuntime(identity.id, runtimeBearer, "strong-b");
    await waitForRuntime();
    await workspace.locator("[data-testid='media-consent-revoke']").click();
    await workspace.getByText("已撤销", { exact: true }).waitFor({ timeout: 20_000 });
    await workspace.waitForTimeout(1_000);
    const afterRuntimeRestartRevoke = await diagnostics(worker);
    observations.push({ id: "V3-1.3-A16-runtime-restart", passed: beforeRuntimeRestart.credentialRevocationHandleCount >= 1 && afterRuntimeRestartRevoke.credentialRevocationHandleCount === 0 && afterRuntimeRestartRevoke.credentialRevocationFailedCount >= beforeRuntimeRestart.credentialRevocationFailedCount + 1 });

    stage("background-service-worker-restart");
    const backgroundRestartGrant = await grantPolicy(workspace, profilePath, worker);
    await establishFromUi(workspace);
    const beforeBackgroundRestart = await diagnostics(worker);
    ensure(beforeBackgroundRestart.credentialRevocationHandleCount >= 1, "background restart requires an active revocation handle");
    nativePanelTarget.close();
    nativePanelTarget = null;
    await workspace.close();
    await host.close();
    await browser.close();
    browser = null;

    browser = await helpers.launchExtension(profilePath);
    host = await browser.context.newPage();
    await host.goto(anchorUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await host.waitForTimeout(1_000);
    worker = await helpers.extensionWorker(browser.context);
    const restartedIdentity = await extensionIdentity(worker);
    ensure(restartedIdentity.id === identity.id, "extension identity changed across Background restart");
    workspace = await browser.context.newPage();
    await workspace.setViewportSize({ width: 768, height: 900 });
    await workspace.goto(`${origin}/workspace.html#/media/current`, { waitUntil: "domcontentloaded" });
    await workspace.locator("[data-testid='media-workspace-root']").waitFor({ timeout: 20_000 });
    const afterBackgroundRestart = await diagnostics(worker);
    observations.push({
      id: "V3-1.3-A16-background-restart",
      passed: beforeBackgroundRestart.credentialRevocationHandleCount >= 1
        && afterBackgroundRestart.credentialRevocationHandleCount === 0
        && afterBackgroundRestart.credentialCookieReadCount === 0
        && backgroundRestartGrant.after.named
        && backgroundRestartGrant.after.host
    });

    stage("natural-expiry");
    const channelExpiryIssue = await issueChannel({ bearer: runtimeBearer, origin, binding });
    const leaseExpiryIssue = await issueChannel({ bearer: runtimeBearer, origin, binding });
    const leaseExpiry = await createDirectLease(leaseExpiryIssue, seed.envelopeCredentials, origin);
    const expiringLease = leaseExpiry.response.value?.data;
    ensure(expiringLease?.lease && expiringLease?.revocationToken, "expiry lease was not issued");
    const channelWaitMs = Math.max(0, Date.parse(channelExpiryIssue.channel.expiresAt) - Date.now() + 250);
    if (channelWaitMs) await wait(channelWaitMs);
    const expiredChannel = await createDirectLease(channelExpiryIssue, seed.envelopeCredentials, origin);
    observations.push({ id: "V3-1.3-A12-channel-expiry", passed: publicFailure(expiredChannel.response) === "V3_MEDIA_CHANNEL_EXPIRED" });
    const leaseWaitMs = Math.max(0, Date.parse(expiringLease.lease.expiresAt) - Date.now() + 750);
    if (leaseWaitMs) await wait(leaseWaitMs);
    const expiredLeaseDelete = await requestJson(`/v1/media/credential-leases/${expiringLease.lease.leaseId}`, { method: "DELETE", origin, authorization: `Navia-Media-Revoke ${expiringLease.revocationToken}` });
    observations.push({ id: "V3-1.3-A14-lease-expiry", passed: publicFailure(expiredLeaseDelete) === "V3_MEDIA_LEASE_EXPIRED" });

    stage("browser-storage-scan");
    const storageHits = await storageNeedleCount(workspace, worker, seed.needles);
    observations.push({ id: "V3-1.3-A17-browser-storage", passed: storageHits === 0, hitCount: storageHits });
    nativePanelTarget?.close();
    await workspace.close();
    await host.close();
  } finally {
    if (runtime) await runtime.stop();
    if (browser) await browser.close().catch(() => undefined);
    fs.rmSync(profilePath, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 });
    profileDeleted = !fs.existsSync(profilePath);
  }

  stage("disk-secret-scan-and-result");
  const secretScan = scanRootsForCredentialNeedles([
    { label: "extension-build", path: extensionRoot },
    { label: "runtime-private", path: privateRoot },
    { label: "run-public", path: runRoot }
  ], seed.needles);
  const result = {
    schemaVersion: "v3-media-credential-transport-run/v1",
    runId,
    evidenceClass: "production_candidate",
    generatedAt: new Date().toISOString(),
    input: {
      anchorUrl,
      buildTreeSha256: hashBuildTree(extensionRoot),
      sessionPolicySha256: sha256(fs.readFileSync(path.join(repoRoot, "docs/active/project/contracts/v3-media-session-policy-registry.json"))),
      evidenceClass: "user_authorized_live_session_seed",
      credentialCount: seed.chromeCookies.length
    },
    observations,
    publicRecords,
    screenshots,
    accessibility,
    keyboard,
    secretScan,
    cleanup: { profileDeleted },
    summary: {
      total: observations.length,
      passed: observations.filter((item) => item.passed).length,
      failed: observations.filter((item) => !item.passed).length
    },
    passed: observations.every((item) => item.passed)
      && accessibility.every((item) => item.serious === 0 && item.critical === 0)
      && secretScan.passed
      && profileDeleted
  };
  writeJson(path.join(runRoot, "result.json"), result);
  writeJson(path.join(runRoot, "secret-scan.json"), secretScan);
  seed.chromeCookies.length = 0;
  seed.envelopeCredentials.length = 0;
  seed.needles.length = 0;
  process.stdout.write(`${JSON.stringify({ runId, passed: result.passed, summary: result.summary, secretScan, cleanup: result.cleanup }, null, 2)}\n`);
  if (!result.passed) process.exitCode = 2;
}

function hashBuildTree(root) {
  const entries = [];
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else if (entry.isFile()) entries.push({ path: path.relative(root, absolute).replaceAll(path.sep, "/"), sha256: sha256(fs.readFileSync(absolute)) });
    }
  };
  visit(root);
  return sha256(Buffer.from(JSON.stringify(entries)));
}

main().catch((error) => {
  writeJson(path.join(runRoot, "FAILED.json"), {
    schemaVersion: "v3-media-credential-transport-failure/v1",
    runId,
    failedAt: new Date().toISOString(),
    stage: currentStage,
    error: error instanceof Error ? error.message : "collector failed"
  });
  process.stderr.write("V3-1.3 credential collector failed; inspect the non-secret failure record.\n");
  process.exitCode = 2;
});
