# GC-B6B Candidate Lock

Batch: `GC-B6B FRESH CANDIDATE + BLIND SEMANTIC REVIEW`
Date: 2026-10-25

The lock was taken BEFORE the first external action. Every digest below was
verified against the frozen artifacts of the stage.

## 1. The B6A Codex closure manifest

```text
$ cd docs/active/project/evidence/v3_media_companion/v3-completion/gc-b6a-codex-closure-2026-10-25
$ sha256sum -c PAYLOAD_MANIFEST.sha256
00-decision.md: OK
01-codex-hardening.md: OK
02-verification.md: OK
03-b6b-plan-and-architecture.md: OK
04-claudecode-b6b-prompt.md: OK
exit 0
```

## 2. The submitted B6A corrective package manifest

```text
$ cd docs/active/project/evidence/v3_media_companion/v3-completion/gc-b6a-corrective-implementation-2026-10-25
$ sha256sum -c PAYLOAD_MANIFEST.sha256
12/12 OK
exit 0
```

## 3. The B6 semantic-review preimplementation package manifest

```text
$ cd docs/active/project/evidence/v3_media_companion/v3-completion/gc-b6-semantic-review-preimplementation-2026-10-25
$ sha256sum -c PAYLOAD_MANIFEST.sha256
9/9 OK
exit 0
```

## 4. The current B6A file digests (the Codex hardening set)

Every file of the `01-codex-hardening.md` table was re-hashed and matched
the frozen digest EXACTLY. No drift.

| File | Digest match |
|---|---|
| `lib/b6_authority.mjs` | OK |
| `lib/b6_aggregate.mjs` | OK |
| `lib/review_bundle.mjs` | OK |
| `lib/review_capture.mjs` | OK |
| `sequencer.mjs` | OK |
| `test/b6_aggregate.node-test.mjs` | OK |
| `test/b6_thumbnail_seek.node-test.mjs` | OK |
| `test/b6_capture_filesystem.node-test.mjs` | OK |
| `test/_fixtures/seed_review_task.py` | OK |

The product, the harness, the contracts, the thresholds, the registry, the
rubric, the prompt and the historical evidence were NOT modified by this
batch. The lock held from the preflight to the stop.

## 5. The active registry

```text
registry sha256: 9c2da2f4c4c16fc94e1e0d7dfc9362ab1177d2db53f63d4af5a81a44795c9454
order:            1:BV11t8w6oEtP  2:BV1QcYx6VEAj  3:BV1v58B6GEan
                  4:BV1M5tJ6kEvw  5:BV1HTbi6LERi  6:BV1qM9fB8Eb2
reserves:         4 (never attempted, never substitutable)
substitutionAllowed: false
```

The registry digest and the order were verified by the production reader
(`lib/registry.mjs :: readFrozenRegistry`), which refuses a digest drift.
The reserve prohibition is enforced by the same module.

## 6. The explicit external inputs of the batch

| Input | Value | Freshness |
|---|---|---|
| The authorization id | an explicit, never-used-before one-shot id (its DIGEST only is in the evidence) | new for this run |
| The owned stage root | an explicit fresh directory outside every historical evidence tree | empty at the start (0 entries) |
| The private review root | an explicit fresh directory outside the repository, mode 0700 | empty at the start |
| The Cookie file | the EXPLICIT env var pointing at the product's single authorized constant path | inspected by the preflight without any value, length or path in the receipt |
| The Provider | the product's own configured Provider, bootstrapped by the product | verified by the preflight |

Nothing was searched: no Desktop sweep, no other repository, no disk scan.
The only Cookie location used is the ONE exact path the product itself
declares as its authorized constant, and it was passed EXPLICITLY.

## 7. The precommitment of the review

The review order, the rubric digest, the prompt digest and the two
evaluator session ids were frozen BEFORE the first external action and
before the first review: see `00-review-precommit.json`.

- rubric sha256: `e2583ba9973b2b105e1cd2086dc7d28d2346f298c97e39094d989d74db034c8d`
- prompt sha256: `97ceedd88adcce824aba749ecfbf5db0cce46603a88083b9235854a5f34635cc`
- first pass order: 1, 3, 5, 6, 2, 4
- sentinel: registry order 3, first pass position 2, second pass position 5,
  a different evaluator session.

The rubric and the prompt texts are retained in the PRIVATE review root
(the private root is retained until B7) and are not part of the public
evidence: the public evidence carries their digests only.
