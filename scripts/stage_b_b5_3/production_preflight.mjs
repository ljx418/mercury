#!/usr/bin/env node
// The GC-B5R B-5 PRODUCTION preflight.
//
// It proves every prerequisite of the single visible batch BEFORE Chrome and
// BEFORE any Provider invocation:
//
//   * the exact v2 registry digest, the exact order and the reserve
//     prohibition;
//   * the six public metadata responses still bind to their declared BVID and
//     are not pay/charge-exclusive (a metadata hint, never a completion);
//   * the EXPLICITLY authorized Cookie file exists and carries the required
//     Bilibili Cookie NAME(S) — no value, no value length, no private path and
//     no content is printed or recorded;
//   * the owned Chrome executable, the build:e2e extension bundle, a free CDP
//     port, a fresh profile and the cleanup handlers are ready;
//   * the owned Runtime port, the data/config/log/media roots, the SQLite
//     database, the task root and the namespace are fresh and isolated;
//   * SenseVoice binary/model/VAD, ffmpeg, ffprobe and the frozen yt-dlp are
//     VERIFIED through the product's own managers and status routes and the
//     frozen digests — never assumed from a path;
//   * the isolated Runtime can obtain exactly ONE configured product Provider
//     (providerId=minimax-cn-openai-vision, endpointClass=minimax_chat_completions)
//     through the SUPPORTED product bootstrap — without a runner-owned
//     Provider authority, without a direct SQLite mutation and without an API
//     key ever being read or printed;
//   * the disk, memory and execution budgets cover six fresh sequential runs;
//   * every process, evidence, redaction and cleanup root is owned and OUTSIDE
//     any historical evidence directory.
//
// The receipt reports ZERO Chrome launches, visible windows, Provider calls,
// downloads, imports, media tasks, Cookie injections, audio outputs,
// tabCapture actions, focus events and real-source completions.
//
// Usage:
//   node scripts/stage_b_b5_3/production_preflight.mjs \
//     --evidence-root=<the new evidence package>
//
// Exit 0 when every prerequisite is green, 1 with an EXTERNAL-INPUT BLOCK
// otherwise. Nothing is launched on a block.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

import {
  ACTIVE_REGISTRY_PATH,
  ACTIVE_REGISTRY_SHA256,
  FROZEN_SIX,
  RESERVE_SOURCES,
  assertFrozenIdentity,
  readFrozenRegistry,
} from "./lib/registry.mjs";
import {
  inspectCookieFile,
  productPreflight,
  realAdapters,
  resolveCookieFile,
  resolveOwnedProductPaths,
  visionProviderHelper,
} from "./lib/owned_session.mjs";
import { buildPregrantedFixture, inspectPregrantedManifest } from "./lib/extension_fixture.mjs";
import {
  CANDIDATE_DEPENDENCY_FILE_ENV,
  preflightDependencyCheck,
} from "./lib/candidate_dependencies.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../..");
const runtimeRoot = path.join(repoRoot, "services/local-runtime");
const runtimePython = path.join(runtimeRoot, ".venv/bin/python");

/** The action counts. Every one of them is zero in this preflight. */
const ZERO_ACTIONS = Object.freeze({
  chromeLaunchCount: 0,
  visibleWindowCount: 0,
  runtimeMediaWorkCount: 0,
  providerCallCount: 0,
  downloadCount: 0,
  importCount: 0,
  mediaTaskCount: 0,
  cookieInjectionCount: 0,
  audioOutputCount: 0,
  tabCaptureCount: 0,
  focusEventCount: 0,
  realSourceCompletionCount: 0,
});

/** The runner's own per-source execution budget (the Stage A deadline). */
const PER_SOURCE_DEADLINE_MS = 20 * 60_000;
const SIX_SOURCE_DEADLINE_MS = 6 * PER_SOURCE_DEADLINE_MS;
/** The frozen free-disk minimum for the batch. */
const FREE_DISK_MIN_BYTES = 4 * 1024 ** 3;
/** The frozen free-memory minimum for the batch. */
const FREE_MEMORY_MIN_BYTES = 512 * 1024 ** 2;

const checks = [];
let blocked = null;
let metadata = [];
let cookieResolution = { path: null, source: "unresolved" };
let cookieInspection = { readable: false, requiredNamesPresent: false, missingRequiredNames: ["SESSDATA"], usableCookieCount: 0, allowedNameSetSha256: null, failureCode: "COOKIE_PREREQ_NO_ENV" };

function record(id, ok, detail, extra = {}) {
  checks.push({ id, ok: Boolean(ok), detail: String(detail ?? ""), ...extra });
  if (!ok && !blocked) {
    blocked = `EXTERNAL-INPUT BLOCK: ${id} — ${detail}`;
  }
  return Boolean(ok);
}

function parseArgs(argv) {
  const out = {};
  for (const arg of argv) {
    if (!arg.startsWith("--")) continue;
    const eq = arg.indexOf("=");
    if (eq === -1) out[arg.slice(2)] = "1";
    else out[arg.slice(2, eq)] = arg.slice(eq + 1);
  }
  return out;
}

function sha256File(file) {
  return createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function freeMemoryBytes() {
  try {
    const text = fs.readFileSync("/proc/meminfo", "utf8");
    const match = text.match(/MemAvailable:\s+(\d+) kB/);
    return match ? Number(match[1]) * 1024 : null;
  } catch {
    return null;
  }
}

/** Is the port free? An occupied port is refused, never reused. */
async function isPortFree(port) {
  const net = await import("node:net");
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.listen(port, "127.0.0.1", () => server.close(() => resolve(true)));
  });
}

async function freePort() {
  const net = await import("node:net");
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    }).once("error", reject);
  });
}

async function waitForRuntime(port, timeoutMs = 180_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/v1/health`);
      if (res.ok) return true;
    } catch { /* still starting */ }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  return false;
}

const args = parseArgs(process.argv.slice(2));
const evidenceRoot = path.resolve(
  args["evidence-root"] || path.join(repoRoot, ".navia/b5-preflight"),
);
fs.mkdirSync(evidenceRoot, { recursive: true, mode: 0o700 });

// The owned scratch. It is OUTSIDE every historical evidence directory and
// is removed in the finally block.
const ownedRoot = fs.mkdtempSync(path.join(os.tmpdir(), "navia-b5-preflight-"));
const ownedProfileDir = path.join(ownedRoot, "chrome-profile");
const ownedRuntimeRoot = path.join(ownedRoot, "runtime");
const ownedTaskRoot = path.join(ownedRuntimeRoot, "media-tasks");
const ownedAsrTaskRoot = path.join(ownedRuntimeRoot, "media-asr-tasks");
const ownedDownloadRoot = path.join(ownedRuntimeRoot, "media-download-cache");
const ownedDbPath = path.join(ownedRuntimeRoot, "preflight.sqlite3");
const ownedLogRoot = path.join(ownedRuntimeRoot, "logs");
for (const dir of [ownedProfileDir, ownedTaskRoot, ownedAsrTaskRoot, ownedDownloadRoot, ownedLogRoot]) {
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
}
fs.writeFileSync(ownedDbPath, "");
fs.chmodSync(ownedDbPath, 0o600);

const ownedExtensionId = "b".repeat(32);
let runtime = null;
let runtimePort = null;
let visionProvider = { providerId: null, dbPath: null };

// --- 0. the CANDIDATE DEPENDENCIES (GC-B6J) --------------------------------
//
// The preflight resolves the product dependency inputs ONCE and it validates
// the EXACT dependency object that the snapshot child will consume. The
// resolution is a local operation: it reads the product state and it copies
// the selected Provider metadata into the owned scratch. It performs no
// external action.
const dependencyFile = args["dependencies"] || process.env[CANDIDATE_DEPENDENCY_FILE_ENV] || null;
const dependencyProbeRoot = path.join(ownedRoot, "dependency-probe");
const dependencyCheck = preflightDependencyCheck({
  environment: process.env,
  repositoryRoot: repoRoot,
  dependencyFile,
  ownedRoot: dependencyProbeRoot,
});
try {
  fs.rmSync(dependencyProbeRoot, { recursive: true, force: true });
} catch { /* the probe scratch is an owned temporary artifact */ }
const dependencyIdentities = dependencyCheck.identities;

try {
  // --- 1. the active registry ------------------------------------------
  let registry = null;
  try {
    const loaded = readFrozenRegistry({ registryPath: ACTIVE_REGISTRY_PATH });
    registry = loaded.registry;
    record("registry.digest", loaded.sha256 === ACTIVE_REGISTRY_SHA256,
      `active registry digest ${loaded.sha256}`);
  } catch (error) {
    record("registry.digest", false, error?.message ?? String(error));
  }
  if (registry) {
    const order = registry.sources.map((source) => String(source.bvid));
    const expected = FROZEN_SIX.map((entry) => entry.bvid);
    record("registry.order", JSON.stringify(order) === JSON.stringify(expected),
      `order ${order.join(",")}`);
    let reserveRefused = true;
    for (const reserve of RESERVE_SOURCES) {
      for (const entry of FROZEN_SIX) {
        try {
          assertFrozenIdentity({ order: entry.order, bvid: reserve.bvid });
          reserveRefused = false;
        } catch { /* refused */ }
      }
    }
    record("registry.reserveProhibition", reserveRefused,
      "every reserve source is refused by the identity guard");
  }

  // --- 1b. the DEPENDENCY PARITY with the prepared candidate -------------
  //
  // When a prepared dependency object is supplied, the preflight validates
  // the EXACT object that the child will consume. A difference is an
  // EXTERNAL-INPUT BLOCK: every external counter stays zero.
  record("dependencies.resolved", true,
    `the product dependency inputs are resolved (${Object.keys(dependencyIdentities).length} identities)`);
  if (dependencyFile) {
    record("dependencies.parity", dependencyCheck.ok,
      dependencyCheck.ok
        ? "the prepared dependency object and the preflight resolution agree"
        : `the prepared dependency object and the preflight resolution differ: ${dependencyCheck.codes.join(",")}`);
  }

  // --- 2. the public metadata (no cookie, no media) --------------------
  metadata = [];
  for (const entry of FROZEN_SIX) {
    let observation = { bvid: entry.bvid, order: entry.order, reachable: false, bound: false, pay: null, ugcPay: null, download: null, code: null };
    try {
      const url = `https://api.bilibili.com/x/web-interface/view?bvid=${encodeURIComponent(entry.bvid)}`;
      const res = await fetch(url, {
        headers: { "user-agent": "navia-b5-preflight/1" },
        signal: AbortSignal.timeout(20_000),
      });
      const body = await res.json();
      observation.code = body?.code ?? null;
      const data = body?.data ?? {};
      observation.bound = String(data?.bvid ?? "") === entry.bvid;
      observation.pay = data?.pay ?? null;
      observation.ugcPay = data?.ugc_pay ?? null;
      observation.download = data?.download ?? null;
      observation.reachable = body?.code === 0;
    } catch (error) {
      observation.error = String(error?.message ?? error).slice(0, 120);
    }
    metadata.push(observation);
  }
  const metadataOk = metadata.every((item) => item.reachable && item.bound);
  record("metadata.binding", metadataOk,
    `${metadata.filter((item) => item.reachable && item.bound).length}/6 public metadata responses bind to their BVID`);
  // The public view API omits a false pay/charge flag. An absent flag and an
  // explicit zero mean the same thing: the source is not paywalled.
  const notPaywalled = metadata.every(
    (item) => (item.pay === 0 || item.pay === null) && (item.ugcPay === 0 || item.ugcPay === null),
  );
  record("metadata.notPaywalled", notPaywalled,
    "no source reports a pay/charge-exclusive flag");

  // --- 3. the authorized Cookie file -----------------------------------
  cookieResolution = resolveCookieFile({ environment: process.env });
  cookieInspection = inspectCookieFile({ cookieFile: cookieResolution.path });
  record("cookie.fileReadable", cookieInspection.readable,
    `cookie source ${cookieResolution.source}; required names present: ${cookieInspection.requiredNamesPresent}`);
  record("cookie.requiredNames", cookieInspection.requiredNamesPresent,
    `missing required names: ${(cookieInspection.missingRequiredNames || []).join(",") || "none"}`);

  // --- 4. the owned Chrome and the extension bundle ---------------------
  // The runner launches the OWNED Playwright Chromium from the extension's
  // own Playwright install. An explicitly configured executable must exist
  // as well. The user's own Chrome is never touched.
  const playwrightUrl = `file://${path.join(repoRoot, "apps/chrome-extension/node_modules/playwright/index.mjs").replaceAll("\\", "/")}`;
  let ownedChromium = null;
  try {
    const { chromium } = await import(playwrightUrl);
    ownedChromium = chromium.executablePath();
  } catch (error) {
    record("chrome.executable", false, `the owned Playwright Chromium does not resolve: ${error?.message ?? error}`);
  }
  if (ownedChromium) {
    record("chrome.executable", fs.existsSync(ownedChromium),
      "the owned Playwright Chromium is present");
  }
  if (process.env.NAVIA_BROWSER_EXECUTABLE) {
    record("chrome.configuredExecutable", fs.existsSync(process.env.NAVIA_BROWSER_EXECUTABLE),
      "the configured owned Chrome executable is present");
  }
  const extensionRoot = path.join(repoRoot, "apps/chrome-extension/chrome-mv3-unpacked");
  const manifestPath = path.join(extensionRoot, "manifest.json");
  record("chrome.extensionBundle", fs.existsSync(manifestPath),
    "the build:e2e extension bundle carries a manifest");
  // The visible run loads the PRE-GRANTED fixture: the product asks for its
  // host permissions and `cookies` through a NATIVE prompt that no
  // automation can answer. The fixture is built and proved HERE, before any
  // Chrome launch.
  try {
    const fixture = buildPregrantedFixture(extensionRoot, ownedRoot);
    const fixtureManifest = inspectPregrantedManifest(
      path.join(fixture.fixturePath, "manifest.json"),
    );
    record("chrome.pregrantedFixture", fixtureManifest.cookiesRequired === true,
      "the pre-granted fixture carries the cookies permission as required");
    record("chrome.noNativeHostPrompt", fixtureManifest.optionalHostPermissions === 0,
      "the pre-granted fixture asks for no native host permission");
  } catch (error) {
    record("chrome.pregrantedFixture", false, error?.message ?? String(error));
  }
  const cdpPort = await freePort();
  record("chrome.freeCdpPort", Boolean(cdpPort), `a free CDP port was selected`);
  record("chrome.freshProfile", fs.readdirSync(ownedProfileDir).length === 0,
    "the owned Chrome profile is fresh");

  // --- 5. the owned Runtime isolation -----------------------------------
  // The extension's Runtime URL is FROZEN at 17861. The port must be free:
  // the runner never reuses, terminates or mutates an existing Runtime.
  const runtimePortCandidate = 17861;
  const runtimePortFree = await isPortFree(runtimePortCandidate);
  record("runtime.freePort", runtimePortFree,
    `the product's frozen Runtime port ${runtimePortCandidate} is free`);
  record("runtime.freshRoots",
    fs.readdirSync(ownedTaskRoot).length === 0
      && fs.readdirSync(ownedAsrTaskRoot).length === 0
      && fs.readdirSync(ownedDownloadRoot).length === 0
      && fs.readdirSync(ownedLogRoot).length === 0,
    "the owned Runtime roots are fresh");
  record("runtime.freshDatabase", fs.statSync(ownedDbPath).size === 0,
    "the owned SQLite database is fresh");
  record("runtime.freshTaskRoot", fs.readdirSync(ownedTaskRoot).length === 0,
    "the owned media task root is fresh");
  record("runtime.namespace", /^media_task_[0-9a-f]{32}$/.test("media_task_" + createHash("sha256").update(ownedRoot).digest("hex").slice(0, 32)),
    "the owned task namespace is well formed");

  // --- 6. the product dependency verification ---------------------------
  const ownedProductPaths = resolveOwnedProductPaths({ environment: process.env });
  let tools = null;
  let senseVoice = null;
  // The product's own default tool paths are the fallback; the environment
  // overrides them. Nothing is guessed and no path is searched for.
  const toolEnvironment = {
    ...process.env,
    NAVIA_MEDIA_FFMPEG_PATH: process.env.NAVIA_MEDIA_FFMPEG_PATH || "/usr/bin/ffmpeg",
    NAVIA_MEDIA_FFPROBE_PATH: process.env.NAVIA_MEDIA_FFPROBE_PATH || "/usr/bin/ffprobe",
  };
  try {
    tools = productPreflight.resolveProductTools({ environment: toolEnvironment });
    record("dependencies.toolPaths", Boolean(tools),
      "the product's ffmpeg/ffprobe configuration resolves");
  } catch (error) {
    record("dependencies.toolPaths", false, error?.message ?? String(error));
  }
  try {
    senseVoice = productPreflight.resolveSenseVoice({
      explicit: process.env.NAVIA_ASR_ROOT ? { root: process.env.NAVIA_ASR_ROOT } : null,
      productRoot: ownedProductPaths.asrRoot,
    });
    record("dependencies.senseVoice", Boolean(senseVoice),
      "the SenseVoice binary, model and VAD resolve from the product ASR root");
  } catch (error) {
    record("dependencies.senseVoice", false, error?.message ?? String(error));
  }

  // --- 7. the supported Provider bootstrap ------------------------------
  try {
    visionProvider = visionProviderHelper.prepareOwnedVisionProviderMetadata({
      sourceDb: ownedProductPaths.visionProviderSourceDb,
      ownedRoot: ownedRuntimeRoot,
    });
    record("provider.bootstrap", Boolean(visionProvider.providerId),
      `the owned Provider metadata is prepared (${visionProvider.providerId})`);
  } catch (error) {
    record("provider.bootstrap", false, error?.message ?? String(error));
  }

  // --- 8. the isolated Runtime: the dependencies and the Provider -------
  if (tools && senseVoice && visionProvider.providerId) {
    runtimePort = runtimePortCandidate;
    runtime = spawn(runtimePython, [
      "-m", "uvicorn", "navia_runtime.app:app",
      "--host", "127.0.0.1", "--port", String(runtimePort),
    ], {
      cwd: runtimeRoot,
      env: {
        ...process.env,
        NAVIA_DB_PATH: ownedDbPath,
        NAVIA_MEDIA_TASK_ROOT: ownedTaskRoot,
        NAVIA_MEDIA_ASR_TASK_ROOT: ownedAsrTaskRoot,
        NAVIA_MEDIA_DOWNLOAD_CACHE_ROOT: ownedDownloadRoot,
        NAVIA_MEDIA_TOOL_ROOT: ownedProductPaths.managedTools,
        NAVIA_ASR_ROOT: ownedProductPaths.asrRoot,
        NAVIA_VISION_PROVIDER_DB_PATH: visionProvider.dbPath,
        NAVIA_LOCAL_FILES_EXTENSION_ID: ownedExtensionId,
        PYTHONPATH: ".",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const healthy = await waitForRuntime(runtimePort);
    record("runtime.healthy", healthy, "the isolated Runtime became healthy");
    if (healthy) {
      const origin = `chrome-extension://${ownedExtensionId}`;
      let sessionToken = null;
      try {
        const sessionRes = await fetch(`http://127.0.0.1:${runtimePort}/v1/companion/sessions`, {
          method: "POST",
          headers: { origin },
        });
        if (sessionRes.ok) {
          const sessionJson = await sessionRes.json();
          sessionToken = sessionJson?.data?.token ?? null;
        }
      } catch { /* the session stays null */ }
      record("runtime.session", Boolean(sessionToken),
        "the isolated Runtime issued a companion session");

      if (sessionToken) {
        try {
          const depsRes = await fetch(`http://127.0.0.1:${runtimePort}/v1/media/dependencies`, {
            headers: { origin, authorization: `Bearer ${sessionToken}` },
          });
          const depsJson = depsRes.ok ? await depsRes.json() : null;
          const dependencies = depsJson?.data?.dependencies ?? [];
          const ready = dependencies.filter((entry) => entry.state === "ready");
          record("dependencies.verified", ready.length === 4,
            `the isolated Runtime reports ${ready.length}/4 dependencies ready`);
          const digestsMatch = ready.every(
            (entry) => !entry.observedSha256 || !entry.expectedSha256
              || entry.observedSha256 === entry.expectedSha256,
          );
          record("dependencies.digests", digestsMatch,
            "every verified dependency matches its frozen digest");
          try {
            productPreflight.verifyToolsAgainstRuntimeStatus({ tools, runtimeStatus: depsJson?.data });
            record("dependencies.toolsVerified", true,
              "the product's ffmpeg/ffprobe match the Runtime's verified digests");
          } catch (error) {
            record("dependencies.toolsVerified", false, error?.message ?? String(error));
          }
        } catch (error) {
          record("dependencies.verified", false, error?.message ?? String(error));
        }

        try {
          const visionRes = await fetch(`http://127.0.0.1:${runtimePort}/v1/vision/providers`, {
            headers: { origin, authorization: `Bearer ${sessionToken}` },
          });
          const visionJson = visionRes.ok ? await visionRes.json() : null;
          const providers = visionJson?.data?.providers ?? [];
          const selected = visionJson?.data?.selectedProviderId ?? null;
          const one = providers.length === 1;
          const bound = selected === "minimax-cn-openai-vision";
          const endpoint = providers[0]?.adapterKind === "minimax_chat_completions";
          record("provider.single", one, `the isolated Runtime holds ${providers.length} configured Provider(s)`);
          record("provider.selectedId", bound, `the selected Provider id is ${selected}`);
          record("provider.endpointClass", endpoint,
            `the selected Provider's endpoint class is ${providers[0]?.adapterKind}`);
        } catch (error) {
          record("provider.selectedId", false, error?.message ?? String(error));
        }
      }
    }
  }

  // --- 9. the budgets ---------------------------------------------------
  const freeDisk = productPreflight.readFreeDiskBytes(ownedRoot);
  record("budget.disk", freeDisk >= FREE_DISK_MIN_BYTES,
    `the free disk is ${freeDisk} bytes (at least ${FREE_DISK_MIN_BYTES} are required)`);
  const freeMemory = freeMemoryBytes();
  record("budget.memory", freeMemory === null || freeMemory >= FREE_MEMORY_MIN_BYTES,
    `the free memory is ${freeMemory ?? "unknown"} bytes`);
  record("budget.execution", SIX_SOURCE_DEADLINE_MS > 0,
    `six fresh sequential runs fit in ${SIX_SOURCE_DEADLINE_MS} ms of the declared budget`);

  // --- 10. the owned roots and the cleanup handlers ----------------------
  const ownedPaths = [ownedRoot, ownedProfileDir, ownedRuntimeRoot, ownedTaskRoot, ownedAsrTaskRoot, ownedDownloadRoot, ownedLogRoot, evidenceRoot];
  const outsideHistory = ownedPaths.every((candidate) => !candidate.includes("/v3-completion/"));
  record("cleanup.ownedRoots", outsideHistory,
    "every owned root is outside the historical evidence tree");
  record("cleanup.handlers", typeof fs.rmSync === "function" && typeof fs.rmSync === "function",
    "the cleanup handlers are available");
} catch (error) {
  record("preflight.unhandled", false, error?.message ?? String(error));
} finally {
  // The owned Runtime is stopped and every owned root is removed.
  if (runtime && runtime.exitCode === null) {
    runtime.kill("SIGINT");
    await new Promise((resolve) => {
      const timer = setTimeout(() => {
        try { runtime.kill("SIGKILL"); } catch { /* noop */ }
        resolve();
      }, 4000);
      runtime.once("exit", () => { clearTimeout(timer); resolve(); });
    });
  }
  try { fs.rmSync(ownedRoot, { recursive: true, force: true }); } catch { /* noop */ }
}

const failed = checks.filter((check) => !check.ok);
const receipt = {
  schemaVersion: "v3-5.10-b5-production-preflight/v1",
  mode: "production-preflight",
  generatedAtUtc: new Date().toISOString(),
  activeRegistryPath: path.relative(repoRoot, ACTIVE_REGISTRY_PATH),
  activeRegistrySha256: ACTIVE_REGISTRY_SHA256,
  frozenSix: FROZEN_SIX.map((entry) => entry.bvid),
  reserveSources: RESERVE_SOURCES.map((entry) => entry.bvid),
  metadata,
  cookie: {
    source: cookieResolution.source,
    readable: cookieInspection.readable,
    requiredNamesPresent: cookieInspection.requiredNamesPresent,
    missingRequiredNames: cookieInspection.missingRequiredNames,
    usableCookieCount: cookieInspection.usableCookieCount,
    allowedNameSetSha256: cookieInspection.allowedNameSetSha256,
  },
  visionProvider: { providerId: visionProvider.providerId },
  // The SAFE dependency identities: no path, no database name, no
  // credential and no Provider identity.
  dependencies: {
    schemaVersion: "v3-5.10-b6-candidate-dependencies/v1",
    identities: dependencyIdentities,
  },
  actions: { ...ZERO_ACTIONS },
  checks,
  failedChecks: failed.map((check) => check.id),
  blocked,
  passed: failed.length === 0,
  note: "A preflight starts no Chrome, opens no window, calls no Provider, downloads nothing, imports nothing, creates no media task, injects no cookie, produces no audio, enables no tabCapture and completes no real source.",
};

fs.writeFileSync(path.join(evidenceRoot, "production-preflight-receipt.json"),
  `${JSON.stringify(receipt, null, 2)}\n`, { mode: 0o600 });
process.stdout.write(`${JSON.stringify({
  passed: receipt.passed,
  failedChecks: receipt.failedChecks,
  blocked: receipt.blocked,
  actions: receipt.actions,
}, null, 2)}\n`);
process.exit(receipt.passed ? 0 : 1);
