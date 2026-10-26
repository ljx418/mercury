# Stage A Route A contract candidate: one task across UI surfaces

Date: 2026-10-12. Status: **Route A approved; implementation NO-GO after
independent risk review (see `stage-a-route-a-risk-stop-2026-10-12.md`).**
Historical same-source arbitration evidence is recorded in
`stage-a-route-a-implementation-audit.md`, but full Stage A exit is pending.
User additionally requires atomic, idempotent management
across page tabs, sidebar and Runtime for the same exact source identity.
This file extends the risk stop
in `stage-a-cross-surface-risk-stop.md`.

## Scope and current facts

The in-page floating Navia and standalone side panel are two independent
React documents. Each currently creates a random `media_task_*` ID.
`MediaAcquisitionCoordinator.create()` deduplicates only an identical task ID,
and `MediaTaskStore` can contain multiple tasks for one `sourceIdentity`.
`acquire_input()` releases its lock while the external acquirer runs, so an
accidental replay of `/execute` before `_inputs[task_id]` is set can also run
the acquirer twice. Both documents may independently request product
materialization after observing the same successful transcript.

The reproduced double-start initiated from
`sidepanel.html?naviaInPage=1` and `sidepanel.html` on the same BVID. A
single-container run passing is not sufficient evidence. The contract must be
portal-neutral: arbitrate on exact `sourceIdentity`, not a Bilibili URL
substring. Adapter and consent policy ID/revision are admission checks, not
extra key dimensions that would permit two active tasks for one source.

## Proposed protocol

1. Add a versioned Runtime `resolve` operation for an authorized media
   acquisition request. Under one coordinator lock, it returns `created` with
   the caller's task ID or `attached` with the authoritative existing task ID.
   If an active same-source task has a different adapter/policy revision,
   refuse attachment and require revocation/cancellation plus cleanup before
   creating a replacement. Revocation must invalidate the old task.
   Request fields stay limited to the existing frozen set. Response includes
   `disposition`, `task`, and `authoritativeTaskId`, never Cookie, lease bytes,
   raw media path, or another surface's private data.
2. Only `created` may call `/execute`. `attached` subscribes to the returned
   task's projection and must not call execute. The browser releases any
   unused task-scoped credential lease created before attachment. Both views
   display the same task/revision and derive the top status from it.
3. The old create endpoint either delegates to the same single-flight guard
   or rejects an active same-source collision with a typed 409. It must not
   silently create a second task. Historical sealed requests remain readable;
   no old evidence or product record is rewritten.
4. `/execute` rejects a second call while the task is `acquiring`, or returns
   a typed already-running result that instructs the caller to poll. It never
   starts the external acquirer twice for one task. A replay after an already
   committed input may return the prior public receipt.
5. Product materialization is single-flight by authoritative task ID. A
   second caller attaches to the in-flight result; it does not download or
   synthesize again. Failure is visible to both surfaces, and one caller's
   cancellation advances the shared task to a terminal state.
6. On Runtime restart, an incomplete in-memory acquisition may be abandoned
   only with an explicit recoverable state; a completed product is recovered
   from `MediaTaskStore`. If a ready product already exists when resolve runs,
   the endpoint must return a distinct `published` disposition or fail closed
   and require the existing product lookup. It cannot create a new task while
   silently presenting the previous task as current.

## Compatibility and implementation boundaries

- The current `MediaAcquisitionClient.startConfigured()` assumes `create`
  returns its own task ID, then always executes. This must become an explicit
  union of `created | attached | published`, with no nullable fields used as
  implicit disposition. The side panel can then set its authority to the
  returned ID before polling.
- The ephemeral credential path also needs attachment handling. It may not
  lend a second surface's lease to the first task; unused leases are revoked.
- No background service-worker lease is trusted as the source of truth; MV3
  worker suspension cannot defeat Runtime arbitration.
- The Runtime is a single local process in the intended topology. Multiple
  worker processes require a database-backed lock or explicit startup denial;
  an in-memory mutex is not sufficient across processes.
- Error cases need typed codes and non-secret, user-visible recovery. No
  generic green status may be shown if task identity disagrees across the
  acquisition, transcript, product and UI projections.

## Acceptance matrix before Stage A exit

| Case | Required observation |
|---|---|
| Simultaneous in-page + side panel | One `created`, one `attached`; identical task ID and revision in both; exactly one external acquisition and one product materialization |
| Slow execute replay | Second execute cannot call subtitle/download/ASR a second time; polling converges on the first result |
| Surface reload / close | Remaining view stays attached; no new task, no stale ready claim |
| Manual retry after terminal failure | New task ID only after the old task is terminal and its cleanup barrier is complete |
| Cancellation from either view | Both show same cancelled/failed terminal; no pending spinner or published result from a cancelled revision |
| Different CID/part, adapter or consent revision | No cross-source or cross-policy attachment; same-source policy change cancels and cleans old work before replacement |
| Runtime restart | Existing published task restores; incomplete work is explicitly recoverable or failed, never silently counted as ready |
| Secret boundary | Public request/response/log/package contain no Cookie, task lease, audio/video bytes or private paths |

Run at least five fresh real Chrome races on one BVID and a separate negative
matrix. The pregranted *temporary* test extension can verify post-consent
coordination; it cannot certify Chrome's first-use permission popup.

Internal design review: Fatal=0, Major=2 **open** until implementation and
independent real-browser audit: (1) cross-surface single-flight contract,
(2) restart/terminal semantics. User authorization permits Route A code edits,
but is not an implementation exit decision.
