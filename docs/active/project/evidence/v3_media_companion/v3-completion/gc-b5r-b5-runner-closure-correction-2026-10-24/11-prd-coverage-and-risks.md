# The PRD coverage and the risks

## The PRD coverage

The authority of this batch is
`docs/active/project/design/v3-post-wp-b-completion-rebaseline.md`
(GC-B5R) and the frozen Stage B contract
`stage-b-grounded-comprehension-contract.md`
(SHA-256 `c03491d5f55d3950448de75d20f2c89c1195234da05d17329f3a6f19254f38b8`).

| the requirement of the corrective goal | where it is covered | the state |
|---|---|---|
| RC1: the child grants are authoritative and one-use | `03-rc1-authorization-proof.md` | covered, 15 cases |
| RC2: the explicit field semantics of the finalizer | `04-rc2-finalizer-semantics-proof.md` | covered, 12 cases + the FC3 re-entry |
| RC3: the actual outbound Provider HTTP attempts | `05-rc3-provider-attempt-accounting-proof.md` | covered, 5 Node + 3 Python cases |
| RC4: the scoped process ownership and the isolated fixtures | `06-rc4-process-ownership-proof.md` | covered, 2 negative cases + the concurrent suite |
| RC5: the privacy detector and the inventory boundary | `07-rc5-privacy-proof.md` | covered, 12 cases + the scan |
| the case → production-oracle map | `08-case-to-production-oracle-map.md` | covered |
| the changed files and their hashes | `01-changed-file-hashes.json` | covered: 49 files of the final source set, 22 modified, 27 carried, 3 removed, 0 generated |
| the exact commands and their exits | `02-commands-and-exits.md` | covered |
| the negative receipts | the proofs of RC1..RC3 | covered |
| the action counts | `00-status-and-scope.md` | covered: every external counter is 0 |
| the privacy scan | `09-secret-path-raw-media-scan.json` | covered: zero hits in the evidence |
| the cleanup report | `10-owned-resource-cleanup-audit.md` | covered: zero residue |
| the payload manifest, generated LAST | `PAYLOAD_MANIFEST.sha256` | covered |

## The change-control boundaries of GC-B5R

Section 5 of the rebaseline says that GC-B5R-OFFLINE may change internal
production code, tests and runner assets, but may NOT change public API,
schemas, FailureCode inventories, the fixed BVID denominator, thresholds,
Provider authorization, Origin/auth ordering, the upload policy, the WP-A/B
acceptance records or the relay inventories.

| boundary | the state of this batch |
|---|---|
| public API | **unchanged** — no endpoint, request or response shape changed. The Provider attempt count travels through the receipt that already existed and through the Runtime's PRIVATE diagnostic |
| schemas | **unchanged** — the frozen V2.1 candidate schema and the frozen V2.1 derivative schema are byte-identical |
| FailureCode inventories | **unchanged** — the batch only CONSUMES the frozen codes; it adds none and removes none |
| the fixed BVID denominator | **unchanged** — the six identities and their order still come from the canonical v2 registry and its digest `9c2da2f4…` |
| thresholds | **unchanged** — the aggregate threshold is untouched |
| Provider authorization | **unchanged** — the Provider selection, the Provider id and the endpoint class are untouched |
| Origin/auth ordering | **unchanged** — the runner still issues the companion session and sends the bearer in the same order |
| the upload policy | **unchanged** — the upload counters and their zero gate are untouched, and a violation is now never erased by the merge |
| the WP-A/B acceptance records | **unchanged** — not read, not written |
| the relay inventories | **unchanged** — the relay scope was not edited and the v11 gate still passes 50/50 and 16/16 |

**A necessary public or security change would have been an immediate stop
and a Codex decision.** None was needed.

## The remaining risks

| # | risk | severity | why it is still open | what would close it |
|---|---|---|---|---|
| R1 | the visible six-video batch has NOT been re-run with the corrected runner | **high** | this batch is strictly offline; the corrected authorization, finalizer, attempt accounting, ownership audit and privacy detector are proven against synthetic values and doubles | the separate GC-B5R real-run checkpoint: one consolidated visible session with `--mute-audio`, the product path only, and the new audit set |
| R2 | the ownership tracker samples the process tree every 150 ms | low | a process that is created AND exits inside one sampling window is not recorded | a longer sampling interval would be worse; a process-events based tracker would close it |
| R3 | the ownership tracker is Linux-only (it reads the Linux process filesystem) | low | on another platform the tracker finds no descendants and the audit reports nothing rather than guessing | a platform-specific implementation |
| R4 | the one-segment path rule reports JavaScript regex literals of a SOURCE file as paths | low | the rule must catch a ONE-SEGMENT path; the runner's EVIDENCE carries no regex literal and the evidence scan is empty | a context-aware detector (a parser) — out of scope |
| R5 | when the Runtime reports nothing, the receipt's attempt count stays `null` and no `providerCall` line is written | low | the runner never invents a count; an unreported attempt set is visible as a missing count | the Runtime always reporting the count (the production service does) |
| R6 | a child grant is one-use, so a retry of the same source needs a fresh authorization | low | the one-use property is the requested security property | nothing; it is the intended trade-off |
| R7 | the terminal precedence keeps a stronger disposition | low | a source that failed and later succeeded in a RETRY keeps the failed disposition | a new candidate run (a new run id), where nothing is combined |
| R8 | the historical lower bound of 34 covers the B-5 stage packages only | low | the WP-B visible run attempts are a different workpack | a decision to widen the historical package list, with its own double-counting analysis |

## The status language

`PASS` is reserved for Codex after the checkpoint. This batch therefore
reports:

```text
GC-B5R B-5 RUNNER CLOSURE CORRECTION AWAITING CODEX CHECKPOINT
```

It does **not** claim a B-5 pass, a Stage B pass, a WP pass or a V3 pass,
and it does not enter B-6.
