/**
 * WP-B VH4 — the shared context the three visible-case executors drive.
 *
 * The context is the ONLY way a case reaches the product. The runner supplies
 * the real implementations; the offline tests supply recording doubles. No case
 * may reach into the manager, the controller, the store, the database, the
 * coordinator or the materializer directly.
 *
 * ## The browser adapter contract
 *
 * ```
 * openLocalImportCard()        -> { targetId }        the real Side Panel target
 * selectLocalFile(filePath)     -> { selected }        through the real hidden file input
 * observeUploadStart()          -> { importId }        a real Extension XHR was seen
 * triggerIdentityChange()       -> { before, after }   the real session/identity lifecycle
 * readPublicStatus(importId)    -> { state, sequence } the PUBLIC Runtime status
 * readExtensionStorage()        -> { keys }            the extension storage residue
 * readUiResidue()              -> { counts }          the File/name/token residue in the UI
 * readMetrics()                 -> { rssBytes, heapBytes }
 * readAccessibility()           -> { keyboard, aria, viewport }
 * ```
 *
 * ## The runtime adapter contract
 *
 * ```
 * requests                       -> [{ method, path, status }]
 * request(path, options)         -> { status, payload }
 * ```
 *
 * The Runtime adapter records EVERY request that reaches the owned Runtime, so
 * a case can prove that its upload, DELETE and status calls were addressed to
 * the owned Runtime and carried the production envelope.
 */

import { HarnessError } from "./plan.mjs";

export function buildContext({
  plan,
  preflight,
  browser,
  runtime,
  fs,
  clock,
  events,
  measurements
}) {
  if (!plan || !browser || !runtime || !fs) {
    throw new HarnessError("A visible case needs a plan, a browser, a runtime and a filesystem.");
  }
  const recorded = events ?? [];
  return {
    plan,
    preflight,
    browser,
    runtime,
    fs,
    clock: clock ?? { sleep: async () => undefined, now: () => 0 },
    events: recorded,
    measurements: measurements ?? {},
    record(type, detail) {
      recorded.push({ type, ...detail });
    }
  };
}

/** The requests the owned Runtime actually received, for one case. */
export function requestsFor(runtime, predicate) {
  return (runtime.requests ?? []).filter(predicate ?? (() => true));
}

/** The number of requests to a path that starts with a prefix. */
export function countRequests(runtime, prefix, method) {
  return requestsFor(
    runtime,
    (entry) => entry.path.startsWith(prefix) && (!method || entry.method === method),
  ).length;
}

/** A stable, redacted digest of the recorded events. */
export function eventsDigest(events) {
  let hash = 2166136261;
  const rendered = events.map((entry) => `${entry.type}:${JSON.stringify(entry.detail ?? {})}`).join("|");
  for (let index = 0; index < rendered.length; index += 1) {
    hash ^= rendered.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return `fnv1a32:${hash.toString(16).padStart(8, "0")}`;
}
