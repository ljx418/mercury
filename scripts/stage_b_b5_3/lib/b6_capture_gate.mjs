// The B-6 CAPTURE GATE of the runner.
//
// The gate expresses ONE rule: a source may only be counted as COMPLETE
// when its review capture closed.
//
// A capture failure therefore never leaves a `sourceCompletion` accounting
// behind and never leaves a final machine receipt that can be interpreted as
// a complete source. The gate is PURE: it decides, it never writes.

/** The fallback failure code of a capture failure. */
export const CAPTURE_GATE_FAILURE = Object.freeze({
  DEFAULT: "B6_CAPTURE_FAILED",
});

/**
 * The decision of the capture gate.
 *
 * @param {object} input
 * @param {boolean} input.captureRequested was a review capture requested?
 * @param {object|null} input.capture the capture outcome
 * @returns {{allowSourceCompletion: boolean, failureCode: string|null, captureStatus: string}}
 */
export function captureGateDecision({ captureRequested = false, capture = null } = {}) {
  if (!captureRequested) {
    // The capture is OPTIONAL: without an explicit private root the B-5
    // behaviour is unchanged and the source may be counted.
    return { allowSourceCompletion: true, failureCode: null, captureStatus: "not_requested" };
  }
  if (capture && capture.ok === true) {
    return { allowSourceCompletion: true, failureCode: null, captureStatus: "captured" };
  }
  return {
    allowSourceCompletion: false,
    failureCode: capture?.code ?? CAPTURE_GATE_FAILURE.DEFAULT,
    captureStatus: "failed",
  };
}
