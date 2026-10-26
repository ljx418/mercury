# GC-B6A Codex Checkpoint

Status: **GC-B6A CORRECTIVE IMPLEMENTATION MAY START**

Decision: **NO-GO for B6B**.

The submitted B6A denominator and its evidence manifest are intact, and the
60 focused tests rerun by Codex pass. The checkpoint nevertheless found four
Major implementation defects with executable false-green reproductions. B6B,
the fresh six-video run, and semantic scoring remain unauthorized until the
corrective acceptance set in `03-corrective-plan.md` is green.

## Severity

| Severity | Count |
|---|---:|
| Fatal | 0 |
| Major | 4 |
| Minor | 1 |

The Minor is the pre-existing public evidence-boundary inconsistency recorded
by the implementation handoff: an older B-5 evidence package contains the
published derivative bytes. Historical signed evidence is not edited here.
The B6B package must not repeat that content.

## Authorization boundary

Authorized now: offline corrective implementation and tests only.

Not authorized: Chrome, Cookie reads, Provider calls, downloads, real media
tasks, six-video execution, B6B review, B7, Stage C, refreeze, commit, push,
reset, clean, checkout, or revert.

