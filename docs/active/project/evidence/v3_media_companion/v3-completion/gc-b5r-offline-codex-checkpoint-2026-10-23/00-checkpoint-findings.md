# GC-B5R offline Codex checkpoint

Date: 2026-10-23  
Disposition: **CORRECTIVE REQUIRED / REAL B-5 RUN REMAINS NO-GO**

## Verified candidate facts

- Candidate evidence manifest content hashes: 29/29 match.
- New Runtime tests: 32/32 pass under Codex replay.
- New preflight/runner tests: 18/18 pass under Codex replay.
- PH0-AR-10 real-branch file: 7/7 passes in isolation.
- Candidate reports relay v11 50/50 and mutations 16/16 with `app.py`
  restored to the frozen byte state.
- No Chrome, Provider, download, import, cookie, audio, or six-video action was
  performed by the candidate or this checkpoint.

## Findings

### M-GCB5R-01 — restart drops the generation authority and fails open

Severity: **Major**

`input_authority.current_dependency_generation()` reads only the process-level
`DEPENDENCY_LEASES` map. A Runtime restart empties the map. The local binding is
then verified with `dependency_generation=None`, and `verify_binding()` skips
the comparison. The production-default test also succeeds without a live lease,
so the test locks in the fail-open behavior.

This violates O03 and the workpack requirement that a local input remain bound
to the current dependency generation and that cross-run reuse be rejected
before Provider invocation. Similar historical WP-B behavior does not waive
the stricter GC-B5R authority gate.

Required correction: make `MediaDependencyManager` remain the only generation
owner, explicitly inject the production authority composition, reacquire or
resolve a verified current snapshot after restart, and fail closed when a local
binding has no verifiable current generation. Remove the global mirror as an
authority seam. Add fresh-process same-generation and changed-generation tests.

### M-GCB5R-02 — preflight accepts a mismatched declared source identity

Severity: **Major**

`inspectSource()` looks up a declaration by BVID key and reports it as
configured/available, but only copies `declared.sourceIdentity`; it never
validates that the identity is `portal:bilibili:<that BVID>:<unit>:<part>`.
Thus a file for one identity can be declared under another frozen source and
look ready in the preflight intended to prevent substitution.

Required correction: validate exact portal, adapter, BVID/mediaId, nonempty
playback unit and part before an asset is eligible. Missing, malformed, foreign,
symlinked, or non-regular declarations must remain in the receipt as ineligible
with a nonsecret reason; they must not be counted as matching/available.

### M-GCB5R-03 — Provider lock conflates provider identity and endpoint class

Severity: **Major**

`providerLockOffenders()` accepts any `providerId` containing `minimax`, so
`attacker-minimax-shadow` passes. It also accepts both
`minimax_chat_completions` and `minimax-cn-openai-vision`, although the former
is an adapter/endpoint class and the latter is the current product Provider ID.
The synthetic optional `providers` array is not the production receipt's proof
that the factory was called once.

Required correction: validate the exact selected Provider ID and exact
`endpointClass` in their own fields; remove substring acceptance. Prove one
Provider by production composition/factory invocation and one receipt, not an
optional synthetic array. Add lookalike, missing, wrong endpoint, and two-factory
negative tests.

## Minor findings included in the same correction

1. The affected Node aggregate is exit 1. Classify PH0-AR-12 as an explicit
   external/visible prerequisite rather than an offline failure, and make the
   PH0-AR-10 offline run deterministic under the declared test command.
2. The coordinator hook is test-injected only. The corrected production
   composition should inject the real coordinator for live-task checking while
   retaining durable task/import authority after restart. Do not claim the hook
   as end-to-end until the public app composition test drives it.
3. The candidate uses JSON/Markdown manifests rather than a self-checking
   `PAYLOAD_MANIFEST.sha256`. The hashes are valid, but the corrective evidence
   should include one mechanically verifiable manifest after all files stabilize.

## Change-control decision

ClaudeCode is authorized to modify `app.py` for the real internal composition.
This is an internal wiring correction, not a public contract change. Because
`app.py` is a relay v11 source scope, the expected temporary result may be a
source-hash-only verifier failure with `unlistedBoundaryEmits={}`. ClaudeCode
must not self-refreeze. After the corrected candidate is stable and semantically
clean, Codex will perform the one limited v11 source-scope refreeze.

Fatal 0 / Major 3 / Minor 3. The real six-video run, B-6, B-7, Stage C, and
WP-C remain unauthorized.
