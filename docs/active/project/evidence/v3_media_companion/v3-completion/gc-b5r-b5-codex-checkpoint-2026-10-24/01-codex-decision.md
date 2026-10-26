# Codex decision

## Contract decision

Do not relax or refreeze the V2.1 chapter contract. In particular:

- chapter starts remain strictly increasing;
- chapter count remains 2 through 12;
- chapter fields remain exact;
- a Provider candidate that cannot satisfy those rules remains fail-closed;
- raw Provider output, transcript text and evidence text remain private.

The next implementation batch may improve Provider-side shape enforcement,
bounded regeneration and redacted diagnostics. It may not synthesize semantic
chapters locally, silently delete chapters to reach a pass, rewrite evidence
bindings, weaken the validator or add a fallback Provider.

## Execution decision

An offline corrective batch may start. It must launch zero Chrome instances,
make zero Provider calls, perform zero downloads and inject zero Cookies.

No further visible B-5 run is authorized by this checkpoint. After the offline
corrective is complete and independently reviewed, Codex will decide whether
to authorize one final consolidated rerun.

## Required corrective outcomes

1. A durable stage action ledger reconciles every historical attempt and
   distinguishes stage totals from the candidate-run subset.
2. Every source disposition writes complete mandatory machine evidence from a
   single finalizer.
3. Redacted diagnostics separate evidence timestamp capacity, candidate shape
   and repair outcome without retaining text, IDs, paths or Provider payloads.
4. The MiniMax adapter enforces the frozen candidate shape before returning to
   the independent validator and uses only bounded same-Provider repair.
5. The receipt-extras fix remains green against the frozen V2.1 schema.

