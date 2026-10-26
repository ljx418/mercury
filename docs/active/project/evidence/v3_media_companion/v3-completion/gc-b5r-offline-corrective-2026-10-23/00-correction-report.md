# GC-B5R offline corrective — correction report

Date: 2026-10-23
Corrective of: `gc-b5r-offline-implementation-2026-10-23` (the rejected candidate)
Codex findings: `gc-b5r-offline-codex-checkpoint-2026-10-23/00-checkpoint-findings.md`
Status: **GC-B5R OFFLINE CORRECTIVE AWAITING CODEX CHECKPOINT**

No Chrome, Provider, cookie injection, download, media import, large asset,
audio, visible window or six-video execution happened in this batch. Every
count is zero; they are listed in `04-commands-and-results.md`.

---

## M-GCB5R-01 — restart dropped the generation authority and failed open

**Severity: Major — CLOSED.**

### The defect

`current_dependency_generation()` read only the process-level
`DEPENDENCY_LEASES` map, which a Runtime restart empties. The local binding was
then verified with `dependency_generation=None` and `verify_binding()` skipped
the comparison, so a local input prepared under another generation could reach
the Provider after a restart.

### The correction

| Change | Where |
|---|---|
| The process-global mirror is **removed** as an authority seam: the manager no longer publishes leases into it and the map stays empty | `media_companion/dependencies/manager.py` |
| The authority has **no** global reader. The CURRENT generation is supplied by an injected, manager-owned resolver | `media_companion/input_authority.py` |
| The comparison is **never skipped**: `verify_binding()` now REQUIRES a non-empty current generation and refuses with the existing frozen code `V3_MEDIA_DEPENDENCY_NOT_READY` when it is missing | `media_companion/local_import/binding.py` |
| The production composition in `app.py` supplies the real task store, the real local-import store, the real acquisition coordinator and a **manager-owned** resolver that re-verifies the snapshot when the task holds no lease | `navia_runtime/app.py` |
| The service's own default composition carries **no** resolver, so a local input can never be verified there and the route is refused before the Provider | `media_companion/comprehension/service.py` |
| The coordinator's LIVE task is now checked on **both** routes; a coordinator that holds no live entry (a restart) is not a refusal, so a valid durable terminal product stays readable | `media_companion/input_authority.py` |

No new failure code was invented: `V3_MEDIA_DEPENDENCY_NOT_READY` already
existed in the frozen media inventory.

### The tests

`services/local-runtime/tests/test_v3_gc_b5r_corrective_authority.py` (11 cases)
drives the REAL manager, coordinator, task store, local-import store, service,
validator and publisher:

| Case | Oracle |
|---|---|
| `test_c1_the_manager_is_the_only_lease_owner` | the lease lives in the manager instance; the global map stays empty |
| `test_c1_no_global_cross_instance_bleed` | a second instance holds no lease, re-verifies, and the first instance is unaffected |
| `test_c1_a_fresh_manager_with_the_same_generation_is_accepted` | a fresh manager (a fresh process) re-verifies the same generation → the synthesis publishes |
| `test_c1_a_changed_generation_is_refused_before_the_provider` | the current verified generation differs from the asset's → `V3_MEDIA_CROSS_TASK_REUSE`, no Provider call, no artifact |
| `test_c1_an_unverifiable_generation_is_refused_before_the_provider` | no verifiable current generation → `V3_MEDIA_DEPENDENCY_NOT_READY`, no Provider call, no artifact |
| `test_c1_a_missing_resolver_is_refused_before_the_provider` | an authority without the manager seam fails closed |
| `test_c1_a_live_coordinator_task_with_another_identity_is_refused` | a live acquisition of another media → `V3_MEDIA_TRANSCRIPT_SOURCE_MISMATCH` before the Provider |
| `test_c1_a_coordinator_without_a_live_entry_keeps_the_durable_verdict` | after a restart the durable verdict decides and the product stays readable |
| `test_c1_a_failed_authority_check_publishes_nothing` | the Provider count, the factory count and the published files are all unchanged |
| `test_c1_the_public_app_composition_drives_the_real_owners` | `app.py` composes the authority from the app's real stores, coordinator and manager over ONE Runtime database |
| `test_c1_the_public_app_composition_synthesizes_over_the_real_database` | the app's own service, authority, coordinator and manager publish the derivative |

---

## M-GCB5R-02 — the preflight accepted a mismatched declared source identity

**Severity: Major — CLOSED.**

### The defect

`inspectSource()` looked the declaration up by BVID key and reported it as
configured/available without ever checking that the declared identity was
`portal:bilibili:<that BVID>:<unit>:<part>`. A file prepared for one identity
could be declared under another frozen source and look ready in the very
preflight that exists to prevent substitution.

### The correction

`scripts/stage_b_b5_3/lib/preflight.mjs` now validates before anything is
reported as eligible:

* the declaration key is the frozen BVID;
* the declared identity is exactly `portal:<frozen adapter>:<frozen BVID>:<nonempty playbackUnitId>:<nonempty partId>`;
* the declared media id (and the registry's media id) equals the frozen BVID;
* the path is explicitly declared, exists, is a regular file and is **not** a
  symlink (`lstat` first, then the regular-file check);
* the path is not declared for another frozen source as well.

Every rejected declaration stays VISIBLE in the receipt as
`localAssetIneligibleReason` with a stable, nonsecret reason
(`identity_missing`, `identity_malformed`, `identity_foreign_portal`,
`identity_foreign_bvid`, `identity_empty_unit`, `identity_empty_part`,
`media_id_mismatch`, `path_missing`, `path_not_a_regular_file`,
`path_is_a_symlink`, `path_declared_for_another_source`, `not_declared`). The
unknown manifest keys and the duplicated paths are reported at the receipt
level. No file content is read, no digest is computed, no directory is
searched, every action counter stays zero and no source is marked passed.

### The tests

`scripts/stage_b_b5_3/test/gc_b5r_preflight.node-test.mjs` (31 cases) adds the
negatives: a foreign BVID, a wrong portal, a wrong adapter, a malformed
identity, an empty unit, an empty part, a missing identity, a media-id
mismatch, a symlink, a missing path, a directory, a duplicated path, an unknown
manifest key and an undeclared file. The matrix is in
`03-preflight-and-provider-lock-negative-matrix.md`.

---

## M-GCB5R-03 — the Provider lock conflated the Provider identity and the endpoint class

**Severity: Major — CLOSED.**

### The defect

`providerLockOffenders()` accepted any `providerId` **containing** `minimax`,
so `attacker-minimax-shadow` passed. It also accepted both
`minimax_chat_completions` (the endpoint/adapter class) and
`minimax-cn-openai-vision` (the product Provider id) in the same field, and
relied on an optional synthetic `providers` array.

### The correction

* `SELECTED_PROVIDER_ID = "minimax-cn-openai-vision"` — the selected PRODUCT
  Provider id, in its own field.
* `PROVIDER_LOCK = "minimax_chat_completions"` — the endpoint/adapter CLASS the
  runner pins.
* `providerLockOffenders()` validates both **exactly**, with no substring and no
  fuzzy acceptance, and still refuses a receipt that declares more than one
  provider authority. A bounded retry by the SAME Provider (a higher request
  count) is not a second Provider.
* The runner's evidence now records the selected id, the endpoint class and the
  OBSERVED values, so the receipt mirror, the isolation fingerprint and
  `provider_lock.txt` all carry the same two facts.
* The one-Provider proof is the **production composition**: the Runtime's
  factory is invoked once per task (asserted by the Python case
  `test_o05_exactly_one_provider_is_asked_per_task`, which counts the factory
  invocations) and exactly one authoritative receipt is published. The
  synthetic array is a secondary guard, never the primary oracle.

### The tests

The Node suite adds the lookalike, missing, wrong-endpoint, DeepSeek,
two-provider and bounded-retry cases; the Python suite proves the single
factory invocation.

---

## Minor 1 — the affected Node aggregate exited 1

**CLOSED.**

`scripts/stage_b_b5_3/test/run_offline_suite.mjs` is now the ONE offline
command. It:

* runs every offline runner test file, **serially** (`--test-concurrency=1`),
  and the resource-sensitive `real_branches.node-test.mjs` in its OWN phase,
  so its timing never depends on the other files;
* classifies `canary_bvid1.node-test.mjs` (PH0-AR-12) as `external_not_run` —
  it drives a real Chrome, a real cookie and the real Runtime — and does NOT
  count it as a pass;
* includes the new GC-B5R preflight and exact-lock tests.

The PH0-AR-10 SIGTERM case had a real race, not a timeout problem: a fixed
2-second sleep could fire the signal while the sequencer was still starting,
so the sequencer exited before it wrote its summary. It now waits for the stub
runner's own per-BVID marker — the readiness proof that the sequencer is in
its run loop — before it sends the signal. The timeout was not increased.

The command exits **0** (7/7 in the serial phase, 209/209 in the concurrent
phase).

## Minor 2 — the coordinator hook was test-injected only

**CLOSED.**

The production composition in `app.py` now injects the REAL acquisition
coordinator, so a live coordinator task with another identity is refused
before the Provider in production, and the durable task/import authority stays
decisive after a restart. The Python case
`test_c1_the_public_app_composition_synthesizes_over_the_real_database`
drives that composition end to end, so the coordinator is no longer a
test-only hook.

## Minor 3 — the candidate used JSON/Markdown manifests

**CLOSED.**

The corrective evidence ends with a mechanically verifiable
`PAYLOAD_MANIFEST.sha256`, generated only after every file stabilized and
verified with `sha256sum -c`.

---

## What was NOT done

* No public contract, fixed denominator, threshold, Provider authorization,
  Origin/auth ordering, WP-A/WP-B history or historical evidence changed.
* No relay fixture, inventory, schema, registry or verifier code was edited,
  and **nothing was refrozen** — the refreeze is Codex's.
* No commit, push, reset, clean, checkout, revert or unrelated-file cleanup.
* No real BVID attempt, no normal-video substitution, no generic seed reuse,
  no Chrome, Provider, cookie, download, import, audio or visible run.
* B-5 real execution, B-6, B-7, Stage C and WP-C were not entered.
