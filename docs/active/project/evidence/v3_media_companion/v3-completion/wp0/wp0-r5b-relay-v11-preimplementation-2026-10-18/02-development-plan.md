# Relay v11 development plan

## Entry gate

Implementation starts only after explicit authorization. Before editing, verify this package manifest, baseline
verifier and mutation verifier. No visible browser is allowed during implementation.

## V11-0: freeze contract candidate

- Copy accepted v10 schema/fixture/verifier into versioned v11 files.
- Change only schema/Port version and sender-policy semantics.
- Preserve nine messages, all limits, markers, FailureCode inventories and 30 RLY + 8 OM negative counts.
- Replace v10 sender-negative five with authoritative-context missing/ambiguous/mismatch/replacement semantics.

Exit: v11 schema meta-valid, baseline green, semantic mutations red; v10 files unchanged.

## V11-1: production identity result

- Introduce an internal accepted result carrying the authoritative context document ID.
- Validate exact extension ID, URL, no tab, frame, context type/count/URL/origin/incognito/document ID.
- Cross-check a present sender document ID; tolerate absence only under the complete unique-context conjunction.
- Bind the authoritative document ID and reject replacement.

Exit: no URL-only branch and no success return without a non-empty authoritative ID.

## V11-2: atomic Port migration

- Change Background and Offscreen to the v11 Port name in one candidate.
- Remove v10 acceptance from production code; do not add compatibility fallback.
- Preserve Offscreen zero-network and Background-only WebSocket ownership.

Exit: static discovery finds one production Port version and Offscreen network calls remain zero.

## V11-3: behavioral tests

- Drive SP11-P01..P03 and SP11-N01..N14 through production classifier/Port classes.
- Extend entrypoint composition for the actual absent-sender-document case.
- Cover lookup races, lookup exceptions, replacement and profile mismatch.
- Update relay static gates and v11 mutation tests.

Exit: every case has an observed result and forbidden-side-effect assertion.

## V11-4: consolidated offline checkpoint

Run once: schema/meta validation, v10 historical verifier, v11 baseline/mutations, targeted tests, media subtree,
full extension unit suite, typecheck, build, affected Runtime tests, secret scan and owned-resource scan.

Exit: Fatal 0 / Major 0, no public contract drift, no process/port residue.

## V11-5: one visible R5-B positive

Notify the user, then use one fresh owned production Chrome/Profile with explicit `--mute-audio`. Drive only the
user-reachable path and prove PCM -> Runtime -> SenseVoice -> acquisition -> materialized product terminal. Stop
on the first independent failure, clean all owned resources, and do not visibly retry in the same batch.

Exit: accepted R5-B checkpoint or a single new evidence-backed NO-GO. R6 remains blocked until PASS.
