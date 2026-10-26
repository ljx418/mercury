# V3-5.10 Stage A combined read-only exit audit

Date: 2026-10-12. Independent subagent read-only review; no files edited
or tests run in that review. **Decision: Stage A NO-GO.** This is an
itemized gate, not an inferred Fatal/Major count. The reviewed products
were `degraded`; none prove Stage B content, Stage C visual quality,
Stage D exports, six-video quality or final V3 acceptance.

| # | Fixed Stage A requirement | Existing evidence | Open exit item |
|---|---|---|---|
| 1 | One source-task authority across embedded Chat, standalone panel, other tab, Workspace and policy revision | Real fresh run `first-use-runs/20261012T073805798Z-first-use-result.json`; policy-switch task-authority-only independent GO in `stage-a-policy-switch-postfix-independent-audit-2026-10-12.md`; old result retained in `first-use-runs/20261012T094651278Z-policy-switch-result.json` | Earlier response-drop failure `first-use-runs/20261012T094222824Z-policy-switch-failure.json` left new authority `created`; tab-epoch cause is not exclusively proven. Combined authority exit not signed. |
| 2 | Authoritative status, elapsed and last progress | `mediaActivity.ts`, Chat activity clock; fresh-run ready transition | Browser reload/reconnect continuity and Chat/Workspace revision agreement not directly asserted. |
| 3 | Clearly labelled, nonempty transcript preview before outline | `MediaTranscriptQuickCard.tsx`; `transcriptPreview=true` recorded in fresh run | Boolean card presence does not prove visible nonempty transcript text at that moment. |
| 4 | Cancel propagates and cleans private data | `first-use-runs/20261012T072550497Z-cancel-result.json`: cancelled authority, `cancelClosed=true`, no private residue | Existing browser probe is single-surface; cancellation in already-open Workspace and second panel not directly proven. |
| 5 | Runtime crash, cleanup and explicit retry | `first-use-runs/20261012T081215141Z-restart-result.json`: private artifact parsed, Runtime SIGKILL, cleanup before retry, distinct task after retry | This is Runtime restart, not Chrome restart or a crash during visual-materializer writing. Do not broaden claim. |
| 6 | Route-safe chapter navigation and invalid-route recovery | One-hash chapter route; real keyboard navigation in `first-use-runs/20261012T105056093Z-first-use-result.json` | Absent/mismatched chapter recovery and focus not yet verified in Chrome. |
| 7 | Honest located/fallback/blocked seek receipts | `MediaJumpbackController.ts` and UI receipt controls | No one real browser run asserts both matching-tab observed seek and missing/wrong-tab blocked seek. |
| 8 | Keyboard and focus return | Roving mindmap tree has bounded independent GO in `stage-a-mindmap-keyboard-development-and-acceptance-plan.md`; unit evidence return tests | Later-chapter evidence return and synthesis dialog focus behavior not yet browser-accepted. |
| 9 | Four viewports and accessibility | `first-use-runs/20261012T105056093Z-first-use-result.json`: 16 pending/overview/outline/mindmap checks at 360/420/768/1280 with zero overflow and zero serious/critical Axe | Automated pixel/DOM signal is not a human visual review. Negative-journey states still need coverage. |
| 10 | No false busy or stale wrong-task content | Same-page `created` to revision-6 outline; Workspace route/disconnect Majors closed in focused independent post-fix review | Cancellation, delayed route response and disconnect/reconnect still have only unit-level or separate evidence, not one combined Chrome negative journey. |

## Required next gate

Execute `stage-a-negative-journey-development-and-acceptance-plan.md`
with genuine Bilibili/Chrome/Runtime paths, preserve failed attempts, and
independently review resulting artifacts against this exact denominator.
No old generator/validator, mock data, weakened Axe threshold, or cross-run
artifact splice can close a missing item. Route A and UX-05 bounded passes
remain intact but do not change the Stage A NO-GO decision.
