# The PRD coverage and the risks

## The PRD coverage

The authority of this batch is
`docs/active/project/design/v3-post-wp-b-completion-rebaseline.md`
(GC-B5R), the frozen Stage B contract
`stage-b-grounded-comprehension-contract.md`
(SHA-256 `c03491d5f55d3950448de75d20f2c89c1195234da05d17329f3a6f19254f38b8`)
and the Codex review of the runner-closure batch
(`gc-b5r-b5-runner-closure-codex-review-2026-10-24/00-codex-review.md`).

| the requirement of the corrective goal | where it is covered | the state |
|---|---|---|
| CI1: the processAuditBefore / processAuditAfter → source-row mapping | `03-ci1-process-leak-proof.md` | covered |
| CI1: a descendant that survives its source boundary is a leak, even when it exits later | `03-ci1-process-leak-proof.md` | covered |
| CI1: the sighting is preserved in the candidate summary and the aggregate/process exit is non-zero | `03-ci1-process-leak-proof.md` | covered |
| CI1: the batch stops after the first owned leak and cleans only owned descendants | `03-ci1-process-leak-proof.md` | covered |
| CI1: an unrelated process is never counted, signalled or terminated | `03-ci1-process-leak-proof.md` | covered |
| CI1: the process-level negative case | `03-ci1-process-leak-proof.md` | covered |
| CI2: `receipt.json` is parsed; the presence alone is not evidence | `04-ci2-publication-accounting-proof.md` | covered |
| CI2: the nested publication with the complete frozen V2.1 receipt identity and its cross-bindings | `04-ci2-publication-accounting-proof.md` | covered |
| CI2: the candidate ledger totals equal the per-source attempted facts | `04-ci2-publication-accounting-proof.md` | covered |
| CI2: the permitted pre-synthesis blocked case is explicit | `04-ci2-publication-accounting-proof.md` | covered |
| CI2: every positive stub carries real contract-shaped publication facts | `04-ci2-publication-accounting-proof.md` | covered |
| CI2: the process-exit negatives | `06-negative-process-exits.md` | covered, 8 cases |
| the defensive typo in `mergeMachineReceipt()` | `04-ci2-publication-accounting-proof.md` | covered |
| `isRealPublication()` strengthened to the full internal shape | `04-ci2-publication-accounting-proof.md` | covered |
| the case → production-oracle map | `05-case-to-production-oracle-map.md` | covered |
| the changed files and their hashes | `01-changed-file-hashes.json` | covered: 50 files of the final source set, 10 modified, 1 new, 39 carried, 0 generated |
| the exact commands and their exits | `02-commands-and-exits.md` | covered |
| the negative receipts | `06-negative-process-exits.md` | covered |
| the privacy scan | `07-secret-path-raw-media-scan.json` | covered: zero hits in the evidence |
| the cleanup audit | `08-owned-resource-cleanup-audit.md` | covered: zero residue |
| the payload manifest, generated LAST | `PAYLOAD_MANIFEST.sha256` | covered |

## The change-control boundaries of GC-B5R

| boundary | the state of this batch |
|---|---|
| public API | **unchanged** — no endpoint, request or response shape changed; the mirror is an existing internal evidence file |
| schemas | **unchanged** — the frozen V2.1 candidate schema and the frozen V2.1 derivative schema are byte-identical |
| FailureCode inventories | **unchanged** — the batch CONSUMES the frozen codes and adds none. The new aggregate codes belong to the INTERNAL evaluator |
| the fixed BVID denominator | **unchanged** |
| thresholds | **unchanged** — the positive threshold is untouched |
| Provider authorization | **unchanged** |
| Origin/auth ordering | **unchanged** |
| the upload policy | **unchanged** — the hard-zero counters are now also checked in the publication and in the mirror |
| the WP-A/B acceptance records | **unchanged** |
| the relay inventories | **unchanged** — the v11 gate still passes 50/50 and 16/16 |

**A necessary public or security change would have been an immediate stop
and a Codex decision.** None was needed.

## The remaining risks

| # | risk | severity | why it is still open | what would close it |
|---|---|---|---|---|
| R1 | the visible six-video batch has NOT been re-run with the corrected runner | **high** | this batch is strictly offline; the corrected aggregate, the latched leak audit and the publication checks are proven against synthetic values and doubles | the separate GC-B5R real-run checkpoint: one consolidated visible session with `--mute-audio`, the product path only, and the new audit set |
| R2 | the publication requirements apply to a `complete` source only | low | a `blocked`, `limited` or `failed` source publishes nothing and is judged by its attempted facts; it can never make the candidate positive anyway | a rule for the other dispositions, if a future stage needs them |
| R3 | the ownership tracker samples the process tree every 150 ms | low | a descendant that is created AND exits inside one sampling window is never recorded | a process-events based tracker |
| R4 | the ownership tracker is Linux-only | low | on another platform it finds no descendants and reports nothing rather than guessing | a platform-specific implementation |
| R5 | the ledger reconciliation compares the CANDIDATE totals of the whole run | low | a source that crashed before writing its receipt leaves ledger events without a receipt, and the sum mismatches — the fail-closed direction | nothing; it is the intended behaviour |
| R6 | the kill is a SIGKILL of the recorded pids | low | a pid recycled between the sighting and the signal could in principle be hit; the window is milliseconds | re-reading the process identity before the signal |
| R7 | the aggregate does not recompute the digests of the derivative | low | it checks that the digests the runner recorded are well formed and that the mirror and the machine receipt agree | a re-hash of the published derivative in the aggregate (it would need the artifact, not only its digest) |
| R8 | the historical lower bound of 34 covers the B-5 stage packages only | low | the WP-B visible run attempts are a different workpack | a decision to widen the historical package list, with its own double-counting analysis |

## The status language

`PASS` is reserved for Codex after the checkpoint. This batch therefore
reports:

```text
GC-B5R B-5 AGGREGATE INTEGRITY CORRECTION AWAITING CODEX CHECKPOINT
```

It does **not** claim a B-5 pass, a Stage B pass, a WP pass or a V3 pass,
and it does not enter B-6.
