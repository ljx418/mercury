# The case → production-oracle map

Every case of the B6A acceptance plan and the PRODUCTION code path that
proves it. The 54 fixed obligations are mapped group by group in
`05-obligation-map.json`.

## The private bundle (identity/hash, evidence/text, thumbnail/seek)

| the obligation | the production oracle | the case |
|---|---|---|
| a valid bundle passes | `validateReviewBundle()` in `lib/review_bundle.mjs` | `B6 identity 1/12` |
| the task id, the task revision, the source identity, the order, the BVID and the registry digest are bound | the same validator + `machineIdentityDefects()` | `B6 identity 2/12 .. 7/12` |
| a malformed derivative and a derivative that breaks the frozen contract are refused | `validateV21Artifact()` (the shared exact validator) | `B6 identity 8/12`, `B6 identity 9/12` |
| the evidence catalog hash is the FROZEN one | `evidenceCatalogSha256()` | `B6 identity 10/12` |
| a missing and a foreign evidence id are refused | the validator | `B6 identity 11/12`, `B6 evidence 6/10` |
| the manifest drift is refused | the validator | `B6 identity 12/12` |
| the evidence text hashes to its content digest | `normalizeEvidenceText()` + the frozen digest | `B6 evidence 1/10` |
| a null evidence text, a duplicate evidence id, an evidence of another task and a malformed evidence record are refused | the validator | `B6 evidence 2/10 .. 5/10` |
| a declared but uncaptured thumbnail is refused | the validator | `B6 evidence 7/10` |
| a capture receipt with a forbidden field is refused | the validator + `FORBIDDEN_RECEIPT_FIELDS` | `B6 evidence 8/10` |
| a secret, an absolute path and a raw media file are refused | the validator + `SECRET_PATTERNS` + `detectAbsolutePaths` + `RAW_MEDIA_EXTENSIONS` | `B6 evidence 9/10`, `B6 evidence 10/10` |
| a thumbnail that is not a PNG, an empty thumbnail, a duplicate thumbnail and a thumbnail without an evidence record are refused | the validator | `B6 thumbnail 1/8 .. 4/8` |
| a seek outside the media, a chapter that ends before it starts, a missing evidence id and a missing duration are refused | the validator | `B6 seek 5/8 .. 8/8` |

## The REAL production routes

| the obligation | the production oracle | the case |
|---|---|---|
| the workspace metadata comes from the PUBLIC workspace route | `GET /v1/media/tasks/<taskId>/comprehension` of the REAL local Runtime | `B6 composition: the capture runs against the REAL workspace and thumbnail routes` |
| the PNG comes from the AUTHENTICATED thumbnail route | `GET /v1/media/tasks/<taskId>/evidence/<evidenceId>/thumbnail` (the companion bearer) | the same case |
| the derived text is read EXACTLY by the relative ref the workspace declares | `resolvePrivateRef()` in `lib/review_capture.mjs` | the same case and `the relative ref resolution never escapes the private root` |
| the captured thumbnail IS the bytes the route served | the byte comparison in the composition case | the same case |
| the private bundle holds the CONTRACTED file set and is 0700 | `readReviewBundle()` + the mode check | the same case |

## The blind projection (privacy)

| the obligation | the production oracle | the case |
|---|---|---|
| no Provider identity in the projection | `buildBlindProjection()` + `projectionPrivacyDefects()` | `B6 blind 1/8`, `B6 blind 8/8` |
| no receipt text, and an irreversible review binding | the same | `B6 blind 2/8`, `B6 blind 3/8` |
| no secret, no absolute path, no raw media | the same | `B6 blind 4/8`, `B6 blind 5/8`, `B6 blind 6/8` |
| the semantic content the reviewer needs is kept | the same | `B6 blind 7/8` |

## The lifecycle (the capture point and the cleanup)

| the obligation | the production oracle | the case |
|---|---|---|
| the capture closes AFTER the publication and BEFORE the owner cleanup | the REAL runner + the cleanup receipt + the bundle outside the scratch | `B6 lifecycle 1/6` |
| a capture failure fails the candidate CLOSED | the REAL runner (a non-zero exit, the disposition `failed`, the failure code `B6_CAPTURE_FAILED`) | `B6 lifecycle 2/6` |
| a capture failure still runs the owner cleanup | the REAL runner + the cleanup receipt | `B6 lifecycle 3/6` |
| the public receipt carries ONLY the bundle hash, the counts and the status | the capture receipt + the key-set assertion | `B6 lifecycle 4/6` |
| the private root is 0700 and OUTSIDE the repository | the capture + the mode check | `B6 lifecycle 5/6` |
| without a private root the runner captures NOTHING and starts nothing | the REAL runner + the counter assertions | `B6 lifecycle 6/6` |
| the capture call site is structurally after the publication and before the cleanup | the runner source order | `the capture call site is AFTER the publication and BEFORE the owner cleanup` |

## The B-6 aggregate and the sentinel

| the obligation | the production oracle | the case |
|---|---|---|
| the positive control | `evaluateB6Aggregate()` in `lib/b6_aggregate.mjs` | `B6 aggregate 1/10` |
| the EXACT threshold (every axis = 4) passes | the same | `B6 aggregate 2/10` |
| ONE UNDER the threshold fails | the same | `B6 aggregate 3/10` |
| a missing row, a duplicate row and a critical error fail | the same | `B6 aggregate 4/10`, `B6 aggregate 5/10`, `B6 aggregate 6/10` |
| a reversed sentinel, a sentinel in the same session and a rubric drift fail | the same | `B6 aggregate 7/10`, `B6 aggregate 8/10`, `B6 aggregate 9/10` |
| a visible Provider identity fails | the same | `B6 aggregate 10/10` |
| the sentinel position, the sentinel score drift and the machine gate are enforced | the same | `the sentinel position and the machine gate are enforced` |

## The seams that remain test-only

| seam | what it is | where it is used | why it is acceptable |
|---|---|---|---|
| the local Runtime application (uvicorn) | the REAL product routes, booted on a free port with a temporary database and media task root | the composition case | it is the PRODUCTION route implementation, not a fake: the workspace and thumbnail answers come from the product's own service code |
| the production store API + the production outline generator | the seeding of one synthetic task | the composition case | it creates NO product state by raw SQL and it does NOT call the materializer; the derived evidence is synthetic text and one synthetic PNG written where the materializer writes it |
| the Runtime double in the lifecycle case | the product routes of the capture | the lifecycle case | it exercises the REAL runner's capture path, the REAL grant verification and the REAL cleanup |
| `NAVIA_B6_PRIVATE_ROOT` | the explicit private root | the capture | without it the runner captures NOTHING: the B-5 behaviour is unchanged |

**No case above is proven by a seam that skips the behaviour under test.**
The static string scans are a SUPPLEMENT only (the forbidden-capability scan
in `09-zero-action-receipt.json`).
