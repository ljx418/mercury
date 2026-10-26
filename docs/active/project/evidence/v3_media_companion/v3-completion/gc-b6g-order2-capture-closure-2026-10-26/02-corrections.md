# Corrections

## PNG ancillary chunks

The frozen ffmpeg emits BT.709 PNGs with fixed `cICP`, `cHRM`, and `gAMA`
payloads in addition to the already accepted fixed-size `pHYs` chunk. The
validator now accepts only those exact payloads. It continues to reject text,
ICC, EXIF, arbitrary ancillary payloads, malformed CRCs, missing required PNG
chunks, and trailing bytes.

The test uses the frozen ffmpeg to create a real BT.709 PNG, validates it, and
mutates each accepted colour payload to prove fail-closed behavior.

## Canonical thumbnail order

The bundle writer originally computed receipt and manifest bytes in input
order, while the reader reconstructed thumbnails in lexical file-name order.
One-thumbnail fixtures could not expose the mismatch. Real order 2 produced
eight thumbnails and failed byte closure.

Both `bundleDigest()` and `encodeBundleFiles()` now sort thumbnails by
`evidenceId` before deriving contracted bytes. A multi-thumbnail test proves
that forward and reversed inputs produce identical receipt and manifest bytes.

No product module, public route, public schema, frozen threshold, registry,
rubric, prompt, denominator, or Provider lock changed.

