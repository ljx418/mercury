# Handoff

## Current coordinate

`WP-B VISIBLE DRY REVIEW PASS - EXTERNAL INPUTS REQUIRED`

B01-B26 and B28 retain their prior production-backed acceptance evidence.
B27/B29/B30 remain pending. WP-B is not declared PASS and WP-C has not begun.

## Inputs still required

1. One explicitly authorized local MP4/WebM/MKV path, 30-300 seconds, with a
   real video stream, real speech audio, at least three non-empty local
   SenseVoice segments, and at least three distinct frame hashes.
2. Four distinct Bilibili `/video/` URLs: B27 primary, B27 switch target, B29,
   and B30. Each must honestly reach the local-import fallback after automatic
   routes fail; the harness does not force eligibility.

The explicitly supplied cookie file and the default owned Chrome executable
have been validated as present. Cookie values were neither printed nor copied
into evidence.

## Next action

After the two input groups above are supplied, Codex will notify the user once,
then run the already-approved single visible owned-Chrome session with
`--mute-audio`. It will not touch the user's Chrome/profile, and it will clean
the owned Chrome tree, Runtime tree, profile, generated assets, and temporary
root in `finally` before writing the redacted stable receipt.

