import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  OffscreenAudioPort,
  resolveOffscreenPortSenderIdentity,
  type OffscreenPortLike,
  type OffscreenPortSenderFacts
} from "../capture/OffscreenAudioPort";
import { MEDIA_CAPTURE_AUDIO_PORT_NAME } from "../capture/relayContracts";
import type { RuntimeCaptureTransport } from "../capture/RuntimeCaptureTransport";

const EXTENSION_ID = "abcdefghijklmnopabcdefghijklmnop";
const OFFSCREEN_URL = `chrome-extension://${EXTENSION_ID}/media-capture-offscreen.html`;
const EXTENSION_ORIGIN = `chrome-extension://${EXTENSION_ID}`;

function context(
  documentId: string | undefined = "context-doc-1",
  overrides: Partial<chrome.runtime.ExtensionContext> = {}
): chrome.runtime.ExtensionContext {
  return {
    contextType: "OFFSCREEN_DOCUMENT",
    documentId,
    documentUrl: OFFSCREEN_URL,
    documentOrigin: EXTENSION_ORIGIN,
    incognito: false,
    ...overrides
  } as unknown as chrome.runtime.ExtensionContext;
}

function facts(overrides: Partial<OffscreenPortSenderFacts> = {}): OffscreenPortSenderFacts {
  return {
    extensionId: EXTENSION_ID,
    senderUrl: OFFSCREEN_URL,
    hasSenderTab: false,
    frameId: 0,
    documentId: "context-doc-1",
    expectedExtensionId: EXTENSION_ID,
    expectedSenderUrl: OFFSCREEN_URL,
    expectedExtensionOrigin: EXTENSION_ORIGIN,
    extensionIncognito: false,
    contexts: [context()],
    ...overrides
  };
}

function port(senderOverrides: Partial<chrome.runtime.MessageSender> = {}) {
  const messageListeners: Array<(message: unknown) => void> = [];
  const disconnectListeners: Array<() => void> = [];
  let disconnectCount = 0;
  const value: OffscreenPortLike = {
    name: MEDIA_CAPTURE_AUDIO_PORT_NAME,
    sender: {
      id: EXTENSION_ID,
      url: OFFSCREEN_URL,
      documentId: "context-doc-1",
      frameId: 0,
      ...senderOverrides
    } as unknown as chrome.runtime.MessageSender,
    postMessage: () => undefined,
    disconnect: () => { disconnectCount += 1; },
    onMessage: { addListener: (listener) => messageListeners.push(listener) },
    onDisconnect: { addListener: (listener) => disconnectListeners.push(listener) }
  };
  return {
    value,
    emitMessage: (message: unknown) => messageListeners.forEach((listener) => listener(message)),
    emitDisconnect: () => disconnectListeners.forEach((listener) => listener()),
    disconnectCount: () => disconnectCount
  };
}

function transportStub() {
  let producerReadyCalls = 0;
  return {
    value: {
      captureSessionId: "cap_" + "a".repeat(32),
      terminalReached: false,
      markProducerReady: () => { producerReadyCalls += 1; },
      offerChunkMessage: () => ({ ok: true }),
      markQuiesced: () => undefined,
      markOffscreenStopped: () => undefined
    } as unknown as RuntimeCaptureTransport,
    producerReadyCalls: () => producerReadyCalls
  };
}

function forbiddenResult() {
  return { ok: false, failureCode: "V3_MEDIA_CAPTURE_PORT_FORBIDDEN" };
}

beforeEach(() => {
  (globalThis as unknown as { chrome: unknown }).chrome = {
    runtime: { id: EXTENSION_ID }
  };
});

afterEach(() => {
  delete (globalThis as unknown as { chrome?: unknown }).chrome;
});

describe("relay v11 sender policy: 3 positive cases", () => {
  it("SP11-P01 accepts a present matching sender documentId and binds the context ID", () => {
    expect(resolveOffscreenPortSenderIdentity(facts())).toEqual({
      ok: true,
      authoritativeDocumentId: "context-doc-1"
    });
  });

  it("SP11-P02 accepts an absent sender documentId and binds the context ID", () => {
    expect(resolveOffscreenPortSenderIdentity(facts({ documentId: undefined }))).toEqual({
      ok: true,
      authoritativeDocumentId: "context-doc-1"
    });
  });

  it("SP11-P03 waits through an empty lookup and accepts one authoritative context", async () => {
    const candidate = port({ documentId: undefined });
    const transport = transportStub();
    let lookups = 0;
    const owner = new OffscreenAudioPort({
      expectedSenderUrl: OFFSCREEN_URL,
      extensionIncognito: false,
      getContexts: async () => (++lookups === 1 ? [] : [context()]),
      waitForContext: async () => undefined
    }, transport.value);

    expect(await owner.accept(candidate.value)).toEqual({ ok: true });
    expect(lookups).toBe(2);
    expect(owner.boundDocumentId).toBe("context-doc-1");
  });
});

describe("relay v11 sender policy: 14 fail-closed cases", () => {
  it.each([
    ["SP11-N01 extension id", { extensionId: "other" }, "extension_id_mismatch"],
    ["SP11-N02 sender tab", { hasSenderTab: true }, "sender_tab_present"],
    ["SP11-N03 sender URL", { senderUrl: `${OFFSCREEN_URL}/extra` }, "sender_url_mismatch"],
    ["SP11-N04 frame", { frameId: 1 }, "frame_id_mismatch"],
    ["SP11-N07 multiple contexts", { contexts: [context(), context("context-doc-2")] }, "context_count_mismatch"],
    ["SP11-N08 wrong context type", { contexts: [context("context-doc-1", { contextType: "TAB" })] }, "context_count_mismatch"],
    ["SP11-N09 context URL", { contexts: [context("context-doc-1", { documentUrl: `${OFFSCREEN_URL}/extra` })] }, "context_url_mismatch"],
    ["SP11-N10 context origin", { contexts: [context("context-doc-1", { documentOrigin: "chrome-extension://other" })] }, "context_origin_mismatch"],
    ["SP11-N11 incognito", { contexts: [context("context-doc-1", { incognito: true })] }, "incognito_mismatch"],
    ["SP11-N12 missing context documentId", { contexts: [context("context-doc-1", { documentId: undefined })] }, "context_document_id_missing"],
    ["SP11-N13 sender/context mismatch", { documentId: "sender-doc-2" }, "context_document_mismatch"]
  ])("%s is rejected", (_caseId, override, diagnostic) => {
    expect(resolveOffscreenPortSenderIdentity(facts(override as Partial<OffscreenPortSenderFacts>)))
      .toEqual({ ok: false, diagnostic });
  });

  it("SP11-N05 rejects a context lookup exception", async () => {
    const candidate = port();
    const owner = new OffscreenAudioPort({
      expectedSenderUrl: OFFSCREEN_URL,
      extensionIncognito: false,
      getContexts: async () => { throw new Error("lookup failed"); },
      waitForContext: async () => undefined
    }, transportStub().value);

    expect(await owner.accept(candidate.value)).toEqual(forbiddenResult());
    expect(owner.lastAcceptDiagnostic).toBe("context_lookup_failed");
    expect(candidate.disconnectCount()).toBe(1);
  });

  it("SP11-N06 rejects zero contexts after the bounded wait", async () => {
    const candidate = port({ documentId: undefined });
    let lookups = 0;
    const owner = new OffscreenAudioPort({
      expectedSenderUrl: OFFSCREEN_URL,
      extensionIncognito: false,
      getContexts: async () => { lookups += 1; return []; },
      waitForContext: async () => undefined
    }, transportStub().value);

    expect(await owner.accept(candidate.value)).toEqual(forbiddenResult());
    expect(lookups).toBe(30);
    expect(owner.lastAcceptDiagnostic).toBe("context_count_mismatch");
  });

  it("SP11-N12 also rejects an empty authoritative context documentId", () => {
    expect(resolveOffscreenPortSenderIdentity(facts({ contexts: [context("")] }))).toEqual({
      ok: false,
      diagnostic: "context_document_id_missing"
    });
  });

  it("SP11-N14 rejects a replacement while one authoritative owner is active", async () => {
    const owner = new OffscreenAudioPort({
      expectedSenderUrl: OFFSCREEN_URL,
      extensionIncognito: false,
      getContexts: async () => [context()]
    }, transportStub().value);
    const first = port();
    const replacement = port({ documentId: "context-doc-2" });

    expect(await owner.accept(first.value)).toEqual({ ok: true });
    expect(await owner.accept(replacement.value)).toEqual({
      ok: false,
      failureCode: "V3_MEDIA_CAPTURE_ALREADY_ACTIVE"
    });
    expect(owner.boundDocumentId).toBe("context-doc-1");
    expect(replacement.disconnectCount()).toBe(1);
  });
});

describe("relay v11 async validation barrier", () => {
  it("rejects a Port that sends before context validation without mutating transport", async () => {
    const candidate = port({ documentId: undefined });
    const transport = transportStub();
    let release: ((contexts: chrome.runtime.ExtensionContext[]) => void) | undefined;
    const lookup = new Promise<chrome.runtime.ExtensionContext[]>((resolve) => { release = resolve; });
    const owner = new OffscreenAudioPort({
      expectedSenderUrl: OFFSCREEN_URL,
      extensionIncognito: false,
      getContexts: () => lookup
    }, transport.value);

    const accepting = owner.accept(candidate.value);
    candidate.emitMessage({ type: "ready", captureSessionId: "cap_" + "a".repeat(32) });
    release?.([context()]);

    expect(await accepting).toEqual(forbiddenResult());
    expect(transport.producerReadyCalls()).toBe(0);
    expect(owner.connected).toBe(false);
  });

  it("rejects a Port that disconnects before context validation", async () => {
    const candidate = port({ documentId: undefined });
    let release: ((contexts: chrome.runtime.ExtensionContext[]) => void) | undefined;
    const lookup = new Promise<chrome.runtime.ExtensionContext[]>((resolve) => { release = resolve; });
    const owner = new OffscreenAudioPort({
      expectedSenderUrl: OFFSCREEN_URL,
      extensionIncognito: false,
      getContexts: () => lookup
    }, transportStub().value);

    const accepting = owner.accept(candidate.value);
    candidate.emitDisconnect();
    release?.([context()]);

    expect(await accepting).toEqual(forbiddenResult());
    expect(owner.connected).toBe(false);
  });
});
