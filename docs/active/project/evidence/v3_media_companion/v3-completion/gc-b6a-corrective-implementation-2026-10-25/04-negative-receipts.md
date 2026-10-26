# Negative Receipts

The negative receipts of this batch: the PROCESS exits of the mutation
matrix and the exact stable failure codes of every refusal. The exit code
IS the verdict of the production oracle.

## The bundle mutation matrix (a separate process per mutation)

```text
$ node test/_fixtures/b6_mutation_runner.mjs <mutation>
```

| Mutation | Exit | Verdict | Codes |
|---|---|---|---|
| `none` | 3 | ACCEPTED (the control) | — |
| `foreign-adapter` | 0 | REFUSED | `B6_BUNDLE_IDENTITY_MISMATCH`, `B6_BUNDLE_RECEIPT_INVALID` x2, `B6_BUNDLE_MANIFEST_DRIFT` x5 |
| `stale-revision` | 0 | REFUSED | `B6_BUNDLE_IDENTITY_MISMATCH` x2, `B6_BUNDLE_RECEIPT_INVALID`, `B6_BUNDLE_MANIFEST_DRIFT` x3 |
| `detached-manifest-bytes` | 0 | REFUSED | `B6_BUNDLE_MANIFEST_DRIFT` |
| `false-closure` | 0 | REFUSED | `B6_BUNDLE_RECEIPT_INVALID` |
| `wrong-counts` | 0 | REFUSED | `B6_BUNDLE_RECEIPT_INVALID` |
| `wrong-hashes` | 0 | REFUSED | `B6_BUNDLE_RECEIPT_INVALID` x4 |
| `wrong-receipt-schema` | 0 | REFUSED | `B6_BUNDLE_RECEIPT_INVALID` |
| `failed-status` | 0 | REFUSED | `B6_BUNDLE_RECEIPT_INVALID` |
| `manifest-traversal` | 0 | REFUSED | `B6_BUNDLE_MANIFEST_PATH_INVALID` |
| `manifest-undeclared` | 0 | REFUSED | `B6_BUNDLE_MANIFEST_DRIFT` x2 |
| `manifest-missing` | 0 | REFUSED | `B6_BUNDLE_MANIFEST_DRIFT` |
| `provider-in-receipt` | 0 | REFUSED | `B6_BUNDLE_PROVIDER_LEAK`, `B6_BUNDLE_RECEIPT_INVALID` |

The exit code contract: `0` = REFUSED, `3` = ACCEPTED, `4` = the mutation
itself failed.

## The four CODEX reproductions of the bundle defect classes

| Codex reproduction | Mutation | Production refusal |
|---|---|---|
| `portal:attacker:<BVID>` | `foreign-adapter` | `B6_BUNDLE_IDENTITY_MISMATCH` (the strict grammar of `parseStrictSourceIdentity`) |
| a stale task revision | `stale-revision` | `B6_BUNDLE_IDENTITY_MISMATCH` |
| `manifest[source.json].bytes = {}` and rehash | `detached-manifest-bytes` | `B6_BUNDLE_MANIFEST_DRIFT` (the byte closure: the canonical encoder rebuilds the file and compares it byte-for-byte) |
| a wrong receipt schema / zero counts / zero hashes / false closure / `status: failed` | the five receipt mutations | `B6_BUNDLE_RECEIPT_INVALID` (the receipt is DERIVED, never trusted) |

## The four CODEX reproductions of the aggregate defect classes

They are the process-independent regression cases
`B6 codex 1/4 .. 4/4` of `test/b6_aggregate.node-test.mjs`:

| Codex reproduction | Production refusal |
|---|---|
| no expected authority | `B6_AUTHORITY_MISSING` |
| six rows with `disposition: failed` | `B6_ROW_NOT_COMPLETE` |
| a nested `meta.providerId` | `B6_PROVIDER_IDENTITY_VISIBLE` (the identity keys are rejected at ANY depth) |
| an empty second sentinel claim set | `B6_SENTINEL_CLAIM_SET_CHANGED` |

## The negative filesystem receipts

| Case | Production refusal |
|---|---|
| a root inside the repository | `B6_CAPTURE_ROOT_INVALID` |
| a symlinked root | `B6_CAPTURE_ROOT_INVALID` |
| a root accessible by the group or by others | `B6_CAPTURE_ROOT_INVALID` |
| a pre-existing destination | `B6_CAPTURE_DESTINATION_EXISTS` (the existing content is never overwritten) |
| an interruption at `after_payload_write`, `after_manifest_write`, `after_validation` or `before_rename` | `B6_CAPTURE_WRITE_FAILED`; nothing is published and the owned staging directory is removed |
| a traversing manifest path | the reader throws `the private manifest carries an invalid path` |
| a symlinked payload | the reader throws `the private manifest names an unreadable payload` |
| an undeclared payload | the reader throws `the private bundle carries the undeclared file` |
| a missing contracted payload | the reader throws `the private manifest names an unreadable payload` |
| a chapter without a PNG-backed frame | `B6_CAPTURE_SEEK_UNCLOSED` |

## The negative runner receipt

The capture-failure scenario (a separate process) reports:

```json
{
  "decision": {
    "allowSourceCompletion": false,
    "failureCode": "B6_CAPTURE_ROOT_INVALID",
    "captureStatus": "failed"
  },
  "mergedDisposition": "failed",
  "mergedFailureCode": "B6_CAPTURE_ROOT_INVALID",
  "sourceCompletionCount": 0,
  "sourceAttemptCount": 0
}
```

A failed capture leaves NO `sourceCompletion` accounting and the final
machine receipt is `failed`, never `complete`.
