# AI3 — CI1 and the existing boundaries are preserved

The batch did NOT touch the accepted leak-sighting behavior. The CI1 process
regression is unchanged and still green.

## The CI1 process regression

`an OWNED descendant that exits before the closeout is still a leak`
(`scripts/stage_b_b5_3/test/sequencer.node-test.mjs`):

| the required fact | the assertion |
|---|---|
| a sighting remains FATAL after the child exits | the descendant outlives its source runner, the sequencer cleans it (so it is DEAD at the closeout) and the LATCHED sighting still fails the batch: `leakedAfter > 0`, `stillAliveAtCloseout === 0`, `ok === false`, `verdict.positive === false`, `AGG_AUDIT_FAILED … leaked an owned process` |
| only the FIRST source runs | `summary.bvids.length === 1` |
| the owned descendant is cleaned | `summary.processAudit.killedOwnedPids.length > 0` |
| an unrelated process stays alive | the unrelated live process is still alive (`killed === false`, `exitCode === null`) after the owned cleanup |

The sibling case `an UNRELATED live runner is neither counted nor killed`
(sequencer and real_branches) still proves that an unrelated runner is
neither counted (`leakedAfter === 0`) nor killed.

## The boundaries that did not change

| the boundary | the state |
|---|---|
| public API | unchanged — no endpoint, request or response shape changed |
| schema | unchanged — the frozen V2.1 candidate schema, the frozen V2.1 derivative schema and the frozen Stage B contract are byte-identical. The batch READS the frozen derivative contract |
| FailureCode | unchanged — the batch CONSUMES the frozen codes and adds none |
| threshold | unchanged — the positive threshold is untouched |
| message | unchanged — no error message, no stop reason and no evidence field was renamed; the new aggregate failure codes belong to the INTERNAL evaluator |
| Provider registry | unchanged — `minimax-cn-openai-vision` / `minimax_chat_completions` are still the locked identity, and the derived-text scope is still `transcript`, `ocr`, `vision-caption` |
| Origin/auth order | unchanged — the runner still issues the companion session and sends the bearer in the same order |
| the frozen source denominator | unchanged — the six identities, their order and the registry digest `9c2da2f4…` are untouched |
| the historical evidence | unchanged — every prior package still verifies against its own manifest |

## The validators were NOT weakened

* The frozen receipt identity check got STRICTER: `requestCount` must now be
  an integer `>= 1` (it accepted `0` before).
* The mirror checks got STRICTER: the schema version, the wrapper key set
  and the locked selection are REQUIREMENTS now, not conditional checks.
* The aggregate got STRICTER: a complete source must carry the durable
  artifact, its bytes must hash to the declared digests, the artifact must
  satisfy the frozen contract, the receipt hash must be recomputable and the
  identities must cross-bind.
* The positive stub got STRICTER: it writes a REAL V2.1 artifact and derives
  every hash from its bytes. The oracle was NOT relaxed to keep the old
  stubs green.

## The one behaviour that was corrected in the runner

The runner's privacy audit rewrote the evidence files IN PLACE. It now
NEVER rewrites the published artifact: the artifact's bytes are the
evidence, so a path inside it is a FAIL-CLOSED condition (the source is
refused) instead of a silent rewrite that would break the byte identity.

The secret scan still covers the artifact: a secret inside it is a hit and
the sequencer hard-stops.
