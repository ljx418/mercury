# GC-B6H-R Zero-Action And Cleanup Audit

Batch: `GC-B6H-R OFFLINE CORRECTIVE`
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
| VISIBLE authorizations consumed | 0 |
| B6 bundles produced | 0 |
| private review bundles produced | 0 |
| visible runs | 0 |

Every acceptance case of this batch is OFFLINE. The Node cases drive the
REAL runner, the REAL sequencer and the REAL publisher in child processes
with the fault seam, with a synthetic candidate path and with synthetic
authorities; the Python cases call the production functions with synthetic
data. No socket left the machine, no browser was started and no VISIBLE
authorization was consumed.

### The one clarification a reviewer must have

The PRE-EXISTING offline Stage B suite issues SYNTHETIC child grants in a
temporary stage root: the sequencer owns a one-shot authorization and the
offline cases exercise that owner with a throwaway identifier inside a
throwaway directory. That is the harness's own convention, it was already
present in the accepted offline suite, and it is NOT the visible
six-source authorization. This batch consumed NO visible authorization and
NO run identifier of the real candidate.

The only REAL product identities the batch touched were the SIX FROZEN
REGISTRY BVIDS, and only as ARGYUMENTS: the runner asserts the frozen
identity of the source it was asked to run and then stops before the grant,
before the Cookie, before the Runtime and before Chrome. No source was
acquired, transcribed, downloaded or synthesised.

## 2. The owned-resource cleanup

```text
$ ps -eo pid,cmd | grep -E "chrome|uvicorn|navia_runtime|sequencer.mjs|run_one_bvid|publish_public_evidence" | grep -v grep
(no output)

$ ss -ltn | grep 17861
(no output)

$ ls -d ${TMPDIR}/navia-b6hr-* 2>/dev/null | wc -l
0

$ ls -d ${TMPDIR}/navia-b5-3-bvid* ${TMPDIR}/navia-b5-3-rtbvid* 2>/dev/null | wc -l
18

$ ls -ld --time-style=+%Y-%m-%d ${TMPDIR}/navia-b5-3-bvid* ${TMPDIR}/navia-b5-3-rtbvid* \
    | awk '$6=="2026-10-26"' | wc -l
0
```

The eighteen `navia-b5-3-*` roots are the residues of the EARLIER batches:
every one of them carries a 2026-10-25 timestamp and NOT ONE of them was
created by this batch. They were neither counted nor removed: the cleanup is
done by OWNERSHIP, never by a wildcard and never by a date.

The ONLY residue this batch created was the temporary root of one debug
script (the `navia-b6hr-dbg-` root of the temporary directory), and it was
removed by its EXACT path. The roots that the RUNNER creates for its own
scratch and profile are removed by the runner's finally path, and the roots
that the new test cases create are registered in the harness registry and
removed at the test process exit: this batch left NO root of its own behind.

- The temporary roots of the new Node cases are registered in the harness
  registry (`lib/temp_roots.mjs`) and removed at the test process exit.
- The closure snapshots are created inside those owned roots, so a snapshot
  never outlives its test.
- No owned Chrome, no owned Runtime, no listener on the frozen product port.
- The unrelated processes of the other sessions on this machine were neither
  counted nor killed.

## 3. The historical evidence

No historical evidence package was edited by this batch. The GC-B6B public
package, the GC-B6C packages, the GC-B6D packages, the GC-B6F packages, the
GC-B6G package, the GC-B6H candidate package and the GC-B6H checkpoint
package are untouched.

## 4. The repository

This batch did not commit, push, reset, clean, check out or revert. The
unrelated dirty work of the concurrent sessions was preserved untouched.
