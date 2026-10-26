# FC1 — the batch-owned, atomic, one-shot visible authorization

Oracle: `scripts/stage_b_b5_3/test/authorization_composition.node-test.mjs`
(9 cases, 9 pass, exit 0).

## The ownership

The authorization moved INTO the sequencer. The sequencer now owns it:

```text
scripts/stage_b_b5_3/sequencer.mjs
  const authorization = consumeAuthorization({
    stageRoot, authorizationId: process.env.NAVIA_B5_AUTHORIZATION_ID,
    runId, registrySha256, identities: FROZEN_SIX,
  });
  if (!authorization.ok) { ... process.exit(1); }   // BEFORE any child
```

The child (`run_one_bvid.mjs`) no longer consumes anything. It only VERIFIES
the durable grant it was given:

```text
scripts/stage_b_b5_3/run_one_bvid.mjs
  verifyChildGrant({ stageRoot, grantId, authorizationDigest, runId,
                     registrySha256, order, bvid, identities })
```

The grant check happens BEFORE the Cookie inspection and BEFORE Chrome: the
refusal branches perform no external action at all.

## The properties, one by one

| required property | how it is implemented | the proving case |
|---|---|---|
| one authorization is consumed EXACTLY ONCE for the whole six-source candidate | the sequencer consumes it once, before the loop; the six children only verify | `FC1: one sequencer authorization permits exactly the six expected children` |
| a durable child grant bound to the authorization digest, the run id, the registry digest and the exact ordered six identities | `grantDigest` covers `schemaVersion, authorizationDigest, runId, registrySha256, order, bvid, identities, createdAt` | the same case |
| the children verify the grant and never consume the identifier | `verifyChildGrant` is the only child-side call; the identifier never reaches a child | the same case |
| a directly invoked `run_one_bvid.mjs` without a valid parent grant fails BEFORE the Cookie read or Chrome | the grant verification is the first gate of the runner | `FC1: a directly invoked child without a grant performs no external action` |
| a second sequencer with the same authorization is refused before Chrome | the O_EXCL marker is already present | `FC1: a second sequencer with the same authorization is refused before Chrome` |
| two concurrent sequencers produce EXACTLY ONE winner | `fs.openSync(marker, "wx", 0o600)` is atomic across processes | `FC1: two concurrent sequencers produce exactly one winner` |
| malformed authorization / grant state refuses | every parse failure is a refusal, never a default | `FC1: a corrupt authorization state fails closed` |
| the raw authorization value is never persisted | only the one-way sha256 digest is written | `FC1: the raw authorization value is never persisted` |
| a substituted, reordered, stale or cross-run child grant is refused | the digest is checked FIRST, then the run id, the registry digest, the order and the identity | `FC1: a substituted, reordered, stale or cross-run grant is refused` |
| the grant id and the digest are one-way | sha256 over a joined, ordered tuple | `FC1: the grant id and the digest are one-way` |
| a missing authorization refuses the sequencer before any child | the refusal precedes the loop | `FC1: a missing authorization refuses the sequencer before any child` |

## The refusal vocabulary

Every refusal has a frozen reason, and a refusal is always a refusal (never a
warning, never a default):

```text
authorization_missing          authorization_already_consumed
authorization_state_corrupt     child_grant_missing
child_grant_corrupt            child_grant_run_mismatch
child_grant_registry_mismatch  child_grant_identity_mismatch
child_grant_order_mismatch     child_grant_digest_mismatch
child_grant_substituted
```

## The atomicity

The consumption marker is created with `O_EXCL` (`fs.openSync(marker, "wx")`)
and it is keyed by the ONE-WAY digest of the authorization identifier:

```text
<stageRoot>/authorizations/<sha256(authorizationId)>.consumed
<stageRoot>/grants/<grantId>.json
```

The raw identifier is never written to disk, never logged and never put into
the evidence. The grant file holds the digest, the run id, the registry
digest, the order, the bvid, the identity list and the creation time — and
nothing else.

## The external action count of every refusal branch

Every refusal branch is proven to be inert:

* the sequencer refusals happen before the loop, so no child is spawned, no
  Chrome is launched, no Runtime is started and no Cookie is read;
* the child refusals happen before the Cookie inspection and before Chrome,
  so the runner writes its failure evidence and exits non-zero without a
  single external action.

The cases that assert this are `FC1: a second sequencer with the same
authorization is refused before Chrome`, `FC1: a missing authorization
refuses the sequencer before any child` and `FC1: a directly invoked child
without a grant performs no external action`.

## The honest limits

* The atomicity is an O_EXCL create on a POSIX filesystem. On a filesystem
  without atomic exclusive create the guarantee degrades to "best effort";
  the owned stage root is a local directory, so the guarantee holds here.
* The authorization identifier still arrives through the environment of the
  sequencer. The batch proves that it is consumed once, atomically, and that
  it is never persisted; it does not prove that the environment of the
  sequencer is protected from a local reader.
