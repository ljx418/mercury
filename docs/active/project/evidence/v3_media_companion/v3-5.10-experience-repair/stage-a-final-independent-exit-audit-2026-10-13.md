# V3-5.10 Stage A final independent exit audit

Date: 2026-10-13. Auditor: Orca worker (this task `task_b307e1598b9e`).
Scope: independent re-decision on `stage-a-combined-exit-audit-candidate-2026-10-13.md`
(candidate SHA-256 `1db18e743f11fc4e6eb4f7f3abb2a7f61bed51574c865f52a4ec9de5399b9aa6`),
after the previously missing `stage-a-nj10-exact-repeat-independent-review-2026-10-13.md`
(SHA-256 `4d75fa4b69b22093f03898fded36c1627411a8cfb57ea7bd0689b2d8d1326ab9`)
and the prior `stage-a-independent-readonly-audit-2026-10-13.md`
(SHA-256 `15aa206d6ecabb27fb8527ae50c1806dad4aa416f6b8fc2c1ab16b1001fc4110`)
are both on disk. This audit is read-only: no source, plan, candidate, raw JSON,
prior audit, validator, Runtime, Chrome, audio or network provider was modified
or executed. SHA values were recomputed with `sha256sum`; subfield inspection
used the Python 3 stdlib `json` and `re` modules. Boundaries respected: one
BVID (`BV1hMpE6FEXG`), temporary pregranted extension is not a native prompt,
Axe evidence is bounded, no Stage B implementation, no final V3.

## 1. Findings

### FATAL — 0

No fatal defect observed after the missing-record gap (F1 in the 2026-10-13
independent audit) was closed by the persisted nj10 exact-repeat review. The
nj10 record's provenance limitation is acknowledged (added from the prior
run/dispatch metadata) and was independently verified against raw JSON
below; it is treated as a disclosed archival limitation, not automatic proof.

### MAJOR — 0

The separate-reviewer gap (M1 in the 2026-10-13 independent audit) is closed
by this audit, which is performed under a different Orca task/dispatch and
explicitly states Major=0 on the four-run NJ-09 sequence and on NJ-10
reconciliation. Raw subfields were recomputed independently and are tabulated
in §2.

### MINOR — 3 (carried verbatim from the candidate; no new Minor added)

**Mi1. Single-video denominator.** Only `BV1hMpE6FEXG` is used. The six-fixed-
BVID Stage B denominator and the remaining five BVIDs are not addressed here;
the candidate text at lines 50-52 already disclaims any six-video claim. No
widening detected in this audit.

**Mi2. Pregranted-in-temporary-extension permission fixture.**
`permissionFixture = "pregranted_in_temporary_extension_only"` and
`nativePromptClicked = false` confirmed in all four NJ-09 raw JSONs
(101717864Z, 102458577Z, 102715827Z, 102930405Z) and in the auxiliary
NJ-07/08 file. The native first-use Chrome permission prompt is not
re-classified. The candidate's disclaimer at lines 46-49 is correct.

**Mi3. Axe evidence bounded to zero serious/critical findings.**
All 64 cells (4 states × 4 widths) across the four NJ-09 runs report
`overflowPx = 0`, `violations = []` and `distinctSampleColors ≥ 123`
(nonblank). This is bounded visual-machine evidence on four widths; it
is not a complete WCAG 2.2 AA claim or a human visual sign-off. The
candidate's disclaimer at lines 53-55 is correct.

(Residual reliability risk: the six retained 2026-10-13 failures, all
`passed=false` with `bvid=BV1hMpE6FEXG` and `mode=fresh`, confirm that
the intermittent Runtime request stall was reproducible earlier in the
day. The three-consecutive-new-run exact-repeat gate downgraded this to
Minor for bounded NJ-09/NJ-10 but does not claim it is impossible. The
candidate correctly retains it as a residual risk.)

## 2. NJ-01..NJ-10 table (subfields recomputed independently)

| ID | Decision | Raw evidence (SHA-256, recomputed) | Subfield corroboration (this audit) |
|---|---|---|---|
| NJ-01 | bounded PASS (impl-session self-check) | `…133444873Z-cancel-result.json` `47c2eac7…91dcd1091` ✓ | `previewCheck.standalone.label="转写预览 · 不是全片概览"`, `count=3`, `timestampedCount=3`, `nonemptyCount=3`; `previewCheck.workspace.hasOutline=false`; one row in `authorityRows`; only task id `media_task_af697fbbaa404588913143bb1a10acc0` |
| NJ-02 | bounded PASS (impl-session self-check) | `…134703684Z-reconnect-result.json` `75e01fbca…2c3ca395` ✓ | `reconnectEvidence.beforeSeconds=32`, `afterSeconds=33`, `progressAgeAfterWait=3` (advances); `hidden.taskId=""` with notice `本机伴侣未连接，历史任务内容已暂时隐藏；连接恢复后将重新读取当前任务。`; `authoritativeRead` returns the same task, `status=200`, `state=succeeded`, `revision=3` |
| NJ-03 | bounded PASS (independent) | `…124406632Z-cancel-result.json` `38cc10d33…ea65935` ✓ | single `authorityRows[0]` task `media_task_39c774c2b2934a6497cf39bb3ddc35c6` `state=cancelled`; `privateResiduals=[]`; both delayed visual responses are HTTP 409 with `failureCode="TASK_INPUT_NOT_READY"`; separate independent judgement in `stage-a-route-a-nj03-exit-audit-2026-10-12.md` |
| NJ-04 | bounded PASS (impl-session self-check) | `…135152769Z-route-drift-result.json` `4fcd145b…4a1ef8a6` ✓ | `routeDriftEvidence.unknownResponse.status=404, taskId=null`; `oldResponse.status=200, state=created, revision=1` for `media_task_881419417823496b8843c6b11674c8c4`; `recovered` route returns to that task; held old read did not bleed into the new route |
| NJ-05 | bounded PASS (impl-session self-check) | `…140323401Z-chapter-recovery-result.json` `fa936623…c10cf36f` ✓ | `chapterRecoveryEvidence.absentChapterId="chapter_deadbeefdeadbeef"`; alert text starts `该章节不属于当前视频任务` (full text `该章节不属于当前视频任务。返回本任务大纲`); `after.focusTag="A"`, `after.meaningfulFocus=true`; same task id preserved |
| NJ-06 | bounded PASS (impl-session self-check) | `…142302556Z-seek-result.json` `2f8de34c…e046b1b` ✓ | `seekEvidence.matched.outcome="located"`, `deltaMs=0`, `requestedMs=915580`; `afterClose.outcome="blocked"`, `failureCode="V3_MEDIA_PAGE_IDENTITY_INCOMPLETE"`, `matchingTabsAfterBlocked=0` |
| NJ-07 | bounded PASS (impl-session) | `…150728291Z-navigation-result.json` `8e2ea09d…29cc9ff4a` ✓ | `evidenceReturnEvidence.restored.hash` returns to the outline, `focusKey` bound to the originating evidence; `directHashAfterEscape` is the same opened hash (no return binding invented for direct-open) |
| NJ-08 | bounded PASS (impl-session) | same `…150728291Z-navigation-result.json` | `dialogEvidence.initialFocus="media-synthesis-style"`, `wrappedBackward=true`, `escapeClosed=true`, `escapeFocusRestored=true`, `cancelClosed=true`, `cancelFocusRestored=true` |
| NJ-09 | bounded PASS for the four-state × four-width matrix across one positive run + three fresh repeats (Major=0, separate independent reviewer) | `…101717864Z` `4ec4ad20…7d2877b` ✓ and `…102458577Z` `9d9babd3…16b52b459` ✓, `…102715827Z` `2bf441e8…344ce6d24` ✓, `…102930405Z` `9071b2d2…d224f1cb2` ✓ | All four runs: `bvid="BV1hMpE6FEXG"`; `permissionFixture="pregranted_in_temporary_extension_only"`; `nativePromptClicked=false`; exactly one row in `authorityRows`; `taskIds` length 1; **four distinct task ids** across the four runs (no cross-run splicing) — `media_task_fa72cbae16614f88923a7b34b8fb5eb8` / `media_task_b8603abea7014605acfcdd9906c30fe1` / `media_task_7b2766fee6cb4c388054f40161494be0` / `media_task_dd3a605cbc7f429ba6fe9eea3a1ea112`. `workspaceNegativeChecks` for every run covers `evidenceDirect`, `synthesisDialog`, `invalidChapter`, `missingTask` × `360/420/768/1280` → 64 measurements per run, every one `overflowPx=0`, `violations=[]`, `distinctSampleColors≥123` (nonblank). Six retained 2026-10-13 failures (093529294Z, 093940558Z, 094308234Z, 094741843Z, 100818273Z, 101235219Z) still present in `first-use-runs/` with `passed=false`, `bvid=BV1hMpE6FEXG`, `mode=fresh`, not relabelled, not deleted. Bounded secret scan (Cookie, Bearer, `sk-`, `eyJ`) returns zero hits on the four NJ-09 JSONs |
| NJ-10 | PASS (Major=0, separate independent reviewer) | reconciliation + retained failure runs + `stage-a-nj10-exact-repeat-independent-review-2026-10-13.md` (SHA verified) | The nj10 exact-repeat record's run-task-SHA table matches the recomputed SHAs and the recomputed task ids; its provenance limitation (archival from prior run/dispatch) is disclosed in the record itself and verified here by recomputation. No cross-task content splicing detected (each NJ item binds to its own `authorityRows` row and its own `taskIds` element). No public secret hits. Failed runs retained |

Summary: NJ-01..NJ-08 bounded PASS as implementation-session self-checks
(NJ-03 also independently reviewed). NJ-09 bounded PASS for the 4×4
negative-state matrix across one positive run + three fresh repeats, with
independent re-confirmation of subfield consistency and no cross-task splice.
NJ-10 PASS after the persisted nj10 exact-repeat record is independently
verified. The implementation-session and the bounded-review judgements are
preserved as written; this audit does not widen scope.

## 3. Severity counts

| Severity | Count |
|---|---|
| Fatal | 0 |
| Major | 0 |
| Minor | 3 |

## 4. Exact gate decision

**Stage A LIMITED PASS for this fixed negative-journey scope is granted.**
Fatal=0, Major=0. The three Minors (single-video denominator, pregranted
extension permission fixture, bounded Axe evidence) are carried explicitly
and recorded as scope limits, not defects. The intermittent Runtime stall
is retained as a residual reliability risk and is not claimed impossible.

Stage B: **detailed planning and contract freeze ONLY is permitted.**
Stage B implementation remains NO-GO from this audit alone; it requires
Stage B's own plan, acceptance contract, and preimplementation audit. No
final V3 acceptance or human gate is granted.

## 5. Resolved gaps from the prior independent audit (2026-10-13)

- **F1 (resolved):** the missing nj10 exact-repeat review
  `stage-a-nj10-exact-repeat-independent-review-2026-10-13.md` is now on
  disk (SHA verified). Its claimed SHAs and task ids match recomputed
  values. Its post-hoc archival provenance is disclosed in the record
  itself and was not relied on without recomputation.
- **M1 (resolved):** a separate reviewer (this audit, different Orca
  task/dispatch) explicitly states Major=0 on the four NJ-09 runs and on
  the NJ-10 reconciliation, after independent recomputation of SHA and
  raw subfields.

## 6. Non-expansion boundaries (recap, verified)

- One BVID only: `BV1hMpE6FEXG`. No claim on the other five frozen BVIDs.
- Pregranted-in-temporary-extension permission fixture; native first-use
  prompt is outside this evidence.
- Axe bounded to zero serious/critical at 360/420/768/1280 on the four
  newly-touched states; not a complete WCAG conformance claim, no human
  visual review.
- Public secret scans report zero hits in cited artifacts only, not
  absence of secrets in private memory.
- Split-run evidence is acceptable only if each NJ item is independently
  task-scoped; verified — every NJ-09 run has a single `authorityRows`
  row and a single-element `taskIds` list, and the four NJ-09 runs use
  four distinct task ids.
- Stage B-D, six-video content quality, PX-6, RKM, and final V3 are
  explicitly out of scope.

## 7. Tests not run

- No product code executed.
- No pytest, Runtime, Chrome, audio, network provider, old generator or
  validator run.
- No source file, plan, candidate, raw JSON, prior audit, or seed
  configuration was edited. Only one new audit output file was written:
  this document.
- Verification used `sha256sum`, `ls`, `git status`, `git log`, `git
  diff --stat`, and Python 3 stdlib `json`/`re` parsing.

## 8. What remains for Stage B and onward

- Stage B may proceed to detailed planning and contract freeze only,
  based on the V3-5.10 plan's Stage B exit contract. Six-BVID content
  evidence must be collected against the fixed denominator before any
  Stage B implementation audit can be recorded.
- The intermittent Runtime request stall remains a recorded reliability
  risk; any Stage B instrumentation should not lower the 20-second
  request wait or the four-width denominator.
- The temporary-extension permission fixture must remain pregranted
  for the dedicated first-use prompt evidence (separate file) and must
  not be silently re-classified as a native prompt pass.
