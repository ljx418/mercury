# GC-B5R B-5 runner closure Codex review

Status: **NO-GO - corrective implementation required before the visible run**

The RC1-RC5 implementation is materially improved and its reported offline
checks reproduce. The visible six-video authorization is not granted yet,
because the aggregate still has two false-green paths.

## Findings

### Major 1 - a per-source owned-process leak can disappear before closeout

`sequencer.mjs` stores each audit as `processAuditBefore` and
`processAuditAfter`, but `collectSourceRows()` reads the nonexistent
`entry.leakedAfter`. Every source row therefore reports
`ownedProcessLeakCount = 0` regardless of the audit that was just observed.

The final audit only reports processes that are still alive at batch end. An
owned descendant that outlives its source runner, is observed by that source's
`processAuditAfter`, and exits while later sources run is consequently absent
from both the source oracle and the final oracle. That violates the per-source
cleanup boundary and can leave a positive aggregate.

Locations:

- `scripts/stage_b_b5_3/sequencer.mjs:298-319`
- `scripts/stage_b_b5_3/sequencer.mjs:393-400`
- `scripts/stage_b_b5_3/sequencer.mjs:517-523`

Required correction:

- bind each row to the real before/after audit fields;
- preserve any owned leak sighting for the whole candidate even if the process
  exits later;
- fail and stop on a per-source leak;
- add a process-level negative case whose descendant outlives one runner but
  exits before sequencer closeout, and assert nonzero process exit.

### Major 2 - a `complete` source does not require a real publication

The aggregate checks only the presence of `receipt.json`; it does not parse or
cross-bind that mirror. A `complete` row also does not require
`receipt.provider.published`, a complete frozen receipt identity, or the
publication hashes. The existing sequencer positive stub uses only legacy
top-level selected-provider fields and still yields a positive six-source
candidate.

This contradicts the GC-B5R-RUN machine exit requirement of one Provider
receipt and an independent V2.1 artifact plus durable receipt per successful
task. It also means the new `runtimeSynthesize` and `providerCall` ledger facts
are reported but do not participate in the positive verdict.

Locations:

- `scripts/stage_b_b5_3/lib/aggregate.mjs:141-252`
- `scripts/stage_b_b5_3/sequencer.mjs:372-410`
- `scripts/stage_b_b5_3/sequencer.mjs:449-496`
- `scripts/stage_b_b5_3/test/sequencer.node-test.mjs:79-126`

Required correction:

- parse the receipt mirror and reject malformed or inconsistent content;
- for every `complete` source require a real nested publication, the full
  frozen receipt identity, locked Provider/endpoint, valid request count and
  hashes, zero upload counters, and cross-binding to task/run/source evidence;
- require the candidate ledger totals to equal the sum of per-source attempted
  Runtime synthesis and Provider HTTP counts, with explicit semantics for a
  permitted pre-synthesis `blocked` source;
- add process-exit negative cases for missing publication, partial publication,
  malformed mirror, mismatched mirror, zero/missing ledger counts, and
  double-counted ledger counts.

## Independently reproduced

- evidence manifest: 13/13 OK;
- changed-source inventory: 49/49 hashes and byte counts match;
- full offline runner suite: 307/307, exit 0;
- prior Codex three-file command: 30/30, exit 0;
- no Chrome, Runtime media run, Provider call, Cookie read, download, import,
  audio output, tabCapture action, focus event, or real BVID execution was
  performed by this review.

## Decision

RC1, RC2, RC3, RC4 and RC5 are not rejected wholesale. The two defects are
bounded to aggregate/process evidence integrity. Correct them offline, rerun
the focused and consolidated gates once, and return to Codex. Do not consume a
new visible-run authorization and do not enter B-6.

