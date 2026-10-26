// The synthetic observations of the ORDER-2 DIAGNOSTIC CANARY.
//
// They are the canary's INPUT contract: a real canary run produces them from
// the product's own passive observations and from the AUTHENTICATED public
// routes. The fixture exists so that the anti-false-green matrix can drive
// the REAL canary entry point with a doctored input and assert the PRODUCTION
// verdict and the process exit code.
//
// It contains no source content, no Provider identity, no path and no
// credential.

/** The frozen order-2 identity. */
export const ORDER2_BVID = "BV1QcYx6VEAj";

/** The schema of the observations. */
export const OBSERVATIONS_SCHEMA = "v3-5.10-b6c-order2-observations/v1";

/**
 * Build an observation set.
 *
 * @param {object} overrides the fields to override
 */
export function buildObservations(overrides = {}) {
  const base = {
    schemaVersion: OBSERVATIONS_SCHEMA,
    registryOrder: "2",
    bvid: ORDER2_BVID,
    runId: "b6c-offline-positive",
    taskId: `media_task_${"2".padStart(32, "0")}`,
    visualObservations: [
      { method: "POST", routeClass: "materialize-visual", status: 200, errorCode: null },
    ],
    observationCodes: [],
    taskState: "ready",
    terminalFailureCode: null,
    evidenceKindCounts: { transcript: 84, frame: 4, ocr_block: 4, vision_caption: 4 },
    pngConfirmedFrameCount: 4,
    pngFailureCodes: [],
    capture: {
      status: "captured",
      failureCodes: [],
      counts: { evidence: 96, thumbnails: 4, chapters: 6 },
    },
    cleanup: { runtimeScratchDeleted: true, profileRootDeleted: true, cleanupFailure: null },
    ownedLeakSightings: 0,
    actionCounters: {
      chromeLaunchCount: 1,
      visibleWindowCount: 1,
      runtimeStartCount: 1,
      cookieInjectionCount: 26,
      focusEventCount: 1,
      mediaTaskCount: 1,
      runtimeSynthesizeCount: 1,
      providerCallCount: 3,
      sourceCompletionCount: 0,
      audioOutputCount: 0,
      tabCaptureActionCount: 0,
    },
    uploadCounters: {
      rawVideoUploadCount: 0,
      rawAudioUploadCount: 0,
      frameByteUploadCount: 0,
      cookieUploadCount: 0,
      apiKeyDisclosureCount: 0,
      localPathUploadCount: 0,
    },
  };
  return { ...base, ...overrides };
}
