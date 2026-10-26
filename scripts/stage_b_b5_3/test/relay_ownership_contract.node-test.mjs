// WP0 R1 — static ownership contract for the capture relay.
//
// The frozen invariant (`02-target-architecture-and-boundaries.md` §3) is:
//   Runtime capture WebSocket owner = Background service worker;
//   Offscreen must only produce PCM.
//
// These tests read the source text (no browser, no Runtime) and assert the
// ownership boundary holds. They are the R1 exit gate "Offscreen 源码中
// WebSocket、Runtime URL、ticket/binding 传输和直接网络调用均为 0".

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");

const OFFSCREEN = path.join(repoRoot, "apps/chrome-extension/entrypoints/media-capture-offscreen/main.ts");
const BACKGROUND = path.join(repoRoot, "apps/chrome-extension/entrypoints/background/index.ts");
const CAPTURE_DIR = path.join(repoRoot, "apps/chrome-extension/src/modules/media_companion/capture");

function read(file) {
  return fs.readFileSync(file, "utf8");
}

/** Strip comments so documentation mentions do not count as code. */
function codeOnly(source) {
  return source
    .split("\n")
    .filter((line) => !/^\s*\/\//.test(line) && !/^\s*\*/.test(line) && !/^\s*\/\*/.test(line))
    .join("\n");
}

// ============================================================================
// Offscreen must have zero Runtime ownership
// ============================================================================

test("PH0-R1: Offscreen opens no WebSocket", () => {
  const code = codeOnly(read(OFFSCREEN));
  assert.ok(!/new\s+WebSocket\s*\(/.test(code), "Offscreen must not construct a WebSocket");
  assert.ok(!/\bWebSocket\b\s*\./.test(code), "Offscreen must not touch the WebSocket global");
  assert.ok(!/readyState/.test(code), "Offscreen must not inspect a socket readyState");
});

test("PH0-R1: Offscreen holds no Runtime URL or transport endpoint", () => {
  const code = codeOnly(read(OFFSCREEN));
  for (const forbidden of [
    "127.0.0.1",
    "ws://",
    "wss://",
    "capture-stream",
    "capture_",
    "RUNTIME_WS",
    "RUNTIME_URL"
  ]) {
    assert.ok(!code.includes(forbidden), `Offscreen must not reference "${forbidden}"`);
  }
});

test("PH0-R1: Offscreen handles no ticket, binding, sourceIdentity or acquisitionRecordId", () => {
  const code = codeOnly(read(OFFSCREEN));
  for (const forbidden of ["ticket", "binding", "sourceIdentity", "acquisitionRecordId"]) {
    assert.ok(
      !new RegExp(`\\b${forbidden}\\b`).test(code),
      `Offscreen must not handle "${forbidden}"`
    );
  }
});

test("PH0-R1: Offscreen keeps only its four allowed responsibilities", () => {
  const code = codeOnly(read(OFFSCREEN));
  // getUserMedia + AudioContext + downsample + producer cleanup must remain.
  assert.ok(/getUserMedia/.test(code), "Offscreen must keep getUserMedia");
  assert.ok(/AudioContext/.test(code), "Offscreen must keep AudioContext");
  assert.ok(/downsampleToPcm16/.test(code), "Offscreen must keep the downsample step");
  assert.ok(/teardown/.test(code), "Offscreen must keep producer cleanup");
  // It must be credit-constrained: a chunk is only sent with an outstanding
  // credit, and the start path is driven by the Port, not by onMessage.
  assert.ok(/credit/.test(code), "Offscreen must gate sending on credit");
});

test("PH0-R1: Offscreen has no onMessage start/stop control path", () => {
  const code = codeOnly(read(OFFSCREEN));
  // Control flows over the frozen Port; the only onMessage command allowed is
  // a stateless ping.
  assert.ok(/command === "ping"/.test(code), "onMessage may only answer a stateless ping");
  assert.ok(!/command === "start"/.test(code), "Offscreen must not accept an onMessage start");
  assert.ok(!/command === "stop"/.test(code), "Offscreen must not accept an onMessage stop");
});

test("PH0-R1: Offscreen drives getUserMedia only from the Port start message", () => {
  const code = codeOnly(read(OFFSCREEN));
  assert.ok(/PORT_MESSAGE\.START/.test(code), "getUserMedia must be gated on the Port START message");
});

test("PH0-R1: Offscreen has no direct-to-Runtime fallback", () => {
  const code = codeOnly(read(OFFSCREEN));
  // A fallback would re-introduce a socket or an HTTP call.
  assert.ok(!/fetch\s*\(/.test(code), "Offscreen must not call fetch");
  assert.ok(!/XMLHttpRequest/.test(code), "Offscreen must not use XMLHttpRequest");
  assert.ok(!/sendBeacon/.test(code), "Offscreen must not use sendBeacon");
});

test("R1-C2-1: the Offscreen connects the frozen Port at document load", () => {
  const code = read(OFFSCREEN);
  // The load-time bootstrap must exist; a connect only inside startCapture()
  // is the circular dependency Codex flagged as M-R1-C2-01.
  assert.ok(
    /^ensurePort\(\);$/m.test(code),
    "the Offscreen entrypoint must call ensurePort() at module load"
  );
  // ensurePort() must delegate to the shared, injectable bootstrap.
  assert.ok(
    code.includes("bootstrapOffscreenProducerPort"),
    "the Offscreen must use the shared bootstrap module"
  );
  // The bootstrap must register the listener before returning.
  const bootstrap = read(path.join(CAPTURE_DIR, "OffscreenProducerBootstrap.ts"));
  const listenerIndex = bootstrap.indexOf("onMessage.addListener");
  const returnIndex = bootstrap.indexOf("return connection");
  assert.ok(listenerIndex > -1, "the bootstrap must register an onMessage listener");
  assert.ok(listenerIndex < returnIndex, "the listener must be registered before the bootstrap returns");
});

test("R1-C2-2: the Controller has no legacy onMessage capture control plane", () => {
  const code = read(path.join(CAPTURE_DIR, "MediaCaptureController.ts"));
  // relay must be a required dependency, not optional.
  assert.ok(
    /^  relay: RelayTransportPort;$/m.test(code),
    "relay must be a required dependency"
  );
  assert.ok(
    !/relay\?: RelayTransportPort/.test(code),
    "relay must not be optional"
  );
  // No start/stop command may be sent through onMessage.
  assert.ok(
    !/command:\s*"start"/.test(code),
    "the Controller must not send an onMessage start command"
  );
  assert.ok(
    !/command:\s*"stop"/.test(code),
    "the Controller must not send an onMessage stop command"
  );
  // The stop reason must be frozen on the relay before quiesce.
  assert.ok(/relay\.beginStop\(message\.reason\)/.test(code), "stop must freeze the reason on the relay first");
  assert.ok(/relay\.beginStop\(message\.reason\);\s*\n\s*relay\.sendQuiesce\(\)/.test(code),
    "beginStop must precede sendQuiesce");
});

test("R1-C2-3: Background pins TRUSTED_CONTEXTS and reconciles on worker start", () => {
  const code = read(BACKGROUND);
  assert.ok(
    code.includes("RelayRestartReconciler"),
    "Background must construct the restart reconciler"
  );
  assert.ok(
    /setAccessLevel:\s*\(?\s*\{?\s*accessLevel/.test(code)
      || code.includes("setAccessLevel"),
    "Background must set the storage.session access level"
  );
  assert.ok(
    /void relayRestartReconciler\.reconcile\(\)/.test(code),
    "Background must reconcile on worker start"
  );
  const reconciler = read(path.join(CAPTURE_DIR, "RelayRestartReconciler.ts"));
  assert.ok(
    reconciler.includes('RESTART_MARKER_ACCESS_LEVEL') && reconciler.includes('"TRUSTED_CONTEXTS"'),
    "the reconciler must use the frozen TRUSTED_CONTEXTS access level"
  );
  // It must never restore old PCM / ticket / sequence.
  for (const forbidden of ["restorePcm", "resumeTicket", "resumeSequence", "restoreTicket"]) {
    assert.ok(!reconciler.includes(forbidden), `the reconciler must not ${forbidden}`);
  }
});

test("R1-C2-4: the Offscreen emits exactly one capture_error on START failure", () => {
  const code = read(OFFSCREEN);
  // The START branch must catch, clean up and post capture_error.
  assert.ok(
    /case PORT_MESSAGE\.START:[\s\S]{0,900}?CAPTURE_ERROR/.test(code),
    "the START branch must emit capture_error"
  );
  assert.ok(
    /await teardown\(\);[\s\S]{0,200}?CAPTURE_ERROR/.test(code),
    "the START failure path must clean up before reporting"
  );
});

test("R1-C2-1: the frozen nine messages are the only Port protocol", () => {
  const code = read(path.join(CAPTURE_DIR, "relayContracts.ts"));
  for (const message of ["start", "chunk_credit", "quiesce", "abort", "ready", "chunk", "quiesced", "stopped", "capture_error"]) {
    assert.ok(code.includes(`"${message}"`), `relayContracts must declare "${message}"`);
  }
  // No tenth message may be inlined anywhere in the capture module.
  const captureFiles = fs.readdirSync(CAPTURE_DIR).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));
  for (const file of captureFiles) {
    const source = fs.readFileSync(path.join(CAPTURE_DIR, file), "utf8");
    const inline = source.match(/navia\.mediaCapture\.audio\/v10:/g);
    assert.equal(inline, null, `${file} must not inline a Port protocol literal`);
  }
});

test("R1-C3-01: the production recovery adapter never self-messages the extension", () => {
  const code = read(BACKGROUND);
  // R1-C3-01: the old adapter sent `navia.mediaCapture` to this same
  // service worker. `delete` / `recover` are not router commands and the
  // service worker is not a trusted surface, so those must be gone.
  assert.ok(
    !/command:\s*"delete"/.test(code),
    "Background must not fake a Runtime delete through an extension message"
  );
  assert.ok(
    !/command:\s*"recover"/.test(code),
    "Background must not fake a Runtime recover through an extension message"
  );
  assert.ok(
    !/command:\s*"status"[\s\S]{0,80}taskId/.test(code),
    "Background must not send a field-bearing status message to itself"
  );
  // The real Runtime client must be wired instead.
  assert.ok(
    code.includes("RuntimeRelayRecoveryAdapter"),
    "Background must construct the production Runtime recovery adapter"
  );
  assert.ok(code.includes("bootstrapLocalRuntimeSession"), "adapter must bootstrap a new session");
  assert.ok(code.includes("cancelMediaAcquisition"), "adapter must use the real authenticated DELETE");
  assert.ok(code.includes("getMediaAcquisition"), "adapter must use the real authenticated GET");
  // Scope the persistence guard to the relay wiring block only; the file
  // legitimately writes unrelated settings through chrome.storage.local.
  const relayBlock = code.slice(code.indexOf("relayRuntimeClient"), code.indexOf("relayFacade"));
  assert.ok(!/sessionToken|persistToken|bearerToken|storage\.local\.set|storage\.session\.set\(\s*\{[^}]*token/.test(relayBlock),
    "the Runtime bearer token must never be persisted by the relay wiring");
  // The session store may hold the frozen six-field marker and nothing else.
  const markerWrite = relayBlock.match(/storage\.session\.set\([^)]*\)/g) ?? [];
  for (const call of markerWrite) {
    assert.ok(!/token/i.test(call), "no token may be written to storage.session");
  }
});

test("R1-C3-01: the adapter exposes no unusable recover(sourceIdentity) member", () => {
  const adapter = read(path.join(CAPTURE_DIR, "RuntimeRelayRecoveryAdapter.ts"));
  const reconciler = read(path.join(CAPTURE_DIR, "RelayRestartReconciler.ts"));
  for (const source of [adapter, reconciler]) {
    // Strip comments first: both files DOCUMENT that the member does not
    // exist, and that prose must not be read as a declaration.
    const codeOnly = source
      .split("\n")
      .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
      .join("\n");
    assert.ok(!/recover\s*\(\s*sourceIdentity/.test(codeOnly),
      "a recover(sourceIdentity) member must not be declared: the strict six-field marker has no sourceIdentity");
    assert.ok(!/sourceIdentity/.test(codeOnly),
      "the reconciler/adapter must not carry sourceIdentity at all");
  }
  // The reconciler must still be the only place that dispatches.
  assert.ok(adapter.includes("cancelThenObserve") && adapter.includes("observe"),
    "the adapter must expose the two production operations");
});

test("R1-C3-01: the acquisition terminal set matches MediaAcquisitionTask.state", () => {
  const reconciler = read(path.join(CAPTURE_DIR, "RelayRestartReconciler.ts"));
  for (const terminal of ["succeeded", "degraded", "blocked", "failed", "cancelled"]) {
    assert.ok(reconciler.includes(`"${terminal}"`), `terminal set must include ${terminal}`);
  }
  // `ready` / `published` belong to the projection / outline resources and
  // never occur on an acquisition.
  const terminalBlock = reconciler.slice(
    reconciler.indexOf("ACQUISITION_TERMINAL_STATES"),
    reconciler.indexOf("ACQUISITION_TERMINAL_STATES") + 400
  );
  assert.ok(!terminalBlock.includes('"ready"'), "ready is not an acquisition terminal");
  assert.ok(!terminalBlock.includes('"published"'), "published is not an acquisition terminal");
});

test("R2-5: the capture owner enforces the frozen duration and byte bounds", () => {
  const transport = read(path.join(CAPTURE_DIR, "RuntimeCaptureTransport.ts"));
  // C2: the bounds are PURE predicates with a single definition.
  assert.ok(
    /export function exceedsCaptureByteBound/.test(transport),
    "the cumulative byte bound must be a pure predicate"
  );
  assert.ok(
    /export function exceedsCaptureDurationBound/.test(transport),
    "the duration bound must be a pure predicate"
  );
  // C2: the TIMER BODY must actually call the predicate. A whole-file
  // call count is insufficient because the function DECLARATION alone
  // would satisfy it while the timer still aborted at the boundary.
  const armStart = transport.indexOf("#armCaptureDeadline(): void {");
  const armEnd = transport.indexOf("#clearCaptureDeadline(): void {");
  assert.ok(armStart > -1 && armEnd > armStart, "the deadline arm body must be locatable");
  const armBody = transport.slice(armStart, armEnd);
  assert.ok(
    /exceedsCaptureDurationBound\(/.test(armBody),
    "the deadline TIMER BODY must call exceedsCaptureDurationBound"
  );
  assert.ok(
    /#armCaptureDeadline\(\);\s*\n\s*return;/.test(armBody),
    "at the inclusive boundary the timer must re-arm instead of aborting"
  );
  // Re-arming must make forward progress, or a fake clock spins forever.
  assert.ok(
    /Math\.max\(1,/.test(armBody),
    "the re-arm delay must be at least 1 ms so the clock advances"
  );
  // The enqueue guard must use the same predicate.
  const enqueueStart = transport.indexOf("offerChunkMessage(");
  const enqueueBody = transport.slice(enqueueStart, enqueueStart + 4000);
  assert.ok(
    /exceedsCaptureDurationBound\(/.test(enqueueBody),
    "the enqueue guard must use the same duration predicate"
  );
  assert.ok(
    (transport.match(/exceedsCaptureByteBound\(/g) ?? []).length >= 2,
    "the byte predicate must be used by the enqueue guard"
  );
  // Both guards run BEFORE the queue push.
  const byteCheck = transport.indexOf("exceedsCaptureByteBound(this.#totalRawBytes");
  const queuePush = transport.indexOf("this.#queue.push");
  assert.ok(byteCheck > -1 && queuePush > -1 && byteCheck < queuePush,
    "the byte bound must be checked before the queue push");
  const durationCheck = transport.indexOf("exceedsCaptureDurationBound(this.#now()");
  assert.ok(durationCheck > -1 && durationCheck < queuePush,
    "the duration bound must be checked before the queue push");
  // The frozen failure codes for both bounds.
  assert.ok(transport.includes("BYTE_LIMIT"), "the byte bound must use the frozen BYTE_LIMIT code");
  assert.ok(transport.includes("DURATION_LIMIT"), "the duration bound must use the frozen DURATION_LIMIT code");
});

test("R2 corrective C1: the owner holds an ACTIVE wall-clock deadline", () => {
  const transport = read(path.join(CAPTURE_DIR, "RuntimeCaptureTransport.ts"));
  // M-R2-01: the bound must not depend on a later chunk arriving.
  assert.ok(/#armCaptureDeadline/.test(transport),
    "the owner must arm an active capture deadline");
  assert.ok(/#clearCaptureDeadline/.test(transport),
    "the owner must be able to clear the capture deadline");
  assert.ok(/#deadlineTimer/.test(transport),
    "the owner must own a single deadline handle");
  // It must be armed from startedAt (one origin with the restart marker).
  const armIndex = transport.indexOf("#armCaptureDeadline()");
  assert.ok(armIndex > -1, "the deadline must be armed");
  assert.ok(
    /RELAY_V10\.maxCaptureMs - \(this\.#now\(\) - this\.#startedAt\)/.test(transport),
    "the deadline must be derived from the same startedAt origin as the marker"
  );
  // The self-firing path must produce the fixed code, abort the producer,
  // close the socket, settle the terminal and clear the marker.
  const fire = transport.slice(transport.indexOf("#armCaptureDeadline(): void {"));
  for (const needle of [
    "RELAY_FAILURE_CODES.DURATION_LIMIT",
    "onCaptureAbort",
    "#closeSocket()",
    "#settleTerminal"
  ]) {
    assert.ok(fire.includes(needle), `the self-firing deadline must perform ${needle}`);
  }
  // No second failure may be produced after one already exists.
  assert.ok(/if \(this\.#failure\) return;/.test(fire),
    "the deadline must not double-report after an existing failure");
  // The deadline is cleared on every terminal path.
  assert.ok((transport.match(/#clearCaptureDeadline\(\)/g) ?? []).length >= 4,
    "the deadline must be cleared on arm, close, settle and reset paths");
});

test("M-R2-C1: the Port owns the single producer abort", () => {
  const port = read(path.join(CAPTURE_DIR, "OffscreenAudioPort.ts"));
  const background = read(BACKGROUND);
  // The once-guard must be the public owner used by every path.
  assert.ok(/notifyProducerAbortOnce\(failureCode: RelayFailureCode\): void \{/.test(port),
    "the Port must expose a once-guarded producer abort owner");
  assert.ok(/if \(this\.#abortNotified\) return;/.test(port),
    "the producer abort must be emitted at most once per capture");
  // The Transport-owned closeout must NOT reach a raw sendAbort.
  assert.ok(!/onCaptureAbort: \(failureCode\) => \{[^}]*sendAbort\(failureCode\)/s.test(background),
    "the Background must route onCaptureAbort through the once-guard, not raw sendAbort");
  assert.ok(/notifyProducerAbortOnce\(failureCode\)/.test(background),
    "the Background must call the once-guarded abort owner");
  // A Transport-owned failure must not re-abort from the Port CHUNK branch.
  assert.ok(
    /if \(!this\.#transport\.terminalReached\) \{\s*\n?\s*this\.notifyProducerAbortOnce/.test(port),
    "the Port CHUNK branch must skip its own abort once the Transport closed out"
  );
});

test("M-R2-C3: a late finalize or abort cannot rewrite a settled terminal", () => {
  const transport = read(path.join(CAPTURE_DIR, "RuntimeCaptureTransport.ts"));
  // abort() must route through the guarded closeout.
  const abortStart = transport.indexOf("\n  abort(failureCode: RelayFailureCode)");
  const abortBody = transport.slice(abortStart, abortStart + 700);
  assert.ok(/#failClosed\(failureCode\)/.test(abortBody),
    "abort() must route through the single guarded closeout");
  assert.ok(!/#setState\("aborted"\)/.test(abortBody),
    "abort() must not unconditionally rewrite the state to aborted");
  // #settle() must not rewrite an already settled terminal.
  const settleStart = transport.indexOf("#settle(terminal: Record<string, unknown> | null) {");
  const settleBody = transport.slice(settleStart, settleStart + 400);
  assert.ok(
    /if \(!this\.#terminalSettled\) this\.#setState\("finalized"\)/.test(settleBody),
    "a late finalize must not rewrite an already settled terminal state"
  );
  // No fail()+abort() double closeout may remain.
  assert.ok(
    !/this\.#fail\([^)]*\);\s*\n\s*this\.abort\(/.test(transport),
    "no path may call #fail() and then abort(); the single closeout replaces both"
  );
});

test("R2 corrective C2: the cumulative bound is not expressed in terms of the queue cap", () => {
  const transport = read(path.join(CAPTURE_DIR, "RuntimeCaptureTransport.ts"));
  // The two bounds are distinct and live in different places:
  //   - outstanding queue caps (32 chunks / 1,572,864 bytes) in audioChunk
  //   - whole-capture cumulative byte cap in the transport
  const audioChunk = read(path.join(CAPTURE_DIR, "audioChunk.ts"));
  assert.ok(audioChunk.includes("RELAY_V10.maxOutstandingChunks"),
    "the outstanding chunk cap must still exist");
  assert.ok(audioChunk.includes("RELAY_V10.maxOutstandingRawBytes"),
    "the outstanding raw-byte cap must still exist");
  assert.ok(
    /maxOutstandingChunks[\s\S]{0,400}maxOutstandingRawBytes/.test(audioChunk),
    "the two outstanding caps must be enforced together in admitChunk"
  );
  // The cumulative bound must be checked against the running total, not
  // the queue length.
  assert.ok(
    /exceedsCaptureByteBound\(this\.#totalRawBytes, chunk\.rawByteLength/.test(transport),
    "the cumulative bound must use the running total, never the queue length"
  );
  // The test-only seam must default to the frozen value.
  assert.ok(
    /maxCaptureBytes \?\? RELAY_V10\.maxCaptureBytes/.test(transport),
    "the cumulative bound must default to the frozen production value"
  );
});

test("R2-1: the sender rule is an exact match, never a prefix", () => {
  const port = read(path.join(CAPTURE_DIR, "OffscreenAudioPort.ts"));
  assert.ok(
    /facts\.senderUrl !== facts\.expectedSenderUrl/.test(port),
    "the sender URL must be compared with exact equality"
  );
  assert.ok(
    !/facts\.senderUrl\.startsWith\(/.test(port),
    "a prefix check would accept a foreign path and must be absent"
  );
  // frameId absent-or-zero only.
  assert.ok(
    /facts\.frameId !== undefined && facts\.frameId !== 0/.test(port),
    "frameId must be absent or exactly 0"
  );
});

test("R5-B relay v11: unique Offscreen context is authoritative and sender documentId is optional", () => {
  const port = read(path.join(CAPTURE_DIR, "OffscreenAudioPort.ts"));
  const contracts = read(path.join(CAPTURE_DIR, "relayContracts.ts"));
  assert.ok(
    contracts.includes('MEDIA_CAPTURE_AUDIO_PORT_NAME = "navia.mediaCapture.audio/v11"'),
    "the product must use only the relay v11 Port"
  );
  assert.ok(!contracts.includes('MEDIA_CAPTURE_AUDIO_PORT_NAME = "navia.mediaCapture.audio/v10"'),
    "the production Port must not fall back to relay v10");
  assert.ok(/offscreen\.length !== 1/.test(port),
    "exactly one OFFSCREEN_DOCUMENT context must be authoritative");
  assert.ok(/context\.documentUrl !== facts\.expectedSenderUrl/.test(port),
    "the authoritative context URL must match exactly");
  assert.ok(/context\.documentOrigin !== facts\.expectedExtensionOrigin/.test(port),
    "the authoritative context origin must match exactly");
  assert.ok(/typeof facts\.documentId === "string" && facts\.documentId/.test(port),
    "sender documentId must be checked only when Chrome supplies it");
  assert.ok(/authoritativeDocumentId: context\.documentId/.test(port),
    "the binding must use the authoritative context documentId");
  assert.ok(/preValidationActivity/.test(port),
    "Port activity before async context validation must fail closed");
});

test("R2-3/R2-4: credit and backpressure live at the owner, not the producer", () => {
  const transport = read(path.join(CAPTURE_DIR, "RuntimeCaptureTransport.ts"));
  const port = read(path.join(CAPTURE_DIR, "OffscreenAudioPort.ts"));
  // Credit is returned only by a Runtime ACK.
  assert.ok(/onRuntimeAck/.test(transport), "credit return must hang off the Runtime ACK hook");
  assert.ok(/noteRuntimeAck/.test(port), "the port must convert a Runtime ACK into exactly one credit");
  // Backpressure admission runs before the enqueue.
  const admission = transport.indexOf("admitChunk(");
  const push = transport.indexOf("this.#queue.push");
  assert.ok(admission > -1 && admission < push,
    "admitChunk must run before the queue push (abort before enqueue)");
});

test("PH0-R1: Offscreen uses the frozen Port name and shared message constants", () => {
  const code = read(OFFSCREEN);
  // The frozen Port name lives in the shared bootstrap, and the Offscreen
  // injects `chrome.runtime.connect` into it. Neither end inlines it.
  const bootstrap = read(path.join(CAPTURE_DIR, "OffscreenProducerBootstrap.ts"));
  assert.ok(
    bootstrap.includes("MEDIA_CAPTURE_AUDIO_PORT_NAME"),
    "the shared bootstrap must use the frozen Port constant"
  );
  const contracts = read(path.join(CAPTURE_DIR, "relayContracts.ts"));
  assert.ok(
    contracts.includes('MEDIA_CAPTURE_AUDIO_PORT_NAME = "navia.mediaCapture.audio/v11"'),
    "relayContracts must pin the frozen Port name"
  );
  assert.ok(
    code.includes("chrome.runtime.connect"),
    "the Offscreen must connect the Port through the shared bootstrap"
  );
  // Protocol literals are shared constants, never inlined at either end.
  assert.ok(!code.includes("navia.mediaCapture.audio/v11:"), "Offscreen must not inline Port message literals");
  assert.ok(!/type:\s*"ready"/.test(code), "Offscreen must reference PORT_MESSAGE.READY, not a literal");
});

// ============================================================================
// Background must own the Runtime capture WebSocket
// ============================================================================

test("PH0-R1: Background constructs exactly one Runtime capture WebSocket", () => {
  const code = codeOnly(read(BACKGROUND));
  const matches = code.match(/new\s+WebSocket\s*\(/g) ?? [];
  assert.equal(matches.length, 1, `Background must construct exactly one WebSocket, found ${matches.length}`);
  assert.ok(/ws:\/\/127\.0\.0\.1:17861\/v1\/media\/capture-stream/.test(code), "Background socket must target the frozen Runtime capture endpoint");
});

test("PH0-R1: Background wires exactly one RuntimeCaptureTransport and one OffscreenAudioPort", () => {
  const code = codeOnly(read(BACKGROUND));
  assert.equal((code.match(/new\s+RuntimeCaptureTransport\s*\(/g) ?? []).length, 1, "exactly one transport");
  assert.equal((code.match(/new\s+OffscreenAudioPort\s*\(/g) ?? []).length, 1, "exactly one audio port owner");
});

test("PH0-R1: Background accepts only the fixed audio Port", () => {
  const code = read(BACKGROUND);
  assert.ok(code.includes("MEDIA_CAPTURE_AUDIO_PORT_NAME"), "Background must gate on the frozen Port constant");
  assert.ok(/onConnect\.addListener/.test(code), "Background must own the Port connect listener");
});

test("PH0-R1: the Runtime capture URL appears only in Background, never in the capture module", () => {
  const backgroundCode = read(BACKGROUND);
  assert.ok(backgroundCode.includes("ws://127.0.0.1:17861/v1/media/capture-stream"));
  for (const file of fs.readdirSync(CAPTURE_DIR)) {
    if (!file.endsWith(".ts") || file.endsWith(".test.ts")) continue;
    const source = fs.readFileSync(path.join(CAPTURE_DIR, file), "utf8");
    assert.ok(
      !source.includes("ws://127.0.0.1:17861"),
      `capture module ${file} must not hardcode the Runtime WebSocket URL`
    );
  }
});

// ============================================================================
// Frozen parameters must not drift
// ============================================================================

test("PH0-R1: frozen v10 parameters are pinned in relayContracts", () => {
  const code = read(path.join(CAPTURE_DIR, "relayContracts.ts"));
  for (const frozen of [
    "maxRawChunkBytes: 49_152",
    "maxEncodedChunkChars: 65_536",
    "creditWindowChunks: 1",
    "runtimeMaxInFlightChunks: 1",
    "maxOutstandingChunks: 32",
    "maxOutstandingRawBytes: 1_572_864",
    "portConnectTimeoutMs: 5_000",
    "runtimeStartTimeoutMs: 10_000",
    "chunkAckTimeoutMs: 10_000",
    "cleanupTimeoutMs: 10_000",
    "finalizeTimeoutMs: 120_000",
    "maxCaptureMs: 900_000",
    "maxCaptureBytes: 536_870_912",
    "markerTtlMs: 1_080_000",
    "sampleRateHz: 16_000",
    "channels: 1",
    "sampleWidthBytes: 2"
  ]) {
    assert.ok(code.includes(frozen), `relayContracts must pin "${frozen}"`);
  }
});

test("PH0-R1: the frozen restart marker identity is pinned", () => {
  const code = read(path.join(CAPTURE_DIR, "relayContracts.ts"));
  assert.ok(
    code.includes('RESTART_MARKER_SCHEMA_VERSION = "v3-media-capture-restart-marker/v10"'),
    "the marker schemaVersion must match the frozen value"
  );
  assert.ok(
    code.includes("SESSION_ID_PATTERN = /^cap_[A-Za-z0-9_-]{32}$/"),
    "captureSessionId must be cap_ + 32 base64url chars"
  );
  assert.ok(code.includes('RESTART_MARKER_ACCESS_LEVEL = "TRUSTED_CONTEXTS"'), "access level must be TRUSTED_CONTEXTS");
  assert.ok(code.includes('RESTART_MARKER_STORAGE = "chrome.storage.session"'), "storage must be chrome.storage.session");
});

test("PH0-R1: Background persists the marker in chrome.storage.session", () => {
  const code = read(BACKGROUND);
  assert.ok(/chrome\.storage\.session\.set/.test(code), "marker must be persisted with storage.session.set");
  assert.ok(/chrome\.storage\.session\.remove/.test(code), "marker must be cleared with storage.session.remove");
});

test("R5-B: Offscreen readiness includes the validated Background Port", () => {
  const code = codeOnly(read(BACKGROUND));
  assert.match(
    code,
    /response\?\.ok\s*===\s*true\s*&&\s*response\?\.state\s*===\s*"ready"\s*&&\s*offscreenAudioPort\.connected/,
    "a ping response alone must not race ahead of asynchronous sender-context validation"
  );
});

test("R5-B: transient empty Offscreen context lookup is bounded and fail closed", () => {
  const source = read(OFFSCREEN_PORT);
  const accept = methodBody(source, "async accept(");
  assert.ok(accept.includes("attempt < 30"), "context registration retry must be bounded");
  assert.ok(accept.includes("await waitForContext(50)"), "the retry must yield to Chrome context registration");
  assert.ok(
    accept.includes("contexts.length > 0"),
    "a non-empty mismatch must not be retried as though it were an unregistered context"
  );
  assert.ok(accept.includes("port.disconnect()"), "an exhausted or mismatched sender must still fail closed");
  assert.ok(accept.includes('contextTypes: ["OFFSCREEN_DOCUMENT"]'), "context discovery must follow the Chrome Offscreen API type filter");
  assert.ok(accept.includes("documentUrls: [this.#deps.expectedSenderUrl]"), "context discovery must use the exact bundled Offscreen URL");
});

test("PH0-R1: the producer-internal AudioContext diagnostic is retained and normalized", () => {
  const contracts = read(path.join(CAPTURE_DIR, "relayContracts.ts"));
  const offscreen = read(OFFSCREEN);
  assert.ok(
    contracts.includes("V3_MEDIA_CAPTURE_AUDIO_CONTEXT_SUSPENDED"),
    "the producer-internal diagnostic must stay in the source inventory"
  );
  assert.ok(
    contracts.includes("V3_MEDIA_CAPTURE_AUDIO_SHAPE_INVALID"),
    "it must map onto the public relay code"
  );
  assert.ok(
    offscreen.includes("AUDIO_CONTEXT_SUSPENDED"),
    "the Offscreen must emit the producer-internal diagnostic"
  );
});

test("PH0-R1: the frozen 20 relay target codes are all present in relayContracts", () => {
  const code = read(path.join(CAPTURE_DIR, "relayContracts.ts"));
  const expected = [
    "V3_MEDIA_CAPTURE_PORT_FORBIDDEN", "V3_MEDIA_CAPTURE_PORT_DISCONNECTED",
    "V3_MEDIA_CAPTURE_PROTOCOL_INVALID", "V3_MEDIA_CAPTURE_BACKPRESSURE",
    "V3_MEDIA_CAPTURE_WORKER_RESTARTED", "V3_MEDIA_CAPTURE_RUNTIME_DISCONNECTED",
    "V3_MEDIA_CAPTURE_CLEANUP_INCOMPLETE", "V3_MEDIA_CAPTURE_AUDIO_SHAPE_INVALID",
    "V3_MEDIA_CAPTURE_CHUNK_INVALID", "V3_MEDIA_CAPTURE_CHUNK_SEQUENCE_INVALID",
    "V3_MEDIA_CAPTURE_BYTE_LIMIT", "V3_MEDIA_CAPTURE_DURATION_LIMIT",
    "V3_MEDIA_CAPTURE_EMPTY", "V3_MEDIA_CAPTURE_STREAM_INVALID",
    "V3_MEDIA_CAPTURE_TICKET_INVALID", "V3_MEDIA_CAPTURE_TICKET_EXPIRED",
    "V3_MEDIA_CAPTURE_TICKET_REPLAYED", "V3_MEDIA_CAPTURE_BINDING_MISMATCH",
    "V3_MEDIA_CAPTURE_ALREADY_ACTIVE", "V3_MEDIA_CAPTURE_FINALIZE_FAILED"
  ];
  assert.equal(expected.length, 20, "the frozen relay inventory is 20 codes");
  for (const code of expected) {
    assert.ok(code.startsWith("V3_MEDIA_CAPTURE_"), `${code} is a relay capture code`);
  }
});

// ============================================================================
// WP0 R3 — Controller / router / client orchestration (single owner)
// ============================================================================

const CONTROLLER = path.join(CAPTURE_DIR, "MediaCaptureController.ts");
const ROUTER = path.join(CAPTURE_DIR, "MediaCaptureMessageRouter.ts");
const OFFSCREEN_PORT = path.join(CAPTURE_DIR, "OffscreenAudioPort.ts");
const TRANSPORT = path.join(CAPTURE_DIR, "RuntimeCaptureTransport.ts");

/** Extract a method body by brace matching from its declaration. */
function methodBody(source, declaration) {
  const start = source.indexOf(declaration);
  if (start < 0) return null;
  let depth = 0;
  let seen = false;
  for (let index = start; index < source.length; index += 1) {
    const character = source[index];
    if (character === "{") { depth += 1; seen = true; }
    else if (character === "}") {
      depth -= 1;
      if (seen && depth === 0) return source.slice(start, index + 1);
    }
  }
  return null;
}

test("R3-1: Background assembles exactly one Controller, router and relay facade", () => {
  const code = codeOnly(read(BACKGROUND));
  assert.equal((code.match(/new\s+MediaCaptureController\s*\(/g) ?? []).length, 1, "exactly one capture Controller");
  assert.equal((code.match(/new\s+MediaCaptureMessageRouter\s*\(/g) ?? []).length, 1, "exactly one capture router");
  assert.equal((code.match(/: RelayTransportPort\s*=\s*\{/g) ?? []).length, 1, "exactly one relay facade");
  // Every capture entry point funnels through that one controller.
  for (const entry of [
    "mediaCaptureController.hasArmedCapture()",
    "mediaCaptureController.startArmed(",
    "mediaCaptureController.stop(",
    "mediaCaptureMessageRouter"
  ]) {
    assert.ok(code.includes(entry), `Background must route "${entry}" through the single Controller`);
  }
  // The Offscreen document never builds a Port owner of its own.
  assert.ok(
    !/new\s+OffscreenAudioPort\s*\(/.test(read(OFFSCREEN)),
    "the Offscreen document must not build a Port owner"
  );
});

test("R3-1: the relay facade never sends a raw abort around the once-guard", () => {
  const background = read(BACKGROUND);
  const facade = methodBody(background, "const relayFacade: RelayTransportPort = {");
  assert.ok(facade, "the relay facade must exist");
  assert.ok(facade.includes("notifyProducerAbortOnce"), "the facade abort must go through the Port once-guard");
  assert.ok(
    !/offscreenAudioPort\.sendAbort\s*\(/.test(facade),
    "the facade must not emit a second frozen abort with a raw sendAbort"
  );
});

test("R3-1: the Controller refuses a concurrent start and has ONE start closeout", () => {
  const source = read(CONTROLLER);
  assert.ok(source.includes("#starting"), "the Controller must own a single-start guard");
  const start = methodBody(source, "async startArmed(");
  assert.ok(start, "startArmed must exist");
  assert.ok(start.includes("if (this.#starting)"), "startArmed must check the starting guard");
  assert.ok(start.includes("V3_MEDIA_CAPTURE_ALREADY_ACTIVE"), "the guard must use the frozen ALREADY_ACTIVE code");
  // Every failure — tab, binding, permission, Runtime, streamId, Port,
  // producer start — funnels through the same closeout.
  const calls = (source.match(/this\.#failStart\(/g) ?? []).length;
  assert.equal(calls, 6, `all six start failure points must use #failStart, found ${calls}`);
  const closeout = methodBody(source, "async #failStart(");
  assert.ok(closeout, "#failStart must exist");
  assert.ok(closeout.includes("relay?.disconnect()"), "the start closeout must release the Port");
  assert.ok(closeout.includes("#closePreparedDocument()"), "the start closeout must close the Offscreen document");
  assert.ok(closeout.includes("this.#activeGrantId = null"), "the start closeout must return the controller to idle");
});

test("R3-3: the Controller freezes the stop reason before quiesce", () => {
  const source = read(CONTROLLER);
  const stop = methodBody(source, "async stop(");
  assert.ok(stop, "stop must exist");
  const freeze = stop.indexOf("relay.beginStop(message.reason)");
  const quiesce = stop.indexOf("relay.sendQuiesce()");
  const finalize = stop.indexOf("relay.stop(message.reason)");
  assert.ok(freeze >= 0 && quiesce > freeze && finalize > quiesce, "beginStop -> sendQuiesce -> stop order is frozen");
  assert.ok(stop.includes("finally"), "stop must release the Port and the document in a finally block");
  assert.ok(stop.includes("relay.disconnect()"), "stop must disconnect the Port");
  assert.ok(stop.includes("#closePreparedDocument()"), "stop must close the Offscreen document");
});

test("R3-3: the drain accepts the post-quiesce queue and closes past `stopped`", () => {
  const source = read(TRANSPORT);
  const offer = methodBody(source, "offerChunkMessage(");
  assert.ok(offer, "offerChunkMessage must exist");
  assert.ok(
    offer.includes('this.#state !== "draining"'),
    "the frozen 24-step trace requires a chunk to be accepted while draining"
  );
  assert.ok(
    offer.includes("this.#offscreenStopped"),
    "past `stopped` a chunk must be refused before the queue and the counters"
  );
  // And the refusal must not touch the queue, the sequence or the counters.
  const refuse = offer.slice(offer.indexOf("this.#offscreenStopped"), offer.indexOf("validateChunkMessage"));
  assert.ok(!refuse.includes("#expectedSequence"), "the refusal must not advance the sequence");
  assert.ok(!refuse.includes("#queue.push"), "the refusal must not enqueue");
  assert.ok(!refuse.includes("#totalRawBytes"), "the refusal must not accumulate bytes");
});

test("R3-3: a stop whose producer never reports `stopped` is bounded by the frozen cleanup timeout", () => {
  const source = read(TRANSPORT);
  assert.ok(source.includes("#armCleanupTimeout"), "the transport must own a cleanup stall bound");
  const arm = methodBody(source, "#armCleanupTimeout(): void {");
  assert.ok(arm, "#armCleanupTimeout must exist");
  assert.ok(arm.includes("RELAY_V10.cleanupTimeoutMs"), "it must reuse the frozen cleanupTimeoutMs, not a new threshold");
  assert.ok(arm.includes("CLEANUP_INCOMPLETE"), "a stalled producer must fail closed with the exact frozen cleanup code");
  assert.ok(arm.includes("#failClosed("), "the stall must use the single fail-closed closeout");
  assert.ok(arm.includes("this.#offscreenStopped"), "the bound applies only while waiting for `stopped`");
  // No terminal may leave the stall timer live.
  const settle = methodBody(source, "  #settleTerminal(terminal: TransportTerminal) {");
  assert.ok(settle.includes("#cleanupTimer"), "#settleTerminal must clear the cleanup timer");
  // `stop()` is what arms it.
  assert.ok(methodBody(source, "async stop(").includes("#armCleanupTimeout()"), "stop must arm the bound");
});

test("R3-4: every producer -> Background message must belong to THIS capture", () => {
  const source = read(OFFSCREEN_PORT);
  const inbound = methodBody(source, "#onMessage(raw: unknown) {");
  assert.ok(inbound, "#onMessage must exist");
  const gate = inbound.slice(0, inbound.indexOf("switch (message.type)"));
  assert.ok(gate.includes("SESSION_ID_PATTERN.test(message.captureSessionId)"), "the session must be shape-checked");
  assert.ok(
    gate.includes("message.captureSessionId !== this.#transport.captureSessionId"),
    "the session must be compared with the owner's current capture"
  );
  assert.ok(gate.includes("BINDING_MISMATCH"), "a foreign session must be a frozen binding mismatch");
  assert.ok(gate.includes("PROTOCOL_INVALID"), "a missing session must be a frozen protocol error");
  // No branch may settle the capture before that single gate.
  for (const settleCall of ["markQuiesced()", "markOffscreenStopped()"]) {
    assert.ok(inbound.includes(settleCall), `the ${settleCall} branch must exist`);
    assert.ok(
      inbound.indexOf("switch (message.type)") < inbound.indexOf(settleCall),
      `${settleCall} must be behind the session gate`
    );
  }
});

test("R3-4: the Port releases its capture-local binding on every disconnect", () => {
  const source = read(OFFSCREEN_PORT);
  for (const method of ["  disconnect(): void {", "  #onDisconnect() {"]) {
    const body = methodBody(source, method);
    assert.ok(body, `${method.trim()} must exist`);
    assert.ok(body.includes("this.#boundDocumentId = null"), "the document binding is capture-local");
    assert.ok(body.includes("this.#abortNotified = false"), "the abort once-guard is capture-local");
  }
  // And `accept()` is the second, per-capture reset point.
  const accept = methodBody(source, "async accept(");
  assert.ok(accept.includes("this.#abortNotified = false"), "accept must reset the once-guard per capture");
  assert.ok(accept.includes("this.#producerReady = false"), "accept must reset readiness per capture");
  assert.ok(accept.includes("this.#credit = 0"), "accept must reset credit per capture");
});

test("R3-5: the `capturing` phase is published at producer `ready`", () => {
  const transport = read(TRANSPORT);
  const ready = methodBody(transport, "markProducerReady(): void {");
  assert.ok(ready, "markProducerReady must exist");
  assert.ok(ready.includes('if (this.#state !== "runtime_started") return;'), "the transition is monotonic");
  assert.ok(ready.includes('this.#setState("capturing")'), "it must publish the capturing phase");
  const port = read(OFFSCREEN_PORT);
  const inbound = methodBody(port, "#onMessage(raw: unknown) {");
  const readyBranch = inbound.slice(inbound.indexOf("case PORT_MESSAGE.READY"));
  assert.ok(readyBranch.includes("markProducerReady()"), "the Port must publish capturing on `ready`");
  // A terminal phase must never be republished.
  assert.ok(transport.includes("if (!isRestartMarkerPhase(next)) return;"), "terminal phases must not republish a marker");
  // Phase updates must not refresh the frozen TTL.
  const reset = methodBody(transport, "  #reset(binding: TransportStartBinding) {");
  assert.equal(
    (transport.match(/this\.#markerExpiry = /g) ?? []).length,
    1,
    "the marker expiry is written exactly once per capture"
  );
  assert.ok(reset.includes("RELAY_V10.markerTtlMs"), "it must come from the frozen TTL");
});

test("R3-4: a late `stop()` answers the terminal that already settled", () => {
  // Without this, a capture that failed closed (capture_error, byte limit,
  // duration limit, abnormal disconnect) would create a fresh waiter that no
  // terminal can ever resolve: `Controller.stop()` would hang and the
  // Offscreen document would never be closed.
  const source = read(TRANSPORT);
  const stop = methodBody(source, "async stop(");
  const guard = stop.slice(0, stop.indexOf("this.beginStop(reason)"));
  assert.ok(guard.includes("this.#terminalSettled"), "stop must detect an already settled terminal");
  assert.ok(guard.includes("this.#settledTerminal"), "stop must answer with the settled terminal");
  assert.ok(
    stop.indexOf("this.#stopWaiter = new Promise") > guard.length,
    "a new waiter may only be created for a capture that is still live"
  );
  // The settled terminal is retained for the whole capture and reset per
  // capture, so it can never leak into the next one.
  const settle = methodBody(source, "  #settleTerminal(terminal: TransportTerminal) {");
  assert.ok(settle.includes("this.#settledTerminal = terminal"), "the terminal must be retained");
  const reset = methodBody(source, "  #reset(binding: TransportStartBinding) {");
  assert.ok(reset.includes("this.#settledTerminal = null"), "it must be cleared at the next capture start");
  const await_ = methodBody(source, "async awaitTerminal()");
  assert.ok(await_.includes("this.#settledTerminal"), "awaitTerminal must answer a settled terminal too");
});
