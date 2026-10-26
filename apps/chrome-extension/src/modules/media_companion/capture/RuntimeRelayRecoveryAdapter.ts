/**
 * WP0 R1-C3-01 — `RuntimeRelayRecoveryAdapter`.
 *
 * The production recovery adapter. The previous Background wiring
 * implemented recovery by sending `navia.mediaCapture` messages to ITSELF
 * via `chrome.runtime.sendMessage`. That is not a Runtime call at all:
 *
 *   - `MediaCaptureMessageRouter.parse()` accepts only `prepare`, `arm`,
 *     a field-exact `status` and `stop`. There is no `delete` or `recover`
 *     command in the contract;
 *   - `status` rejects any extra field, so `{command:"status", taskId}`
 *     is `V3_MEDIA_CAPTURE_MESSAGE_INVALID`;
 *   - `trustedSurface()` only admits `sidepanel.html` / `workspace.html`,
 *     never the service worker;
 *   - `Boolean(response)` turned `{ok:false}` into a false success.
 *
 * This adapter instead drives the EXISTING authenticated Runtime client:
 * `bootstrapLocalRuntimeSession()` -> `cancelMediaAcquisition(taskId)` ->
 * `getMediaAcquisition(taskId)`. The Runtime client functions are injected
 * so the composition is testable without a browser or a live Runtime.
 *
 * A service worker restart loses the in-memory bearer token, so every
 * reconcile that needs the Runtime establishes a NEW process-local session.
 * The token is never persisted, never stored in the marker and never
 * restored from storage.
 */

import type { MediaAcquisitionTask } from "../../../runtimeClient";

/** The only Runtime client surface this adapter may use. */
export type RelayRuntimeClient = {
  /** `bootstrapLocalRuntimeSession()` — establishes a NEW in-memory session. */
  bootstrapSession: () => Promise<{ token?: string } | unknown>;
  /** `cancelMediaAcquisition(taskId)` — `DELETE /v1/media/acquisitions/{id}`. */
  cancelAcquisition: (taskId: string) => Promise<unknown>;
  /** `getMediaAcquisition(taskId)` — `GET /v1/media/acquisitions/{id}`. */
  getAcquisition: (taskId: string) => Promise<{ task?: MediaAcquisitionTask } | unknown>;
};

/** A Runtime error the adapter must propagate, never swallow. */
export class RelayRuntimeError extends Error {
  readonly kind: "authentication" | "api" | "transport" | "shape";
  readonly httpStatus: number | undefined;

  constructor(kind: RelayRuntimeError["kind"], message: string, httpStatus?: number) {
    super(message);
    this.name = "RelayRuntimeError";
    this.kind = kind;
    this.httpStatus = httpStatus;
  }
}

export type RelayRecoveryResult =
  | { ok: true; state: string; task?: MediaAcquisitionTask }
  | { ok: false; failure: RelayRuntimeError };

/**
 * Extract the acquisition `state` from a Runtime response, or fail closed.
 * `{ok:false}`, a missing task and a malformed body are all failures —
 * never a success.
 */
export function readAcquisitionState(payload: unknown): RelayRecoveryResult {
  if (!payload || typeof payload !== "object") {
    return { ok: false, failure: new RelayRuntimeError("shape", "runtime_response_not_object") };
  }
  const record = payload as { ok?: unknown; error?: unknown; task?: unknown };
  // A Runtime error envelope must not be read as success.
  if (record.ok === false) {
    const code = (record.error as { code?: unknown } | undefined)?.code;
    return {
      ok: false,
      failure: new RelayRuntimeError("api", typeof code === "string" ? code : "runtime_error_envelope")
    };
  }
  const task = record.task;
  if (!task || typeof task !== "object") {
    return { ok: false, failure: new RelayRuntimeError("shape", "runtime_response_missing_task") };
  }
  const state = (task as { state?: unknown }).state;
  if (typeof state !== "string" || state.length === 0) {
    return { ok: false, failure: new RelayRuntimeError("shape", "acquisition_state_missing") };
  }
  return { ok: true, state, task: task as MediaAcquisitionTask };
}

/** Classify a thrown Runtime client error without leaking its text outward. */
export function classifyRuntimeError(error: unknown): RelayRuntimeError {
  if (error instanceof RelayRuntimeError) return error;
  const kind = (error as { kind?: unknown } | null)?.kind;
  const httpStatus = (error as { httpStatus?: unknown } | null)?.httpStatus;
  if (kind === "authentication") return new RelayRuntimeError("authentication", "runtime_auth_rejected", typeof httpStatus === "number" ? httpStatus : undefined);
  if (kind === "transport") return new RelayRuntimeError("transport", "runtime_transport_failed");
  if (kind === "api") return new RelayRuntimeError("api", "runtime_api_error", typeof httpStatus === "number" ? httpStatus : undefined);
  return new RelayRuntimeError("transport", "runtime_call_failed");
}

export class RuntimeRelayRecoveryAdapter {
  readonly #client: RelayRuntimeClient;
  /** Single-flight: at most one bootstrap per reconcile pass. */
  #sessionPromise: Promise<void> | null = null;
  #bootstraps = 0;

  constructor(client: RelayRuntimeClient) {
    this.#client = client;
  }

  /** How many times a session was established (observability + tests). */
  get bootstrapCount(): number {
    return this.#bootstraps;
  }

  /**
   * Establish a NEW process-local Runtime session. Concurrent callers in
   * the same pass share one in-flight promise, so a single reconcile never
   * bootstraps twice.
   */
  async ensureSession(): Promise<void> {
    if (!this.#sessionPromise) {
      this.#bootstraps += 1;
      this.#sessionPromise = this.#client
        .bootstrapSession()
        .then(() => undefined)
        .catch((error: unknown) => {
          // A failed bootstrap must not be cached as a resolved session.
          this.#sessionPromise = null;
          throw classifyRuntimeError(error);
        });
    }
    return this.#sessionPromise;
  }

  /**
   * `connecting` phase: the Runtime had not accepted start, so the only
   * legal action is the existing authenticated DELETE, then a GET to
   * observe the terminal.
   */
  async cancelThenObserve(taskId: string): Promise<RelayRecoveryResult> {
    try {
      await this.ensureSession();
    } catch (error) {
      return { ok: false, failure: classifyRuntimeError(error) };
    }
    try {
      await this.#client.cancelAcquisition(taskId);
    } catch (error) {
      return { ok: false, failure: classifyRuntimeError(error) };
    }
    try {
      return readAcquisitionState(await this.#client.getAcquisition(taskId));
    } catch (error) {
      return { ok: false, failure: classifyRuntimeError(error) };
    }
  }

  /**
   * The four Runtime-owned phases: Runtime's own `finally` owns the
   * teardown, so the new worker only observes with a GET. PCM, ticket,
   * sequence and credit are never restored.
   */
  async observe(taskId: string): Promise<RelayRecoveryResult> {
    try {
      await this.ensureSession();
    } catch (error) {
      return { ok: false, failure: classifyRuntimeError(error) };
    }
    try {
      return readAcquisitionState(await this.#client.getAcquisition(taskId));
    } catch (error) {
      return { ok: false, failure: classifyRuntimeError(error) };
    }
  }
}
