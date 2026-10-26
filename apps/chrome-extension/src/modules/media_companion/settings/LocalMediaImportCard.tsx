import React, { useCallback, useEffect, useRef, useState } from "react";
import { localImportDiagnostics } from "../localImportDiagnostics";
import {
  createLocalImportClient,
  LocalImportClientError,
  type LocalImportClient,
  type LocalImportRecord
} from "../LocalMediaImportClient";

/**
 * WP-B explicit local media import card.
 *
 * The file name lives ONLY in this component's memory and in the hidden input's
 * DOM value. It is never placed in storage, never sent in a request and never
 * logged. Terminal state and unmount both clear it.
 *
 * The cancel / unmount / identity-change path is the frozen one: `xhr.abort()`
 * FIRST so the transport really stops, then the DELETE route, then a poll by
 * sequence until `ready | failed | cancelled`. A hidden progress bar is never
 * left behind an upload that is still running.
 */

export type LocalMediaImportCardProps = {
  taskId: string;
  sourceIdentity: string;
  /** Only an eligible BLOCKED state may offer the import entry. */
  eligible: boolean;
  blockedReason?: string;
  client: LocalImportClient;
  /** Bumped by the host when the page identity changes. */
  generation: () => number;
  onTerminal?: (record: LocalImportRecord) => void;
};

type Phase = "idle" | "uploading" | "verifying" | "preparing" | "done";

const PHASE_LABEL: Record<Phase, string> = {
  idle: "",
  uploading: "正在上传",
  verifying: "正在校验",
  preparing: "正在准备",
  done: "已完成"
};

export function LocalMediaImportCard(props: LocalMediaImportCardProps) {
  const { client, generation, eligible, onTerminal, taskId, sourceIdentity } = props;
  // The passive diagnostics recorder. It only OBSERVES what this card does.
  const diagnostics = localImportDiagnostics;
  const inputRef = useRef<HTMLInputElement>(null);
  // The file name is deliberately component-local and never leaves it.
  const [fileLabel, setFileLabel] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState<{ uploadedBytes: number; byteLength: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const importRef = useRef<string | null>(null);
  // The generation this card was mounted for. A change aborts, it never
  // re-attaches the upload to the new page.
  const [mountedGeneration, setMountedGeneration] = useState(() => generation());
  // The media identity this card was mounted for.
  const [mountedIdentity, setMountedIdentity] = useState<string | null>(null);

  const clearFile = useCallback(() => {
    setFileLabel(null);
    setProgress(null);
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  /**
   * abort -> DELETE -> poll by sequence to a terminal state.
   *
   * Only an EXPLICIT user cancel reports a terminal to the host. An identity
   * change or an unmount abandons the old import silently: the old import must
   * never attach itself to the new page, and a terminal that arrives after the
   * page moved on belongs to a page that no longer exists.
   */
  const abandon = useCallback(
    async (reason: "cancel" | "identity" | "unmount") => {
      client.abortAll();
      const importId = importRef.current;
      if (!importId) return;
      importRef.current = null;
      const reportable = reason === "cancel";
      try {
        await client.cancel(importId);
      } catch {
        // A record that is already terminal answers the DELETE the same way.
        if (reportable) setError("取消失败。");
        return;
      }
      try {
        const terminal = await client.pollUntilTerminal(importId, { intervalMs: 200, maxAttempts: 50 });
        if (!reportable) return;
        setPhase("done");
        clearFile();
        diagnostics.recordStatus({ state: terminal.state, sequence: terminal.sequence });
        onTerminal?.(terminal);
      } catch (caught) {
        if (reportable) {
          setError(caught instanceof LocalImportClientError ? caught.message : "取消未收敛。");
        }
      }
    },
    [client, clearFile, onTerminal]
  );

  useEffect(
    () => () => {
      // Unmount: a REAL transport abort, then the DELETE for the import the
      // Runtime still owns. The result is polled, never assumed.
      void abandon("unmount");
      clearFile();
    },
    [abandon, clearFile]
  );

  useEffect(() => {
    const current = generation();
    if (current === mountedGeneration) return;
    // Identity change: abort rather than attach to a new page.
    setMountedGeneration(current);
    void abandon("identity");
    clearFile();
    setPhase("idle");
    setError(null);
  }, [abandon, clearFile, generation, mountedGeneration]);

  // A REAL media identity switch: the active video changed, so the old import
  // must never attach itself to the new identity. The Side Panel hash alone is
  // not an identity switch, and this effect only reacts to the identity the
  // product actually resolved.
  useEffect(() => {
    if (mountedIdentity === sourceIdentity) return;
    const previous = mountedIdentity;
    setMountedIdentity(sourceIdentity);
    diagnostics.recordIdentityChange(sourceIdentity);
    // An identity that is still being RESOLVED is not a switch: the product
    // learns the active media identity after the panel mounts.
    if (!previous || !sourceIdentity) return;
    // Nothing is attached to the old identity, so there is nothing to abandon.
    if (!importRef.current) return;
    void abandon("identity");
    clearFile();
    setPhase("idle");
    setError(null);
  }, [abandon, clearFile, sourceIdentity]);

  async function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileLabel(file.name);
    setError(null);
    try {
      // The public record never echoes the declared type back, so the card
      // keeps the ONE value it declared rather than inventing a second.
      const declaredMediaType = file.type || "application/octet-stream";
      const created = await client.create({
        taskId,
        sourceIdentity,
        declaredMediaType,
        byteLength: file.size
      });
      importRef.current = created.import.importId;
      setPhase("uploading");
      await client.upload({
        importId: created.import.importId,
        uploadToken: created.uploadToken,
        file,
        declaredMediaType,
        onProgress: setProgress
      });
      setPhase("verifying");
      // The Runtime owns T1..T4; the card only watches its own durable state.
      const terminal = await client.pollUntilTerminal(created.import.importId);
      importRef.current = null;
      setPhase("done");
      clearFile();
      diagnostics.recordStatus({ state: terminal.state, sequence: terminal.sequence });
      onTerminal?.(terminal);
    } catch (caught) {
      // A failed XHR or poll does not transfer ownership back to the page.
      // Abort the transport and ask the Runtime to settle the import before
      // clearing the local reference, otherwise a failed upload is stranded.
      await abandon("unmount");
      setPhase("idle");
      setError(caught instanceof LocalImportClientError ? caught.message : "本地导入失败。");
      clearFile();
    }
  }

  async function onCancel() {
    await abandon("cancel");
  }

  if (!eligible) return null;

  const busy = phase === "uploading" || phase === "verifying" || phase === "preparing";
  const percent =
    progress && progress.byteLength > 0
      ? Math.min(100, Math.round((progress.uploadedBytes / progress.byteLength) * 100))
      : null;

  return (
    <section className="local-import-card" data-testid="local-media-import-card" aria-busy={busy}>
      <h3>导入本地视频</h3>
      <p className="muted" data-testid="local-import-reason">
        {props.blockedReason ?? "当前视频无法自动获取，可以选择一个本地视频文件继续。"}
      </p>

      <div className="local-import-actions">
        {/* The hidden input is triggered ONLY by the primary button. */}
        <button
          type="button"
          data-testid="local-import-pick"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          选择本地视频
        </button>
        <input
          ref={inputRef}
          hidden
          type="file"
          accept="video/mp4,video/webm,video/x-matroska"
          data-testid="local-import-input"
          onChange={(event) => void onPick(event)}
        />
        <button type="button" data-testid="local-import-cancel" disabled={!busy} onClick={() => void onCancel()}>
          取消导入
        </button>
      </div>

      {fileLabel ? (
        <p className="local-import-file" data-testid="local-import-file">
          已选择：{fileLabel}
        </p>
      ) : null}

      {phase !== "idle" ? (
        <p className="local-import-phase" data-testid="local-import-phase" data-phase={phase}>
          {PHASE_LABEL[phase]}
          {phase === "uploading" && percent !== null ? ` · ${percent}%` : ""}
        </p>
      ) : null}

      {error ? (
        <p className="local-import-error" role="alert" data-testid="local-import-error">
          {error}
        </p>
      ) : null}
    </section>
  );
}

export { createLocalImportClient };
