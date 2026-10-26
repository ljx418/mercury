"""WP0 R4 — the OWNED real Runtime process.

This module is never imported by pytest. It is launched as its own OS
process by ``wp0_r4_harness.py`` and then serves the real
``navia_runtime.app`` over a real TCP socket on a random free port.

Two properties make it a genuine process boundary rather than a TestClient
stand-in:

1. It is a separate PID. The harness proves ownership of that PID, and only
   ever signals the PID it recorded itself.
2. It binds a real port and the harness talks to it with a real HTTP client
   and a real WebSocket client over loopback.

``FAULT INJECTION`` is installed here, in the child, at import time — after
``navia_runtime.app`` has been imported but before the server accepts its
first connection. This is how R4 reaches injection points that live inside
``app.py`` **without editing ``app.py``**, which the v10 fixture freezes by
SHA-256.

The injected objects are the FAULT TRIGGERS only. The Runtime capture
handler, capture sink, stager, owner manifest, SQLite receipt, transcript
service and acquisition coordinator all remain the shipped production
classes executing their real code paths.
"""

from __future__ import annotations

import json
import os
import signal
import socket
import sys
import threading
from pathlib import Path
from typing import Any

HARD_KILL_EXIT_CODE = 137


def _install_environment(spec: dict[str, Any]) -> None:
    """Point every process-global store at this round's owned scratch root.

    Must run BEFORE ``navia_runtime.app`` is imported: the app creates its
    SQLite stores and task sandboxes at module import time.
    """
    root = Path(spec["root"])
    os.environ["NAVIA_DB_PATH"] = str(root / "navia.sqlite3")
    os.environ["NAVIA_MEDIA_TASK_ROOT"] = str(root / "media-tasks")
    os.environ["NAVIA_MEDIA_ASR_TASK_ROOT"] = str(root / "media-asr-tasks")
    os.environ["NAVIA_MEDIA_DOWNLOAD_CACHE_ROOT"] = str(root / "media-downloads")
    os.environ["NAVIA_VISION_PROVIDER_DB_PATH"] = str(root / "navia.sqlite3")
    os.environ["NAVIA_LOCAL_FILES_EXTENSION_ID"] = spec["extensionId"]
    os.environ["NAVIA_LOCAL_FILES_TOKEN"] = spec["token"]
    os.environ["NAVIA_R4_ACTIVE"] = "1"
    for name in ("media-tasks", "media-asr-tasks", "media-downloads"):
        (root / name).mkdir(parents=True, exist_ok=True)


def _durable_stage_observation(stager: Any, task_id: str) -> dict[str, Any]:
    """Prove the staged artifact is durably owned BEFORE the hard kill.

    Called immediately before ``os._exit`` at the
    ``after_stage_before_worker`` injection point. It reports what is
    actually on disk and in SQLite at that instant, so the evidence for
    "the kill happened after the owner manifest fsync and after the SQLite
    FULL receipt commit, and before the worker ran" is an observation taken
    by the process that is about to die — not an assumption.
    """
    from navia_runtime.modules.media_companion.acquisition.audio_ref import OWNER_FILE

    task_root = stager.tasks_root / task_id
    owner_path = task_root / OWNER_FILE
    receipt = stager.receipt(task_id)
    staged = task_root / "audio" / "current-part.wav"
    return {
        "taskRootExists": task_root.is_dir(),
        "ownerManifestExists": owner_path.is_file(),
        "ownerManifestBytes": owner_path.stat().st_size if owner_path.is_file() else 0,
        "receiptPresent": receipt is not None,
        "receiptState": (receipt or {}).get("state"),
        "receiptDurability": (receipt or {}).get("durability"),
        "receiptManifestSha256": (receipt or {}).get("manifestSha256"),
        "stagedAudioExists": staged.is_file(),
        "stagedAudioBytes": staged.stat().st_size if staged.is_file() else 0,
    }


def _write_fault_observation(root: Path, name: str, payload: dict[str, Any]) -> None:
    """Persist a fault observation outside the process, atomically enough."""
    target = root / "fault-observations.jsonl"
    line = json.dumps({"fault": name, "pid": os.getpid(), **payload}, ensure_ascii=False)
    with target.open("a", encoding="utf-8") as handle:
        handle.write(line + "\n")
        handle.flush()
        os.fsync(handle.fileno())


def _hard_kill(root: Path, name: str, payload: dict[str, Any] | None = None) -> None:
    """A real, un-interruptible process death.

    ``os._exit`` skips every ``finally`` block, every atexit hook and every
    context manager. That is the point: R4 must prove recovery works when
    the owner process had NO opportunity to clean up.
    """
    _write_fault_observation(root, name, payload or {})
    sys.stderr.flush()
    os._exit(HARD_KILL_EXIT_CODE)


def _install_faults(spec: dict[str, Any], runtime: Any) -> None:
    fault = spec.get("fault") or {}
    kind = fault.get("kind")
    if not fault:
        return
    root = Path(spec["root"])

    # -- deterministic transcript provider ---------------------------------
    # The frozen SenseVoice model is NOT installed in this environment, and
    # R5 (not R4) is the stage that proves real PCM -> SenseVoice. R4 needs
    # the durable product boundary to be reachable, so the ASR *model* — an
    # external binary dependency, like a browser or a network — is replaced
    # by a deterministic in-process provider. Every state machine under
    # acceptance (transcript service, stager, coordinator, authority store)
    # stays real.
    if fault.get("deterministicTranscript"):
        from navia_runtime.modules.media_companion.asr import provider as asp
        from navia_runtime.modules.media_companion.acquisition import transcript_service as ts

        # The frozen model profile the validator insists on. Only the MODEL
        # BINARY is replaced; the validator, the SRT normaliser and every
        # state machine around them stay real.
        _DETERMINISTIC_SRT = "1\n00:00:00,000 --> 00:00:00,400\ndeterministic r4 transcript segment\n"

        class _DeterministicProvider:
            provider_id = "funasr_edge_local"
            model_id = "funasr-sensevoice-small-q8"

            def load(self) -> None:
                return None

            def transcribe(self, audio, *, timeout=None, cancel_event=None):
                return asp.RawAsrTranscript(
                    provider_id=self.provider_id,
                    model_id=self.model_id,
                    task_id=audio.task_id,
                    format="srt",
                    text=_DETERMINISTIC_SRT,
                    elapsed_seconds=0.01,
                    vad_segment_count=1,
                    peak_rss_bytes=1024,
                )

            def self_test(self, audio, *, cancel_event=None):
                return self.transcribe(audio, cancel_event=cancel_event)

            def close(self) -> None:
                return None

        _original_init = ts.SenseVoiceTranscriptService.__init__

        def _patched_init(self, stager, provider_factory, *args, **kwargs):
            _original_init(self, stager, lambda: _DeterministicProvider(), *args, **kwargs)

        ts.SenseVoiceTranscriptService.__init__ = _patched_init
        # `app.py` builds the singleton at import time, so the instance already
        # captured the real provider factory. Rebind the INSTANCE, not just the
        # class, or the patch would silently never apply.
        runtime.media_transcript_service._provider_factory = lambda: _DeterministicProvider()

    # -- 1. after_sink_finalize --------------------------------------------
    if kind == "after_sink_finalize":
        from navia_runtime.modules.media_companion.acquisition import capture_sink as cs

        _original_finalize = cs.RuntimeCaptureSink.finalize

        def _patched_finalize(self):
            reference, receipt = _original_finalize(self)
            _hard_kill(root, kind, {"taskId": reference.task_id, "chunkCount": receipt.get("chunkCount")})
            return reference, receipt

        cs.RuntimeCaptureSink.finalize = _patched_finalize

    # -- 2. transcript_create ----------------------------------------------
    if kind == "transcript_create":
        from navia_runtime.modules.media_companion.acquisition import transcript_service as ts

        _original_create = ts.SenseVoiceTranscriptService.create

        def _patched_create(self, request):
            _hard_kill(root, kind, {"taskId": request.audio.task_id})
            return _original_create(self, request)

        ts.SenseVoiceTranscriptService.create = _patched_create

    # -- 3. before_stage ---------------------------------------------------
    if kind == "before_stage":
        from navia_runtime.modules.media_companion.acquisition import audio_ref

        _original_stage = audio_ref.TaskAudioStager.stage

        def _patched_stage(self, reference):
            _hard_kill(root, kind, {"taskId": reference.task_id})
            return _original_stage(self, reference)

        audio_ref.TaskAudioStager.stage = _patched_stage

    # -- 4. after_stage_before_worker --------------------------------------
    # The worker is started by `SenseVoiceTranscriptService.start`. Firing
    # on that call means the owner manifest has been fsynced, its parent
    # directory has been fsynced, and the SQLite FULL receipt has been
    # committed — all of it inside `create()` — and no worker thread has run
    # yet. The durable state is observed first, then the process dies.
    if kind == "after_stage_before_worker":
        from navia_runtime.modules.media_companion.acquisition import transcript_service as ts

        _original_start = ts.SenseVoiceTranscriptService.start

        def _patched_start(self, task_id):
            observation = _durable_stage_observation(self._stager, task_id)
            _hard_kill(root, kind, {"taskId": task_id, "durable": observation})

        ts.SenseVoiceTranscriptService.start = _patched_start

    # -- 5. handoff_completed_frame_send ----------------------------------
    # The `completed` frame is a HANDOFF. Injecting a failure of its send
    # must leave no durable product success behind.
    if kind == "handoff_completed_frame_send":
        from starlette.websockets import WebSocket

        _original_send_json = WebSocket.send_json

        def _patched_send_json(self, message, *args, **kwargs):
            if isinstance(message, dict) and message.get("type") == "completed":
                _write_fault_observation(root, kind, {"injected": "completed_frame_send"})
                raise RuntimeError("V3_MEDIA_CAPTURE_HANDOFF_FRAME_SEND_FAILED")
            return _original_send_json(self, message, *args, **kwargs)

        WebSocket.send_json = _patched_send_json

    # -- 6. commit_then_runtime_restart_before_background_observe ---------
    # Fires the instant the DURABLE product commit lands in SQLite, BEFORE
    # the Background service worker can observe it. `commit_terminal` is the
    # single write that turns a capture into a published `ready|degraded`
    # product, so this is the real boundary — not the acquisition completion
    # and not the completed handoff frame.
    if kind == "commit_then_runtime_restart_before_background_observe":
        from navia_runtime.modules.media_companion import task_store as ts_store

        _original_commit = ts_store.MediaTaskStore.commit_terminal

        def _patched_commit(self, bundle, **kwargs):
            # `commit_terminal(bundle, *, expected_revision, idempotency_key)`.
            # The durable write has already returned when the kill fires, so
            # the product really is committed and the Background worker really
            # has not observed it.
            result = _original_commit(self, bundle, **kwargs)
            task_id = bundle["task"]["taskId"]
            durable = self.get(task_id)
            _hard_kill(
                root,
                kind,
                {
                    "taskId": task_id,
                    "durableState": (durable or {}).get("state"),
                    "durableRevision": (durable or {}).get("revision"),
                    "durableOutlineId": (durable or {}).get("current_outline_id"),
                    "authorityState": (self.source_authority_by_task(task_id) or {}).get("state"),
                },
            )
            return result

        ts_store.MediaTaskStore.commit_terminal = _patched_commit


def _seed_capture_task(spec: dict[str, Any], runtime: Any) -> None:
    """Arrange the real precondition for a capture grant.

    A capture grant is only issuable once a real acquisition task has
    exhausted its three ordered fallback routes. The child reproduces that
    history by calling the REAL coordinator methods — nothing is stubbed and
    no state is fabricated in the store. The grant service, the ticket, the
    WebSocket handler, the sink, the stager, the owner manifest, the SQLite
    receipt and the authority store all stay the shipped production code.
    """
    seed = spec.get("seed")
    if not seed:
        return
    from navia_runtime.modules.media_companion.acquisition.coordinator import MediaAcquisitionRequest

    coordinator = runtime.media_acquisition_coordinator
    coordinator.create(
        MediaAcquisitionRequest(
            task_id=seed["taskId"],
            source_identity=seed["sourceIdentity"],
            adapter_id=seed["adapterId"],
            media_id=seed["mediaId"],
            playback_unit_id=seed["playbackUnitId"],
            part_id=seed["partId"],
            consent_policy_id=seed["consentPolicyId"],
            consent_policy_revision=int(seed["consentPolicyRevision"]),
        )
    )
    for route in ("credentialed_subtitle", "credentialed_media_asr", "public_or_page_subtitle"):
        coordinator.record_route_failure(seed["taskId"], route, seed.get("routeFailureCode", "V3_MEDIA_SUBTITLE_UNAVAILABLE"))


def main(argv: list[str]) -> int:
    spec = json.loads(Path(argv[1]).read_text(encoding="utf-8"))
    _install_environment(spec)

    # Import the real application BEFORE installing faults so the faults wrap
    # the shipped classes the app already bound.
    import navia_runtime.app as runtime  # noqa: PLC0415

    _seed_capture_task(spec, runtime)
    _install_faults(spec, runtime)

    import uvicorn  # noqa: PLC0415

    ready = {
        "pid": os.getpid(),
        "port": spec["port"],
        "origin": spec["origin"],
        "root": spec["root"],
        "fault": spec.get("fault"),
    }
    ready_path = Path(spec["root"]) / "ready.json"
    ready_path.write_text(json.dumps(ready), encoding="utf-8")

    def _shutdown(*_args: Any) -> None:
        # SIGTERM must reach the ASGI server so uvicorn runs its own
        # shutdown path; only then may the harness wait for exit.
        os._exit(0)

    signal.signal(signal.SIGTERM, _shutdown)

    uvicorn.run(runtime.app, host="127.0.0.1", port=spec["port"], log_level="warning", access_log=False)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
