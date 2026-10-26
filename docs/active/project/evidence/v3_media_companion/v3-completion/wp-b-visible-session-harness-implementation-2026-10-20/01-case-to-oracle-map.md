# The executable case-to-oracle map

Every frozen visible case is bound to a real executor. The map is generated from
the code, not written by hand: `buildSessionPlan()` and
`assertSessionPlanIsComplete()` are the single source of truth, and the offline
meta-test fails when a binding is missing, a placeholder is left, or a required
oracle field is not produced.

| case | executor | the oracle it proves | required receipt fields |
|---|---|---|---|
| **B27** | `b27-identity-containment` | the real upload XHR was aborted; the real Runtime `DELETE` happened; the public status converged by an increasing sequence to `ready`/`cancelled`/`failed`; the old import did not attach to the new page identity; no token, File, import id or stale terminal leaked into the storage or the UI | `xhrAborted`, `deleteObserved`, `statusConverged`, `identityContained`, `residue`, `sequence` |
| **B29** | `b29-real-100mb-asset` | the registered 100 MB asset entered through the real Side Panel file input; the progress was monotonic; the writer slices stayed <= 1 MiB; the public import state reached an allowed terminal; a real product and a readable thumbnail route were published; the cleanup ran once; the source and sandbox residue was zero; the downloader and the credential resolver were dispatched zero times | `byteLength`, `allocatedRatio`, `sha256`, `ffprobeSha256`, `nonEmptySegments`, `distinctFrameCount`, `importId`, `taskId`, `productId`, `progressMonotonic`, `writerSliceMaxBytes`, `terminalSequence`, `cleanupCount`, `residue` |
| **B30** | `b30-real-1gb-asset-ux-and-resources` | the registered 1 GB asset is non-sparse and inside `1020054732..1127428915` bytes; the upload stayed streaming; the progress was monotonic; the Runtime RSS delta is <= 268435456 bytes and the Extension heap delta <= 134217728 bytes, and an unavailable measurement is a failure; the product reached its required terminal; the keyboard, ARIA/live-region and scroll/viewport oracles pass against the actual Side Panel DOM; every owned artifact is zero after the cleanup | `byteLength`, `allocatedRatio`, `sha256`, `runtimeRssDeltaBytes`, `extensionHeapDeltaBytes`, `progressMonotonic`, `importId`, `taskId`, `productId`, `terminalSequence`, `cleanupCount`, `residue`, `keyboardOracles`, `ariaOracles`, `viewportOracles` |

## State of every case

| case | state | why |
|---|---|---|
| B27 | **PENDING_VISIBLE_RUN** | the executor and the offline proofs are done; the real browser run needs the single approved session |
| B29 | **PENDING_VISIBLE_RUN** | the executor, the asset generation and the offline proofs are done; the asset needs the approved session |
| B30 | **PENDING_VISIBLE_RUN** | the executor, the asset generation and the offline proofs are done; the asset needs the approved session |

**None of them is reported as passing.** The offline tests prove the ORDER of the
real user path and the REDUCTION of the receipt; they do not and cannot prove
the real browser behaviour.
