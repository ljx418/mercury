# WP-B final corrective — cleanup report

Every artifact this package created is owned and removable. Nothing was left
running, and nothing that belongs to another project was touched.

## Owned processes

| kind | count | note |
|---|---|---|
| visible Chrome | **0** | no browser was launched at any point |
| owned Chrome profile | **0** | no profile was created |
| owned Runtime (uvicorn) | **0** | the Runtime was driven in-process over the ASGI transport; the only child processes were the probe's own hard-kill children, each of which exits immediately |
| owned ffmpeg / ffprobe | **0** left running | each runs to completion inside the test |
| owned ASR worker | **0** left running | the SenseVoice worker is a daemon thread inside the test process |
| background threads | 0 | the orchestration executor is shut down with the process |

## Owned ports

**0.** No Runtime, no proxy and no dev server was bound to a port. The
`/v1/media/*` routes were exercised over the real ASGI transport, not over
TCP, except for the WP0 R4 probe, which starts and terminates its own owned
Uvicorn child inside the test.

## Owned temporary artifacts

| artifact | disposition |
|---|---|
| the private media seed and its converted cookie file | **deleted** in the `finally` of the download step; the seed never entered the repository |
| the per-case temporary roots under `/tmp/pytest-of-*` | removed by pytest |
| the ASR task staging roots | cleaned by the product's own barrier; the leftover root is removed in the final cleanup step |
| the media task roots and the visual product roots | removed by the product's own cleanup, and proven zero-residual in the B22 receipt |
| the local-import staging roots | removed by the barrier's single cleanup owner, proven `sourceResidual = 0` |

## Repository state

* **Nothing was committed, pushed, reset, cleaned, checked out or reverted.**
* **No unrelated dirty-worktree change was overwritten.** The worktree already
  carried modifications from the earlier WP-A / WP-B / relay batches; they were
  left exactly as they were.
* No frozen evidence was modified: the v10/v11 relay evidence, the WP-A
  evidence and the Codex checkpoint documents are byte-identical.
* The misspelled `corective` evidence directory is untouched; this package uses
  the correctly spelled `corrective` path throughout.

## Media and secrets

* The private seed, the downloaded video and the converted cookie file live
  only outside the repository and are deleted; `07-secret-path-raw-media-scan.json`
  records the scan that proves no path, no file name, no cookie value and no
  raw media reached this package's files or its evidence.
* The Windows credential vault was read for the vision Provider's key, which
  is the product's own designed path. The key itself is never printed, logged
  or written to the evidence: only the Provider id and the dispatch counts
  appear there.
