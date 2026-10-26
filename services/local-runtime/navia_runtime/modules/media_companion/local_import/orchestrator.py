"""WP-B production orchestration for the explicit local-import route.

ONE Runtime-owned orchestrator drives the whole frozen handoff. Nothing else
may skip a step:

  durable EOF ─▶ T1 `video_durable`
              ─▶ verified ffprobe/ffmpeg preparation (16 kHz mono WAV + 1..8 frames
                 + the canonical visual receipt)
              ─▶ T2 `inputs_prepared`
              ─▶ T3 `input_bound` (the coordinator binds the SAME digests)
              ─▶ the ASR stager's owner receipt
              ─▶ delete the ORIGINAL video
              ─▶ T4 `video_deleted`
              ─▶ transcript creation/start, then the receipt-bound product

Every collaborator is the REAL production object: the real coordinator, the
real `TaskAudioStager`, the real `LocalMediaPreparer`, the real transcript
service and the real product materializer. They are injected by `app.py`.
"""

from __future__ import annotations

import hashlib
import json
import shutil
import threading
import wave
from pathlib import Path
from typing import Any, Callable

from . import contracts as C
from .consumer_barrier import LocalMediaConsumerBarrier, _phase_index
from .store import LocalMediaBarrierStore, LocalMediaImportStore

def _digest(path: Path) -> str:
    digest = hashlib.sha256()
    with Path(path).open("rb") as handle:
        for chunk in iter(lambda: handle.read(C.WRITER_SLICE_BYTES), b""):
            digest.update(chunk)
    return digest.hexdigest()


class LocalImportOrchestrator:
    """The single owner of the frozen T1..T4 handoff for local imports."""

    def __init__(
        self,
        *,
        store: LocalMediaImportStore,
        coordinator: Any,
        stager: Any,
        manager: Any = None,
        sandbox: Any,
        media_root: Path,
        preparer_factory: Callable[[str, str, Path], Any],
        snapshot_resolver: Callable[[str], Any] | None = None,
        transcript_service: Any | None = None,
        materializer: Any | None = None,
        product_reconciler: Callable[[str], bool] | None = None,
    ) -> None:
        self.store = store
        self.manager = manager
        self.barriers = LocalMediaBarrierStore(store.database_path)
        self.coordinator = coordinator
        self.stager = stager
        self.sandbox = sandbox
        self.media_root = Path(media_root)
        self.preparer_factory = preparer_factory
        self.snapshot_resolver = snapshot_resolver
        self.transcript_service = transcript_service
        self.materializer = materializer
        # AC1: the startup repair seam. For a task whose imported product is
        # already durable, it is asked whether the missing visual-terminal
        # receipt can be submitted now. It is driven by the DURABLE product
        # facts, never by process memory.
        self.product_reconciler = product_reconciler
        self._lock = threading.RLock()
        # importId -> barrier, so the materializer and the transcript service
        # can reach the one barrier that owns the shared input.
        self._barriers: dict[str, LocalMediaConsumerBarrier] = {}
        # taskId -> importId, the ONLY reverse index; no second source authority.
        self._by_task: dict[str, str] = {}
        # The import whose orchestration is currently running, so a failure
        # knows which record it must settle.
        self._failing_import_id: str | None = None

    # -- paths ---------------------------------------------------------------

    def shared_input(self, import_id: str) -> Path:
        return self.media_root / import_id / "source.bin"

    def _release_owned_root(self, import_id: str) -> None:
        """Release exactly one import-owned source root, idempotently.

        The import id comes from the durable store, but the path boundary is
        still checked here because this is the destructive capability used by
        restart recovery. It may never follow a substituted root symlink or
        remove the media root itself.
        """
        if not C.IMPORT_ID_RE.fullmatch(import_id):
            raise OSError("invalid import root")
        media_root = self.media_root.resolve()
        owned_root = self.media_root / import_id
        if owned_root.is_symlink() or owned_root.resolve().parent != media_root:
            raise OSError("import root escaped its owner")
        if owned_root.exists():
            shutil.rmtree(owned_root)

    def barrier_for(self, import_id: str) -> LocalMediaConsumerBarrier:
        with self._lock:
            existing = self._barriers.get(import_id)
        if existing is not None:
            return existing
        barrier = LocalMediaConsumerBarrier(
            store=self.store,
            barrier_store=self.barriers,
            coordinator=self.coordinator,
            import_id=import_id,
            shared_input=self.shared_input(import_id),
            release_owned_root=lambda: self._release_owned_root(import_id),
        )
        with self._lock:
            self._barriers.setdefault(import_id, barrier)
            self._by_task[self.store.get(import_id)["taskId"]] = import_id
        return self._barriers[import_id]

    def import_id_for_task(self, task_id: str) -> str | None:
        with self._lock:
            known = self._by_task.get(task_id)
        if known is not None:
            return known
        # A fresh process knows nothing in memory; the DURABLE records are the
        # truth, so the task is looked up there.
        for record in self.store.list_incomplete():
            if record["taskId"] == task_id:
                with self._lock:
                    self._by_task[task_id] = record["importId"]
                return record["importId"]
        return None

    # -- the frozen handoff --------------------------------------------------

    def run(self, import_id: str) -> dict[str, Any]:
        """Drive T1..T4 for one import. Returns the durable receipts."""
        record = self.store.get(import_id)
        if record["state"] != "verifying":
            raise C.ImportError("REQUEST_INVALID", "Only a verified upload may be prepared.")
        with self._lock:
            self._failing_import_id = import_id
        barrier = self.barrier_for(import_id)
        media = self.shared_input(import_id)

        # B19: the import's dependency generation must be the one the task
        # holds RIGHT NOW. A generation that was swapped under the task may not
        # prepare, bind or stage anything.
        if self.snapshot_resolver is not None:
            snapshot = self.snapshot_resolver(record["taskId"])
            leased = getattr(snapshot, "generation", None)
            if isinstance(leased, str) and leased and leased != record["dependencyGeneration"]:
                raise C.ImportError(
                    "REQUEST_INVALID",
                    "The task's dependency generation changed before the handoff.",
                )

        # --- T1: the uploaded bytes ARE the owner manifest -------------------
        expected = record["videoManifestSha256"]
        if not expected or not media.is_file():
            raise C.ImportError("WRITE_FAILED", "The uploaded video is not durable.")
        if _digest(media) != expected:
            raise C.ImportError("WRITE_FAILED", "The uploaded video no longer matches its manifest.")
        barrier.mark_video_durable(video_manifest_sha256=expected)

        # --- T2: verified preparation ----------------------------------------
        # T1 advanced the frozen record's own compare-and-set, so the sequence
        # is re-read here rather than reused.
        self.store.transition(
            import_id,
            expected_sequence=self.store.get(import_id)["sequence"],
            state="preparing",
        )
        prepared = self.preparer_factory(record["taskId"], record["sourceIdentity"], media).prepare(
            media, declared_media_type=record["declaredMediaType"]
        )
        visual_receipt_sha256 = _digest(prepared.visual_receipt_path)
        published = self._publish_wav(record["taskId"], prepared)
        # The ASR ref binds the WAV's OWN shape and length. The container's
        # duration stays in the visual receipt, which is what the frames index.
        wave_shape = _wave_shape(published["artifact"].byte_length and prepared.wav_path)
        barrier.mark_inputs_prepared(
            visual_receipt_sha256=visual_receipt_sha256,
            prepared_media={
                "durationMs": prepared.duration_ms,
                "widthPx": prepared.width,
                "heightPx": prepared.height,
                "container": prepared.container,
                "route": C.ROUTE,
            },
        )

        # --- T3: the coordinator binds the SAME digests ----------------------
        barrier.mark_input_bound(
            video_manifest_sha256=expected,
            visual_receipt_sha256=visual_receipt_sha256,
            audio_artifact=published["artifact"].public_dict(),
            duration_ms=wave_shape["durationMs"],
            sample_rate_hz=wave_shape["sampleRateHz"],
            channels=wave_shape["channels"],
            sample_width_bytes=wave_shape["sampleWidthBytes"],
        )

        # --- the ASR stager's owner receipt ----------------------------------
        # The transcript service owns the staging step, so the audio is staged
        # exactly once. Without a service (a bare orchestrator) the orchestrator
        # stages it itself. Either way the receipt that authorises the delete is
        # the one the stager COMMITTED, never a value computed here.
        reference = self.coordinator.audio_reference(record["taskId"])
        if self.transcript_service is not None:
            from navia_runtime.modules.media_companion.acquisition.transcript_service import (
                TranscriptTask,
            )

            # `audio_reference()` re-reads the binding T3 committed, so ASR can
            # never start against a different artifact than the one that was
            # staged and whose owner receipt is durable.
            self.transcript_service.create(TranscriptTask(reference))
            # From here the ASR stage is ONE OF TWO consumers: it reports a
            # terminal receipt and never releases the shared input.
            self.transcript_service.defer_to_barrier(record["taskId"])
        else:
            self.stager.stage(reference)
        owner = self.stager.receipt(record["taskId"])
        if not isinstance(owner, dict) or "manifestSha256" not in owner:
            raise C.ImportError("WRITE_FAILED", "The ASR owner receipt is not committed.")
        barrier.mark_audio_staged(audio_owner_receipt_sha256=str(owner["manifestSha256"]))

        # --- delete the ORIGINAL, then T4 ------------------------------------
        barrier.delete_original_video()

        # --- ASR may start only now, after T4 -------------------------------
        if self.transcript_service is not None:
            self.transcript_service.start(record["taskId"])

        # --- the frozen public terminal --------------------------------------
        # `ready` is only legal once the media projection the public status
        # renders is durable, which is exactly what T1..T4 established.
        self.store.transition(
            import_id,
            expected_sequence=self.store.get(import_id)["sequence"],
            state="ready",
        )

        with self._lock:
            self._failing_import_id = None
        return {
            "importId": import_id,
            "taskId": record["taskId"],
            "videoManifestSha256": expected,
            "visualReceiptSha256": visual_receipt_sha256,
            "audioOwnerReceiptSha256": str(owner["manifestSha256"]),
            "audioArtifactSha256": published["artifact"].sha256,
            "audioByteLength": published["artifact"].byte_length,
            "durationMs": prepared.duration_ms,
            "frameCount": len(prepared.frames),
            "stagedSha256": owner["manifestSha256"],
            "barrierPhase": barrier.barriers.get(import_id)["phase"],
        }

    def _publish_wav(self, task_id: str, prepared: Any) -> dict[str, Any]:
        """Publish the 16 kHz mono WAV into the task sandbox.

        The sandbox's own import copies it in 1 MiB slices and fsyncs before
        publishing, so the frozen bound holds for this copy too and the WAV is
        never buffered whole.
        """
        self.sandbox.create(task_id)
        return {"artifact": self.sandbox.import_private_file(task_id, "audio", prepared.wav_path)}

    # -- consumer callbacks --------------------------------------------------

    def prepared_media(self, import_id: str) -> dict[str, Any] | None:
        """The durable prepared-media facts behind the frozen public `media`."""
        if self.barriers.find(import_id) is None:
            return None
        return self.barriers.prepared_media_of(import_id)

    def imported_visual_receipt(self, task_id: str) -> dict[str, Any] | None:
        """The ONLY visual evidence for the local route.

        The frames were already rendered from the user's own bytes, so the local
        route never downloads, never re-extracts and never OCRs a remote asset.
        """
        import_id = self.import_id_for_task(task_id)
        if import_id is None:
            return None
        record = self.store.get(import_id)
        digest = self.barriers.get(import_id)["visualReceiptSha256"]
        if not digest or not record["videoManifestSha256"]:
            return None
        receipt = self._read_receipt(import_id)
        if receipt is None:
            return None
        # The receipt must be the SAME media and the SAME bytes T1 made durable.
        if receipt.get("mediaSha256") != record["videoManifestSha256"]:
            raise C.ImportError("REQUEST_INVALID", "The visual receipt belongs to other media.")
        receipt = dict(receipt)
        receipt["visualReceiptSha256"] = digest
        return receipt

    def _read_receipt(self, import_id: str) -> dict[str, Any] | None:
        path = self._receipt_path(import_id)
        if path is None or not path.is_file():
            return None
        # The receipt file must still hash to the digest T2 made durable. A
        # MISMATCH is an integrity failure and is raised, never reported as an
        # absent receipt: an absent receipt would silently move the local
        # route onto the downloader path, which the local route may not use.
        if _digest(path) != self.barriers.get(import_id)["visualReceiptSha256"]:
            raise C.ImportError(
                "REQUEST_INVALID", "The imported receipt no longer matches its durable digest."
            )
        return json.loads(path.read_text(encoding="utf-8"))

    def _receipt_path(self, import_id: str) -> Path | None:
        record = self.store.get(import_id)
        preparer = self.preparer_factory(record["taskId"], record["sourceIdentity"], self.shared_input(import_id))
        # The receipt lives at a deterministic path inside the task's own
        # visual root; no client path is ever accepted or stored.
        return Path(preparer.visual_root) / "visual-receipt.json"

    def visual_terminal(self, task_id: str) -> None:
        """Called by the REAL product materializer once its product is terminal."""
        import_id = self.import_id_for_task(task_id)
        if import_id is None:
            return
        self.barrier_for(import_id).mark_visual_terminal()

    def transcript_terminal(self, task_id: str) -> None:
        """Called by the REAL transcript service once ASR reached a terminal state."""
        import_id = self.import_id_for_task(task_id)
        if import_id is None:
            return
        self.barrier_for(import_id).mark_transcript_terminal()

    def settle_failure(self, code: str) -> dict[str, Any]:
        """Persist a frozen terminal failure and release everything this import owns.

        The failure is stored on the record, the active session and writer are
        closed, the staging is purged and the task's import slot is released, so
        the UI's polling converges on a terminal state instead of spinning.
        """
        import_id = self._failing_import_id
        if import_id is None:
            for record in self.store.list_incomplete():
                self._failing_import_id = record["importId"]
                import_id = record["importId"]
                break
        if import_id is None:
            raise C.ImportError("NOT_FOUND", "There is no import to settle.")
        with self._lock:
            self._failing_import_id = None
        record = self.store.get(import_id)
        if record["state"] in {"ready", "cancelled", "failed"}:
            return record
        self.manager.abort(import_id, code)
        return self.store.get(import_id)

    # -- startup recovery ----------------------------------------------------

    def reconcile(self) -> list[dict[str, Any]]:
        """Reconcile every non-terminal import against its durable barrier.

        Never restores a token, never restores a worker, and never deletes a
        source, a WAV or a frame before its durable handoff proves it is ours.
        """
        results: list[dict[str, Any]] = []
        # The barrier's own open set is the truth here: an import may already be
        # `ready` publicly while a consumer still owns its shared input.
        for barrier in self.barriers.list_open():
            import_id = barrier["importId"]
            # AC1: close the window in which the imported product is already
            # durable but the barrier's visual-terminal receipt is not. Without
            # this, the cleanup would wait for a receipt nobody will submit.
            reconciled = self._reconcile_visual_terminal(barrier)
            try:
                outcome = self.barrier_for(import_id).recover_after_restart()
            except C.ImportError as error:
                outcome = f"blocked:{error.code}"
            results.append({
                "importId": import_id,
                "outcome": outcome,
                "visualTerminalReconciled": reconciled,
            })
        return results

    def _reconcile_visual_terminal(self, barrier: dict[str, Any]) -> bool:
        """Submit a missing visual-terminal receipt from the durable facts.

        It is submitted only when the shared input has already been released
        (the barrier is at or past T4) and the receipt is genuinely missing.
        The submission itself is the durable barrier's own idempotent
        operation, so a duplicate is harmless.
        """
        if barrier["visualTerminal"]:
            return False
        if _phase_index(barrier["phase"]) < _phase_index("video_deleted"):
            return False
        reconciler = self.product_reconciler
        if reconciler is None:
            return False
        try:
            task_id = self.store.get(barrier["importId"])["taskId"]
        except Exception:  # noqa: BLE001
            return False
        try:
            return bool(reconciler(task_id))
        except Exception:  # noqa: BLE001 - a failed repair must be retried
            return False


def _wave_shape(path: Path) -> dict[str, int]:
    """Measure the rendered WAV's own header facts, never a container estimate."""
    with wave.open(str(path), "rb") as handle:
        rate = handle.getframerate()
        channels = handle.getnchannels()
        width = handle.getsampwidth()
        frames = handle.getnframes()
    return {
        "sampleRateHz": int(rate),
        "channels": int(channels),
        "sampleWidthBytes": int(width),
        "durationMs": int(round(frames * 1000 / rate)),
    }
