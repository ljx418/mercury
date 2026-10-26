# WP-B Visible Run Attempt 1

Status: `PRE-CASE STARTUP FAILURE - SECOND VISIBLE APPROVAL REQUIRED`

## Managed seed

The user authorized downloading the acceptance media through the product's
managed channel. The selected registered sample is `BV1Bb411w741`, part 1.

- Product identity duration: 258 seconds.
- Persisted media duration: 257,840 ms.
- Byte length: 33,843,504.
- SHA-256: `777670bc0d2b4a3c8b650e488378b9ef37a425784f3947fbbd5c60f6a78fde00`.
- Allocated ratio: 1.000052 (not sparse).
- Streams: H.264 video plus AAC audio.
- Frozen qualification: 64 non-empty local SenseVoice segments and 3 distinct
  frame hashes.
- The media is stored below the repository's ignored `.navia` Windows-backed
  development root. It is not in Git or public evidence.

The product downloader enforced the frozen yt-dlp and ffmpeg hashes and the
Bilibili credential-envelope policy. Its POSIX-private cache ran in WSL
scratch; only the digest-verified final copy was persisted to Windows, and the
WSL scratch was deleted.

## Attempt result

The owned headed Chrome process did not expose CDP within 30 seconds. No case
started, no 100 MB/1 GB acceptance asset was generated, no Runtime was started,
no Provider was called, and no audio device was opened. The harness terminated
the owned process tree and removed the Windows profile and WSL root. Ports
17861, 9731, and the headless diagnostic port were confirmed free afterward.

The follow-up no-window headless probe proved that the same Chrome executable,
an independent Windows profile, and CDP are functional. The harness was then
corrected to use an explicit loopback debugging address, detect early launcher
exit, maintain separate WSL Runtime and Windows Chrome-profile roots, and
decode MP4 audio to an owned WAV before SenseVoice qualification. Offline
harness tests remain 56/56.

B27/B29/B30 remain pending. The first approval is treated as consumed even
though failure occurred before the first case. A second headed run requires a
new explicit user approval.

