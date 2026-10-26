# Stage B grounded comprehension V2 contract

Date: 2026-10-13. Status: freeze candidate. Normative schema:
`docs/active/project/contracts/v3_media_grounded_comprehension_v2.schema.json`.

## Identity and persistence

The aggregate key is `(taskId, taskRevision, evidenceCatalogSha256)`. A V2
derivative is private, revision-scoped and written by temporary-file plus atomic
replace. A read returns V2 only when all three fields match current source
authority. A stale or invalid V2 file is ignored for reads and cannot overwrite
V1. Provider failure leaves the previous published projection byte-identical.

The frozen relative path is
`grounded-comprehension-v2/<taskId>/revision-<taskRevision>/<evidenceCatalogSha256>.json`
under the existing private media evidence root. The temporary file is a sibling
ending in `.tmp`; no V1 `synthesis/<taskId>/revision-<revision>.json` file is
renamed, replaced or deleted.

`schemaVersion=v3-media-grounded-comprehension/v2`. New fields are adapted into
the existing Workspace projection; existing V1 task records and readers are not
migrated.

## Evidence regions

Let `spanStart` be the minimum start and `spanEnd` the maximum end among usable
evidence. Divide that span into half-open thirds: opening, middle and ending;
the ending includes `spanEnd`. A region is `substantive` when it contains at
least one non-placeholder transcript/OCR/vision-caption item with at least
eight normalized characters. Otherwise it is `empty_or_unavailable` and must
carry no fabricated support.

If media duration is known, `spanEnd / mediaDuration >= 0.90` is required for a
`complete` result. Otherwise the result is `limited` with
`V3510B_ENDING_EVIDENCE_MISSING`; it cannot show a whole-video badge.

## Brief and claims

- `brief.text` has 20-100 Unicode scalar values after whitespace normalization.
- It is rejected when equal to, prefixed by, or a contiguous normalized excerpt
  of one transcript item of length at least 20.
- Its evidence IDs are known, direct and collectively touch every substantive
  region. IDs do not appear in user-facing text.
- There are 2-8 unique claims. Claim text is 8-240 characters. Every claim has
  at least one known evidence ID and one or more region labels derived from
  those IDs. Duplicate normalized claim text is invalid.
- Semantic support cannot be proven by ID existence alone; the host review must
  confirm sampled text-to-evidence entailment.

## Chapters

There are 2-12 semantic chapters. `startMs` values strictly increase;
`endMs` equals the next chapter start, and the final end equals `spanEnd`.
The first start equals `spanStart`. Every chapter cites known direct evidence
whose timestamp intersects its interval. A chapter title is thematic, not a
generic ordinal.

Extreme imbalance fails closed:

1. for six or more chapters, a rolling window equal to 20% of the substantive
   span may contain at most `ceil(chapterCount / 2)` starts;
2. for four or more chapters with all three substantive regions, no chapter may
   exceed 60% of the substantive span;
3. every substantive region must be touched by at least one chapter citation.

These thresholds detect severe clustering; they do not prescribe equal-duration
chapters or replace semantic review.

## Status and failure codes

`complete` means all machine invariants pass. `limited` means a truthful result
can be displayed with a visible limitation, but it is not a Stage B positive.
`rejected` means no V2 result is published.

`blocked` is intentionally absent from `quality.status`: it is a six-video
denominator disposition and existing terminal TaskStore state, not a persisted
V2 derivative. A source blocked before synthesis produces no V2 JSON. Its
public acceptance row records `V3510B_SOURCE_BLOCKED` and the observable portal
failure while the existing blocked task remains authoritative.

Stable failure codes:

| Code | Required outcome |
|---|---|
| `V3510B_CONSENT_REQUIRED` | rejected |
| `V3510B_TASK_REVISION_CONFLICT` | rejected |
| `V3510B_EVIDENCE_CATALOG_CHANGED` | rejected |
| `V3510B_EVIDENCE_UNCLOSED` | rejected |
| `V3510B_BRIEF_LENGTH_INVALID` | rejected |
| `V3510B_BRIEF_RAW_PREFIX` | rejected |
| `V3510B_BRIEF_COVERAGE_INSUFFICIENT` | limited |
| `V3510B_CLAIM_EVIDENCE_UNCLOSED` | rejected |
| `V3510B_CLAIM_DUPLICATE` | rejected |
| `V3510B_CHAPTER_TIME_INVALID` | rejected |
| `V3510B_CHAPTER_COVERAGE_INSUFFICIENT` | limited |
| `V3510B_CHAPTER_IMBALANCE` | rejected |
| `V3510B_ENDING_EVIDENCE_MISSING` | limited |
| `V3510B_EVIDENCE_CONFLICT_UNRESOLVED` | limited |
| `V3510B_PROVIDER_TIMEOUT` | rejected; preserve prior bytes |
| `V3510B_PROVIDER_RESPONSE_INVALID` | rejected; preserve prior bytes |
| `V3510B_SOURCE_BLOCKED` | blocked denominator disposition |

Multiple limitations may be returned, but a rejected invariant dominates and
prevents publication. Unknown codes are invalid.

## Authorization and disclosure

The existing per-task derived-text consent is reused without widening scope.
The request may contain only evidence ID, kind, timestamps and derived text.
Raw video/audio/frame bytes, browser Cookie, provider key and local path counts
are fixed at zero. The receipt records provider/model, outbound canonical hash,
request count and token usage. Revocation or stale authority before commit
rejects the write.

## API and UI mapping

No new public endpoint is required. The current comprehension read/synthesize
routes may expose V2 through the existing projection adapter. Overview maps
`brief.text` to `VIDEO BRIEF`, claims to “主要表达与关键依据”, and chapters to
“视频结构”. Transcript remains collapsed inspection material. `limited` and
`blocked` are visible and must not reuse complete styling.

