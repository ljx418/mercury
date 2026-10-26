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
(`gc-b5r-b5-authority-completeness-codex-review-2026-10-25/00-codex-review.md`
with its `01-independent-reproductions.json`).

| the requirement of the corrective goal | where it is covered | the state |
|---|---|---|
| AC1: the source identity parses and equals the frozen row authority | `03-ac1-identity-authority-proof.md` | covered |
| AC1: the literal portal `portal` and adapter `bilibili`, the exact row BVID | the same | covered |
| AC1: the non-empty playback-unit and part components | the same | covered |
| AC1: the task namespace satisfies the frozen task-namespace shape | the same | covered |
| AC1: the sequencer parses `task_namespace.json` and rejects malformed or extra/missing fields | the same | covered |
| AC1: the namespace receipt is cross-bound to the machine receipt, the run and the row | the same | covered |
| AC1: the timestamps denote finite, valid UTC instants with `finish >= start` | the same | covered |
| AC1: direct, pure and real-sequencer negatives | the same and `08-negative-process-exits.md` | covered, 8 + 7 + 6 cases |
| AC2: `disposition` joins the explicit machine terminal shape | `04-ac2-machine-disposition-proof.md` | covered |
| AC2: a string in the frozen vocabulary, compared unconditionally | the same | covered |
| AC2: the pure and real-sequencer negatives for every invalid form | the same and `08-negative-process-exits.md` | covered, 6 + 5 cases |
| AC3: the checked public entry and the private evaluator | `05-ac3-schema-entry-proof.md` | covered |
| AC3: the direct calls with `not`, `minProperties`, `exclusiveMinimum` and nested keywords hard-fail | the same | covered, 8 cases |
| AC3: the frozen-schema cache validation, the inventory tests, the canonical serialization and the Python/JavaScript cases are retained | the same | covered |
| AC4: the accepted closures are preserved | `06-ac4-preserved-closures-proof.md` | covered |
| the case → production-oracle map | `07-case-to-production-oracle-map.md` | covered |
| the changed files and their hashes | `01-changed-file-hashes.json` | covered: 58 files of the final source set, 9 modified, 0 new, 49 carried, 0 generated |
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
| AC-01: a receipt with an arbitrary namespace, the attacker adapter and calendar-invalid timestamps produced `{"identityDefects":[]}` | **closed**: four defects — the namespace, the adapter, the start and the finish timestamps |
| AC-02: deleting `disposition` from all six receipts produced `{"missingDispositionPositive":true}` | **closed**: `AGG_MACHINE_TERMINAL_INVALID` for every source |
| AC-03: `validateAgainstSchema({type:"object",not:{}}, {})` returned `{"ok":true}` | **closed**: the public API throws `the schema uses the unsupported keyword(s): not` |

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
| R1 | the visible six-video batch has NOT been re-run with the corrected runner | **high** | this batch is strictly offline; the authority, terminal and schema closures are proven against synthetic values and doubles | the separate GC-B5R real-run checkpoint: one consolidated visible session with `--mute-audio`, the product path only, and the new audit set |
| R2 | the source identity's playback unit and part are required to be non-empty but are not compared against the portal's catalogue | low | the frozen registry row does not carry them; the Runtime owns the mapping | a frozen row that carries the unit and the part |
| R3 | the identity and the terminal shape are required for a row that carries a machine receipt; a source that failed before its task existed has no task id | low | such a source can never make the candidate positive | nothing |
| R4 | the shared JavaScript validator implements the keyword subset of the frozen contract | low | a frozen revision with a new keyword is a HARD FAILURE at the cache load AND at every public validation call | extending the validator with the new keyword and re-running the inventory comparison |
| R5 | the representative value fixtures are a sample, not a universal equivalence proof | low | the universal part is the keyword inventory plus the fail-closed behaviour | a property-based generator over the frozen domain |
| R6 | the canonical serialization claim covers the legal frozen receipt domain, not every JSON value | low | a lone surrogate is outside the legal domain and the two layouts differ there | nothing; the domain is documented and tested byte by byte |
| R7 | the ownership tracker samples the process tree every 150 ms and is Linux-only | low | a descendant created AND exited inside one sampling window is never recorded | a process-events based tracker |
| R8 | the historical lower bound of 34 covers the B-5 stage packages only | low | the WP-B visible run attempts are a different workpack | a decision to widen the historical package list, with its own double-counting analysis |

## The status language

`PASS` is reserved for Codex after the checkpoint. This batch therefore
reports:

```text
GC-B5R B-5 AUTHORITY COMPLETENESS CORRECTION AWAITING CODEX CHECKPOINT
```

B-5, Stage B and V3 are **not** complete, and this batch does not enter
B-6.
