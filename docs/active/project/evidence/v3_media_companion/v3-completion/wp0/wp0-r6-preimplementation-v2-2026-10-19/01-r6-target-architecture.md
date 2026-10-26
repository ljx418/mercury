# R6 target architecture and ownership

## 1. Purpose

R6 validates failure behavior of the already implemented v11 relay. It is not a second relay rewrite.
Public Runtime endpoints, ticket TTL, Cookie/provider contracts, SourceAuthority, Side Panel materialize
ownership and user workflow remain unchanged.

## 2. Production ownership graph

```text
Side Panel trusted action
  -> Background MediaCaptureController (single orchestration owner)
     -> resolveCaptureGrantBinding (task/tab/page binding)
     -> RuntimeCaptureTransport (only Runtime WebSocket owner)
     -> OffscreenAudioPort (trusted Port + sender/document binding)
        -> OffscreenProducerBootstrap (getUserMedia/AudioContext/PCM only)
  -> Runtime /v1/media/capture-stream
     -> RuntimeCaptureSink (private capture bytes)
     -> TaskAudioStager (synchronous durable handoff)
     -> owner manifest + SQLite FULL receipt
     -> transcript service / SenseVoice
     -> MediaAcquisitionCoordinator.recover_interrupted()
        -> TaskAudioStager.recover_cleanup() + product cleanup callback
  -> existing Side Panel materialize effect
     -> MediaTaskStore ready|degraded durable product terminal
```

## 3. R6 execution layers

| Group | Boundary | Driver | Window policy |
|---|---|---|---|
| R6-G1 | sender/context, protocol, sequence, stream lifetime, backpressure | production TypeScript classes and two-end harness | headless |
| R6-G2 | permission, getContexts, Port disconnect, tab close/navigation, cancel, worker restart | one fresh owned Chrome session plus production extension | one consolidated visible muted run |
| R6-G3 | ticket/binding, WS loss, ACK timeout, Runtime SIGTERM/hard kill/404 | real owned Uvicorn processes and real WS/HTTP clients | headless |
| R6-G4 | six handoff points, seven recovery dispositions, eight owner corruptions | `MediaAcquisitionCoordinator.recover_interrupted`, `TaskAudioStager.recover_cleanup` and owned child processes | headless |
| R6-G5 | cleanup, secret, regression, evidence sealing | scanners/verifiers and process inventory | headless |

### Current implementation status

| Concrete entity | Current state before R6 | R6 treatment |
|---|---|---|
| `MediaCaptureController` | implemented; R3 composition tests accepted | inject lifecycle faults, do not create a second owner |
| `RuntimeCaptureTransport` | implemented; R2 bounds and closeout accepted | negative protocol/timeout/WS matrix |
| `OffscreenAudioPort` / `OffscreenProducerBootstrap` | implemented; Offscreen zero-network invariant accepted | sender/context/queue/disconnect matrix |
| `RelayRestartReconciler` / `RuntimeRelayRecoveryAdapter` | implemented; restart composition accepted | phase dispatch, DELETE/GET/404 matrix |
| Runtime capture handler / `RuntimeCaptureSink` | implemented; R4 real Uvicorn matrix accepted | real WS, SIGTERM and closeout faults |
| `TaskAudioStager` + ownership receipt | implemented; R4 durability/corruption matrix accepted | reuse harness design only; execute every R6 case fresh |
| `MediaAcquisitionCoordinator.recover_interrupted` | implemented; R4 composite cleanup accepted | hard-kill recovery and residual proof |
| R5-B browser relay positive | accepted 12/12 | immutable same-candidate entry gate |

## 4. Invariants

1. Background remains the sole WebSocket and capture orchestration owner.
2. Offscreen remains a bounded PCM producer and never receives ticket, source identity or Runtime URL.
3. Every rejection settles once, emits the exact frozen code, stops producer/consumer, and cleans its owner.
4. Restart never resumes old PCM, ticket, stream ID or sequence.
5. Handoff is not product success; only durable `ready|degraded` is published.
6. Missing, torn, mismatched or unsafe owner evidence fails closed.
7. A successful negative case proves the expected failure plus zero forbidden side effect; exit 0 alone is
   insufficient.
8. Visible tests are muted, owned by exact Profile/PID and consolidated into one disturbance window.

## 5. Evidence policy

R4 reports remain historical design evidence, but no R4 behavior result is reused as an R6 case result.
The R4 run did not freeze a complete per-case production-source closure, so retroactive hash matching could
create a false green. All 65 R6 behavioral items execute fresh. R6 may use the existing R4 harness design,
but it runs only the targeted R6 cases rather than repeating the entire 62-process R4 matrix.

The R5-B entry is also candidate-bound: R6-0 must verify the accepted R5-B checkpoint payload manifest,
build tree hash and production-source closure hash against the current worktree using the exact roots,
ordered inventory and line encoding frozen in `04-r6-case-matrix.json`. Any mismatch returns to R5-B
acceptance; the presence of old PASS text is insufficient. The closure includes the capture worklet and
the process-audio-isolation implementation used by the accepted positive, so those facts cannot drift out
of the candidate unnoticed.

