/**
 * WP-B VH4 — B30: the registered 1 GB asset and the UX and resource gates.
 *
 * The asset is generated ONLY in the later approved run. The executor proves:
 *
 *   * the asset is not sparse and stays inside its frozen byte window;
 *   * the upload stays STREAMING (the whole body never arrives at once);
 *   * the progress is monotonic;
 *   * the Runtime peak RSS delta and the Extension JS heap delta stay inside
 *     the frozen bounds — an unavailable measurement is a FAILURE, not zero;
 *   * the product reaches its required terminal;
 *   * every owned artifact is zero after the cleanup;
 *   * the keyboard, ARIA/live-region and scroll/viewport oracles pass against
 *     the ACTUAL Side Panel DOM: a node that merely EXISTS is not enough, the
 *     control must be visible, enabled and hit-testable, and the layout must be
 *     stable.
 */

import { HarnessError } from "../plan.mjs";
import { countRequests, eventsDigest } from "../context.mjs";

async function atStage(name, operation) {
  try {
    return await operation();
  } catch (error) {
    throw new HarnessError(`B30 ${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export const EXECUTOR = {
  id: "b30-real-1gb-asset-ux-and-resources",
  placeholder: false,
  requiredInputs: ["asset", "sidePanel", "fileChooser", "uploadProgress", "resourceMeter", "accessibilityProbe"],
  requiredReceiptFields: [
    "byteLength",
    "allocatedRatio",
    "sha256",
    "runtimeRssDeltaBytes",
    "extensionHeapDeltaBytes",
    "resourceSamples",
    "progressMonotonic",
    "importId",
    "taskId",
    "productId",
    "terminalSequence",
    "cleanupCount",
    "residue",
    "keyboardOracles",
    "ariaOracles",
    "viewportOracles"
  ],

  async run(context) {
    const { browser, runtime, preflight, record } = context;
    const asset = preflight?.asset;
    if (!asset) throw new HarnessError("B30 needs the generated registry asset.");
    if (!browser || !runtime) throw new HarnessError("B30 needs the browser and Runtime adapters.");

    if (asset.byteLength < 1_020_054_732 || asset.byteLength > 1_127_428_915) {
      throw new HarnessError(
        `B30: the asset is ${asset.byteLength} bytes, outside the frozen 1 GB window.`,
      );
    }
    if (asset.allocatedRatio < 0.95) {
      throw new HarnessError(`B30: the asset is sparse (allocated ratio ${asset.allocatedRatio}).`);
    }

    const opened = await atStage("open-card", () => browser.openLocalImportCard());
    record("card-opened", { targetId: opened.targetId });

    // The BASELINE is one sample; the PEAK is taken over every sample taken
    // while the upload and the processing run.
    const before = await atStage("metrics-baseline", () => browser.readMetrics("baseline"));
    record("metrics-baseline", { rssBytes: before.rssBytes, heapBytes: before.heapBytes });
    await atStage("sampling-start", () => browser.beginResourceSampling());

    const selected = await atStage("file-selection", () => browser.selectLocalFile(asset.path, { keyboard: true }));
    if (selected.accepted !== true) {
      throw new HarnessError("B30: the product did not create an import for the selected file.");
    }
    record("file-selected", { selected: Boolean(selected.selected) });

    const upload = await atStage("upload-observation", () => browser.observeUploadStart());
    const importId = upload.importId;
    record("upload-observed", { importId });
    // The sampling runs THROUGHOUT the upload and the processing.
    await atStage("metrics-upload", () => browser.readMetrics("upload"));

    const status = await atStage("public-status", () => browser.readPublicStatus(importId));
    record("status-read", { state: status.state, sequence: status.sequence });
    const progress = await atStage("upload-progress", () => browser.readUploadProgress(importId));
    record("progress-read", { samples: progress.samples.length });
    await atStage("metrics-processing", () => browser.readMetrics("processing"));

    const product = await atStage("product-projection", () => browser.readProductProjection(importId));
    record("product-read", { productId: product.productId });
    await atStage("metrics-product", () => browser.readMetrics("product"));

    const peak = await atStage("metrics-peak", () => browser.peakResources());
    record("metrics-peak", {
      samples: peak.samples,
      peakRssBytes: peak.peakRssBytes,
      peakHeapBytes: peak.peakHeapBytes
    });

    const accessibility = await atStage("accessibility", () => browser.readAccessibility());
    record("accessibility-read", {
      keyboard: accessibility.keyboard.passed,
      aria: accessibility.aria.passed,
      viewport: accessibility.viewport.passed
    });

    const cleanup = await atStage("cleanup", () => browser.readCleanupState(importId));
    record("cleanup-read", { cleanupCount: cleanup.cleanupCount });
    const residue = await atStage("residue", () => browser.readResidue(importId));
    record("residue-read", { residue });

    const runtimeRssDeltaBytes = peak.peakRssBytes - before.rssBytes;
    const extensionHeapDeltaBytes = peak.peakHeapBytes - before.heapBytes;
    const progressMonotonic = progress.samples.every(
      (sample, index) => index === 0 || sample.uploadedBytes >= progress.samples[index - 1].uploadedBytes,
    );
    const finalUploadedBytes = progress.finalByteCount ?? progress.samples.at(-1)?.uploadedBytes ?? 0;
    const uploads = countRequests(runtime, `/v1/media/local-imports/${importId}/content`, "PUT");

    if (peak.samples < 4) {
      throw new HarnessError(
        `B30: only ${peak.samples} resource sample(s) were taken. A point-in-time pair is not a peak.`,
      );
    }
    if (runtimeRssDeltaBytes <= 0 || extensionHeapDeltaBytes <= 0) {
      throw new HarnessError(
        "B30: a resource measurement was unavailable. An unavailable measurement is a failure, not zero.",
      );
    }
    if (runtimeRssDeltaBytes > 268_435_456) {
      throw new HarnessError(`B30: the Runtime RSS delta is ${runtimeRssDeltaBytes} bytes, above the bound.`);
    }
    if (extensionHeapDeltaBytes > 134_217_728) {
      throw new HarnessError(
        `B30: the Extension heap delta is ${extensionHeapDeltaBytes} bytes, above the bound.`,
      );
    }
    if (progress.samples.length < 2 || finalUploadedBytes !== asset.byteLength) {
      throw new HarnessError(
        `B30: upload progress did not prove the complete body (${finalUploadedBytes}/${asset.byteLength}).`,
      );
    }
    if (!progressMonotonic) throw new HarnessError("B30: the upload progress was not monotonic.");
    if (status.state !== "ready") {
      throw new HarnessError(`B30: the import did not reach the successful ready terminal (${status.state}).`);
    }
    if (!/^outline_[a-f0-9]{32}$/.test(product.productId ?? "") ||
        !/^media_task_[a-f0-9]{32}$/.test(product.taskId ?? "")) {
      throw new HarnessError("B30: no real product was published.");
    }
    if (!accessibility.keyboard.passed) {
      throw new HarnessError(`B30: the keyboard oracles failed: ${JSON.stringify(accessibility.keyboard)}`);
    }
    if (!accessibility.aria.passed) {
      throw new HarnessError(`B30: the aria oracles failed: ${JSON.stringify(accessibility.aria)}`);
    }
    if (!accessibility.viewport.passed) {
      throw new HarnessError(`B30: the viewport oracles failed: ${JSON.stringify(accessibility.viewport)}`);
    }
    if (residue.source || residue.sandbox) {
      throw new HarnessError(`B30: residue survived the run: ${JSON.stringify(residue)}`);
    }
    if (cleanup.cleanupCount !== 1) {
      throw new HarnessError(`B30: cleanup ran ${cleanup.cleanupCount} times instead of exactly once.`);
    }
    if (uploads !== 1) throw new HarnessError(`B30: expected one real PUT, observed ${uploads}.`);

    return {
      case: "B30",
      byteLength: asset.byteLength,
      allocatedRatio: asset.allocatedRatio,
      sha256: asset.sha256,
      runtimeRssDeltaBytes,
      extensionHeapDeltaBytes,
      resourceSamples: peak.samples,
      progressMonotonic,
      importId,
      taskId: product.taskId,
      productId: product.productId,
      terminalSequence: status.sequence,
      cleanupCount: cleanup.cleanupCount,
      residue,
      keyboardOracles: accessibility.keyboard,
      ariaOracles: accessibility.aria,
      viewportOracles: accessibility.viewport,
      uploads,
      eventsDigest: eventsDigest(context.events)
    };
  }
};
