# The PRD coverage and the risks

## The PRD coverage

The authority of this batch is
`docs/active/project/design/v3-post-wp-b-completion-rebaseline.md`
(GC-B5R), the frozen Stage B contract
`stage-b-grounded-comprehension-contract.md`
(SHA-256 `c03491d5f55d3950448de75d20f2c89c1195234da05d17329f3a6f19254f38b8`),
the frozen V2.1 schema
(`docs/active/project/contracts/v3_media_grounded_comprehension_v2_1.schema.json`)
and the Codex review
(`gc-b5r-b5-publication-semantic-binding-codex-review-2026-10-24/00-codex-review.md`
with its `01-independent-reproductions.json`).

| the requirement of the corrective goal | where it is covered | the state |
|---|---|---|
| SB1: ONE explicit validator for the complete machine-receipt identity | `03-sb1-machine-identity-proof.md` | covered |
| SB1: the run id, registry digest, order, bvid, task id, task namespace, task revision, source identity, dependency generation and the fresh timestamps are required | the same | covered, eleven fields |
| SB1: no truthy conditional comparisons | the same | covered |
| SB1: the expected row and run identity reach the artifact oracle | the same | covered |
| SB1: the artifact binding is compared exactly, unconditionally | the same | covered |
| SB1: the source identity's portal/adapter/BVID components belong to the frozen row | the same | covered |
| SB1: pure AND real-sequencer negatives for every required field, plus the foreign artifact | the same and `08-negative-process-exits.md` | covered, 11 + 11 + 2 cases |
| SB2: the PRODUCTION mapping is the single rule | `04-sb2-quality-disposition-proof.md` | covered |
| SB2: the four facts must agree | the same | covered |
| SB2: a complete artifact carries an empty `quality.failureCodes` | the same | covered |
| SB2: byte-level and process-level negatives, with the hashes recomputed | the same | covered, 4 + 4 cases |
| SB3: the keyword inventory is structural and taken before the schema is used | `05-sb3-schema-keyword-proof.md` | covered |
| SB3: the annotation keywords are explicitly allowed | the same | covered |
| SB3: every unsupported keyword throws | the same | covered, six placements |
| SB3: the equivalence proof asserts the complete keyword inventory | the same | covered |
| SB3: the representative fixtures are not described as a universal proof | the same | covered |
| SB3: the canonical receipt serialization is constrained to the legal domain and compared byte by byte | the same | covered, ten fixtures |
| SB4: the accepted closures are preserved | `06-sb4-preserved-closures-proof.md` | covered |
| the case → production-oracle map | `07-case-to-production-oracle-map.md` | covered |
| the changed files and their hashes | `01-changed-file-hashes.json` | covered: 58 files of the final source set, 9 modified, 4 new, 45 carried, 0 generated |
| the exact commands and their exits | `02-commands-and-exits.md` | covered |
| the process-level negative receipts | `08-negative-process-exits.md` | covered |
| all-zero external action counters | `00-status-and-scope.md` and `10-owned-resource-cleanup-audit.md` | covered |
| the privacy scan | `09-secret-path-raw-media-scan.json` | covered: zero hits in the evidence |
| the cleanup audit | `10-owned-resource-cleanup-audit.md` | covered: zero residue |
| the remaining risks | this file | covered |
| the handoff | `12-handoff.md` | covered |
| the manifest, generated last and verified with `sha256sum -c` | `PAYLOAD_MANIFEST.sha256` | covered |

## The three independent reproductions of the review

| the reproduction | the state |
|---|---|
| delete `taskRevision` and `sourceIdentity` from all six machine receipts → the aggregate was positive | **closed**: `AGG_MACHINE_IDENTITY_INVALID`; the pure case and the eleven process-level cases |
| one artifact's `quality.status` set to `limited` with the hashes recomputed → the aggregate was positive | **closed**: `AGG_QUALITY_DISPOSITION_MISMATCH`; the pure case asserts that NO artifact failure fired, so the refusal is SEMANTIC |
| `not`, `minProperties` and `exclusiveMinimum` were silently ignored | **closed**: the keyword inventory throws before the schema is cached or used; the three reproduction keywords each have a case |

## The change-control boundaries of GC-B5R

| boundary | the state of this batch |
|---|---|
| public API | **unchanged** |
| schemas | **unchanged** — the frozen V2.1 candidate schema, the frozen V2.1 derivative schema and the frozen Stage B contract are byte-identical. The batch READS the frozen derivative contract |
| FailureCode inventories | **unchanged** — the batch CONSUMES the frozen codes and adds none. The two new aggregate codes belong to the INTERNAL evaluator |
| thresholds | **unchanged** |
| messages | **unchanged** |
| the Provider registry | **unchanged** |
| Origin/auth order | **unchanged** |
| the frozen source denominator | **unchanged** |
| the upload policy | **unchanged** |
| the WP-A/B acceptance records | **unchanged** |
| the relay inventories and fixtures | **unchanged** — the 12 frozen relay hashes match and the relay scope was last modified on 2026-10-20 |
| the historical evidence | **unchanged** |

**A necessary public or security change would have been an immediate stop
and a Codex decision.** None was needed.

## The remaining risks

| # | risk | severity | why it is still open | what would close it |
|---|---|---|---|---|
| R1 | the visible six-video batch has NOT been re-run with the corrected runner | **high** | this batch is strictly offline; the identity, semantic and keyword closures are proven against synthetic values and doubles | the separate GC-B5R real-run checkpoint: one consolidated visible session with `--mute-audio`, the product path only, and the new audit set |
| R2 | the shared JavaScript validator implements the keyword subset of the frozen contract | low | a frozen revision with a new keyword is a HARD FAILURE (the validator throws before it is used), so the contract and the validator must be extended together | extending the validator with the new keyword and re-running the inventory comparison |
| R3 | the representative value fixtures are a sample, not a universal equivalence proof | low | the universal part is the keyword inventory plus the fail-closed behaviour; the sample shows the two validators agree on accept/reject samples | a property-based generator over the frozen domain (out of scope for this batch) |
| R4 | the canonical serialization claim covers the legal frozen receipt domain, not every JSON value | low | a lone surrogate is outside the legal domain (the frozen patterns forbid it) and the two layouts differ there | nothing; the domain is documented and tested |
| R5 | the identity is required for a COMPLETE row only | low | a source that failed before its task existed legitimately has no task id, and it can never make the candidate positive | nothing |
| R6 | the aggregate binds the artifact's quality object to the disposition but does not re-evaluate it | low | the production quality evaluator (the Runtime) owns the quality object and its failure codes | nothing |
| R7 | the ownership tracker samples the process tree every 150 ms and is Linux-only | low | a descendant created AND exited inside one sampling window is never recorded | a process-events based tracker |
| R8 | the historical lower bound of 34 covers the B-5 stage packages only | low | the WP-B visible run attempts are a different workpack | a decision to widen the historical package list, with its own double-counting analysis |

## The status language

`PASS` is reserved for Codex after the checkpoint. This batch therefore
reports:

```text
GC-B5R B-5 PUBLICATION SEMANTIC BINDING CORRECTION AWAITING CODEX CHECKPOINT
```

B-5, Stage B and V3 are **not** complete, and this batch does not enter
B-6.
