/**
 * WP-B: where the explicit local-import entry may appear.
 *
 * The entry is a LAST RESORT, so it is offered only when every one of these is
 * true:
 *
 * * the Runtime itself reports the frozen eligibility (all three automatic
 *   routes failed, in order, with no selected input and no capture grant);
 * * no capture is running and none is stopping;
 * * no acquisition is starting, transcribing or holding an acquired input;
 * * no published projection exists for this task (a terminal task has nothing
 *   left to import into);
 * * the page knows BOTH the task id and the source identity, because the frozen
 *   create body carries exactly those four fields and nothing else.
 *
 * Keeping the rule in one pure function means the host renders the card and the
 * tests assert the SAME predicate, so "the entry is absent" is proven against
 * the code that actually decides it.
 */

export type LocalImportEntryState = {
  /** The Runtime's own frozen capture-fallback eligibility for this task. */
  captureFallbackEligible: boolean;
  captureState: "awaiting_user" | "starting" | "capturing" | "stopping" | "transcribing" | "succeeded" | "failed";
  acquisitionState: string;
  /** A published, terminal projection already exists for this task. */
  hasProjection: boolean;
  taskId: string | null | undefined;
  sourceIdentity: string | null | undefined;
};

type MediaProjectionTerminal = {
  state: string;
  terminal: boolean;
} | null | undefined;

/** Only a successfully published terminal product makes local import obsolete. */
export function hasPublishedMediaProjection(projection: MediaProjectionTerminal): boolean {
  return projection?.terminal === true
    && (projection.state === "succeeded" || projection.state === "degraded");
}

/**
 * A navigation identity deliberately ignores the URL hash and tracking query
 * parameters. A different BVID or `p` is a real media boundary; a hash-only
 * Side Panel navigation is not.
 */
export function mediaNavigationIdentity(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.hostname !== "www.bilibili.com") return null;
    const match = /^\/video\/([^/?#]+)/.exec(url.pathname);
    if (!match) return null;
    return `${match[1]}:p${url.searchParams.get("p") ?? "1"}`;
  } catch {
    return null;
  }
}

/** Acquisition states that already own the shared input. */
const BUSY_ACQUISITION_STATES = new Set(["starting", "transcribing", "input_acquired"]);
/** Acquisition states that mean the task is already finished. */
const FINISHED_ACQUISITION_STATES = new Set(["succeeded", "published"]);
/** Capture states that mean a trusted click is in flight. */
const BUSY_CAPTURE_STATES = new Set(["starting", "capturing", "stopping", "transcribing"]);

export function localImportEntryEligible(state: LocalImportEntryState): boolean {
  if (!state.captureFallbackEligible) return false;
  if (BUSY_CAPTURE_STATES.has(state.captureState)) return false;
  if (BUSY_ACQUISITION_STATES.has(state.acquisitionState)) return false;
  if (FINISHED_ACQUISITION_STATES.has(state.acquisitionState)) return false;
  if (state.hasProjection) return false;
  return Boolean(state.taskId) && Boolean(state.sourceIdentity);
}
