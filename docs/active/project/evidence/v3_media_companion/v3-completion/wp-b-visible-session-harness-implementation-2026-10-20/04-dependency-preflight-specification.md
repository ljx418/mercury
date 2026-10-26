# The dependency preflight specification

The preflight runs in TWO phases, and everything in it is resolved through the
product's own mechanism or an explicitly validated environment input. Nothing
is guessed, and nothing is resolved from a repository default.

## Phase 1 — before Chrome and before any large asset

| check | source | on failure |
|---|---|---|
| the authorized seed | `NAVIA_WP_B_SEED_MEDIA` — the ONLY media source | `EXTERNAL-INPUT BLOCK`; no search, no substitute |
| the CDP port is free | the harness's own port probe | `EXTERNAL-INPUT BLOCK` |
| the Runtime port (17861) is free | the harness's own port probe | `EXTERNAL-INPUT BLOCK`; the harness refuses to reuse, terminate or mutate an existing Runtime |
| the browser exists | `NAVIA_CHROME_EXECUTABLE` | `EXTERNAL-INPUT BLOCK` |
| the free disk >= 4294967296 bytes | `statfs` on the owned root | `EXTERNAL-INPUT BLOCK` |
| the ffmpeg/ffprobe paths | the PRODUCT's `NAVIA_MEDIA_FFMPEG_PATH` / `NAVIA_MEDIA_FFPROBE_PATH` | `EXTERNAL-INPUT BLOCK` |

## Phase 2 — after the owned Runtime is healthy

| check | source | on failure |
|---|---|---|
| the ffmpeg/ffprobe digests | the OWNED RUNTIME's `GET /v1/media/dependencies` — the product's own verified snapshot | `EXTERNAL-INPUT BLOCK` |
| the SenseVoice binary, model and VAD | the PRODUCT's `NAVIA_ASR_ROOT` (or an explicit `NAVIA_WP_B_ASR_ROOT`), verified by existence | `EXTERNAL-INPUT BLOCK`; `<repo>/.navia/asr` is NOT a default |

## The seed oracle

Before anything is generated, the authorized seed must satisfy the FROZEN
registry requirements (`docs/active/project/fixtures/v3-media-local-import-acceptance-assets-v1.json`):

| requirement | how it is measured |
|---|---|
| a real video stream **and** a real audio stream | the real ffprobe |
| the duration is inside 30000..300000 ms | the real ffprobe |
| at least 3 non-empty local SenseVoice segments | the real local SenseVoice model |
| at least 3 distinct frame digests | the real ffmpeg, into frames **under the owned root** |

A seed that fails any of them is an `EXTERNAL-INPUT BLOCK`. It is never
padded, truncated, sparsified, synthesized or replaced.

## The asset generator

The two registry assets are produced with the FROZEN settings — libx264 /
yuv420p / 1280x720 / 30 fps / 8M video and aac / 48 kHz / 2 channels / 160k
audio — from the **looped** seed (`-stream_loop -1`) cut at the target
duration. The result is then MEASURED, never trusted:

| measurement | the frozen bound |
|---|---|
| the byte length | `wp-b-real-100mb`: 100663296..117440512; `wp-b-real-1gb`: 1020054732..1127428915 |
| the allocated ratio (`st_blocks * 512 / size`) | >= 0.95 — a sparse result is refused |
| the SHA-256 and the ffprobe digest | recorded in the receipt |
| the non-empty segment count and the distinct frame count | recorded in the receipt |

Every probe and every temporary lives under the owned root, and each creation is
protected by a cleanup that also runs when the encode, the read or the hash
fails.
