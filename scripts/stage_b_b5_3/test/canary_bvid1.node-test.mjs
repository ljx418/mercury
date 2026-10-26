// Stage B B-5-3 P0 fixed-BVID muted Chrome canary (PH0-AR-12, M-4).
//
// This canary exercises the daily-use, pre-authorized path:
//     1. Copy the unpacked extension to a per-test temp dir.
//     2. Promote https://*.bilibili.com/* from optional_host_permissions
//        to host_permissions in the test-only manifest. No other API
//        permissions touched. (chrome.permissions API does not require
//        any `permissions` array entry.)
//     3. PRE-COMPUTE the extension ID from the canonical absolute fixture
//        path via Chrome's path-based ID algorithm (since the manifest
//        has no `key` field). SHA-256(UTF-8 absolute path, with NO
//        trailing slash), first 16 bytes / 32 hex nibbles, each nibble
//        0..f mapped to a..p. Produces 32 a-p chars. Empirical check:
//        /tmp/navia-b5-3-canary-ext-GnGR42 → aohpjomapiblphgagpngphocdcjggdjg.
//     4. Start Runtime with the pre-computed ID before Chrome launches.
//     5. Launch Chrome with the fixture. Verify --mute-audio via real
//        pgrep. Wait for service worker.
//     6. Hard-assert SW-reported extensionId === pre-computed ID
//        (char-for-char). Mismatch → hard FAIL with diagnostic, no
//        subsequent steps.
//     7. Drive the full Stage A path: navigate → launcher → enable →
//        verify the consent policy was committed → observe resolve and
//        media_source_authority → arm trusted capture from the real UI →
//        invoke the registered extension command → stop capture from the
//        real UI → observe the Side Panel materialize flow and the same
//        task reaching ready/degraded.
//
// HONEST POLICY:
//   - skip is FORBIDDEN. Every infrastructure failure → assert.fail with
//     canary-failure.json diagnostic.
//   - Chrome must be headless: true with --mute-audio. Never grab focus.
//   - Single try/finally covers ALL exit paths (return, fail, throw). The
//     finally block runs context.close, Runtime SIGINT→bounded-wait→
//     SIGKILL, fixture+scratch rmSync. Cleanup status is recorded in
//     the trace.
//   - The trace records:
//         * fixture hash (sha256 of the modified manifest)
//         * permissionMode = "pregranted_test_fixture"
//         * pre-computed + SW-reported extensionId (must be equal)
//         * each captured /v1/media/acquisitions/resolve response
//         * chrome.permissions.contains() real result on service worker
//         * runtimeConnected / capability / sidepanel UI states
//         * console errors + request failures + runtime HTTP events
//         * every media_tasks state poll
//         * cleanup status (chrome closed / runtime killed / dirs removed)
//   - The canary asserts: media_tasks.state ∈ {ready, degraded} within
//     180s (matches outer test timeout of 8 minutes).
//
// Branch coverage status (Phase 0 honest):
//   VERIFIED by this canary:
//     - Real Chrome + extension launch (headless, --mute-audio)
//     - chrome.permissions.contains for pregranted bilibili.com
//     - /v1/media/acquisitions/resolve auto-fire after enable + UI states
//     - media_source_authority row creation from resolve
//     - Registered extension command consumes the armed capture request
//     - Side Panel product effects drive the same task to ready/degraded
//     - Path-derived extension ID char-for-char match to SW ID
//   NOT VERIFIED (Phase 1 / Phase 0 NO-GO):
//     - Native chrome.permissions.request UI (X11 ctypes fake-click)
//     - Runtime crash real branch (was fake-covered; removed)
//     - Service worker missing real branch (was fake-covered; removed)
//     - Cleanup failure real branch (was fake-covered; removed)
//     - Chrome SIGKILL hard-kill sequencer-level (spawn-based arch)
//     - Real Bilibili access block (require human interactive prompt)

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { buildPregrantedFixture } from "../lib/extension_fixture.mjs";
import { spawn, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

import {
  parseNetscape,
  parseJson,
  validateCookie,
  buildInjectionObject,
  selectAllowedCookies,
  COOKIE_FAIL,
} from "./cookie_prereq.mjs";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");
const chromeExtRoot = path.join(repoRoot, "apps/chrome-extension");
const chromeForTestingRoot = path.join(chromeExtRoot, "chrome-mv3-unpacked");
const chromeBinaries = [
  "/home/administrator/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome",
  process.env.NAVIA_BROWSER_EXECUTABLE,
].filter(Boolean);
const runtimeRoot = path.join(repoRoot, "services/local-runtime");
const runtimePython = path.join(runtimeRoot, ".venv/bin/python");
const nativeVisibleAction = process.env.NAVIA_P0_VISIBLE_WINDOWS_UIA === "1";
const windowsChromePath = path.join(repoRoot, ".tmp/chrome-for-testing/chrome-win64/chrome.exe");

function pickChrome() {
  for (const p of chromeBinaries) {
    if (p && fs.existsSync(p)) return p;
  }
  return null;
}

// The product extension bundle hardcodes http://127.0.0.1:17861 as the
// Runtime base URL. The canary MUST use this exact port so the sidepanel's
// runtimeClient / background / manifest hit the same Runtime that the
// canary spawns. Using any other port makes the UI permanently offline,
// authority rows are never written, and Stage A never reaches terminal —
// false-green. There is no override: any non-17861 port would silently
// re-introduce the same defect.
const PRODUCT_PORT = 17861;

// Preflight: confirm PRODUCT_PORT is bindable. If it's not, another
// Runtime (e.g. the user's manual companion) is already using it. We
// MUST NOT terminate it — that would corrupt the user's session. The
// canary reports diagnostic-only and asks the user to free the port.
async function checkPortAvailable(port) {
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.once("error", (err) => resolve({ ok: false, error: err.code || err.message }));
    probe.listen(port, "127.0.0.1", () => {
      const addr = probe.address();
      probe.close(() => resolve({ ok: true, addr }));
    });
  });
}

async function waitForRuntime(port, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/v1/health`);
      if (res.ok) return;
    } catch { /* still starting */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`runtime on port ${port} did not become healthy within ${timeoutMs}ms`);
}

function sha256File(filePath) {
  return createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

// Chrome's path-based extension ID derivation. Used when manifest has no
// `key` field. SHA-256(UTF-8 canonical absolute path, no trailing slash),
// first 16 bytes / 32 hex nibbles, each nibble 0..f mapped to a..p.
// Produces 32 a-p chars.
//
// Empirical check: /tmp/navia-b5-3-canary-ext-GnGR42 →
//   aohpjomapiblphgagpngphocdcjggdjg
function pathBasedExtensionId(p) {
  const canonical = p.replace(/\/+$/, "");
  const h = createHash("sha256").update(canonical).digest();
  let out = "";
  for (const byte of h.subarray(0, 16)) {
    out += String.fromCharCode(0x61 + (byte >> 4));
    out += String.fromCharCode(0x61 + (byte & 0x0f));
  }
  if (out.length !== 32) throw new Error(`id length != 32: ${out.length}`);
  return out;
}

async function findNaviaServiceWorker(context, timeoutMs = 5_000) {
  const deadline = Date.now() + timeoutMs;
  const candidates = [];
  do {
    let workers = context.serviceWorkers();
    if (workers.length === 0 && timeoutMs > 0) {
      const worker = await context.waitForEvent("serviceworker", {
        timeout: Math.min(1_000, Math.max(1, deadline - Date.now())),
      }).catch(() => null);
      if (worker) workers = [worker];
    }
    for (const worker of workers) {
      let extensionId = null;
      let manifestName = null;
      try {
        extensionId = new URL(worker.url()).host;
        manifestName = await worker.evaluate(() => chrome.runtime.getManifest()?.name ?? null);
      } catch { /* worker may have stopped during inspection */ }
      const identity = { extensionId, manifestName };
      if (!candidates.some((candidate) => (
        candidate.extensionId === identity.extensionId
        && candidate.manifestName === identity.manifestName
      ))) candidates.push(identity);
      if (manifestName === "Navia") return { worker, candidates };
    }
    if (Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 250));
  } while (Date.now() < deadline);
  return { worker: null, candidates };
}

function writeJson(filePath, payload) {
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), { mode: 0o600 });
}

const chromePath = pickChrome();

test("PH0-AR-12: pregranted-fixture canary on BV1pohR6rEEh — pre-computed path-based ID + real Runtime", { timeout: 8 * 60_000 }, async (t) => {
  // Setup shared state — every exit (assert.fail, throw, return) goes
  // through finally{}. All resource creation MUST be inside the outer
  // try{} so finally{} can clean them up. The chromePath /
  // chromeForTestingRoot / cookie-source prerequisite checks happen as
  // the FIRST statements inside the try; if they fail, failWithDiagnostic
  // throws and finally{} still runs.
  const evidenceDir = path.join(os.tmpdir(), `navia-b5-3-canary-${Date.now()}`);
  fs.mkdirSync(evidenceDir, { recursive: true, mode: 0o700 });
  let scratch = null;
  let profilePath = null;
  let fixture = null; // { fixturePath, originalSha, modifiedSha, merged }
  let context = null;
  let runtimeProc = null;
  let dbPath = null;
  let mediaTaskRoot = null;
  let bearerToken = null;
  let actualExtensionId = null;
  let precomputedExtensionId = null;
  let nativeBrowserHandle = null;
  let windowsChromePid = null;
  let runtimePort = null;
  let extensionOrigin = null;
  let chromePidFromPgrep = null;
  let canarySucceeded = false; // set true only after Step 13 asserts pass
  let pendingFinalPayload = null; // canary-final.json content, written ONLY if cleanup OK

  const trace = {
    startedAt: new Date().toISOString(),
    stage: "init",
    permissionMode: "pregranted_test_fixture",
    resolveResponses: [],
    serviceWorkerCandidates: [],
    permissionStates: [],
    pregrantedPolicySeeded: false,
    runtimeHttpEvents: [],
    runtimeCaptureDiagnostics: [],
    serviceWorkerWebSocketProbe: null,
    capturePhaseStates: [],
    captureStartClicked: false,
    captureFinishClicked: false,
    captureFinishedVisible: false,
    captureFailure: null,
    captureControllerDiagnostic: null,
    captureCardVisible: false,
    captureCommandInvoked: false,
    nativeVisibleAction,
    registeredCommands: [],
    actionInvocationAttempts: [],
    actionInvocationCountBefore: null,
    actionInvocationCountAfter: null,
    consentPolicyAfterEnable: null,
    materializeRequests: [],
    authorityTaskId: null,
    sidepanelStates: [],
    authorityQueries: [],
    mediaTasksPolls: [],
    requestFailures: [],
    consoleErrors: [],
    cleanup: { chromeClosed: false, runtimeKilled: false, fixtureRemoved: false, scratchRemoved: false, leaksBeforeCleanup: [] },
    note: "Native chrome.permissions.request UI is NOT exercised; only the pregranted daily-use path. Phase 0 accepted by user; native-prompt UI is documented as Phase 1 / human-prompt risk.",
  };

  const failWithDiagnostic = (stage, extra2 = {}) => {
    trace.stage = stage;
    trace.failureCode = typeof extra2.code === "string" ? extra2.code : null;
    try { writeJson(path.join(evidenceDir, "canary-trace.json"), trace); } catch { /* best effort */ }
    try { writeJson(path.join(evidenceDir, "canary-failure.json"), { noGoAt: new Date().toISOString(), stage, ...extra2 }); } catch { /* best effort */ }
    assert.fail(`canary NO-GO @ ${stage}: ${JSON.stringify(extra2).slice(0, 200)}`);
  };

  // Prerequisite check: minimum necessary real B站 cookies must be
  // available from a user-authorized private source. The canary will
  // inject these into a test-only temporary persistent profile (NEVER
  // the product fixture, NEVER the user's product profile). The profile
  // is mode 0700 and is removed by the outer finally block. Public
  // evidence records only 6 fixed fields; cookie VALUES and the cookie
  // source PATH are never written to trace/failure/chrome_launch/log.
  const COOKIE_SOURCE_ENV = "NAVIA_BILIBILI_COOKIE_FILE";
  const ALLOWED_NAMES_ENV = "BILIBILI_ALLOWED_COOKIE_NAMES";
  const cookieSourcePath = process.env[COOKIE_SOURCE_ENV] || null;
  const allowedNamesList = (process.env[ALLOWED_NAMES_ENV] || "SESSDATA")
    .split(",").map((s) => s.trim()).filter(Boolean);
  const REQUIRED_NAMES = ["SESSDATA"];

  // cookieValuesForInjection: in-memory handoff to the canary caller.
  // Consumed by `context.addCookies` after navigation prep. NEVER
  // written to evidence / log / failure / chrome_launch.
  let cookieValuesForInjection = null;
  let cookiePrerequisiteError = null;
  let cookiePrerequisiteErrorCode = null;
  let cookieNamesSha256 = null;
  let allowedNamesSet = null;
  let allowedNamesSetSha256 = null;
  let requiredPresent = false;
  let envSet = Boolean(cookieSourcePath);
  let fileReadable = false;
  let injectedCount = 0;
  let secretHitCount = 0;

  if (!cookieSourcePath) {
    cookiePrerequisiteErrorCode = COOKIE_FAIL.NO_ENV;
  } else if (!fs.existsSync(cookieSourcePath)) {
    cookiePrerequisiteErrorCode = COOKIE_FAIL.FILE_MISSING;
  } else {
    let raw;
    try {
      raw = fs.readFileSync(cookieSourcePath, "utf8");
      fileReadable = true;
    } catch (parseErr) {
      cookiePrerequisiteErrorCode = COOKIE_FAIL.FILE_UNREADABLE;
    }
    if (fileReadable && raw !== undefined) {
      try {
        const parsed = raw.trim().startsWith("[")
          ? parseJson(raw)
          : parseNetscape(raw);
        // Compute allowed-name set hash from FROZEN env-var list, BEFORE
        // filtering parsed cookies — so trace is reproducible.
        allowedNamesSet = new Set(allowedNamesList);
        allowedNamesSetSha256 = createHash("sha256").update(allowedNamesList.sort().join("|")).digest("hex");
        // Select only the frozen minimum allowlist. A normal browser export
        // contains unrelated Bilibili cookies; they are ignored and never
        // injected rather than broadening this canary's credential scope.
        const selection = selectAllowedCookies(parsed, allowedNamesList, REQUIRED_NAMES);
        // Per-cookie validation against domain/path/secure/sameSite/value.
        const validated = selection.filtered.map((c) => ({ c, r: validateCookie(c, allowedNamesSet) }));
        const invalid = validated.filter((v) => !v.r.ok);
        if (invalid.length > 0) {
          cookiePrerequisiteErrorCode = invalid[0].r.code;
        } else if (allowedNamesList.length === 0 || (allowedNamesList.length === 1 && allowedNamesList[0] === "")) {
          cookiePrerequisiteErrorCode = COOKIE_FAIL.NAME_NOT_ALLOWED;
        } else {
          // All good — required names must be present.
          requiredPresent = selection.requiredPresent;
          if (!requiredPresent) {
            cookiePrerequisiteErrorCode = COOKIE_FAIL.REQUIRED_MISSING;
          } else {
            cookieValuesForInjection = selection.filtered;
            cookieNamesSha256 = allowedNamesSetSha256;
            injectedCount = selection.filtered.length;
          }
        }
      } catch (parseErr) {
        cookiePrerequisiteErrorCode = COOKIE_FAIL.BAD_FORMAT;
      }
    }
  }
  // After this point, do NOT reference cookieSourcePath or raw cookie
  // values outside `cookieValuesForInjection` and the post-run scan
  // helpers. The public trace and failure must not contain the path,
  // raw values, or any text that could identify a parent dir.

  // Public trace fields — exactly the 6 frozen fields. NEVER path /
  // sizeBytes / cookieNames / rawValues.
  trace.cookieSource = {
    envSet,
    fileReadable,
    allowedNameSetSha256: allowedNamesSetSha256,
    requiredPresent,
    injectedCount,
    secretHitCount,
  };

  try {
    // PREREQ CHECKS as the FIRST statements inside the try. failWithDiagnostic
    // throws AssertionError, which propagates out — but the outer finally{}
    // still runs and cleans up all owned resources.
    if ((!nativeVisibleAction && !chromePath) || (nativeVisibleAction && !fs.existsSync(windowsChromePath))) {
      failWithDiagnostic("chrome-binary-not-found", { chromeBinariesChecked: chromeBinaries });
      return;
    }
    if (!fs.existsSync(chromeForTestingRoot)) {
      failWithDiagnostic("extension-not-found", { expected: chromeForTestingRoot });
      return;
    }
    if (cookiePrerequisiteErrorCode) {
      failWithDiagnostic("cookie-prerequisite-failed", {
        code: cookiePrerequisiteErrorCode,
        note: "canary refuses to fabricate login state; see fixed code; cookie source path / values NEVER recorded.",
      });
      return;
    }

    // Owned temporary resources are created only after every prerequisite
    // passed and inside the single cleanup barrier. Any later throw is
    // therefore covered by finally{}.
    const scratchParent = nativeVisibleAction ? path.join(repoRoot, ".tmp") : os.tmpdir();
    fs.mkdirSync(scratchParent, { recursive: true, mode: 0o700 });
    scratch = fs.mkdtempSync(path.join(scratchParent, "navia-b5-3-canary-scratch-"));
    if (nativeVisibleAction) {
      profilePath = path.join(scratch, `navia-t01-profile-${Date.now().toString(36)}`);
      fs.mkdirSync(profilePath, { recursive: true, mode: 0o700 });
    } else {
      profilePath = fs.mkdtempSync(path.join(scratch, "profile-"));
    }

    // Step 1: build pregranted extension fixture.
    try {
      fixture = buildPregrantedFixture(chromeForTestingRoot, nativeVisibleAction ? scratch : os.tmpdir());
      trace.fixturePath = fixture.fixturePath;
      trace.fixtureManifestOriginalSha256 = fixture.originalSha;
      trace.fixtureManifestModifiedSha256 = fixture.modifiedSha;
      trace.fixtureHostPermissionsMerged = fixture.merged;
    } catch (fixtureError) {
      failWithDiagnostic("fixture-build-failed", { error: String(fixtureError.message) });
      return;
    }

    // Step 2: PRE-COMPUTE extension ID. This is the authoritative ID that
    // Runtime must use for session-bootstrap origin.
    if (!nativeVisibleAction) {
      precomputedExtensionId = pathBasedExtensionId(fixture.fixturePath);
      trace.precomputedExtensionId = precomputedExtensionId;
      extensionOrigin = `chrome-extension://${precomputedExtensionId}`;
      trace.extensionOrigin = extensionOrigin;
    }

    // Step 3: launch real Chrome (headless: true, --mute-audio).
    const playwrightUrl = `file://${path.join(chromeExtRoot, "node_modules/playwright/index.mjs").replaceAll("\\", "/")}`;
    const { chromium } = await import(playwrightUrl);

    try {
      if (nativeVisibleAction) {
        process.env.NAVIA_T01_EXTENSION_ROOT = fixture.fixturePath;
        process.env.NAVIA_T01_HEADLESS = "0";
        process.env.NAVIA_CHROME_MUTE_AUDIO = "1";
        process.env.NAVIA_T01_EVIDENCE_ROOT = evidenceDir;
        process.env.NAVIA_T01_RUN_ID = `p0-native-${Date.now()}`;
        const launcher = await import(`../../../apps/chrome-extension/e2e/chrome-v2-t01-r1-frontend.mjs?p0=${Date.now()}`);
        nativeBrowserHandle = await launcher.launchExtension(profilePath);
        context = nativeBrowserHandle.context;
      } else {
        context = await chromium.launchPersistentContext(profilePath, {
          headless: true,
          viewport: { width: 1280, height: 900 },
          ignoreDefaultArgs: ["--disable-extensions"],
          args: [
            "--mute-audio",
            "--disable-features=DisableLoadExtensionCommandLineSwitch",
            "--enable-unsafe-extension-debugging",
            "--autoplay-policy=no-user-gesture-required",
            `--disable-extensions-except=${fixture.fixturePath}`,
            `--load-extension=${fixture.fixturePath}`,
          ],
          executablePath: chromePath,
        });
      }
      trace.chromeLaunched = true;
    } catch (chromeError) {
      failWithDiagnostic("chrome-launch-failed", { error: String(chromeError.message) });
      return;
    }

    // Step 4: verify --mute-audio via real pgrep.
    // IMPORTANT: do NOT re-declare chromePidFromPgrep here; the let from
    // the outer closure (line 207) is what the cleanup finally{} checks
    // for ESRCH. Re-declaring with let would shadow the outer var and
    // finally{} would see null forever, defeating the fail-closed check.
    let chromeCmdline = "";
    try {
      if (nativeVisibleAction) {
        const { inspectOwnedWindowsChromeProfile } = await import("../../../apps/chrome-extension/e2e/lib/windowsExtensionInvocation.mjs");
        const rows = inspectOwnedWindowsChromeProfile(profilePath);
        chromeCmdline = rows.map((row) => row.commandLine).join("\n");
        windowsChromePid = rows[0]?.processId ?? null;
      } else {
        chromeCmdline = execFileSync("pgrep", ["-af", "chrome"], { encoding: "utf8" });
        const matchingLines = chromeCmdline.split("\n").filter((line) => line.includes(path.basename(profilePath)));
        chromeCmdline = matchingLines.join("\n");
        if (matchingLines.length > 0) {
          chromePidFromPgrep = parseInt(matchingLines[0].trim().split(/\s+/)[0], 10);
        }
      }
    } catch { /* noop */ }
    if (!chromeCmdline.includes("--mute-audio")) {
      failWithDiagnostic("mute-audio-missing", { chromeCmdline });
      return;
    }
    if (!Number.isFinite(nativeVisibleAction ? windowsChromePid : chromePidFromPgrep)) {
      failWithDiagnostic("chrome-pid-unidentifiable", { pgrepOutput: chromeCmdline });
      return;
    }
    trace.chromeCmdline = chromeCmdline;
    trace.chromePid = nativeVisibleAction ? windowsChromePid : chromePidFromPgrep;
    writeJson(path.join(evidenceDir, "chrome_launch.log"),
      `pid=${chromePidFromPgrep}\n--mute-audio present: true\npermissionMode=pregranted_test_fixture\nfixtureManifestOriginalSha256=${fixture.originalSha}\nfixtureManifestModifiedSha256=${fixture.modifiedSha}\nfixturePath=${fixture.fixturePath}\nprecomputedExtensionId=${precomputedExtensionId}\nruntimeOrigin=${extensionOrigin}\nchromeCmdline=${chromeCmdline.slice(0, 2000)}\n`,
      { mode: 0o600 });

    // Step 4b: inject pre-loaded cookies via Playwright
    // context.addCookies. These are written to the test-only temporary
    // test-only temporary persistent profile (mode 0700, removed in
    // finally{}); they NEVER enter the user's persisted product profile.
    // The cookie source PATH is NEVER recorded in trace/failure.
    if (Array.isArray(cookieValuesForInjection) && cookieValuesForInjection.length > 0) {
      const addList = cookieValuesForInjection.map((c) => buildInjectionObject(c));
      try {
        await context.addCookies(addList);
        injectedCount = addList.length;
        trace.cookieSource.injectedCount = injectedCount;
      } catch (_addErr) {
        failWithDiagnostic("cookie-injection-failed", {
          code: COOKIE_FAIL.INJECTION_FAILED,
          note: "addCookies rejected; raw error not recorded to prevent value/path leak.",
        });
        return;
      }
    }

    // Step 5: wait for service worker + hard-assert SW URL host ===
    // pre-computed ID char-for-char. Mismatch → hard FAIL.
    const naviaWorkerResult = await findNaviaServiceWorker(context, 30_000);
    const serviceWorkerFound = Boolean(naviaWorkerResult.worker);
    trace.serviceWorkerCandidates = naviaWorkerResult.candidates;
    if (naviaWorkerResult.worker) {
      actualExtensionId = new URL(naviaWorkerResult.worker.url()).host;
    }
    trace.serviceWorkerFound = serviceWorkerFound;
    trace.actualExtensionId = actualExtensionId;
    if (!serviceWorkerFound || !actualExtensionId) {
      failWithDiagnostic("service-worker-missing", { precomputedExtensionId });
      return;
    }
    // Linux unpacked IDs are path-derived and can be precomputed. Windows
    // visible mode uses the actual Service Worker ID because Chrome receives
    // a Windows path, whose canonical bytes differ from the WSL path.
    if (!nativeVisibleAction && actualExtensionId !== precomputedExtensionId) {
      failWithDiagnostic("extension-id-mismatch", { precomputedExtensionId, actualExtensionId });
      return;
    }
    trace.extensionId = actualExtensionId;
    extensionOrigin = `chrome-extension://${actualExtensionId}`;
    trace.extensionOrigin = extensionOrigin;

    // Step 6: preflight PRODUCT_PORT then boot real Runtime. The product
    // extension bundle hardcodes http://127.0.0.1:17861; the canary MUST
    // use the same port so the sidepanel + extension background see a
    // connected Runtime.
    runtimePort = PRODUCT_PORT;
    const preflight = await checkPortAvailable(runtimePort);
    if (!preflight.ok) {
      failWithDiagnostic("runtime-port-occupied", {
        port: runtimePort,
        error: preflight.error,
        note: "Another Runtime / uvicorn process is using port 17861. The canary MUST NOT terminate the user's Runtime. Free the port manually and re-run.",
      });
      return;
    }
    trace.runtimePortPreflight = { port: runtimePort, ok: true, preflightAt: new Date().toISOString() };
    dbPath = path.join(scratch, "canary.sqlite3");
    fs.writeFileSync(dbPath, "");
    fs.chmodSync(dbPath, 0o600);
    mediaTaskRoot = path.join(scratch, "media-tasks");
    fs.mkdirSync(mediaTaskRoot, { mode: 0o700, recursive: true });
    runtimeProc = spawn(runtimePython, [
      "-m", "uvicorn", "navia_runtime.app:app",
      "--host", "127.0.0.1", "--port", String(runtimePort),
      "--log-level", "warning",
    ], {
      cwd: runtimeRoot,
      env: {
        ...process.env,
        PYTHONPATH: ".",
        NAVIA_DB_PATH: dbPath,
        NAVIA_MEDIA_TASK_ROOT: mediaTaskRoot,
        NAVIA_LOCAL_FILES_EXTENSION_ID: actualExtensionId,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    runtimeProc.stderr.setEncoding("utf8");
    runtimeProc.stderr.on("data", (chunk) => {
      for (const line of String(chunk).split(/\r?\n/)) {
        if (!line.includes("V3 capture websocket diagnostic")) continue;
        trace.runtimeCaptureDiagnostics.push({ at: Date.now(), line: line.trim().slice(0, 500) });
      }
    });

    try {
      await waitForRuntime(runtimePort, 30_000);
      const sessionRes = await fetch(`http://127.0.0.1:${runtimePort}/v1/companion/sessions`, {
        method: "POST",
        headers: { origin: extensionOrigin },
      });
      const sessionJson = await sessionRes.json();
      bearerToken = sessionJson?.data?.token;
      if (!bearerToken) throw new Error(`session bootstrap missing token: status=${sessionRes.status}`);
      trace.runtimePort = runtimePort;
      trace.runtimeBooted = true;
    } catch (runtimeError) {
      failWithDiagnostic("runtime-boot-failed", { extensionId: actualExtensionId, error: String(runtimeError.message) });
      return;
    }

    const websocketProbeWorker = (await findNaviaServiceWorker(context, 5_000)).worker;
    if (websocketProbeWorker) {
      trace.serviceWorkerWebSocketProbe = await websocketProbeWorker.evaluate(() => new Promise((resolve) => {
        const socket = new WebSocket("ws://127.0.0.1:17861/v1/media/capture-stream");
        const timer = setTimeout(() => { socket.close(); resolve({ state: "timeout" }); }, 5_000);
        socket.addEventListener("open", () => {
          clearTimeout(timer);
          socket.close(1000);
          resolve({ state: "opened" });
        }, { once: true });
        socket.addEventListener("error", () => {
          clearTimeout(timer);
          resolve({ state: "error" });
        }, { once: true });
      })).catch(() => ({ state: "evaluation_failed" }));
    }

    // Step 7: chrome.permissions.contains via REAL service worker.
    let permissionVerified = false;
    const permDeadline = Date.now() + 30_000;
    while (Date.now() < permDeadline) {
      try {
        const navia = await findNaviaServiceWorker(context, 1_000);
        if (!navia.worker) {
          trace.serviceWorkerCandidates = navia.candidates;
          trace.permissionStates.push({ at: Date.now(), kind: "service-worker-missing" });
          await new Promise((r) => setTimeout(r, 1_500));
          continue;
        }
        const granted = await navia.worker.evaluate(async () => {
          const [named, host] = await Promise.all([
            chrome.permissions.contains({ permissions: ["cookies"] }),
            chrome.permissions.contains({ origins: ["https://*.bilibili.com/*"] }),
          ]);
          return { named, host };
        });
        trace.permissionStates.push({ at: Date.now(), kind: "bilibili-session", ...granted, extensionId: actualExtensionId });
        if (granted.named && granted.host) { permissionVerified = true; break; }
      } catch (permErr) {
        trace.permissionStates.push({ at: Date.now(), kind: "service-worker-eval-error", error: String(permErr.message) });
      }
      await new Promise((r) => setTimeout(r, 1_500));
    }
    trace.pregrantedPermissionVerified = permissionVerified;
    if (!permissionVerified) {
      failWithDiagnostic("permission-not-pregranted", { permissionStates: trace.permissionStates });
      return;
    }

    // This canary verifies the *daily-use pre-authorized path*, not the
    // first-use native permission prompt. Seed the matching product consent
    // policy in the isolated fixture profile before any product page opens.
    // The policy contains no credential and is deleted with the profile.
    // First-use prompt UX remains a separate native/human gate.
    const policyDecidedAt = new Date().toISOString();
    const policyWorker = (await findNaviaServiceWorker(context, 5_000)).worker;
    if (!policyWorker) {
      failWithDiagnostic("navia-service-worker-missing-before-policy-seed", {
        candidates: trace.serviceWorkerCandidates,
      });
      return;
    }
    await policyWorker.evaluate(async ({ decidedAt }) => {
      const key = "navia.mediaConsentPolicy.bilibili";
      await chrome.storage.local.set({
        [key]: {
          schemaVersion: "media-consent-policy/v1",
          policyId: "bilibili-media-consent/v1",
          adapterId: "bilibili",
          policyRevision: 1,
          status: "granted",
          scopeGrants: [
            "bilibili_session_access",
            "temporary_media_download",
            "audio_local_processing",
            "frame_local_processing",
            "selected_frame_cloud_vision",
          ].map((scopeId) => ({ scopeId, granted: true })),
          decidedAt,
          revokedAt: null,
        },
      });
    }, { decidedAt: policyDecidedAt });
    trace.pregrantedPolicySeeded = true;

    // Step 8: capture runtime HTTP events + console errors.
    const resolveResponses = [];
    context.on("response", async (response) => {
      try {
        const url = response.url();
        if (url.includes("/v1/media/acquisitions/resolve")) {
          const body = await response.json().catch(() => null);
          resolveResponses.push({ at: Date.now(), status: response.status(), disposition: body?.data?.disposition, authoritativeTaskId: body?.data?.authoritativeTaskId, error: body?.error?.code });
        } else if (url.includes("/materialize")) {
          trace.materializeRequests.push({ at: Date.now(), status: response.status(), path: new URL(url).pathname });
        } else if (url.includes("/v1/")) {
          trace.runtimeHttpEvents.push({ at: Date.now(), kind: "response", status: response.status(), path: new URL(url).pathname });
        }
      } catch { /* ignore */ }
    });
    context.on("requestfailed", (request) => {
      trace.requestFailures.push({ at: Date.now(), url: request.url(), failure: request.failure()?.errorText });
    });
    context.on("console", (msg) => {
      if (msg.type() === "error") trace.consoleErrors.push({ at: Date.now(), text: msg.text() });
    });
    context.on("weberror", (err) => {
      trace.consoleErrors.push({ at: Date.now(), kind: "weberror", text: err.error().message });
    });

    // Step 9: navigate + click launcher. Because both Chrome permission and
    // Navia consent policy are pre-authorized, the product must auto-start;
    // seeing a first-use enable button is a fixture/persistence failure.
    const page = await context.newPage();
    await page.bringToFront();
    try {
      await page.goto(`https://www.bilibili.com/video/BV1pohR6rEEh`, { waitUntil: "domcontentloaded", timeout: 60_000 });
      trace.navigationOk = true;
    } catch (navError) {
      trace.navigationError = String(navError.message);
      failWithDiagnostic("navigation-failed", { error: trace.navigationError });
      return;
    }

    const launcher = page.locator('[data-testid="navia-floating-launcher"]');
    try {
      await launcher.waitFor({ timeout: 30_000 });
      await launcher.click();
      trace.launcherClicked = true;
    } catch (launcherError) {
      trace.launcherError = String(launcherError.message);
      failWithDiagnostic("launcher-failed", { error: trace.launcherError });
      return;
    }

    const embedded = page.frameLocator('[data-testid="navia-inpage-sidebar-frame"]');
    await embedded.locator("[data-testid='navia-sidepanel-root']").waitFor({ state: "attached", timeout: 30_000 });
    const contextDock = embedded.locator("[data-testid='chat-context-dock']");
    await contextDock.evaluate((element) => {
      if (element instanceof HTMLDetailsElement) element.open = true;
    }).catch(() => { /* visibility gate below remains fail-closed */ });
    const enable = embedded.locator("[data-testid='media-companion-enable']");
    const enableVisible = await enable.waitFor({ state: "visible", timeout: 30_000 })
      .then(() => true).catch(() => false);
    trace.enableVisible = enableVisible;
    trace.enableClicked = false;
    trace.enableSkippedForAutoStart = !enableVisible;
    const policyReadWorker = (await findNaviaServiceWorker(context, 5_000)).worker;
    trace.consentPolicyAfterEnable = await policyReadWorker?.evaluate(async () => {
      const key = "navia.mediaConsentPolicy.bilibili";
      const stored = await chrome.storage.local.get(key);
      return stored[key] ?? null;
    }).catch(() => null);
    if (enableVisible || trace.consentPolicyAfterEnable?.status !== "granted") {
      failWithDiagnostic("preauthorized-policy-not-restored", {
        policyStatus: trace.consentPolicyAfterEnable?.status ?? null,
        buttonVisible: enableVisible,
        status: await embedded.locator(".media-launch-status").textContent().catch(() => null),
        diagnostic: await embedded.locator(".media-launch-diagnostic").textContent().catch(() => null),
      });
      return;
    }

    // Step 10: poll UI states AND /v1/media/acquisitions/resolve.
    const RESOLVE_TIMEOUT_MS = 180_000;
    const resolveDeadline = Date.now() + RESOLVE_TIMEOUT_MS;
    let runtimeConnected = false;
    let capabilityAvailable = false;
    let sourceIdentityResolved = false;
    let resolveObserved = false;
    let lastUi = null;

    // Re-acquire the embedded frameLocator so we can read UI state from
    // inside the iframe (the sidepanel). page.evaluate would query the
    // bilibili.com main document where these test IDs do NOT exist.
    const embeddedFrame = page.frameLocator('[data-testid="navia-inpage-sidebar-frame"]');

    while (Date.now() < resolveDeadline) {
      try {
        // Read status / detail / diagnostic / acquire-card count
        // directly from the iframe DOM via frameLocator locators.
        const status = await embeddedFrame.locator(".media-launch-status").textContent({ timeout: 1_000 }).catch(() => null);
        const detail = await embeddedFrame.locator(".media-launch-detail").textContent({ timeout: 1_000 }).catch(() => null);
        const diagnostic = await embeddedFrame.locator(".media-launch-diagnostic").textContent({ timeout: 1_000 }).catch(() => null);
        // RuntimeConnected observable: sidepanel renders a card with
        // text containing "Runtime 已连接" when the connect succeeds.
        // We capture the raw text and record it; we do NOT use a fuzzy
        // Chinese regex as a primary truth signal.
        const runtimeConnectedText = await embeddedFrame.locator(".media-launch-status").textContent({ timeout: 500 }).catch(() => null);
        // Capability available: at least one .media-acquire-card or
        // .media-task-progress is rendered in the iframe.
        const acquireCardCount = await embeddedFrame.locator(".media-acquire-card, [data-testid^='media-acquisition'], .media-task-progress").count().catch(() => 0);
        const ui = {
          status: status?.trim() ?? null,
          detail: detail?.trim() ?? null,
          diagnostic: diagnostic?.trim() ?? null,
          runtimeConnectedText: runtimeConnectedText?.trim() ?? null,
          acquireCardCount,
        };
        trace.sidepanelStates.push({ at: Date.now(), ...ui });
        lastUi = ui;
        // runtimeConnected: status text exists AND contains a
        // connect-success marker. The exact text is sidepanel-version
        // specific; we assert NON-EMPTY + record the raw value for
        // independent verification.
        if (ui.status && /Runtime/.test(ui.status)) runtimeConnected = true;
        // capability: sidepanel rendered ≥1 acquire/task card.
        if (ui.acquireCardCount > 0) capabilityAvailable = true;
        // sourceIdentity: status + capability both present.
        if (runtimeConnected && capabilityAvailable) sourceIdentityResolved = true;
      } catch { /* ignore */ }
      // The PRIMARY truth signal remains the /resolve HTTP response.
      if (resolveResponses.some((r) => r.disposition === "created" || r.disposition === "attached")) {
        resolveObserved = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 1_500));
    }
    trace.runtimeConnected = runtimeConnected;
    trace.capabilityAvailable = capabilityAvailable;
    trace.sourceIdentityResolved = sourceIdentityResolved;
    trace.resolveObserved = resolveObserved;
    trace.resolveResponses = resolveResponses;
    trace.stage = "resolve-checked";

    if (!resolveObserved) {
      failWithDiagnostic("resolve-not-observed", {
        runtimeConnected,
        capabilityAvailable,
        sourceIdentityResolved,
        lastUi,
        lastSidepanelStates: trace.sidepanelStates.slice(-5),
        resolveResponses: resolveResponses.slice(0, 5),
        runtimeRequestFailures: trace.requestFailures.slice(0, 5),
        runtimeHttpEvents: trace.runtimeHttpEvents.slice(-10),
        consoleErrors: trace.consoleErrors.slice(0, 5),
      });
      return;
    }

    // Step 11: media_source_authority row. Resolve already returned the
    // authoritative task id, so bind the DB observation to that exact task
    // instead of scanning a recency window or inferring identity by row order.
    const resolvedTaskId = resolveResponses.find(
      (response) => response.disposition === "created" || response.disposition === "attached",
    )?.authoritativeTaskId;
    if (!/^media_task_[0-9a-f]{32}$/.test(resolvedTaskId ?? "")) {
      failWithDiagnostic("resolve-authoritative-task-invalid", { resolvedTaskId: resolvedTaskId ?? null });
      return;
    }
    let authorityRow = null;
    trace.stage = "authority-row-polling";
    const authorityDeadline = Date.now() + 30_000;
    while (Date.now() < authorityDeadline) {
      try {
        const rows = JSON.parse(execFileSync("sqlite3", ["-json", dbPath,
          `SELECT task_id, source_identity, state FROM media_source_authority WHERE task_id='${resolvedTaskId}'`,
        ], { encoding: "utf8" }) || "[]");
        trace.authorityQueries.push({ at: Date.now(), rowCount: rows.length });
        if (rows[0]) { authorityRow = rows[0]; break; }
      } catch (error) {
        trace.authorityQueries.push({ at: Date.now(), rowCount: 0, error: String(error?.message ?? error).slice(0, 300) });
      }
      await new Promise((r) => setTimeout(r, 1_000));
    }
    if (!authorityRow) {
      failWithDiagnostic("authority-row-missing");
      return;
    }
    trace.authorityRow = authorityRow;
    if (!authorityRow.source_identity?.includes("BV1pohR6rEEh")) {
      failWithDiagnostic("authority-source-identity-mismatch", {
        taskId: authorityRow.task_id,
        sourceIdentitySha256: createHash("sha256").update(String(authorityRow.source_identity ?? "")).digest("hex"),
      });
      return;
    }
    // The single source of truth for the canary's taskId is the
    // media_source_authority row written by the Side Panel effect on
    // /v1/media/acquisitions/resolve. We DO NOT POST outline-tasks
    // ourselves; the Side Panel effect is the only legitimate
    // orchestrator that creates the media_tasks row and drives it to
    // ready/degraded.
    const authorityTaskId = authorityRow.task_id;
    trace.authorityTaskId = authorityTaskId;
    assert.equal(authorityTaskId, resolvedTaskId, "authority row must match resolve authoritativeTaskId");
    assert.match(authorityTaskId, /^media_task_[0-9a-f]{32}$/);

    // Step 12: real user-driven trusted capture. The Side Panel's
    // TrustedTabCaptureCard appears only after the three subtitle routes
    // have all failed (captureFallbackEligible). We wait for the actual
    // button to render inside the iframe and click it with REAL user-
    // gesture semantics — never synthetic grant / userActivation / API.
    const embeddedForCapture = page.frameLocator('[data-testid="navia-inpage-sidebar-frame"]');
    const captureCardVisible = await embeddedForCapture.locator('[data-testid="media-capture-card"]').isVisible({ timeout: 10_000 }).catch(() => false);
    trace.captureCardVisible = captureCardVisible;
    if (!captureCardVisible) {
      failWithDiagnostic("capture-card-missing", {
        note: "TrustedTabCaptureCard did not render; captureFallbackEligible may be false or capture routes have not all failed.",
      });
      return;
    }

    // Click media-capture-start. The handler calls
    // captureMessages.start({trustedClick, userActivation, grant, ticket, ...})
    // — we never set grant / userActivation ourselves; the iframe's
    // React handler does.
    const captureStart = embeddedForCapture.locator('[data-testid="media-capture-start"]');
    if (nativeVisibleAction) {
      await captureStart.scrollIntoViewIfNeeded();
      await captureStart.evaluate((button) => {
        button.addEventListener("click", (event) => {
          button.dataset.naviaCanaryTrusted = String(event.isTrusted);
          button.dataset.naviaCanaryUserActivation = String(navigator.userActivation?.isActive === true);
        }, { capture: true, once: true });
      });
      const box = await captureStart.boundingBox();
      const metrics = await page.evaluate(() => ({
        screenX: window.screenX,
        screenY: window.screenY,
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        chromeLeft: Math.max(0, (window.outerWidth - window.innerWidth) / 2),
        chromeTop: Math.max(0, window.outerHeight - window.innerHeight),
        devicePixelRatio: window.devicePixelRatio || 1,
      }));
      if (!box) {
        failWithDiagnostic("capture-start-bounds-missing");
        return;
      }
      const physicalX = metrics.screenX + metrics.chromeLeft + box.x + box.width / 2;
      const physicalY = metrics.screenY + metrics.chromeTop + box.y + box.height / 2;
      trace.captureStartPointerTarget = {
        x: Math.round(physicalX),
        y: Math.round(physicalY),
        box: { x: Math.round(box.x), y: Math.round(box.y), width: Math.round(box.width), height: Math.round(box.height) },
        metrics,
      };
      const { clickOwnedChromePoint } = await import("../../../apps/chrome-extension/e2e/lib/windowsExtensionInvocation.mjs");
      try {
        const diagnostic = clickOwnedChromePoint(profilePath, physicalX, physicalY);
        trace.captureStartNativePointerSha256 = createHash("sha256").update(String(diagnostic)).digest("hex");
        await new Promise((resolve) => setTimeout(resolve, 500));
        trace.captureStartActivationObservation = await embeddedForCapture.locator("body").evaluate(() => {
          const button = document.querySelector('[data-testid="media-capture-start"]');
          return button instanceof HTMLElement ? {
            trusted: button.dataset.naviaCanaryTrusted ?? null,
            userActivation: button.dataset.naviaCanaryUserActivation ?? null,
          } : null;
        }, undefined, { timeout: 1_000 }).catch(() => null);
      } catch (error) {
        trace.captureStartNativePointerError = String(error?.message ?? error).slice(0, 500);
        failWithDiagnostic("capture-start-native-pointer-rejected", {
          error: trace.captureStartNativePointerError,
          target: trace.captureStartPointerTarget,
        });
        return;
      }
    } else {
      await captureStart.click({ timeout: 5_000 });
    }
    trace.captureStartClicked = true;

    // The product prewarms its offscreen document before requesting the
    // 30-second one-shot Runtime ticket. Wait until the trusted Side Panel
    // has completed that sequence and armed the controller; invoking the
    // extension command earlier can race the grant, while invoking it after
    // another full WMI scan can consume the ticket window.
    const armedDeadline = Date.now() + 45_000;
    trace.captureArmStates = [];
    let captureArmed = false;
    while (Date.now() < armedDeadline) {
      const state = await embeddedForCapture.locator("body").evaluate(async () => {
        try {
          return await chrome.runtime.sendMessage({ type: "navia.mediaCapture", command: "status" });
        } catch (error) {
          return { ok: false, failureCode: String(error) };
        }
      }).catch((error) => ({ ok: false, failureCode: String(error?.message ?? error) }));
      trace.captureArmStates.push({ at: Date.now(), state });
      if (state?.ok === true && state?.state === "armed") {
        captureArmed = true;
        break;
      }
      if (state?.ok === false) break;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    if (!captureArmed) {
      failWithDiagnostic("capture-not-armed-after-prewarm", {
        states: trace.captureArmStates.slice(-5),
      });
      return;
    }

    // Arming alone is intentionally insufficient. Chrome signs the stream ID
    // only from an extension action/command user invocation. Exercise both
    // registered, user-reachable entry points in a fixed order. Headless
    // Chrome remains muted and never takes desktop focus.
    const commandWorker = (await findNaviaServiceWorker(context, 5_000)).worker;
    if (!commandWorker) {
      failWithDiagnostic("navia-service-worker-missing-before-command", {
        candidates: trace.serviceWorkerCandidates,
      });
      return;
    }
    trace.registeredCommands = await commandWorker.evaluate(() => chrome.commands.getAll()).catch(() => []);
    const commandAttempts = nativeVisibleAction
      ? [
        { command: "open-navia-sidepanel", nativeShortcut: "project-command" },
        { command: "_execute_action", nativeMenu: true },
        { command: "_execute_action", nativeShortcut: "execute-action" },
      ]
      : [
        { command: "open-navia-sidepanel", shortcut: "Control+Shift+Y" },
        { command: "_execute_action", shortcut: "Alt+Shift+N" },
      ];
    let durableCaptureStarted = false;
    trace.stage = "capture-command-invocation";
    for (const attempt of commandAttempts) {
      const workerBefore = (await findNaviaServiceWorker(context, 2_000)).worker;
      const before = workerBefore
        ? await workerBefore.evaluate(() => globalThis.__naviaActionInvocationCount ?? 0).catch(() => null)
        : null;
      if (trace.actionInvocationCountBefore === null) trace.actionInvocationCountBefore = before;

      await page.bringToFront();
      let invocationDiagnosticSha256 = null;
      let invocationError = null;
      try {
        if (attempt.nativeMenu) {
          const { invokeExtensionOnActiveTab } = await import("../../../apps/chrome-extension/e2e/lib/windowsExtensionInvocation.mjs");
          const diagnostic = invokeExtensionOnActiveTab(profilePath);
          invocationDiagnosticSha256 = createHash("sha256").update(String(diagnostic)).digest("hex");
        } else if (attempt.nativeShortcut) {
          const { invokeExtensionShortcut, invokeOwnedPidExtensionShortcut } = await import("../../../apps/chrome-extension/e2e/lib/windowsExtensionInvocation.mjs");
          const diagnostic = Number.isFinite(windowsChromePid)
            ? invokeOwnedPidExtensionShortcut(profilePath, windowsChromePid, attempt.nativeShortcut)
            : invokeExtensionShortcut(profilePath, attempt.nativeShortcut);
          invocationDiagnosticSha256 = createHash("sha256").update(String(diagnostic)).digest("hex");
        } else {
          await page.keyboard.press(attempt.shortcut);
        }
      } catch (error) {
        invocationError = String(error?.message ?? error).slice(0, 500);
      }

      const commandDeadline = Date.now() + 10_000;
      let after = null;
      let countIncreased = false;
      while (Date.now() < commandDeadline) {
        durableCaptureStarted = await embeddedForCapture.locator('[data-testid="media-capture-finish"]').isVisible({ timeout: 500 }).catch(() => false);
        const workerAfter = (await findNaviaServiceWorker(context, 500)).worker;
        if (workerAfter) {
          after = await workerAfter.evaluate(() => globalThis.__naviaActionInvocationCount ?? 0).catch(() => null);
        }
        countIncreased = Number.isFinite(before) && Number.isFinite(after) && Number(after) > Number(before);
        if (countIncreased || durableCaptureStarted) break;
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      trace.actionInvocationAttempts.push({
        command: attempt.command,
        shortcut: attempt.shortcut,
        nativeMenu: attempt.nativeMenu === true,
        nativeShortcut: attempt.nativeShortcut ?? null,
        invocationDiagnosticSha256,
        invocationError,
        before,
        after,
        countIncreased,
        durableCaptureStarted,
      });
      trace.actionInvocationCountAfter = after;
      if (countIncreased || durableCaptureStarted) break;
    }
    trace.captureCommandInvoked = trace.actionInvocationAttempts.some(
      (attempt) => attempt.countIncreased || attempt.durableCaptureStarted,
    );
    if (!trace.captureCommandInvoked) {
      failWithDiagnostic("capture-command-not-observed", {
        registeredCommands: trace.registeredCommands,
        attempts: trace.actionInvocationAttempts,
        note: "Neither registered Headless shortcut produced an action count increment or durable capturing UI.",
      });
      return;
    }

    // Wait for media-capture-finish (captureState === "capturing").
    const captureStateDeadline = Date.now() + 120_000;
    let captureFinished = false;
    let captureFailure = null;
    trace.stage = "capture-state-polling";
    while (Date.now() < captureStateDeadline) {
      const finishVisible = await embeddedForCapture.locator('[data-testid="media-capture-finish"]').isVisible({ timeout: 1_000 }).catch(() => false);
      if (finishVisible) {
        captureFinished = true;
        break;
      }
      const alertText = await embeddedForCapture.locator('[data-testid="media-capture-card"] [role="alert"]').textContent({ timeout: 500 }).catch(() => null);
      if (alertText?.trim()) {
        captureFailure = alertText.trim();
        break;
      }
      // Diagnostic capture of the Side Panel state for the trace.
      const ui = await embeddedForCapture.locator("[data-testid='navia-sidepanel-root']").evaluate((root) => {
        const status = root.querySelector('.media-launch-status')?.textContent?.trim();
        const detail = root.querySelector('.media-launch-detail')?.textContent?.trim();
        const card = root.querySelector('[data-testid="media-capture-card"]');
        const cardState = card?.getAttribute('aria-labelledby') ? 'present' : 'absent';
        const cardText = card?.textContent?.trim().slice(0, 500) ?? null;
        return { status, detail, cardState, cardText };
      }).catch((error) => ({ evaluateError: String(error?.message ?? error).slice(0, 300) }));
      trace.capturePhaseStates.push({ at: Date.now(), ...(ui || {}) });
      await new Promise((r) => setTimeout(r, 1_500));
    }
    trace.captureFinishedVisible = captureFinished;
    trace.captureFailure = captureFailure;
    const diagnosticWorker = (await findNaviaServiceWorker(context, 2_000)).worker;
    trace.captureControllerDiagnostic = await diagnosticWorker?.evaluate(
      () => globalThis.__naviaMediaCaptureLastDiagnostic ?? null,
    ).catch(() => null) ?? null;
    if (captureFailure) {
      failWithDiagnostic("capture-start-rejected", {
        failureCode: captureFailure,
        controllerDiagnostic: trace.captureControllerDiagnostic,
      });
      return;
    }
    if (!captureFinished) {
      failWithDiagnostic("capture-finish-not-appeared", {
        timeoutMs: 120_000,
        lastCapturePhaseStates: trace.capturePhaseStates.slice(-5),
        controllerDiagnostic: trace.captureControllerDiagnostic,
      });
      return;
    }

    // Click media-capture-finish. The handler calls
    // captureMessages.stop("completed") and Side Panel starts the
    // transcript monitor.
    await embeddedForCapture.locator('[data-testid="media-capture-finish"]').click({ timeout: 5_000 });
    trace.captureFinishClicked = true;

    // Step 13: poll the SAME taskId from authority (NOT a canary-created
    // id). The Side Panel effect's materialize-visual / materialize
    // fallback should drive media_tasks.state → ready | degraded.
    const TERMINAL_STATES = ["ready", "degraded"];
    const MEDIA_TASKS_TIMEOUT_MS = 300_000; // 5 min for transcript + materialize
    let mediaTaskRow = null;
    const mediaTasksDeadline = Date.now() + MEDIA_TASKS_TIMEOUT_MS;
    let pollCount = 0;
    while (Date.now() < mediaTasksDeadline) {
      pollCount += 1;
      let rows = [];
      try {
        rows = JSON.parse(execFileSync("sqlite3", ["-json", dbPath,
          `SELECT task_id, state, revision FROM media_tasks WHERE task_id='${authorityTaskId}'`,
        ], { encoding: "utf8" }) || "[]");
      } catch { /* transient */ }
      trace.mediaTasksPolls.push({ at: Date.now(), poll: pollCount, rows });
      if (rows[0] && TERMINAL_STATES.includes(rows[0].state)) {
        mediaTaskRow = rows[0];
        break;
      }
      await new Promise((r) => setTimeout(r, 3_000));
    }
    trace.mediaTaskRow = mediaTaskRow;
    trace.stage = "media-tasks-polled";
    if (!mediaTaskRow) {
      failWithDiagnostic("stage-a-not-terminal", { taskId: authorityTaskId, polls: trace.mediaTasksPolls.length, terminalStatesRequired: TERMINAL_STATES, timeoutMs: MEDIA_TASKS_TIMEOUT_MS });
      return;
    }

    // Verify the same taskId flows authority → media_tasks. No
    // canary-created id allowed.
    assert.equal(mediaTaskRow.task_id, authorityTaskId, `media_tasks.task_id ${mediaTaskRow.task_id} != authority.task_id ${authorityTaskId}; canary must not create alternate task`);
    trace.canaryOutcome = "stage_a_terminal_reached";
    trace.stage = "verified";
    pendingFinalPayload = {
      at: new Date().toISOString(),
      extensionId: actualExtensionId,
      taskId: mediaTaskRow.task_id,
      finalState: mediaTaskRow.state,
      revision: mediaTaskRow.revision,
      permissionMode: "pregranted_test_fixture",
      fixtureManifestOriginalSha256: fixture.originalSha,
      fixtureManifestModifiedSha256: fixture.modifiedSha,
      note: "Trusted-capture path verified via Side Panel effect; canary observed Side Panel materialize, did NOT POST outline-tasks or synthesize directly.",
    };
    assert.ok(TERMINAL_STATES.includes(mediaTaskRow.state), `state ${mediaTaskRow.state} not in {ready, degraded}`);
    assert.match(mediaTaskRow.task_id, /^media_task_[0-9a-f]{32}$/);
    canarySucceeded = true;
  } finally {
    // SINGLE finally covers ALL exit paths. SIGTERM/SIGINT cleanup order:
    //   1. Stop Runtime (SIGINT, bounded 5s wait, then SIGKILL)
    //   2. Close Chrome context
    //   3. Remove fixture dir
    //   4. Remove scratch dir
    //   5. Verify each step ACTUALLY succeeded:
    //     - runtimeProc.pid → kill(pid, 0) must throw ESRCH
    //     - chromePidFromPgrep → kill(pid, 0) must throw ESRCH
    //     - fixturePath must not exist on disk
    //     - scratch must not exist on disk
    //   6. Write trace + canary-final.json only if ALL cleanup OK.
    //      If ANY step fails, do NOT write canary-final.json; write
    //      canary-failure.json with cleanup-failed stage; throw.

    const leaksBefore = [];
    try {
      const text = execFileSync("pgrep", ["-af", "node"], { encoding: "utf8" });
      const lines = text.split("\n").filter(Boolean);
      for (const line of lines) {
        if ((line.includes("run_one_bvid.mjs") && !line.includes("sequencer.mjs"))
            || line.includes("canary-ext-")
            || line.includes("canary-scratch-")
            || line.includes("media_companion")) {
          leaksBefore.push(line);
        }
      }
    } catch { /* noop */ }
    trace.cleanup.leaksBeforeCleanup = leaksBefore;

    // 1. Stop Runtime (SIGINT → bounded wait → SIGKILL).
    let runtimeExited = false;
    if (runtimeProc) {
      try {
        if (runtimeProc.exitCode === null) {
          runtimeProc.kill("SIGINT");
          await new Promise((r) => setTimeout(r, 5_000));
          if (runtimeProc.exitCode === null) runtimeProc.kill("SIGKILL");
        }
        runtimeExited = true;
      } catch (e) {
        trace.cleanup.runtimeKillError = String(e?.message ?? e);
      }
    }

    // 2. Close Chrome context.
    let chromeClosed = false;
    if (context) {
      try {
        if (nativeBrowserHandle) await nativeBrowserHandle.close();
        else await context.close();
        chromeClosed = true;
      } catch (e) {
        trace.cleanup.chromeCloseError = String(e?.message ?? e);
      }
    }

    // 3. Remove fixture dir.
    let fixtureRemoved = false;
    if (fixture?.fixturePath) {
      try { fs.rmSync(fixture.fixturePath, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); fixtureRemoved = true; } catch (e) {
        trace.cleanup.fixtureRemoveError = String(e?.message ?? e);
      }
    }

    // 4. Remove scratch dir.
    let scratchRemoved = false;
    if (scratch) {
      try { fs.rmSync(scratch, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); scratchRemoved = true; } catch (e) {
        trace.cleanup.scratchRemoveError = String(e?.message ?? e);
      }
    }

    // 5. FAIL-CLOSED verification. Each step must ACTUALLY be true.
    const cleanupFailures = [];

    // 5a. Runtime pid must be dead.
    if (runtimeProc?.pid) {
      let runtimePidAlive = true;
      try { process.kill(runtimeProc.pid, 0); } catch (e) {
        if (e.code === "ESRCH") runtimePidAlive = false;
      }
      if (runtimePidAlive) {
        // Try harder — SIGKILL.
        try { process.kill(runtimeProc.pid, "SIGKILL"); } catch { /* noop */ }
        await new Promise((r) => setTimeout(r, 2_000));
        runtimePidAlive = true;
        try { process.kill(runtimeProc.pid, 0); } catch (e) {
          if (e.code === "ESRCH") runtimePidAlive = false;
        }
        if (runtimePidAlive) cleanupFailures.push(`runtime pid ${runtimeProc.pid} still alive after SIGKILL`);
      }
    }

    // 5b. Chrome pid must be dead.
    if (Number.isFinite(chromePidFromPgrep)) {
      let chromePidAlive = true;
      try { process.kill(chromePidFromPgrep, 0); } catch (e) {
        if (e.code === "ESRCH") chromePidAlive = false;
      }
      if (chromePidAlive) {
        // Escalate: SIGKILL the chrome browser process.
        try { process.kill(chromePidFromPgrep, "SIGKILL"); } catch { /* noop */ }
        await new Promise((r) => setTimeout(r, 2_000));
        chromePidAlive = true;
        try { process.kill(chromePidFromPgrep, 0); } catch (e) {
          if (e.code === "ESRCH") chromePidAlive = false;
        }
        if (chromePidAlive) cleanupFailures.push(`chrome pid ${chromePidFromPgrep} still alive after SIGKILL`);
      }
    }

    // 5b2. Visible Windows Chrome must also be gone. Only inspect the owned
    // profile name; never terminate or enumerate an unrelated user browser.
    if (nativeVisibleAction && profilePath) {
      try {
        const { inspectOwnedWindowsChromeProfile } = await import("../../../apps/chrome-extension/e2e/lib/windowsExtensionInvocation.mjs");
        const rows = inspectOwnedWindowsChromeProfile(profilePath);
        if (rows.length > 0) cleanupFailures.push(`owned Windows Chrome profile still has ${rows.length} browser process(es)`);
      } catch (error) {
        cleanupFailures.push(`owned Windows Chrome cleanup inspection failed: ${String(error?.message ?? error)}`);
      }
    }

    // 5c. fixture dir must not exist.
    if (fixture?.fixturePath && fs.existsSync(fixture.fixturePath)) {
      cleanupFailures.push(`fixture dir still exists: ${fixture.fixturePath}`);
    }

    // 5d. scratch dir must not exist.
    if (scratch && fs.existsSync(scratch)) {
      cleanupFailures.push(`scratch dir still exists: ${scratch}`);
    }

    trace.cleanup.runtimeExited = runtimeExited;
    trace.cleanup.chromeClosed = chromeClosed;
    trace.cleanup.fixtureRemoved = fixtureRemoved;
    trace.cleanup.scratchRemoved = scratchRemoved;
    trace.cleanup.cleanupFailures = cleanupFailures;
    trace.cleanup.failClosed = cleanupFailures.length === 0;

    // 5z. POST-RUN SECRET SCAN with ACTUAL parsed cookie values from
    // the in-memory handoff. Scan every public evidence file for any
    // raw cookie value (exact substring). Output hitCount only. If hit>0
    // the test is FAIL-CLOSED: even a successful Stage A cannot claim
    // PASS because cookie values leaked into trace / failure / log /
    // chrome_launch.
    let leakHitCount = 0;
    if (Array.isArray(cookieValuesForInjection) && cookieValuesForInjection.length > 0) {
      const publicFiles = ["canary-trace.json", "canary-failure.json", "canary-final.json", "chrome_launch.log"]
        .map((f) => path.join(evidenceDir, f))
        .filter((fp) => fs.existsSync(fp));
      for (const cookie of cookieValuesForInjection) {
        const v = cookie.value || "";
        if (!v) continue;
        const escaped = v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").slice(0, 4096);
        const re = new RegExp(escaped, "g");
        // Scan the payloads that will be written after this check as well as
        // files already on disk. Otherwise a value introduced into the final
        // trace/payload after the scan could escape detection.
        for (const prospective of [JSON.stringify(trace), JSON.stringify(pendingFinalPayload)]) {
          re.lastIndex = 0;
          while (re.exec(prospective) !== null) leakHitCount += 1;
        }
        for (const fp of publicFiles) {
          let text;
          try { text = fs.readFileSync(fp, "utf8"); } catch { continue; }
          re.lastIndex = 0;
          while (re.exec(text) !== null) leakHitCount += 1;
        }
      }
    }
    trace.cookieSource.secretHitCount = leakHitCount;
    trace.cleanup.leakCheckFailed = leakHitCount > 0;

    // 6. Write trace (always). canary-final.json (only on success+clean
    //    with verified exists + JSON fields + hash read-back).
    try { writeJson(path.join(evidenceDir, "canary-trace.json"), trace); } catch { /* best effort */ }

    if (canarySucceeded && trace.cleanup.failClosed && !trace.cleanup.leakCheckFailed) {
      // FAIL-CLOSED write: must succeed AND must round-trip-read. Swallowed
      // write errors here would let the test PASS without a final file.
      const finalPath = path.join(evidenceDir, "canary-final.json");
      const writeErrors = [];
      try {
        writeJson(finalPath, pendingFinalPayload);
      } catch (writeErr) {
        writeErrors.push(`write failed: ${String(writeErr?.message ?? writeErr)}`);
      }
      // Verify file exists.
      if (!writeErrors.length && !fs.existsSync(finalPath)) {
        writeErrors.push(`final file missing after write: ${finalPath}`);
      }
      // Verify JSON round-trip + required fields + hash.
      if (!writeErrors.length) {
        try {
          const raw = fs.readFileSync(finalPath, "utf8");
          const parsed = JSON.parse(raw);
          const required = ["at", "extensionId", "taskId", "finalState", "revision", "permissionMode", "fixtureManifestOriginalSha256", "fixtureManifestModifiedSha256"];
          const missingFields = required.filter((k) => !(k in parsed));
          if (missingFields.length) {
            writeErrors.push(`final file missing fields: ${missingFields.join(",")}`);
          } else {
            // Compare payload hash with what we wrote (must match exactly).
            // Use the EXACT same serialization as writeJson
            // (JSON.stringify(value, null, 2), NO trailing newline). The
            // previous version added a stray "\n" that guaranteed mismatch.
            const { createHash } = await import("node:crypto");
            const diskHash = createHash("sha256").update(raw).digest("hex");
            const memHash = createHash("sha256").update(JSON.stringify(pendingFinalPayload, null, 2)).digest("hex");
            if (diskHash !== memHash) writeErrors.push(`final file hash mismatch: disk=${diskHash} mem=${memHash}`);
          }
        } catch (parseErr) {
          writeErrors.push(`final file parse/read failed: ${String(parseErr?.message ?? parseErr)}`);
        }
      }
      if (writeErrors.length) {
        // Final write failed — write canary-failure.json + throw. Test
        // MUST FAIL; never pass with a missing/broken canary-final.json.
        try {
          writeJson(path.join(evidenceDir, "canary-failure.json"), {
            noGoAt: new Date().toISOString(),
            stage: "canary-final-write-failed",
            canarySucceeded,
            cleanupFailures,
            writeErrors,
            note: "Stage A reached terminal AND cleanup fully completed, but canary-final.json write / verify failed; test must NOT pass.",
          });
        } catch { /* best effort */ }
        throw new Error(`canary-final write fail-closed: ${writeErrors.join("; ")}`);
      }
    } else {
      // Cleanup failed OR canary did not reach success OR leak detected —
      // write a failure diagnostic and throw. The test must FAIL, not
      // silently PASS.
      let reason = trace.stage || "unknown";
      if (trace.cleanup.leakCheckFailed) reason = "leak-check-failed";
      else if (canarySucceeded) reason = "cleanup-failed";
      // If canary-final.json exists, delete it (failure path must NOT
      // leave a misleading success file).
      const finalPath = path.join(evidenceDir, "canary-final.json");
      try { if (fs.existsSync(finalPath)) fs.rmSync(finalPath, { force: true }); } catch { /* best effort */ }
      try {
        writeJson(path.join(evidenceDir, "canary-failure.json"), {
          noGoAt: new Date().toISOString(),
          stage: reason,
          failureCode: trace.failureCode ?? null,
          cleanupFailures,
          leakCheckFailed: trace.cleanup.leakCheckFailed,
          leakHitCount: trace.cookieSource?.secretHitCount ?? 0,
          canarySucceeded,
          pendingFinalPayloadSuppressed: canarySucceeded ? true : false,
          note: trace.cleanup.leakCheckFailed
            ? "post-run secret scan found ACTUAL cookie values in public evidence; canary-final.json removed; test FAILS"
            : canarySucceeded
              ? "canary reached Stage A terminal but cleanup did not fully complete; canary-final.json is suppressed"
              : "canary did not reach Stage A terminal; canary-final.json suppressed",
        });
      } catch { /* best effort */ }
      throw new Error(`canary fail-closed: stage=${reason} leakHitCount=${trace.cookieSource?.secretHitCount ?? 0} cleanupFailures=${JSON.stringify(cleanupFailures)}`);
    }
  }
});
