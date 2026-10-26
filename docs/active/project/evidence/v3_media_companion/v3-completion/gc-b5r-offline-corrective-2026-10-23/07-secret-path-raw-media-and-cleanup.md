# Secret, private-path, raw-media and cleanup report (corrective)

## 1. Secret scan

The runner's six frozen secret shapes were applied to every file this batch
touched and to every file in this evidence directory:

```
sk-[A-Za-z0-9_\-]{16,}   sk_live_[A-Za-z0-9]{8,}   AIza[0-9A-Za-z_\-]{16,}
gho_[0-9A-Za-z]{16,}     deepseek-[A-Za-z0-9]{8,}   minimax-[A-Za-z0-9]{8,}
```

**Real hits: 0.**

The only textual matches are:

* `navia_runtime/app.py` — the pre-existing model-name list
  (`deepseek-reasoner`), which the pattern matches by shape. It is a model
  name, not a credential, and the line is untouched by this batch.
* `tests/test_v3_gc_b5r_input_authority.py` — the payload scan's own list of
  forbidden markers. It is a list of needles, not a secret.

## 2. Private-path scan

Patterns: a POSIX home directory of a user, and the Windows user profile
directories in both the drive-letter and the POSIX form.

**Hits: 0** in the changed files and in this evidence directory.

The user's real Runtime root (`~/.navia`) was **not** read, **not** written
and **not** searched: `services/local-runtime/tests/conftest.py` redirects
every test module to a fresh `tempfile` runtime root (`NAVIA_DB_PATH`,
`NAVIA_MEDIA_TASK_ROOT`, `NAVIA_ASR_TASK_ROOT`) and removes it at exit. The
mtime of that root is `2026-10-14 20:40:12`, which predates this batch.

The corrective receipt collector reads only the repository and the temporary
roots it creates itself.

## 3. Raw-media / cookie / key payload scan

Patterns over the changed files: a cookie assignment, an API-key assignment
and a bearer token.

**Real hits: 0.** The only match is the marker list inside the payload scan
in the test file, as above.

The published-derivative scan is stronger and is asserted by a test: the
published V2.1 bytes must not contain a secret shape, `Cookie`,
`Authorization`, `Bearer `, `api_key=`, `apiKey=`, `SESSDATA`, `bili_jct`,
`buvid`, a home-directory prefix, a mounted-drive prefix, a Windows drive
prefix, `.mp4`, `.mkv`, `.webm`, `.wav`, `base64`, `frameBytes`, or the
absolute private root.

**No media file was downloaded, imported, generated or read.** No cookie file
was read. No provider key was read.

## 4. Cleanup / residual report

| Owned resource | Count | Note |
|---|---:|---|
| Chrome processes (owned) | **0** | Chrome was never launched |
| Visible windows | **0** | no window was ever opened |
| Runtime media processes (owned) | **0** | the Runtime was never started for media work |
| Runner / sequencer processes (owned) | **0** | the offline suite exited |
| Listening ports (owned) | **0** | no server was started |
| Chrome profile directories (owned) | **0** | no profile was created |
| Media task roots (owned) | **0** | no task root was created |
| Temporary media assets (owned) | **0** | no asset was created |
| Audio outputs | **0** | no audio device was used |
| Provider calls | **0** | no Provider was called |
| Downloads | **0** | nothing was downloaded |
| Imports | **0** | nothing was imported |
| Artifacts generated for a real BVID | **0** | no derivative was generated |
| Real six-video runs | **0** | the registry was only READ |

### The scratch this batch's own tests create

The new preflight cases create a few-byte dummy file in a temporary directory
to exercise the path checks. The cases now remove them through the test
context's `after()` hook, so they are removed even when an assertion fails.
The leftovers of the earlier failing runs were removed as well.

The Node sequencer suite writes two scratch files into
`scripts/stage_b_b5_3/test/_fixtures/` (`sequencer_alt.mjs`,
`stub_runner.mjs`). The suite regenerates both on every run; they were removed
after the last run so the tree is clean.

### Test scratch that is not owned run residue

The `navia-b5-3-*` scratch directories (the pre-existing Node suites' own
fixtures) and the `narralens-*` ones (the pre-existing Python frame/import
suites) are created
by the repository's pre-existing tests and are not owned run residue: no BVID
was run, so no per-BVID evidence directory, no Chrome profile, no media task
root and no downloaded media exists.

## 5. The preflight receipt's own residue

The preflight writes two files into its evidence root, both mode `0o600`:

```
preflight/sequencer-summary.json
preflight/preflight-receipt.json
```

No other file is written by the preflight, and no temporary file survives.
