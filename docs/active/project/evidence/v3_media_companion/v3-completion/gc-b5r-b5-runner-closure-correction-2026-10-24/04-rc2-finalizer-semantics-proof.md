# RC2 — the finalizer merges with EXPLICIT field semantics

Oracle: `scripts/stage_b_b5_3/test/audit_finalizer.node-test.mjs`
(12 cases, 12 pass, exit 0).

## The defect that was closed

The old merge was "never replace a non-null primitive". Two consequences:

* a cleanup boolean that was `false` (the deletion FAILED) could never
  become `true` again, even after a later VERIFIED deletion;
* the generic merge had no rule for the terminal pair, so a later, weaker
  attempt could silently replace a frozen Runtime failure code.

The merge is now a TYPED merge per field, in
`scripts/stage_b_b5_3/lib/audit_finalizer.mjs`.

## The explicit rules

| field group | the rule |
|---|---|
| the identity fields and the current-run observations | the value of the FINAL run wins; a null never erases a known fact |
| `cleanup.runtimeScratchDeleted`, `cleanup.profileRootDeleted` | CONVERGE false → true: a verified deletion is never undone by a weaker observation |
| `cleanup.cleanupFailure` | may NOT be erased: the first non-null failure wins |
| `provider.published` | a real publication may replace an earlier null; a later null never erases it; a publication that does not carry the whole identity of a real publication is a FABRICATION and is refused |
| `provider.attempted.requestCount` | the value of the FINAL run wins (the attempt count of the final state) |
| `uploadCounters` | a non-zero count is a VIOLATION and is never erased: every counter converges to the larger value |
| `disposition` + `failureCode` (the TERMINAL PAIR) | an explicit precedence, below |
| the timestamps | the FINAL run state wins |
| a receipt of a DIFFERENT run or a DIFFERENT source | NEVER combined: the current receipt replaces it |

## The terminal precedence

```text
1. a STRONGER disposition wins      failed (4) > blocked (3) > limited (2) > complete (1)
2. a WEAKER disposition never erases a stronger one
3. within one disposition, a STRONGER failure code wins
      2 = a frozen Runtime code (V3510B_* / V352_*)
      1 = a runner-level safe code (VISIBLE_AUTHORIZATION_REFUSED)
      0 = a generic Error name
   so a frozen Runtime code SURVIVES a later, weaker attempt
4. within one disposition and one code strength, the FINAL run state wins
```

The pair always describes ONE attempt: the disposition and its code are
never mixed.

## The runner: the pre-cleanup finalization and the finally cleanup

The runner calls the finalizer twice: once when the source reached its
outcome and once more in the finally path, AFTER the cleanup. The durable
record therefore merges two states.

The runner-level cases prove the convergence:

* `RC2: the runner converges the cleanup to true and the aggregate accepts
  it` — the success path drives the real runner; the final machine receipt
  AND `cleanup.json` both report `runtimeScratchDeleted: true` and
  `profileRootDeleted: true`, and `evaluateAggregate` reports NO
  `AGG_AUDIT_FAILED` for the row.
* `RC2: the failure path converges the cleanup to true as well` — the same
  convergence on the failure path.

The aggregate accepts the cleanup because it reads `cleanup.json` and
requires both booleans to be true (`cleanupComplete`).

## The merge unit cases

| case | the rule it proves |
|---|---|
| the cleanup booleans CONVERGE false → true | the defect that is closed |
| a verified deletion is never undone by a weaker observation | the convergence is monotone |
| the cleanup failure may NOT be erased | the first non-null failure wins |
| a published receipt may replace an earlier null | a real publication is accepted |
| a published receipt is never FABRICATED and never erased | a partial object is refused; a later null keeps the publication |
| the terminal pair follows an EXPLICIT precedence | the four rules above |
| the timestamps and the attempt counts follow the FINAL run state | the current-run group |
| a retry never COMBINES the evidence of a different run or source | the run/source binding |
| an upload violation is never erased | the upload counter rule |
| the merge covers every current-run field explicitly | the rule set is complete |

**The first case fails against the old merge**: with "never replace a
non-null primitive" the value `false` survives the later `true`, and the
assertion `runtimeScratchDeleted === true` fails.

## The fresh-process re-entry

The re-entry is covered by the FC3 oracle
(`FC3: a fresh-process re-entry never degrades a known fact`): a SECOND,
independent process re-enters the same evidence root of the same run and the
same source, fails with a weaker error, and the durable record keeps

* the frozen Runtime failure code (the terminal precedence),
* the cleanup booleans (the convergence),
* a null publication (a publication is never fabricated),
* while the timestamps and the attempt count follow the FINAL run.

The re-entry carries its OWN authorization: a child grant is one-use since
RC1, so a retry of the same source needs a fresh grant.

## The honest limits

* The merge applies to the machine receipt of a source. The nine-file audit
  set is rewritten as a whole at every finalization; the merge governs the
  machine receipt, which is the durable, merged record.
* The terminal precedence keeps a stronger disposition. A source that failed
  and later succeeded in a RETRY keeps the failed disposition: the durable
  record of the candidate is terminal. A new candidate run needs a new run
  id (and then nothing is combined).
