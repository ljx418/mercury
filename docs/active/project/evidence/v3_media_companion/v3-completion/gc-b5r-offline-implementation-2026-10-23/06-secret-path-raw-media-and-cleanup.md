# Secret, private-path, raw-media and cleanup report

## 1. Secret scan over the changed files and the new evidence

The runner's frozen secret shapes were applied to every file this batch
touched and to every file in this evidence directory:

```
sk-[A-Za-z0-9_\-]{16,}   sk_live_[A-Za-z0-9]{8,}   AIza[0-9A-Za-z_\-]{16,}
gho_[0-9A-Za-z]{16,}     deepseek-[A-Za-z0-9]{8,}   minimax-[A-Za-z0-9]{8,}
```

**Hits: 0.**

The only textual match in the changed files is the *scan list itself* inside
`tests/test_v3_gc_b5r_input_authority.py` (the forbidden markers the payload
scan asserts are absent). It is a list of needles, not a secret.

## 2. Private-path scan

Patterns: a POSIX home directory of a user, and the Windows user profile
directories in both the drive-letter and the POSIX form.

**Hits: 0** in the changed files. The evidence package records only repository
relative paths and the two `/tmp` roots that the commands themselves created
and then removed.

The user's real Runtime root (`~/.navia`) was **not** read, **not** written
and **not** searched: `services/local-runtime/tests/conftest.py`
redirects every test module to a fresh `tempfile` runtime root
(`NAVIA_DB_PATH`, `NAVIA_MEDIA_TASK_ROOT`, `NAVIA_ASR_TASK_ROOT`) and removes it
at exit. The mtime of that root is `2026-10-14 20:40:12`, which predates this batch.

## 3. Raw-media / cookie / key payload scan

Patterns over the changed files: `cookie:`, `cookie=`, `api_key:`, `apiKey=`,
`authorization:`, `bearer `, `raw_video_bytes`, `raw_audio_bytes`.

**Hits: 0** real hits. The single match is the marker list of the payload
scan in the test file, as above.

The published-derivative scan is stronger and is asserted by a test: the
published V2.1 bytes must not contain a secret shape, `Cookie`,
`Authorization`, `Bearer `, `api_key=`, `apiKey=`, `SESSDATA`, `bili_jct`,
`buvid`, a POSIX home-directory prefix, a mounted-drive prefix, a Windows
drive prefix, `.mp4`, `.mkv`, `.webm`, `.wav`, `base64`,
`frameBytes`, or the absolute private root.

**No media file was downloaded, imported, generated or read.** No cookie file
was read. No provider key was read.

## 4. Cleanup / residual report

| Owned resource | Count | Note |
|---|---:|---|
| Chrome processes (owned) | **0** | Chrome was never launched |
| Visible windows | **0** | no window was ever opened |
| Runtime media processes (owned) | **0** | the Runtime was never started for media work |
| Runner / sequencer processes (owned) | **0** | the preflight returned before the run loop |
| Listening ports (owned) | **0** | no server was started |
| Chrome profile directories (owned) | **0** | no profile was created |
| Media task roots (owned) | **0** | no task root was created |
| Temporary media assets (owned) | **0** | no asset was created |
| Audio outputs | **0** | no audio device was used |
| Provider calls | **0** | no Provider was called |
| Downloads | **0** | nothing was downloaded |
| Imports | **0** | nothing was imported |
| Artifacts generated for a real BVID | **0** | no derivative was generated |

### Scratch inside the source tree

Two Node test scratch files were written into
`scripts/stage_b_b5_3/test/_fixtures/` by the pre-existing sequencer suite
(`sequencer_alt.mjs`, `stub_runner.mjs`). The suite regenerates both on every
run, so they were removed again after the last run and the directory is empty
again. One earlier command of this batch also created a stray evidence copy
under `services/local-runtime/docs/` because it ran with the package directory
as its working directory; that copy was moved to its real place and the stray
tree was removed. Nothing else was touched by either event.

### Test scratch that is not owned run residue

The test suites of the repository create scratch directories under `/tmp` and
do not always remove them. After this batch:

* `/tmp/navia-b5-3-*` — 115 directories, created by the pre-existing
  `canary_bvid1` and `real_branches` Node suites (their own fixtures);
* `/tmp/narralens-*` — 62 directories, created by the pre-existing Python
  frame/import suites;
* `/tmp/navia-pytest-runtime-*` — 1 directory, the pytest runtime root that
  `conftest.py` removes at exit (this one is from the run that was still in
  flight when the scan ran).

None of them is owned run residue: no BVID was run, so no per-BVID evidence
directory, no Chrome profile, no media task root and no downloaded media
exists. The GC-B5R preflight evidence root contains exactly two files
(`preflight-receipt.json`, `sequencer-summary.json`) and **no** `bvid-*`
directory.

## 5. The preflight receipt's own residue

The preflight wrote two files into
`gc-b5r-offline-implementation-2026-10-23/preflight/`, both mode `0o600`:

```
preflight/sequencer-summary.json
preflight/preflight-receipt.json
```

No other file was written by the preflight, and no temporary file survived.
