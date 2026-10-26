# RC1 — the child grants are AUTHORITATIVE and ONE-USE

Oracle: `scripts/stage_b_b5_3/test/authorization_composition.node-test.mjs`
(15 cases, 15 pass, exit 0).

## The trust anchor: the CONSUMPTION MARKER

Before this batch the grant carried its own `grantDigest`: a SELF-COMPUTED,
UNKEYED digest. Anybody who could write a file could compute a matching
digest, so the grant was effectively SELF-SIGNED and proved nothing.

The authority is now the **consumption marker**: the file that the sequencer
creates ONCE, atomically (`O_EXCL`), keyed by the one-way digest of the
authorization. It records the digest, the run id, the registry digest and
the id AND the digest of every child grant it issued.

```text
<stageRoot>/authorizations/<sha256(authorizationId)>.consumed
<stageRoot>/grants/<grantId>.grant.json
<stageRoot>/grants/<grantId>.used
```

The marker schema (`v3-5.10-b5-authorization/v2`) and the grant schema
(`v3-5.10-b5-child-grant/v2`) have an EXACT key set. A record with another
key set is CORRUPT and fails closed.

## What `verifyChildGrant()` proves, before the Cookie read and before Chrome

| # | what is proven | the refusal |
|---|---|---|
| 1 | the consumption marker EXISTS, parses EXACTLY and carries the digest and the run | `authorization_marker_missing`, `authorization_marker_corrupt` |
| 2 | the digest the SEQUENCER supplied matches the marker | `authorization_marker_digest_mismatch` |
| 3 | the marker's run id and registry digest match the supplied ones | `authorization_marker_run_mismatch`, `authorization_marker_registry_mismatch` |
| 4 | the marker ISSUED this grant id for THIS source | `child_grant_not_issued`, `child_grant_filename_mismatch`, `child_grant_order_mismatch` |
| 5 | the grant file exists and parses exactly | `child_grant_missing`, `child_grant_corrupt` |
| 6 | the grant agrees with the TRUSTED marker on the digest, the run, the registry, the order, the bvid and the EXACT ordered six identities | `child_grant_digest_mismatch`, `child_grant_run_mismatch`, `child_grant_registry_mismatch`, `child_grant_order_mismatch`, `child_grant_identity_mismatch` |
| 7 | the grant's OWN digest is NOT an authority: it must match the copy the MARKER holds | `child_grant_digest_mismatch` |
| 8 | the grant id equals a RECOMPUTATION from the trusted fields | `child_grant_filename_mismatch` |
| 9 | the per-source grant is consumed ATOMICALLY ONCE | `child_grant_already_used` |

The child's verification CONSUMES the grant (step 9): the first child that
proves its grant takes it, and a replay is refused.

## The negative receipts

Every negative case drives the REAL runner (`run_one_bvid.mjs`) and asserts
the SAME receipt of "no external action":

```text
the exit is non-zero
the stdout carries no "authorized cookies"   → zero Cookie read
the stdout carries no "Chrome launched"      → zero Chrome launch
the stdout carries no "Runtime ready on port" → zero Runtime start
the durable ledger carries NO event          → zero ledger external action
the machine receipt: cookieInjectionCount 0, muteAudioVerified false,
                     provider.attempted.attemptCount 0, provider.published null,
                     disposition failed, failureCode VISIBLE_AUTHORIZATION_REFUSED
the final disposition names the exact refusal reason
```

| the case | the refusal |
|---|---|
| an ENTIRELY FORGED, SELF-SIGNED grant (every bound field kept, one unbound field tampered, the grant's own digest RECOMPUTED) | `child_grant_digest_mismatch` |
| a grant under an ARBITRARY FILE NAME | `child_grant_filename_mismatch` |
| an ABSENT consumption marker | `authorization_marker_missing` |
| a MISMATCHED consumption marker (its digest no longer matches) | `authorization_marker_digest_mismatch` |
| a MISMATCHED authorization digest | `authorization_marker_missing` |
| a SECOND USE of a valid child grant | `child_grant_already_used` |
| a directly invoked child WITHOUT a grant | `child_grant_missing` |
| a SUBSTITUTED / REORDERED / STALE / CROSS-RUN grant | the matching refusal |

The forged-grant case is the direct proof of the correction: the forger
recomputes the grant's own digest and it STILL fails, because the marker's
copy is the authority.

## The retained composition and race tests

* `RC1: one sequencer authorization permits exactly the six expected children`
  — the six-child composition is retained.
* `RC1: two concurrent sequencers produce exactly one winner` — the race is
  retained: the `O_EXCL` marker decides exactly one winner.

## One authorization owner

The superseded implementation was removed:

* `scripts/stage_b_b5_3/lib/action_ledger.mjs` no longer exports
  `consumeAuthorization` or `readConsumedAuthorizations`, and the legacy
  `consumed-authorizations.jsonl` file — which PERSISTED THE RAW
  AUTHORIZATION VALUE — is gone.
* Its two legacy tests were removed from
  `scripts/stage_b_b5_3/test/action_ledger.node-test.mjs`.
* The ONE owner is `scripts/stage_b_b5_3/lib/authorization.mjs`.

The raw authorization value is never persisted: the marker, the grant and
the use receipt hold the DIGEST only, and the case
`RC1: the raw authorization value is never persisted` walks the whole stage
root and proves it.

## The honest limits

* The stage root is the trust boundary. Whoever can write inside it can
  write a marker; the model is "the sequencer owns the stage root", and the
  root is created with mode 0700.
* The authorization identifier still arrives through the environment of the
  sequencer. The batch proves that it is consumed once, atomically, and
  that it never reaches the disk or the evidence.
* A grant is one-use, so a RETRY of the same source needs a fresh
  authorization. The FC3 re-entry case was updated accordingly: the retry
  carries its own authorization and keeps the same run id, the same source
  and the same evidence root.
