# V3-5.10 Stage A combined exit audit candidate

Date: 2026-10-13. Status: **candidate for independent read-only audit**.
This document reconciles the fixed NJ-01..NJ-10 denominator. It does not
itself grant Stage A PASS, Stage B implementation, V3 completion, or human
acceptance. The independent reviewer must inspect the referenced raw evidence.

## Fixed-scope decision requested

Decide whether the collected evidence closes Stage A for the tested negative
journeys with Fatal 0 / Major 0. A limited Stage A exit may authorize **Stage B
detailed planning and contract freeze only**. Stage B implementation remains
NO-GO until its own plan, acceptance contract and preimplementation audit are
complete.

## NJ-01..NJ-10 evidence reconciliation

| ID | Primary raw evidence and SHA-256 | Candidate result and boundary |
|---|---|---|
| NJ-01 | `first-use-runs/20261012T133444873Z-cancel-result.json` / `47c2eac7ee6cd31708e4f0a28b236807f82f7c860601d7fbd036c9f19dcd1091` | Both Chat surfaces show a nonempty timestamped transcript preview labelled as not a whole-video brief; Workspace has no outline. Bounded self-check: `stage-a-nj01-transcript-preview-exit-2026-10-12.md`. |
| NJ-02 | `first-use-runs/20261012T134703684Z-reconnect-result.json` / `75e01fbca940407b0b936648156e5b74385430d1c0052b0caae8ce232c3ca395` | Authoritative elapsed/progress survives reload; disconnect hides task content; reconnect rereads the same task/revision. Bounded self-check: `stage-a-nj02-reconnect-exit-2026-10-12.md`. |
| NJ-03 | `first-use-runs/20261012T124406632Z-cancel-result.json` / `38cc10d331ad5122de8f587af9258f56d6916bf1b5627ea6febdabcb4ea65935` | Runtime, embedded Chat, standalone Chat and Workspace converge on cancelled; no stale outline or private task residue; late materializer cannot revive the task. Bounded independent review: `stage-a-route-a-nj03-exit-audit-2026-10-12.md`, Fatal 0 / Major 0 for NJ-03 only. |
| NJ-04 | `first-use-runs/20261012T135152769Z-route-drift-result.json` / `4fcd145b4775045ab26cf6b5dc973f215182cce8f274d3d442b9b93d4a1ef8a6` | A delayed old-task read cannot populate a different task route; the missing task remains an error. Bounded self-check: `stage-a-nj04-route-drift-exit-2026-10-12.md`. |
| NJ-05 | `first-use-runs/20261012T140323401Z-chapter-recovery-result.json` / `fa93662370ada4b91f136cad26329a6f379b983aced1af7330881598c10cf36f` | Missing/mismatched chapter route shows an error; recovery returns to a valid task route and restores meaningful focus. Bounded self-check: `stage-a-nj05-chapter-recovery-exit-2026-10-12.md`. |
| NJ-06 | `first-use-runs/20261012T142302556Z-seek-result.json` / `2f8de34c54d6843027135f04bff398042f0839f967251252a0b547b80e046b1b` | Matching-tab seek returns a truthful receipt; after that tab closes, seek is blocked and does not target another video. Bounded self-check: `stage-a-nj06-seek-exit-2026-10-12.md`. |
| NJ-07 | `first-use-runs/20261012T150728291Z-navigation-result.json` / `8e2ea09d40d12ccf86241b78460aef4edceea3158bace4185b86c1529cc9ff4a` and the three repeated NJ-09 runs below | Bound evidence returns to the exact chapter/control; direct-open evidence does not invent a return binding. Implementation-session evidence, repeated in the stability sequence. |
| NJ-08 | Same navigation evidence as NJ-07 | Dialog initial focus, forward/backward Tab containment, Escape/cancel closure and trigger focus restoration pass; consent remains explicit. Implementation-session evidence, repeated in the stability sequence. |
| NJ-09 | `20261013T102458577Z-navigation-result.json` / `9d9babd37961768d7974ed916de74a28b3dbc081961125bd555f14416b52b459`; `20261013T102715827Z-navigation-result.json` / `2bf441e8a6299fd1c6ca64ea05a997dda421c8a484a52f196838e31344ce6d24`; `20261013T102930405Z-navigation-result.json` / `9071b2d28a3f72abdb1d5eb3fa03bafb7f8982aec977b93e39203fdf224f1cb2` | Three consecutive fresh isolated muted Chrome runs pass four negative states at 360/420/768/1280 with zero horizontal overflow, zero serious/critical Axe findings, nonblank pixels and state-specific controls. |
| NJ-10 | This reconciliation, all retained failed runs in `first-use-runs/`, and `stage-a-nj10-exact-repeat-independent-review-2026-10-13.md` | Raw task/source/revision identities are run-scoped; successful and failed artifacts are retained; secret-value scans report zero public hits. The independent exact-repeat review downgraded the prior intermittent Runtime stall from Major to Minor for bounded NJ-09/NJ-10, but required this combined review before Stage A can close. |

## Stability and failure history

The first successful NJ-09 run was
`20261013T101717864Z-navigation-result.json` (SHA-256
`4ec4ad2083092d86bde18ebab9b9633922935e4039551078b6e3421b97d2877b`).
Six preceding attempts on 2026-10-13 had timed out on a second
outline/comprehension or missing-task read. They remain in `first-use-runs/`
and were not relabelled or deleted. The exact-repeat gate then required three
new consecutive unchanged runs; all three exited zero. This supports a bounded
stability claim, not proof that a Runtime stall is impossible.

## Non-expansion boundaries

- All cited browser evidence uses real Bilibili page `BV1hMpE6FEXG`, isolated
  Runtime/database/profile/task roots, and explicit `--mute-audio`.
- The temporary test extension used
  `permissionFixture=pregranted_in_temporary_extension_only`; these runs do not
  prove the native first-use Chrome permission prompt. Earlier dedicated prompt
  evidence remains separate and is not reclassified here.
- This is single-video negative-journey evidence. It does not prove six-video
  content quality, provider quality, grounded synthesis, Stage B-D, final V3,
  PX-6, or RKM.
- Axe evidence is limited to zero serious/critical findings on the tested
  states and widths. It is not a complete WCAG conformance claim or human
  visual sign-off.
- Public secret scans do not prove that secrets never existed in private,
  task-scoped memory. They only establish that the inspected public artifacts
  contain no detected API-key, Cookie or bearer-token value.
- Split-run evidence is acceptable only if each NJ item is independently
  task-scoped and no content artifact is spliced across runs. No run is used to
  claim a different task's content authority.

## Candidate severity and gate

Implementation-session candidate: Fatal 0 / Major 0 / Minor 3:

1. The negative-journey denominator is proven on one real Bilibili video.
2. The native first-use permission prompt is outside the repeated NJ-09 run.
3. The earlier intermittent Runtime request stall remains retained as a
   residual reliability risk despite the three-run repeat gate.

The first combined independent audit is retained as
`stage-a-independent-readonly-audit-2026-10-13.md`; it returned Fatal 1 /
Major 1 because the exact-repeat review had not yet been persisted and asked
for a separate reviewer after that repair. This candidate therefore requires a
new independent decision.

Requested independent decision: either (a) limited Stage A PASS and permission
to enter Stage B detailed planning/contract freeze, or (b) a concrete Fatal or
Major gap tied to an NJ requirement and raw observation. Do not authorize
Stage B implementation from this candidate alone.
