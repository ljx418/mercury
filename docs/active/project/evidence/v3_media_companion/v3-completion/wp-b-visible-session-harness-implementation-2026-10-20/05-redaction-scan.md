# The redaction scan

The public receipt may carry fixed case ids, product ids, counters, enums and
SHA-256 values. It may **not** carry an absolute path, a file name, a bearer, a
cookie or an API key, raw media, frame bytes, transcript text, a Chrome command
line with a private path, or an unredacted log.

## The rules, and what each one refuses

| rule | what it refuses |
|---|---|
| `absolute-path` | `/home/somebody/...`, `/mnt/c/...` |
| `windows-path` | `C:\Users\...`, `C:\Windows\...` |
| `bearer` | `Bearer <16+ characters>` |
| `cookie` | `SESSDATA`, `bili_jct`, `buvid3`, `__ac_nonce` |
| `api-key` | `apiKey: "..."`, `secret: "..."`, `token: "..."` |
| `raw-media` | a base64 `data:video/audio/image` payload |
| `frame-bytes` | a PNG or JPEG magic sequence |
| `transcript-text` | a transcript or a segment payload |
| `chrome-command-line` | `--user-data-dir=`, a shared source path, a `.mp4` name |

The scan runs over the WHOLE receipt, including every nested value, and it is
enforced twice: once before the receipt is written, and once by the offline
test that feeds each private shape through it.

## The scan result for this package

| scope | files | unexplained hits |
|---|---|---|
| the harness modules this pass added or changed | 16 | **0** |
| this evidence directory | 11 | **0** |

The machine-readable result is `08-redaction-scan.json`.

The known negatives are listed explicitly: a deliberately WRONG bearer literal
in the FC1 routed tests (a negative fixture, not a credential) and the locally
generated `seed.mp4` fixture NAMES in the pre-existing Runtime tests (produced by
ffmpeg inside a test's own temporary root; they name no path and are not the
private seed).

## The failure diagnostic

A failed visible run also leaves ONE redacted diagnostic: the case id, the
failure message with every path segment and every long token replaced, and the
owned residue counts. It is written through the same redaction rules, and it is
written to the same stable destination after the cleanup.
