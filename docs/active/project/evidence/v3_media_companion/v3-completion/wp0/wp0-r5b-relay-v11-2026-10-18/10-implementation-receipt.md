# R5-B relay v11 implementation receipt

## Decision

`R5-B RELAY V11 OFFLINE PASS / VISIBLE POSITIVE PENDING`

This checkpoint implements the authorized internal relay v11 correction for unique authoritative Offscreen
context binding. It does not declare R5 PASS and does not authorize R6 implementation.

## Implemented boundary

- Background remains the only Runtime WebSocket and capture orchestration owner.
- Offscreen remains a PCM producer and receives no Runtime ticket, source identity or acquisition identity.
- `MessageSender.documentId` is optional evidence, not the authoritative identity source.
- Background resolves exactly one `OFFSCREEN_DOCUMENT` with exact bundled URL, extension origin and incognito
  state; its non-empty `documentId` is the live binding key.
- A present sender document ID must match the authoritative context ID. An absent sender document ID is accepted
  only after the complete unique-context decision succeeds.
- Validation is asynchronous but message/disconnect handlers are registered before the await and gated until the
  decision completes. Pre-validation traffic fails closed and cannot mutate transport ownership.
- Background and Offscreen use `navia.mediaCapture.audio/v11` atomically. There is no v10 fallback or dual accept.

## Changed product and contract surface

Primary product files:

- `apps/chrome-extension/src/modules/media_companion/capture/relayContracts.ts`
- `apps/chrome-extension/src/modules/media_companion/capture/OffscreenAudioPort.ts`
- `apps/chrome-extension/entrypoints/background/index.ts`
- `apps/chrome-extension/entrypoints/media-capture-offscreen/main.ts`

New v11 authority:

- `docs/active/project/contracts/v3_media_capture_internal_relay_v11.schema.json`
- `docs/active/project/fixtures/v3-media-capture-internal-relay-v11-fixtures.json`
- `docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/verify-stage-b-b5-3-background-capture-relay-v11-contract.py`
- `docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/verify-stage-b-b5-3-background-capture-relay-v11-mutations.py`

Public API, Runtime endpoint, Origin policy, ticket TTL, Cookie/provider boundary, SourceAuthority, product
materialization, FailureCode inventories and acceptance thresholds: `none`.

## Historical v10 preservation

The implementation did not edit the v10 historical files. Their observed checkpoint digests are:

| File | SHA-256 |
|---|---|
| relay v10 schema | `65b31eadd4acf41386c6f21f8172ccc7176a604a8a2a1c55a8ccc5ac751c6dd4` |
| relay v10 fixture | `02f24fed8c420a48d072c7c9d78f08284928e8cd63c8940d61110b699673e1d3` |
| relay v10 verifier | `ecda396ba429e40553ed633a8a60cbb462001ad54d427c2fb8afbea8aff0fc4d` |
| relay v10 mutation verifier | `9c376719117a8cb0740c9eda28e23cab5b12b2c1da5d0846615fbda9ee453f0e` |

These values describe the pre-existing worktree at this checkpoint; this batch does not reinterpret earlier
immutable candidates or rewrite their evidence.

## Repository state

- Branch: `main`
- HEAD: `a303551a5bf89c26ff36b24ac06c7e30c334db27`
- Pre-existing dirty worktree preserved; no reset, clean, checkout, revert, commit or push.
- Chrome, Provider, fixed-video and sound counts before the visible gate: all zero for this implementation batch.

