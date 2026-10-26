# Risk review and document gate

## Findings closed by this rebaseline

1. The inaccessible charge-exclusive v1 sources are not silently removed from
   history. They remain in the immutable v1 registry and historical FAIL/REPLAN
   evidence.
2. The new denominator is explicit: six primary sources selected by user order,
   plus four reserves that cannot be used at runtime.
3. Public metadata reachability is not presented as product acceptance.
4. The runner's current aggregate exit false-green is called out as required
   implementation work before real execution.
5. Cookie, isolated Provider configuration and installed dependency readiness
   are explicit pre-Chrome gates rather than assumptions.
6. One visible-batch and no-blind-retry rules preserve the user's focus budget.

## Remaining risks

- Public metadata may be reachable while playback/audio/download is blocked.
- A source may disappear between preflight and its fresh run.
- The isolated Runtime may lack a supported way to bind the already verified
  Provider without secret material crossing into the runner.
- Six long videos can exceed the expected execution window or local disk budget.
- Cloud Provider output can fail V2.1 quality validation without constituting an
  infrastructure defect.

Each risk has a fail-closed stop in `03-development-and-acceptance-plan.md`.
No fallback authorizes source substitution, direct database writes, raw-media
cloud upload or tabCapture re-entry.

## Document decision

Fatal 0 / Major 0 / Minor 2:

1. Metadata was observed once and must be rechecked immediately before run.
2. Titles and durations are informational; content diversity is not a B-5
   machine oracle and remains subject to B-6 human semantic review.

The documents are sufficient for one ClaudeCode implementation/execution
workpack. The next Codex action is the B-5 checkpoint, not another document
audit.

