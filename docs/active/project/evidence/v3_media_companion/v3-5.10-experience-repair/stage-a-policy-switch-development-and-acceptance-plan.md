# V3-5.10 Stage A: explicit consent-policy switch

Date: 2026-10-12. Status: policy-switch task-authority limited PASS after
post-fix independent review; full Stage A exit pending. User decision:
preserve the prior published result as isolated history;
switch the exact-source authority only after an explicit user confirmation and
new consent. The old result must not be attached or cited as evidence under the
new policy. This closes the policy-revision discrepancy recorded in
`stage-a-route-a-implementation-audit.md`; it does not approve Stage B or V3
visual quality.

## Baseline and user journey

The current `MediaAcquisitionCoordinator.resolve()` rejects a policy revision
conflict with `V3_MEDIA_SOURCE_POLICY_CONFLICT` (409). This is correct for
refusing attachment, but the approved Route A matrix also requires a path to
replace the authority after cleanup. `MediaTaskStore` has one
`media_source_authority` row per exact source, while published products remain
readable by task ID. `latest_for_source()` currently sorts products by update
time rather than requiring the authoritative task; a naive authority swap
could still expose the old product in an automatic source lookup.

User scenario: after Navia's media-consent policy changes, the user opens a
previously analyzed video. Navia explains that the prior result belongs to an
older policy. It does not automatically reuse or delete the result. The user
selects **reanalyze under current permission**; a confirmation names the
affected video and explains that the old result remains in isolated history.
After confirmation, one new task starts. Cancel/close leaves the old result
intact, but no source-default view presents it as current.

## Contract and implementation sequence

1. Freeze an authenticated, `Cache-Control: no-store` explicit-switch
   operation separate from ordinary `resolve`. The request must bind exact
   `sourceIdentity`, expected old task ID and policy tuple, a fresh task ID,
   the registered new adapter/policy tuple, and a literal confirmation. No
   Cookie, lease, media bytes or private path may enter the request/response.
   A stale or replayed request must fail closed or idempotently return the
   *same* new authority, never create another task.
2. For an **active** old task, require the existing cancellation barrier and
   zero unpublished residuals before switching. A live owner, uncertain
   ownership, `cancelling` or `cleanup_incomplete` cannot be replaced. For a
   **published** old task, retain its immutable product/evidence under its
   old task ID and record an audit receipt linking old/new task IDs and both
   policy revisions. Do not relabel the old product as a new-policy result.
3. Transactionally replace the single source-authority row and reserve the
   new task. Any storage failure rolls back both; a sandbox created before
   reservation is cleaned on rollback. Concurrent switch requests from two
   surfaces must yield one new authority and one execution. Ordinary old-policy
   `resolve` remains rejected after the switch.
4. Make automatic source-based product/transcript reads authority-scoped.
   Before the new task publishes, return a typed pending/not-found state for
   that new task, never the old product. Direct historical task-ID reads may
   remain available only with an explicit historical label and policy
   provenance; they must not drive the current source status or evidence list.
5. Show the conflict and confirmation in both in-page and standalone surfaces
   through the shared client. The confirmation must be a deliberate click,
   not triggered by tab restore or polling. After it succeeds, both surfaces
   converge on the new task/revision and display the same progress. A declined
   or closed confirmation leaves the 409 state and old history unchanged.

## Acceptance denominator

| ID | Operation and required result |
|---|---|
| PS-01 | Old published v1 plus current v2: ordinary resolve returns typed 409; no old evidence is attached. |
| PS-02 | Open same source in both UI surfaces: both show policy conflict, no auto-switch and no duplicated task. |
| PS-03 | Explicit confirm once: one new task/authority and audit receipt; old product bytes/hash and revision unchanged. |
| PS-04 | Concurrent/replayed confirm: one winner; same request idempotent or typed conflict; no second acquisition. |
| PS-05 | Missing confirmation, stale old ID/revision, wrong adapter/source or old-policy replay: fail closed and 0 mutations. |
| PS-06 | Active old work: cancel and complete cleanup before replacement; live/unknown owner and cleanup failure block replacement. |
| PS-07 | After switch but before new publication, source-default reads cannot return old outline, transcript, frames or citations. |
| PS-08 | New task publishes: three surfaces and source-default reads agree on its task ID/revision; old task remains explicitly historical. |
| PS-09 | SQLite/sandbox fault injection: no orphan authority/task or private residual; retry is explicit and safe. |
| PS-10 | Real isolated Chrome Bilibili run with two tabs plus standalone panel, explicit confirmation and one new acquisition; four viewports, Axe serious/critical 0, keyboard confirmation and route. |
| PS-11 | Public response/log/evidence scan: 0 Cookie/lease/raw-media/path disclosures. |
| PS-12 | Independent exit audit checks PRD, schema/negative matrix, real Chrome evidence and old sealed-run byte identity; Fatal=0 and Major=0. |

PS-01..PS-09 and PS-11 require automated positive and negative tests. PS-10
requires a fresh real-browser run against one of the frozen BVIDs; a fake
policy-v2 fixture is allowed only to create the revision-conflict condition,
not to replace video data, permissions, acquisition or UI interaction. It
must be called out in the evidence. PS-12 cannot be self-declared from unit
tests. A `degraded` product can prove authority flow, not visual quality.

## Concrete API and storage design

The new operation is `POST /v1/media/acquisitions/replace-policy` with the
existing eight `MediaAcquisitionRequest` fields plus exactly
`expectedPreviousTaskId`, `expectedPreviousConsentPolicyId`,
`expectedPreviousConsentPolicyRevision`, and
`confirmation: "reanalyze_under_current_policy"`. It uses the existing local
bootstrap authentication and extension-origin allowlist. It does not accept
free-form consent text or a client-supplied prior state. `resolve` stays
unchanged and rejects conflicts. The response is `created` with one new task
and an old/new task switch receipt; repeated identical requests may return
that same task with a `replayed` disposition, never execute it again.

`MediaTaskStore.replace_published_source_authority()` must use `BEGIN
IMMEDIATE` with a compare-and-swap on source, old task ID, old policy tuple,
`state=published`, and the registered new policy tuple. In the same
transaction it records the new `media_tasks` row (`created`, revision 1), one
`media_source_policy_switches` audit row (source, old/new IDs, old/new policy
tuples, timestamp, confirmation code), and changes the authority row to the
new task (`active`). The old product and evidence bytes remain unchanged.
Unique new task ID and source/old/new tuple constraints make an exact replay
idempotent; a different concurrent request receives a typed 409. If the
transaction fails, the authority still points at the old published task and
the candidate sandbox is removed. No half-switched source may be visible.

For an active old task, the switch endpoint returns a typed conflict rather
than cancelling it implicitly. The UI offers a separate explicit cancellation
action; after the existing cleanup barrier reaches `cancelled` with zero
private residuals, normal `resolve` can create the new task under current
policy. No operation deletes published product evidence. A published old task
never uses the acquisition cancellation endpoint just to change policy.

Read-path inventory and correction:

- `MediaTaskStore.latest_for_source()` currently chooses the most recently
  updated `media_tasks` row. After switching, it must look up the single
  authority row first and return only that task's aggregate; if the new
  aggregate is not yet published, it must return the new pending task or a
  typed pending/not-found result, never the old outline.
- `MediaAcquisitionCoordinator.latest_for_source()` currently chooses the
  latest in-memory task. It must prefer the authority task ID when a durable
  authority exists; it may not fall back to the old task during startup.
- `MediaTranscriptProjectionService.latest_for_source()` delegates to that
  coordinator. Its task-ID read remains historical, while its source-default
  read follows only the current authority.
- `/v1/media/outline-tasks?sourceIdentity=` and
  `/v1/media/task-projections?sourceIdentity=` must retain bootstrap auth,
  no-store, and typed pending responses. The former's `latest_for_source`
  correction and the latter's coordinator correction provide the isolation.
- Direct `/v1/media/outline-tasks/{taskId}` and historical list entries may
  stay readable as history, but must expose policy provenance and a
  `historical`/`current` distinction before UI display. A direct historical
  task ID cannot update the current-source status card or feed new-task
  citations. Old task deep links need an explicit historical banner.

The extension's confirmation appears only for
`V3_MEDIA_SOURCE_POLICY_CONFLICT`, after a fresh authority read and source
identity match. The confirmation component uses a dialog with visible video
identity, old/new policy revision, historical-retention text, Cancel and
Reanalyze commands. The client sends no Cookie or lease; a task-scoped lease
is obtained only for the new task after successful authority switch. Any
tab/source epoch change discards the dialog result. Failure leaves the
conflict visible and does not fall back to the prior published product.

## Internal risk audit before code

- **Major, source read isolation:** `MediaTaskStore.latest_for_source()` and
  `MediaTranscriptProjectionService.latest_for_source()` must not leak the old
  published result while the new task is pending. The implementation needs a
  complete read-path inventory before editing.
- **Major, atomicity:** current `reserve_source_authority()` can only replace
  `failed/cancelled`; a separate mark-then-resolve sequence has a race and is
  rejected. Use one SQLite transaction with compare-and-swap preconditions.
- **Major, historical provenance:** do not mutate old product state to
  `cancelled`, delete it, or mark it current; the switch receipt and UI must
  distinguish historical from current policy.
- **High-risk UX:** a policy switch alters which previously visible result is
  treated as current. User has chosen explicit confirmation and historical
  retention; implementation must not silently broaden that decision.
- **Out of scope:** Stage B six-video content quality, Stage C frames/graph,
  Stage D exports, V4 knowledge, and final human acceptance remain separate.

## Implementation and recovery addendum

The bounded implementation now has a dedicated Runtime switch endpoint, one
SQLite compare-and-swap with a switch receipt, authority-scoped source reads,
and a visible historical label. The initial real-Chrome run against
`BV1hMpE6FEXG` passed the old/new authority, byte-preservation, three-surface,
four-viewport, Axe, and keyboard-route checks. Evidence:
`first-use-runs/20261012T085037223Z-policy-switch-result.json`. A second run
after the authority-ordering regression fix passed with the same denominator;
see the later policy-switch result in `first-use-runs/`.

One failure window needs explicit handling: the switch transaction may commit
while its HTTP response is lost. The UI must then read the current authority
and acquisition state; it may continue **only** the same current-policy,
same-source `created` task. On reload, that pending task is shown as a
recoverable error with a user retry, not falsely labelled as running. A
network-fault Chrome run that forwards the real POST but drops its response
is required before PS-09 is closed. A restarted Runtime with an interrupted
task still uses the existing owner-liveness and cleanup barrier before any
fresh task. None of these recovery paths may auto-attach the old product.

The preimplementation audit is a design entry gate only. A separate
implementation exit audit, including PRD alignment and the actual run
results, is required before Stage A can be marked passed or Stage B code
can begin.

No code implementation begins until the read-path inventory and API/transaction
contract close these Majors in a substage preimplementation audit. A passing
Stage A switch does not turn the prior `degraded` product into a quality pass.
