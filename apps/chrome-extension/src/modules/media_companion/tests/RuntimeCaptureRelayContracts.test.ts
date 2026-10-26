import { describe, expect, it } from "vitest";
import {
  PORT_MESSAGE,
  MEDIA_CAPTURE_AUDIO_PORT_NAME,
  BACKGROUND_TO_OFFSCREEN_MESSAGE_TYPES,
  OFFSCREEN_TO_BACKGROUND_MESSAGE_TYPES,
  RELAY_AUDIO_CONFIG,
  RELAY_V10,
  RESTART_MARKER_FIELDS,
  RESTART_MARKER_PHASES,
  RESTART_MARKER_SCHEMA_VERSION,
  RESTART_MARKER_TRANSITIONS,
  SESSION_ID_PATTERN,
  newCaptureSessionId,
  isRelayFailureCode,
  isProducerInternalCode,
  normalizeRelayFailureCode,
  isBackgroundToOffscreenMessage,
  isOffscreenToBackgroundMessage,
  RELAY_FAILURE_CODES,
  type RelayRestartMarker
} from "../capture/relayContracts";
import { classifyOffscreenPortSender, validateOffscreenPortSender } from "../capture/OffscreenAudioPort";

/**
 * WP0 R1 — the nine frozen Port messages, the frozen parameters, the frozen
 * restart marker, and the exact sender rule. Every value here is pinned to
 * `v3_media_capture_internal_relay_v11.schema.json`. Relay limits and the
 * restart marker intentionally remain on their separately frozen v10 shapes.
 */

const EXT_ID = "abcdefghijklmnopabcdefghijklmnop";
const OFFSCREEN_URL = `chrome-extension://${EXT_ID}/media-capture-offscreen.html`;
const EXTENSION_ORIGIN = `chrome-extension://${EXT_ID}`;

function contexts(documentId: string, incognito = false): chrome.runtime.ExtensionContext[] {
  return [{
    contextType: "OFFSCREEN_DOCUMENT",
    documentId,
    documentUrl: OFFSCREEN_URL,
    documentOrigin: EXTENSION_ORIGIN,
    incognito
  } as unknown as chrome.runtime.ExtensionContext];
}

function senderFacts(overrides: Partial<Parameters<typeof validateOffscreenPortSender>[0]> = {}) {
  return {
    extensionId: EXT_ID,
    senderUrl: OFFSCREEN_URL,
    hasSenderTab: false,
    frameId: 0,
    documentId: "doc-1",
    expectedExtensionId: EXT_ID,
    expectedSenderUrl: OFFSCREEN_URL,
    expectedExtensionOrigin: EXTENSION_ORIGIN,
    extensionIncognito: false,
    contexts: contexts("doc-1"),
    ...overrides
  };
}

describe("frozen Port message contract", () => {
  it("has exactly the nine frozen message types", () => {
    expect(Object.keys(PORT_MESSAGE)).toHaveLength(9);
    expect([...BACKGROUND_TO_OFFSCREEN_MESSAGE_TYPES]).toEqual([
      "start", "chunk_credit", "quiesce", "abort"
    ]);
    expect([...OFFSCREEN_TO_BACKGROUND_MESSAGE_TYPES]).toEqual([
      "ready", "chunk", "quiesced", "stopped", "capture_error"
    ]);
  });

  it("does not treat `start` as an Offscreen->Background message", () => {
    // The previous implementation wrongly listed `start` as producer-originated.
    expect(OFFSCREEN_TO_BACKGROUND_MESSAGE_TYPES).not.toContain("start");
    expect(isBackgroundToOffscreenMessage({ type: "start" })).toBe(true);
    expect(isOffscreenToBackgroundMessage({ type: "start" })).toBe(false);
  });

  it("uses `capture_error`, not `failed`, for producer failures", () => {
    expect(OFFSCREEN_TO_BACKGROUND_MESSAGE_TYPES).toContain("capture_error");
    expect(OFFSCREEN_TO_BACKGROUND_MESSAGE_TYPES).not.toContain("failed");
    expect(isOffscreenToBackgroundMessage({ type: "capture_error" })).toBe(true);
  });

  it("exposes chunk_credit as a Background->Offscreen message", () => {
    expect(BACKGROUND_TO_OFFSCREEN_MESSAGE_TYPES).toContain("chunk_credit");
  });

  it("rejects a malformed message", () => {
    expect(isOffscreenToBackgroundMessage(null)).toBe(false);
    expect(isOffscreenToBackgroundMessage({ type: "nope" })).toBe(false);
    expect(isBackgroundToOffscreenMessage({ type: "ready" })).toBe(false);
  });
});

describe("frozen limits and audio config", () => {
  it("pins every limit from the schema", () => {
    expect(RELAY_V10.maxRawChunkBytes).toBe(49_152);
    expect(RELAY_V10.maxEncodedChunkChars).toBe(65_536);
    expect(RELAY_V10.creditWindowChunks).toBe(1);
    expect(RELAY_V10.runtimeMaxInFlightChunks).toBe(1);
    expect(RELAY_V10.maxOutstandingChunks).toBe(32);
    expect(RELAY_V10.maxOutstandingRawBytes).toBe(1_572_864);
    expect(RELAY_V10.portConnectTimeoutMs).toBe(5_000);
    expect(RELAY_V10.runtimeStartTimeoutMs).toBe(10_000);
    expect(RELAY_V10.chunkAckTimeoutMs).toBe(10_000);
    expect(RELAY_V10.cleanupTimeoutMs).toBe(10_000);
    expect(RELAY_V10.finalizeTimeoutMs).toBe(120_000);
    expect(RELAY_V10.maxCaptureMs).toBe(900_000);
    expect(RELAY_V10.maxCaptureBytes).toBe(536_870_912);
    expect(RELAY_V10.markerTtlMs).toBe(1_080_000);
  });

  it("pins the audio config", () => {
    expect(RELAY_AUDIO_CONFIG).toEqual({
      sampleRateHz: 16_000,
      channels: 1,
      sampleWidthBytes: 2
    });
  });

  it("uses the frozen Port name", () => {
    expect(MEDIA_CAPTURE_AUDIO_PORT_NAME).toBe("navia.mediaCapture.audio/v11");
    expect(PORT_MESSAGE.READY).toBe("ready");
  });
});

describe("frozen session id format", () => {
  it("generates cap_ + 32 base64url chars", () => {
    for (let index = 0; index < 20; index += 1) {
      const id = newCaptureSessionId();
      expect(SESSION_ID_PATTERN.test(id)).toBe(true);
      expect(id.startsWith("cap_")).toBe(true);
      expect(id.slice(4)).toHaveLength(32);
    }
  });

  it("rejects non-frozen session ids", () => {
    for (const bad of ["", "cap_", "cap_short", "0".repeat(36), "xyz_" + "a".repeat(32)]) {
      expect(SESSION_ID_PATTERN.test(bad)).toBe(false);
    }
  });
});

describe("frozen failure normalization", () => {
  it("keeps a known public relay code", () => {
    expect(normalizeRelayFailureCode("V3_MEDIA_CAPTURE_CHUNK_INVALID", RELAY_FAILURE_CODES.PROTOCOL_INVALID))
      .toBe("V3_MEDIA_CAPTURE_CHUNK_INVALID");
    expect(isRelayFailureCode("V3_MEDIA_CAPTURE_CHUNK_INVALID")).toBe(true);
  });

  it("maps the producer-internal AudioContext diagnostic to the public code", () => {
    // m-R1-01: the producer diagnostic is retained and normalized.
    expect(isProducerInternalCode("V3_MEDIA_CAPTURE_AUDIO_CONTEXT_SUSPENDED")).toBe(true);
    expect(isRelayFailureCode("V3_MEDIA_CAPTURE_AUDIO_CONTEXT_SUSPENDED")).toBe(false);
    expect(normalizeRelayFailureCode("V3_MEDIA_CAPTURE_AUDIO_CONTEXT_SUSPENDED", RELAY_FAILURE_CODES.PROTOCOL_INVALID))
      .toBe("V3_MEDIA_CAPTURE_AUDIO_SHAPE_INVALID");
  });

  it("collapses unknown strings (paths, secrets) to the fixed fallback", () => {
    for (const leak of [
      "/home/user/.config/secret",
      "sk-abcdefghijklmnopqrst",
      "Cookie: SESSDATA=abc",
      "ws://127.0.0.1:17861/x",
      "V3_MEDIA_TRANSCRIPT_CLEANUP_INCOMPLETE"
    ]) {
      expect(normalizeRelayFailureCode(leak, RELAY_FAILURE_CODES.RUNTIME_DISCONNECTED))
        .toBe("V3_MEDIA_CAPTURE_RUNTIME_DISCONNECTED");
    }
  });

  it("keeps the public inventory at 20 codes", () => {
    expect(Object.keys(RELAY_FAILURE_CODES)).toHaveLength(20);
  });
});

describe("frozen restart marker", () => {
  it("pins schemaVersion, fields and phases", () => {
    expect(RESTART_MARKER_SCHEMA_VERSION).toBe("v3-media-capture-restart-marker/v10");
    expect([...RESTART_MARKER_FIELDS]).toEqual([
      "schemaVersion", "captureSessionId", "taskId", "startedAt", "phase", "expiresAt"
    ]);
    expect([...RESTART_MARKER_PHASES]).toEqual([
      "connecting", "runtime_started", "capturing", "draining", "cleanup_pending"
    ]);
  });

  it("pins the legal phase transitions", () => {
    expect(RESTART_MARKER_TRANSITIONS.connecting).toEqual(["runtime_started"]);
    expect(RESTART_MARKER_TRANSITIONS.runtime_started).toEqual(["capturing"]);
    expect(RESTART_MARKER_TRANSITIONS.capturing).toEqual(["draining"]);
    expect(RESTART_MARKER_TRANSITIONS.draining).toEqual(["cleanup_pending"]);
    expect(RESTART_MARKER_TRANSITIONS.cleanup_pending).toEqual([]);
  });

  it("builds a marker with exactly the frozen fields and no secrets", () => {
    const marker: RelayRestartMarker = {
      schemaVersion: RESTART_MARKER_SCHEMA_VERSION,
      captureSessionId: newCaptureSessionId(),
      taskId: "media_task_" + "1".repeat(32),
      startedAt: new Date(1_700_000_000_000).toISOString(),
      phase: "capturing",
      expiresAt: new Date(1_700_000_000_000 + 1_080_000).toISOString()
    };
    expect(Object.keys(marker).sort()).toEqual([...RESTART_MARKER_FIELDS].sort());
    const serialized = JSON.stringify(marker);
    for (const forbidden of ["ticket", "grantId", "streamId", "pcm", "sourceIdentity", "SESSDATA", "sk-"]) {
      expect(serialized).not.toContain(forbidden);
    }
  });
});

describe("frozen Offscreen sender rule", () => {
  it("emits only fixed, non-sensitive mismatch diagnostics", () => {
    expect(classifyOffscreenPortSender(senderFacts({ extensionId: "other" }))).toBe("extension_id_mismatch");
    expect(classifyOffscreenPortSender(senderFacts({ senderUrl: undefined }))).toBe("sender_url_mismatch");
    expect(classifyOffscreenPortSender(senderFacts({ documentId: undefined }))).toBeNull();
    expect(classifyOffscreenPortSender(senderFacts({ contexts: [] }))).toBe("context_count_mismatch");
    expect(classifyOffscreenPortSender(senderFacts({
      contexts: [{ ...contexts("doc-1")[0], documentId: undefined } as unknown as chrome.runtime.ExtensionContext]
    }))).toBe("context_document_id_missing");
    expect(classifyOffscreenPortSender(senderFacts({ contexts: contexts("other-doc") }))).toBe("context_document_mismatch");
    expect(classifyOffscreenPortSender(senderFacts())).toBeNull();
  });

  it("accepts the canonical sender", () => {
    expect(validateOffscreenPortSender(senderFacts())).toBeNull();
  });

  it("accepts an absent frameId", () => {
    expect(validateOffscreenPortSender(senderFacts({ frameId: undefined }))).toBeNull();
  });

  it("rejects a non-zero frameId", () => {
    expect(validateOffscreenPortSender(senderFacts({ frameId: 1 })))
      .toBe(RELAY_FAILURE_CODES.PORT_FORBIDDEN);
    expect(validateOffscreenPortSender(senderFacts({ frameId: 7 })))
      .toBe(RELAY_FAILURE_CODES.PORT_FORBIDDEN);
  });

  it("requires an EXACT sender URL, not a prefix", () => {
    expect(validateOffscreenPortSender(senderFacts({ senderUrl: `${OFFSCREEN_URL}/extra` })))
      .toBe(RELAY_FAILURE_CODES.PORT_FORBIDDEN);
    expect(validateOffscreenPortSender(senderFacts({ senderUrl: "https://www.bilibili.com/video/BV1" })))
      .toBe(RELAY_FAILURE_CODES.PORT_FORBIDDEN);
    expect(validateOffscreenPortSender(senderFacts({ senderUrl: undefined })))
      .toBe(RELAY_FAILURE_CODES.PORT_FORBIDDEN);
  });

  it("rejects a wrong extension or tab and accepts an absent optional sender documentId", () => {
    expect(validateOffscreenPortSender(senderFacts({ extensionId: "other" })))
      .toBe(RELAY_FAILURE_CODES.PORT_FORBIDDEN);
    expect(validateOffscreenPortSender(senderFacts({ hasSenderTab: true })))
      .toBe(RELAY_FAILURE_CODES.PORT_FORBIDDEN);
    expect(validateOffscreenPortSender(senderFacts({ documentId: undefined }))).toBeNull();
  });

  it("requires exactly one matching OFFSCREEN_DOCUMENT context", () => {
    expect(validateOffscreenPortSender(senderFacts({ contexts: [] })))
      .toBe(RELAY_FAILURE_CODES.PORT_FORBIDDEN);
    expect(validateOffscreenPortSender(senderFacts({ contexts: contexts("doc-1").concat(contexts("doc-1")) })))
      .toBe(RELAY_FAILURE_CODES.PORT_FORBIDDEN);
    expect(validateOffscreenPortSender(senderFacts({ contexts: contexts("other-doc") })))
      .toBe(RELAY_FAILURE_CODES.PORT_FORBIDDEN);
  });

  it("rejects an incognito mismatch and a non-offscreen context type", () => {
    expect(validateOffscreenPortSender(senderFacts({ contexts: contexts("doc-1", true) })))
      .toBe(RELAY_FAILURE_CODES.PORT_FORBIDDEN);
    const wrongType = [{ contextType: "TAB", documentId: "doc-1", incognito: false } as unknown as chrome.runtime.ExtensionContext];
    expect(validateOffscreenPortSender(senderFacts({ contexts: wrongType })))
      .toBe(RELAY_FAILURE_CODES.PORT_FORBIDDEN);
  });
});
