# GC-B6H-R Risks And The Next Decision

Batch: `GC-B6H-R OFFLINE CORRECTIVE`
Date: 2026-10-26

## 1. The final state

```text
GC-B6H-R OFFLINE CANDIDATE AWAITING CODEX CHECKPOINT
```

It does not authorize or schedule a visible run. B7, Stage C, Stage B PASS
and V3 PASS stay blocked.

## 2. The remaining risks

| Id | Risk | Severity | Note |
|---|---|---|---|
| R1 | The canonical rubric and prompt bytes are still a PROPOSAL, not a freeze | HIGH | The Codex freezes the first exact bytes. The previous private bytes cannot be inferred from a hash and are not claimed to be restored. Until the freeze, a candidate must not run a blind review. The precommit is now built and validated from the repository files, so the freeze is a two-line change for the Codex. |
| R2 | The execution closure is resolved MECHANICALLY, but a COMPUTED import path is not a resolvable import | MEDIUM | The harness composes the product's owned-session helpers through a computed path (`e2e/lib/v3WpBVisibleSession`). That tree is therefore a DECLARED root of the closure, not a mechanically discovered one. Every other executed import is discovered. A future product helper that is composed through a computed path must be declared as a root as well, or the closure would not cover it. The closure is otherwise closed over the whole tree, so a new file inside an executed tree is detected as an EXTRA byte. |
| R3 | The snapshot binds the third-party dependency trees by IDENTITY, not by bytes | MEDIUM | The `node_modules` tree is a declared tool binding: the snapshot carries a link to the pinned tree and the manifest carries the tree's digest and its package list. A dependency tree that changed WITHOUT its lockfile or its installed versions would be visible in the manifest; a tree that changed together with the lockfile would be a new, declared identity. |
| R4 | The runner still executes the WORKING TREE when it is invoked outside the candidate path | MEDIUM | The mandatory snapshot is a switch (`NAVIA_B6_REQUIRE_SNAPSHOT=1`) that `prepare_candidate.mjs` always sets. A direct invocation of the runner or the sequencer without the preparation is a DIFFERENT path. It is not a candidate run and it may never be counted as one, but the boundary is a switch rather than a physical impossibility. |
| R5 | The Stage A observation is a count/enum record, not a diagnosis | MEDIUM | It says that the authority did not converge, how many polls ran, how many rows were seen, how many matched exactly and which state class was observed. It does not say WHY the platform did not answer. The order-2 diagnosis still needs the product-side work. |
| R6 | The quality diagnostics record the STRUCTURE of a brief coverage failure and of a conflict, not the content | MEDIUM | The eligible claim count, the tested combinations, the region coverage, the maximum partial coverage, the full-region subset counts, the length buckets and the stable reason are recorded. The texts, the ids and the paths are not, by design. |
| R7 | The public evidence builder is proven against synthetic receipts and REAL private bundles | MEDIUM | The negative run's receipts are the first REAL machine inputs. The builder must be run against them before a visible candidate, and its generated package must be compared with the negative run's public package. |
| R8 | The retention record covers the negative run's artifacts by digest | LOW | The digests are recorded with an owner, a deadline and a deletion-receipt requirement. The spent private review precommit is NOT preserved for reuse. A future execution must refuse the recorded digests. |
| R9 | The Stage B tree is largely UNTRACKED in git | MEDIUM | The changed-file inventory of this batch is the digest list; the git diff mixes it with the uncommitted Stage B work of the earlier batches. |
| R10 | A concurrent session is modifying the Runtime modules and the relay sources | MEDIUM | Their modifications are NOT this batch's and were not touched. The relay v11 scope digests are byte-identical to the GC-B6B proof, and the relay v11 gate is green inside the offline suite. |

## 3. What this batch established

- The candidate path is ONE path: `prepare_candidate.mjs` seals the executed
  bytes into an exclusive snapshot, the sequencer and the runner run FROM
  that snapshot, and the manifest is verified against the snapshot before the
  authorization, after every source and at the closeout.
- The public package is no longer transcribed: it is generated from the raw
  production authorities and every gate in it is recomputed.
- The durable receipts carry the Stage A observation, the closure verdict
  and the execution-root identities, and a closure failure is latched: it
  survives a later restoration and it makes the aggregate non-positive.
- The private retention and its public projection are separate forms, and
  the public form can never carry a path.

## 4. The decisions Codex must take

1. **The checkpoint of this implementation.** Nothing else is authorized
   until the checkpoint closes.
2. **The canonical protocol byte freeze.** The rubric and the prompt bytes
   in the repository are the proposal; the Codex freezes them (or replaces
   them) before any visible candidate.
3. **The snapshot execution wiring.** Whether a future candidate must execute
   the materialized snapshot as its only root, and how the dependency trees
   are pinned.
4. **The order-2 diagnosis.** The visible diagnostic is BLOCKED and its
   authorization is consumed. The Stage A observations now make the failure
   ATTRIBUTABLE, but the product-side cause is still open.
5. **A visible candidate.** It requires a new Codex checkpoint and a new
   explicit authorization. This batch neither requests nor performs one.

## 5. What was NOT done

- No Chrome, no visible window, no Cookie read or injection, no Runtime
  media task, no Provider request, no download, no import, no real BVID, no
  blind review, no sentinel, no B7 and no Stage C.
- No public contract, schema, quality threshold, request bound, registry,
  denominator or historical evidence change; the eight-request bound is
  untouched.
- No reserve substitution, no historical-row merge, no local content repair
  and no reinterpretation of the negative run.
- No historical evidence package was edited.
- The repository was not committed, pushed, reset, cleaned, checked out or
  reverted.
