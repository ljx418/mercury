/**
 * WP0 R6-G2 — the seven browser-lifecycle cases, in ONE owned visible Chrome.
 *
 * A NEW task per scenario; no grant is ever reused. Every assertion reads the
 * product's own state (Runtime HTTP/WS, the Runtime DB, the owned filesystem),
 * never a test-side assumption.
 */

import { RawCdp } from "../lib/rawCdp.mjs";
import crypto from "node:crypto";
import { mkdir, writeFile, rm } from "node:fs/promises";
import {
  OUT_ROOT,
  PROFILE_NAME,
  PROFILE_WSL,
  EXTENSION_WIN,
  RUNTIME_ROOT,
  startRuntime,
  stopRuntime,
  startChrome,
  stopChrome,
  issueSession,
  issueGrant,
  runtimeSinks,
  runtimeJson,
  createAcquisition,
  G2_TASK_IDS,
  G2_SOURCE_IDENTITIES
} from "./r6G2OwnedBrowser.mjs";
import {
  inspectOwnedWindowsChromeProfile,
  invokeOwnedPidExtensionShortcut
} from "../lib/windowsExtensionInvocation.mjs";

const CDP = "http://127.0.0.1:9222";
const VIDEO_PREFIX = "https://www.bilibili.com/video/BV1pohR6rEEh";
const EXT_ID = "r6g2extensionidplaceholder";

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const receipts = [];
let SCENARIO_INDEX = 0;
const log = (...a) => console.log("[r6g2]", ...a);

function record(caseId, fields) {
  const receipt = { caseId, ...fields };
  receipts.push(receipt);
  log(caseId, JSON.stringify(fields));
}

/** A fresh task identity per scenario: no task and no grant is reused. */
let taskCounter = 0;
function freshTask() {
  taskCounter += 1;
  return `media_task_${String(taskCounter).repeat(32).slice(0, 32)}`;
}

async function rawAudioResidue() {
  const { readdir } = await import("node:fs/promises");
  const base = `${RUNTIME_ROOT}/media-tasks`;
  const found = [];
  const walk = async (dir) => {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = `${dir}/${entry.name}`;
      if (entry.isDirectory()) await walk(full);
      else if (/\.(wav|pcm|raw)$/i.test(entry.name)) found.push(entry.name);
    }
  };
  await walk(base);
  return found;
}

async function main() {
  await mkdir(OUT_ROOT, { recursive: true });
  let client = null;
  try {
    await startChrome();
    client = await RawCdp.connect(CDP);

    // Chrome 137+ no longer honours --load-extension: install the build over
    // CDP so the ACTUAL production unpacked artifact is what runs.
    let extensionId = null;
    try {
      const loaded = await client.send("Extensions.loadUnpacked", { path: EXTENSION_WIN });
      extensionId = loaded.id;
    } catch (error) {
      log("loadUnpacked failed, falling back to the command-line install:", error.message);
    }
    if (!extensionId) {
      const targets = await client.targets();
      extensionId = targets
        .map((t) => t.url)
        .find((u) => u.startsWith("chrome-extension://") && u.includes("sidepanel.html"))
        ?.split("/")[2];
    }
    if (!extensionId) throw new Error("the owned extension is not installed");
    log("extension id", extensionId);
    await startRuntime(extensionId);

    const { session: worker } = await client.attachToFirstMatching(
      (t) => t.type === "service_worker" && t.url.startsWith(`chrome-extension://${extensionId}/`)
    );
    await worker.send("Runtime.enable", {});

    // The video must be the active tab for the Side Panel to resolve it.
    const { session: video } = await client.attachToFirstMatching(
      (t) => t.type === "page" && t.url.startsWith(VIDEO_PREFIX)
    );
    await video.send("Runtime.enable", {});
    await video.send("Page.enable", {});
    await video.send("Page.bringToFront", {}, {});
    await wait(2000);

    // Open the REAL side panel for the video tab and keep a handle on it.
    // The real Side Panel is its own WebContents and Chrome reports it as an
    // iframe target; the in-page surface carries `naviaInPage=1`.
    const { session: helper } = await client.attachToFirstMatching(
      (t) => (t.type === "page" || t.type === "iframe")
        && t.url.startsWith(`chrome-extension://${extensionId}/sidepanel.html`)
    );
    await helper.send("Runtime.enable", {});
    const before = new Set((await client.targets()).map((t) => t.targetId));
    await helper.evaluate(`(async () => {
      const tabs = await chrome.tabs.query({});
      const video = tabs.find((t) => (t.url || '').startsWith(${JSON.stringify(VIDEO_PREFIX)}));
      await chrome.sidePanel.open({ tabId: video.id });
      return true;
    })()`);
    await wait(4000);
    const panelInfo = (await client.targets()).find(
      (t) => !before.has(t.targetId)
        && (t.type === "page" || t.type === "iframe")
        && t.url.includes(`${extensionId}/sidepanel.html`)
    );
    if (!panelInfo) throw new Error("the real side panel did not open");
    const panel = await client.attach(panelInfo.targetId);
    await panel.send("Runtime.enable", {});
    await panel.send("Emulation.setFocusEmulationEnabled", { enabled: true });
    await wait(4000);
    log("side panel attached:", panelInfo.targetId);

    const panelActiveTab = await panel.evaluate(
      "(async () => { const [t] = await chrome.tabs.query({ active: true, currentWindow: true }); return t?.url ?? null; })()"
    );
    record("R6B-G2-PANEL", {
      panelTargetId: panelInfo.targetId,
      extensionId,
      panelActiveTab,
      ownedProfile: PROFILE_NAME,
      runtimePort: 17861
    });
    if (!String(panelActiveTab).startsWith(VIDEO_PREFIX)) {
      throw new Error(`the side panel is not bound to the video tab (${panelActiveTab})`);
    }
    const tabBinding = await panel.evaluate(`(async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      return { tabId: tab.id, url: tab.url };
    })()`);
    const binding = {
      tabId: tabBinding.tabId,
      pageIdentitySha256: crypto.createHash("sha256").update(tabBinding.url).digest("hex"),
      tabIdSha256: crypto.createHash("sha256").update(String(tabBinding.tabId)).digest("hex")
    };

    // ---------------------------------------------------------------- N01
    // Permission revoked AFTER the grant and ticket were issued, BEFORE any
    // Runtime socket ownership: the frozen PERMISSION_REQUIRED path.
    {
      const taskId = freshTask();
      const session = await issueSession();
      await createAcquisition(session, taskId, G2_SOURCE_IDENTITIES[SCENARIO_INDEX++]);
      const grant = await issueGrant(session, taskId, binding);
      const patched = await worker.evaluate(`(() => {
        if (!globalThis.__naviaR6OriginalPermissionContains) {
          globalThis.__naviaR6OriginalPermissionContains = chrome.permissions.contains.bind(chrome.permissions);
        }
        chrome.permissions.contains = async (details) => details?.permissions?.includes('tabCapture')
          ? false
          : globalThis.__naviaR6OriginalPermissionContains(details);
        return true;
      })()`);
      const response = await armAndTrigger(panel, grant, G2_SOURCE_IDENTITIES[0]);
      const sinks = await runtimeSinks(grant.grant.grantId);
      const raw = await rawAudioResidue();
      record("R6B-N01", {
        permissionBoundaryPatched: patched,
        observedCode: response.failureCode ?? null,
        runtimeStarted: response.state === "capturing",
        activeSinks: sinks.activeCaptureCount,
        residualRawAudioCount: sinks.residualRawAudioCount,
        rawAudioFiles: raw.length,
        taskId
      });
      await worker.evaluate(`(() => {
        chrome.permissions.contains = globalThis.__naviaR6OriginalPermissionContains;
        delete globalThis.__naviaR6OriginalPermissionContains;
        return true;
      })()`);
    }

    // ---------------------------------------------------------------- N02
    // The Offscreen document context is gone when the Port connects: the
    // frozen sender validator must fail closed with PORT_FORBIDDEN.
    {
      const taskId = freshTask();
      const session = await issueSession();
      await createAcquisition(session, taskId, G2_SOURCE_IDENTITIES[SCENARIO_INDEX++]);
      const grant = await issueGrant(session, taskId, binding);
      await worker.evaluate(`(() => {
        globalThis.__naviaR6OriginalGetContexts = chrome.runtime.getContexts.bind(chrome.runtime);
        chrome.runtime.getContexts = async () => [];
        globalThis.__naviaRelayLastFailure = undefined;
        return true;
      })()`);
      const response = await armAndTrigger(panel, grant, G2_SOURCE_IDENTITIES[1], { trigger: false });
      const observedCode = await worker.evaluate("globalThis.__naviaRelayLastFailure ?? null");
      await worker.evaluate(`(() => {
        chrome.runtime.getContexts = globalThis.__naviaR6OriginalGetContexts;
        delete globalThis.__naviaR6OriginalGetContexts;
        return true;
      })()`);
      const sinks = await runtimeSinks(grant.grant.grantId);
      record("R6B-N02", {
        prepareResponse: response,
        observedCode,
        activeSinks: sinks.activeCaptureCount,
        taskId
      });
    }

    // ---------------------------------------------------------------- N03
    // The Offscreen document closes mid-capture: PORT_DISCONNECTED, cleanup zero.
    {
      const taskId = freshTask();
      const session = await issueSession();
      await createAcquisition(session, taskId, G2_SOURCE_IDENTITIES[SCENARIO_INDEX++]);
      const grant = await issueGrant(session, taskId, binding);
      const started = await startCaptureThroughPort(panel, grant, G2_SOURCE_IDENTITIES[2]);
      await worker.evaluate("globalThis.__naviaRelayLastFailure = undefined");
      const closed = await panel.evaluate("chrome.offscreen.closeDocument().then(() => 'closed').catch(e => 'error:' + e.message)");
      await wait(4000);
      const observedCode = await worker.evaluate("globalThis.__naviaRelayLastFailure ?? null");
      const sinks = await runtimeSinks(grant.grant.grantId);
      const raw = await rawAudioResidue();
      record("R6B-N03", {
        captureStarted: started,
        offscreenClosed: closed,
        observedCode,
        activeSinks: sinks.activeCaptureCount,
        residualRawAudioCount: sinks.residualRawAudioCount,
        rawAudioFiles: raw.length,
        taskId
      });
    }

    // ------------------------------------------------------- N05 / N06 / N07
    // Explicit cancel, navigation, and the native control path. Each uses its
    // own task and must end cancelled, with no product materialization.
    for (const [caseId, mode] of [["R6B-N06", "navigation"], ["R6B-N07", "cancel"]]) {
      const taskId = freshTask();
      const session = await issueSession();
      await createAcquisition(session, taskId, G2_SOURCE_IDENTITIES[SCENARIO_INDEX++]);
      const grant = await issueGrant(session, taskId, binding);
      const started = await startCaptureThroughPort(panel, grant, G2_SOURCE_IDENTITIES[SCENARIO_INDEX - 1]);
      let stopped = "n/a";
      if (mode === "cancel") {
        stopped = await deliverProducerStop(panel);
      } else if (mode === "navigation") {
        // Reload keeps the grant's exact page hash stable while still producing
        // the real tabs.onUpdated loading transition owned by navigation stop.
        await video.send("Page.reload", { ignoreCache: true });
        await wait(3000);
        stopped = await deliverProducerStop(panel, "navigation");
      }
      await wait(2500);
      const sinks = await runtimeSinks(grant.grant.grantId);
      const raw = await rawAudioResidue();
      const task = await runtimeJson(`/v1/media/acquisitions/${taskId}`, {
        headers: { Authorization: `Bearer ${session}` }
      });
      const taskState = task.body?.data?.task?.state ?? null;
      const captureStatus = await panel.evaluate(`chrome.runtime.sendMessage({ type: 'navia.mediaCapture', command: 'status' })`);
      record(caseId, {
        mode,
        captureStarted: started,
        stopPath: stopped,
        taskState,
        // A cancelled capture must never have materialized a product.
        materialized: task.body?.data?.task?.currentOutlineId != null,
        busy: ["starting", "capturing", "stopping", "transcribing"].includes(captureStatus?.state),
        activeSinks: sinks.activeCaptureCount,
        residualRawAudioCount: sinks.residualRawAudioCount,
        rawAudioFiles: raw.length,
        taskId
      });
    }

    // ---------------------------------------------------------------- N10
    // A live marker-backed capture whose Service Worker is terminated: the NEW
    // worker must dispatch by phase and observe, never resume old PCM/ticket/
    // sequence, and never claim WORKER_RESTARTED.
    {
      const taskId = freshTask();
      const session = await issueSession();
      await createAcquisition(session, taskId, G2_SOURCE_IDENTITIES[SCENARIO_INDEX++]);
      const grant = await issueGrant(session, taskId, binding);
      const started = await startCaptureThroughPort(panel, grant, G2_SOURCE_IDENTITIES[SCENARIO_INDEX - 1]);
      const markerKey = await panel.evaluate(
        `(async () => { const raw = await chrome.storage.session.get('navia.relay.restartMarker.v10'); return raw ? Object.keys(raw).length : 0; })()`
      );
      const stoppedWorkers = await terminateServiceWorkers(client, extensionId);
      await wait(6000);
      await panel.evaluate(`chrome.runtime.sendMessage({ type: 'navia.mediaCapture', command: 'status' }).catch(() => null)`);
      await wait(1500);
      const restartedWorkerInfo = (await client.targets()).find(
        (target) => target.type === "service_worker" && target.url.startsWith(`chrome-extension://${extensionId}/`)
      );
      const restartedWorker = restartedWorkerInfo ? await client.attach(restartedWorkerInfo.targetId) : null;
      if (restartedWorker) await restartedWorker.send("Runtime.enable", {});
      const restartObservation = restartedWorker ? await restartedWorker.evaluate(`({
        dispatch: globalThis.__naviaRelayRestartDispatch ?? null,
        failure: globalThis.__naviaRelayLastFailure ?? null
      })`) : { dispatch: null, failure: null };
      const markerAfter = await panel.evaluate(
        `(async () => { const raw = await chrome.storage.session.get('navia.relay.restartMarker.v10'); return raw && raw['navia.relay.restartMarker.v10'] ? raw['navia.relay.restartMarker.v10'].phase ?? null : null; })()`
      );
      const markerShape = await panel.evaluate(
        `(async () => { const raw = await chrome.storage.session.get('navia.relay.restartMarker.v10'); return raw?.['navia.relay.restartMarker.v10'] ?? null; })()`
      );
      const markerFields = markerShape && typeof markerShape === "object" ? Object.keys(markerShape) : [];
      const sinks = await runtimeSinks(grant.grant.grantId);
      const raw = await rawAudioResidue();
      record("R6B-N10", {
        captureStarted: started,
        markerKeysBeforeRestart: markerKey,
        terminatedWorkers: stoppedWorkers,
        markerPhaseAfterRestart: markerAfter,
        restartDispatch: restartObservation.dispatch,
        workerRestartedClaimed: restartObservation.failure === "V3_MEDIA_CAPTURE_WORKER_RESTARTED",
        markerFields,
        oldPcmResumed: markerFields.some((field) => /pcm|audio|chunk/i.test(field)),
        oldTicketResumed: markerFields.includes("ticket"),
        oldSequenceResumed: markerFields.some((field) => /sequence|credit/i.test(field)),
        activeSinks: sinks.activeCaptureCount,
        residualRawAudioCount: sinks.residualRawAudioCount,
        rawAudioFiles: raw.length,
        taskId
      });
    }

    // N05 is last because closing the bound video tab intentionally destroys
    // the page that owns the native Side Panel.
    {
      const taskId = freshTask();
      const session = await issueSession();
      await createAcquisition(session, taskId, G2_SOURCE_IDENTITIES[SCENARIO_INDEX++]);
      const grant = await issueGrant(session, taskId, binding);
      const started = await startCaptureThroughPort(panel, grant, G2_SOURCE_IDENTITIES[SCENARIO_INDEX - 1]);
      await client.send("Target.closeTarget", { targetId: video.targetId });
      await wait(4000);
      const sinks = await runtimeSinks(grant.grant.grantId);
      const raw = await rawAudioResidue();
      const task = await runtimeJson(`/v1/media/acquisitions/${taskId}`, {
        headers: { Authorization: `Bearer ${session}` }
      });
      record("R6B-N05", {
        captureStarted: started,
        tabClosed: true,
        activeSinks: sinks.activeCaptureCount,
        residualRawAudioCount: sinks.residualRawAudioCount,
        rawAudioFiles: raw.length,
        taskState: task.body?.data?.task?.state ?? null,
        materialized: task.body?.data?.task?.currentOutlineId != null,
        taskId
      });
    }

    await writeFile(`${OUT_ROOT}/r6g2-receipts.json`, JSON.stringify(receipts, null, 2));
    assertReceipts(receipts);
    log("receipts written:", receipts.length);
  } finally {
    if (client) { try { client.socket.close(); } catch { /* already closed */ } }
    await stopChrome();
    await stopRuntime();
    await rm(`${OUT_ROOT}/runtime.sh`, { force: true });
  }
}

function assertReceipts(allReceipts) {
  const byId = new Map(allReceipts.map((receipt) => [receipt.caseId, receipt]));
  const requireCase = (caseId, predicate) => {
    const receipt = byId.get(caseId);
    if (!receipt || !predicate(receipt)) {
      throw new Error(`${caseId} did not satisfy its production oracle: ${JSON.stringify(receipt ?? null)}`);
    }
  };
  const clean = (receipt) => receipt.activeSinks === 0
    && (receipt.residualRawAudioCount ?? 0) === 0
    && (receipt.rawAudioFiles ?? 0) === 0;
  requireCase("R6B-N01", (r) => r.observedCode === "V3_MEDIA_CAPTURE_PERMISSION_REQUIRED" && !r.runtimeStarted && clean(r));
  requireCase("R6B-N02", (r) => r.observedCode === "V3_MEDIA_CAPTURE_PORT_FORBIDDEN" && clean(r));
  requireCase("R6B-N03", (r) => r.captureStarted === true && r.observedCode === "V3_MEDIA_CAPTURE_PORT_DISCONNECTED" && clean(r));
  for (const caseId of ["R6B-N05", "R6B-N06", "R6B-N07"]) {
    requireCase(caseId, (r) => r.captureStarted === true && r.materialized === false && r.busy !== true && clean(r));
  }
  requireCase("R6B-N10", (r) => r.captureStarted === true
    && typeof r.restartDispatch === "string"
    && r.workerRestartedClaimed === false
    && r.oldPcmResumed === false
    && r.oldTicketResumed === false
    && r.oldSequenceResumed === false
    && clean(r));
}

/** Arm a capture the way the Panel does, then trigger it natively. */
async function armAndTrigger(panel, grantEnvelope, sourceIdentity, options = {}) {
  const prepared = await panel.evaluate(`chrome.runtime.sendMessage({ type: 'navia.mediaCapture', command: 'prepare' })`);
  if (!prepared?.ok) return prepared;
  const armed = await panel.evaluate(`chrome.runtime.sendMessage(${JSON.stringify({
    type: "navia.mediaCapture",
    command: "arm",
    trustedClick: true,
    userActivation: true,
    grant: grantEnvelope.grant,
    ticket: grantEnvelope.ticket,
    sourceIdentity,
    acquisitionRecordId: `mar_${crypto.randomBytes(16).toString("hex")}`
  })})`);
  if (!armed?.ok || options.trigger === false) return armed;
  const action = fireOwnedAction();
  for (let attempt = 0; attempt < 80; attempt += 1) {
    await wait(100);
    const status = await panel.evaluate(`chrome.runtime.sendMessage({ type: 'navia.mediaCapture', command: 'status' })`);
    if (!status?.ok || status.state === "capturing") return status;
  }
  const cleanup = await panel.evaluate(`chrome.runtime.sendMessage({
    type: 'navia.mediaCapture', command: 'stop', reason: 'failed'
  }).catch((error) => ({ ok: false, failureCode: String(error?.message ?? error) }))`);
  return { ok: false, failureCode: "R6_G2_STATUS_TIMEOUT", action, cleanup };
}

function fireOwnedAction() {
  // Resolve exactly one owned browser and fail loudly if native dispatch fails.
  const owned = inspectOwnedWindowsChromeProfile(PROFILE_WSL);
  if (owned.length !== 1) {
    throw new Error(`expected exactly one owned Chrome process for ${PROFILE_NAME}; found ${owned.length}`);
  }
  const output = invokeOwnedPidExtensionShortcut(PROFILE_WSL, owned[0].processId, "execute-action");
  return { processId: owned[0].processId, output };
}

async function startCaptureThroughPort(panel, grantEnvelope, sourceIdentity) {
  const result = await armAndTrigger(panel, grantEnvelope, sourceIdentity);
  return result?.ok === true && result.state === "capturing";
}

async function deliverProducerStop(panel, reason = "cancelled") {
  return panel.evaluate(`chrome.runtime.sendMessage({
    type: 'navia.mediaCapture', command: 'stop', reason: ${JSON.stringify(reason)}
  })`);
}

async function terminateServiceWorkers(client, extensionId) {
  const targets = await client.targets();
  const workers = targets.filter(
    (t) => t.type === "service_worker" && t.url.startsWith(`chrome-extension://${extensionId}/`)
  );
  for (const worker of workers) {
    try {
      await client.send("Target.closeTarget", { targetId: worker.targetId });
    } catch { /* already gone */ }
  }
  return workers.length;
}

main().catch((error) => {
  console.error("[r6g2] FAILED", error);
  process.exitCode = 1;
});
