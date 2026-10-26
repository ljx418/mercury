# V3-5.10 Stage B: grounded comprehension quality

Date: 2026-10-13. Status: **detailed plan and contract-freeze candidate;
implementation NO-GO**. Stage A has a LIMITED PASS for its fixed negative-
journey scope in `stage-a-final-independent-exit-audit-2026-10-13.md`.
Stage B implementation still requires this package's independent document
audit and explicit user authorization.

## User-visible outcome

After one real video finishes processing, Overview shows:

1. a whole-video `VIDEO BRIEF` of 20-100 Unicode characters;
2. two to eight distinct claims, each opening direct task evidence;
3. semantic chapters that cover the substantive opening, middle and ending;
4. a collapsed timestamped transcript for inspection, not as the synopsis;
5. a visible limited/blocked state when the source ending, consent, provider or
   evidence closure is insufficient.

No first-minute excerpt may be promoted to a whole-video claim. No generated
illustration may be labelled as a source frame. The result remains bound to one
`taskId + taskRevision + evidenceCatalogSha256`.

## Architecture decision

Keep the current modular monolith and add a versioned derivative beside the V1
projection. Do not migrate historical tasks in place.

```text
published task/revision
  -> EvidenceSpanAnalyzer (availability + thirds + ending coverage)
  -> GroundedSynthesisProvider (derived text only, existing consent)
  -> GroundedComprehensionValidator (schema + semantic invariants)
  -> private revision-scoped V2 derivative (atomic replace)
  -> MediaComprehensionService projection adapter
  -> Overview brief / claims / chapters
```

Rejected alternative: replacing V1 outline fields in place. It is simpler in
the short term but breaks historical readers and prevents a truthful limited
result from coexisting with the old local preview.

## Frozen contracts

- Normative semantics: `stage-b-grounded-comprehension-contract.md`.
- Machine shape: `docs/active/project/contracts/v3_media_grounded_comprehension_v2.schema.json`.
- Negative denominator: `stage-b-contract-negative-fixtures.json`.
- Frozen source denominator: `stage-b-six-video-registry.json`.
- Existing cloud authorization is unchanged: only task-derived transcript/OCR/
  vision-caption text may be sent. Raw video, audio, frame bytes, Cookie, API
  key, local paths and transcript artifacts are not valid synthesis payloads.
- V1 historical projections remain readable. V2 is selected only when its task,
  revision and evidence-catalog hash exactly match current authority.

## Substages

| Stage | Implementation scope | Exit before next stage |
|---|---|---|
| B-0 | Freeze schema, failure codes, fixture registry and six-video rubric | Meta-schema PASS; every negative fixture maps to one expected failure; independent preimplementation audit Fatal 0 / Major 0 |
| B-1 | Add `EvidenceSpanAnalyzer` and pure temporal metrics | Unit tests for opening/middle/ending availability, ending coverage, 20%-window concentration and longest-chapter ratio |
| B-2 | Revise prompt and response parser for brief + claims + chapters | Contract fixtures pass; unknown evidence, raw-prefix brief and unsupported claim fail closed |
| B-3 | Add revision-scoped atomic V2 persistence at the frozen contract path and stale-authority guards | Old V1 remains readable; stale revision/hash rejected; failed synthesis leaves prior projection byte-identical |
| B-4 | Project V2 through existing API and Overview without changing consent | Focused Runtime/API/component tests; limited results cannot display a complete badge |
| B-5 | Fresh six-BVID real-source run | Six dispositions retained; every accessible video passes machine contract; blocked videos remain in denominator |
| B-6 | Host-model semantic review and one sentinel repeat | Exact reviewer model ID, prompt SHA-256 and session ID recorded before review; no critical factual error; rubric threshold met; repeat is semantically stable and independently task-scoped |
| B-7 | Independent implementation exit audit by a new ClaudeCode CLI/Orca reviewer whose task, dispatch and prompt hash differ from implementation and B-6 | Fatal 0 / Major 0; only then may Stage C enter detailed planning |

Every substage requires its own development/acceptance note and PRD check before
code starts. Any Major returns to this plan. Tests involving Chrome must include
`--mute-audio`.

## Fixed six-video denominator

`BV1pohR6rEEh`, `BV1hMpE6FEXG`, `BV1VHHe6kEH3`, `BV1SDHy6aEiB`,
`BV1vSHD6tEsM`, `BV1FCps68EGf`.

Each gets a fresh Runtime/database/profile/task and one immutable disposition:
`complete`, `limited`, `blocked`, or `failed`. No substitution, cross-run
artifact reuse or denominator reduction is allowed. All accessible videos must
reach `complete`; a truthfully restricted source may remain `blocked`, but two
or more blocked sources trigger NO-GO/replan because content-quality diversity
would be too weak. `limited` and `failed` never count as a positive output.

For every disposition record BVID, source identity, task ID, revision, evidence
catalog hash, media duration, source evidence span, region availability,
provider/model, authorization receipt, brief hash, claim/evidence map, chapter
intervals, quality failures and public secret-scan result.

## Machine acceptance

Positive `complete` projection:

- brief normalized length is 20-100 Unicode scalar values and is not a prefix
  or contiguous excerpt of any one transcript item;
- brief references direct evidence from every substantive third of the source;
- 2-8 nonduplicate claims, each with known evidence IDs; opening, middle and
  ending claims are present when those thirds are substantive;
- 2-12 chapters, strictly increasing and contiguous over the substantive
  evidence span; first/last chapter bind the first/last substantive evidence;
- if media duration is known, source evidence reaches at least 90% of it;
- with six or more chapters, no rolling 20% time window contains more than
  `ceil(chapterCount / 2)` chapter starts;
- with four or more chapters and substantive evidence in all thirds, no chapter
  consumes more than 60% of the substantive span;
- every claim/chapter reference belongs to the same task/revision/catalog;
- contradictions between transcript and OCR/vision are surfaced, not silently
  resolved; raw upload counters remain zero.

The validator returns a stable failure code and never silently trims a failed
brief, invents evidence or promotes fallback chunk summaries to `complete`.

## Host-model content review

The current Codex host reviews the published output against bounded source
excerpts, not against title alone. For each accessible video score 1-5:
accuracy, whole-span coverage, summarization value, claim/evidence fit, chapter
temporal fit. Every dimension must be at least 4, with zero critical factual or
named-entity error. The reviewer must identify the opening/middle/ending source
support for the brief and at least three sampled claims. Machine PASS cannot
override a failed semantic review.

One accessible sentinel video is repeated in a new task. Byte identity is not
required, but the topic, major claims and chapter order must be semantically
equivalent; any contradiction or loss of an entire substantive third is Major.
The same recorded host model and frozen rubric prompt must review every
accessible video. If the terminal cannot expose a stable model ID before the
first judgment, B-6 is NO-GO rather than an anonymous review.

## Negative denominator

No transcript, absent frame, partial/restricted acquisition, unknown evidence
ID, conflicting OCR/subtitle, missing ending, raw-prefix brief, overlong brief,
duplicate claims, stale revision, changed evidence hash, extreme early chapter
cluster, oversized tail chapter, model timeout, malformed provider response and
failed consent. Each must be rejected or published only as explicitly limited
according to the frozen fixture registry.

## Exit and non-expansion

Stage B exit requires six recorded dispositions, all accessible videos machine
and host-review PASS, sentinel repeat PASS, focused tests, real muted Chrome UI
evidence and a separate independent audit with Fatal 0 / Major 0. This does not
approve Stage C-D, final V3, PX-6, V4 knowledge/memory, or broader portal support.

