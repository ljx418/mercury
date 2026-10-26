# R5-B relay v11 PRD and architecture review

## Scope conclusion

The implementation closes the Window 11 `document_id_missing` incompatibility without weakening the trusted
capture boundary. The change is internal transport/security architecture only; it adds no user step and changes
no public product promise.

## Requirement review

| Requirement | Result |
|---|---|
| one trusted user action starts the existing capture fallback | preserved; visible proof pending |
| Background owns Runtime transport | PASS |
| Offscreen cannot receive Runtime credential/source/task identity | PASS |
| exactly one authoritative Offscreen context | PASS |
| optional sender document ID handled without URL-only trust | PASS |
| context document ID remains non-empty binding authority | PASS |
| replacement and pre-validation races fail closed | PASS |
| v10 historical evidence retained | PASS |
| no sound during automated validation | PASS |
| public API/FailureCode/threshold drift | none |

## Remaining gate

Offline tests cannot prove Chrome's production sender/context behavior, non-empty PCM, Runtime sink receipt,
effective SenseVoice execution, durable materialization or user-visible busy-state cleanup. Those facts require
the one authorized visible positive run on fixed BVID `BV1Bb411w741` with the approved local Cookie file.

Therefore R5 remains pending. R6 package revision and R6 implementation remain blocked until that run succeeds.

## Severity

- Fatal: 0
- Major: 0 in the offline implementation
- Minor: 0
- External pending gate: one visible production positive

