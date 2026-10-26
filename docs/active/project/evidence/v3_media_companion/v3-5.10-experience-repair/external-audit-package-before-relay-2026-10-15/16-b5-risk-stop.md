# Stage B B-5 route 2 risk stop

Date: 2026-10-14. Decision: **B-5 FAIL / REPLAN; remaining five fixed videos,
B-6 and B-7 are NO-GO.**

## Stop reason

Route 2 correctly recovers only two brief-specific failures after the one
allowed full-contract repair. In the latest fresh real run for
`BV1pohR6rEEh`, the repaired candidate failed `claims` cardinality validation.
That is a non-brief contract failure, so the deterministic brief composer was
correctly not invoked.

Continuing the remaining five videos would not close the first fixed
denominator item. Repeating until MiniMax happens to return a valid object would
also violate the bounded-retry rule and create false-green selection bias.

## Preserved facts

- Local preview, acquisition and Workspace publication remain intact.
- Failed synthesis did not overwrite an accepted grounded derivative.
- Route 2 unit/component/build gates remain green.
- The six-video denominator is unchanged and no inaccessible or failed video
  has been removed.
- No test played audio.

## Required replan decision

A next route must freeze the provider-independent contract described in
`stage-b-multi-provider-structured-output-assessment-2026-10-14.md` before
implementation. Selecting a provider-side strict mode is necessary when one is
available, but it is not sufficient: schema-valid output can still contain
unsupported claims, invalid evidence references, poor whole-video coverage or
incorrect chapter boundaries.

The replan must therefore include all of the following:

1. a canonical `GroundedSynthesisProvider` boundary that is independent from
   the visual-frame provider;
2. explicit provider/model/endpoint capability negotiation instead of inferring
   behavior from a provider name;
3. one shared schema validator and one shared semantic/evidence validator after
   every provider adapter;
4. atomic publication from exactly one successful attempt, with no cross-provider
   merging or silent best-of-N selection;
5. a qualification record bound to provider, model, endpoint, structure mode
   and schema hash before the provider may enter the fixed six-video run.

Candidate mechanisms to qualify behind that boundary are:

1. provider-side strict structured output/tool schema, if MiniMax exposes a
   reliable compatible mechanism;
2. DeepSeek strict tool or Responses JSON Schema after its account can enter
   inference and passes the frozen qualification denominator;
3. OpenAI, Gemini or an eligible Qwen text model after the same qualification;
4. deterministic selection of already valid provider claims from the initial
   candidate when the repair regresses an unrelated field, with explicit
   provenance and proof that no local claim text is invented;
5. another qualified provider behind the same canonical adapter and fixed
   acceptance denominator.

Local claim generation, claim-count padding, threshold reduction and unbounded
provider retries remain prohibited. A new plan, fixtures and independent
preimplementation review are required before B-5 resumes.

## DeepSeek probe addendum

The authorized desktop key was read in memory and tested only with synthetic
evidence. Three calls each were attempted for Chat JSON Object, beta strict tool
calling and Responses JSON Schema. All nine requests returned HTTP 402 before
inference. This proves neither output quality nor incompatibility; it means the
current account/payment state cannot qualify DeepSeek as a fallback.

The sanitized report is `deepseek-structured-output-probe.json`. It contains no
key, prompt, model response, real project evidence or local secret path.

