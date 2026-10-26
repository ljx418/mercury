# Findings

## Fatal 1 - The public evidence validator can certify a negative run as positive

`lib/public_evidence.mjs:66-207` copies `decision.machineGatePositive`,
`blindReviewPerformed`, review counts, lock, precommit, retention, scan, and
ledger facts from caller input. `validatePublicEvidence()` at lines 214-287 does
not recompute the machine gate from the production aggregate, does not validate
the lock or precommit, accepts no bundles, ignores an invalid ledger/scan, and
accepts absent run ids because binding is conditional on `payload.runId` being
truthy.

Independent reproduction: six `limited` rows, `machineGatePositive:true`,
`blindReviewPerformed:true`, six review rows, two sentinel receipts, no bundles,
an invalid ledger, an arbitrary lock/precommit, and nonzero scan hits returned
`{ok:true,codes:[]}`. Removing every validated payload run id also returned
`ok:true`.

Impact: this is a complete B6 acceptance bypass.

## Major 1 - The snapshot is not the execution root and closure is fail-open

`lib/execution_closure.mjs:351-415` can materialize and verify a snapshot, but no
production caller uses either function. `run_one_bvid.mjs:763-788` launches the
Runtime from the working tree, and lines 1065-1091 build the Chrome fixture from
the working-tree extension. The only integrations verify the working tree.

`run_one_bvid.mjs:860-886` treats an absent closure manifest as acceptable.
Verification at lines 1126-1135 occurs after grant consumption and Cookie read
(lines 1005-1044), not before every external action. Post-source verification at
lines 2077-2083 is ignored and cannot change the terminal result; a drift restored
before sequencer closeout can disappear.

The submitted risk report itself acknowledges that the runner still executes the
working tree. This is an unclosed required objective, not a residual risk.

## Major 2 - The canonical protocol is neither operative nor fully validated

`review_protocol.mjs` is imported only by its unit test. Sequencer/preflight/blind
review do not build or validate its precommit, so a future run can still use a
private protocol.

The validator checks `sentinel.*Position` but never binds
`firstPass.sentinelPosition` or `secondPass.sentinelPosition` to those values or
to the review order, and it does not require a run id. Independent mutation set
both operative pass positions to `99` and the run id to null; validation still
returned `ok:true`.

The proposed rubric/prompt bytes therefore cannot be frozen yet.

## Major 3 - Stage A and closure diagnostics are omitted from durable receipts

`audit_finalizer.mjs:33-44` permits `stageADiagnostic` and `executionClosure`, but
the receipt object constructed by `run_one_bvid.mjs:361-399` supplies neither
field. The observations are consequently absent from the machine receipt. This
also prevents per-source closure failure from reaching aggregate authority.

The stable Stage A failure code assignment itself is correct, but the diagnostic
evidence promised by H4 is not durable.

## Major 4 - Retention records can leak private paths into public evidence

`retention_ledger.mjs:45-73` stores the raw `root`. `public_evidence.mjs` writes
the caller's retention records verbatim and its validator never validates or
redacts them. Independent reproduction inserted a private absolute path; it was
present in `06-retention-ledger.json` and the package still validated `ok:true`.

The public form must contain only a non-reversible root reference and validated
policy fields. The private ledger may keep an owned path only outside the public
package.

## Minor 1 - Brief coverage diagnostic understates partial coverage

`quality.py:588-606` adds covered regions only after a combination already covers
all required regions and passes the length rule. When no full subset exists,
`coveredRegionCount` is always zero even if combinations cover one or two regions.
Track maximum partial coverage separately from valid full-subset count so the
diagnostic answers why coverage failed without exposing content.
