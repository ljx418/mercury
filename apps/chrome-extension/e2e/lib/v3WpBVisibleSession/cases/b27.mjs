/**
 * WP-B VH4 — B27: the real abort and identity containment.
 *
 * The case drives the REAL Side Panel file input, observes a REAL Extension
 * `XMLHttpRequest` upload, triggers the frozen interruption through the public
 * session lifecycle, and then proves through the PUBLIC Runtime routes that:
 *
 *   * the real XHR was aborted;
 *   * the real Runtime DELETE happened;
 *   * the public status converged by an increasing sequence to an allowed
 *     terminal state;
 *   * the old import did not attach to the new page identity;
 *   * no token, File object, local-import id or stale terminal leaked into the
 *     extension storage or the UI.
 *
 * The executor never calls the client, the controller, the store, the database,
 * the coordinator or the materializer directly.
 */

import { HarnessError } from "../plan.mjs";
import { countRequests, eventsDigest } from "../context.mjs";

export const EXECUTOR = {
  id: "b27-identity-containment",
  placeholder: false,
  requiredInputs: ["sidePanel", "fileChooser", "sessionLifecycle", "runtimeRequests", "extensionStorage", "uploadInterruptionWindow"],
  requiredReceiptFields: [
    "xhrAborted",
    "deleteObserved",
    "abortProof",
    "statusConverged",
    "identityContained",
    "residue",
    "sequence"
  ],

  async run(context) {
    const { browser, runtime, record } = context;
    if (!browser || !runtime) {
      throw new HarnessError("B27 needs the browser and Runtime adapters.");
    }

    // 1. The real Side Panel, with the local-import card mounted.
    const opened = await browser.openLocalImportCard();
    record("card-opened", { targetId: opened.targetId });

    // Keep the real loopback XHR in flight long enough for the real portal
    // identity transition to settle. This shapes only the owned Side Panel's
    // network; it does not call or replace a product owner.
    await browser.beginUploadInterruptionWindow();
    let upload;
    let identity;
    let aborted;
    try {
      // 2. A real file through the real hidden file input.
      const selected = await browser.selectLocalFile(context.preflight.probeMediaPath);
      if (selected.accepted !== true) {
        throw new HarnessError("B27: the product did not create an import for the selected file.");
      }
      record("file-selected", { selected: Boolean(selected.selected) });

      // 3. A real Extension XHR upload was observed while still in flight.
      upload = await browser.observeUploadStart({ requireInFlight: true });
      record("upload-observed", { importId: upload.importId });

      // 4. The REAL identity switch: the owned tab is navigated to a SECOND
      // Bilibili identity, so the product resolves a different media identity.
      // Changing the Side Panel hash is NOT an identity switch.
      identity = await browser.triggerIdentityChange(context.preflight.identitySwitchTarget);
      record("identity-changed", { before: identity.before, after: identity.after });

      // Abort is observed AFTER the identity transition. Sampling it at upload
      // start can only produce a false negative (or a fabricated true).
      aborted = await browser.waitForUploadAbort(upload.importId);
      record("upload-aborted", { aborted: aborted.aborted });
    } finally {
      await browser.endUploadInterruptionWindow();
    }
    const importId = upload.importId;

    // 5. The real Runtime DELETE.
    const clientDeletes = countRequests(runtime, `/v1/media/local-imports/${importId}`, "DELETE");
    const serverCancel = await browser.readCancelObservation(importId);
    const deletes = Math.max(clientDeletes, serverCancel.cancelRequestCount);
    record("delete-observed", { deletes });

    // 6. The public status converges by an increasing sequence.
    const status = await browser.readPublicStatus(importId);
    record("status-read", { state: status.state, sequence: status.sequence });

    // 7. Nothing leaked into the storage or the UI.
    const storage = await browser.readExtensionStorage();
    const ui = await browser.readUiResidue();
    record("residue-read", { storage: storage.residue, ui: ui.counts });

    const xhrAborted = Boolean(aborted.aborted);
    const deleteObserved = deletes >= 1;
    const statusConverged = status.state === "cancelled" && status.sequence > upload.sequence;
    const identityContained = identity.after !== identity.before && !ui.counts.importId;
    const residue = {
      storageImportId: storage.residue.importId,
      storageBearer: storage.residue.bearer,
      storageUploadToken: storage.residue.uploadToken,
      fileName: ui.counts.fileName,
      importId: ui.counts.importId,
      token: ui.counts.token
    };

    if (!xhrAborted) {
      throw new HarnessError(
        `B27: the real upload XHR was not aborted (observation=${aborted.proof ?? "unknown"}).`,
      );
    }
    if (!deleteObserved) throw new HarnessError("B27: no real Runtime DELETE was observed.");
    if (!statusConverged) {
      throw new HarnessError(
        `B27: the public status did not converge to cancelled (state=${status.state}, sequence=${status.sequence}).`,
      );
    }
    if (!identityContained) {
      throw new HarnessError("B27: the old import attached itself to the new page identity.");
    }
    if (Object.values(residue).some((value) => value !== 0)) {
      throw new HarnessError(`B27: residue survived the interruption: ${JSON.stringify(residue)}`);
    }

    return {
      case: "B27",
      xhrAborted,
      abortProof: aborted.proof ?? "unknown",
      deleteObserved,
      statusConverged,
      identityContained,
      residue,
      sequence: status.sequence,
      terminalState: status.state,
      importId,
      eventsDigest: eventsDigest(context.events)
    };
  }
};
