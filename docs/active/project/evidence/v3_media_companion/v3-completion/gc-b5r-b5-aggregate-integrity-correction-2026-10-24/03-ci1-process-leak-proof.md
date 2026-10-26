# CI1 — every owned-process leak sighting is preserved

Oracle: `scripts/stage_b_b5_3/test/sequencer.node-test.mjs`
(31 cases, 31 pass, exit 0) and
`scripts/stage_b_b5_3/test/real_branches.node-test.mjs` (8 cases, 8 pass).

## The defect that was closed

Two problems, both of them false-green paths:

1. **The source row read a field that does not exist.**
   `collectSourceRows()` read `entry.leakedAfter`, while the sequencer
   stores `processAuditBefore` and `processAuditAfter`. Every source row
   therefore reported `ownedProcessLeakCount = 0`, whatever the audit had
   just observed.
2. **The final audit is a snapshot, not a record.** A descendant that
   outlived its source runner, was seen by that source's
   `processAuditAfter`, and exited while a later source ran was absent from
   BOTH the source oracle and the final oracle.

## The correction

### 1. The source row is bound to the REAL audit fields

```js
// sequencer.mjs, collectSourceRows()
processAuditBefore: entry.processAuditBefore ?? null,
processAuditAfter: entry.processAuditAfter ?? null,
ownedLeakSightings: sourceSightings,
audits: { …, ownedProcessLeakCount: sourceSightings.length, … }
```

The leak count of a row is the number of sightings that belong to THAT
source.

### 2. The sighting is LATCHED

```js
const leakSightings = [];
const leakSightingsByPid = new Map();

function auditOwnedProcesses(label) {
  const leaks = ownedProcesses.leaks();
  for (const leak of leaks) {
    if (leakSightingsByPid.has(leak.pid)) continue;
    const sighting = {
      source: leak.label ?? null,   // the SOURCE that produced the descendant
      pid: leak.pid,
      rootPid: leak.rootPid,
      observedIn: label,
      observedAtUtc: new Date().toISOString(),
    };
    leakSightingsByPid.set(leak.pid, sighting);
    leakSightings.push(sighting);
  }
  …
}
```

A sighting is recorded once and NEVER cleared. The tracker labels every
child with its owner (`ownedProcesses.track(child.pid, { label: "1/BV…" })`),
so a leak is attributed to the source that produced it.

### 3. The batch stops at the FIRST owned leak, and cleans only the owned descendants

```js
if (auditAfter.count > 0) {
  sequencerStopped = true;
  sequencerStopReason = `BVID ${order}/${bvid}: ${auditAfter.count} owned process leak(s) survived the source runner`;
  killedOwnedPids.push(...ownedProcesses.killOwnedLeaks());
  …
  break;
}
```

`killOwnedLeaks()` signals ONLY the pids the tracker recorded as
descendants of THIS sequencer's own child. An unrelated process is never
counted, never signalled and never terminated.

### 4. The final audit reports the LATCHED truth

```json
"processAudit": {
  "leakedAfter": 1,              // the LATCHED sighting count
  "ok": false,
  "leakedPids": [4711],
  "sightings": [{ "source": "1/BV11t8w6oEtP", "pid": 4711, "observedIn": "after-bvid-1", … }],
  "stillAliveAtCloseout": 0,     // the owned descendant was cleaned
  "killedOwnedPids": [4711]
}
```

The process exit is non-zero when `leakSightings.length > 0` — even when
nothing is alive at the closeout.

## The process-level negative case

`an OWNED descendant that exits before the closeout is still a leak`
(`sequencer.node-test.mjs`):

* the stub runner spawns a descendant that OUTLIVES it (`sleep 3`);
* the sequencer's after-bvid audit sees it alive → a leak;
* the sequencer stops the batch after the FIRST source, and cleans the owned
  descendant (SIGKILL);
* the descendant is therefore DEAD at the closeout
  (`stillAliveAtCloseout === 0`, `killedOwnedPids.length > 0`);
* and the LATCHED sighting still fails the batch:
  `leakedAfter > 0`, `sightings[0].source === "1/BV11t8w6oEtP"`,
  `summary.verdict.positive === false`, and the aggregate names the source
  (`AGG_AUDIT_FAILED … leaked an owned process`);
* the batch stopped after the FIRST leak: `summary.bvids.length === 1`;
* the UNRELATED live process that runs beside the batch is still alive and
  was never killed.

That is the exact false-green the review described: the process is gone at
the closeout, and the batch still fails.

## The negative receipts

| case | the assertion |
|---|---|
| `an OWNED leaked process exits nonzero` | a descendant of the sequencer's own child IS counted (`leakedAfter > 0`, `ok === false`) and the sequencer exits non-zero |
| `an OWNED descendant that exits before the closeout is still a leak` | the latched sighting survives the death of the process; the batch stops; the unrelated process survives |
| `an UNRELATED live runner is neither counted nor killed` (sequencer and real_branches) | `leakedAfter === 0`, `ok === true`, the exit is 0, and the unrelated process is still alive |
| `PH0-AR-10: SIGTERM to running sequencer → child killed + no leaked subprocesses` | the forwarded signal still leaves no owned leak |

## The honest limits

* The tracker samples the process tree every 150 ms: a descendant that is
  created AND exits inside one sampling window is never recorded.
* The tracker is Linux-only (it reads the Linux process filesystem). On
  another platform it finds no descendants and the audit reports nothing
  rather than guessing.
* The kill is a SIGKILL of the recorded pids. A pid that is recycled between
  the sighting and the signal could in principle be hit; the window is the
  interval between the after-bvid audit and the kill, which is milliseconds.
