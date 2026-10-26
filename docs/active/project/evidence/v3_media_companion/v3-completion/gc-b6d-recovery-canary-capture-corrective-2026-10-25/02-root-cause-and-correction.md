# Root Cause And Correction

## Root cause

`collectText()` recursively decoded every `Buffer` as UTF-8. A real review
bundle contains PNG compressed bytes and a manifest containing duplicate file
payload bytes. These are not semantic text. Decoding them can create arbitrary
replacement characters and path-shaped substrings, which made the absolute
path detector reject a clean capture.

The failure occurred before bundle publication. No private bundle was emitted,
so the historical run cannot be repaired or reinterpreted.

## Correction

- Traverse only the structured semantic fields used by the review contract.
- Scan the V2.1 derivative bytes explicitly because that payload is JSON text.
- Scan manifest names and digests, but never decode manifest payload bytes.
- Never decode thumbnail bytes as text.
- Allow only mandatory PNG structure and ffmpeg's fixed-size 9-byte `pHYs`;
  reject every other ancillary chunk so excluding compressed image bytes
  cannot become a metadata or custom-chunk privacy bypass.
- Preserve the existing strict PNG container, CRC, structure, manifest,
  canonical-byte, secret, raw-media, and path checks.

## Contract impact

None. No public API, schema, failure code, threshold, registry, rubric, prompt,
denominator, Provider contract, or relay boundary changed. This is an internal
acceptance-harness correction.
