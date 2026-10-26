# GC-B6H Implementation Map (case → owner)

Every obligation maps to the ONE owner that decides it, to the test that
drives it, and to the negative that proves the refusal. A test never
re-implements a rule.

## H1 — the sealed execution closure

Owner: `scripts/stage_b_b5_3/lib/execution_closure.mjs`

| Case | Negative | Assertion |
|---|---|---|
| the closure resolves the executed roots and verifies clean | — | the file set, the digests and the tool identities all match |
| a byte drift in an executed file | a Runtime module's digest is altered in the manifest | `EXECUTION_CLOSURE_FILE_DRIFT` |
| an executed file OMITTED from the closure | the manifest drops a harness file | `EXECUTION_CLOSURE_FILE_EXTRA` (the freshly resolved set has it) |
| an EXTRA file introduced after the lock | the manifest names a file that does not exist | `EXECUTION_CLOSURE_FILE_MISSING` |
| a symlinked snapshot file | a snapshot file is replaced by a symlink to the working tree | `EXECUTION_CLOSURE_SYMLINK` |
| an existing snapshot | the materialization is attempted twice | `EXECUTION_CLOSURE_MUTABLE_PATH` |
| the pre / post / per-source verification | the runner verifies before the first external action and after the source; the sequencer verifies at the closeout | `B6_EXECUTION_CLOSURE_INVALID` before any external action, and the observed verdict in the machine receipt |

## H2 — the canonical review protocol

Owner: `scripts/stage_b_b5_3/lib/review_protocol.mjs` with the canonical
files `protocol/review-rubric.v1.md` and `protocol/review-prompt.v1.md`.

| Case | Negative | Assertion |
|---|---|---|
| the canonical protocol is loaded from the repository | — | both files are present with a byte count and a SHA-256 |
| a valid precommit | — | it passes |
| a CALLER-SUPPLIED rubric with self-consistent hashes | the precommit names another path with its own hash | `REVIEW_PROTOCOL_RUBRIC_DRIFT` + `REVIEW_PROTOCOL_CALLER_SUPPLIED_REPLACEMENT` |
| a ONE-BYTE canonical protocol drift | the recorded prompt hash is altered | `REVIEW_PROTOCOL_PROMPT_DRIFT` |
| the WRONG byte count | the recorded byte count is off by one | `REVIEW_PROTOCOL_BYTE_COUNT_MISMATCH` |
| the SWAPPED registry and review orders | the registry order is replaced by the review order | `REVIEW_PROTOCOL_REGISTRY_ORDER_INVALID` |
| a REPEATED review session | both sessions carry the same id | `REVIEW_PROTOCOL_SESSION_REUSED` |
| an INVALID sentinel position | the two positions collide, or the position is out of range | `REVIEW_PROTOCOL_SENTINEL_POSITION_INVALID` |

## H3 — the deterministic public evidence builder

Owner: `scripts/stage_b_b5_3/lib/public_evidence.mjs`

| Case | Negative | Assertion |
|---|---|---|
| the generated package is valid and its counts match its rows | — | it passes and the counts are recomputed from the rows |
| a MANUALLY ALTERED public row | a row's disposition is changed after the generation | `PUBLIC_EVIDENCE_COUNT_MISMATCH` |
| a MALFORMED raw receipt | a row carries an extra field | `PUBLIC_EVIDENCE_SCHEMA_INVALID` |
| a RUN BINDING mismatch | the package is validated against another run id | `PUBLIC_EVIDENCE_RUN_ID_MISMATCH` |
| the manifest is generated from the payload bytes | — | the manifest lines are the digests of the written bytes |

## H4 — the stable Stage A diagnostics

Owner: `scripts/stage_b_b5_3/lib/stage_a_diagnostics.mjs`

| Case | Negative | Assertion |
|---|---|---|
| the authority budget is five minutes and the media budget is twenty | — | the constants and the derived text agree |
| the elapsed bucket is EXACT at the boundaries | 59 999 ms, 60 000 ms, 5 min, 5 min + 1, 20 min, 20 min + 1 | the six exact buckets |
| a FOREIGN identity that CONTAINS the bvid | `XBV11t8w6oEtP`, a foreign adapter, a foreign namespace, a malformed identity | none of them matches |
| the stable codes are the frozen enums | — | every code matches `B6_STAGE_A_*` and they are unique |

## H5 — the quality diagnostics without contract relaxation

Owners: `comprehension/quality.py :: brief_coverage_diagnostic` and
`conflict_diagnostic`, rendered by `comprehension/diagnostics.py ::
quality_diagnostic`.

| Case | Negative | Assertion |
|---|---|---|
| the brief coverage diagnostic carries only structural facts | — | the exact key set, the counts, the region names and the length buckets |
| the conflict diagnostic carries only the boolean and the bound | an attempt count of 99 | the count is bounded at 8 |
| the diagnostics leak no text, no id, no path, no Provider and no secret | the candidate is filled with a secret sentence | none of the forbidden strings is in the diagnostic |
| the quality facts NEVER change the disposition | a limited and a conflicted candidate | the disposition is unchanged, the candidate is not mutated and the conflict flag is not forced |

## H6 — the retention lifecycle

Owner: `scripts/stage_b_b5_3/lib/retention_ledger.mjs`

| Case | Negative | Assertion |
|---|---|---|
| a retention record must be diagnosis-only | — | the flags, the owner, the deadline and the deletion receipt |
| a record without an owner, a deadline or the flag is refused | the record is built empty | `RETENTION_ARTIFACT_OWNER_MISSING`, `RETENTION_ARTIFACT_DEADLINE_MISSING`, `RETENTION_ARTIFACT_NOT_DIAGNOSIS_ONLY` |
| a RETAINED negative-run artifact cannot enter a new candidate or review | the digests of the negative run are offered as a candidate input | `RETENTION_SPENT_ARTIFACT_REUSED` |
