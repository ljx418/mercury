/**
 * WP-B VH1 — the visible-session plan and the executable case registry.
 *
 * Every frozen visible case is bound to a REAL executor with a stable id, the
 * inputs it needs and the receipt fields it must produce. The registry is the
 * single source of truth for the offline completeness test, which fails when a
 * case has no executor, when the executor is still a throw-only placeholder, or
 * when a required oracle field is missing.
 *
 * Nothing here launches anything. The executors receive an injected context;
 * the offline tests drive them with recording adapters.
 */

export class HarnessError extends Error {}

/** The three frozen visible cases, and the acceptance-plan wording. */
export const FROZEN_VISIBLE_CASES = Object.freeze([
  {
    case: "B27",
    title: "identity switch, unmount and session generation",
    oracle:
      "the old import is aborted and cancelled, it does not attach to the new page, and no File, name, token or storage residue is left",
    requiredInputs: ["sidePanel", "fileChooser", "sessionLifecycle", "runtimeRequests", "extensionStorage"],
    requiredReceiptFields: [
      "xhrAborted",
      "deleteObserved",
      "statusConverged",
      "identityContained",
      "residue",
      "sequence"
    ]
  },
  {
    case: "B29",
    title: "the registered 100 MB asset through the Side Panel product path",
    oracle:
      "the input File reaches the public API, with real progress, a real transcript, real frames, a real product workspace and a readable thumbnail",
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
    ]
  },
  {
    case: "B30",
    title: "the registered 1 GB asset and the UX and resource gates",
    oracle:
      "the asset is not sparse and stays inside its byte window, the upload stays streaming, the product reaches its terminal, the owned artifacts are zero after cleanup, and the keyboard, ARIA and viewport oracles pass against the real Side Panel DOM",
    requiredInputs: ["asset", "sidePanel", "fileChooser", "uploadProgress", "resourceMeter", "accessibilityProbe"],
    requiredReceiptFields: [
      "byteLength",
      "allocatedRatio",
      "sha256",
      "runtimeRssDeltaBytes",
      "extensionHeapDeltaBytes",
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
    ]
  }
]);

/** The frozen resource and capacity boundaries. */
export const FROZEN_BOUNDARIES = Object.freeze({
  runtimeRssDeltaBytesMax: 268_435_456,
  extensionHeapDeltaBytesMax: 134_217_728,
  freeDiskBytesMin: 4_294_967_296,
  writerSliceBytesMax: 1_048_576,
  localImportPort: 17_861
});

/**
 * The executor registry.
 *
 * `placeholder: true` marks a case that is NOT executable. The completeness
 * test fails while any frozen case still carries one.
 */
export function buildCaseRegistry(executors) {
  const registry = new Map();
  for (const [caseId, executor] of Object.entries(executors)) {
    registry.set(caseId, {
      id: executor.id,
      placeholder: executor.placeholder === true,
      requiredInputs: [...(executor.requiredInputs ?? [])],
      requiredReceiptFields: [...(executor.requiredReceiptFields ?? [])],
      run: executor.run
    });
  }
  return registry;
}

/**
 * The session plan: the frozen cases, each bound to its executor.
 */
export function buildSessionPlan(registry, { strict = true } = {}) {
  return FROZEN_VISIBLE_CASES.map((entry) => {
    const executor = registry.get(entry.case);
    if (!executor && strict) {
      throw new HarnessError(
        `The frozen visible case ${entry.case} has no executor. A visible run would fail on it.`,
      );
    }
    return {
      case: entry.case,
      title: entry.title,
      oracle: entry.oracle,
      executorId: executor?.id ?? null,
      placeholder: executor?.placeholder ?? true,
      requiredInputs: entry.requiredInputs,
      requiredReceiptFields: entry.requiredReceiptFields
    };
  });
}

/**
 * The completeness rule, used by the offline meta-test and by the runner.
 *
 * It fails when a case has no executor, when the executor is a throw-only
 * placeholder, or when a required oracle field is missing.
 */
export function assertSessionPlanIsComplete(plan, registry) {
  const problems = [];
  const seen = new Set();
  for (const entry of plan) {
    seen.add(entry.case);
    const executor = registry.get(entry.case);
    if (!executor) {
      problems.push(`${entry.case}: no executor is registered`);
      continue;
    }
    if (executor.placeholder) {
      problems.push(`${entry.case}: the executor is still a throw-only placeholder`);
    }
    if (typeof executor.run !== "function") {
      problems.push(`${entry.case}: the executor is not callable`);
    } else {
      const source = String(executor.run);
      const returns = /\breturn\b/.test(source);
      if (!returns) {
        problems.push(`${entry.case}: the executor never returns a receipt`);
      }
    }
    if (!executor.requiredReceiptFields.length) {
      problems.push(`${entry.case}: the executor declares no required receipt field`);
    }
    for (const field of entry.requiredReceiptFields) {
      if (!executor.requiredReceiptFields.includes(field)) {
        problems.push(`${entry.case}: the executor does not produce the required field ${field}`);
      }
    }
    if (!entry.requiredInputs.length) {
      problems.push(`${entry.case}: the case declares no required input`);
    }
  }
  for (const entry of FROZEN_VISIBLE_CASES) {
    if (!seen.has(entry.case)) problems.push(`${entry.case}: the case is missing from the plan`);
  }
  if (problems.length) {
    throw new HarnessError(`The visible-session plan is incomplete: ${problems.join("; ")}`);
  }
  return true;
}

/**
 * Reduce one case's recorded events into its receipt and check every required
 * field is present. A missing field is a FAILURE, never a default.
 */
export function reduceCaseReceipt(entry, executor, events, measurements) {
  const receipt = executor.run({ events: [...events], measurements: { ...measurements } });
  if (!receipt || typeof receipt !== "object") {
    throw new HarnessError(`${entry.case}: the executor produced no receipt.`);
  }
  const missing = entry.requiredReceiptFields.filter((field) => !(field in receipt));
  if (missing.length) {
    throw new HarnessError(
      `${entry.case}: the receipt is missing the required field(s) ${missing.join(", ")}.`,
    );
  }
  return receipt;
}
