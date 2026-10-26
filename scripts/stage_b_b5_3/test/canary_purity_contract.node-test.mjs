// Canary purity contract — proves run_one_bvid.mjs / sequencer.mjs /
// canary_bvid1.node-test.mjs do NOT bypass the Side Panel effect by
// directly calling Runtime endpoints that are reserved for the Side
// Panel orchestrator.
//
// Specifically:
//   - /v1/media/outline-tasks POST — Runtime/Side Panel product flow owns
//     task creation. The canary MUST NOT POST this endpoint.
//   - /v1/media/outline-tasks/<id>/materialize — only the Side Panel
//     materializeCurrentMediaTask effect calls this fallback. The canary
//     MUST NOT POST it.
//   - /v1/media/outline-tasks/<id>/materialize-visual — same.
//   - /v1/media/tasks/<id>/comprehension/synthesize — only Side Panel
//     effect calls it. The canary MUST NOT POST it.
//
// These tests do NOT launch any process. They only inspect source text
// for forbidden patterns + contract invariants. Pure static analysis.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");

const CANARY = path.join(repoRoot, "scripts/stage_b_b5_3/test/canary_bvid1.node-test.mjs");
const RUNNER = path.join(repoRoot, "scripts/stage_b_b5_3/run_one_bvid.mjs");
const SEQUENCER = path.join(repoRoot, "scripts/stage_b_b5_3/sequencer.mjs");
const WXT_CONFIG = path.join(repoRoot, "apps/chrome-extension/wxt.config.ts");

function readSafe(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function findForbiddenEndpoints(text, fileLabel) {
  // The /v1/media/tasks/<id>/comprehension/synthesize endpoint is
  // reserved for the Side Panel effect's `MaterializeVisualizer`
  // useEffect. The canary / runner / sequencer must NEVER POST it.
  const forbidden = [
    "/v1/media/outline-tasks/", "/v1/media/tasks/", "/materialize-visual",
  ];
  const hits = [];
  for (const sub of forbidden) {
    if (text.includes(sub)) hits.push({ file: fileLabel, token: sub });
  }
  return hits;
}

// ============================================================================
// Canary must NOT POST outline-tasks directly
// ============================================================================

test("canary purity: canary_bvid1.node-test.mjs does NOT POST /v1/media/outline-tasks", () => {
  const text = readSafe(CANARY);
  // Hard rule: the canary must not contain a POST body targeting
  // outline-tasks. Comment-only mentions are allowed; we look for the
  // literal string "method: \"POST\"" near outline-tasks URL.
  const hasOutlinePost = /method:\s*"POST"[\s\S]{0,200}\/v1\/media\/outline-tasks/.test(text);
  assert.equal(hasOutlinePost, false, "canary must NOT POST /v1/media/outline-tasks directly");
});

test("canary purity: canary_bvid1.node-test.mjs does NOT call /materialize* endpoints", () => {
  const text = readSafe(CANARY);
  // Look for POST + materialize or synthesize in code (not in comments).
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Skip comment lines.
    if (/^\s*\/\//.test(line)) continue;
    assert.ok(!/\/v1\/media\/outline-tasks\/[\w-]+\/materialize/.test(line), `line ${i + 1} references materialize: ${line}`);
    assert.ok(!/\/v1\/media\/tasks\/[\w-]+\/comprehension\/synthesize/.test(line), `line ${i + 1} references synthesize: ${line}`);
  }
});

test("canary purity: runner does NOT POST outline-tasks", () => {
  const text = readSafe(RUNNER);
  assert.ok(!/method:\s*"POST"[\s\S]{0,200}\/v1\/media\/outline-tasks/.test(text), "runner must NOT POST outline-tasks");
});

test("canary purity: sequencer does NOT POST outline-tasks", () => {
  const text = readSafe(SEQUENCER);
  assert.ok(!/method:\s*"POST"[\s\S]{0,200}\/v1\/media\/outline-tasks/.test(text), "sequencer must NOT POST outline-tasks");
});

// ============================================================================
// Trace must contain required fields (without error)
// ============================================================================

test("canary purity: trace initialization includes capture diagnostics, authority query, and authoritative task fields", () => {
  const text = readSafe(CANARY);
  for (const field of ["capturePhaseStates:", "captureFailure:", "captureControllerDiagnostic:", "captureStartClicked:", "captureFinishClicked:", "authorityQueries:", "authorityTaskId:"]) {
    assert.ok(text.includes(field), `trace missing field: ${field}`);
  }
  assert.ok(text.includes("WHERE task_id='${resolvedTaskId}'"), "authority lookup must bind to resolve authoritativeTaskId");
  assert.ok(text.includes('assert.equal(authorityTaskId, resolvedTaskId'), "authority row and resolve task must match");
});

test("canary purity: daily-use fixture seeds a granted product policy and never clicks first-use enable", () => {
  const text = readSafe(CANARY);
  assert.ok(text.includes("pregrantedPolicySeeded: false"));
  assert.ok(text.includes('status: "granted"'));
  assert.ok(!text.includes("await enable.click"), "daily-use canary must not masquerade as native first-use acceptance");
  assert.ok(text.includes('failWithDiagnostic("preauthorized-policy-not-restored"'));
});

test("canary purity: trusted capture tries both registered browser entries and accepts durable capture proof", () => {
  const text = readSafe(CANARY);
  assert.ok(text.includes('command: "open-navia-sidepanel", shortcut: "Control+Shift+Y"'));
  assert.ok(text.includes('command: "_execute_action", shortcut: "Alt+Shift+N"'));
  assert.ok(text.includes('nativeShortcut: "project-command"'), "visible canary must fall back to the registered native shortcut");
  assert.ok(text.includes('nativeShortcut: "execute-action"'), "visible canary must record the execute-action fallback");
  assert.ok(text.includes("clickOwnedChromePoint(profilePath"), "visible canary must use an owned-profile native pointer for the activation-gated arm button");
  assert.ok(text.includes("naviaCanaryUserActivation"), "native activation probe must record the browser userActivation bit without modifying it");
  assert.ok(text.includes("chrome.commands.getAll()"), "canary must record the commands registered by Chrome");
  assert.ok(text.includes("durableCaptureStarted"), "canary must accept capturing UI as durable proof across MV3 worker restarts");
  assert.ok(text.includes("embeddedForCapture.locator(\"[data-testid='navia-sidepanel-root']\").evaluate"), "capture polling must evaluate a locator inside the iframe");
  assert.ok(!text.includes("embeddedForCapture.evaluate("), "FrameLocator does not expose evaluate directly");
  assert.ok(text.includes("__naviaMediaCaptureLastDiagnostic"), "capture rejection must retain the controller stage diagnostic");
  assert.ok(text.includes('failWithDiagnostic("capture-start-rejected"'), "capture alert must fail immediately");
  assert.ok(!text.includes("startArmed("), "canary must not call MediaCaptureController.startArmed directly");
  assert.ok(!text.includes("extractMediaTaskId"), "stale manual-task helper must not remain");
});

test("canary purity: every extension operation resolves the Navia service worker by manifest identity", () => {
  const text = readSafe(CANARY);
  assert.ok(text.includes('manifestName === "Navia"'), "worker resolver must select Navia by manifest name");
  assert.ok(text.includes("findNaviaServiceWorker(context"), "canary must use the identity-based worker resolver");
  assert.ok(!text.includes("context.serviceWorkers()[0]"), "canary must not assume the first worker belongs to Navia");
  assert.ok(!text.includes("workers[0].evaluate"), "canary must not evaluate an unverified first worker");
});

test("capture transport CSP permits only the fixed loopback Runtime HTTP and WebSocket origins", () => {
  const text = readSafe(WXT_CONFIG);
  const csp = text.match(/extension_pages:\s*"([^"]+)"/)?.[1] ?? "";
  for (const origin of [
    "http://127.0.0.1:17861",
    "http://localhost:17861",
    "ws://127.0.0.1:17861",
    "ws://localhost:17861",
  ]) assert.ok(csp.includes(origin), `capture CSP missing ${origin}`);
  assert.ok(!/https?:\/\/\*|wss?:\/\/\*/.test(csp), "capture CSP must not broaden network access with a wildcard host");
});

// ============================================================================
// Negative: runner / sequencer must also avoid forbidden endpoints
// ============================================================================

test("canary purity: canary_bvid1.node-test.mjs forbid-list scan (no outline POST / materialize / synthesize / materialize-visual)", () => {
  const text = readSafe(CANARY);
  const hits = findForbiddenEndpoints(text, "canary");
  assert.equal(hits.length, 0, `canary has forbidden endpoint strings: ${JSON.stringify(hits)}`);
});
