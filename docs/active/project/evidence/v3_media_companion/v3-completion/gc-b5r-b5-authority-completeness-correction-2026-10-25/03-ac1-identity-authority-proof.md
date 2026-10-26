# AC1 — every machine identity field is bound to the authority

Oracles:
`scripts/stage_b_b5_3/test/machine_identity.node-test.mjs` (17 cases),
`scripts/stage_b_b5_3/test/aggregate_identity.node-test.mjs` (the AC1 cases)
and the AC1 process-level cases of
`scripts/stage_b_b5_3/test/sequencer.node-test.mjs` (7 cases).

## The defect that was closed

Three semantic gaps remained in the eleven required fields:

1. the source identity parser accepted ANY syntactically valid adapter, so
   `portal:attacker:<frozen-bvid>:cid:p1` passed;
2. the task namespace was validated only as a non-empty string, and the
   sequencer recorded only whether `task_namespace.json` EXISTED — the file
   was never parsed and never bound to the machine receipt or the row;
3. the timestamps were validated with a REGEX only: `2026-99-99T99:99:99Z`
   matches the format, `Date.parse()` yields `NaN`, and the ordering
   comparison was false rather than a defect. An impossible calendar day
   (`2026-02-30`) is silently rolled over to March by the JavaScript date
   parser.

The Codex reproduced it: `{"identityDefects":[]}` for a receipt carrying an
arbitrary namespace, the attacker adapter and calendar-invalid timestamps.

## The closure

### 1. The source identity is the FROZEN authority

```js
export const FROZEN_SOURCE_PORTAL = "portal";
export const FROZEN_SOURCE_ADAPTER = "bilibili";
```

The identity must PARSE **and** equal the frozen authority:

| the component | the rule |
|---|---|
| the portal | the literal `portal` |
| the adapter | the literal `bilibili` |
| the BVID | the exact registry row BVID |
| the playback unit | non-empty |
| the part | non-empty |

```js
if (source.portal !== FROZEN_SOURCE_PORTAL) defects.push(…);
if (source.adapter !== FROZEN_SOURCE_ADAPTER) defects.push(…);
if (!source.playbackUnit || !source.part) defects.push(…);
if (source.bvid !== String(bvid)) defects.push(…);
```

### 2. The task namespace has the FROZEN shape

The namespace is validated against the same frozen shape as the task id:
`^media_task_[a-f0-9]{32}$`. An arbitrary non-empty string is a defect.

### 3. The task-namespace RECEIPT is parsed and bound

The sequencer now PARSES `task_namespace.json` (its presence is not proof)
and hands it to the aggregate:

```js
let namespaceReceipt = null;
try {
  namespaceReceipt = JSON.parse(fs.readFileSync(path.join(dir, "task_namespace.json"), "utf8"));
} catch (error) { namespaceParseError = …; }
```

The aggregate requires the EXACT key set (`taskIdNamespace`, `bvid`,
`order`, `runId` — a missing AND an extra field are defects) and binds:

| the fact | the binding |
|---|---|
| `taskIdNamespace` | `===` the machine receipt's `taskNamespace` and the frozen shape |
| `runId` | `===` the current candidate run id |
| `order` | `===` the registry row order |
| `bvid` | `===` the registry row bvid |

A missing or malformed file is a defect (`AGG_NAMESPACE_RECEIPT_INVALID`),
never a silent pass.

### 4. The timestamps are FINITE, REAL UTC instants

A regular expression is not enough, so the calendar is checked explicitly and
the value is never normalized:

```js
export function isFiniteUtcInstant(value) {
  if (typeof value !== "string" || !ISO_TIMESTAMP.test(value)) return false;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return false;
  const [year, month, day, hour, minute, second] = …;
  if (month < 1 || month > 12) return false;
  if (hour > 23 || minute > 59 || second > 59) return false;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day < 1 || day > daysInMonth) return false;
  return true;
}
```

and `finish >= start` is required.

## The negatives

### The direct validator cases (`machine_identity.node-test.mjs`)

| the case | what it proves |
|---|---|
| `AC1: the source portal and adapter are the FROZEN authority` | the attacker adapter and a foreign portal are defects |
| `AC1: the playback unit and the part must be present` | the components are non-empty |
| `AC1: the task namespace must satisfy the FROZEN shape` | an arbitrary non-empty namespace is a defect |
| `AC1: the timestamps must be FINITE, REAL UTC instants` | `2026-99-99…`, `2026-13-01…`, `2026-02-30…`, `T24:00:00`, `T00:60:00` are all rejected |
| `AC1: a reversed window is a defect` | `finish < start` |
| `AC1: the task namespace RECEIPT is parsed and bound` | the missing field, the extra field, the cross-row namespace, the cross-row run id, the malformed namespace and the absent receipt |

### The pure aggregate cases (`aggregate_identity.node-test.mjs`)

| the case | the failure |
|---|---|
| `AC1: a FOREIGN ADAPTER is not a positive candidate` | `AGG_MACHINE_IDENTITY_INVALID` |
| `AC1: a MALFORMED namespace is not a positive candidate` | `AGG_MACHINE_IDENTITY_INVALID` |
| `AC1: a NAMESPACE FILE MISMATCH is not a positive candidate` | `AGG_NAMESPACE_RECEIPT_INVALID` |
| `AC1: a MALFORMED namespace receipt is not a positive candidate` | `AGG_NAMESPACE_RECEIPT_INVALID` |
| `AC1: an ABSENT namespace receipt is not a positive candidate` | `AGG_NAMESPACE_RECEIPT_INVALID` |
| `AC1: an INVALID date/time is not a positive candidate` | `AGG_MACHINE_IDENTITY_INVALID` |
| `AC1: a REVERSED window is not a positive candidate` | `AGG_MACHINE_IDENTITY_INVALID` |

### The process-level cases (`sequencer.node-test.mjs`, the REAL sequencer)

| the case | the failure |
|---|---|
| `AC1: a foreign source adapter exits nonzero` | `AGG_MACHINE_IDENTITY_INVALID` |
| `AC1: a malformed machine task namespace exits nonzero` | `AGG_MACHINE_IDENTITY_INVALID` |
| `AC1: a malformed task namespace receipt exits nonzero` | `AGG_NAMESPACE_RECEIPT_INVALID` |
| `AC1: a task namespace file mismatch exits nonzero` | `AGG_NAMESPACE_RECEIPT_INVALID` |
| `AC1: an invalid date and time exits nonzero` | `AGG_MACHINE_IDENTITY_INVALID` |
| `AC1: a reversed attempt window exits nonzero` | `AGG_MACHINE_IDENTITY_INVALID` |

Every process-level case asserts a NON-ZERO process exit, a not-positive
verdict and the exact failure code.

## The Codex reproduction, re-run

```text
AC-01 identityDefects:
["the machine receipt has no valid taskNamespace",
 "the machine receipt source identity names the adapter attacker instead of bilibili",
 "the machine receipt has no valid startedAtUtc",
 "the machine receipt has no valid finishedAtUtc"]
```

## The honest limits

* The source identity's playback unit and part are required to be NON-EMPTY
  and to be free of colons; they are not compared against the portal's own
  catalogue, because the frozen row does not carry them.
* The namespace receipt is bound to the machine receipt, the current run and
  the registry row. It is not re-derived from the task store: the Runtime
  owns that.
* The identity is required for a COMPLETE row. A source that failed before
  its task existed legitimately has no task id, and it can never make the
  candidate positive anyway.
