/**
 * WP-B — the deterministic REAL user-flow driver.
 *
 * The driver reaches the last-resort local-import card the way a user does:
 * an owned Bilibili tab, the real Side Panel, the visible product controls and
 * the public Runtime messages. It never calls the client, the controller, the
 * store, the database, the coordinator or the materializer directly, and it never
 * forces React state or calls the eligibility predicate as setup.
 *
 * The FLOW PLAN below is a pure description, so the offline tests can assert
 * the composition — the order, the product controls and the forbidden calls —
 * without a browser.
 */

/**
 * The user flow, in order.
 *
 * Every `control` is a VISIBLE product control. The driver clicks it, waits
 * for the product's own state, and moves on.
 */
export const USER_FLOW_STEPS = Object.freeze([
  {
    id: "open-owned-bilibili-tab",
    control: null,
    expects: "the owned tab shows the requested Bilibili video"
  },
  {
    id: "open-side-panel",
    control: null,
    expects: "the real Side Panel document is open for the owned tab"
  },
  {
    id: "enable-media-companion",
    control: "[data-testid='media-companion-enable']",
    expects: "the production Side Panel grants consent and automatically connects and starts acquisition"
  },
  {
    id: "await-last-resort-card",
    control: "[data-testid='local-media-import-card']",
    expects: "the last-resort local-import card is mounted after the automatic routes failed"
  }
]);

/** The product controls the driver is allowed to touch. */
export const ALLOWED_CONTROLS = Object.freeze(
  USER_FLOW_STEPS.map((step) => step.control).filter(Boolean)
);

/**
 * The calls the driver may NEVER make.
 *
 * The driver reaches the product through visible controls and public messages
 * only. A driver that called an owner directly would prove nothing about the
 * product.
 */
export const FORBIDDEN_DRIVER_CALLS = Object.freeze([
  "LocalMediaImportClient",
  "createLocalImportClient",
  "localImportEntryEligible",
  "LocalImportManager",
  "LocalMediaConsumerBarrier",
  "LocalImportOrchestrator",
  "MediaProductMaterializer",
  "MediaAcquisitionCoordinator",
  "media_local_import_store",
  "fetch('/v1/media/local-imports'",
  "import_private_file"
]);

/**
 * The identity plan.
 *
 * Every case gets its OWN Bilibili identity, so a successful B29 product
 * cannot make B30 ineligible and the source authority of one case can never
 * block another.
 */
export function buildIdentityPlan(cases, targets) {
  const plan = [];
  let index = 0;
  for (const entry of cases) {
    const target = targets[entry.case];
    if (!target) {
      throw new Error(`No target URL was supplied for ${entry.case}.`);
    }
    plan.push({ case: entry.case, target, kind: "primary" });
    // B27 needs a SECOND real identity to switch to.
    if (entry.case === "B27") {
      const second = targets.B27Second;
      if (!second) {
        throw new Error("B27 needs a second Bilibili identity to switch to.");
      }
      plan.push({ case: entry.case, target: second, kind: "identity-switch" });
    }
    index += 1;
  }
  return plan;
}

/**
 * The resource sampling plan.
 *
 * The peak is sampled THROUGHOUT the upload and the processing. A
 * before/after pair is not a peak.
 */
export function buildSamplingPlan({ intervalMs = 500, minimumSamples = 4 }) {
  return {
    intervalMs,
    minimumSamples,
    requires: ["owned-runtime-rss", "side-panel-heap"],
    note: "The peak is the maximum over every sample taken while the upload and the processing run."
  };
}

/**
 * The accessibility plan.
 *
 * The driver performs a REAL keyboard traversal and activation, and checks the
 * real geometry. A node that merely exists is not enough.
 */
export function buildAccessibilityPlan() {
  return {
    steps: [
      { id: "focus-the-first-control", control: "[data-testid='local-import-pick']" },
      { id: "tab-through-the-card", control: null },
      { id: "activate-with-the-keyboard", control: "[data-testid='local-import-pick']" },
      { id: "read-the-live-region", control: "[role='status'], [aria-live]" },
      { id: "measure-the-layout", control: null }
    ],
    requires: {
      focusOrder: "strictly increasing, no duplicates",
      controls: "visible, enabled and hit-testable at the real Side Panel viewport",
      liveRegion: "the error or the phase text changes in the live region",
      layout: "the scroll height and the control geometry are stable"
    }
  };
}

/**
 * The cookie injection plan.
 *
 * The ONLY media and credential source is an explicitly supplied file. Nothing
 * is searched for on the Desktop, in another repository or on a drive.
 */
export function buildCookiePlan({ cookieFile, extensionId }) {
  if (!cookieFile) {
    throw new Error(
      "EXTERNAL-INPUT BLOCK: no cookie file was supplied. The browser session needs an explicitly provided cookie file; no search is permitted."
    );
  }
  return {
    cookieFile,
    extensionId,
    note: "The cookies are injected into the OWNED browser context only, through the repository-supported path."
  };
}
