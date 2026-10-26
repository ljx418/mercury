# Codex Hardening

The Claude corrective batch closed the four findings from the prior Codex
checkpoint. The final dry review found and closed five additional paths before
authorizing B6B.

## H1 Candidate capture authority

The authority now carries and validates, for every frozen source:

- the exact source identity;
- the machine derivative hash and captured artifact hash;
- capture status, positive counts, and all closure booleans;
- aggregate counts equal to the sum of the six source receipts.

Zero closure counts, an open source closure, a foreign identity, or a capture
artifact that differs from the machine derivative fails closed.

## H2 Frozen registry authority

A syntactically valid foreign registry digest is no longer accepted when the
caller omits an expected digest. The candidate must always carry the active
frozen registry digest.

## H3 Real PNG validation

The bundle and capture paths no longer accept an eight-byte PNG signature as
an image oracle. They parse the PNG chunk stream, validate every CRC, require a
valid IHDR, at least one IDAT, a terminal IEND, and no trailing bytes. A PNG
signature prefixed to raw-media bytes is rejected even after all surrounding
hashes and the manifest are recomputed.

## H4 Filesystem ancestry and failed staging

Capture and read paths reject a symbolic link in any path component, including
an ancestor of the declared root. A validation failure after staging now
removes the owned staging directory before returning failure.

## H5 Sentinel chosen before the run

The sentinel is frozen as registry order 3. Both reviews must bind that exact
source. A single substitution and two consistently substituted reviews both
fail, preventing post-result sentinel selection.

## Files changed by the Codex hardening pass

| File | SHA-256 |
|---|---|
| `lib/b6_authority.mjs` | `21b455a837ceb34d8c3fc5376c62d9108c9ba536e7e04bd8ed095ad82937b3c6` |
| `lib/b6_aggregate.mjs` | `edb8d8ae9dbc85ef85e9f4ffab737bcbf876813bc4d2a749b37e101d6e81850a` |
| `lib/review_bundle.mjs` | `43e8e3e71500d5df1d78e3bc082b39692ee4ffac564ca0e846b43d523426d446` |
| `lib/review_capture.mjs` | `5dade271b61669105cc3eb5e68585ced4ad7038b985cc0c9b3c70d9869165b94` |
| `sequencer.mjs` | `4b7ac112a7e7b5f31015e4902e20a5db5133663bdd4c4709d4f59340b37663cd` |
| `test/b6_aggregate.node-test.mjs` | `59d3656fe12d3c490eb1150441d1d63d658a4b4d9b58826ad546b67ec65ec016` |
| `test/b6_thumbnail_seek.node-test.mjs` | `23303a700849b44fc50549330186f2b2cfced99b9b9c09d45d328211894c8ec3` |
| `test/b6_capture_filesystem.node-test.mjs` | `0e304b09e4d66240cf99eab6eea45f19ddd8712a99e9053300f7c2f1954c2ff9` |
| `test/_fixtures/seed_review_task.py` | `aedc96c646616ea6035e1d0304407277fd265f4d165ac6a715e84d57d0fda844` |

All paths above are relative to `scripts/stage_b_b5_3/`.

