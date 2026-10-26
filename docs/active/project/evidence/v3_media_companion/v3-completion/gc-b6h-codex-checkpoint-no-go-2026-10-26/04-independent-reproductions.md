# Independent Reproductions

The submitted manifest passed for all seven payloads.

The following direct Node reproductions used production exports:

1. Mutated `firstPass.sentinelPosition=99`,
   `secondPass.sentinelPosition=99`, and `runId=null` while leaving the duplicate
   sentinel fields unchanged. `reviewPrecommitDefects()` returned
   `{ok:true,codes:[]}`.
2. Built public evidence from six `limited` rows while declaring machine gate
   positive, blind review performed, six review rows and two sentinel receipts;
   supplied no bundles, an invalid ledger, arbitrary lock/precommit, and nonzero
   scan hits. `validatePublicEvidence()` returned `{ok:true,codes:[]}`.
3. Removed run ids from all four payloads inspected by the validator.
   Validation still returned `{ok:true,codes:[]}`.
4. Supplied a retention record containing an absolute private root. The public
   retention payload preserved the path and validation returned
   `{ok:true,codes:[]}`.

Static production-path inspection confirmed that snapshot materialization has no
non-test caller, Runtime/extension launch uses working-tree roots, closure is
optional, its first check follows grant/Cookie access, and post-source failure is
ignored. It also confirmed that the runner omits `stageADiagnostic` and
`executionClosure` from the receipt object.

Focused submitted suites were independently rerun:

- Node B6H suite: `25 passed / 0 failed`, exit 0.
- Python quality diagnostic suite: `5 passed`, exit 0 when run with the repository
  module path. An initial invocation without `PYTHONPATH=.` failed during import
  collection (`ModuleNotFoundError`); it was an invocation-environment error, not
  recorded as a product failure.

No external action was performed by this checkpoint.
