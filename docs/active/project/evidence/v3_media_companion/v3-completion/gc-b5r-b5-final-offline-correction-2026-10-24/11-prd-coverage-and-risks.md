# The PRD coverage and the risks

## The PRD coverage

The authority of this batch is
`docs/active/project/design/v3-post-wp-b-completion-rebaseline.md`
(GC-B5R) and the frozen Stage B contract
`stage-b-grounded-comprehension-contract.md`
(SHA-256 `c03491d5f55d3950448de75d20f2c89c1195234da05d17329f3a6f19254f38b8`).

| the requirement of the corrective goal | where it is covered | the state |
|---|---|---|
| FC1: the batch-owned, atomic, one-shot authorization | `03-fc1-authorization-proof.md` | covered, 9 cases |
| FC2: the strict production action ledger, the four separate numbers, the retained-log lower bound | `04-fc2-action-ledger-proof.md` | covered, 12 cases + the integrity receipt |
| FC3: the truthful failure evidence and the monotonic finalization | `05-fc3-failure-evidence-proof.md` | covered, 3 + 7 cases |
| FC4: the exact candidate shape and the temporal enforcement on both routes | `06-fc4-candidate-shape-proof.md` | covered, 18 cases |
| FC5: the real global Provider request cap | `07-fc5-request-cap-proof.md` | covered, 6 cases |
| the case → production-oracle map | `08-case-to-production-oracle-map.md` | covered |
| the changed files and their hashes | `01-changed-file-hashes.json` | covered, 27 files |
| the exact commands and their exits | `02-commands-and-exits.md` | covered |
| the action-ledger integrity receipt | `04-fc2-action-ledger-proof.md` | covered |
| the privacy scan | `09-secret-path-raw-media-scan.json` | covered, zero hits in the evidence |
| the cleanup report | `10-owned-resource-cleanup-audit.md` | covered, zero residue |
| the payload manifest, generated LAST | `PAYLOAD_MANIFEST.sha256` | covered |

## The change-control boundaries of GC-B5R

Section 5 of the rebaseline says that GC-B5R-OFFLINE may change internal
production code, tests and runner assets, but may NOT change public API,
schemas, FailureCode inventories, the fixed BVID denominator, thresholds,
Provider authorization, Origin/auth ordering, the upload policy, the WP-A/B
acceptance records or the relay inventories.

| boundary | the state of this batch |
|---|---|
| public API | **unchanged** — no endpoint, request or response shape changed |
| schemas | **unchanged** — the frozen V2.1 candidate schema and the frozen V2.1 derivative schema are byte-identical |
| FailureCode inventories | **unchanged** — the batch only CONSUMES the frozen codes; it adds none and removes none |
| the fixed BVID denominator | **unchanged** — the six identities and their order still come from the canonical v2 registry and its digest `9c2da2f4…` |
| thresholds | **unchanged** — the aggregate threshold (`requiredSources: 6, completeMinimum: 5, blockedMaximum: 1, limitedMaximum: 0, failedMaximum: 0`) is untouched |
| Provider authorization | **unchanged** — the batch adds a BATCH authorization for the visible RUN; the Provider selection, the Provider id and the endpoint class are untouched |
| Origin/auth ordering | **unchanged** — the runner still issues the companion session and sends the bearer in the same order |
| the upload policy | **unchanged** — the upload counters and their zero gate are untouched |
| the WP-A/B acceptance records | **unchanged** — not read, not written |
| the relay inventories | **unchanged** — the relay scope was not edited and the v11 gate still passes 50/50 and 16/16 |

**A necessary public or security change would have been an immediate stop and
a Codex decision.** None was needed, so the batch closed without one.

## The remaining risks

| # | risk | severity | why it is still open | what would close it |
|---|---|---|---|---|
| R1 | the visible six-video batch has NOT been re-run with the corrected runner | **high** | this batch was strictly offline; the corrected authorization, ledger, evidence and adapter have only been proven against synthetic values and doubles | the separate GC-B5R real-run checkpoint: one consolidated visible session with `--mute-audio`, the product path only, and the new audit set |
| R2 | the historical lower bound of 34 covers the B-5 stage packages only | low | the WP-B visible run attempts have their own accounting and are not part of the B-5 stage ledger | a decision to widen the historical package list, which would need its own double-counting analysis |
| R3 | the request cap is per adapter instance | low | two adapters in one process would have two budgets | a store-level budget, which would be a design change beyond this batch |
| R4 | the chunk extraction shares the global cap | low | with a large evidence catalog the extraction can consume several units before the candidate generation starts | a measured request budget per catalog size, or a separate extraction budget |
| R5 | the atomic authorization depends on an O_EXCL create | low | on a filesystem without atomic exclusive create the guarantee degrades | a stage root on a filesystem with atomic exclusive create (the case here) |
| R6 | the absolute-path detector is a TEXT detector | low | a path encoded in a non-text field would not be caught by it | a structural check on the evidence schema (the evidence is JSON-only in practice) |
| R7 | the frozen Runtime port 17861 is a single point of contention | low | the isolated Runtime must listen there for the extension to reach it | out of scope for this batch |
| R8 | the real-run evidence of the earlier attempts is read by the reconciliation | low | the read is read-only and the packages verify against their manifests | nothing; this is by design |

## The status language

`PASS` is reserved for Codex after the checkpoint. This batch therefore
reports:

```text
GC-B5R B-5 FINAL OFFLINE CORRECTION AWAITING CODEX CHECKPOINT
```

It does **not** claim a B-5 pass, a Stage B pass, a WP pass or a V3 pass, and
it does not enter the next workpack.
