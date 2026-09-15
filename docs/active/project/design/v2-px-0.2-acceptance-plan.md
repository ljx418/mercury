# V2-PX PX-0.2 Acceptance Plan

Plan date: 2026-08-31

## Required Commands

```text
npm --prefix apps/chrome-extension run validate:v2-external-brain-productization -- --contract-fixtures
npm --prefix apps/chrome-extension test -- validate-v2-external-brain-productization-report.test.mjs
npm --prefix apps/chrome-extension run typecheck
```

## Machine Gates

| Gate | Acceptance threshold |
|---|---|
| Schema | 9/9 schemas meta-valid; 65/65 positive IDs valid |
| Fixture protocol | 109/109 RFC 6902 patches execute and match declared schema layer |
| Registry | exact 63 RuleIds, 41 semantic RuleIds and PX-N-001..109 |
| Positive semantic base | all 41 semantic rules pass; recomputed G1-G7 all true |
| Negative semantics | every schema-valid semantic case returns its registered primary failure |
| Artifacts | every required path exists in the selected evidence source and raw-byte SHA-256 matches |
| Screenshots | 29/29 path pairs match; PNGs decode to declared dimensions and surface mapping |
| Route | five routes each cover direct-open/reload/Back/reopen; invalid/forbidden >= 2 |
| Lifecycle | tab reuse zero ingest delta; three durable Forget chains use one identity and end forgotten |
| Status | four fault classes covered; Runtime offline authority is not fabricated |
| G4 | both checks rescan source; PX-N-104..109 are rejected while Report still says zero violations |
| Claim | contract fixtures cannot satisfy production acceptance or production Human Review claim |

## Required Test Groups

- CLI success on the frozen positive/negative suite.
- CLI deterministic repeat: two runs produce the same counts and failure-code
  sets, excluding timestamps.
- Targeted mutations for report child failure, summary mismatch, route/ID
  mismatch, artifact traversal/hash, Runtime offline, tab reuse, durable Forget,
  G6 surface/dimension and source-level G4 violations.
- CLI failure on an intentionally malformed FixtureSuite.
- Implementation artifact hash equals the actual validator source bytes.

## End-To-End Meaning

PX-0.2 E2E is a contract-fixture execution path. It begins at the CLI, loads the
same package an acceptance reporter will produce, resolves all evidence bytes,
recalculates gates and exits non-zero on false-green inputs. It is not Chrome
product E2E and cannot approve PX-1 by itself.

## PRD Review

The post-stage review must confirm:

- no V2 capability was added or claimed;
- the validator implements the PRD evidence and claim boundaries;
- user-triggered Forget remains the current product behavior;
- automated forgetting, RAG, Dream Cycle and data_service product completion
  remain excluded;
- PX-1 remains No-Go until the PX-0.2 audit is all green.

## Exit Condition

PX-0.2 passes only when all commands exit 0, all 109 cases produce their frozen
outcome, the PRD review has no fatal/major issue and the false-green audit has no
open fatal/major finding.

