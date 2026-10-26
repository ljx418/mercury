# Stage B V2.1 contract addendum: deterministic brief provenance

Date: 2026-10-14. Status: freeze candidate. This addendum changes only brief
recovery and persistence versioning. Every identity, evidence, chapter, quality,
authorization and failure rule in `stage-b-grounded-comprehension-contract.md`
remains normative.

## Version coexistence

- V2 (`v3-media-grounded-comprehension/v2`) is immutable and remains readable.
- V2.1 (`v3-media-grounded-comprehension/v2.1`) is the only new-write format
  after route-2 authorization.
- Readers prefer exact-binding V2.1 and fall back to exact-binding V2. They never
  merge fields across files or migrate/delete old evidence.
- Failed V2.1 validation or commit leaves prior V2/V2.1 bytes unchanged.

Normative candidate schema:
`docs/active/project/contracts/v3_media_grounded_comprehension_v2_1.schema.json`.

## Brief provenance

`brief.origin` is required:

- `provider`: the provider brief passed unchanged after whitespace normalization;
  `sourceClaimIds` is empty.
- `deterministic_claim_composer`: the brief is the fixed-separator concatenation
  of 2-3 eligible provider claims; `sourceClaimIds` contains their generated,
  ordered claim IDs.

Composition may follow only `V3510B_BRIEF_LENGTH_INVALID` or
`V3510B_BRIEF_RAW_PREFIX`. It cannot recover provider response shape, claim,
chapter, evidence, authority, coverage or conflict errors. The composed brief is
subject to the same 20-100 character, raw-excerpt, direct-evidence and all-region
coverage requirements as a provider brief.

The call order is frozen: initial provider request -> full validation -> at most
one full-contract provider repair -> full validation -> optional composer for
the two allowlisted brief failures -> full validation -> authority/hash commit
barrier. No additional provider or composer retry is allowed in one operation.

## Deterministic selection

For ordered claim-index combinations of size 2, then 3:

1. reject a claim with invalid length, duplicate normalized text, unknown/empty
   evidence IDs, no derived region, or raw-transcript-excerpt text;
2. retain combinations whose union covers every substantive region;
3. join normalized claim texts with `；` and retain only 20-100 character results
   that are not raw transcript excerpts;
4. rank by descending number of covered substantive regions, ascending result
   length, then lexicographic original-index tuple;
5. choose exactly the first result or return the original brief failure.

No stochastic choice, truncation, padding, synonym replacement or inference is
permitted.

No valid subset produces a text-free internal diagnostic
`V3510B_COMPOSER_NO_VALID_SUBSET` and returns the original brief failure. The
diagnostic is not persisted in the derivative and cannot be counted as success.

## Stable observability

The published derivative itself is the provenance record. UI details may render
`由模型直接生成` or `由已核验证据组合`; neither label changes quality status.
Logs and public audit packages must not contain raw private evidence text.

## Provider receipt extras (V2.1 only)

V2.1 derivatives may additionally carry the following optional receipt fields.
None are required; none appear on the V2 schema. They are written by
`_normalize_provider_extras` only when `schema_version` ends with `/v2.1`,
so the V2 byte layout stays byte-identical to the previous contract.

| Field | Type | Allowed |
|---|---|---|
| `endpointClass` | string | `^[a-z][a-z0-9_-]{0,63}$`, max 64 chars. e.g. `minimax_chat_completions`, `deepseek_strict_tool`. |
| `structureMode` | string | `^[a-z][a-z0-9_-]{0,63}$`, max 64 chars. e.g. `openai_chat_object`, `deepseek_beta_strict_tool_v1`. |
| `attemptId` | string | `^attempt-[a-f0-9]{1,32}$`. Set per provider request. |
| `latencyMs` | integer | 0–600000. Per-request wall-clock. |
| `requestSha256` | 64-hex | Same canonicalization as `outboundDerivedTextSha256`. |
| `responseSha256` | 64-hex | Hash of full provider JSON response body. |
| `finishReason` | enum | `stop`, `tool_calls`, `length`, `content_filter`, `refusal`, `authorization_denied`, `empty`, `malformed`, `schema_invalid`. Unknown values normalize to `malformed`. |

The schema enforces `additionalProperties: false` on `Receipt`. Any extras
key outside the seven above is rejected by `verify-stage-b-route-2-contract-fixtures`
as `V3510B21-N11`. The provider classes that emit these fields are
`MiniMaxGroundedSynthesisProvider` and `DeepSeekStrictGroundedSynthesisProvider`,
both in `services/local-runtime/navia_runtime/modules/media_companion/comprehension/synthesis.py`.

## New negative obligations

- `V3510B21-N01`: one claim cannot be used as a composed brief.
- `V3510B21-N02`: a subset missing a substantive region cannot recover.
- `V3510B21-N03`: raw transcript claim text cannot recover.
- `V3510B21-N04`: output over 100 characters cannot be truncated.
- `V3510B21-N05`: non-brief provider failures cannot enter composition.
- `V3510B21-N06`: stale revision/catalog/authority cannot commit.
- `V3510B21-N07`: provider-origin output cannot claim local composition.
- `V3510B21-N08`: V2.1 failure cannot mutate a prior V2/V2.1 file.
- `V3510B21-N09`: a second provider repair or composer retry is rejected.
- `V3510B21-N10`: every real-run retry must replace Runtime, database, Chrome
  profile and task ID; cross-run artifacts remain forbidden.
- `V3510B21-N11`: V2.1 receipt cannot carry undeclared extras fields
  (`additionalProperties: false` on `Receipt`).

