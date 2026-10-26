# The case-to-real-oracle map

| case | the real oracle | where it is proved | state |
|---|---|---|---|
| **B27** | the REAL XHR is aborted AFTER the identity transition; the REAL Runtime DELETE is observed; the public status converges to a cancelled terminal with an increasing sequence; the old import does not attach to the new identity; no storage or UI residue | `cases/b27.mjs`; the abort is read with `waitForUploadAbort` AFTER `triggerIdentityChange` | **PENDING_VISIBLE_RUN** |
| **B29** | exactly one Extension PUT; multiple, monotonic progress samples ending at the exact asset bytes; `ready`; strict ids; a real `image/png` thumbnail fetched with the actual evidence id; the cleanup count and the residue from the observation | `cases/b29.mjs`; the thumbnail is fetched over `/v1/media/tasks/{taskId}/evidence/{evidenceId}/thumbnail` | **PENDING_VISIBLE_RUN** |
| **B30** | the same, plus the PEAK Runtime RSS delta and the PEAK Side Panel heap delta sampled THROUGHOUT, and the real keyboard / hit-test / live-region / layout oracles | `cases/b30.mjs`; the peak comes from `peakResources()` over every sample | **PENDING_VISIBLE_RUN** |

**None of the three is reported as passing.** The offline tests prove the
COMPOSITION of each oracle — the order of the actions, the reduction of the
receipt, the refusal of a fabricated value — and they cannot prove the real
browser behaviour, which is exactly what the single approved session is for.

## The facts the oracles read, and where each comes from

| fact | the source | the reader |
|---|---|---|
| the import id, the task id, the state, the sequence | the public Runtime status the client already reads | the client records it passively |
| the XHR lifecycle and the progress samples | the client's own XHR callbacks | the client records it passively |
| the identity generation | the product's own media identity | the card increments it on a real switch |
| the maximum writer slice | the SERVER's own writer | the Runtime's E2E-only channel |
| the cleanup claim count | the barrier's own claim | the Runtime's E2E-only channel |
| the source and sandbox residue | the owned roots | the Runtime's E2E-only channel |
| the product and the thumbnail | the PUBLIC outline route and the PUBLIC thumbnail route | the harness |
| the Runtime RSS and the Side Panel heap | the owned Runtime process and the CDP measurement | the harness, sampled throughout |
| the accessibility facts | the REAL Side Panel DOM and a REAL keyboard traversal | the harness |
