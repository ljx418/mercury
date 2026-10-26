# GC-B6J Zero-Action And Cleanup Audit

Batch: `GC-B6J OFFLINE CORRECTIVE`
Date: 2026-10-26

## 1. The external action counters of this batch

| Counter | Value |
|---|---:|
| Chrome launches | 0 |
| visible windows | 0 |
| Runtime starts | 0 |
| Runtime media tasks | 0 |
| Cookie reads | 0 |
| cookie injections | 0 |
| Provider requests | 0 |
| downloads | 0 |
| imports | 0 |
| real BVID executions | 0 |
| audio outputs | 0 |
| tabCapture actions | 0 |
| focus events | 0 |
| blind reviews | 0 |
| sentinel receipts | 0 |
| authorizations consumed | 0 |
| B6 bundles produced | 0 |
| visible runs | 0 |

Every acceptance case of this batch is OFFLINE. The Node cases drive the
REAL runner, the REAL sequencer and the REAL preparation in child processes
with the SYNTHETIC product dependency state; the product dependency probe
answers with a synthetic identity and no product database is ever opened.

The only product state this batch READ was the machine's own dependency
inputs during the `prepare_candidate.mjs --prepare-only` check of §4 of the
commands: the managed tools, the ASR root, the vision Provider source
database (read-only) and the built extension. That check is a LOCAL
preparation: it copies bytes, it resolves paths and it writes an owned
private root. It launched no Chrome, no Runtime, no media task, no Provider
call and no download.

## 2. The owned-resource cleanup

```text
$ ps -eo pid,cmd | grep -E "chrome|uvicorn|navia_runtime|sequencer.mjs|run_one_bvid|publish_public_evidence|production_preflight" | grep -v grep
(no output)

$ ss -ltn | grep 17861
(no output)

$ ls -d ${TMPDIR}/navia-b6j-* 2>/dev/null | wc -l
0

$ ls -d ${TMPDIR}/navia-b5-3-bvid* ${TMPDIR}/navia-b5-3-rtbvid* 2>/dev/null | wc -l
18

$ ls -ld --time-style=+%Y-%m-%d ${TMPDIR}/navia-b5-3-bvid* ${TMPDIR}/navia-b5-3-rtbvid* \
    | awk '$6=="2026-10-26"' | wc -l
0
```

- The temporary roots of the new cases are registered in the harness
  registry (`lib/temp_roots.mjs`) and removed at the test process exit.
- The one root this batch created outside that registry (the
  `prepare_candidate.mjs --prepare-only` check root) was removed by its EXACT
  path.
- The eighteen `navia-b5-3-*` roots are the residues of the EARLIER
  batches: every one of them carries a 2026-10-25 timestamp and NOT ONE of
  them was created by this batch. They were neither counted nor removed:
  the cleanup is done by OWNERSHIP, never by a wildcard and never by a date.
- The repository's own stage root (`.navia/b5-stage`) still carries its
  2026-10-25 content: this batch consumed no authorization and wrote no
  ledger event into it.
- No owned Chrome, no owned Runtime, no listener on the frozen product
  port.
- The unrelated processes of the other sessions on this machine were neither
  counted nor killed.

## 3. The spent candidate and the historical evidence

The spent GC-B6B candidate was neither rerun nor amended. No historical
evidence package and no generated public no-go package was edited: the
`gc-b6b-sealed-machine-negative-2026-10-26/` package and the
`gc-b6b-sealed-machine-negative-codex-2026-10-26/` decision package are
untouched, as are the GC-B6H, GC-B6H-R and GC-B6G packages.

## 4. The repository

This batch did not commit, push, reset, clean, check out or revert. The
unrelated dirty work of the concurrent sessions was preserved untouched.
