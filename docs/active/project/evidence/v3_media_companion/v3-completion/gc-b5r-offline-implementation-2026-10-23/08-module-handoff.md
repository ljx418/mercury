# Module handoff — GC-B5R (template-aligned)

## Module

```text
Module: GC-B5R — Grounded Comprehension Recovery (offline implementation + preflight)
Owner Agent: ClaudeCode
Date: 2026-10-23
Stage Gate: docs/active/project/stage-gates/ — V3-5.10 Stage B B-5 (NOT passed, NOT claimed)
```

## Change Summary

```text
Changed files:
  services/local-runtime/navia_runtime/modules/media_companion/local_import/binding.py        (new)
  services/local-runtime/navia_runtime/modules/media_companion/local_import/store.py            (+ list_for_task)
  services/local-runtime/navia_runtime/modules/media_companion/input_authority.py              (new)
  services/local-runtime/navia_runtime/modules/media_companion/comprehension/service.py        (input refusal)
  services/local-runtime/navia_runtime/modules/media_companion/dependencies/manager.py         (lease mirror)
  services/local-runtime/tests/test_v3_gc_b5r_input_authority.py                              (new, 32 cases)
  scripts/stage_b_b5_3/lib/preflight.mjs                                                      (new)
  scripts/stage_b_b5_3/lib/contracts.mjs                                                      (+ providerLockOffenders)
  scripts/stage_b_b5_3/sequencer.mjs                                                          (frozen registry + --preflight-only)
  scripts/stage_b_b5_3/run_one_bvid.mjs                                                       (frozen identity + provider lock)
  scripts/stage_b_b5_3/test/gc_b5r_preflight.node-test.mjs                                   (new, 18 cases)
  scripts/stage_b_b5_3/test/sequencer.node-test.mjs                                           (alt-sequencer fix-up)
  scripts/stage_b_b5_3/test/real_branches.node-test.mjs                                       (alt-sequencer fix-up)

Behavior added:
  - ONE input authority that composes the durable owners (task store source authority,
    local-import binding, task dependency lease) and refuses a foreign task, a foreign
    media identity in ANY component, a stale revision, a closed local import and a
    cross-run generation BEFORE any Provider is asked and again before the publication.
  - A PREFLIGHT-ONLY runner mode that inspects the six frozen identities and the
    explicitly configured local-asset availability, reports all eleven action counts as
    zero, and never claims that a BVID passed.
  - The runner refuses a substituted (order, bvid) pair before anything starts, and the
    task Provider lock now rejects zero Providers and two Providers.

Behavior intentionally not added:
  - No Provider fallback, best-of-N, cross-Provider stitching, threshold reduction,
    padding, truncation, paraphrase repair or fabricated claim.
  - No second orchestrator and no competing cleanup owner.
  - No new failure code, schema, endpoint, threshold, message set or Provider registry.
  - No tabCapture use (it stays default-off), no BVID substitution, no generic seed reuse.
  - No Chrome, Provider, cookie, download, import, audio or visible-window activity.
```

## Contract Status

```text
Public API changed: no
Adapter contract changed: no
Data model changed: no
Event type changed: no
If yes, V1.2-0 review path: n/a — there is no contract change. The only new public
  surface is an optional constructor argument (MediaComprehensionService(input_authority=))
  and an internal composition; the HTTP surface, the request bodies, the response shapes
  and the error codes are unchanged. The Runtime does not even use the argument: it
  composes the default authority itself.
```

## Evidence

```text
Unit/contract tests run:
  python3 -m pytest tests/test_v3_gc_b5r_input_authority.py -q            → 32 passed, exit 0
  python3 -m pytest tests/test_v3_media_comprehension.py -q                → 28 passed, exit 0
  focused Runtime suites (comprehension, acquisition, local import, dependency,
    product, outline, WP-B lifecycle)                                     → 318 passed, exit 0
  node --test scripts/stage_b_b5_3/test/gc_b5r_preflight.node-test.mjs    → 18/18 passed, exit 0
  node --test scripts/stage_b_b5_3/test/*.node-test.mjs                   → 204 tests, 202 passed,
                                                                            2 failed (both pre-existing
                                                                            integration/flake cases, see 03 §5)
  relay v11 contract verifier                                             → 50/50, exit 0
  relay v11 mutation verifier                                             → 16/16, exit 0

Fixture evidence path:
  docs/active/project/evidence/v3_media_companion/v3-completion/gc-b5r-offline-implementation-2026-10-23/

Real data evidence path:
  NONE. No real BVID was run, no real media was downloaded, imported or generated in this
  batch, and no local asset was configured for the preflight. The preflight's six sources
  are reported as "not configured" — a statement about the configuration, not a result.

Chrome evidence path, if applicable:
  NONE — Chrome was never launched and no visible window was ever opened. Chrome launch
  count 0, visible window count 0.

Trace evidence path, if applicable:
  docs/active/project/evidence/v3_media_companion/v3-completion/gc-b5r-offline-implementation-2026-10-23/preflight/preflight-receipt.json
  docs/active/project/evidence/v3_media_companion/v3-completion/gc-b5r-offline-implementation-2026-10-23/relay/relay-v11-baseline-summary.json
  docs/active/project/evidence/v3_media_companion/v3-completion/gc-b5r-offline-implementation-2026-10-23/relay/relay-v11-mutations-summary.json
```

## PRD Coverage

```text
Covered PRD IDs:
  - Stage B grounded comprehension V2 contract: "Identity and persistence",
    "Evidence regions", "Brief and claims", "Chapters", "Status and failure codes",
    "Authorization and disclosure", "API and UI mapping".
  - The GC-B5R goal clauses G1 (source authority composition), G2 (grounded synthesis
    invariants), G3 (lifecycle and cleanup), G4 (runner hardening + preflight-only mode)
    and G5 (the twelve obligations O01-O12).
  - The acceptance plan's twelve obligations O01-O12.

Not covered:
  - The real six-video run of B-5 (forbidden in this batch), and therefore every
    end-to-end property that only a real run can show: the real transcript/OCR/frame
    quality, the real Provider round trip and the real Extension rendering.
  - The extension subtree, its typecheck and its build: no extension or shared TypeScript
    was changed by this batch, so the acceptance plan's conditional class does not apply.
    The last green extension results are the WP-B closeout's, not this batch's.

Reason:
  - The authorization of this batch ends at the offline candidate. A real run needs
    Chrome, a cookie, network, a Provider and a media download, every one of which is
    explicitly prohibited here.
```

## Integration Handoff

```text
Inputs Integration must provide:
  - An explicitly configured local-asset manifest (--local-asset-manifest or
    NAVIA_STAGE_B_LOCAL_ASSETS) for the preflight to inspect a declared asset, and
    - the real six-BVID run environment (Chrome, the cookie, the Runtime and the
    Provider authorization) for B-5 itself.

Outputs Integration should consume:
  - The input authority: media_companion/input_authority.py + local_import/binding.py,
    wired into the comprehension service at the two refusal points.
  - The preflight-only mode: scripts/stage_b_b5_3/sequencer.mjs --preflight-only=1 and
    its receipt (preflight/preflight-receipt.json).
  - The frozen-identity refusal and the Provider lock in the runner.

Known assumptions:
  - The local-import store and the media task store share ONE Runtime database, so the
    default authority reads the durable binding from that database. This is how the
    Runtime builds them today (both use default_db_path()).
  - The task's dependency lease is the current generation; a task without a lease has
    no current generation to compare against — the same rule the WP-B orchestrator
    already applies.

Known risks:
  - The lease is in-memory, so after a Runtime restart the generation comparison is
    skipped (Minor 1 of 07-risks-and-handoff.md).
  - The coordinator check inside the authority is an injection, not a production path
    (Minor 2); the durable owners already enforce the identity binding.
  - The preflight inspects a declared asset with stat only; it never reads or verifies
    the content.

Stop conditions:
  - Stop and report to Codex if the real run would need a public schema, a FailureCode,
    a threshold, the registry, the fixed denominator, the upload authorization, the
    Origin/auth ordering or a security-boundary change.
  - Stop if a fixed BVID could only pass by substitution, generic seed reuse or a
    source-identity override.
  - Do not start B-6, B-7, Stage C or WP-C from this package.
```

## No-Go Self Check

- [x] I did not edit another module's implementation directory. The touched paths are
      the media_companion module, the Stage B runner scripts and this evidence package.
- [x] I did not bypass D Adapter Layer or governance. The capture relay, the Provider
      authorization, the consent flow and the Origin/auth ordering are untouched; the
      relay-v11 baseline and mutation verifiers are green.
- [x] I did not create ad-hoc event strings. The only new identifiers are the existing
      frozen failure codes and the new module/function names of this workpack.
- [x] I did not use mock-only evidence as real E2E evidence. The Provider double is
      labelled as such, the preflight is labelled as an inspection, and no real Chrome
      or real BVID evidence is claimed.
- [x] I did not introduce V1 out-of-scope features. No RAG, no memory, no multi-agent
      orchestration, no browser automation, no network search, no voice, no desktop pet,
      no deep research and no PPT generation.
