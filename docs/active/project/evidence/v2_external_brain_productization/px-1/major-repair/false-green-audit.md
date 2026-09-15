# V2-PX PX-1 Major Repair False-Green Audit

## Recomputations

- Parsed `route-e2e.json` instead of trusting `passed`: exactly 20 unique required route/recovery cells are present and all pass.
- Parsed eight concurrent results: one `created_new`, seven `focused_existing`, one unique tab ID.
- Verified the real Chrome report contains zero observed source-ingest POST requests.
- Verified screenshot files exist and have non-empty distinct hashes.
- Verified all command logs have successful process exits; frontend totals are 16/140 and Runtime totals are 4/4.
- Re-ran PX-0.2 validator rather than copying its historical result: all 109 negative fixtures were rejected as expected.

## Adversarial Findings

1. The first rerun timed out because the E2E registered the new-page listener after awaiting the click. This was rejected as a test orchestration failure, fixed by registering the listener before click, and rerun to process exit 0.
2. Runtime health transport rejection originally escaped the resolver. This was fixed and covered by a deterministic offline unit test before accepting the real offline Chrome result.
3. Forbidden is not a real Runtime fact. The evidence and claims label it injected contract coverage only.
4. The initial PX-1 report remains immutable and failed. This repair uses a separate evidence directory.

No remaining Fatal, Major or Minor issue was found in the bounded repair.
