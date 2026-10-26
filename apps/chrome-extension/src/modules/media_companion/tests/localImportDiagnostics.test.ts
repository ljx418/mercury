import { describe, expect, it } from "vitest";

import {
  installLocalImportDiagnostics,
  localImportDiagnostics
} from "../localImportDiagnostics";

describe("WP-B the passive local-import diagnostics", () => {
  it("starts empty and exposes nothing sensitive", () => {
    localImportDiagnostics.reset();
    const snapshot = localImportDiagnostics.snapshot();
    expect(snapshot.importId).toBeNull();
    expect(snapshot.taskId).toBeNull();
    expect(snapshot.sourceIdentity).toBeNull();
    expect(snapshot.sequence).toBe(0);
    expect(snapshot.identityGeneration).toBe(0);
    expect(snapshot.upload.samples).toEqual([]);
    expect(snapshot.uploadProgress.samples).toEqual([]);
    expect(snapshot.uploadProgress.streaming).toBe(false);
    expect(snapshot.cleanupCount).toBeNull();
    expect(snapshot.residue).toBeNull();
    // The rendered snapshot must not carry a credential, a file or a path.
    const rendered = JSON.stringify(snapshot);
    for (const forbidden of ["Bearer", "token", "cookie", "fileName", "base64"]) {
      expect(rendered).not.toContain(forbidden);
    }
  });

  it("records the import, the task and the identity exactly once", () => {
    localImportDiagnostics.reset();
    localImportDiagnostics.recordImport({
      importId: "media_import_" + "a".repeat(32),
      taskId: "media_task_" + "b".repeat(32),
      sourceIdentity: "portal:bilibili:BV1TEST:cid:1",
      sessionGeneration: 4
    });
    const snapshot = localImportDiagnostics.snapshot();
    expect(snapshot.importId).toBe("media_import_" + "a".repeat(32));
    expect(snapshot.taskId).toBe("media_task_" + "b".repeat(32));
    expect(snapshot.sourceIdentity).toBe("portal:bilibili:BV1TEST:cid:1");
    expect(snapshot.sessionGeneration).toBe(4);
    expect(snapshot.identityGeneration).toBe(1);
  });

  it("counts an identity generation ONLY when the identity really changes", () => {
    localImportDiagnostics.reset();
    localImportDiagnostics.recordIdentityChange("portal:bilibili:BV1FIRST:cid:1");
    const first = localImportDiagnostics.snapshot().identityGeneration;
    // The SAME identity is not a switch.
    expect(localImportDiagnostics.recordIdentityChange("portal:bilibili:BV1FIRST:cid:1")).toBe(false);
    expect(localImportDiagnostics.snapshot().identityGeneration).toBe(first);
    // A DIFFERENT identity is a real switch.
    expect(localImportDiagnostics.recordIdentityChange("portal:bilibili:BV1SECOND:cid:1")).toBe(true);
    expect(localImportDiagnostics.snapshot().identityGeneration).toBe(first + 1);
    expect(localImportDiagnostics.snapshot().sourceIdentity).toBe("portal:bilibili:BV1SECOND:cid:1");
  });

  it("records the real XHR lifecycle and the progress samples", () => {
    localImportDiagnostics.reset();
    localImportDiagnostics.recordUploadStarted();
    localImportDiagnostics.recordUploadProgress(64, 1024);
    localImportDiagnostics.recordUploadProgress(512, 1024);
    localImportDiagnostics.recordUploadProgress(1024, 1024);
    localImportDiagnostics.recordUploadFinished("loaded", 1024);

    const snapshot = localImportDiagnostics.snapshot();
    expect(snapshot.upload.started).toBe(true);
    expect(snapshot.upload.loaded).toBe(true);
    expect(snapshot.upload.errored).toBe(false);
    expect(snapshot.upload.aborted).toBe(false);
    expect(snapshot.upload.finalByteCount).toBe(1024);
    expect(snapshot.uploadProgress.samples.map((sample) => sample.uploadedBytes)).toEqual([64, 512, 1024]);
    expect(snapshot.uploadProgress.uploadedBytes).toBe(1024);
    expect(snapshot.uploadProgress.finalByteCount).toBe(1024);
    // A finished upload is not streaming any more.
    expect(snapshot.uploadProgress.streaming).toBe(false);
  });

  it("records an abort as an abort, and never as a load", () => {
    localImportDiagnostics.reset();
    localImportDiagnostics.recordUploadStarted();
    localImportDiagnostics.recordUploadProgress(128, 1024);
    localImportDiagnostics.recordUploadFinished("aborted", null);
    const snapshot = localImportDiagnostics.snapshot();
    expect(snapshot.upload.aborted).toBe(true);
    expect(snapshot.upload.loaded).toBe(false);
    expect(snapshot.upload.finalByteCount).toBeNull();
    expect(snapshot.uploadProgress.streaming).toBe(false);
  });

  it("records the server-observed facts the Runtime reported", () => {
    localImportDiagnostics.reset();
    localImportDiagnostics.recordRuntimeObservation({
      writerSliceMaxBytes: 1_048_576,
      cleanupCount: 1,
      residue: { source: 0, sandbox: 0 }
    });
    const snapshot = localImportDiagnostics.snapshot();
    expect(snapshot.writerSliceMaxBytes).toBe(1_048_576);
    expect(snapshot.cleanupCount).toBe(1);
    expect(snapshot.residue).toEqual({ source: 0, sandbox: 0 });
    expect(snapshot.uploadProgress.writerSliceMaxBytes).toBe(1_048_576);
  });

  it("starts every import with fresh upload and Runtime observations", () => {
    localImportDiagnostics.reset();
    localImportDiagnostics.recordRuntimeObservation({
      writerSliceMaxBytes: 1_048_576,
      cleanupCount: 1,
      residue: { source: 0, sandbox: 0 }
    });
    localImportDiagnostics.recordUploadStarted();
    localImportDiagnostics.recordUploadProgress(128, 1024);
    localImportDiagnostics.recordImport({
      importId: "media_import_" + "e".repeat(32),
      taskId: "media_task_" + "f".repeat(32),
      sourceIdentity: "portal:bilibili:BV1FRESH:cid:1",
      sessionGeneration: 2
    });
    const snapshot = localImportDiagnostics.snapshot();
    expect(snapshot.upload.started).toBe(false);
    expect(snapshot.upload.samples).toEqual([]);
    expect(snapshot.writerSliceMaxBytes).toBeNull();
    expect(snapshot.cleanupCount).toBeNull();
    expect(snapshot.residue).toBeNull();
  });

  it("keeps the exact final byte count even when progress events omit the end", () => {
    localImportDiagnostics.reset();
    localImportDiagnostics.recordUploadStarted();
    localImportDiagnostics.recordUploadProgress(512, 1024);
    localImportDiagnostics.recordUploadFinished("loaded", 1024);
    const snapshot = localImportDiagnostics.snapshot();
    expect(snapshot.uploadProgress.finalByteCount).toBe(1024);
    expect(snapshot.uploadProgress.samples.at(-1)).toEqual({ uploadedBytes: 1024, totalBytes: 1024 });
  });

  it("installs a READ-ONLY global that exposes nothing but the snapshot", () => {
    localImportDiagnostics.reset();
    const target: Record<string, unknown> = {};
    installLocalImportDiagnostics(target);
    const installed = target.__naviaE2ELocalImportDiagnostics as { snapshot: () => unknown };
    expect(typeof installed.snapshot).toBe("function");
    expect(Object.keys(installed)).toEqual(["snapshot"]);
    // The global may not create, upload, cancel, poll, bind, materialize or
    // clean anything.
    for (const forbidden of ["create", "upload", "cancel", "poll", "bind", "materialize", "clean"]) {
      expect(Object.keys(installed)).not.toContain(forbidden);
    }
  });

  it("drops everything on reset, so one case cannot see another's facts", () => {
    localImportDiagnostics.reset();
    localImportDiagnostics.recordImport({
      importId: "media_import_" + "c".repeat(32),
      taskId: "media_task_" + "d".repeat(32),
      sourceIdentity: "portal:bilibili:BV1OTHER:cid:1",
      sessionGeneration: 1
    });
    localImportDiagnostics.reset();
    const snapshot = localImportDiagnostics.snapshot();
    expect(snapshot.importId).toBeNull();
    expect(snapshot.taskId).toBeNull();
    expect(snapshot.sourceIdentity).toBeNull();
    expect(snapshot.identityGeneration).toBe(0);
  });
});
