# RC5 — the privacy detector and the inventory boundary

Oracle: `scripts/stage_b_b5_3/test/privacy_scan.node-test.mjs`
(12 cases, 12 pass, exit 0).

## What the detector covers now

| shape | the example | detected |
|---|---|---|
| a POSIX path with several segments | `/home/administrator/.navia/media-tasks` | yes |
| a POSIX path with ONE segment | `/tmp`, `/var` | **yes** (it was not before) |
| a Windows drive path, backslash form | `C:\Users\Administrator\AppData\Local\Temp\profile` | yes |
| a Windows drive path, FORWARD-SLASH form | `C:/Users/Administrator/AppData/Local/Temp/profile` | **yes** (it was not before) |
| a UNC path, backslash form | `\\server\share\profile` | **yes** (it was not before) |
| a UNC path, forward-slash form | `//server/share/profile` | **yes** (it was not before) |

## The narrow, structured allowlist

```text
{ kind: "runtime-route",  prefix: "/v1/",                    note: … }
{ kind: "runtime-route",  prefix: "/v3/",                    note: … }
{ kind: "runtime-route",  prefix: "/health",                note: … }
{ kind: "provider-route", prefix: "/chat/completions",       note: … }
{ kind: "provider-route", prefix: "/beta/chat/completions",  note: … }
```

Every entry is a PUBLIC ROUTE of the product. Two rules keep the allowlist
narrow:

* a FILE under an allowlisted prefix is NOT allowlisted — a segment with a
  dot is a file name, and a file name is never public
  (`/v1/media/secret.sqlite3` and `/v3/cache.db` are detected);
* a URL is never a path: the boundary rule means the path of
  `https://provider.invalid/v1/chat` and of
  `http://127.0.0.1:17861/v1/media/tasks` is never matched.

## The proving cases

| case | the assertion |
|---|---|
| the detector finds a POSIX absolute path | the multi-segment form is detected |
| the detector finds a ONE-SEGMENT POSIX path | `/tmp` and `/var` are detected |
| the detector finds a Windows absolute path | the backslash form is detected |
| the detector finds a Windows FORWARD-SLASH drive path | `C:/…` is detected |
| the detector finds a UNC path | both the backslash and the forward-slash forms are detected |
| the detector ignores a URL, a relative path and a frozen route | no false positive on a URL, on a relative path or on a public route |
| the allowlist is narrow, structured and documented | the five entries, their kinds and their notes; a file under a route is still detected |
| the redactor replaces a path with a stable reference | the path is gone, the reference is stable |
| the redactor replaces a UNC path and keeps a public route | the UNC path is redacted, the route stays readable |
| a file reference is a hash, never a path | `file-ref:<sha256[:32]>` |
| only an allowlisted frozen Runtime code is classified | the code allowlist |
| a path reference is stable and opaque | `path-ref:<sha256[:32]>` |

## The inventory boundary

The changed-file inventory is built from the ACTUAL FINAL SOURCE SET of the
workpack area, not from a hand-written list:

* every file of `scripts/stage_b_b5_3/`, of the comprehension package and of
  the GC-B5R correction test is listed with its SHA-256 (49 files);
* every file is classified as `modified` (22 — this batch changed it) or
  `carried` (27 — it belongs to the earlier V3 work and this batch did not
  touch it);
* the files this batch REMOVED are listed as well;
* `generatedArtifactsInTheSourceTree` is EMPTY: the generated sequencer
  copies, the sleeping runner fixture and the stub runner no longer live in
  the repository, so no generated artefact is omitted from the inventory.

## The scan of the sources and of the evidence

Every changed/new source file AND every file of this evidence package was
scanned with the secret patterns, the generic path detector and the raw
media patterns. The result is in `09-secret-path-raw-media-scan.json`:

* the EVIDENCE carries **zero** secret, **zero** private path, **zero**
  absolute path and **zero** raw media;
* the SOURCES carry the synthetic fixtures of the tests (a scanner fixture
  that must DETECT a token, a synthetic path fixture of the detector test,
  the media FILE NAMES of a synthetic preflight fixture) and the JavaScript
  REGEX LITERALS of the source code, which the conservative one-segment
  rule reports as paths. Every hit is classified in the scan file.

## The honest limits

* The one-segment rule is deliberately conservative: a JavaScript regex
  literal in a SOURCE file (for example `/Chrome launched via …/g`) is
  reported as a path. The runner's EVIDENCE carries no regex literal, and
  the evidence scan is empty.
* The detector is a TEXT detector. A path encoded in a non-text field would
  not be caught by it.
* The allowlist covers the routes the product exposes. A route that is NOT
  in the allowlist (a third-party endpoint, for example) is reported as a
  path and redacted in the evidence — the conservative direction.
