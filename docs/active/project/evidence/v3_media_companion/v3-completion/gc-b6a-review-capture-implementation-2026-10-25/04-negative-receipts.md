# The negative receipts

Every negative case of this batch, the mutation it injects, the stable
failure code it produces and the exit it causes. The bundle, the projection
and the aggregate refusals are PURE (the validator returns the code); the
lifecycle refusals are PROCESS exits (the real runner).

## The private bundle (24 pure refusals)

| the mutation | the failure code |
|---|---|
| another task id | `B6_BUNDLE_IDENTITY_MISMATCH` |
| another task revision | `B6_BUNDLE_IDENTITY_MISMATCH` |
| another source identity | `B6_BUNDLE_IDENTITY_MISMATCH` |
| another registry order | `B6_BUNDLE_IDENTITY_MISMATCH` |
| another registry BVID | `B6_BUNDLE_IDENTITY_MISMATCH` |
| another registry digest | `B6_BUNDLE_IDENTITY_MISMATCH` |
| a malformed derivative | `B6_BUNDLE_ARTIFACT_INVALID` |
| a derivative that breaks the frozen contract | `B6_BUNDLE_ARTIFACT_INVALID` |
| a catalog hash mismatch | `B6_BUNDLE_CATALOG_HASH_MISMATCH` |
| a missing evidence record | `B6_BUNDLE_EVIDENCE_MISSING` |
| a manifest drift | `B6_BUNDLE_MANIFEST_DRIFT` |
| an evidence text that does not hash | `B6_BUNDLE_EVIDENCE_HASH_MISMATCH` |
| a null evidence text | `B6_BUNDLE_EVIDENCE_HASH_MISMATCH` |
| a duplicate evidence id | `B6_BUNDLE_DUPLICATE_FILE` |
| an evidence of another task | `B6_BUNDLE_IDENTITY_MISMATCH` |
| a malformed evidence record | `B6_BUNDLE_SCHEMA_INVALID` |
| a foreign evidence id in the derivative | `B6_BUNDLE_EVIDENCE_MISSING` |
| a declared but uncaptured thumbnail | `B6_BUNDLE_THUMBNAIL_INVALID` |
| a capture receipt with a forbidden field | `B6_BUNDLE_PROVIDER_LEAK` |
| a secret in the bundle | `B6_BUNDLE_SECRET_LEAK` |
| an absolute path in the bundle | `B6_BUNDLE_ABSOLUTE_PATH` |
| a raw media file in the bundle | `B6_BUNDLE_RAW_MEDIA` |
| a thumbnail that is not a PNG | `B6_BUNDLE_THUMBNAIL_INVALID` |
| an empty thumbnail | `B6_BUNDLE_THUMBNAIL_INVALID` |
| a duplicate thumbnail | `B6_BUNDLE_DUPLICATE_FILE` |
| a thumbnail without an evidence record | `B6_BUNDLE_EVIDENCE_MISSING` |
| a seek time outside the media | `B6_BUNDLE_SEEK_OUT_OF_RANGE` |
| a chapter that ends before it starts | `B6_BUNDLE_SEEK_OUT_OF_RANGE` |
| a seek chapter with a missing evidence id | `B6_BUNDLE_EVIDENCE_MISSING` |
| a seek map without a media duration | `B6_BUNDLE_SEEK_OUT_OF_RANGE` |

## The blind projection (4 privacy refusals)

| the mutation | the failure code |
|---|---|
| a secret in the projected text | `B6_BLIND_SECRET_LEAK` |
| an absolute path in the projected text | `B6_BLIND_ABSOLUTE_PATH` |
| a raw media container as a thumbnail | `B6_BLIND_RAW_MEDIA` |
| a Provider identity field in the projection | `B6_BLIND_PROVIDER_LEAK` |

## The B-6 aggregate (7 refusals)

| the mutation | the failure code |
|---|---|
| one axis below the minimum | `B6_AXIS_BELOW_MINIMUM` |
| a missing row | `B6_ROW_MISSING` |
| a duplicate row | `B6_ROW_DUPLICATE` (and `B6_ROW_MISSING`) |
| a critical error | `B6_CRITICAL_ERROR` |
| a reversed sentinel | `B6_SENTINEL_REVERSED` |
| a sentinel in the same session | `B6_SENTINEL_SESSION` |
| a rubric hash drift | `B6_RUBRIC_HASH_DRIFT` |
| a visible Provider identity | `B6_PROVIDER_IDENTITY_VISIBLE` |
| a sentinel in the same position | `B6_SENTINEL_POSITION` |
| a sentinel score drift | `B6_SENTINEL_SCORE_DRIFT` |
| a non-positive B-5 machine gate | `B6_MACHINE_GATE_NOT_POSITIVE` |

## The lifecycle (2 PROCESS exits)

| the mutation | the receipt |
|---|---|
| the workspace route is unavailable | the runner exits NON-ZERO, the disposition is `failed`, the failure code is `B6_CAPTURE_FAILED`, the capture receipt's status is `failed` |
| the thumbnail route is unavailable | the runner exits NON-ZERO, the cleanup receipt still reports `runtimeScratchDeleted: true` and `profileRootDeleted: true` |

## The real route composition

| the assertion | the receipt |
|---|---|
| the workspace route answers 200 with the projection | the capture reads the task facts and the evidence catalog from it |
| the thumbnail route answers 200 with real bytes | the captured thumbnail IS the bytes the route served |
| the capture closes | the bundle holds the contracted file set and the private root is 0700 |
| the public receipt is minimal | its key set is exactly `closure, counts, digests, schemaVersion, status`; it carries no Provider identity, no text, no file name and no private path |
| the relative ref never escapes the private root | `../escape` and an absolute ref are refused |

## The exact-threshold and one-under drives

The B-6 aggregate is driven at EXACTLY the frozen threshold (every axis = 4,
positive) and ONE UNDER it (one axis = 3, non-positive). The same holds for
the B-5 machine gate of the aggregate-integrity batch, which is unchanged.
