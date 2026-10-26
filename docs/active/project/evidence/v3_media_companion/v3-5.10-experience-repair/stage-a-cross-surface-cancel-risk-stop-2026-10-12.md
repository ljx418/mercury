# Stage A cross-surface cancellation risk stop

Date: 2026-10-12. **STOP / USER CONFIRMATION REQUIRED** before product-code
repair. Full Stage A NO-GO; Stage B-D NO-GO. This is not a completed
acceptance run.

## Real-browser failure

In isolated real Chrome on `BV1hMpE6FEXG`, the in-page Chat, standalone
Chat and Workspace were opened on one fresh source task. The visual
materialization request was held after real transcription. The visible
cancel action was clicked, then the held request was released. The
standalone Chat reached `cancelled`, but Workspace did not reach that state
within 20 seconds. Diagnostic for task
`media_task_01dc0674af594c268ee41e6f87b593eb`:

| Surface/store | Observed state |
|---|---|
| `media_source_authority` | `cancelled` |
| `media_tasks` outline store | No row |
| Workspace | Connected, same task ID, `succeeded`, says outline not yet published |
| Embedded Chat progress | `succeeded` |

The first attempt also failed on Workspace terminal state. The second
attempt added diagnostics and reproduced the discrepancy; neither is
sealed as a PASS. The test runner cleaned its isolated Chrome, Runtime,
database and media scratch after failure. Earlier single-surface cancel
evidence remains valid for that narrower path but cannot close this one.

## Root cause and options

The Workspace 404 fallback currently reads the raw acquisition task.
Acquisition `succeeded` means input was acquired; the later source
authority can still be cancelled. The existing `getMediaTranscriptProjection`
read model merges acquisition with `media_source_authority`, and would
report `cancelled`. The Chat hook stops polling whenever its projection
sets `terminal=true`; `succeeded` can still have `canCancel=true`, so an
already-open Chat misses a later cross-surface cancellation.

| Route | Change | Benefit | Cost/risk |
|---|---|---|---|
| A (recommended) | Workspace uses the existing authoritative transcript projection during the outline handoff; Chat keeps polling while `state=succeeded && canCancel=true` and stops after publish/cancel. | Same task/state across surfaces; no new API, contract or persistence migration. | Focused hook/Workspace tests and a new isolated real-Chrome cancel run required. |
| B | Broadcast cancellation only through extension windows. | Less Runtime read traffic. | Misses reload/disconnected tabs and violates Runtime source authority; rejected as false-green-prone. |
| C | Make no product change; retain fail-closed Stage A NO-GO. | No implementation risk now. | Cross-page cancellation remains visibly wrong. |

User approved limited Route A on 2026-10-12. This authorizes only the two
read-path changes, focused regression tests, and a new isolated real-Chrome
NJ-03 run. It does not approve Stage B-D or relax the fixed denominator.
The failed runs remain failed and are not inputs to a new positive run.
