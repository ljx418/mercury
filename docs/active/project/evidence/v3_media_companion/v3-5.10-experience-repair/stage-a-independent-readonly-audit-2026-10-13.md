# V3-5.10 Stage A Independent Read-Only Audit Report

Auditor: Orca worker (task_41dfe39e6981, dispatch ctx_c2add6db1498)
Date: 2026-10-13
Candidate SHA-256 verified: 488a253db554baf8e93087dfec2a555475335a7f84c5d3a180fa756be47fb886 — matches the candidate file.

## 1. Findings (ordered Fatal / Major / Minor)

### FATAL — 1

**F1. The "independent exact-repeat review performed on 2026-10-13" cited by the candidate does not exist in the repository.**
- File/field: `docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-a-combined-exit-audit-candidate-2026-10-13.md`, NJ-10 row and lines 39-40 ("The exact-repeat gate then required three new consecutive unchanged runs") and 70 ("The earlier intermittent Runtime request stall remains retained as a residual reliability risk despite the three-run repeat gate"). The acceptance plan records a prior independent review (Orca run `run_95a580fa2783`, dispatch `ctx_6d7f1a749370`) that returned Stage A NO-GO / Fatal 0 / Major 1 (Runtime stall) — but no follow-up "exact-repeat review" document exists anywhere under `docs/active/project/`. The candidate asserts that downgrading without providing or citing the document.
- Failure scenario: the candidate's NJ-10 closure rests on an unattributed "downgrade from Major to Minor". The reader cannot verify the downgrading reasoning, the exact three-run criteria review, or the exact evidence underpinning it.
- Required remedy: produce (or point to) the missing read-only review document. Until then the candidate cannot claim NJ-10 closed.

### MAJOR — 1

**M1. The candidate is the implementation-session "candidate" itself, not the requested independent read-only audit.**
- File/field: candidate front matter, line 3 ("Status: **candidate for independent read-only audit**"). The candidate text presents the gate decision ("Fatal 0 / Major 0 / Minor 3") and asks the reader for a decision. No separate independent reviewer file is provided for the three-repeat NJ-09/NJ-10 closure (101717864Z + 102458577Z + 102715827Z + 102930405Z). All NJ-01..NJ-08 bounded exit documents are explicitly self-labelled "implementation-session self-check, not an independent Stage A exit audit"; the only independent read-only document covering these bounded exits is `stage-a-route-a-nj03-exit-audit-2026-10-12.md` (NJ-03 only) and the broader `stage-a-combined-independent-readonly-audit-2026-10-12.md` which still concludes Stage A NO-GO.
- Failure scenario: the gate decision would be made without an independent read-only opinion on the four-run NJ-09 evidence, so a Major cannot be objectively ruled out.

- M1.a (related): the four-run NJ-09 evidence is implementation-session. The original 101717864Z run was the first success after six retained 2026-10-13 failures; the three follow-up repeats 102458577Z / 102715827Z / 102930405Z were performed in the same implementation session. Until an independent reviewer inspects the raw JSONs (this audit does that — but it is reading-time, not a separate decision) the candidate cannot claim NJ-09/NJ-10 closed.
- Required remedy: have a separate independent read-only document inspect the three-repeat NJ-09 raw evidence and explicitly state Major=0.

### MINOR — 3

**Mi1. The single-video evidence base does not meet the V3-5.10 six-BVID denominator.**
- The candidate explicitly disclaims this ("single-video negative-journey evidence. It does not prove six-video content quality"), so it is not a Fatal/Major contradiction; the bounded scope is documented. Recorded as Minor because the candidate itself acknowledges the limit at line 51.

**Mi2. The pregranted-in-temporary-extension permission fixture is consistently present and the candidate correctly disclaims native-prompt proof.**
- Every cited JSON (101717864Z, 102458577Z, 102715827Z, 102930405Z) reports `permissionFixture: pregranted_in_temporary_extension_only` and `nativePromptClicked: False`. The candidate text at line 48-49 correctly states these runs do not prove the native first-use Chrome permission prompt. No widening detected.

**Mi3. Axe evidence is bounded to zero serious/critical findings on the four tested widths.**
- The candidate (line 53-55) correctly limits this to the tested states and widths and disclaims full WCAG. No broadening detected.

(Implementation-session residuals the candidate already records: single-video denominator, pregranted permission fixture, intermittent Runtime stall. The candidate correctly records all three as Minor.)

## 2. NJ-01..NJ-10 Table

| ID | Decision | Evidence | Subfield corroboration |
|---|---|---|---|
| NJ-01 | bounded PASS (implementation-session self-check) | `first-use-runs/20261012T133444873Z-cancel-result.json` SHA `47c2eac7…91dcd1091`; doc `stage-a-nj01-transcript-preview-exit-2026-10-12.md` | `previewCheck.standalone.label="转写预览 · 不是全片概览"`, `count=3, timestampedCount=3, nonemptyCount=3`; `embeddedTaskId == media_task_af697fbbaa404588913143bb1a10acc0`; one row in `authorityRows`; cross-surface task ID agreement |
| NJ-02 | bounded PASS (implementation-session self-check) | `first-use-runs/20261012T134703684Z-reconnect-result.json` SHA `75e01fbca…2c3ca395`; doc `stage-a-nj02-reconnect-exit-2026-10-12.md` | `reconnectEvidence.beforeSeconds=32/afterSeconds=33` (no false-zero reset), `progressAgeAfterWait=3` (advances), `hidden.taskId=""` and notice correct; reconnect restores same task `media_task_41be63919f474d07908319c9f09cccfa` |
| NJ-03 | bounded PASS (independent review) | `first-use-runs/20261012T124406632Z-cancel-result.json` SHA `38cc10d33…ea65935`; doc `stage-a-route-a-nj03-exit-audit-2026-10-12.md` (Fatal 0 / Major 0 for NJ-03 only) | single `authorityRows[0]` task `media_task_39c774c2b2934a6497cf39bb3ddc35c6` `cancelled`; private residuals `[]`; two delayed visual requests returned HTTP 409 |
| NJ-04 | bounded PASS (implementation-session self-check) | `first-use-runs/20261012T135152769Z-route-drift-result.json` SHA `4fcd145b…4a1ef8a6`; doc `stage-a-nj04-route-drift-exit-2026-10-12.md` | `routeDriftEvidence.unknownResponse.status=404, taskId=null`; `oldResponse.status=200, state=created, revision=1`; held request did not bleed into new route |
| NJ-05 | bounded PASS (implementation-session self-check) | `first-use-runs/20261012T140323401Z-chapter-recovery-result.json` SHA `fa936623…c10cf36f`; doc `stage-a-nj05-chapter-recovery-exit-2026-10-12.md` | `chapterRecoveryEvidence.after.focusTag="A", meaningfulFocus=true`; alert text "该章节不属于当前视频任务" |
| NJ-06 | bounded PASS (implementation-session self-check) | `first-use-runs/20261012T142302556Z-seek-result.json` SHA `2f8de34c…e046b1b`; doc `stage-a-nj06-seek-exit-2026-10-12.md` | `seekEvidence.matched: outcome="located", deltaMs=0, requestedMs=915580`; `afterClose: outcome="blocked", failureCode="V3_MEDIA_PAGE_IDENTITY_INCOMPLETE", matchingTabsAfterBlocked=0` |
| NJ-07 | bounded PASS (implementation-session) | `first-use-runs/20261012T150728291Z-navigation-result.json` SHA `8e2ea09d…29cc9ff4a` (also reused as reference for NJ-09 sequence) | `evidenceReturnEvidence.restored.hash` returns to outline, `focusKey` bound to originating evidence; `directHashAfterEscape` unchanged |
| NJ-08 | bounded PASS (implementation-session) | same `20261012T150728291Z-navigation-result.json` | `dialogEvidence.initialFocus="media-synthesis-style"`, `wrappedBackward=true`, `escapeClosed=true`, `escapeFocusRestored=true`, `cancelClosed=true`, `cancelFocusRestored=true` |
| NJ-09 | bounded PASS on four states × four widths in one positive run + three unchanged repeats; OPEN for independent sign-off | `20261013T101717864Z-navigation-result.json` SHA `4ec4ad20…7d2877b` and the three repeats 102458577Z / 102715827Z / 102930405Z (SHAs verified) | each run: 4 isolated task IDs (run-scoped, no splicing); `bvid=BV1hMpE6FEXG` across all 4 runs; `permissionFixture=pregranted_in_temporary_extension_only`; `nativePromptClicked=False`; `workspaceNegativeChecks`: evidenceDirect/synthesisDialog/invalidChapter/missingTask × 360/420/768/1280 → all `overflowPx=0`, all `violations=[]`, `distinctSampleColors>0` (nonblank). Six retained 2026-10-13 failures (093529294Z, 093940558Z, 094308234Z, 094741843Z, 100818273Z, 101235219Z) remain in `first-use-runs/`. |
| NJ-10 | OPEN for independent sign-off (see F1 and M1) | candidate reconciliation + retained failure runs; no independent review document present | task/source/revision identities are run-scoped (single row in `authorityRows`, single `taskIds` element each); bounded secret-keyword scan reports zero hits in the four NJ-09 JSONs (no `Bearer`, `cookie=`, `sk-`, `eyJ` JWT patterns); failed runs retained |

Summary of decisions: NJ-01..NJ-08 bounded PASS as implementation-session self-checks (NJ-03 with independent bounded review). NJ-09 bounded PASS for the fixed 4×4 negative-state matrix across one positive run + three repeats, but only via implementation-session evidence. NJ-10 cannot close in this audit because the cited independent exact-repeat review is missing (F1) and no separate independent reviewer has stamped the four-run sequence (M1).

## 3. Severity Counts

| Severity | Count |
|---|---|
| Fatal | 1 |
| Major | 1 |
| Minor | 3 |

## 4. Exact Gate Decision

**Stage A: NO LIMITED PASS as written.** The candidate's own listed three Minors are accepted; the Fatal and the Major remain:

- **F1** cannot be waved away by re-reading the candidate. The candidate references a "independent exact-repeat review performed on 2026-10-13" that does not exist on disk. Required remedy: produce the missing document (or amend the candidate to remove the citation and rely on this audit's own limited inspection), then have a separate reviewer re-stamp.
- **M1** requires a distinct independent read-only document covering the three-repeat NJ-09/NJ-10 closure. This audit inspected the raw JSONs and confirms subfield consistency (see NJ-09/NJ-10 rows above), but it was performed in the same coordinated dispatch as the candidate's preparation and cannot serve as the requested independent sign-off.

Once F1 is resolved (missing review document produced) and a separate independent reviewer explicitly records Major=0 on the four-run NJ-09 sequence and NJ-10 reconciliation, **Stage A LIMITED PASS for this fixed negative-journey scope can be granted**, with all Minors carried explicitly.

**Stage B: detailed planning / contract freeze ONLY — permitted after Stage A LIMITED PASS is granted, contingent on Stage B's own plan, acceptance contract, and preimplementation audit. Implementation remains NO-GO from this candidate alone.** The candidate explicitly does not authorize Stage B implementation; this audit concurs.

## 5. Non-Expansion Boundaries (recap, accepted as written)

- Single-video denominator: BV1hMpE6FEXG only. No claim on the other five frozen BVIDs.
- Pregranted-in-temporary-extension permission fixture; native Chrome first-use prompt is outside this evidence.
- Axe bounded to zero serious/critical at 360/420/768/1280 on the four negative states; no full WCAG conformance claim, no human visual review.
- Public-secret scans prove zero hits in cited artifacts only, not absence of secrets in private memory.
- Split-run evidence acceptable only if each NJ item is independently task-scoped; verified across all four NJ-09 runs (four distinct isolated task IDs, one row in authorityRows each, single taskIds element each).
- Stage B-D, six-video content quality, PX-6, RKM, final V3 are explicitly out of scope.

## 6. Tests Not Run

- No product code executed.
- No pytest, Runtime, Chrome, audio, network providers, old generators, or validators run.
- No file edited.
- This audit is strictly read-only via `sha256sum`, `Read`, `python3` stdlib parsing, `git status`, `git log`.

## 7. Required Remedies Before Stage A Can Close

1. Produce (or link to) the missing independent exact-repeat review document that the candidate cites as having "downgraded the prior intermittent Runtime stall from Major to Minor". If no such document exists, amend the candidate text to remove that citation and explicitly request the new review as the next gate. (Resolves F1.)
2. Have a separate independent read-only reviewer sign off on the four NJ-09 runs (101717864Z + 102458577Z + 102715827Z + 102930405Z) and the NJ-10 reconciliation in a new file. (Resolves M1.)
3. Once 1 and 2 are satisfied, Stage A LIMITED PASS can be granted for this fixed negative-journey scope, with the three Minors carried.
4. Stage B implementation remains NO-GO; only Stage B detailed planning and contract freeze may be authorized, contingent on Stage B's own plan, acceptance contract, and preimplementation audit.
