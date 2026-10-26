# The PRD coverage and the risks

## The PRD coverage

The authority of this batch is
`docs/active/project/design/v3-post-wp-b-completion-rebaseline.md`
(GC-B5R), the frozen Stage B contract
`stage-b-grounded-comprehension-contract.md`
(SHA-256 `c03491d5f55d3950448de75d20f2c89c1195234da05d17329f3a6f19254f38b8`)
and the Codex review
(`gc-b5r-b5-artifact-integrity-codex-review-2026-10-24/00-codex-review.md`).

| the requirement of the corrective goal | where it is covered | the state |
|---|---|---|
| AI1: a deterministic durable derivative artifact per complete source | `03-ai1-artifact-byte-oracle-proof.md` | covered |
| AI1: the aggregate reads the bytes, parses them and validates the frozen contract with an exact shared validator | the same | covered, plus the Python equivalence proof |
| AI1: SHA-256 from the exact bytes, compared with every declared hash | the same | covered |
| AI1: the receipt hash recomputed with the production canonical serialization | the same | covered |
| AI1: the task / revision / source / run / receipt / Provider / endpoint cross-bindings | the same | covered |
| AI1: one deterministic contracted filename, no directory search | the same | covered |
| AI1: the positive stub writes a real V2.1 artifact and derives the hashes from the bytes | the same | covered |
| AI1: the nine process-level negatives | `07-negative-process-exits.md` | covered, 9 cases |
| AI2: the request count rules and the exact ledger sums | `04-ai2-request-mirror-proof.md` | covered |
| AI2: the exact mirror schema version and wrapper key set | the same | covered |
| AI2: the REQUIRED locked Provider id, endpoint class, provider lock and derived-text scope | the same | covered |
| AI2: the process-exit negatives | `07-negative-process-exits.md` | covered, 5 cases (ten mirror fields) |
| AI3: the CI1 behavior is unchanged | `05-ci1-regression-proof.md` | covered |
| AI3: the public API / schema / FailureCode / threshold / message / Provider registry / Origin-auth order / denominator / historical evidence are unchanged | the same | covered |
| the case → production-oracle map | `06-case-to-production-oracle-map.md` | covered |
| the changed files and their hashes | `01-changed-file-hashes.json` | covered: 54 files of the final source set, 5 modified, 4 new, 45 carried, 0 generated |
| the exact commands and their exits | `02-commands-and-exits.md` | covered |
| the exact counter totals (all external actions zero) | `00-status-and-scope.md` and `09-owned-resource-cleanup-audit.md` | covered |
| the negative process exits | `07-negative-process-exits.md` | covered |
| the privacy scan | `08-secret-path-raw-media-scan.json` | covered: zero hits in the evidence |
| the cleanup audit | `09-owned-resource-cleanup-audit.md` | covered: zero residue |
| the payload manifest, generated LAST and verified with `sha256sum -c` | `PAYLOAD_MANIFEST.sha256` | covered |

## The change-control boundaries of GC-B5R

| boundary | the state of this batch |
|---|---|
| public API | **unchanged** — no endpoint, request or response shape changed; the artifact is an INTERNAL evidence file |
| schemas | **unchanged** — the frozen V2.1 candidate schema, the frozen V2.1 derivative schema and the frozen Stage B contract are byte-identical. The batch READS the frozen derivative contract |
| FailureCode inventories | **unchanged** — the batch CONSUMES the frozen codes and adds none. The new aggregate codes belong to the INTERNAL evaluator |
| thresholds | **unchanged** |
| messages | **unchanged** — no error message, stop reason or evidence field was renamed |
| the Provider registry | **unchanged** — the locked Provider id, endpoint class and derived-text scope are untouched |
| Origin/auth order | **unchanged** |
| the frozen source denominator | **unchanged** |
| the upload policy | **unchanged** — the hard-zero counters are still required in the mirror and in the publication |
| the WP-A/B acceptance records | **unchanged** — not read, not written |
| the relay inventories | **unchanged** — the relay scope is provably byte-identical |

**A necessary public or security change would have been an immediate stop
and a Codex decision.** None was needed.

## The remaining risks

| # | risk | severity | why it is still open | what would close it |
|---|---|---|---|---|
| R1 | the visible six-video batch has NOT been re-run with the corrected runner | **high** | this batch is strictly offline; the artifact-byte oracle, the request rules and the mirror rules are proven against synthetic values and doubles | the separate GC-B5R real-run checkpoint: one consolidated visible session with `--mute-audio`, the product path only, and the new audit set |
| R2 | the shared JavaScript validator implements the keyword subset of the frozen contract | low | the equivalence test proves the subset is exact for the CURRENT frozen file; a future revision with a new keyword would need the validator extended | the equivalence test would fail loudly, because the two validators would disagree |
| R3 | the aggregate proves that the artifact is a contract-shaped derivative whose bytes are the published ones; it does not RE-DERIVE it from the evidence catalog | low | re-deriving needs the evidence catalog and the Provider candidate, which the runner does not keep | keeping the candidate in the evidence set (a larger evidence contract) |
| R4 | the privacy audit fails a source closed when the published artifact contains an absolute path | low | the artifact is never rewritten, so the byte identity is preserved; a video summary that looks like a path would fail the source | a path detector that understands the artifact's text domain |
| R5 | the request count is the count the Runtime reports | low | the aggregate checks that it is present, positive and consistent with the ledger; it cannot observe the outbound HTTP attempts itself | nothing; the Runtime owns the count and the internal diagnostic carries it |
| R6 | the ownership tracker samples the process tree every 150 ms and is Linux-only | low | a descendant that is created AND exits inside one sampling window is never recorded; on another platform the audit reports nothing rather than guessing | a process-events based tracker |
| R7 | the historical lower bound of 34 covers the B-5 stage packages only | low | the WP-B visible run attempts are a different workpack | a decision to widen the historical package list, with its own double-counting analysis |

## The status language

`PASS` is reserved for Codex after the checkpoint. This batch therefore
reports:

```text
GC-B5R B-5 ARTIFACT INTEGRITY CORRECTION AWAITING CODEX CHECKPOINT
```

It does **not** claim a B-5 pass, a Stage B pass, a WP pass or a V3 pass,
and it does not enter B-6.
