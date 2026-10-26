# Stage A: Workspace live task synchronization

Date: 2026-10-12. Status: bounded implementation candidate. Source:
`design/v3-5.10-media-experience-repair-plan.md` Stage A and
`independent-ux-readonly-review.md` UX-02. The full Stage A combined audit
has not produced an itemized exit report and remains NO-GO.

## Scenario and change boundary

A user opens Media Workspace while the current source task is unpublished.
Without reloading, the task may move through created/synthesizing to
ready/degraded, or be cancelled/failed from Chat. Workspace must show that
same task ID and latest revision, then expose its outline only when published.
A Runtime disconnect hides stale task content; reconnect re-reads Runtime.
Changing route/task while a request is in flight cannot paint the old task.

Implementation is limited to `MediaWorkspaceShell`'s task read lifecycle and
focused tests. Reuse existing authenticated `getMediaOutlineTask` and
`getMediaWorkspaceComprehension`; no new public API, persistence format,
permission, or provider call. Poll only while the selected task lacks a
terminal product, with one in-flight request and a bounded cadence. On
terminal state stop polling; on route/disconnect cancel the scheduled poll
and discard late responses. Initial loading may appear once, not on each
poll. A transient read error must be visible and may retry without
presenting stale success.

Real Chrome found an additional lifecycle boundary: acquisition `resolve`
creates the source task before `outline-tasks/{id}` exists. The latter returns
404 until materialization starts. On **only** that typed 404, Workspace must
read the existing authenticated `getMediaAcquisition(id)` endpoint, display
its actual state, and keep the same task ID pending. A second 404 is a real
unknown task, not a fabricated pending state. Failed/cancelled/blocked
acquisition is terminal and visible. Succeeded/degraded acquisition without
an outline still waits for the product handoff and must not claim ready.

## Acceptance and PRD check

| ID | Required operation and result |
|---|---|
| LS-01 | Open an acquisition `created` task before an outline record exists; show real acquisition state, no outline or ready claim before publication. |
| LS-02 | Same task publishes without navigation; Workspace updates task revision/outline, stops polling, Chat and Workspace IDs agree. |
| LS-03 | Same task cancels/fails; visible terminal state, no old outline or infinite spinner. |
| LS-04 | Switch route/task during a delayed response; late old response ignored. |
| LS-05 | Runtime disconnect/reconnect; stale content hidden, then fetched again from authority. |
| LS-06 | Real Chrome same-task Chat+Workspace transition, four widths, keyboard and Axe serious/critical zero. No fixture-only exit. |

The substage is a Stage A status/navigation repair. It does not certify a
whole-video brief, visual frames, graph, six-video quality or V3 final.
No new task may be created merely because Workspace is polling.

## Audit revision after first real-browser failure

First isolated Chrome attempt reached connected Workspace but returned
`Media outline task was not found` for the just-created acquisition ID.
This is a real cross-store handoff, not evidence of a published outline.
Fatal 0; Major 1 (LS-01 cannot pass with outline-only reads). The bounded
read-through described above closes the design gap without changing Runtime
contracts. The failed attempt is retained as a diagnostic and does not count
as E2E acceptance.

Independent read-only review after the first passing run reopened the
candidate with two Major and two Moderate findings. Close by deriving every
rendered task/nav/attribute from the current route and connected state (not
effect timing), and by treating a transient comprehension-read error as a
visible retry, never as a historical result. A genuine typed 404 for an
older comprehension projection may retain the legacy reader. Expand real
Chrome checks to pending and overview states at all four widths; screenshot
byte counts alone are not visual correctness evidence. Re-run focused tests
and independent review before claiming LS-04/05 fully closed.

## Internal preimplementation audit

Fatal 0. Major UX-02 is code-grounded: the existing effect depends only on
`runtimeConnected` and `route?.path` and fetches once. The plan closes the
design ambiguity by tying polling to the selected task and cancelling timers
on route/disconnect. Required negatives are LS-03/04/05, not just the happy
path. No other module implementation directory needs editing. Implementation
can begin within the already approved Stage A scope; its exit remains
unproven until tests and real Chrome evidence are attached.
