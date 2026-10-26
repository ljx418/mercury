# WP-B AC1 — the crash window is closed

Every kill point is a REAL `os._exit(137)` inside a production transition, and
every recovery is a GENUINELY NEW process that reads only the durable SQLite
and the filesystem.

| kill point | kill rc | durable phase before | recovery | real cleanups | task | residual |
|---|---|---|---|---|---|---|
| `after_t1` | 137 | `video_durable` | `waiting:video_durable` | 0 | `created` | 0 |
| `after_t2` | 137 | `inputs_prepared` | `waiting:inputs_prepared` | 0 | `created` | 0 |
| `after_t3` | 137 | `input_bound` | `waiting:input_bound` | 0 | `created` | 0 |
| `after_audio_receipt_before_delete` | 137 | `audio_staged` | `waiting:audio_staged` | 0 | `created` | 0 |
| `after_delete_before_t4` | 137 | `video_deleted` | `waiting:consumers:video_deleted` | 0 | `created` | 0 |
| `after_transcript_terminal` | 137 | `transcript_terminal` | `waiting:consumers:transcript_terminal` | 0 | `created` | 0 |
| `after_visual_terminal` | 137 | `visual_terminal` | `waiting:consumers:visual_terminal` | 0 | `created` | 0 |
| `after_both_consumers` | 137 | `cleaned` | `already_cleaned` | 0 | `created` | 0 |
| `during_cleanup` | 137 | `cleaning` | `released` | 1 | `succeeded` | 0 |

The ninth point kills the process INSIDE the production `coordinator.complete`,
after the durable claim was written and before it was finished. The fresh
process finds the open claim, runs the REAL cleanup exactly once, reaches
`succeeded` and leaves zero residual.

The visual-terminal receipt itself is proved by
`tests/test_wp_b_ac1_visual_terminal_durability.py`: a kill after the visual
product commit and before the barrier receipt is durable, then a fresh
process that observes the existing terminal product, submits the missing
receipt, cleans up exactly once and reaches zero residue — through the
startup reconciliation AND through a fresh `materialize_visual()` call.
