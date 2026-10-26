"""WP-B two-consumer durable barrier.

ASR and the visual product materializer are BOTH consumers of one shared input.
Neither may clean it up: this barrier is the single cleanup owner.

The frozen order is the whole point of the module:

  T1 `video_durable`    -> the uploaded video and its owner manifest are durable
  T2 `inputs_prepared`  -> the WAV, the 1..8 frames and the canonical visual
                           receipt are durable
  T3 `input_bound`      -> the coordinator validated task/source/generation and
                           the SAME digests recorded at T1/T2 under its own lock
  audio receipt         -> the ASR stager committed its owner receipt
  delete                -> ONLY now may the ORIGINAL video be removed
  T4 `video_deleted`    -> and only now may ASR start

Durability lives in its OWN `LocalMediaBarrierStore` table. The frozen
15-column `media_local_imports_v1` storeRecord carries no barrier field and
this module never adds one.

Both terminal orders are legal. The second durable terminal receipt claims the
cleanup exactly once through a compare-and-set, so a late duplicate — or a
fresh process after a restart — never releases the shared input twice.
"""

from __future__ import annotations

import threading
from pathlib import Path
from typing import Any, Callable

from . import contracts as C
from .observations import observations
from .store import LocalMediaBarrierStore, LocalMediaImportStore

#: The durable phases, exactly as the frozen internal schema declares them.
PHASE_ORDER: tuple[str, ...] = C.BARRIER_PHASES


def _phase_index(phase: str) -> int:
    return PHASE_ORDER.index(phase)


def _may_advance(current: str, following: str) -> bool:
    """The only legal phase transitions.

    The two consumer terminals may arrive in EITHER order, so the phase may
    swap between them; everything else moves strictly forward.
    """
    return following in C.BARRIER_TRANSITIONS.get(current, frozenset())


class LocalMediaConsumerBarrier:
    """The only owner of the shared input and of its cleanup.

    `coordinator` is the REAL `MediaAcquisitionCoordinator`. Only its real
    methods, with their real signatures, are called: `bind_local_import(...)`
    and `complete(task_id)`.
    """

    def __init__(
        self,
        *,
        store: LocalMediaImportStore,
        coordinator: Any,
        import_id: str,
        shared_input: Path,
        barrier_store: LocalMediaBarrierStore | None = None,
        delete_input: Callable[[Path], None] | None = None,
        release_owned_root: Callable[[], None] | None = None,
    ) -> None:
        self.store = store
        self.barriers = barrier_store or LocalMediaBarrierStore(store.database_path)
        self.coordinator = coordinator
        self.import_id = import_id
        self.shared_input = Path(shared_input)
        self._delete = delete_input or (lambda path: Path(path).unlink(missing_ok=True))
        # T4 releases only the original video. The prepared WAV, frames and
        # receipt remain available to both consumers until their durable
        # terminal receipts land. Production injects a separate, idempotent
        # capability that releases the whole import-owned root at that point.
        self._release_owned_root = release_owned_root
        self._lock = threading.RLock()
        record = self.store.get(import_id)
        # Re-opening an existing barrier must never reset a durable receipt.
        self.barriers.create(import_id=import_id, task_id=record["taskId"])

    # -- state ---------------------------------------------------------------

    def video_exists(self) -> bool:
        return self.shared_input.is_file()

    def barrier(self) -> dict[str, Any]:
        return self.barriers.get(self.import_id)

    def _import_record(self) -> dict[str, Any]:
        return self.store.get(self.import_id)

    def _advance(self, expected_phase: str, phase: str, **fields: Any) -> dict[str, Any]:
        """Move the durable phase forward, or refuse a skip/regression."""
        with self._lock:
            current = self.barriers.get(self.import_id)
            if current["phase"] != expected_phase:
                raise C.ImportError(
                    "REQUEST_INVALID",
                    f"The durable handoff is at {current['phase']!r}, not {expected_phase!r}.",
                )
            if not _may_advance(current["phase"], phase):
                raise C.ImportError("REQUEST_INVALID", "The durable handoff may not move that way.")
            return self.barriers.advance(
                self.import_id,
                expected_sequence=self.barriers.sequence_of(self.import_id),
                phase=phase,
                **fields,
            )

    # -- T1..T4 --------------------------------------------------------------

    def mark_video_durable(self, *, video_manifest_sha256: str) -> dict[str, Any]:
        """T1 — assert the EXACT digest the upload already made durable.

        The owner manifest digest lives in the frozen storeRecord column, so T1
        compares against that durable value rather than trusting a value that
        only travelled in memory.
        """
        self._require_digest(video_manifest_sha256, "The video manifest digest is invalid.")
        with self._lock:
            record = self._import_record()
            if record["videoManifestSha256"] != video_manifest_sha256:
                raise C.ImportError(
                    "REQUEST_INVALID", "The video manifest does not match the durable owner manifest."
                )
            return self._advance(
            C.INITIAL_BARRIER_PHASE,
            "video_durable",
            video_manifest_sha256=video_manifest_sha256,
        )

    def mark_inputs_prepared(
        self,
        *,
        visual_receipt_sha256: str,
        prepared_media: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """T2 — the WAV, the 1..8 frames and the canonical visual receipt."""
        self._require_digest(visual_receipt_sha256, "The visual receipt digest is invalid.")
        if not self.barriers.video_manifest_of(self.import_id):
            # T1 proved the owner manifest. T2 may not run without it.
            raise C.ImportError(
                "REQUEST_INVALID", "The durable handoff did not verify the owner manifest."
            )
        return self._advance(
            "video_durable",
            "inputs_prepared",
            visual_receipt_sha256=visual_receipt_sha256,
            **({"prepared_media": prepared_media} if prepared_media is not None else {}),
        )

    def mark_input_bound(
        self,
        *,
        video_manifest_sha256: str,
        visual_receipt_sha256: str,
        audio_artifact: dict[str, Any] | None = None,
        duration_ms: int | None = None,
        sample_rate_hz: int | None = None,
        channels: int | None = None,
        sample_width_bytes: int | None = None,
    ) -> dict[str, Any]:
        """T3 — consume the SAME two digests that T1/T2 made durable, then bind.

        The digests are re-read from the durable owner manifest and compared, so
        a value that only travelled in memory can never reach the coordinator.
        """
        with self._lock:
            record = self._import_record()
            barrier = self.barriers.get(self.import_id)
            if barrier["phase"] != "inputs_prepared":
                raise C.ImportError("REQUEST_INVALID", "The durable handoff is not ready to bind.")
            owner_video_digest = record["videoManifestSha256"]
            if not owner_video_digest:
                raise C.ImportError("REQUEST_INVALID", "The durable owner manifest is missing.")
            if video_manifest_sha256 != owner_video_digest:
                raise C.ImportError("REQUEST_INVALID", "The video manifest does not match the owner manifest.")
            if barrier["visualReceiptSha256"] != visual_receipt_sha256:
                raise C.ImportError("REQUEST_INVALID", "The visual receipt does not match the durable record.")
            self.coordinator.bind_local_import(
                task_id=record["taskId"],
                source_identity=record["sourceIdentity"],
                route=C.ROUTE,
                import_id=record["importId"],
                dependency_generation=record["dependencyGeneration"],
                video_manifest_sha256=owner_video_digest,
                visual_receipt_sha256=barrier["visualReceiptSha256"],
                audio_artifact=audio_artifact,
                duration_ms=duration_ms,
                sample_rate_hz=sample_rate_hz,
                channels=channels,
                sample_width_bytes=sample_width_bytes,
            )
            return self.barriers.advance(
                self.import_id,
                expected_sequence=self.barriers.sequence_of(self.import_id),
                phase="input_bound",
            )

    def mark_audio_staged(self, *, audio_owner_receipt_sha256: str) -> dict[str, Any]:
        """The ASR stager's owner receipt is durable BEFORE any delete."""
        self._require_digest(audio_owner_receipt_sha256, "The audio owner receipt digest is invalid.")
        return self._advance(
            "input_bound",
            "audio_staged",
            audio_owner_receipt_sha256=audio_owner_receipt_sha256,
        )

    def delete_original_video(self) -> dict[str, Any]:
        """Delete the original ONLY after T3 AND the audio owner receipt."""
        with self._lock:
            barrier = self.barriers.get(self.import_id)
            if barrier["phase"] != "audio_staged":
                raise C.ImportError(
                    "REQUEST_INVALID",
                    "The original video may not be deleted before the audio owner receipt.",
                )
            if not barrier["audioOwnerReceiptSha256"] or not barrier["visualReceiptSha256"]:
                raise C.ImportError("REQUEST_INVALID", "Both receipts must be durable first.")
            try:
                self._delete(self.shared_input)
            except OSError:
                raise C.ImportError("WRITE_FAILED", "The original video could not be released.") from None
            return self.barriers.advance(
                self.import_id,
                expected_sequence=self.barriers.sequence_of(self.import_id),
                phase="video_deleted",
            )

    # -- terminal receipts ---------------------------------------------------

    def mark_transcript_terminal(self) -> bool:
        """Persist the receipt. Returns True when this caller owns cleanup."""
        return self._terminal("transcript")

    def mark_visual_terminal(self) -> bool:
        """Persist the receipt. Returns True when this caller owns cleanup."""
        return self._terminal("visual")

    def _terminal(self, which: str) -> bool:
        with self._lock:
            barrier = self.barriers.get(self.import_id)
            flag = "transcriptTerminal" if which == "transcript" else "visualTerminal"
            if barrier[flag]:
                # A duplicate receipt never re-claims an already-held cleanup.
                return False
            if _phase_index(barrier["phase"]) < _phase_index("video_deleted"):
                # A terminal receipt before the shared input is released is a
                # programming error, never a silent success.
                raise C.ImportError(
                    "REQUEST_INVALID",
                    "A terminal receipt arrived before the shared input was released.",
                )
            if not _may_advance(barrier["phase"], f"{which}_terminal"):
                raise C.ImportError(
                    "REQUEST_INVALID",
                    "The durable handoff may not move that way.",
                )
            barrier = self.barriers.advance(
                self.import_id,
                expected_sequence=self.barriers.sequence_of(self.import_id),
                phase=f"{which}_terminal",
                **{flag.replace("Terminal", "_terminal"): True},
            )
            return self._run_cleanup_if_claimed()

    def _run_cleanup_if_claimed(self) -> bool:
        """The second durable terminal claimant owns exactly-once cleanup."""
        claim = self.barriers.claim_cleanup(self.import_id)
        if claim is None:
            return False
        record = self._import_record()
        # The E2E-only channel observes how many times the cleanup was claimed.
        observations.record_cleanup_claim(self.import_id)
        try:
            # The REAL coordinator API: `complete(task_id)` runs the registered
            # hooks and requires a zero-residual task sandbox. There is no
            # `release_selected_input`, so none is called.
            self.coordinator.complete(record["taskId"])
        except Exception:  # noqa: BLE001
            raise C.ImportError("CLEANUP_INCOMPLETE", "The shared input could not be released.") from None
        try:
            if self._release_owned_root is None:
                self._delete(self.shared_input)
            else:
                self._release_owned_root()
        except OSError:
            raise C.ImportError("CLEANUP_INCOMPLETE", "The shared input could not be released.") from None
        self.barriers.advance(
            self.import_id,
            expected_sequence=self.barriers.sequence_of(self.import_id),
            phase="cleaned",
        )
        return True

    # -- recovery ------------------------------------------------------------

    def recover_after_restart(self) -> str:
        """Idempotent recovery for a FRESH process.

        A fresh process sees the durable phase the predecessor committed. It
        never restores a token, never repeats a completed cleanup, and never
        deletes anything whose durable receipts do not prove it is ours.
        """
        with self._lock:
            barrier = self.barriers.get(self.import_id)
            if barrier["phase"] == "cleaned":
                return "already_cleaned"
            if _phase_index(barrier["phase"]) < _phase_index("video_deleted"):
                return f"waiting:{barrier['phase']}"
            if not (barrier["transcriptTerminal"] and barrier["visualTerminal"]):
                # A consumer is still reading the shared input; it is not ours
                # to release yet.
                return f"waiting:consumers:{barrier['phase']}"
            if not (barrier["audioOwnerReceiptSha256"] and barrier["visualReceiptSha256"]):
                # A receipt is missing or unverified: keep the object for a human
                # rather than deleting something that cannot be proven.
                raise C.ImportError(
                    "CLEANUP_INCOMPLETE", "The shared input could not be verified for release."
                )
            # An absent original video is NOT proof that the WAV, the frames,
            # the selected input and the SourceAuthority were released. The
            # REAL coordinator cleanup still runs, and it is the only thing that
            # can release the task sandbox.
            if self._run_cleanup_if_claimed():
                return "released"
            if not self.video_exists():
                return "already_released"
            raise C.ImportError(
                "CLEANUP_INCOMPLETE", "The shared input could not be verified for release."
            )

    @staticmethod
    def _require_digest(value: Any, message: str) -> None:
        if not isinstance(value, str) or not C.SHA256_RE.fullmatch(value):
            raise C.ImportError("REQUEST_INVALID", message)
