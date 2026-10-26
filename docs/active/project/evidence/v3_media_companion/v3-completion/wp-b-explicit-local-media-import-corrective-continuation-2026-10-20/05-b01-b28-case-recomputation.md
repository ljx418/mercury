# WP-B B01-B28 recomputation from production drivers

Recomputed on 2026-10-20 against the corrective-continuation implementation.
The denominator is the frozen B01-B30 set; nothing here re-defines a case.

| Case | Production driver | Test file(s) |
|---|---|---|
| B01 | frozen schema + semantic validation of the storeRecord | `test_v3_media_local_import_contracts_store.py` |
| B02 | routed POST over the real ASGI app, privileged Origin middleware and bearer | `test_v3_media_local_import_api.py` |
| B03 | one active import per task, proven on the REAL coordinator | `test_v3_media_local_import_api.py`, `test_v3_media_local_import_gates.py` |
| B04 | routed OPTIONS, exact allow-origin, frozen methods/headers, no-store | `test_v3_media_local_import_api.py` |
| B05 | one-shot token: 43 chars, digest-only, bound to its import, single use | `test_v3_media_local_import_api.py`, `test_v3_media_local_import_manager.py` |
| B06 | terminal DELETE idempotence and restart-persisted terminal records | `test_v3_media_local_import_api.py`, `test_v3_media_local_import_contracts_store.py`, `test_v3_media_local_import_restart.py` |
| B07 | error details carry only the frozen key set | `test_v3_media_local_import_contracts_store.py` |
| B08 | NO case-bearing driver exists in this repository | - |
| B09 | NO case-bearing driver exists in this repository | - |
| B10 | pre-writer rejection: token, content type, encoding, declared length | `test_v3_media_local_import_api.py` |
| B11 | memoryview slices <= 1 MiB with a chunking-independent cumulative digest | `test_v3_media_local_import_manager.py` |
| B12 | cancellation stops the writer and leaves a retryable state | `test_v3_media_local_import_manager.py`, `test_v3_media_local_import_restart.py` |
| B13 | real containers vs faked MIME, verified ffprobe/ffmpeg | `test_v3_media_local_import_preparer.py` |
| B14 | duration and dimension limits at their exact boundary | `test_v3_media_local_import_preparer.py` |
| B15 | missing tool, digest drift, timeout, non-zero exit, hostile stderr | `test_v3_media_local_import_preparer.py` |
| B16 | exact disk-space boundary, and C3 eligibility outranking it | `test_v3_media_local_import_gates.py` |
| B17 | NO case-bearing driver exists in this repository | - |
| B18 | distributed frames, monotonic timestamps, closed receipt digest | `test_v3_media_local_import_preparer.py` |
| B19 | bind atomicity on the REAL coordinator under its own lock | `test_v3_media_local_import_barrier.py` |
| B20 | the local route names no downloader, credential resolver or capture | `test_v3_media_local_import_barrier.py` |
| B21 | PUBLIC API + real barrier + REAL local SenseVoice on real speech | `test_wp_b_c7_production.py` |
| B22 | receipt-bound frames into the REAL materializer, neither consumer early | `test_wp_b_c4_orchestrator.py`, `test_wp_b_c7_production.py` |
| B23 | NO case-bearing driver exists in this repository | - |
| B24 | cancel from every non-terminal phase | `test_v3_media_local_import_restart.py` |
| B25 | cancel racing a terminal receipt | `test_v3_media_local_import_restart.py` |
| B26 | restart recovery: real hard kill at 7 frozen injection points, rc 137 | `test_v3_media_local_import_contracts_store.py`, `test_v3_media_local_import_restart.py` |
| B27 | NO case-bearing driver exists in this repository | - |
| B28 | a stale callback cannot rewrite a terminal record; no token on disk | `test_v3_media_local_import_gates.py` |

**23/28 of B01-B28 have a case-bearing production driver.**
B08, B09, B17, B23 and B27 carry no case label anywhere in the local-import
suite; their definitions live only in the external Codex checkpoint, which this
batch is instructed not to re-audit. They are therefore reported as NOT
RECOMPUTED rather than as passing.

B29/B30 remain unrequested and unprocessed, per the standing instruction that
no seed media is requested until C3-C7 and B01-B28 are closed.
