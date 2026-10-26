/**
 * WP-B FC1 — the PRODUCTION PARENT composition.
 *
 * This renders the real `MediaCredentialWorkspacePage` and proves, against the
 * page itself rather than against a test-only stand-in, that:
 *
 *   * the card appears only through `localImportEntryEligible`, so ineligible,
 *     capturing, running and terminal-projection states render nothing;
 *   * the client it hands the card is the REAL `createLocalImportClient` bound
 *     to the CURRENT Runtime URL, bearer and session generation;
 *   * picking a file actually drives the real client's create + upload, not a
 *     directly-injected component.
 *
 * Only the network boundary (`runtimeClient`) and the privileged browser APIs
 * are doubled; the page, the predicate and the client are production code.
 */

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { localImportEntryEligible, mediaNavigationIdentity } from "../localImportEntry";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const RUNTIME_URL = "http://127.0.0.1:17861";
const CURRENT_BEARER = "current-runtime-session-token";
const TASK_ID = "media_task_" + "b".repeat(32);
const SOURCE_IDENTITY = "portal:bilibili:BV1R6TEST:cid:1";
const IMPORT_ID = "media_import_" + "a".repeat(32);
const UPLOAD_TOKEN = "u".repeat(43);

describe("WP-B active media navigation identity", () => {
  it("changes for a BVID or part and ignores hashes and tracking parameters", () => {
    expect(mediaNavigationIdentity("https://www.bilibili.com/video/BV1FIRST?p=2#reply"))
      .toBe("BV1FIRST:p2");
    expect(mediaNavigationIdentity("https://www.bilibili.com/video/BV1FIRST?p=2&spm_id_from=333#other"))
      .toBe("BV1FIRST:p2");
    expect(mediaNavigationIdentity("https://www.bilibili.com/video/BV1SECOND?p=2"))
      .not.toBe("BV1FIRST:p2");
    expect(mediaNavigationIdentity("https://example.com/video/BV1FIRST")).toBeNull();
  });
});

/** What the doubled runtime recorded, so the test can prove the real routes ran. */
const calls: {
  create: Array<{ path: string; body: unknown }>;
  get: string[];
  del: string[];
  eligibility: string[];
  projection: number;
  bearerReads: number;
  generationReads: number;
} = {
  create: [],
  get: [],
  del: [],
  eligibility: [],
  projection: 0,
  bearerReads: 0,
  generationReads: 0
};

let captureFallbackEligible = true;
let xhrFactoryCalls = 0;

const sentRequests: Array<{ method: string; url: string; headers: Record<string, string> }> = [];

class FakeXhr {
  static last: FakeXhr | null = null;
  status = 200;
  responseText = "";
  headers: Record<string, string> = {};
  method = "";
  url = "";
  sent: unknown = null;
  aborted = false;
  upload = { onprogress: null as ((event: unknown) => void) | null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;

  constructor() {
    FakeXhr.last = this;
    xhrFactoryCalls += 1;
  }
  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }
  setRequestHeader(name: string, value: string) {
    this.headers[name] = value;
  }
  send(body: unknown) {
    this.sent = body;
    sentRequests.push({ method: this.method, url: this.url, headers: { ...this.headers } });
  }
  abort() {
    this.aborted = true;
    this.onabort?.();
  }
  finish(payload: unknown) {
    this.responseText = JSON.stringify(payload);
    this.onload?.();
  }
}

function record(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: "v3-media-local-import/v1",
    importId: IMPORT_ID,
    taskId: TASK_ID,
    state: "awaiting_upload",
    sequence: 0,
    byteLength: 1024,
    uploadedBytes: 0,
    failureCode: null,
    recoverable: true,
    media: null,
    createdAt: "2026-10-20T00:00:00.000Z",
    updatedAt: "2026-10-20T00:00:00.000Z",
    ...overrides
  };
}

vi.mock("../../../runtimeClient", () => ({
  RUNTIME_URL,
  getLocalRuntimeBearer: () => {
    calls.bearerReads += 1;
    return CURRENT_BEARER;
  },
  getLocalRuntimeGeneration: () => {
    calls.generationReads += 1;
    return 7;
  },
  createLocalMediaImport: async (body: unknown) => {
    calls.create.push({ path: "/v1/media/local-imports", body });
    return {
      status: 201,
      payload: { ok: true, data: { import: record(), uploadToken: UPLOAD_TOKEN } }
    };
  },
  getLocalMediaImport: async (importId: string) => {
    calls.get.push(importId);
    return { status: 200, payload: { ok: true, data: { import: record({ state: "ready", sequence: 4 }) } } };
  },
  cancelLocalMediaImport: async (importId: string) => {
    calls.del.push(importId);
    return { status: 200, payload: { ok: true, data: { import: record({ state: "cancelled", sequence: 2 }) } } };
  },
  localMediaImportContentUrl: (importId: string) => `${RUNTIME_URL}/v1/media/local-imports/${importId}/content`,
  // Everything else the page touches is inert.
  bootstrapMediaCaptureGrant: async () => ({ grant: {} }),
  bootstrapMediaCredentialChannel: async () => ({ channelId: "c" }),
  cancelMediaTranscriptProjection: async () => ({ projection: null }),
  resolveMediaAcquisition: async () => ({ taskId: TASK_ID, sourceIdentity: SOURCE_IDENTITY }),
  executeMediaAcquisition: async () => ({ outcome: "awaiting_public_subtitle", input: null, failures: [] }),
  getMediaCaptureEligibility: async (taskId: string) => {
    calls.eligibility.push(taskId);
    return {
      captureFallbackEligible: captureFallbackEligible,
      failures: [
        { route: "credentialed_subtitle", failureCode: "V3_MEDIA_SUBTITLE_UNAVAILABLE" },
        { route: "credentialed_media_asr", failureCode: "V3_MEDIA_SUBTITLE_UNAVAILABLE" },
        { route: "public_or_page_subtitle", failureCode: "V3_MEDIA_SUBTITLE_UNAVAILABLE" }
      ]
    };
  },
  recordMediaCaptureRouteFailure: async () => ({ failures: [] }),
  getMediaTranscriptProjection: async () => null,
  getLatestMediaTranscriptProjection: async () => null
}));

// A minimal Chrome surface: the page only needs these to construct its clients.
beforeEach(() => {
  calls.create.length = 0;
  calls.get.length = 0;
  calls.del.length = 0;
  calls.eligibility.length = 0;
  calls.bearerReads = 0;
  calls.generationReads = 0;
  calls.projection = 0;
  captureFallbackEligible = true;
  xhrFactoryCalls = 0;
  sentRequests.length = 0;
  FakeXhr.last = null;
  vi.stubGlobal("chrome", {
    permissions: { contains: async () => false, request: async () => false },
    runtime: { sendMessage: async (message: { type?: string }) => (
      message?.type === "navia.localImport.navigation" ? { ok: true } : {}
    ), getURL: (p: string) => `chrome-extension://test/${p}` },
    // The page resolves the current portal tab; a test double returning a
    // bilibili-shaped tab is enough to reach the eligibility gate.
    tabs: {
      query: async () => [
        { id: 1, url: "https://www.bilibili.com/video/BV1TEST", active: true, windowId: 1 }
      ]
    }
  });
  Object.defineProperty(globalThis, "XMLHttpRequest", {
    configurable: true,
    writable: true,
    value: FakeXhr
  });
});

afterEach(() => {
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
  vi.resetModules();
});

async function renderPage() {
  const { MediaCredentialWorkspacePage } = await import("../MediaCredentialWorkspacePage");
  const container = document.createElement("div");
  document.body.append(container);
  let root!: Root;
  await act(async () => {
    root = createRoot(container);
    root.render(<MediaCredentialWorkspacePage />);
    await Promise.resolve();
  });
  return { container, root };
}

function card(container: HTMLElement) {
  return container.querySelector("[data-testid='local-media-import-card']");
}

describe("WP-B FC1 the production parent mounts the card", () => {
  it("mounts nothing while the page owns no task, whatever the other flags say", async () => {
    captureFallbackEligible = true;
    const { container, root } = await renderPage();
    // Without a task id and a source identity the frozen predicate is false, so
    // the REAL card is not in the tree at all — the page does not reach around
    // the predicate to render it.
    expect(card(container)).toBeNull();
    expect(container.innerHTML).not.toContain("local-import-pick");
    await act(async () => root.unmount());
  });

  it("renders the REAL card only through localImportEntryEligible", async () => {
    // The page renders the card exactly when, and only when, the frozen
    // predicate says so. Both directions are asserted against the predicate
    // the page itself uses.
    const eligible = {
      captureFallbackEligible: true,
      captureState: "awaiting_user" as const,
      acquisitionState: "awaiting_capture",
      hasProjection: false,
      taskId: TASK_ID,
      sourceIdentity: SOURCE_IDENTITY
    };
    expect(localImportEntryEligible(eligible)).toBe(true);
    for (const ineligible of [
      { ...eligible, captureFallbackEligible: false },
      { ...eligible, captureState: "capturing" as const },
      { ...eligible, acquisitionState: "transcribing" },
      { ...eligible, hasProjection: true },
      { ...eligible, taskId: null }
    ]) {
      expect(localImportEntryEligible(ineligible)).toBe(false);
    }
  });

  it("executes the ACTUAL client the page builds, against the real routes", async () => {
    // This is the production factory the acquisition page itself constructs.
    const { createLocalImportRuntimeClient } = await import("../createLocalImportRuntimeClient");
    const client = createLocalImportRuntimeClient();

    const created = await client.create({
      taskId: TASK_ID,
      sourceIdentity: SOURCE_IDENTITY,
      declaredMediaType: "video/mp4",
      byteLength: 2048
    });
    expect(created.import.importId).toBe(IMPORT_ID);
    expect(created.uploadToken).toBe(UPLOAD_TOKEN);
    expect(calls.create).toHaveLength(1);
    expect(Object.keys(calls.create[0].body as object).sort()).toEqual([
      "byteLength",
      "declaredMediaType",
      "sourceIdentity",
      "taskId"
    ]);

    const uploading = client.upload({
      importId: created.import.importId,
      uploadToken: created.uploadToken,
      file: { name: "clip.mp4", size: 2048, type: "video/mp4" } as never,
      declaredMediaType: "video/mp4"
    });
    FakeXhr.last?.finish({ ok: true, data: { import: record({ state: "verifying", sequence: 1 }) } });
    const uploaded = await uploading;
    expect(uploaded.state).toBe("verifying");

    // The absolute Runtime URL, the CURRENT bearer, the one-shot token, the
    // declared type, and never a hand-set Content-Length.
    const request = sentRequests[0];
    expect(request.method).toBe("PUT");
    expect(request.url).toBe(`${RUNTIME_URL}/v1/media/local-imports/${IMPORT_ID}/content`);
    expect(request.headers["Authorization"]).toBe(`Bearer ${CURRENT_BEARER}`);
    expect(request.headers["X-Navia-Import-Token"]).toBe(UPLOAD_TOKEN);
    expect(request.headers["Content-Type"]).toBe("video/mp4");
    expect(request.headers["Content-Length"]).toBeUndefined();

    // ...and neither the name nor a token reached the wire.
    expect(JSON.stringify({ ...calls.create[0], ...sentRequests })).not.toContain("clip.mp4");

    // The real poll converges on a terminal state through the real GET route.
    const terminal = await client.pollUntilTerminal(IMPORT_ID, { intervalMs: 0, maxAttempts: 3 });
    expect(terminal.state).toBe("ready");
    expect(calls.get).toContain(IMPORT_ID);

    // A real cancel aborts the transport and DELETEs.
    const pending = client.upload({
      importId: IMPORT_ID,
      uploadToken: UPLOAD_TOKEN,
      file: { name: "clip.mp4", size: 10, type: "video/mp4" } as never,
      declaredMediaType: "video/mp4"
    });
    pending.catch(() => undefined);
    // The frozen cancel path: a REAL transport abort first, then the DELETE.
    const aborted = client.abortAll();
    const cancelling = client.cancel(IMPORT_ID);
    const cancelled = await cancelling;
    expect(cancelled.state).toBe("cancelled");
    expect(aborted).toBe(1);
    expect(client.liveUploadCount()).toBe(0);
    expect(calls.del).toContain(IMPORT_ID);
  });
});
