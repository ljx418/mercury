# C2 — the complete failure-path evidence

## 1. ONE finalizer

`finalizeAuditEvidence()` in `scripts/stage_b_b5_3/run_one_bvid.mjs` writes
the mandatory audit set. The success path, the failure path and the `finally`
path all call it — there is no second writer.

| # | File | Content |
|---:|---|---|
| 1 | `final_disposition.txt` | the disposition, the reason, the BVID, the order and the task id |
| 2 | `b5-source-receipt.json` | the machine receipt (schema `v3-5.10-b5-3-source-receipt/v2`) |
| 3 | `isolation.json` | the isolation fingerprint (schema `v3-5.10-b5-3-isolation/v2`) |
| 4 | `receipt.json` | the receipt mirror (schema `v3-5.10-b5-3-receipt-mirror/v2`) |
| 5 | `provider_lock.txt` | the locked Provider identity, the endpoint class, what was OBSERVED and whether anything was published |
| 6 | `chrome_launch.log` | the pid, the mute flag, the launch-line digest and whether Chrome was launched |
| 7 | `secret_scan.csv` | the secret scan of everything that was just written |
| 8 | `cleanup.json` | the scratch/profile deletion facts and the cleanup failure (if any) |
| 9 | `task_namespace.json` | the namespace, the BVID, the order and the run id |

The published derivative (`<bvid>-evidence.json`) is written **only** when it
exists, and the failure diagnostic is written only on a failure.

## 2. The Provider facts are kept apart

The machine receipt carries three separate facts:

```json
"provider": {
  "selectedProviderId": "minimax-cn-openai-vision",
  "selectedEndpointClass": "minimax_chat_completions",
  "attempted": { "...": "the request that was made, or null" },
  "published": { "...": "the receipt of the derivative that was written, or null" }
}
```

An absent publication is **never** filled with successful values: the
`published` object is `null` and the receipt mirror records
`"published": false`.

The aggregate was corrected with it: a source with no published receipt is
judged by the SELECTED identity only. An honest failed attempt is therefore
never misclassified as a foreign Provider merely because nothing was
published. The case `a failure at provider_rejection writes the complete
audit set and exits nonzero` and the case `the failure receipt distinguishes
the selected, attempted and published Provider facts` prove it.

## 3. The known facts are preserved

The receipt keeps, for every disposition: the failure code, the task / source /
revision / generation identity, the six upload counters at hard zero, the mute
flag, the ownership facts and the cleanup facts — whenever they are known. A
fact that is not known stays absent; it is never invented.

## 4. Atomic and idempotent

Every file is written to a temporary sibling and renamed, so a reader never
sees a half-written file. The finalizer is idempotent: it may run again in the
`finally` path and it merges the facts; a second finalization never overwrites
a stronger durable fact with `null`.

## 5. The process-level negative tests

`scripts/stage_b_b5_3/test/runner_failure_evidence.node-test.mjs` drives the
REAL runner with an injected fault at every milestone:

| Fault point | The failure is injected |
|---|---|
| `before_chrome` | before the Chrome launch and before the Cookie inspection |
| `after_chrome` | at the post-Chrome setup (the Cookie inspection, the Provider metadata, the Runtime) |
| `after_task_creation` | at the Runtime and the task creation |
| `provider_rejection` | at the synthesis |
| `during_cleanup` | in the `finally` path (it is CAUGHT, so the cleanup and the finalizer still run) |

Each case asserts the **complete nine-file audit set** (every file present
and non-empty) and a **nonzero process exit**.

The fault seam is a TEST-ONLY seam: it is off unless `NAVIA_B5_FAULT_POINT` is
set, and when it is set it performs **no external action at all** — the
milestone is skipped and its facts stay absent. The offline suite therefore
never launches Chrome, never starts a Runtime, never reads a Cookie and never
calls a Provider. The case `the offline failure run performs NO external
action` asserts exactly that against the ledger.
