/**
 * WP-B VH4 — B29: the registered 100 MB asset through the Side Panel path.
 *
 * The asset itself is generated ONLY in the later approved run, by the frozen
 * registry generator, from the explicitly authorized seed. The executor never
 * generates it: it receives the generated asset from the preflight and drives
 * the REAL Side Panel file input with it.
 *
 * The receipt records the size, the allocated ratio, the digests, the real
 * progress, the product projection and the zero residue — and never the raw
 * transcript, the file name or a private path.
 */

import { HarnessError } from "../plan.mjs";
import { countRequests, eventsDigest } from "../context.mjs";

export const EXECUTOR = {
  id: "b29-real-100mb-asset",
  placeholder: false,
  requiredInputs: ["asset", "sidePanel", "fileChooser", "uploadProgress", "productProjection", "thumbnailRoute"],
  requiredReceiptFields: [
    "byteLength",
    "allocatedRatio",
    "sha256",
    "ffprobeSha256",
    "nonEmptySegments",
    "distinctFrameCount",
    "importId",
    "taskId",
    "productId",
    "progressMonotonic",
    "writerSliceMaxBytes",
    "terminalSequence",
    "cleanupCount",
    "residue"
  ],

  async run(context) {
    const { browser, runtime, preflight, record } = context;
    const asset = preflight?.asset;
    if (!asset) throw new HarnessError("B29 needs the generated registry asset.");
    if (!browser || !runtime) throw new HarnessError("B29 needs the browser and Runtime adapters.");

    const opened = await browser.openLocalImportCard();
    record("card-opened", { targetId: opened.targetId });

    const selected = await browser.selectLocalFile(asset.path);
    if (selected.accepted !== true) {
      throw new HarnessError("B29: the product did not create an import for the selected file.");
    }
    record("file-selected", { selected: Boolean(selected.selected) });

    const upload = await browser.observeUploadStart();
    const importId = upload.importId;
    record("upload-observed", { importId });

    const status = await browser.readPublicStatus(importId);
    record("status-read", { state: status.state, sequence: status.sequence });

    const progress = await browser.readUploadProgress(importId);
    record("progress-read", { samples: progress.samples.length });

    const product = await browser.readProductProjection(importId);
    record("product-read", { productId: product.productId });

    const thumbnail = await browser.readThumbnailRoute(product.taskId, product.evidenceId);
    record("thumbnail-read", { contentType: thumbnail.contentType, bytes: thumbnail.byteLength });

    const cleanup = await browser.readCleanupState(importId);
    record("cleanup-read", { cleanupCount: cleanup.cleanupCount });

    const residue = await browser.readResidue(importId);
    record("residue-read", { residue });

    const progressMonotonic = progress.samples.every(
      (sample, index) => index === 0 || sample.uploadedBytes >= progress.samples[index - 1].uploadedBytes,
    );
    const writerSliceMaxBytes = progress.writerSliceMaxBytes ?? 0;
    const finalUploadedBytes = progress.finalByteCount ?? progress.samples.at(-1)?.uploadedBytes ?? 0;
    const uploads = countRequests(runtime, `/v1/media/local-imports/${importId}/content`, "PUT");

    if (progress.samples.length < 2 || finalUploadedBytes !== asset.byteLength) {
      throw new HarnessError(
        `B29: upload progress did not prove the complete body (${finalUploadedBytes}/${asset.byteLength}).`,
      );
    }
    if (!progressMonotonic) throw new HarnessError("B29: the upload progress was not monotonic.");
    if (writerSliceMaxBytes <= 0 || writerSliceMaxBytes > 1_048_576) {
      throw new HarnessError(`B29: a writer slice was ${writerSliceMaxBytes} bytes, above the frozen bound.`);
    }
    if (status.state !== "ready") {
      throw new HarnessError(`B29: the import did not reach the successful ready terminal (${status.state}).`);
    }
    if (!/^outline_[a-f0-9]{32}$/.test(product.productId ?? "") ||
        !/^media_task_[a-f0-9]{32}$/.test(product.taskId ?? "")) {
      throw new HarnessError("B29: no real product was published.");
    }
    if (thumbnail.contentType !== "image/png" || !thumbnail.byteLength) {
      throw new HarnessError("B29: the thumbnail route did not return a readable PNG.");
    }
    if (cleanup.cleanupCount !== 1) {
      throw new HarnessError(`B29: cleanup ran ${cleanup.cleanupCount} times instead of exactly once.`);
    }
    if (uploads !== 1) throw new HarnessError(`B29: expected one real PUT, observed ${uploads}.`);
    if (residue.source || residue.sandbox) {
      throw new HarnessError(`B29: residue survived the run: ${JSON.stringify(residue)}`);
    }

    return {
      case: "B29",
      byteLength: asset.byteLength,
      allocatedRatio: asset.allocatedRatio,
      sha256: asset.sha256,
      ffprobeSha256: asset.ffprobeSha256,
      nonEmptySegments: asset.nonEmptySegments,
      distinctFrameCount: asset.distinctFrameCount,
      importId,
      taskId: product.taskId,
      productId: product.productId,
      progressMonotonic,
      writerSliceMaxBytes,
      terminalSequence: status.sequence,
      cleanupCount: cleanup.cleanupCount,
      residue,
      uploads,
      eventsDigest: eventsDigest(context.events)
    };
  }
};

