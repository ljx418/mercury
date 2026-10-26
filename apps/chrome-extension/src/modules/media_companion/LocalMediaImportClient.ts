/**
 * WP-B strict Extension client for the local-import API.
 *
 * Two shapes, deliberately different:
 *
 * * create/status/cancel are strict JSON calls that only ever send the frozen
 *   four-field create body, always to the absolute Runtime base URL and always
 *   with the companion bearer;
 * * the CONTENT upload uses `XMLHttpRequest` inside the extension document,
 *   because `upload.progress` is the only honest source of byte progress.
 *
 * Nothing here accepts a URL, a path or a hash from a page. Live XHRs are
 * tracked so an unmount, a page-identity change or an explicit cancel can call
 * `xhr.abort()` for real — a generation bump alone only hides progress, it does
 * not stop the transfer.
 */

/**
 * The frozen PUBLIC schema version.
 *
 * This literal is the ONLY place the value is written in the Extension. The
 * tests do NOT restate it: they read it out of the shipped schema contract
 * file, so a typo here cannot make the implementation and its own tests agree
 * on the same wrong value.
 */
import { localImportDiagnostics } from "./localImportDiagnostics";

export const LOCAL_IMPORT_STATUS_SCHEMA_VERSION = "v3-media-local-import/v1" as const;

export type LocalImportState =
  | "awaiting_upload"
  | "uploading"
  | "verifying"
  | "preparing"
  | "ready"
  | "cancelling"
  | "cancelled"
  | "failed";

export type LocalImportFailureCode =
  | "V3_MEDIA_IMPORT_REQUEST_INVALID"
  | "V3_MEDIA_IMPORT_AUTH_REQUIRED"
  | "V3_MEDIA_IMPORT_ORIGIN_MISMATCH"
  | "V3_MEDIA_IMPORT_NOT_FOUND"
  | "V3_MEDIA_IMPORT_TASK_NOT_ELIGIBLE"
  | "V3_MEDIA_IMPORT_ACTIVE"
  | "V3_MEDIA_IMPORT_TOKEN_INVALID"
  | "V3_MEDIA_IMPORT_SIZE_MISMATCH"
  | "V3_MEDIA_IMPORT_SIZE_LIMIT"
  | "V3_MEDIA_IMPORT_TYPE_UNSUPPORTED"
  | "V3_MEDIA_IMPORT_MEDIA_INVALID"
  | "V3_MEDIA_IMPORT_DURATION_LIMIT"
  | "V3_MEDIA_IMPORT_DISK_SPACE_LOW"
  | "V3_MEDIA_IMPORT_WRITE_FAILED"
  | "V3_MEDIA_IMPORT_PREPARE_FAILED"
  | "V3_MEDIA_IMPORT_RUNTIME_RESTARTED"
  | "V3_MEDIA_IMPORT_CANCELLED"
  | "V3_MEDIA_IMPORT_CLEANUP_INCOMPLETE";

/** The frozen public media projection, or null until preparation is durable. */
export type LocalImportMedia = {
  sha256: string;
  durationMs: number;
  widthPx: number;
  heightPx: number;
  container: string;
  route: string;
};

export type LocalImportRecord = {
  schemaVersion: string;
  importId: string;
  taskId: string;
  state: LocalImportState;
  sequence: number;
  byteLength: number;
  uploadedBytes: number;
  createdAt: string;
  updatedAt: string;
  failureCode: LocalImportFailureCode | null;
  recoverable: boolean;
  media: LocalImportMedia | null;
};

export type LocalImportError = {
  code: LocalImportFailureCode | string;
  message: string;
  /** Optional: the constructor defaults it to `true`. */
  recoverable?: boolean;
};

export class LocalImportClientError extends Error {
  readonly code: string;
  readonly recoverable: boolean;

  constructor(payload: LocalImportError) {
    super(payload.message);
    this.name = "LocalImportClientError";
    this.code = payload.code;
    this.recoverable = payload.recoverable ?? true;
  }
}

/** The frozen import id. Anything else is not one of ours. */
const IMPORT_ID_PATTERN = /^media_import_[a-f0-9]{32}$/;
const CREATE_KEYS = ["taskId", "sourceIdentity", "declaredMediaType", "byteLength"] as const;
const TERMINAL_STATES = new Set(["ready", "failed", "cancelled"]);

/** The Runtime's real response envelope: `{ok, data, error, requestId}`. */
export type RuntimeEnvelope<T> = {
  ok?: boolean;
  data?: T | null;
  error?: { code?: string; message?: string; recoverable?: boolean } | null;
  requestId?: string | null;
};

/**
 * Unwrap the real envelope, including NON-2xx responses.
 *
 * An HTTP error body is an ERROR envelope. Treating it as a record is exactly
 * how a refused upload silently becomes a "successful" import.
 */
function unwrap<T>(status: number, payload: unknown, what: string): T {
  const envelope = (payload ?? {}) as RuntimeEnvelope<T>;
  if (typeof envelope.ok === "boolean" && envelope.ok === false) {
    throw new LocalImportClientError({
      code: envelope.error?.code ?? "V3_MEDIA_IMPORT_WRITE_FAILED",
      message: envelope.error?.message ?? `${what}失败。`,
      recoverable: envelope.error?.recoverable ?? true
    });
  }
  if (status < 200 || status >= 300) {
    throw new LocalImportClientError({
      code: envelope.error?.code ?? "V3_MEDIA_IMPORT_WRITE_FAILED",
      message: envelope.error?.message ?? `${what}失败。`,
      recoverable: envelope.error?.recoverable ?? true
    });
  }
  if (envelope.ok !== true || envelope.data == null) {
    throw new LocalImportClientError({
      code: "V3_MEDIA_IMPORT_WRITE_FAILED",
      message: `${what}响应不可读。`
    });
  }
  return envelope.data;
}

function assertRecord(value: unknown): LocalImportRecord {
  if (!value || typeof value !== "object") {
    throw new LocalImportClientError({ code: "V3_MEDIA_IMPORT_NOT_FOUND", message: "本地导入状态不可读。" });
  }
  const record = value as Partial<LocalImportRecord>;
  if (typeof record.importId !== "string" || !IMPORT_ID_PATTERN.test(record.importId)) {
    throw new LocalImportClientError({ code: "V3_MEDIA_IMPORT_NOT_FOUND", message: "本地导入标识不合法。" });
  }
  if (record.schemaVersion !== LOCAL_IMPORT_STATUS_SCHEMA_VERSION) {
    throw new LocalImportClientError({ code: "V3_MEDIA_IMPORT_NOT_FOUND", message: "本地导入状态版本不合法。" });
  }
  if (typeof record.byteLength !== "number" || record.byteLength < 0) {
    throw new LocalImportClientError({ code: "V3_MEDIA_IMPORT_NOT_FOUND", message: "本地导入长度不合法。" });
  }
  if (typeof record.uploadedBytes !== "number" || record.uploadedBytes < 0) {
    throw new LocalImportClientError({ code: "V3_MEDIA_IMPORT_NOT_FOUND", message: "本地导入进度不合法。" });
  }
  if (typeof record.sequence !== "number" || record.sequence < 0) {
    throw new LocalImportClientError({ code: "V3_MEDIA_IMPORT_NOT_FOUND", message: "本地导入序列不合法。" });
  }
  if (typeof record.recoverable !== "boolean") {
    throw new LocalImportClientError({ code: "V3_MEDIA_IMPORT_NOT_FOUND", message: "本地导入恢复标记不合法。" });
  }
  return record as LocalImportRecord;
}

/**
 * The JSON transport returns the RAW envelope plus the HTTP status, so the
 * client itself decides success. A transport that already unwrapped the
 * envelope would hide a non-2xx body behind a value the client never sees.
 */
export type RawResponse = { status: number; payload: unknown };

export type LocalImportJsonTransport = {
  post(path: string, body: unknown): Promise<RawResponse>;
  get(path: string): Promise<RawResponse>;
  delete(path: string): Promise<RawResponse>;
};

export type LocalImportProgress = {
  uploadedBytes: number;
  byteLength: number;
};

export type XhrFactory = () => XMLHttpRequest;

export type LocalImportClientOptions = {
  /** The absolute Runtime base URL, e.g. `http://127.0.0.1:8787`. */
  runtimeBaseUrl: string;
  transport: LocalImportJsonTransport;
  /**
   * The companion bearer. It is read at call time and is never stored, logged
   * or attached to anything but these four routes.
   */
  bearer: () => string | null;
  createXhr?: XhrFactory;
  /** Bumped by the caller whenever the page identity changes. */
  generation: () => number;
  /** Injected in tests; defaults to `setTimeout`. */
  sleep?: (ms: number) => Promise<void>;
  onImportCreated?: (record: LocalImportRecord, sourceIdentity: string) => Promise<void>;
  onImportTerminal?: (record: LocalImportRecord) => Promise<void> | void;
};

export function createLocalImportClient(options: LocalImportClientOptions) {
  // The passive diagnostics recorder. In a production build it is inert; in the
  // E2E build it only OBSERVES what this client already does.
  const diagnostics = localImportDiagnostics;
  const makeXhr = options.createXhr ?? (() => new XMLHttpRequest());
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const base = options.runtimeBaseUrl.replace(/\/+$/, "");
  let uploadGeneration = 0;
  // Every in-flight upload, so abort() is a REAL transport abort.
  const live = new Set<XMLHttpRequest>();
  // Imports created by this page but not yet observed terminal. The parent
  // keeps this client alive across card unmounts, so a real tab identity
  // boundary can still cancel the Runtime object after aborting the XHR.
  const activeImports = new Set<string>();
  const cancellationByImport = new Map<string, Promise<LocalImportRecord>>();

  /** Abort every in-flight upload: identity change, unmount or cancel. */
  function abortAll(): number {
    uploadGeneration += 1;
    const count = live.size;
    for (const xhr of Array.from(live)) {
      try {
        xhr.abort();
      } catch {
        // An already-finished transfer has nothing to abort.
      }
    }
    live.clear();
    return count;
  }

  function liveUploadCount(): number {
    return live.size;
  }

  async function cancelOnce(importId: string): Promise<LocalImportRecord> {
    const existing = cancellationByImport.get(importId);
    if (existing) return existing;
    const pending = (async () => {
      const response = await options.transport.delete(`/v1/media/local-imports/${importId}`);
      const record = assertRecord(
        unwrap<{ import: LocalImportRecord }>(response.status, response.payload, "取消本地导入").import
      );
      diagnostics.recordStatus({ state: record.state, sequence: record.sequence });
      if (TERMINAL_STATES.has(record.state)) activeImports.delete(importId);
      return record;
    })();
    cancellationByImport.set(importId, pending);
    return pending;
  }

  /**
   * The companion bearer and the one-shot upload token are the ONLY credentials
   * a PUT may carry. `Content-Length` is browser-controlled and is never set by
   * hand; neither credential is ever persisted or logged.
   */
  function uploadHeaders(
    bearer: string,
    uploadToken: string,
    declaredMediaType: string
  ): Record<string, string> {
    return {
      Authorization: `Bearer ${bearer}`,
      "X-Navia-Import-Token": uploadToken,
      "Content-Type": declaredMediaType
    };
  }

  return {
    abortAll,
    liveUploadCount,

    /**
     * Abandon every import owned by this page identity. XHR abort is
     * synchronous and always precedes the deduplicated Runtime DELETE.
     */
    async abandonAll(): Promise<{ abortedUploads: number; cancelledImports: number }> {
      const abortedUploads = abortAll();
      const imports = Array.from(activeImports);
      await Promise.allSettled(imports.map((importId) => cancelOnce(importId)));
      return { abortedUploads, cancelledImports: imports.length };
    },

    /** The absolute URL of the content route, for a manual XHR if needed. */
    contentUrl(importId: string): string {
      if (!IMPORT_ID_PATTERN.test(importId)) {
        throw new LocalImportClientError({ code: "V3_MEDIA_IMPORT_NOT_FOUND", message: "本地导入不存在。" });
      }
      return `${base}/v1/media/local-imports/${importId}/content`;
    },

    async create(input: {
      taskId: string;
      sourceIdentity: string;
      declaredMediaType: string;
      byteLength: number;
    }): Promise<{ import: LocalImportRecord; uploadToken: string }> {
      const body: Record<string, unknown> = {
        taskId: input.taskId,
        sourceIdentity: input.sourceIdentity,
        declaredMediaType: input.declaredMediaType,
        byteLength: input.byteLength
      };
      // The request may carry EXACTLY the frozen four fields.
      if (Object.keys(body).length !== CREATE_KEYS.length) {
        throw new LocalImportClientError({ code: "V3_MEDIA_IMPORT_REQUEST_INVALID", message: "请求字段不合法。" });
      }
      // The bearer is read, checked and never stored, logged or attached to
      // anything but these four routes.
      if (!options.bearer()) {
        throw new LocalImportClientError({
          code: "V3_MEDIA_IMPORT_AUTH_REQUIRED",
          message: "本地运行时未授权。"
        });
      }
      const response = await options.transport.post("/v1/media/local-imports", body);
      const created = unwrap<{ import: LocalImportRecord; uploadToken: string }>(
        response.status,
        response.payload,
        "创建本地导入"
      );
      if (typeof created.uploadToken !== "string" || created.uploadToken.length !== 43) {
        throw new LocalImportClientError({
          code: "V3_MEDIA_IMPORT_WRITE_FAILED",
          message: "上传凭据不可读。"
        });
      }
      const record = assertRecord(created.import);
      diagnostics.recordImport({
        importId: record.importId,
        taskId: record.taskId,
        sourceIdentity: input.sourceIdentity,
        sessionGeneration: options.generation()
      });
      activeImports.add(record.importId);
      try {
        await options.onImportCreated?.(record, input.sourceIdentity);
      } catch (error) {
        await cancelOnce(record.importId).catch(() => undefined);
        throw error;
      }
      return { import: record, uploadToken: created.uploadToken };
    },

    async status(importId: string): Promise<LocalImportRecord> {
      if (!IMPORT_ID_PATTERN.test(importId)) {
        throw new LocalImportClientError({ code: "V3_MEDIA_IMPORT_NOT_FOUND", message: "本地导入不存在。" });
      }
      const response = await options.transport.get(`/v1/media/local-imports/${importId}`);
      const record = assertRecord(unwrap<{ import: LocalImportRecord }>(response.status, response.payload, "读取本地导入状态").import);
      diagnostics.recordStatus({ state: record.state, sequence: record.sequence });
      if (TERMINAL_STATES.has(record.state)) {
        activeImports.delete(importId);
        await options.onImportTerminal?.(record);
      }
      return record;
    },

    async cancel(importId: string): Promise<LocalImportRecord> {
      if (!IMPORT_ID_PATTERN.test(importId)) {
        throw new LocalImportClientError({ code: "V3_MEDIA_IMPORT_NOT_FOUND", message: "本地导入不存在。" });
      }
      return cancelOnce(importId);
    },

    /**
     * Poll by SEQUENCE until a terminal state. A response that goes backwards,
     * or repeats a non-terminal state forever, is never treated as progress.
     */
    async pollUntilTerminal(
      importId: string,
      options2: { intervalMs?: number; maxAttempts?: number } = {}
    ): Promise<LocalImportRecord> {
      const interval = options2.intervalMs ?? 400;
      const maxAttempts = options2.maxAttempts ?? 600;
      let lastSequence = -1;
      let record: LocalImportRecord | null = null;
      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        record = await this.status(importId);
        if (TERMINAL_STATES.has(record.state)) return record;
        if (record.sequence < lastSequence) {
          throw new LocalImportClientError({
            code: "V3_MEDIA_IMPORT_RUNTIME_RESTARTED",
            message: "本地导入状态回退。"
          });
        }
        lastSequence = record.sequence;
        await sleep(interval);
      }
      throw new LocalImportClientError({
        code: "V3_MEDIA_IMPORT_RUNTIME_RESTARTED",
        message: "本地导入状态未收敛。"
      });
    },

    /**
     * Upload the raw bytes through XHR so `upload.progress` is the truth.
     * The `File` is never persisted and its name is never read here.
     */
    upload(input: {
      importId: string;
      uploadToken: string;
      file: File;
      declaredMediaType: string;
      onProgress?: (progress: LocalImportProgress) => void;
    }): Promise<LocalImportRecord> {
      if (!IMPORT_ID_PATTERN.test(input.importId)) {
        return Promise.reject(
          new LocalImportClientError({ code: "V3_MEDIA_IMPORT_NOT_FOUND", message: "本地导入不存在。" })
        );
      }
      const generation = options.generation();
      // Read the CURRENT bearer BEFORE any XHR exists. A missing or stale
      // Runtime session must create no transport at all, so the Runtime never
      // allocates a writer for an unauthenticated caller.
      const bearer = options.bearer();
      if (!bearer) {
        return Promise.reject(
          new LocalImportClientError({ code: "V3_MEDIA_IMPORT_AUTH_REQUIRED", message: "本地运行时未授权。" })
        );
      }
      return new Promise<LocalImportRecord>((resolve, reject) => {
        const xhr = makeXhr();
        live.add(xhr);
        diagnostics.recordUploadStarted();
        const settle = (action: () => void) => {
          live.delete(xhr);
          action();
        };
        xhr.open("PUT", `${base}/v1/media/local-imports/${input.importId}/content`);
        // Content-Length is browser-controlled; only the declared headers go out.
        for (const [name, value] of Object.entries(uploadHeaders(bearer, input.uploadToken, input.declaredMediaType))) {
          xhr.setRequestHeader(name, value);
        }
        xhr.upload.onprogress = (event) => {
          // A stale generation must never paint progress onto a new page.
          if (options.generation() !== generation) return;
          const totalBytes = event.lengthComputable ? event.total : null;
          diagnostics.recordUploadProgress(event.loaded, totalBytes);
          input.onProgress?.({
            uploadedBytes: event.loaded,
            byteLength: event.lengthComputable ? event.total : input.file.size
          });
        };
        xhr.onload = () => {
          diagnostics.recordUploadFinished("loaded", input.file.size);
          if (options.generation() !== generation) {
            settle(() =>
              reject(new LocalImportClientError({ code: "V3_MEDIA_IMPORT_CANCELLED", message: "页面已切换。" }))
            );
            return;
          }
          try {
            const parsed = JSON.parse(xhr.responseText) as RuntimeEnvelope<{ import: LocalImportRecord }>;
            const data = unwrap<{ import: LocalImportRecord }>(xhr.status, parsed, "上传本地视频");
            settle(() => resolve(assertRecord(data.import)));
          } catch (caught) {
            settle(() =>
              reject(
                caught instanceof LocalImportClientError
                  ? caught
                  : new LocalImportClientError({ code: "V3_MEDIA_IMPORT_WRITE_FAILED", message: "上传响应不可读。" })
              )
            );
          }
        };
        xhr.onerror = () => {
          diagnostics.recordUploadFinished("errored", null);
          settle(() =>
            reject(new LocalImportClientError({ code: "V3_MEDIA_IMPORT_WRITE_FAILED", message: "上传中断。" }))
          );
        };
        xhr.onabort = () => {
          diagnostics.recordUploadFinished("aborted", null);
          settle(() =>
            reject(new LocalImportClientError({ code: "V3_MEDIA_IMPORT_CANCELLED", message: "上传已取消。" }))
          );
        };
        xhr.send(input.file);
      });
    }
  };
}

export type LocalImportClient = ReturnType<typeof createLocalImportClient>;
