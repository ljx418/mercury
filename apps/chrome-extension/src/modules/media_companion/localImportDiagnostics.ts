/**
 * WP-B — the PASSIVE local-import diagnostics recorder.
 *
 * It is a READ-ONLY observation of facts the normal product path already
 * produced. It never creates, uploads, cancels, polls, binds, materializes or
 * cleans anything: it only remembers what the client and the card already
 * know, and it exposes a sanitized snapshot.
 *
 * The recorder is installed ONLY in the E2E build (`__NAVIA_E2E_BRIDGE__`). In
 * a production build nothing is recorded and no global is exposed.
 *
 * ## What the snapshot may never contain
 *
 * No bearer, no cookie, no upload token, no `File`, no file name, no absolute
 * path, no raw media, no frame bytes and no transcript text. The recorder only
 * ever stores identifiers, counters, enums and digests.
 */

/** The shape the harness reads. Every field is sanitized by construction. */
export type LocalImportDiagnosticsSnapshot = {
  /** The local-import id, when one exists. */
  importId: string | null;
  /** The acquisition task the import belongs to. */
  taskId: string | null;
  /** The media identity the import belongs to. */
  sourceIdentity: string | null;
  /** The public import state, as the Runtime reported it. */
  state: string | null;
  /** The public import sequence, as the Runtime reported it. */
  sequence: number;
  /**
   * The identity generation. It increases whenever the active media identity
   * changes, so an observer can prove that a REAL identity switch happened
   * rather than a hash change.
   */
  identityGeneration: number;
  /** The Runtime session generation the upload was started under. */
  sessionGeneration: number;
  /**
   * The upload progress, in the shape the harness reads.
   *
   * `samples` are the REAL `upload.onprogress` samples, in order. `streaming`
   * is true while the upload is in flight. `writerSliceMaxBytes` is the
   * SERVER-observed maximum writer slice, filled from the Runtime's E2E-only
   * observation channel.
   */
  uploadProgress: {
    samples: { uploadedBytes: number; totalBytes: number | null }[];
    streaming: boolean;
    uploadedBytes: number;
    finalByteCount: number | null;
    writerSliceMaxBytes: number | null;
  };
  /** The XHR lifecycle of the real upload. */
  upload: {
    started: boolean;
    loaded: boolean;
    errored: boolean;
    aborted: boolean;
    /** The REAL `upload.onprogress` samples, in order. */
    samples: { uploadedBytes: number; totalBytes: number | null }[];
    /** The last observed uploaded byte count. */
    uploadedBytes: number;
    /** The exact final byte count the transport reported. */
    finalByteCount: number | null;
  };
  /** The server-observed maximum writer slice, when the Runtime reported it. */
  writerSliceMaxBytes: number | null;
  /** How many times the barrier claimed the cleanup. */
  cleanupCount: number | null;
  /** The owned residue counts, when the Runtime reported them. */
  residue: { source: number | null; sandbox: number | null } | null;
};

const MAX_SAMPLES = 512;

function emptySnapshot(): LocalImportDiagnosticsSnapshot {
  return {
    importId: null,
    taskId: null,
    sourceIdentity: null,
    state: null,
    sequence: 0,
    identityGeneration: 0,
    sessionGeneration: 0,
    upload: {
      started: false,
      loaded: false,
      errored: false,
      aborted: false,
      samples: [],
      uploadedBytes: 0,
      finalByteCount: null
    },
    uploadProgress: {
      samples: [],
      streaming: false,
      uploadedBytes: 0,
      finalByteCount: null,
      writerSliceMaxBytes: null
    },
    writerSliceMaxBytes: null,
    cleanupCount: null,
    residue: null
  };
}

/**
 * The recorder.
 *
 * It is a module singleton so the client, the card and the Side Panel all
 * contribute to ONE snapshot.
 */
class LocalImportDiagnostics {
  #snapshot = emptySnapshot();
  #identity: string | null = null;

  /** A new local import: a new identity, a new task, a new id. */
  recordImport(input: { importId: string; taskId: string; sourceIdentity: string; sessionGeneration: number }) {
    const identityGeneration = this.#snapshot.identityGeneration;
    this.#snapshot = emptySnapshot();
    this.#snapshot.identityGeneration = identityGeneration;
    this.#snapshot.importId = input.importId;
    this.#snapshot.taskId = input.taskId;
    this.#snapshot.sourceIdentity = input.sourceIdentity;
    this.#snapshot.sessionGeneration = input.sessionGeneration;
    this.#snapshot.state = "awaiting_upload";
    this.#snapshot.sequence = 0;
    this.#identity = input.sourceIdentity;
    this.#snapshot.identityGeneration += 1;
  }

  /** The active media identity changed. This is a REAL identity switch. */
  recordIdentityChange(sourceIdentity: string) {
    if (this.#identity === sourceIdentity) return false;
    this.#identity = sourceIdentity;
    this.#snapshot.sourceIdentity = sourceIdentity;
    this.#snapshot.identityGeneration += 1;
    return true;
  }

  recordStatus(input: { state: string; sequence: number }) {
    this.#snapshot.state = input.state;
    if (Number.isFinite(input.sequence) && input.sequence > this.#snapshot.sequence) {
      this.#snapshot.sequence = input.sequence;
    }
  }

  recordUploadStarted() {
    this.#snapshot.upload.started = true;
  }

  recordUploadProgress(uploadedBytes: number, totalBytes: number | null) {
    const upload = this.#snapshot.upload;
    if (upload.samples.length >= MAX_SAMPLES) {
      // The samples are capped, but the counters keep moving.
      upload.uploadedBytes = Math.max(upload.uploadedBytes, uploadedBytes);
      return;
    }
    upload.samples.push({ uploadedBytes, totalBytes });
    upload.uploadedBytes = Math.max(upload.uploadedBytes, uploadedBytes);
  }

  recordUploadFinished(kind: "loaded" | "errored" | "aborted", finalByteCount: number | null) {
    const upload = this.#snapshot.upload;
    if (kind === "loaded") upload.loaded = true;
    if (kind === "errored") upload.errored = true;
    if (kind === "aborted") upload.aborted = true;
    if (finalByteCount !== null) {
      upload.finalByteCount = finalByteCount;
      upload.uploadedBytes = Math.max(upload.uploadedBytes, finalByteCount);
      const last = upload.samples.at(-1);
      if (last?.uploadedBytes !== finalByteCount) {
        if (upload.samples.length >= MAX_SAMPLES) upload.samples[MAX_SAMPLES - 1] = {
          uploadedBytes: finalByteCount,
          totalBytes: finalByteCount
        };
        else upload.samples.push({ uploadedBytes: finalByteCount, totalBytes: finalByteCount });
      }
    }
  }

  recordRuntimeObservation(input: {
    writerSliceMaxBytes?: number | null;
    cleanupCount?: number | null;
    residue?: { source: number | null; sandbox: number | null } | null;
  }) {
    if (typeof input.writerSliceMaxBytes === "number") {
      this.#snapshot.writerSliceMaxBytes = input.writerSliceMaxBytes;
    }
    if (typeof input.cleanupCount === "number") {
      this.#snapshot.cleanupCount = input.cleanupCount;
    }
    if (input.residue) this.#snapshot.residue = { ...input.residue };
  }

  /** The sanitized snapshot. A copy, so a caller cannot mutate the record. */
  snapshot(): LocalImportDiagnosticsSnapshot {
    const upload = this.#snapshot.upload;
    return {
      ...this.#snapshot,
      upload: {
        ...upload,
        samples: upload.samples.map((sample) => ({ ...sample }))
      },
      uploadProgress: {
        samples: upload.samples.map((sample) => ({ ...sample })),
        streaming: upload.started && !upload.loaded && !upload.errored && !upload.aborted,
        uploadedBytes: upload.uploadedBytes,
        finalByteCount: upload.finalByteCount,
        writerSliceMaxBytes: this.#snapshot.writerSliceMaxBytes
      },
      residue: this.#snapshot.residue ? { ...this.#snapshot.residue } : null
    };
  }

  /** Drop everything. Used between cases so one case cannot see another's facts. */
  reset() {
    this.#snapshot = emptySnapshot();
    this.#identity = null;
  }
}

/**
 * The recorder.
 *
 * In a production build it is inert: every record method is a no-op and the
 * snapshot stays empty. The E2E build is the only place a real snapshot exists.
 */
export const localImportDiagnostics = new LocalImportDiagnostics();

/**
 * The E2E-only global the harness reads.
 *
 * It is installed ONLY when the compile-time E2E bridge gate is on, and it
 * exposes a READ-ONLY snapshot: there is no method on it that creates,
 * uploads, cancels, polls, binds, materializes or cleans anything.
 */
export function installLocalImportDiagnostics(globalTarget: Record<string, unknown>) {
  globalTarget.__naviaE2ELocalImportDiagnostics = {
    snapshot: () => localImportDiagnostics.snapshot()
  };
}
