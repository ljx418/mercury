/**
 * R6-G1 — RLY11-N01..N06.
 *
 * Production owner: `OffscreenAudioPort` sender validator.
 * Driver: the production `accept()` state machine; only `chrome.runtime`
 * (an unavoidable browser primitive) is controlled.
 *
 * Frozen boundary: every sender/context mismatch is `V3_MEDIA_CAPTURE_PORT_FORBIDDEN`,
 * rejected BEFORE the Port binds — no socket, no credit, no marker, one disconnect.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  authoritativeContext,
  FakeOffscreenPort,
  immediateWait,
  makeAudioPort,
  R6_EXT_ID,
  R6_OFFSCREEN_ORIGIN,
  R6_OFFSCREEN_URL,
  stubChromeRuntimeId,
  validSender
} from "./R6RelayHarness";

const PORT_FORBIDDEN = "V3_MEDIA_CAPTURE_PORT_FORBIDDEN";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/**
 * Assert the single frozen rejection shape for a sender that must never bind:
 * exact code, the Port disconnected, no transport activity, no marker.
 */
function expectRejectedBeforeBinding(outcome: {
  port: ReturnType<typeof makeAudioPort>;
  producer: FakeOffscreenPort;
  result: Awaited<ReturnType<ReturnType<typeof makeAudioPort>["port"]["accept"]>>;
  expectedDiagnostic: string;
}): void {
  expect(outcome.result).toEqual({ ok: false, failureCode: PORT_FORBIDDEN });
  expect(outcome.producer.disconnectCount).toBe(1);
  expect(outcome.port.port.connected).toBe(false);
  expect(outcome.port.port.boundDocumentId).toBeNull();
  expect(outcome.port.failures).toEqual([PORT_FORBIDDEN]);
  expect(outcome.port.disconnects).toEqual([]);
  expect(outcome.port.socket.sent).toEqual([]);
  expect(outcome.port.socket.closeCalls).toEqual([]);
  expect(outcome.port.port.lastAcceptDiagnostic).toBe(outcome.expectedDiagnostic);
}

describe("R6-G1 RLY11-N01..N06 — Offscreen Port sender boundary", () => {
  it("RLY11-N01 rejects a sender whose extension id is not this extension", async () => {
    stubChromeRuntimeId(R6_EXT_ID);
    const harness = makeAudioPort({ waitForContext: immediateWait });
    const producer = new FakeOffscreenPort({ sender: validSender({ id: "zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz" } as never) });

    const result = await harness.port.accept(producer);

    expectRejectedBeforeBinding({ port: harness, producer, result, expectedDiagnostic: "extension_id_mismatch" });
  });

  it("RLY11-N02 rejects a sender URL that is not the exact Offscreen document", async () => {
    stubChromeRuntimeId(R6_EXT_ID);
    const harness = makeAudioPort({ waitForContext: immediateWait });
    // A prefix of the expected URL is still a mismatch: the rule is equality.
    const producer = new FakeOffscreenPort({
      sender: validSender({ url: `${R6_EXT_ID}/offscreen-extra.html`.replace(/^/, `chrome-extension://`) } as never)
    });

    const result = await harness.port.accept(producer);

    expectRejectedBeforeBinding({ port: harness, producer, result, expectedDiagnostic: "sender_url_mismatch" });
  });

  it("RLY11-N03 rejects a sender that carries a tab", async () => {
    stubChromeRuntimeId(R6_EXT_ID);
    const harness = makeAudioPort({ waitForContext: immediateWait });
    const producer = new FakeOffscreenPort({
      sender: validSender({ tab: { id: 4242, url: "https://www.bilibili.com/video/BV1fixed0000000" } } as never)
    });

    const result = await harness.port.accept(producer);

    expectRejectedBeforeBinding({ port: harness, producer, result, expectedDiagnostic: "sender_tab_present" });
  });

  it("RLY11-N04 rejects a non-zero frame id", async () => {
    stubChromeRuntimeId(R6_EXT_ID);
    const harness = makeAudioPort({ waitForContext: immediateWait });
    const producer = new FakeOffscreenPort({ sender: validSender({ frameId: 7 } as never) });

    const result = await harness.port.accept(producer);

    expectRejectedBeforeBinding({ port: harness, producer, result, expectedDiagnostic: "frame_id_mismatch" });
  });

  it("RLY11-N05 fails closed when the authoritative Offscreen context is missing, ambiguous, mismatched or replaced", async () => {
    // Four distinct hostile getContexts answers, each independently fatal.
    const scenarios: Array<{ label: string; contexts: chrome.runtime.ExtensionContext[]; diagnostic: string }> = [
      { label: "missing", contexts: [], diagnostic: "context_count_mismatch" },
      {
        label: "ambiguous",
        contexts: [authoritativeContext(), authoritativeContext({ documentId: "doc-r6-authoritative-2" })],
        diagnostic: "context_count_mismatch"
      },
      {
        label: "mismatched URL",
        contexts: [authoritativeContext({ documentUrl: `${R6_OFFSCREEN_URL}?other=1` })],
        diagnostic: "context_url_mismatch"
      },
      {
        label: "mismatched origin",
        contexts: [authoritativeContext({ documentOrigin: `chrome-extension://${"b".repeat(32)}` })],
        diagnostic: "context_origin_mismatch"
      },
      {
        label: "empty document id",
        contexts: [authoritativeContext({ documentId: "" })],
        diagnostic: "context_document_id_missing"
      },
      {
        label: "replaced document",
        contexts: [authoritativeContext({ documentId: "doc-r6-replaced-9" })],
        diagnostic: "context_document_mismatch"
      }
    ];

    for (const scenario of scenarios) {
      stubChromeRuntimeId(R6_EXT_ID);
      const harness = makeAudioPort({
        contexts: async () => scenario.contexts,
        waitForContext: immediateWait
      });
      const producer = new FakeOffscreenPort({ sender: validSender({ documentId: "doc-r6-authoritative-1" } as never) });

      const result = await harness.port.accept(producer);

      expectRejectedBeforeBinding({ port: harness, producer, result, expectedDiagnostic: scenario.diagnostic });
      // A non-empty mismatch must not be retried away by the bounded wait.
      expect(harness.port.connected, scenario.label).toBe(false);
    }
  });

  it("RLY11-N06 rejects a sender whose incognito state differs from the extension", async () => {
    stubChromeRuntimeId(R6_EXT_ID);
    const harness = makeAudioPort({
      contexts: async () => [authoritativeContext({ incognito: true })],
      waitForContext: immediateWait
    });
    const producer = new FakeOffscreenPort({ sender: validSender() });

    const result = await harness.port.accept(producer);

    expectRejectedBeforeBinding({ port: harness, producer, result, expectedDiagnostic: "incognito_mismatch" });
    // The origin was still the frozen one: only incognito was hostile.
    expect(harness.socket.sent).toEqual([]);
  });

  it("accepts the single authoritative Offscreen context and binds nothing before validation completes", async () => {
    stubChromeRuntimeId(R6_EXT_ID);
    const harness = makeAudioPort({ waitForContext: immediateWait });
    const producer = new FakeOffscreenPort({ sender: validSender() });

    const result = await harness.port.accept(producer);

    expect(result).toEqual({ ok: true });
    expect(producer.disconnectCount).toBe(0);
    expect(harness.port.connected).toBe(true);
    expect(harness.port.boundDocumentId).toBe("doc-r6-authoritative-1");
    expect(harness.failures).toEqual([]);
    // Accepting a producer must NOT by itself open the Runtime socket.
    expect(harness.socket.sent).toEqual([]);
    expect(R6_OFFSCREEN_ORIGIN).toBe(`chrome-extension://${R6_EXT_ID}`);
  });
});
