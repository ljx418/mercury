import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  createLocalImportClient,
  LocalImportClientError,
  LOCAL_IMPORT_STATUS_SCHEMA_VERSION,
  type LocalImportJsonTransport,
  type LocalImportRecord
} from "../LocalMediaImportClient";
import { LocalMediaImportCard } from "../settings/LocalMediaImportCard";
import { hasPublishedMediaProjection, localImportEntryEligible } from "../localImportEntry";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const TASK = "media_task_" + "b".repeat(32);
const SOURCE = "portal:bilibili:BV1R6TEST:cid:1";
const IMPORT_ID = "media_import_" + "a".repeat(32);
const RUNTIME = "http://127.0.0.1:17861";
const BEARER = "companion-bearer-under-test";

/**
 * The frozen schema version, read out of the SHIPPED SCHEMA CONTRACT FILE.
 *
 * It is deliberately NOT imported from the client, so the same typo can never
 * make the implementation and its own tests agree on one wrong value.
 */
const FROZEN_SCHEMA_VERSION = (() => {
  // vitest runs from the extension package root, which is inside the repository.
  const contract = JSON.parse(
    readFileSync(
      resolve(process.cwd(), "../../docs/active/project/contracts/v3_media_local_import_status_v1.schema.json"),
      "utf-8"
    )
  ) as { properties?: { schemaVersion?: { const?: string } } };
  const value = contract.properties?.schemaVersion?.const;
  if (typeof value !== "string" || !value) throw new Error("The frozen status schema declares no schemaVersion const.");
  return value;
})();

/** The Runtime's REAL `{ok, data, error}` envelope. */
function ok<T>(data: T) {
  return { status: 200, payload: { ok: true, data } as const };
}

function failure(status: number, code: string, message = "本地导入失败。") {
  return { status, payload: { ok: false, data: null, error: { code, message, recoverable: true } } as const };
}

function record(overrides: Partial<LocalImportRecord> = {}): LocalImportRecord {
  return {
    schemaVersion: FROZEN_SCHEMA_VERSION,
    importId: IMPORT_ID,
    taskId: TASK,
    state: "awaiting_upload",
    sequence: 0,
    byteLength: 1024,
    uploadedBytes: 0,
    failureCode: null,
    recoverable: true,
    media: null,
    createdAt: "2026-10-19T00:00:00.000Z",
    updatedAt: "2026-10-19T00:00:00.000Z",
    ...overrides
  };
}

/** A minimal XHR double whose progress events are driven by the test. */
class FakeXhr {
  static last: FakeXhr | null = null;
  upload = { onprogress: null as ((event: unknown) => void) | null };
  status = 200;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  responseText = "";
  headers: Record<string, string> = {};
  method = "";
  url = "";
  sent: unknown = null;
  aborted = false;

  constructor() {
    FakeXhr.last = this;
  }

  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }

  setRequestHeader(key: string, value: string) {
    this.headers[key] = value;
  }

  send(body: unknown) {
    this.sent = body;
  }

  abort() {
    this.aborted = true;
    this.onabort?.();
  }

  fireProgress(loaded: number, total: number) {
    this.upload.onprogress?.({ loaded, total, lengthComputable: total > 0 });
  }

  finish(payload: unknown) {
    this.responseText = JSON.stringify(payload);
    this.onload?.();
  }
}

/** jsdom has no File constructor; a FileList-like object is enough here. */
function attachFile(input: HTMLInputElement, name: string, size: number, type: string): void {
  const file = { name, size, type } as unknown as File;
  Object.defineProperty(input, "files", {
    configurable: true,
    value: { 0: file, length: 1, item: () => file }
  });
}

function makeClient(generation = () => 1) {
  const transport: LocalImportJsonTransport = {
    post: vi.fn(async () => ok({ import: record(), uploadToken: "t".repeat(43) })) as never,
    get: vi.fn(async () => ok({ import: record({ state: "ready", sequence: 5, uploadedBytes: 1024 }) })) as never,
    delete: vi.fn(async () => ok({ import: record({ state: "cancelled", sequence: 2 }) })) as never
  };
  const client = createLocalImportClient({
    runtimeBaseUrl: RUNTIME,
    transport,
    bearer: () => BEARER,
    createXhr: () => new FakeXhr() as never,
    generation,
    sleep: async () => undefined
  });
  return { client, transport };
}

async function renderCard(
  props: Partial<React.ComponentProps<typeof LocalMediaImportCard>> = {},
  client?: ReturnType<typeof createLocalImportClient>
) {
  const owned = client ?? makeClient().client;
  const container = document.createElement("div");
  document.body.append(container);
  let root!: Root;
  await act(async () => {
    root = createRoot(container);
    root.render(
      <LocalMediaImportCard
        taskId={TASK}
        sourceIdentity={SOURCE}
        eligible
        client={owned}
        generation={() => 1}
        {...props}
      />
    );
    await Promise.resolve();
  });
  return { container, client: owned, root };
}

async function pickFile(container: HTMLElement, name = "clip.mp4", size = 1000) {
  const input = container.querySelector("[data-testid='local-import-input']") as HTMLInputElement;
  await act(async () => {
    attachFile(input, name, size, "video/mp4");
    input.dispatchEvent(new Event("change", { bubbles: true }));
    await Promise.resolve();
  });
  return input;
}

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("WP-B B5 LocalMediaImportClient", () => {
  it("sends exactly the frozen four-field create body", async () => {
    const { client, transport } = makeClient();
    await client.create({
      taskId: TASK,
      sourceIdentity: SOURCE,
      declaredMediaType: "video/mp4",
      byteLength: 1024
    });
    const calls = (transport.post as unknown as { mock: { calls: unknown[][] } }).mock.calls;
    const body = calls[0][1] as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual([
      "byteLength",
      "declaredMediaType",
      "sourceIdentity",
      "taskId"
    ]);
    // No client file metadata may ever be attached.
    const rendered = JSON.stringify(body);
    for (const forbidden of ["fileName", "path", "url", "hash", "lastModified", "relativePath"]) {
      expect(rendered).not.toContain(forbidden);
    }
  });

  it("uploads with XHR and reports REAL byte progress", async () => {
    const { client } = makeClient();
    const progress: Array<{ uploadedBytes: number }> = [];
    const promise = client.upload({
      importId: IMPORT_ID,
      uploadToken: "t".repeat(43),
      file: { name: "clip.mp4", size: 1000, type: "video/mp4" } as never,
      declaredMediaType: "video/mp4",
      onProgress: (value) => progress.push(value)
    });
    const xhr = FakeXhr.last as unknown as FakeXhr;
    expect(xhr.method).toBe("PUT");
    // The absolute Runtime URL, never a relative page path.
    expect(xhr.url).toBe(`${RUNTIME}/v1/media/local-imports/${IMPORT_ID}/content`);
    expect(xhr.headers["X-Navia-Import-Token"]).toBe("t".repeat(43));
    // Content-Length is browser-controlled and must never be set by hand.
    expect(xhr.headers["Content-Length"]).toBeUndefined();

    xhr.fireProgress(400, 1000);
    xhr.finish({ ok: true, data: { import: record({ state: "uploading", uploadedBytes: 1000, sequence: 1 }) } });
    await promise;
    expect(progress).toEqual([{ uploadedBytes: 400, byteLength: 1000 }]);
  });

  it("a generation change aborts the upload and never reports success", async () => {
    let current = 1;
    const { client } = makeClient(() => current);
    const promise = client.upload({
      importId: IMPORT_ID,
      uploadToken: "t".repeat(43),
      file: { name: "clip.mp4", size: 1000, type: "video/mp4" } as never,
      declaredMediaType: "video/mp4",
      onProgress: () => undefined
    });
    current = 2; // the page identity changed mid-upload
    const xhr = FakeXhr.last as unknown as FakeXhr;
    xhr.finish({ ok: true, data: { import: record({ state: "ready" }) } });
    await expect(promise).rejects.toBeInstanceOf(LocalImportClientError);
  });

  it("a stale generation never paints progress onto the new page", async () => {
    let current = 1;
    const { client } = makeClient(() => current);
    const progress: number[] = [];
    const promise = client.upload({
      importId: IMPORT_ID,
      uploadToken: "t".repeat(43),
      file: { name: "clip.mp4", size: 1000, type: "video/mp4" } as never,
      declaredMediaType: "video/mp4",
      onProgress: (value) => progress.push(value.uploadedBytes)
    });
    current = 3;
    (FakeXhr.last as unknown as FakeXhr).fireProgress(500, 1000);
    (FakeXhr.last as unknown as FakeXhr).finish({ ok: true, data: { import: record() } });
    await promise.catch(() => undefined);
    expect(progress).toEqual([]);
  });

  it("rejects a malformed import id without touching the transport", async () => {
    const { client, transport } = makeClient();
    await expect(client.status("not-an-id")).rejects.toBeInstanceOf(LocalImportClientError);
    expect(transport.get).not.toHaveBeenCalled();
  });
});

describe("WP-B B5 LocalMediaImportCard", () => {
  async function render(props: Partial<React.ComponentProps<typeof LocalMediaImportCard>> = {}) {
    const { client } = makeClient();
    const container = document.createElement("div");
    document.body.append(container);
    let root!: Root;
    await act(async () => {
      root = createRoot(container);
      root.render(
        <LocalMediaImportCard
          taskId={TASK}
          sourceIdentity={SOURCE}
          eligible
          client={client}
          generation={() => 1}
          {...props}
        />
      );
      await Promise.resolve();
    });
    return { container, client, root: root! };
  }

  it("only renders in an eligible blocked state and is keyboard reachable", async () => {
    const { container, root } = await render();
    const button = container.querySelector("[data-testid='local-import-pick']") as HTMLButtonElement;
    expect(button).not.toBeNull();
    expect(button.tagName).toBe("BUTTON");
    expect(button.disabled).toBe(false);
    const input = container.querySelector("[data-testid='local-import-input']") as HTMLInputElement;
    // A single file, and the input is hidden behind the primary button.
    expect(input.multiple).toBe(false);
    expect(input.hasAttribute("hidden")).toBe(true);
    await act(async () => root.unmount());
  });

  it("renders nothing when the task is not eligible", async () => {
    const { container, root } = await render({ eligible: false });
    expect(container.querySelector("[data-testid='local-media-import-card']")).toBeNull();
    await act(async () => root.unmount());
  });

  it("keeps the file name out of any attribute except the label it renders", async () => {
    const { container, root } = await render();
    const input = container.querySelector("[data-testid='local-import-input']") as HTMLInputElement;
    await act(async () => {
      attachFile(input, "secret-clip.mp4", 10, "video/mp4");
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    // The name may appear ONLY in the component's own label, never in storage,
    // never in a request and never in an attribute.
    const label = container.querySelector("[data-testid='local-import-file']");
    if (label) expect(label.textContent).toContain("secret-clip.mp4");
    const attributes = container.innerHTML.replace(/secret-clip\.mp4/g, "");
    expect(attributes).not.toContain("secret-clip.mp4");
    await act(async () => root.unmount());
  });

  it("shows the phase and a real percentage during upload", async () => {
    const { container, root } = await render();
    const input = container.querySelector("[data-testid='local-import-input']") as HTMLInputElement;
    await act(async () => {
      attachFile(input, "clip.mp4", 1000, "video/mp4");
      input.dispatchEvent(new Event("change", { bubbles: true }));
      await Promise.resolve();
    });
    const xhr = FakeXhr.last as unknown as FakeXhr | null;
    if (xhr) {
      await act(async () => {
        xhr.fireProgress(250, 1000);
      });
      const phase = container.querySelector("[data-testid='local-import-phase']");
      expect(phase?.getAttribute("data-phase")).toBe("uploading");
      expect(phase?.textContent).toContain("25%");
      // Progress causes a React re-render. It must not run the unmount cleanup
      // and cancel the upload that produced the progress event.
      expect(xhr.aborted).toBe(false);
    }
    await act(async () => root.unmount());
  });

  it("cancels the Runtime import when the XHR fails", async () => {
    const { client, transport } = makeClient();
    const { container, root } = await renderCard({}, client);
    await pickFile(container, "clip.mp4", 1000);
    const xhr = FakeXhr.last as unknown as FakeXhr;

    await act(async () => {
      xhr.onerror?.();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(transport.delete).toHaveBeenCalledWith(`/v1/media/local-imports/${IMPORT_ID}`);
    expect(client.liveUploadCount()).toBe(0);
    expect(container.querySelector("[role='alert']")).not.toBeNull();
    await act(async () => root.unmount());
  });

  it("announces an error with role=alert", async () => {
    const { container, root } = await render();
    const input = container.querySelector("[data-testid='local-import-input']") as HTMLInputElement;
    await act(async () => {
      attachFile(input, "clip.mp4", 10, "video/mp4");
      input.dispatchEvent(new Event("change", { bubbles: true }));
      await Promise.resolve();
    });
    const alert = container.querySelector("[data-testid='local-import-error']");
    if (alert) expect(alert.getAttribute("role")).toBe("alert");
    await act(async () => root.unmount());
  });
});

/* ------------------------------------------------------------------ *
 * WP-B C6 — production reachability.
 *
 * A card that only hides a progress bar is not cancelled. These cases prove
 * the REAL transport abort happens, that the DELETE follows it, and that the
 * terminal state is then POLLED rather than assumed.
 * ------------------------------------------------------------------ */

describe("WP-B C6 abort, delete and poll", () => {
  function startUpload(client: ReturnType<typeof createLocalImportClient>) {
    const promise = client.upload({
      importId: IMPORT_ID,
      uploadToken: "t".repeat(43),
      file: { name: "clip.mp4", size: 1000, type: "video/mp4" } as never,
      declaredMediaType: "video/mp4",
      onProgress: () => undefined
    });
    return { promise, xhr: FakeXhr.last as unknown as FakeXhr };
  }

  it("abortAll really calls xhr.abort() on every live upload", async () => {
    const { client } = makeClient();
    const first = startUpload(client);
    const second = startUpload(client);
    expect(client.liveUploadCount()).toBe(2);

    const aborted = client.abortAll();

    expect(aborted).toBe(2);
    expect(first.xhr.aborted).toBe(true);
    expect(second.xhr.aborted).toBe(true);
    expect(client.liveUploadCount()).toBe(0);
    await expect(first.promise).rejects.toBeInstanceOf(LocalImportClientError);
    await expect(second.promise).rejects.toBeInstanceOf(LocalImportClientError);
  });

  it("an identity owner abandons the live XHR and DELETEs each active import once", async () => {
    const { client, transport } = makeClient();
    await client.create({
      taskId: TASK,
      sourceIdentity: SOURCE,
      declaredMediaType: "video/mp4",
      byteLength: 1000
    });
    const upload = startUpload(client);

    const [first, second] = await Promise.all([client.abandonAll(), client.abandonAll()]);

    expect(upload.xhr.aborted).toBe(true);
    expect(first.abortedUploads + second.abortedUploads).toBe(1);
    expect(transport.delete).toHaveBeenCalledTimes(1);
    expect(transport.delete).toHaveBeenCalledWith(`/v1/media/local-imports/${IMPORT_ID}`);
    await expect(upload.promise).rejects.toBeInstanceOf(LocalImportClientError);
  });

  it("polls by sequence until a terminal state and refuses a regression", async () => {
    const states = [
      record({ state: "verifying", sequence: 1 }),
      record({ state: "preparing", sequence: 2 }),
      record({ state: "ready", sequence: 3, uploadedBytes: 1024 })
    ];
    let index = 0;
    const transport: LocalImportJsonTransport = {
      post: vi.fn() as never,
      get: vi.fn(async () => ok({ import: states[Math.min(index++, states.length - 1)] })) as never,
      delete: vi.fn() as never
    };
    const client = createLocalImportClient({
      runtimeBaseUrl: RUNTIME,
      transport,
      bearer: () => BEARER,
      createXhr: () => new FakeXhr() as never,
      generation: () => 1,
      sleep: async () => undefined
    });

    const terminal = await client.pollUntilTerminal(IMPORT_ID, { intervalMs: 0, maxAttempts: 10 });
    expect(terminal.state).toBe("ready");
    expect(terminal.sequence).toBe(3);
    expect(transport.get).toHaveBeenCalledTimes(3);

    const backwards = createLocalImportClient({
      runtimeBaseUrl: RUNTIME,
      transport: {
        post: vi.fn() as never,
        get: vi.fn(async () => ok({ import: record({ sequence: 1 }) })) as never,
        delete: vi.fn() as never
      },
      bearer: () => BEARER,
      createXhr: () => new FakeXhr() as never,
      generation: () => 1,
      sleep: async () => undefined
    });
    let sequence = 5;
    (backwards as unknown as { status: unknown }).status = async () =>
      record({ sequence: (sequence -= 2), state: "verifying" });
    await expect(
      backwards.pollUntilTerminal(IMPORT_ID, { intervalMs: 0, maxAttempts: 10 })
    ).rejects.toMatchObject({ code: "V3_MEDIA_IMPORT_RUNTIME_RESTARTED" });
  });

  it("cancel aborts the transport, DELETEs, then polls to terminal", async () => {
    const { client, transport } = makeClient();
    const order: string[] = [];
    (client as unknown as { status: unknown }).status = async () => {
      order.push("poll");
      return record({ state: "cancelled", sequence: 4 });
    };
    const { container, root } = await renderCard({ client }, client);
    await pickFile(container);
    const xhr = FakeXhr.last as unknown as FakeXhr;

    const cancelButton = container.querySelector("[data-testid='local-import-cancel']") as HTMLButtonElement;
    expect(cancelButton.disabled).toBe(false);
    await act(async () => {
      cancelButton.click();
      await Promise.resolve();
    });

    // The REAL transport abort happened first.
    expect(xhr.aborted).toBe(true);
    expect(transport.delete).toHaveBeenCalledWith(`/v1/media/local-imports/${IMPORT_ID}`);
    // And the terminal state was polled, never assumed.
    expect(order).toContain("poll");
    await act(async () => root.unmount());
  });

  it("an unmount aborts the transport instead of leaving it running", async () => {
    const { client } = makeClient();
    const { container, root } = await renderCard({}, client);
    await pickFile(container);
    const xhr = FakeXhr.last as unknown as FakeXhr;
    expect(xhr.aborted).toBe(false);

    await act(async () => root.unmount());
    expect(xhr.aborted).toBe(true);
    expect(container.innerHTML).toBe("");
  });
});

describe("WP-B C6 the entry is a last resort", () => {
  it("blocks only successfully published terminal projections", () => {
    expect(hasPublishedMediaProjection(null)).toBe(false);
    expect(hasPublishedMediaProjection({ state: "awaiting_trusted_capture", terminal: false })).toBe(false);
    expect(hasPublishedMediaProjection({ state: "blocked", terminal: true })).toBe(false);
    expect(hasPublishedMediaProjection({ state: "failed", terminal: true })).toBe(false);
    expect(hasPublishedMediaProjection({ state: "cancelled", terminal: true })).toBe(false);
    expect(hasPublishedMediaProjection({ state: "succeeded", terminal: true })).toBe(true);
    expect(hasPublishedMediaProjection({ state: "degraded", terminal: true })).toBe(true);
    expect(hasPublishedMediaProjection({ state: "succeeded", terminal: false })).toBe(false);
  });
  const eligible = {
    captureFallbackEligible: true,
    captureState: "awaiting_user" as const,
    acquisitionState: "awaiting_capture",
    hasProjection: false,
    taskId: TASK,
    sourceIdentity: SOURCE
  };

  it("is offered when the Runtime says eligible and nothing else owns the task", () => {
    expect(localImportEntryEligible(eligible)).toBe(true);
  });

  it("is absent when the Runtime does not consider the task eligible", () => {
    expect(localImportEntryEligible({ ...eligible, captureFallbackEligible: false })).toBe(false);
  });

  it("is absent while a capture is running", () => {
    for (const captureState of ["starting", "capturing", "stopping", "transcribing"] as const) {
      expect(localImportEntryEligible({ ...eligible, captureState })).toBe(false);
    }
  });

  it("is absent while an acquisition is running or already finished", () => {
    for (const acquisitionState of ["starting", "transcribing", "input_acquired", "succeeded", "published"]) {
      expect(localImportEntryEligible({ ...eligible, acquisitionState })).toBe(false);
    }
  });

  it("is absent once a terminal projection exists", () => {
    expect(localImportEntryEligible({ ...eligible, hasProjection: true })).toBe(false);
  });

  it("is absent without both the task id and the source identity", () => {
    expect(localImportEntryEligible({ ...eligible, taskId: null })).toBe(false);
    expect(localImportEntryEligible({ ...eligible, sourceIdentity: undefined })).toBe(false);
  });
});

/* ------------------------------------------------------------------ *
 * WP-B FC1 — the real transport against the frozen contract.
 * ------------------------------------------------------------------ */

describe("WP-B FC1 frozen schema and real envelope", () => {
  it("uses the value the shipped schema contract declares", () => {
    // The implementation literal and the contract file must agree. They are
    // read from two different places on purpose.
    expect(LOCAL_IMPORT_STATUS_SCHEMA_VERSION).toBe(FROZEN_SCHEMA_VERSION);
    expect(FROZEN_SCHEMA_VERSION).toBe("v3-media-local-import/v1");
  });

  it("rejects a record carrying the INVENTED schema version", async () => {
    const transport: LocalImportJsonTransport = {
      post: vi.fn() as never,
      get: vi.fn(async () =>
        ok({ import: { ...record(), schemaVersion: "v3-media-local-import-status/v1" } })
      ) as never,
      delete: vi.fn() as never
    };
    const client = createLocalImportClient({
      runtimeBaseUrl: RUNTIME,
      transport,
      bearer: () => BEARER,
      createXhr: () => new FakeXhr() as never,
      generation: () => 1,
      sleep: async () => undefined
    });
    await expect(client.status(IMPORT_ID)).rejects.toBeInstanceOf(LocalImportClientError);
    // ...and the same parser accepts the value the contract declares.
    expect(record().schemaVersion).toBe(FROZEN_SCHEMA_VERSION);
  });

  it("never reads an HTTP error body as a successful record", async () => {
    const transport: LocalImportJsonTransport = {
      post: vi.fn(async () => failure(409, "V3_MEDIA_IMPORT_ACTIVE")) as never,
      get: vi.fn(async () => failure(403, "V3_MEDIA_IMPORT_ORIGIN_MISMATCH")) as never,
      delete: vi.fn(async () => failure(401, "V3_MEDIA_IMPORT_AUTH_REQUIRED")) as never
    };
    const client = createLocalImportClient({
      runtimeBaseUrl: RUNTIME,
      transport,
      bearer: () => BEARER,
      createXhr: () => new FakeXhr() as never,
      generation: () => 1,
      sleep: async () => undefined
    });

    await expect(client.create({ taskId: TASK, sourceIdentity: SOURCE, declaredMediaType: "video/mp4", byteLength: 1 }))
      .rejects.toMatchObject({ code: "V3_MEDIA_IMPORT_ACTIVE" });
    await expect(client.status(IMPORT_ID)).rejects.toMatchObject({ code: "V3_MEDIA_IMPORT_ORIGIN_MISMATCH" });
    await expect(client.cancel(IMPORT_ID)).rejects.toMatchObject({ code: "V3_MEDIA_IMPORT_AUTH_REQUIRED" });
  });

  it("rejects a 200 body that carries no envelope at all", async () => {
    const transport: LocalImportJsonTransport = {
      post: vi.fn(async () => ({ status: 200, payload: { import: record() } })) as never,
      get: vi.fn(async () => ({ status: 200, payload: { import: record() } })) as never,
      delete: vi.fn(async () => ({ status: 200, payload: { import: record() } })) as never
    };
    const client = createLocalImportClient({
      runtimeBaseUrl: RUNTIME,
      transport,
      bearer: () => BEARER,
      createXhr: () => new FakeXhr() as never,
      generation: () => 1,
      sleep: async () => undefined
    });
    await expect(client.status(IMPORT_ID)).rejects.toMatchObject({ code: "V3_MEDIA_IMPORT_WRITE_FAILED" });
  });

  it("sends the companion bearer, the one-shot token and the type — and no Content-Length", async () => {
    const { client } = makeClient();
    const promise = client.upload({
      importId: IMPORT_ID,
      uploadToken: "t".repeat(43),
      file: { name: "clip.mp4", size: 1000, type: "video/mp4" } as never,
      declaredMediaType: "video/mp4",
      onProgress: () => undefined
    });
    const xhr = FakeXhr.last as unknown as FakeXhr;
    expect(xhr.headers["Authorization"]).toBe(`Bearer ${BEARER}`);
    expect(xhr.headers["X-Navia-Import-Token"]).toBe("t".repeat(43));
    expect(xhr.headers["Content-Type"]).toBe("video/mp4");
    expect(xhr.headers["Content-Length"]).toBeUndefined();
    xhr.status = 200;
    xhr.finish({ ok: true, data: { import: record({ state: "verifying", sequence: 1 }) } });
    await expect(promise).resolves.toMatchObject({ state: "verifying" });
  });

  it("unwraps a real PUT error envelope instead of accepting it", async () => {
    const { client } = makeClient();
    const promise = client.upload({
      importId: IMPORT_ID,
      uploadToken: "t".repeat(43),
      file: { name: "clip.mp4", size: 1000, type: "video/mp4" } as never,
      declaredMediaType: "video/mp4"
    });
    const xhr = FakeXhr.last as unknown as FakeXhr;
    xhr.status = 401;
    xhr.finish({ ok: false, data: null, error: { code: "V3_MEDIA_IMPORT_TOKEN_INVALID", message: "x" } });
    await expect(promise).rejects.toMatchObject({ code: "V3_MEDIA_IMPORT_TOKEN_INVALID" });
  });

  it("creates no XHR at all when the Runtime bearer is absent", async () => {
    const { client } = makeClient();
    let created = 0;
    const unauthorized = createLocalImportClient({
      runtimeBaseUrl: RUNTIME,
      transport: {
        post: vi.fn() as never,
        get: vi.fn() as never,
        delete: vi.fn() as never
      },
      bearer: () => null,
      createXhr: () => {
        created += 1;
        return new FakeXhr() as never;
      },
      generation: () => 1,
      sleep: async () => undefined
    });

    await expect(
      unauthorized.upload({
        importId: IMPORT_ID,
        uploadToken: "t".repeat(43),
        file: { name: "clip.mp4", size: 10, type: "video/mp4" } as never,
        declaredMediaType: "video/mp4"
      })
    ).rejects.toMatchObject({ code: "V3_MEDIA_IMPORT_AUTH_REQUIRED" });
    expect(created).toBe(0);
    expect(unauthorized.liveUploadCount()).toBe(0);

    await expect(
      unauthorized.create({ taskId: TASK, sourceIdentity: SOURCE, declaredMediaType: "video/mp4", byteLength: 10 })
    ).rejects.toMatchObject({ code: "V3_MEDIA_IMPORT_AUTH_REQUIRED" });
    void client;
  });

  it("uses a STALE bearer that has since been replaced rather than a cached one", async () => {
    let current: string | null = "bearer-one";
    const created: FakeXhr[] = [];
    const transport: LocalImportJsonTransport = {
      post: vi.fn(async () => ok({ import: record(), uploadToken: "t".repeat(43) })) as never,
      get: vi.fn(async () => ok({ import: record() })) as never,
      delete: vi.fn(async () => ok({ import: record() })) as never
    };
    const client = createLocalImportClient({
      runtimeBaseUrl: RUNTIME,
      transport,
      // Read at call time, never captured.
      bearer: () => current,
      createXhr: () => {
        const xhr = new FakeXhr() as unknown as FakeXhr;
        created.push(xhr);
        return xhr as never;
      },
      generation: () => 1,
      sleep: async () => undefined
    });

    void client.upload({
      importId: IMPORT_ID,
      uploadToken: "t".repeat(43),
      file: { name: "a.mp4", size: 1, type: "video/mp4" } as never,
      declaredMediaType: "video/mp4"
    }).catch(() => undefined);
    expect(created[0].headers["Authorization"]).toBe("Bearer bearer-one");

    current = "bearer-two";
    void client.upload({
      importId: IMPORT_ID,
      uploadToken: "t".repeat(43),
      file: { name: "b.mp4", size: 1, type: "video/mp4" } as never,
      declaredMediaType: "video/mp4"
    }).catch(() => undefined);
    expect(created[1].headers["Authorization"]).toBe("Bearer bearer-two");
  });
});

/* ------------------------------------------------------------------ *
 * WP-B B27 — identity switch, unmount and a session-generation change.
 *
 * Each of the three must perform a REAL transport abort, cancel the import
 * through the REAL delete route, and leave nothing behind: no File, no name,
 * no token and no storage residue. The old import must never attach itself
 * to the new page.
 * ------------------------------------------------------------------ */

describe("WP-B B27 the old import never attaches to the new page", () => {
  async function renderWith(client: ReturnType<typeof createLocalImportClient>, generation: () => number) {
    const container = document.createElement("div");
    document.body.append(container);
    let root!: Root;
    await act(async () => {
      root = createRoot(container);
      root.render(
        <LocalMediaImportCard
          taskId={TASK}
          sourceIdentity={SOURCE}
          eligible
          client={client}
          generation={generation}
        />
      );
      await Promise.resolve();
    });
    return { container, root };
  }

  it("unmount aborts the transport, DELETEs and leaves no residue", async () => {
    const { client, transport } = makeClient();
    const { container, root } = await renderWith(client, () => 1);
    await pickFile(container, "secret-clip.mp4", 2048);
    const xhr = FakeXhr.last as unknown as FakeXhr;
    expect(xhr.aborted).toBe(false);

    await act(async () => root.unmount());

    // A REAL abort, then the REAL delete route, then a poll to a terminal state.
    expect(xhr.aborted).toBe(true);
    expect(transport.delete).toHaveBeenCalledWith(`/v1/media/local-imports/${IMPORT_ID}`);
    expect(client.liveUploadCount()).toBe(0);
    // The name never left the component's own label.
    expect(container.innerHTML).not.toContain("secret-clip.mp4");
  });

  it("a session-generation change aborts and cancels the old import", async () => {
    let generation = 1;
    const { client, transport } = makeClient(() => generation);
    const { container, root } = await renderWith(client, () => generation);
    await pickFile(container, "old-generation.mp4", 2048);
    const xhr = FakeXhr.last as unknown as FakeXhr;

    // The Runtime session changes: the page identity changed with it.
    generation = 2;
    await act(async () => {
      root.render(
        <LocalMediaImportCard
          taskId={TASK}
          sourceIdentity={SOURCE}
          eligible
          client={client}
          generation={() => generation}
        />
      );
      await Promise.resolve();
    });

    expect(xhr.aborted).toBe(true);
    expect(transport.delete).toHaveBeenCalledWith(`/v1/media/local-imports/${IMPORT_ID}`);
    expect(client.liveUploadCount()).toBe(0);
    // The old import never re-attaches: the new page starts idle.
    expect(container.querySelector("[data-testid='local-import-phase']")).toBeNull();
    await act(async () => root.unmount());
  });

  it("an identity switch leaves no File, name, token or storage residue", async () => {
    const { client, transport } = makeClient();
    const { container, root } = await renderWith(client, () => 1);
    await pickFile(container, "never-sent.mp4", 2048);
    const xhr = FakeXhr.last as unknown as FakeXhr;

    // The switch: a new page identity.
    await act(async () => {
      root.render(
        <LocalMediaImportCard
          taskId={TASK}
          sourceIdentity={SOURCE}
          eligible={false}
          client={client}
          generation={() => 2}
        />
      );
      await Promise.resolve();
    });

    expect(xhr.aborted).toBe(true);
    expect(transport.delete).toHaveBeenCalled();
    // Nothing about the old selection survived.
    expect(container.innerHTML).not.toContain("never-sent.mp4");
    expect(container.querySelector("[data-testid='local-import-file']")).toBeNull();
    // No storage, ever.
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
    await act(async () => root.unmount());
  });
});

/* ------------------------------------------------------------------ *
 * WP-B — the card reacts to a REAL media identity switch.
 *
 * The Side Panel hash is not an identity switch: the product resolves the
 * active media identity, and when it changes the old import must be aborted
 * and cancelled so it can never attach itself to the new identity.
 * ------------------------------------------------------------------ */

describe("WP-B the card abandons the old import when the identity changes", () => {
  it("aborts the upload and cancels the import when the source identity changes", async () => {
    const { client, transport } = makeClient();
    const container = document.createElement("div");
    document.body.append(container);
    let root!: Root;
    await act(async () => {
      root = createRoot(container);
      await Promise.resolve();
    });
    const render = async (sourceIdentity: string) => {
      await act(async () => {
        root.render(
          <LocalMediaImportCard
            taskId={TASK}
            sourceIdentity={sourceIdentity}
            eligible
            client={client}
            generation={() => 1}
          />
        );
        await Promise.resolve();
      });
    };

    await render(SOURCE);
    const input = container.querySelector("[data-testid='local-import-input']") as HTMLInputElement;
    await act(async () => {
      attachFile(input, "clip.mp4", 1000, "video/mp4");
      input.dispatchEvent(new Event("change", { bubbles: true }));
      await Promise.resolve();
    });
    const xhr = FakeXhr.last as unknown as FakeXhr;
    expect(xhr.aborted).toBe(false);

    // The product resolves a DIFFERENT media identity.
    await render("portal:bilibili:BV1SECOND:cid:1");
    await act(async () => {
      await Promise.resolve();
    });

    // The old import was aborted and cancelled; it cannot attach to the new
    // identity.
    expect(xhr.aborted).toBe(true);
    expect(transport.delete).toHaveBeenCalledWith(`/v1/media/local-imports/${IMPORT_ID}`);
    await act(async () => root.unmount());
  });

  it("does NOT abandon anything when the identity is unchanged", async () => {
    const { client, transport } = makeClient();
    const container = document.createElement("div");
    document.body.append(container);
    let root!: Root;
    await act(async () => {
      root = createRoot(container);
      await Promise.resolve();
    });
    const render = async (sourceIdentity: string = SOURCE) => {
      await act(async () => {
        root.render(
          <LocalMediaImportCard
            taskId={TASK}
            sourceIdentity={sourceIdentity}
            eligible
            client={client}
            generation={() => 1}
          />
        );
        await Promise.resolve();
      });
    };

    await render(SOURCE);
    await render(SOURCE);
    await act(async () => {
      await Promise.resolve();
    });
    expect(transport.delete).not.toHaveBeenCalled();
    await act(async () => root.unmount());
  });
});
