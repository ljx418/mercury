import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test, { afterEach } from "node:test";

import {
  FROZEN_BOUNDARIES,
  FROZEN_VISIBLE_CASES,
  HarnessError,
  assertSessionPlanIsComplete,
  buildCaseRegistry,
  buildSessionPlan,
  reduceCaseReceipt
} from "./v3WpBVisibleSession/plan.mjs";
import {
  buildVisiblePlan,
  buildVisibleRegistry,
  runVisibleSession,
  waitForOwnedDependencies
} from "./v3WpBVisibleSession/index.mjs";
import {
  assertRequestsReachedOwnedRuntime,
  buildOwnedRuntimeEnvironment,
  buildOwnedRuntimePlan,
  establishCompanionSession,
  startOwnedRuntime
} from "./v3WpBVisibleSession/runtime.mjs";
import {
  buildOwnedChromeArgs,
  launchOwnedChrome,
  loadAndVerifyExtension,
  resolveBuildFlavor,
  waitForDevToolsActivePort,
  waitForCdp
} from "./v3WpBVisibleSession/chrome.mjs";
import {
  resolveProductDependencies,
  resolveProductTools,
  resolveSenseVoice,
  runPreflight,
  verifyToolsAgainstRuntimeStatus
} from "./v3WpBVisibleSession/preflight.mjs";
import {
  assertReceiptIsRedacted,
  buildFailureDiagnostic,
  createOwnedTempRegistry,
  resolveStableEvidenceDestination,
  writeStableReceipt
} from "./v3WpBVisibleSession/receipt.mjs";
import { EXECUTOR as B27 } from "./v3WpBVisibleSession/cases/b27.mjs";
import { prepareOwnedVisionProviderMetadata } from "./v3WpBVisibleSession/visionProvider.mjs";
import { EXECUTOR as B29 } from "./v3WpBVisibleSession/cases/b29.mjs";
import { EXECUTOR as B30 } from "./v3WpBVisibleSession/cases/b30.mjs";
import * as assetsModule from "./v3WpBVisibleSession/assets.mjs";
import {
  createCaseBrowserAdapter,
  isRetriableSidePanelSessionError,
  processRssBytes,
  processTreeRssBytes,
  projectPublishedProduct,
  readSuppliedCookies,
  waitForPortalFacts
} from "./v3WpBVisibleSession/realAdapters.mjs";

function require_assets() {
  return assetsModule;
}

/* ------------------------------------------------------------------ *
 * Recording doubles. They record what the executor DID, so a test can
 * assert the ORDER of the real user path, not just its result.
 * ------------------------------------------------------------------ */

function advancingClock(step = 250) {
  let now = 0;
  return { now: () => now, sleep: async (ms) => { now += ms ?? step; } };
}

// Every root this file creates is removed after EVERY test, so a failing
// assertion can never leave an owned temporary behind.
const ownedRoots = [];

function ownedRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "navia-wp-b-vh-"));
  ownedRoots.push(root);
  return root;
}

afterEach(() => {
  while (ownedRoots.length) {
    const root = ownedRoots.pop();
    try {
      fs.rmSync(root, { recursive: true, force: true });
    } catch {
      // A root that is already gone is not a failure.
    }
  }
  // The stable-evidence scratch roots are owned by this suite too. A failing
  // assertion must not leave one behind.
  for (const entry of fs.readdirSync(os.tmpdir())) {
    if (!entry.startsWith("navia-wp-b-stable-")) continue;
    try {
      fs.rmSync(path.join(os.tmpdir(), entry), { recursive: true, force: true });
    } catch {
      // A root that is already gone is not a failure.
    }
  }
});

function recordingBrowser({ assetBytes = 101_644_359, ...overrides } = {}) {
  const calls = [];
  let metricCall = 0;
  const metricSamples = [];
  const record = (name) => {
    calls.push(name);
    return name;
  };
  const base = {
    calls,
    async beginUploadInterruptionWindow() {
      record("beginUploadInterruptionWindow");
    },
    async endUploadInterruptionWindow() {
      record("endUploadInterruptionWindow");
    },
    async openLocalImportCard() {
      record("openLocalImportCard");
      return { targetId: "target-1" };
    },
    async selectLocalFile() {
      record("selectLocalFile");
      return { selected: true, accepted: true };
    },
    async observeUploadStart(options) {
      record(options?.requireInFlight ? "observeUploadStart:in-flight" : "observeUploadStart");
      return { importId: "media_import_" + "a".repeat(32), sequence: 1 };
    },
    async waitForUploadAbort() {
      record("waitForUploadAbort");
      return { aborted: true, proof: "xhr-onabort" };
    },
    async triggerIdentityChange() {
      record("triggerIdentityChange");
      return {
        before: "portal:bilibili:BV1FIRST:cid:1",
        after: "portal:bilibili:BV1SECOND:cid:1",
        beforeGeneration: 1,
        afterGeneration: 1
      };
    },
    async readPublicStatus() {
      record("readPublicStatus");
      return { state: "ready", sequence: 4 };
    },
    async readCancelObservation() {
      record("readCancelObservation");
      return { cancelRequestCount: 0 };
    },
    async readExtensionStorage() {
      record("readExtensionStorage");
      return { residue: { importId: 0, bearer: 0, uploadToken: 0 } };
    },
    async readUiResidue() {
      record("readUiResidue");
      return { counts: { fileName: 0, importId: 0, token: 0 } };
    },
    async readUploadProgress() {
      record("readUploadProgress");
      return {
        samples: [
          { uploadedBytes: 1 },
          { uploadedBytes: Math.floor(assetBytes / 2) },
          { uploadedBytes: assetBytes }
        ],
        writerSliceMaxBytes: 1_048_576,
        streaming: false,
        finalByteCount: assetBytes
      };
    },
    async readProductProjection() {
      record("readProductProjection");
      return {
        productId: "outline_" + "b".repeat(32),
        taskId: "media_task_" + "c".repeat(32),
        evidenceId: "evidence_" + "d".repeat(32)
      };
    },
    async readThumbnailRoute() {
      record("readThumbnailRoute");
      return { contentType: "image/png", byteLength: 4096 };
    },
    async readCleanupState() {
      record("readCleanupState");
      return { cleanupCount: 1 };
    },
    async readResidue() {
      record("readResidue");
      return { source: 0, sandbox: 0 };
    },
    async readMetrics(label = "sample") {
      record("readMetrics");
      metricCall += 1;
      const sample = {
        rssBytes: 120_000_000 + metricCall * 1_000_000,
        heapBytes: 40_000_000 + metricCall * 1_000_000
      };
      metricSamples.push(sample);
      return sample;
    },
    async beginResourceSampling() {
      record("beginResourceSampling");
      return true;
    },
    async peakResources() {
      record("peakResources");
      if (!metricSamples.length) {
        throw new Error("B30: no resource sample was taken. A point-in-time pair is not a peak.");
      }
      return {
        samples: metricSamples.length,
        peakRssBytes: Math.max(...metricSamples.map((sample) => sample.rssBytes)),
        peakHeapBytes: Math.max(...metricSamples.map((sample) => sample.heapBytes))
      };
    },
    async readAccessibility() {
      record("readAccessibility");
      return {
        keyboard: { passed: true, tabOrder: 4 },
        aria: { passed: true, liveRegion: true },
        viewport: { passed: true, scrollable: true }
      };
    }
  };
  return { ...base, ...overrides };
}

function recordingB27Browser(overrides = {}) {
  const statusOverride = overrides.readPublicStatus;
  const browser = recordingBrowser(overrides);
  browser.readPublicStatus = async () => {
    browser.calls.push("readPublicStatus");
    return statusOverride
      ? statusOverride()
      : { state: "cancelled", sequence: 4 };
  };
  return browser;
}

function recordingRuntime(requests = []) {
  return { requests, baseUrl: "http://127.0.0.1:17861", port: 17861 };
}

/* ------------------------------------------------------------------ *
 * 1. All three cases have real executors and complete oracle schemas.
 * ------------------------------------------------------------------ */

test("every frozen visible case has a real executor and a complete oracle schema", () => {
  const registry = buildVisibleRegistry();
  const plan = buildVisiblePlan(registry);
  assert.equal(plan.length, FROZEN_VISIBLE_CASES.length);
  for (const entry of plan) {
    const executor = registry.get(entry.case);
    assert.ok(executor, `${entry.case} has no executor`);
    assert.equal(executor.placeholder, false, `${entry.case} is still a placeholder`);
    assert.equal(typeof executor.run, "function");
    assert.match(String(executor.run), /\breturn\b/, `${entry.case} never returns a receipt`);
    assert.ok(entry.requiredReceiptFields.length > 0);
    for (const field of entry.requiredReceiptFields) {
      assert.ok(
        executor.requiredReceiptFields.includes(field),
        `${entry.case} does not produce ${field}`,
      );
    }
    assert.ok(entry.requiredInputs.length > 0);
  }
});

test("the completeness rule fails for a missing, placeholder or incomplete executor", () => {
  const frozen = FROZEN_VISIBLE_CASES[0];
  // No executor at all.
  assert.throws(
    () =>
      assertSessionPlanIsComplete(buildSessionPlan(new Map(), { strict: false }), new Map()),
    (error) => error instanceof HarnessError && error.message.includes("no executor"),
  );
  // A throw-only placeholder.
  const placeholderRegistry = buildCaseRegistry({
    [frozen.case]: {
      id: "placeholder",
      placeholder: true,
      requiredInputs: ["x"],
      requiredReceiptFields: ["y"],
      run: () => {
        throw new HarnessError("not implemented");
      }
    }
  });
  const placeholderPlan = buildSessionPlan(placeholderRegistry, { strict: false });
  assert.throws(
    () => assertSessionPlanIsComplete(placeholderPlan, placeholderRegistry),
    (error) => error.message.includes("throw-only placeholder"),
  );
  // An executor that omits a required oracle field.
  const incompleteRegistry = buildCaseRegistry({
    [frozen.case]: {
      id: "incomplete",
      placeholder: false,
      requiredInputs: ["x"],
      requiredReceiptFields: ["notTheRequiredOne"],
      run: () => ({ receipt: true })
    }
  });
  const incompletePlan = buildSessionPlan(incompleteRegistry, { strict: false });
  assert.throws(
    () => assertSessionPlanIsComplete(incompletePlan, incompleteRegistry),
    (error) => error.message.includes("does not produce the required field"),
  );
});

test("a receipt without a required field is a failure, never a default", () => {
  const entry = FROZEN_VISIBLE_CASES[0];
  const registry = buildCaseRegistry({
    [entry.case]: {
      id: "partial",
      placeholder: false,
      requiredInputs: ["x"],
      requiredReceiptFields: entry.requiredReceiptFields,
      run: () => ({ receipt: true })
    }
  });
  assert.throws(
    () => reduceCaseReceipt(entry, registry.get(entry.case), [], {}),
    (error) => error instanceof HarnessError && error.message.includes("missing the required field"),
  );
});

/* ------------------------------------------------------------------ *
 * 2. Runtime ownership, occupied-port refusal, readiness timeout, cleanup.
 * ------------------------------------------------------------------ */

test("the owned Runtime refuses an occupied port and never reuses it", async () => {
  const root = ownedRoot();
  const plan = buildOwnedRuntimePlan({ ownedRoot: root, port: 17_861, extensionId: "a".repeat(32) });
  const adapters = {
    process: {
      run: () => ({ status: 0, stdout: "", stderr: "" }),
      spawnRuntime: () => {
        throw new Error("the Runtime must not be spawned when the port is occupied");
      },
      terminateRuntimeTree: async () => undefined
    },
    net: { isPortFree: async () => false },
    fetch: async () => ({ ok: true })
  };
  await assert.rejects(
    () => startOwnedRuntime({ plan, adapters, clock: undefined }),
    (error) => error instanceof HarnessError && error.message.includes("already in use"),
  );
  fs.rmSync(root, { recursive: true, force: true });
});

test("the owned Runtime uses its own private roots, never the user's", () => {
  const root = ownedRoot();
  const plan = buildOwnedRuntimePlan({ ownedRoot: root, port: 17_861, extensionId: "a".repeat(32) });
  const environment = buildOwnedRuntimeEnvironment(plan, {
    NAVIA_DB_PATH: "/home/somebody/.navia/navia.sqlite3",
    NAVIA_MEDIA_TASK_ROOT: "/home/somebody/.navia/media"
  });
  assert.equal(environment.NAVIA_DB_PATH, plan.dbPath);
  assert.equal(environment.NAVIA_MEDIA_TASK_ROOT, plan.mediaRoot);
  assert.ok(plan.dbPath.startsWith(path.resolve(root)));
  assert.ok(plan.mediaRoot.startsWith(path.resolve(root)));
  assert.ok(plan.logsRoot.startsWith(path.resolve(root)));
  fs.rmSync(root, { recursive: true, force: true });
});

test("the owned Runtime enables observations only in its private E2E process", () => {
  const plan = buildOwnedRuntimePlan({ ownedRoot: "/owned", port: 17861, extensionId: "a".repeat(32) });
  const environment = buildOwnedRuntimeEnvironment(plan, {});
  assert.equal(environment.NAVIA_E2E_LOCAL_IMPORT_OBSERVATIONS, "1");
});

test("the Runtime RSS measurement includes the full owned process tree", () => {
  const snapshot = [
    "100 1 1000",
    "101 100 2000",
    "102 101 3000",
    "200 1 9000"
  ].join("\n");
  assert.equal(processTreeRssBytes(snapshot, 100), 6_000 * 1024);
  assert.equal(processTreeRssBytes(snapshot, 999), null);
});

test("the WP-B Runtime RSS delta measures the service process, not ASR's separate budget", () => {
  const snapshot = [
    "100 1000",
    "101 900000",
    "200 12000",
  ].join("\n");
  assert.equal(processRssBytes(snapshot, 100), 1_000 * 1024);
  assert.equal(processRssBytes(snapshot, 999), null);
  const source = fs.readFileSync(
    path.join(REPOSITORY_ROOT, "apps/chrome-extension/e2e/lib/v3WpBVisibleSession/realAdapters.mjs"),
    "utf8",
  );
  const body = source.slice(source.indexOf("readRuntimeRss(child)"), source.indexOf("inspectBrowserStartup"));
  assert.match(body, /processRssBytes/);
  assert.doesNotMatch(body, /processTreeRssBytes/);
});

test("the supplied-cookie parser preserves HttpOnly SESSDATA and accepts the existing JSON format", () => {
  const root = ownedRoot();
  const netscape = path.join(root, "cookies.txt");
  fs.writeFileSync(netscape, "#HttpOnly_.bilibili.com\tTRUE\t/\tTRUE\t9999999999\tSESSDATA\tprivate-value\n");
  const parsedNetscape = readSuppliedCookies(netscape);
  assert.equal(parsedNetscape.length, 1);
  assert.equal(parsedNetscape[0].httpOnly, true);
  assert.equal(parsedNetscape[0].domain, ".bilibili.com");

  const json = path.join(root, "cookies.json");
  fs.writeFileSync(json, JSON.stringify([{ name: "SESSDATA", value: "private-value", domain: ".bilibili.com", path: "/", secure: true, httpOnly: true }]));
  assert.equal(readSuppliedCookies(json)[0].name, "SESSDATA");
});

test("the product projection reducer reads frame evidence from the production envelope", () => {
  const taskId = `media_task_${"a".repeat(32)}`;
  const outlineId = `outline_${"b".repeat(32)}`;
  const evidenceId = `artifact_${"c".repeat(32)}`;
  const result = projectPublishedProduct({
    data: {
      task: {
        taskId,
        projections: {
          outline: { outlineId, evidence: [{ evidenceId: "wrong", kind: "frame" }] },
          evidenceCatalog: [{ evidenceId, kind: "frame" }]
        }
      }
    }
  });
  assert.deepEqual(result, { taskId, productId: outlineId, evidenceId });
});

test("the owned Runtime times out with a precise block instead of hanging", async () => {
  const root = ownedRoot();
  const plan = buildOwnedRuntimePlan({ ownedRoot: root, port: 17_861, extensionId: "a".repeat(32) });
  let now = 0;
  const adapters = {
    process: {
      run: () => ({ status: 0, stdout: "", stderr: "" }),
      spawnRuntime: () => ({ pid: 4242, exited: false }),
      terminateRuntimeTree: async () => undefined
    },
    net: { isPortFree: async () => true },
    fetch: async () => {
      throw new Error("the Runtime is not listening");
    }
  };
  const runtime = await startOwnedRuntime({
    plan,
    adapters,
    clock: { now: () => now, sleep: async (ms) => { now += ms; } }
  });
  await assert.rejects(
    () => runtime.waitForHealth(1_000),
    (error) => error instanceof HarnessError && error.message.includes("EXTERNAL-INPUT BLOCK"),
  );
  fs.rmSync(root, { recursive: true, force: true });
});

test("the owned Runtime is terminated as a process tree", async () => {
  const root = ownedRoot();
  const plan = buildOwnedRuntimePlan({ ownedRoot: root, port: 17_861, extensionId: "a".repeat(32) });
  const terminated = [];
  const adapters = {
    process: {
      run: () => ({ status: 0, stdout: "", stderr: "" }),
      spawnRuntime: () => ({ pid: 99, exited: false }),
      terminateRuntimeTree: async (child) => terminated.push(child.pid)
    },
    net: { isPortFree: async () => true },
    fetch: async () => ({ ok: true })
  };
  const runtime = await startOwnedRuntime({ plan, adapters, clock: undefined });
  await runtime.stop();
  assert.deepEqual(terminated, [99]);
  fs.rmSync(root, { recursive: true, force: true });
});

test("the companion session is established through the production route", async () => {
  const runtime = recordingRuntime();
  const seen = [];
  const fetchAdapter = async (url, options) => {
    seen.push({ url, method: options?.method ?? "GET" });
    return {
      ok: true,
      status: 201,
      json: async () => ({ ok: true, data: { token: "session-token-value", sessionId: "comp_1" } })
    };
  };
  const session = await establishCompanionSession({ runtime, origin: "chrome-extension://x", fetchAdapter });
  assert.equal(session.token, "session-token-value");
  assert.equal(seen[0].url, "http://127.0.0.1:17861/v1/companion/sessions");
  assert.equal(seen[0].method, "POST");
  assert.throws(
    () => assertRequestsReachedOwnedRuntime(runtime, ["/v1/media/local-imports"]),
    (error) => error.message.includes("No local-import request"),
  );
});

/* ------------------------------------------------------------------ *
 * 3. CDP readiness, loadUnpacked, verification and no relaunch.
 * ------------------------------------------------------------------ */

test("the CDP endpoint is polled before the connection and times out precisely", async () => {
  let now = 0;
  let attempts = 0;
  const fetchAdapter = async () => {
    attempts += 1;
    throw new Error("not listening yet");
  };
  await assert.rejects(
    () =>
      waitForCdp({
        port: 9731,
        fetchAdapter,
        clock: { now: () => now, sleep: async (ms) => { now += ms; } },
        timeoutMs: 1_000
      }),
    (error) => error instanceof HarnessError && error.message.includes("EXTERNAL-INPUT BLOCK"),
  );
  assert.ok(attempts > 1, "the CDP endpoint must be polled, not probed once");
});

test("dynamic CDP reads Chrome's DevToolsActivePort receipt", async () => {
  const root = ownedRoot();
  fs.writeFileSync(path.join(root, "DevToolsActivePort"), "48123\n/devtools/browser/owned\n");
  const requested = [];
  const endpoint = await waitForDevToolsActivePort({
    profileDir: root,
    fetchAdapter: async (url) => {
      requested.push(url);
      return {
        ok: true,
        json: async () => ({ webSocketDebuggerUrl: "ws://127.0.0.1:48123/devtools/browser/owned" })
      };
    }
  });
  assert.equal(endpoint.port, 48_123);
  assert.equal(requested[0], "http://127.0.0.1:48123/json/version");
});

test("the extension is loaded with the browser-level command and verified", async () => {
  const sent = [];
  const browserSession = {
    async send(method, params) {
      sent.push({ method, params });
      return { id: "a".repeat(32) };
    },
    async detach() {
      sent.push({ method: "detach" });
    }
  };
  const context = {
    async findServiceWorker(extensionId) {
      assert.equal(extensionId, "a".repeat(32));
      return "chrome-extension://" + "a".repeat(32) + "/background.js";
    },
    async findSidePanelTarget() {
      return "sidepanel-target-1";
    }
  };
  const verified = await loadAndVerifyExtension({
    browserSession,
    extensionRoot: "C:/build/chrome-mv3",
    context,
    clock: advancingClock()
  });
  assert.equal(sent[0].method, "Extensions.loadUnpacked");
  assert.equal(sent[0].params.path, "C:/build/chrome-mv3");
  assert.equal(verified.extensionId, "a".repeat(32));
  assert.equal(verified.sidePanelTargetId, "sidepanel-target-1");
});

test("extension verification trusts only the id returned by loadUnpacked", async () => {
  const ownedId = "b".repeat(32);
  const unrelatedId = "a".repeat(32);
  const requestedWorkers = [];
  const browserSession = {
    async send() {
      return { id: ownedId };
    },
    async detach() {}
  };
  const verified = await loadAndVerifyExtension({
    browserSession,
    extensionRoot: "C:/build/chrome-mv3",
    context: {
      async readExtensionId() {
        return unrelatedId;
      },
      async findServiceWorker(extensionId) {
        requestedWorkers.push(extensionId);
        return `chrome-extension://${extensionId}/background.js`;
      },
      async findSidePanelTarget() {
        return "sidepanel-target-owned";
      }
    },
    clock: advancingClock()
  });
  assert.equal(verified.extensionId, ownedId);
  assert.deepEqual(requestedWorkers, [ownedId]);
});

test("extension verification rejects a missing loadUnpacked id without guessing", async () => {
  await assert.rejects(
    () => loadAndVerifyExtension({
      browserSession: { send: async () => ({}), detach: async () => undefined },
      extensionRoot: "C:/build/chrome-mv3",
      context: {
        readExtensionId: async () => "a".repeat(32),
        findServiceWorker: async () => "should-not-be-called"
      },
      clock: advancingClock(),
      requireSidePanel: false
    }),
    (error) => error instanceof HarnessError
      && error.message.includes("exact id of the owned Navia extension")
  );
});

test("a verification failure exits without relaunching Chrome", async () => {
  const root = ownedRoot();
  const spawned = [];
  let closed = 0;
  const adapters = {
    process: {
      spawnBrowser: (executable, args) => {
        spawned.push(args);
        return { pid: 7, exited: false };
      },
      terminateBrowserTree: async () => {
        closed += 1;
      }
    },
    browser: {
      connectOverCDP: async () => ({
        newBrowserCDPSession: async () => ({
          send: async () => undefined,
          detach: async () => undefined
        })
      }),
      close: async () => undefined
    },
    context: {
      create: async () => ({
        readExtensionId: async () => null,
        findServiceWorker: async () => null,
        findSidePanelTarget: async () => null
      })
    },
    fetch: async () => ({ ok: true, json: async () => ({ webSocketDebuggerUrl: "ws://x" }) })
  };
  const chrome = await launchOwnedChrome({
    plan: {
      browserExecutable: "chrome.exe",
      cdpPort: 9731,
      profileDir: path.join(root, "profile"),
      extensionRoot: "C:/build/chrome-mv3",
      headless: false,
      environment: {}
    },
    adapters,
    clock: advancingClock()
  });
  await assert.rejects(
    () =>
      loadAndVerifyExtension({
        browserSession: chrome.browserSession,
        extensionRoot: "C:/build/chrome-mv3",
        context: chrome.context,
        clock: advancingClock()
      }),
    (error) => error instanceof HarnessError,
  );
  // The browser is closed, and Chrome is NOT relaunched.
  await chrome.close();
  assert.equal(spawned.length, 1, "Chrome must never be relaunched");
  assert.equal(closed, 1);
  fs.rmSync(root, { recursive: true, force: true });
});

test("the owned Chrome is always muted and never loads the extension from the command line", () => {
  const args = buildOwnedChromeArgs({
    cdpPort: 9731,
    profileDir: "/owned/profile",
    extensionRoot: "C:/build/chrome-mv3",
    headless: false
  });
  assert.ok(args.includes("--mute-audio"));
  assert.ok(!args.some((argument) => argument.startsWith("--load-extension")));
  assert.ok(!args.some((argument) => argument.startsWith("--disable-extensions-except")));
  assert.ok(args.includes("--remote-debugging-port=9731"));
  assert.ok(args.includes("--user-data-dir=/owned/profile"));
  assert.ok(args.includes("--start-minimized"));
  assert.ok(!args.some((argument) => argument.startsWith("--window-position=")));
});

test("a browser mode without chrome.sidePanel fails as an explicit product-seam block", async () => {
  const extensionId = "a".repeat(32);
  const worker = {
    url: () => `chrome-extension://${extensionId}/background.js`,
    async evaluate(callback) {
      globalThis.chrome = { tabs: { query: async () => [] } };
      try {
        return await callback();
      } finally {
        delete globalThis.chrome;
      }
    }
  };
  const browser = createCaseBrowserAdapter({
    context: { serviceWorkers: () => [worker] },
    extensionId,
    runtime: null,
    runtimeBaseUrl: "http://127.0.0.1:17861",
    origin: `chrome-extension://${extensionId}`,
    bearer: "not-observable"
  });

  await assert.rejects(
    () => browser.driveToLastResortCard(),
    (error) => error instanceof HarnessError
      && error.message === "PRODUCT-SEAM BLOCK: chrome.sidePanel is unavailable in this browser mode."
  );
});

test("the build flavor decision is recorded and the bridge never calls an owner", () => {
  const production = resolveBuildFlavor({ requested: "production" });
  const e2e = resolveBuildFlavor({ requested: "e2e" });
  assert.equal(production.bridgeCallsLocalImportOwner, false);
  assert.equal(e2e.bridgeCallsLocalImportOwner, false);
  assert.ok(e2e.reason.length > 10);
});

function visibleCompositionFixture({ failCase = false } = {}) {
  const order = [];
  const runtimeChild = { pid: 41, exited: false };
  const browserChild = { pid: 42, exited: false };
  const browserContext = {
    addCookies: async (cookies) => order.push(`cookies:${cookies.length}`)
  };
  const adapters = {
    environment: {},
    process: {
      run: () => ({ status: 0, stdout: "", stderr: "" }),
      spawnRuntime: () => {
        order.push("runtime-spawn");
        return runtimeChild;
      },
      terminateRuntimeTree: async () => order.push("runtime-stop"),
      spawnBrowser: () => {
        order.push("chrome-spawn");
        return browserChild;
      },
      terminateBrowserTree: async () => order.push("chrome-stop")
    },
    net: { isPortFree: async () => true },
    fetch: async (url, options = {}) => {
      if (url.endsWith("/json/version")) {
        return { ok: true, status: 200, json: async () => ({ webSocketDebuggerUrl: "ws://owned" }) };
      }
      if (url.endsWith("/v1/companion/sessions")) {
        order.push("session");
        return { ok: true, status: 201, json: async () => ({ data: { token: "ephemeral", sessionId: "comp" } }) };
      }
      if (url.endsWith("/v1/media/dependencies")) {
        order.push("dependencies");
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: { generation: "a".repeat(64), dependencies: [] } })
        };
      }
      return { ok: true, status: 200, json: async () => ({ ok: true }) };
    },
    browser: {
      async connectOverCDP() {
        return {
          async newBrowserCDPSession() {
            return {
              send: async () => {
                order.push("extension-load");
                return { id: "a".repeat(32) };
              },
              detach: async () => undefined
            };
          }
        };
      },
      close: async () => order.push("browser-disconnect")
    },
    context: {
      async create() {
        return {
          context: browserContext,
          readExtensionId: async () => "a".repeat(32),
          findServiceWorker: async () => `chrome-extension://${"a".repeat(32)}/background.js`,
          findSidePanelTarget: async () => null
        };
      }
    },
    readDevToolsActivePort() {
      return "9731\n/devtools/browser/owned\n";
    },
    resolveProductDependencies() {
      order.push("dependency-verify");
      return { tools: {}, senseVoice: {} };
    },
    async prepareAssets() {
      order.push("assets");
      return { probeMediaPath: "/owned/probe", assets: {} };
    },
    readSuppliedCookies() {
      order.push("cookies");
      return [{ name: "session", value: "ephemeral", domain: "bilibili.com", path: "/" }];
    },
    createCaseBrowser() {
      order.push("browser-adapter");
      return {
        async openOwnedBilibiliTab(url) {
          order.push(`owned-tab:${url}`);
          return { url };
        },
        async driveToLastResortCard() {
          order.push("user-flow");
          return { reached: "local-media-import-card" };
        },
        async closeCase() {
          order.push("case-close");
        }
      };
    }
  };
  const registry = new Map([
    ["X", {
      async run() {
        order.push("case");
        if (failCase) throw new Error("deliberate case failure");
        return { case: "X", passed: true };
      }
    }]
  ]);
  return {
    order,
    adapters,
    registry,
    plan: [{ case: "X" }]
  };
}

test("the production orchestration uses the exact extension id and cleans both owned processes", async () => {
  const root = ownedRoot();
  const stable = fs.mkdtempSync(path.join(os.tmpdir(), "navia-wp-b-stable-"));
  const fixture = visibleCompositionFixture();
  const receipts = await runVisibleSession({
    ownedRoot: root,
    plan: fixture.plan,
    registry: fixture.registry,
    adapters: fixture.adapters,
    preflight: {
      runtimePort: 17_861,
      cdpPort: 9_731,
      browserExecutable: "chrome.exe",
      extensionRoot: "/built-extension",
      targets: { X: "https://www.bilibili.com/video/BV1FIXTURE0000" },
      cookieFile: "/owned/cookies.txt",
      cookies: [{ name: "SESSDATA", value: "private-fixture", domain: ".bilibili.com", path: "/" }]
    },
    receiptDestination: stable,
    clock: advancingClock()
  });
  assert.deepEqual(receipts, [{ case: "X", passed: true }]);
  assert.deepEqual(fixture.order, [
    "chrome-spawn",
    "extension-load",
    "runtime-spawn",
    "session",
    "dependencies",
    "dependency-verify",
    "cookies:1",
    "assets",
    "browser-adapter",
    "owned-tab:https://www.bilibili.com/video/BV1FIXTURE0000",
    "user-flow",
    "case",
    "case-close",
    "browser-disconnect",
    "chrome-stop",
    "runtime-stop"
  ]);
  assert.equal(fs.existsSync(root), false);
  assert.equal(fs.existsSync(path.join(stable, "visible-session-receipt.json")), true);
  fs.rmSync(stable, { recursive: true, force: true });
});

test("the visible driver waits for client-rendered portal facts before opening the Side Panel", async () => {
  const order = [];
  const page = {
    async waitForTimeout(value) {
      order.push(`wait:${value}`);
    },
    async evaluate() {
      order.push("facts");
      return { mediaId: "BV1restricted", playbackUnitId: "123", restricted: true };
    }
  };
  const facts = await waitForPortalFacts(page, 5_000);
  assert.deepEqual(order, ["wait:5000", "facts"]);
  assert.deepEqual(facts, {
    mediaId: "BV1restricted",
    playbackUnitId: "123",
    restricted: true
  });
});

test("the visible driver fails before Side Panel startup when portal identity never stabilizes", async () => {
  const page = {
    async waitForTimeout() {},
    async evaluate() {
      return { mediaId: null, playbackUnitId: null, restricted: false };
    }
  };
  await assert.rejects(() => waitForPortalFacts(page, 0), /stable media identity/);
});

test("only native Side Panel target/session loss is eligible for a read-channel reattach", () => {
  assert.equal(isRetriableSidePanelSessionError(new Error("Session with given id not found. (Runtime.evaluate)")), true);
  assert.equal(isRetriableSidePanelSessionError(new Error("Target closed")), true);
  assert.equal(isRetriableSidePanelSessionError(new Error("V3_MEDIA_TASK_INVALID")), false);
  assert.equal(isRetriableSidePanelSessionError(new Error("The local-import card is missing")), false);
});

test("the owned dependency preflight repairs only yt-dlp through the product API", async () => {
  const calls = [];
  const runtime = {
    async request(route, options = {}) {
      calls.push({ route, method: options.method ?? "GET", body: options.body ?? null });
      if (route === "/v1/media/dependency-installations") {
        return {
          ok: true,
          json: async () => ({ data: { job: { jobId: `media_dep_job_${"a".repeat(32)}` } } })
        };
      }
      if (route.startsWith("/v1/media/dependency-installations/")) {
        return { ok: true, json: async () => ({ data: { job: { state: "ready" } } }) };
      }
      return {
        ok: true,
        json: async () => ({ data: { generation: "b".repeat(64), dependencies: [] } })
      };
    }
  };
  const status = await waitForOwnedDependencies({
    runtime,
    origin: `chrome-extension://${"a".repeat(32)}`,
    bearer: "ephemeral",
    initial: {
      generation: null,
      dependencies: [{ dependencyId: "yt-dlp", state: "missing" }]
    },
    clock: advancingClock()
  });
  assert.equal(status.generation, "b".repeat(64));
  assert.deepEqual(JSON.parse(calls[0].body), { dependencyIds: ["yt-dlp"] });
  assert.deepEqual(calls.map(({ route, method }) => [method, route]), [
    ["POST", "/v1/media/dependency-installations"],
    ["GET", `/v1/media/dependency-installations/media_dep_job_${"a".repeat(32)}`],
    ["GET", "/v1/media/dependencies"]
  ]);
  await assert.rejects(
    () => waitForOwnedDependencies({
      runtime,
      origin: `chrome-extension://${"a".repeat(32)}`,
      bearer: "ephemeral",
      initial: {
        generation: null,
        dependencies: [{ dependencyId: "sensevoice", state: "missing" }]
      }
    }),
    /cannot establish a verified dependency generation/
  );
});

test("a production-orchestration failure still cleans both processes and writes one diagnostic", async () => {
  const root = ownedRoot();
  const stable = fs.mkdtempSync(path.join(os.tmpdir(), "navia-wp-b-stable-"));
  const fixture = visibleCompositionFixture({ failCase: true });
  await assert.rejects(
    () => runVisibleSession({
      ownedRoot: root,
      plan: fixture.plan,
      registry: fixture.registry,
      adapters: fixture.adapters,
      preflight: {
        runtimePort: 17_861,
        cdpPort: 9_731,
        browserExecutable: "chrome.exe",
        extensionRoot: "/built-extension",
        targets: { X: "https://www.bilibili.com/video/BV1FIXTURE0000" },
        cookieFile: "/owned/cookies.txt",
        cookies: [{ name: "SESSDATA", value: "private-fixture", domain: ".bilibili.com", path: "/" }]
      },
      receiptDestination: stable,
      clock: advancingClock()
    }),
    /deliberate case failure/,
  );
  assert.ok(fixture.order.includes("chrome-stop"));
  assert.ok(fixture.order.includes("runtime-stop"));
  assert.equal(fs.existsSync(root), false);
  const receipt = JSON.parse(fs.readFileSync(path.join(stable, "visible-session-receipt.json"), "utf8"));
  assert.equal(receipt.failure.case, "X");
  fs.rmSync(stable, { recursive: true, force: true });
});

test("a cleanup failure makes an otherwise successful orchestration fail closed", async () => {
  const root = ownedRoot();
  const stable = fs.mkdtempSync(path.join(os.tmpdir(), "navia-wp-b-stable-"));
  const fixture = visibleCompositionFixture();
  fixture.adapters.process.terminateBrowserTree = async () => {
    throw new Error("injected browser cleanup failure");
  };
  await assert.rejects(
    () => runVisibleSession({
      ownedRoot: root,
      plan: fixture.plan,
      registry: fixture.registry,
      adapters: fixture.adapters,
      preflight: {
        runtimePort: 17_861,
        cdpPort: 9_731,
        browserExecutable: "chrome.exe",
        extensionRoot: "/built-extension",
        targets: { X: "https://www.bilibili.com/video/BV1FIXTURE0000" },
        cookieFile: "/owned/cookies.txt",
        cookies: [{ name: "SESSDATA", value: "private-fixture", domain: ".bilibili.com", path: "/" }]
      },
      receiptDestination: stable,
      clock: advancingClock()
    }),
    /Owned Chrome cleanup failed/,
  );
  const receipt = JSON.parse(fs.readFileSync(path.join(stable, "visible-session-receipt.json"), "utf8"));
  assert.equal(receipt.residue.chrome, false);
  assert.match(receipt.failure.failure, /cleanup failed/);
  fs.rmSync(stable, { recursive: true, force: true });
});

/* ------------------------------------------------------------------ *
 * 4. B27 action ordering and receipt reduction.
 * ------------------------------------------------------------------ */

test("B27 drives the real user path in order and reduces a receipt", async () => {
  const browser = recordingB27Browser();
  const runtime = recordingRuntime([
    { method: "PUT", path: `/v1/media/local-imports/media_import_${"a".repeat(32)}/content`, status: 200 },
    { method: "DELETE", path: `/v1/media/local-imports/media_import_${"a".repeat(32)}`, status: 200 }
  ]);
  const receipt = await B27.run({
    browser,
    runtime,
    preflight: { probeMediaPath: "/owned/probe/clip.mp4" },
    record: () => undefined,
    events: []
  });

  assert.equal(receipt.case, "B27");
  assert.equal(receipt.xhrAborted, true);
  assert.equal(receipt.abortProof, "xhr-onabort");
  assert.equal(receipt.deleteObserved, true);
  assert.equal(receipt.statusConverged, true);
  assert.equal(receipt.identityContained, true);
  assert.deepEqual(receipt.residue, {
    storageImportId: 0,
    storageBearer: 0,
    storageUploadToken: 0,
    fileName: 0,
    importId: 0,
    token: 0
  });
  assert.equal(receipt.sequence, 4);
  assert.ok(receipt.importId.startsWith("media_import_"));

  // The ORDER of the real user path.
  const order = browser.calls;
  assert.equal(order[0], "openLocalImportCard");
  assert.equal(order[1], "beginUploadInterruptionWindow");
  assert.equal(order[2], "selectLocalFile");
  assert.equal(order[3], "observeUploadStart:in-flight");
  assert.equal(order[4], "triggerIdentityChange");
  assert.ok(order.indexOf("endUploadInterruptionWindow") > order.indexOf("waitForUploadAbort"));
  assert.ok(order.indexOf("readPublicStatus") > order.indexOf("triggerIdentityChange"));
  assert.ok(order.indexOf("readExtensionStorage") > order.indexOf("readPublicStatus"));
  assert.ok(order.indexOf("readUiResidue") > order.indexOf("readExtensionStorage"));
});

test("B27 fails when the XHR was not aborted, or the DELETE is missing, or residue survives", async () => {
  const runtime = recordingRuntime();
  await assert.rejects(
    () =>
      B27.run({
        browser: recordingB27Browser(),
        runtime,
        preflight: { probeMediaPath: "/owned/probe/clip.mp4" },
        record: () => undefined,
        events: []
      }),
    (error) => error.message.includes("DELETE"),
  );
  await assert.rejects(
    () =>
      B27.run({
        browser: recordingB27Browser({
          async waitForUploadAbort() {
            return { aborted: false };
          }
        }),
        runtime: recordingRuntime([
          { method: "DELETE", path: `/v1/media/local-imports/media_import_${"a".repeat(32)}`, status: 200 }
        ]),
        preflight: { probeMediaPath: "/owned/probe/clip.mp4" },
        record: () => undefined,
        events: []
      }),
    (error) => error.message.includes("not aborted"),
  );
  await assert.rejects(
    () =>
      B27.run({
        browser: recordingB27Browser({
          async readUiResidue() {
            return { counts: { fileName: 1, importId: 0, token: 0 } };
          }
        }),
        runtime: recordingRuntime([
          { method: "DELETE", path: `/v1/media/local-imports/media_import_${"a".repeat(32)}`, status: 200 }
        ]),
        preflight: { probeMediaPath: "/owned/probe/clip.mp4" },
        record: () => undefined,
        events: []
      }),
    (error) => error.message.includes("residue"),
  );
  await assert.rejects(
    () =>
      B27.run({
        browser: recordingB27Browser({
          async readPublicStatus() {
            return { state: "failed", sequence: 4 };
          }
        }),
        runtime: recordingRuntime([
          { method: "DELETE", path: `/v1/media/local-imports/media_import_${"a".repeat(32)}`, status: 200 }
        ]),
        preflight: { probeMediaPath: "/owned/probe/clip.mp4" },
        record: () => undefined,
        events: []
      }),
    (error) => error.message.includes("cancelled"),
  );
});

/* ------------------------------------------------------------------ *
 * 5. B29/B30 progress, resource boundaries, product and accessibility.
 * ------------------------------------------------------------------ */

const HUNDRED_MB_ASSET = {
  path: "/owned/assets/100mb.mp4",
  byteLength: 101_644_359,
  allocatedRatio: 0.97,
  sha256: "a".repeat(64),
  ffprobeSha256: "b".repeat(64),
  nonEmptySegments: 19,
  distinctFrameCount: 3
};

const ONE_GB_ASSET = {
  path: "/owned/assets/1gb.mp4",
  byteLength: 1_050_000_000,
  allocatedRatio: 0.96,
  sha256: "c".repeat(64),
  ffprobeSha256: "d".repeat(64),
  nonEmptySegments: 19,
  distinctFrameCount: 3
};

test("B29 reduces a receipt with the real measurements", async () => {
  const browser = recordingBrowser();
  const runtime = recordingRuntime([
    { method: "PUT", path: `/v1/media/local-imports/media_import_${"a".repeat(32)}/content`, status: 200 }
  ]);
  const receipt = await B29.run({
    browser,
    runtime,
    preflight: { asset: HUNDRED_MB_ASSET },
    record: () => undefined,
    events: []
  });
  assert.equal(receipt.case, "B29");
  assert.equal(receipt.byteLength, HUNDRED_MB_ASSET.byteLength);
  assert.equal(receipt.allocatedRatio, 0.97);
  assert.equal(receipt.progressMonotonic, true);
  assert.equal(receipt.writerSliceMaxBytes, 1_048_576);
  assert.equal(receipt.terminalSequence, 4);
  assert.equal(receipt.cleanupCount, 1);
  assert.equal(receipt.productId.startsWith("outline_"), true);
  assert.equal(receipt.uploads, 1);
});

test("B29 fails on a non-monotonic progress, an oversized writer slice or a missing product", async () => {
  await assert.rejects(
    () =>
      B29.run({
        browser: recordingBrowser({
          async readUploadProgress() {
            return {
              samples: [
                { uploadedBytes: 10 },
                { uploadedBytes: 5 },
                { uploadedBytes: HUNDRED_MB_ASSET.byteLength }
              ],
              writerSliceMaxBytes: 1_048_576,
              streaming: true
            };
          }
        }),
        runtime: recordingRuntime(),
        preflight: { asset: HUNDRED_MB_ASSET },
        record: () => undefined,
        events: []
      }),
    (error) => error.message.includes("monotonic"),
  );
  await assert.rejects(
    () =>
      B29.run({
        browser: recordingBrowser({
          async readUploadProgress() {
            return {
              samples: [{ uploadedBytes: 1 }, { uploadedBytes: HUNDRED_MB_ASSET.byteLength }],
              writerSliceMaxBytes: 2_097_152,
              streaming: true
            };
          }
        }),
        runtime: recordingRuntime(),
        preflight: { asset: HUNDRED_MB_ASSET },
        record: () => undefined,
        events: []
      }),
    (error) => error.message.includes("writer slice"),
  );
  await assert.rejects(
    () =>
      B29.run({
        browser: recordingBrowser({
          async readProductProjection() {
            return { productId: "", taskId: "media_task_" + "c".repeat(32) };
          }
        }),
        runtime: recordingRuntime(),
        preflight: { asset: HUNDRED_MB_ASSET },
        record: () => undefined,
        events: []
      }),
    (error) => error.message.includes("no real product"),
  );
});

test("B30 refuses an asset outside the window, a sparse asset and an unavailable measurement", async () => {
  const base = {
    browser: recordingBrowser({ assetBytes: ONE_GB_ASSET.byteLength }),
    runtime: recordingRuntime(),
    record: () => undefined,
    events: []
  };
  await assert.rejects(
    () => B30.run({ ...base, preflight: { asset: { ...ONE_GB_ASSET, byteLength: 1_000_000_000 } } }),
    (error) => error.message.includes("outside the frozen 1 GB window"),
  );
  await assert.rejects(
    () => B30.run({ ...base, preflight: { asset: { ...ONE_GB_ASSET, allocatedRatio: 0.4 } } }),
    (error) => error.message.includes("sparse"),
  );
  await assert.rejects(
    () =>
      B30.run({
        ...base,
        browser: recordingBrowser({
          async readMetrics() {
            return { rssBytes: 0, heapBytes: 0 };
          },
          async peakResources() {
            throw new Error("B30: a resource measurement was unavailable.");
          }
        }),
        preflight: { asset: ONE_GB_ASSET }
      }),
    (error) => error.message.includes("unavailable"),
  );
});

test("B30 enforces the exact resource boundaries", async () => {
  const base = {
    runtime: recordingRuntime([
      { method: "PUT", path: `/v1/media/local-imports/media_import_${"a".repeat(32)}/content`, status: 200 }
    ]),
    preflight: { asset: ONE_GB_ASSET },
    record: () => undefined,
    events: []
  };
  // Exactly at the bound is allowed.
  const atBound = recordingBrowser({
    assetBytes: ONE_GB_ASSET.byteLength,
    async readMetrics() {
      return { rssBytes: 100_000_000, heapBytes: 50_000_000 };
    }
  });
  const boundSamples = [];
  let call = 0;
  atBound.readMetrics = async () => {
    call += 1;
    const sample = call === 1
      ? { rssBytes: 100_000_000 - FROZEN_BOUNDARIES.runtimeRssDeltaBytesMax, heapBytes: 50_000_000 - FROZEN_BOUNDARIES.extensionHeapDeltaBytesMax }
      : { rssBytes: 100_000_000, heapBytes: 50_000_000 };
    boundSamples.push(sample);
    return sample;
  };
  atBound.peakResources = async () => ({
    samples: boundSamples.length,
    peakRssBytes: Math.max(...boundSamples.map((sample) => sample.rssBytes)),
    peakHeapBytes: Math.max(...boundSamples.map((sample) => sample.heapBytes))
  });
  const receipt = await B30.run({ ...base, browser: atBound });
  assert.equal(receipt.runtimeRssDeltaBytes, FROZEN_BOUNDARIES.runtimeRssDeltaBytesMax);
  assert.equal(receipt.extensionHeapDeltaBytes, FROZEN_BOUNDARIES.extensionHeapDeltaBytesMax);

  // One byte over the bound is a failure.
  const overBound = recordingBrowser({ assetBytes: ONE_GB_ASSET.byteLength });
  const overSamples = [];
  let overCall = 0;
  overBound.readMetrics = async () => {
    overCall += 1;
    const sample = overCall === 1
      ? {
          rssBytes: 100_000_000 - FROZEN_BOUNDARIES.runtimeRssDeltaBytesMax - 1,
          heapBytes: 50_000_000 - FROZEN_BOUNDARIES.extensionHeapDeltaBytesMax
        }
      : { rssBytes: 100_000_000, heapBytes: 50_000_000 };
    overSamples.push(sample);
    return sample;
  };
  overBound.peakResources = async () => ({
    samples: overSamples.length,
    peakRssBytes: Math.max(...overSamples.map((sample) => sample.rssBytes)),
    peakHeapBytes: Math.max(...overSamples.map((sample) => sample.heapBytes))
  });
  await assert.rejects(
    () => B30.run({ ...base, browser: overBound }),
    (error) => error.message.includes("RSS delta"),
  );
});

test("B30 requires the real accessibility oracles against the Side Panel DOM", async () => {
  const base = {
    browser: recordingBrowser({ assetBytes: ONE_GB_ASSET.byteLength }),
    runtime: recordingRuntime(),
    preflight: { asset: ONE_GB_ASSET },
    record: () => undefined,
    events: []
  };
  for (const failing of ["keyboard", "aria", "viewport"]) {
    const browser = recordingBrowser({
      assetBytes: ONE_GB_ASSET.byteLength,
      async readAccessibility() {
        return {
          keyboard: { passed: failing !== "keyboard" },
          aria: { passed: failing !== "aria" },
          viewport: { passed: failing !== "viewport" }
        };
      }
    });
    await assert.rejects(
      () => B30.run({ ...base, browser }),
      (error) => error.message.toLowerCase().includes(failing),
    );
  }
});

test("the native keyboard adapter uses a trusted Enter keyDown with activation text", () => {
  const source = fs.readFileSync(
    path.join(REPOSITORY_ROOT, "apps/chrome-extension/e2e/lib/v3WpBVisibleSession/realAdapters.mjs"),
    "utf8",
  );
  assert.match(source, /name === "Enter"/);
  assert.match(source, /type: "keyDown", text: "\\r", unmodifiedText: "\\r"/);
  assert.match(source, /third !== "local-import-pick"/);
  assert.match(source, /entry\.method === "PUT"/);
  assert.match(source, /media_import_\[a-f0-9\]\{32\}/);
  assert.match(source, /rendererBusy: true/);
});

/* ------------------------------------------------------------------ *
 * 6. The stable redacted evidence.
 * ------------------------------------------------------------------ */

test("the redacted receipt refuses every private shape", () => {
  const clean = {
    case: "B27",
    importId: "media_import_" + "a".repeat(32),
    byteLength: 1024,
    sha256: "b".repeat(64),
    residue: { source: 0, sandbox: 0 }
  };
  assert.equal(assertReceiptIsRedacted(clean), true);
  for (const privateValue of [
    "/home/somebody/.navia/navia.sqlite3",
    "C:\\Users\\Somebody\\Desktop\\seed.mp4",
    "Bearer abcdefghijklmnopqrstuvwx",
    "SESSDATA=abc",
    "apiKey: \"sk-1234567890\"",
    "data:video/mp4;base64,AAAA",
    "transcriptText: \"hello\"",
    "--user-data-dir=/owned/profile"
  ]) {
    assert.throws(
      () => assertReceiptIsRedacted({ ...clean, leaked: privateValue }),
      (error) => error instanceof HarnessError && error.message.includes("not redacted"),
      privateValue,
    );
  }
});

test("the stable receipt survives the owned root's deletion", () => {
  const root = ownedRoot();
  // The stable destination is a SIBLING of the owned root, so the receipt
  // survives the owned root's deletion.
  const stableParent = fs.mkdtempSync(path.join(os.tmpdir(), "navia-wp-b-stable-"));
  const destination = resolveStableEvidenceDestination({
    configured: path.join(stableParent, "visible-session"),
    ownedRoot: root
  });
  const written = writeStableReceipt({
    destination,
    receipt: { schemaVersion: "v3-wp-b-visible-session-receipt/v1", cases: [] }
  });
  fs.rmSync(root, { recursive: true, force: true });
  assert.ok(fs.existsSync(written.file));
  fs.rmSync(stableParent, { recursive: true, force: true });
});

test("the stable evidence destination must be declared", () => {
  assert.throws(
    () => resolveStableEvidenceDestination({ configured: null, ownedRoot: "/repo" }),
    (error) => error instanceof HarnessError && error.message.includes("stable evidence destination"),
  );
});

test("a failed visible run still leaves one redacted diagnostic", () => {
  const diagnostic = buildFailureDiagnostic({
    caseId: "B29",
    error: new Error("failed at /home/somebody/.navia/secret/thing with token abcdefghijklmnop"),
    ownedResidue: { source: 0 }
  });
  assert.equal(diagnostic.case, "B29");
  assert.ok(!diagnostic.failure.includes("/home/somebody"));
  assert.equal(assertReceiptIsRedacted(diagnostic), true);
});

/* ------------------------------------------------------------------ *
 * 7. Every temp path is below the owned root and the cleanup always runs.
 * ------------------------------------------------------------------ */

test("every temporary path is below the owned root", () => {
  const root = ownedRoot();
  const registry = createOwnedTempRegistry({ ownedRoot: root });
  const inside = registry.pathFor("probe/frame-1.png");
  assert.ok(inside.startsWith(path.resolve(root)));
  assert.throws(() => registry.pathFor("../escape.png"), HarnessError);
  assert.throws(() => registry.pathFor("/etc/passwd"), HarnessError);
  fs.rmSync(root, { recursive: true, force: true });
});

test("the temp cleanup runs even when the work failed half way", async () => {
  const root = ownedRoot();
  const registry = createOwnedTempRegistry({ ownedRoot: root });
  const file = registry.pathFor("probe/frame-1.png");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, "x");
  registry.registerFile(file);
  // A simulated ffmpeg failure: the cleanup still has to run.
  await registry.cleanup();
  assert.equal(fs.existsSync(file), false);
  fs.rmSync(root, { recursive: true, force: true });
});

/* ------------------------------------------------------------------ *
 * 8. The preflight and the offline default invocation.
 * ------------------------------------------------------------------ */

test("the preflight stops before Chrome when the seed, the ports or the disk are not ready", async () => {
  const root = ownedRoot();
  const adapters = {
    net: { isPortFree: async () => true },
    fetch: async () => ({ ok: true }),
    dependencySnapshot: null,
    explicitModel: null
  };
  await assert.rejects(
    () =>
      runPreflight({
        ownedRoot: root,
        environment: { NAVIA_WP_B_CDP_PORT: "9731", NAVIA_CHROME_EXECUTABLE: "/does/not/exist" },
        adapters,
        clock: undefined,
        registry: null,
        seedPath: null
      }),
    (error) => error instanceof HarnessError && error.message.includes("EXTERNAL-INPUT BLOCK"),
  );
  fs.rmSync(root, { recursive: true, force: true });
});

test("the preflight parses cookies and resolves every local input before Chrome", async () => {
  const root = ownedRoot();
  const seed = path.join(root, "seed.mp4");
  const cookieFile = path.join(root, "cookies.txt");
  const extensionRoot = path.join(root, "extension");
  const asrRoot = path.join(root, "asr");
  const modelRoot = path.join(asrRoot, "models", "funasr-sensevoice-small-q8");
  const tool = path.join(root, "tool");
  fs.mkdirSync(extensionRoot, { recursive: true });
  fs.mkdirSync(modelRoot, { recursive: true });
  fs.writeFileSync(seed, "private-fixture-media");
  fs.writeFileSync(cookieFile, ".bilibili.com\tTRUE\t/\tTRUE\t1999999999\tSESSDATA\tprivate-fixture\n");
  fs.writeFileSync(path.join(extensionRoot, "manifest.json"), "{}");
  fs.writeFileSync(tool, "tool");
  for (const file of ["llama-funasr-sensevoice", "sensevoice-small-q8.gguf", "fsmn-vad.gguf"]) {
    fs.writeFileSync(path.join(modelRoot, file), file);
  }
  const environment = {
    NAVIA_WP_B_CDP_PORT: "9731",
    NAVIA_CHROME_EXECUTABLE: tool,
    NAVIA_WP_B_EXTENSION_ROOT: extensionRoot,
    NAVIA_MEDIA_FFMPEG_PATH: tool,
    NAVIA_MEDIA_FFPROBE_PATH: tool,
    NAVIA_ASR_ROOT: asrRoot,
    NAVIA_WP_B_COOKIE_FILE: cookieFile,
    NAVIA_WP_B_TARGET_B27: "https://www.bilibili.com/video/BV1FIXTURE0001",
    NAVIA_WP_B_TARGET_B27_SECOND: "https://www.bilibili.com/video/BV1FIXTURE0002",
    NAVIA_WP_B_TARGET_B29: "https://www.bilibili.com/video/BV1FIXTURE0003",
    NAVIA_WP_B_TARGET_B30: "https://www.bilibili.com/video/BV1FIXTURE0004"
  };
  const result = await runPreflight({
    ownedRoot: root,
    environment,
    adapters: {
      net: { isPortFree: async () => true },
      readSuppliedCookies
    },
    registry: { assets: [] },
    seedPath: seed
  });
  assert.equal(result.cookies.length, 1);
  assert.equal(result.cookies[0].name, "SESSDATA");
  assert.equal(result.senseVoice.files.model, path.join(modelRoot, "sensevoice-small-q8.gguf"));
  assert.equal(new Set(Object.values(result.targets)).size, 4);
});

test("the preflight rejects duplicate or non-video Bilibili targets before Chrome", async () => {
  const root = ownedRoot();
  const shared = "https://www.bilibili.com/video/BV1FIXTURE0001";
  await assert.rejects(
    () => runPreflight({
      ownedRoot: root,
      environment: {
        NAVIA_WP_B_CDP_PORT: "9731",
        NAVIA_WP_B_TARGET_B27: shared,
        NAVIA_WP_B_TARGET_B27_SECOND: shared,
        NAVIA_WP_B_TARGET_B29: "https://www.bilibili.com/read/cv1",
        NAVIA_WP_B_TARGET_B30: "https://www.bilibili.com/video/BV1FIXTURE0004"
      },
      adapters: { net: { isPortFree: async () => true } },
      registry: null,
      seedPath: null
    }),
    (error) => error instanceof HarnessError
      && error.message.includes("must identify a Bilibili video page")
  );
});

test("the SenseVoice resolution never guesses a repository default", () => {
  assert.throws(
    () => resolveSenseVoice({ explicit: null, productRoot: null }),
    (error) => error instanceof HarnessError && error.message.includes("No repository default is guessed"),
  );
  // A product ASR root without the model is not a resolution.
  assert.throws(
    () => resolveSenseVoice({ explicit: null, productRoot: "/nowhere/at/all" }),
    (error) => error.message.includes("EXTERNAL-INPUT BLOCK"),
  );
});

test("the product's own tool configuration is required, and it is verified against the Runtime", () => {
  // The paths come from the PRODUCT's environment, never from a guess.
  assert.throws(
    () => resolveProductTools({ environment: {} }),
    (error) => error.message.includes("NAVIA_MEDIA_FFMPEG_PATH"),
  );
  const root = ownedRoot();
  const ffmpeg = path.join(root, "ffmpeg");
  fs.writeFileSync(ffmpeg, "x");
  const tools = resolveProductTools({
    environment: { NAVIA_MEDIA_FFMPEG_PATH: ffmpeg, NAVIA_MEDIA_FFPROBE_PATH: ffmpeg }
  });
  assert.equal(tools.ffmpeg.path, ffmpeg);
  // The digests are checked against the OWNED RUNTIME's own report.
  const verified = verifyToolsAgainstRuntimeStatus({
    tools,
    runtimeStatus: {
      dependencies: [
        { dependencyId: "ffmpeg", state: "ready", observedSha256: "a".repeat(64), expectedSha256: "a".repeat(64) },
        { dependencyId: "ffprobe", state: "ready", observedSha256: "b".repeat(64), expectedSha256: "b".repeat(64) }
      ]
    }
  });
  assert.equal(verified.ffmpeg.sha256, "a".repeat(64));
  // A drifted tool is refused.
  assert.throws(
    () =>
      verifyToolsAgainstRuntimeStatus({
        tools,
        runtimeStatus: {
          dependencies: [
            { dependencyId: "ffmpeg", state: "ready", observedSha256: "c".repeat(64), expectedSha256: "a".repeat(64) },
            { dependencyId: "ffprobe", state: "ready", observedSha256: "b".repeat(64), expectedSha256: "b".repeat(64) }
          ]
        }
      }),
    (error) => error.message.includes("digest does not match"),
  );
  // A missing dependency is refused.
  assert.throws(
    () => verifyToolsAgainstRuntimeStatus({ tools, runtimeStatus: { dependencies: [] } }),
    (error) => error.message.includes("no verified ffmpeg dependency"),
  );
  fs.rmSync(root, { recursive: true, force: true });
});

test("the default and the offline invocation launch zero Runtime and zero Chrome", async () => {
  const root = ownedRoot();
  let spawned = 0;
  let generated = 0;
  const adapters = {
    process: {
      run: () => ({ status: 0, stdout: "", stderr: "" }),
      spawn: () => {
        spawned += 1;
        return { pid: 1, exited: false };
      },
      terminateTree: async () => undefined
    },
    net: { isPortFree: async () => true },
    fetch: async () => ({ ok: true })
  };
  // The offline default never reaches the start.
  await assert.rejects(
    () =>
      runPreflight({
        ownedRoot: root,
        environment: {},
        adapters,
        clock: undefined,
        registry: null,
        seedPath: null
      }),
    (error) => error instanceof HarnessError && error.message.includes("EXTERNAL-INPUT BLOCK"),
  );
  assert.equal(spawned, 0);
  assert.equal(generated, 0);
  fs.rmSync(root, { recursive: true, force: true });
});

/* ------------------------------------------------------------------ *
 * The asset generation: the frozen argv, and the refusal of a sparse
 * or out-of-window result. The assets themselves are never generated
 * here.
 * ------------------------------------------------------------------ */

test("the asset argv follows the frozen generator and loops the seed", () => {
  const { buildAssetArgv } = require_assets();
  const argv = buildAssetArgv({
    asset: { id: "wp-b-real-100mb", targetDurationSeconds: 105 },
    seedPath: "/owned/seed/clip.mp4",
    target: "/owned/assets/wp-b-real-100mb.mp4",
    ffmpegPath: "/usr/bin/ffmpeg",
    generator: {}
  });
  const rendered = argv.join(" ");
  assert.ok(rendered.includes("-c:v libx264"));
  assert.ok(rendered.includes("-pix_fmt yuv420p"));
  assert.ok(rendered.includes("-r 30"));
  assert.ok(rendered.includes("-s 1280x720"));
  assert.ok(rendered.includes("-b:v 8M"));
  assert.ok(rendered.includes("-c:a aac"));
  assert.ok(rendered.includes("-ar 48000"));
  assert.ok(rendered.includes("-ac 2"));
  assert.ok(rendered.includes("-b:a 160k"));
  // The seed is LOOPED, and the duration is a CUT of the loop, never a pad.
  assert.ok(rendered.includes("-stream_loop -1"));
  assert.ok(rendered.includes("-t 105"));
  // The target is under the owned root.
  assert.ok(argv[argv.length - 1].startsWith("/owned/"));
});

test("the asset module never requires a repository default for the model", () => {
  const { FROZEN_GENERATOR } = require_assets();
  assert.equal(FROZEN_GENERATOR.videoCodec, "libx264");
  assert.equal(FROZEN_GENERATOR.audioSampleRate, 48000);
});

/* ------------------------------------------------------------------ *
 * 5. The offline ANTI-FALSE-GREEN tests.
 *
 * Each of these must FAIL when the harness or the product seam is wrong.
 * ------------------------------------------------------------------ */

const REPOSITORY_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../../..");
const EXTENSION_ROOT = path.join(REPOSITORY_ROOT, "apps/chrome-extension");

function readExtension(relative) {
  return fs.readFileSync(path.join(EXTENSION_ROOT, relative), "utf8");
}

/* 1. The diagnostics bridge exists and is E2E-only. */

test("the passive diagnostics surface exists and is installed ONLY in the E2E build", () => {
  const module = readExtension("src/modules/media_companion/localImportDiagnostics.ts");
  const sidePanel = readExtension("entrypoints/sidepanel/main.tsx");
  // The recorder exists and exposes exactly ONE read-only method.
  assert.match(module, /snapshot\(\): LocalImportDiagnosticsSnapshot/);
  assert.match(module, /__naviaE2ELocalImportDiagnostics/);
  // The installation is behind the compile-time E2E gate.
  assert.match(sidePanel, /if \(!__NAVIA_E2E_BRIDGE__\) return;/);
  assert.match(sidePanel, /installLocalImportDiagnostics\(/);
  // The global exposes a snapshot and NOTHING else.
  const install = module.slice(module.indexOf("export function installLocalImportDiagnostics"));
  assert.match(install, /snapshot: \(\) => localImportDiagnostics\.snapshot\(\)/);
  assert.ok(!/create|upload|cancel|poll|bind|materialize|clean/i.test(install.replace(/snapshot: \(\) => localImportDiagnostics\.snapshot\(\)/, "")),
    "the installed diagnostics object may only expose a snapshot");
});

test("the diagnostics recorder cannot invoke a product owner", () => {
  const module = readExtension("src/modules/media_companion/localImportDiagnostics.ts");
  for (const forbidden of [
    "fetch(",
    "XMLHttpRequest",
    "chrome.storage",
    "chrome.runtime",
    "createLocalImportClient",
    "LocalImportManager",
    "document.",
    "window."
  ]) {
    assert.ok(!module.includes(forbidden), `the diagnostics recorder must not use ${forbidden}`);
  }
});

test("the diagnostics snapshot can never carry a credential, a file or raw content", () => {
  const module = readExtension("src/modules/media_companion/localImportDiagnostics.ts");
  // The SNAPSHOT TYPE is what an observer can read. None of its fields may be a
  // credential, a file or raw content.
  const type = module.slice(
    module.indexOf("export type LocalImportDiagnosticsSnapshot"),
    module.indexOf("const MAX_SAMPLES")
  );
  for (const forbidden of [
    "uploadToken",
    "bearer",
    "cookie",
    "file",
    "path",
    "rawMedia",
    "frameBytes",
    "transcriptText",
    "base64"
  ]) {
    assert.ok(
      !new RegExp(`\\b${forbidden}\\w*\\??:`).test(type),
      `the diagnostics snapshot must not declare a ${forbidden} field`
    );
  }
});

test("the Runtime observation channel is E2E-only, read-only and absent by default", () => {
  const runtime = fs.readFileSync(
    path.join(
      REPOSITORY_ROOT,
      "services/local-runtime/navia_runtime/modules/media_companion/local_import/observations.py"
    ),
    "utf8"
  );
  const app = fs.readFileSync(
    path.join(REPOSITORY_ROOT, "services/local-runtime/navia_runtime/app.py"),
    "utf8"
  );
  // The channel is behind the explicit owned-E2E flag.
  assert.match(runtime, /NAVIA_E2E_LOCAL_IMPORT_OBSERVATIONS/);
  assert.match(runtime, /def enabled\(\) -> bool/);
  // The endpoint answers 404 when the channel is off.
  assert.match(app, /if not local_import_observations\.enabled\(\):/);
  assert.match(app, /status_code=404/);
  // The endpoint is a GET: it creates, uploads, cancels, polls, binds,
  // materializes and cleans nothing.
  const route = app.slice(app.indexOf('@app.get("/v1/media/local-import-observations/'));
  const body = route.slice(0, route.indexOf("\n@app."));
  assert.ok(!/\bpost\b|\bput\b|\bdelete\b/i.test(body), "the observation route must be read-only");
  for (const forbidden of [
    "create_import(",
    "begin_stream(",
    ".cancel(",
    "materialize_visual(",
    ".materialize(",
    "bind_local_import("
  ]) {
    assert.ok(!body.includes(forbidden), `the observation route must not call ${forbidden}`);
  }
});

/* 2. The oracles may not be satisfied by a fabrication. */

test("B29 refuses an empty, a single and a final-byte-mismatched progress", async () => {
  const runtime = recordingRuntime([
    { method: "PUT", path: `/v1/media/local-imports/media_import_${"a".repeat(32)}/content`, status: 200 }
  ]);
  const asset = { ...HUNDRED_MB_ASSET, path: "/owned/assets/100mb.mp4" };
  for (const samples of [
    [],
    [{ uploadedBytes: 10 }],
    [{ uploadedBytes: 10 }, { uploadedBytes: asset.byteLength - 1 }]
  ]) {
    await assert.rejects(
      () =>
        B29.run({
          browser: recordingBrowser({
            async readUploadProgress() {
              return { samples, streaming: true, writerSliceMaxBytes: 1_048_576, uploadedBytes: 0, finalByteCount: null };
            }
          }),
          runtime,
          preflight: { asset },
          record: () => undefined,
          events: []
        }),
      (error) => error.message.includes("upload progress did not prove the complete body"),
    );
  }
});

test("B29 and B30 accept only the successful ready terminal", async () => {
  for (const terminal of ["cancelled", "failed"]) {
    await assert.rejects(
      () =>
        B29.run({
          browser: recordingBrowser({
            async readPublicStatus() {
              return { state: terminal, sequence: 9 };
            }
          }),
          runtime: recordingRuntime([
            { method: "PUT", path: `/v1/media/local-imports/media_import_${"a".repeat(32)}/content`, status: 200 }
          ]),
          preflight: { asset: { ...HUNDRED_MB_ASSET, path: "/owned/assets/100mb.mp4" } },
          record: () => undefined,
          events: []
        }),
      (error) => error.message.includes("did not reach the successful ready terminal"),
    );
    await assert.rejects(
      () =>
        B30.run({
          browser: recordingBrowser({
            async readPublicStatus() {
              return { state: terminal, sequence: 9 };
            },
            async readUploadProgress() {
              return {
                samples: [
                  { uploadedBytes: 1 },
                  { uploadedBytes: ONE_GB_ASSET.byteLength }
                ],
                streaming: true,
                writerSliceMaxBytes: 1_048_576,
                uploadedBytes: ONE_GB_ASSET.byteLength,
                finalByteCount: ONE_GB_ASSET.byteLength
              };
            }
          }),
          runtime: recordingRuntime([
            { method: "PUT", path: `/v1/media/local-imports/media_import_${"a".repeat(32)}/content`, status: 200 }
          ]),
          preflight: { asset: ONE_GB_ASSET },
          record: () => undefined,
          events: []
        }),
      (error) => error.message.includes("did not reach the successful ready terminal"),
    );
  }
});

test("B29 and B30 never hardcode a cleanup count, a residue, an id or an evidence id", async () => {
  for (const file of ["b29.mjs", "b30.mjs"]) {
    const source = fs.readFileSync(
      path.join(REPOSITORY_ROOT, "apps/chrome-extension/e2e/lib/v3WpBVisibleSession/cases", file),
      "utf8"
    );
    // The cleanup count and the residue come from the observation, never from a
    // literal in the executor.
    assert.ok(!/cleanupCount\s*:\s*[01]\b/.test(source), `${file} must not hardcode the cleanup count`);
    assert.ok(!/residue\s*:\s*\{\s*source:\s*0/.test(source), `${file} must not hardcode the residue`);
    assert.ok(!/importId\s*:\s*"media_import_/.test(source), `${file} must not hardcode an import id`);
    assert.ok(!/evidenceId\s*:\s*"[a-z0-9_]+"/.test(source), `${file} must not hardcode an evidence id`);
  }
});

test("B30 refuses a point-in-time resource pair and demands a peak", async () => {
  await assert.rejects(
    () =>
      B30.run({
        browser: recordingBrowser({
          async peakResources() {
            return { samples: 1, peakRssBytes: 1, peakHeapBytes: 1 };
          }
        }),
        runtime: recordingRuntime(),
        preflight: { asset: ONE_GB_ASSET },
        record: () => undefined,
        events: []
      }),
    (error) => error.message.includes("A point-in-time pair is not a peak"),
  );
});

test("B30 resource sampling does not health-probe the busy renderer", () => {
  const source = fs.readFileSync(
    path.join(REPOSITORY_ROOT, "apps/chrome-extension/e2e/lib/v3WpBVisibleSession/realAdapters.mjs"),
    "utf8",
  );
  const body = source.slice(
    source.indexOf("async function collectResourceSample"),
    source.indexOf("function startSampling"),
  );
  assert.match(body, /panel \?\? \(await sidePanel\(\)\)/);
  assert.doesNotMatch(body, /panel\.evaluate|page\.evaluate/);
  assert.match(body, /page\.heapUsage\(\)/);
});

test("B30 resource sampling permits only one in-flight CDP metric request", () => {
  const source = fs.readFileSync(
    path.join(REPOSITORY_ROOT, "apps/chrome-extension/e2e/lib/v3WpBVisibleSession/realAdapters.mjs"),
    "utf8",
  );
  const body = source.slice(
    source.indexOf("async function sampleResources"),
    source.indexOf("async function openOwnedBilibiliTab"),
  );
  assert.match(body, /while \(resourceSampleInFlight\)/);
  assert.match(body, /if \(resourceSampleInFlight\) return/);
  assert.match(body, /resourceSampleInFlight = pending/);
});

test("only the passive diagnostic read retries a busy renderer", () => {
  const source = fs.readFileSync(
    path.join(REPOSITORY_ROOT, "apps/chrome-extension/e2e/lib/v3WpBVisibleSession/realAdapters.mjs"),
    "utf8",
  );
  const passive = source.slice(
    source.indexOf("async function passiveDiagnostics"),
    source.indexOf("async function collectResourceSample"),
  );
  const accessibility = source.slice(
    source.indexOf("async readAccessibility"),
    source.indexOf("async closeCase"),
  );
  assert.match(passive, /attempt < 3/);
  assert.match(passive, /CDP timeout: Runtime\.evaluate/);
  assert.doesNotMatch(accessibility, /attempt < 3|CDP timeout/);
});

test("the accessibility oracle uses trusted keyboard input and refuses a DOM-count-only answer", () => {
  const source = fs.readFileSync(
    path.join(REPOSITORY_ROOT, "apps/chrome-extension/e2e/lib/v3WpBVisibleSession/realAdapters.mjs"),
    "utf8"
  );
  // The oracle must hit-test the controls, traverse the focus order and read
  // the live region. A node count alone is not enough.
  assert.match(source, /elementFromPoint/);
  assert.match(source, /getBoundingClientRect/);
  assert.match(source, /document\.activeElement/);
  assert.match(source, /\[aria-live\]/);
  assert.match(source, /page\.keyboard\.press\("Tab"\)/);
  assert.match(source, /page\.keyboard\.press\("Enter"\)/);
  assert.match(source, /focusOrder/);
  const accessibility = source.slice(
    source.indexOf("async readAccessibility"),
    source.indexOf("async closeCase"),
  );
  assert.doesNotMatch(accessibility, /requestAnimationFrame\(/);
  assert.match(accessibility, /const before = await readLayout\(\)/);
  assert.match(accessibility, /const after = await readLayout\(\)/);
});

/* 3. The identity switch and the per-case isolation. */

test("the identity switch navigates the OWNED TAB and never only the hash", () => {
  const source = fs.readFileSync(
    path.join(REPOSITORY_ROOT, "apps/chrome-extension/e2e/lib/v3WpBVisibleSession/realAdapters.mjs"),
    "utf8"
  );
  const block = source.slice(source.indexOf("async triggerIdentityChange("));
  const body = block.slice(0, block.indexOf("async readPublicStatus("));
  assert.match(body, /ownedTab\.goto\(/);
  assert.ok(!/location\.hash/.test(body), "a hash change is not an identity switch");
  // The generation that must change is the IDENTITY generation.
  assert.match(body, /identityGeneration/);
});

test("every case gets a fresh identity in the extension-enabled persistent context", () => {
  const driver = fs.readFileSync(
    path.join(REPOSITORY_ROOT, "apps/chrome-extension/e2e/lib/v3WpBVisibleSession/driver.mjs"),
    "utf8"
  );
  const orchestration = fs.readFileSync(
    path.join(REPOSITORY_ROOT, "apps/chrome-extension/e2e/lib/v3WpBVisibleSession/index.mjs"),
    "utf8"
  );
  // Each case carries its OWN primary identity, and B27 a second one.
  assert.match(driver, /kind: "primary"/);
  assert.match(driver, /kind: "identity-switch"/);
  // An incognito context would not have the unpacked extension. Cases use the
  // persistent context and close their owned tab/Side Panel lifecycle.
  assert.ok(!/newContext\(\)/.test(orchestration));
  assert.match(orchestration, /chrome\.context\.context/);
  assert.match(orchestration, /browser\.closeCase/);
});

test("visible assets use Windows storage while Runtime keeps Unix sandbox semantics", () => {
  const entrypoint = fs.readFileSync(
    path.join(REPOSITORY_ROOT, "apps/chrome-extension/e2e/v3-wp-b-local-import-owned-session.mjs"),
    "utf8"
  );
  const visible = entrypoint.slice(entrypoint.indexOf("async function runVisible()"));
  assert.match(visible, /\.navia\/wp-b\/visible-owned/);
  assert.match(visible, /mkdtempSync\(path\.join\(visibleOwnedParent, "assets-"\)\)/);
  assert.match(visible, /mkdtempSync\(path\.join\(os\.tmpdir\(\), "navia-wp-b-session-"\)\)/);
  assert.match(visible, /createOwnedTempRegistry\(\{ ownedRoot: assetRoot \}\)/);
});

test("the local-import requests are recorded against the OWNED Runtime", () => {
  const source = fs.readFileSync(
    path.join(REPOSITORY_ROOT, "apps/chrome-extension/e2e/lib/v3WpBVisibleSession/realAdapters.mjs"),
    "utf8"
  );
  assert.match(source, /runtime\?\.requests\?\.push/);
  assert.match(source, /url\.origin === runtimeBaseUrl/);
});

test("the product oracle waits for the asynchronous public outline commit", () => {
  const source = fs.readFileSync(
    path.join(REPOSITORY_ROOT, "apps/chrome-extension/e2e/lib/v3WpBVisibleSession/realAdapters.mjs"),
    "utf8"
  );
  const oracle = source.slice(
    source.indexOf("async readProductProjection(importId)"),
    source.indexOf("async readThumbnailRoute", source.indexOf("async readProductProjection(importId)")),
  );
  assert.match(oracle, /while \(Date\.now\(\) - started < 180_000\)/);
  assert.match(oracle, /\/v1\/media\/outline-tasks\/\$\{taskId\}/);
  assert.match(oracle, /product\.evidenceId/);
  assert.match(oracle, /await new Promise/);
});

test("cleanup and residue oracles wait for the asynchronous barrier", () => {
  const source = fs.readFileSync(
    path.join(REPOSITORY_ROOT, "apps/chrome-extension/e2e/lib/v3WpBVisibleSession/realAdapters.mjs"),
    "utf8"
  );
  const cleanup = source.slice(source.indexOf("async readCleanupState"), source.indexOf("async readMetrics"));
  assert.match(cleanup, /cleanupCount >= 1/);
  assert.match(cleanup, /residue\.source === 0 && residue\.sandbox === 0/);
  assert.equal((cleanup.match(/while \(Date\.now\(\) - started < 180_000\)/g) ?? []).length, 2);
});

test("the owned Runtime receives only verified vision metadata, never a copied secret", () => {
  const root = ownedRoot();
  const source = path.join(root, "source.sqlite3");
  fs.writeFileSync(source, "fixture");
  const calls = [];
  const result = prepareOwnedVisionProviderMetadata({
    sourceDb: source,
    ownedRoot: root,
    run(command, args) {
      calls.push({ command, args });
      fs.writeFileSync(path.join(root, "runtime", "vision-providers.sqlite3"), "metadata-only");
      return { status: 0, stdout: "minimax-cn-openai-vision\n", stderr: "" };
    }
  });
  assert.equal(result.providerId, "minimax-cn-openai-vision");
  assert.equal(calls[0].command, "python3");
  assert.ok(!calls[0].args.join(" ").includes("apiKey"));
  assert.ok(result.dbPath.startsWith(root));
});

/* 4. The stable evidence and the cleanup. */

test("the stable evidence may not live inside the owned root", () => {
  const receipt = fs.readFileSync(
    path.join(REPOSITORY_ROOT, "apps/chrome-extension/e2e/lib/v3WpBVisibleSession/receipt.mjs"),
    "utf8"
  );
  assert.match(receipt, /ownedRoot/);
  assert.match(receipt, /stable evidence destination/);
});

test("the owned flow drives the VISIBLE product controls only", () => {
  const driver = fs.readFileSync(
    path.join(REPOSITORY_ROOT, "apps/chrome-extension/e2e/lib/v3WpBVisibleSession/driver.mjs"),
    "utf8"
  );
  for (const control of [
    "media-companion-enable",
    "local-media-import-card"
  ]) {
    assert.ok(driver.includes(control), `the flow must drive ${control}`);
  }
  // The driver may not CALL an owner. The list of forbidden calls is itself a
  // declaration, so it is excluded from the scan.
  const body = driver.slice(
    driver.indexOf("export const USER_FLOW_STEPS"),
    driver.indexOf("export const FORBIDDEN_DRIVER_CALLS")
  );
  for (const forbidden of [
    "localImportEntryEligible(",
    "LocalMediaImportClient",
    "LocalImportManager",
    "LocalMediaConsumerBarrier",
    "MediaProductMaterializer"
  ]) {
    assert.ok(!body.includes(forbidden), `the driver must not use ${forbidden}`);
  }
});

test("the real Side Panel product tree mounts the local-import card", () => {
  const source = fs.readFileSync(
    path.join(REPOSITORY_ROOT, "apps/chrome-extension/entrypoints/sidepanel/main.tsx"),
    "utf8"
  );
  assert.match(source, /<LocalMediaImportCard/);
  assert.match(source, /localImportEntryEligible\(\{/);
  assert.match(source, /createLocalImportRuntimeClient\(\)/);
});

test("the Side Panel local-import gate uses the authoritative derived media activity", () => {
  const sidePanel = readExtension("entrypoints/sidepanel/main.tsx");
  assert.match(sidePanel, /acquisitionState:\s*mediaActivity\.state/);
  assert.doesNotMatch(sidePanel, /acquisitionState:\s*mediaAcquisitionState/);
  assert.match(sidePanel, /hasPublishedMediaProjection\(mediaTaskAuthority\.projection\)/);
  assert.doesNotMatch(
    sidePanel,
    /hasProjection:\s*hasPublishedMediaProjection\(mediaTaskAuthority\.projection\)\s*\|\|\s*restoredOutlineTaskId/,
  );
  const activeAuthorityBranch = sidePanel.slice(
    sidePanel.indexOf('if (authority?.state === "active")'),
    sidePanel.indexOf('if (authority?.state === "published")'),
  );
  assert.match(activeAuthorityBranch, /getMediaCaptureEligibility\(authority\.taskId\)/);
  assert.match(activeAuthorityBranch, /setMediaCaptureEligibility\(eligibility\)/);
});
