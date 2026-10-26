from __future__ import annotations

import hashlib
import json
import re
import shutil
from pathlib import Path
from threading import RLock
from typing import Any

from ..adapters.media_vision import (
    GovernedMediaVisionAdapter,
    GovernedVisionError,
    SelectedVisionFrame,
    VisionConsentStore,
)
from .acquisition.contracts import MediaIdentity
from .acquisition.coordinator import MediaAcquisitionError
from .acquisition.contracts import ArtifactRef
from .acquisition.task_artifacts import TASK_ID_RE, TaskArtifactSandbox
from .credential_transport import CredentialLeaseStore
from .outline import DeterministicExtractiveOutlineGenerator
from .task_store import MediaTaskStore, MediaTaskStoreError, TERMINAL_STATES
from .vision import ExtractedFrame, FrameExtractor, LocalOcrAdapter, VisionMediaBinding
from .vision.provider_settings import VisionProviderAdapterRegistry, VisionProviderStore


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _png_dimensions(path: Path) -> tuple[int, int]:
    """Read the dimensions from the PNG header itself, never from a claim."""
    with path.open("rb") as handle:
        header = handle.read(24)
    if len(header) < 24 or header[:8] != b"\x89PNG\r\n\x1a\n" or header[12:16] != b"IHDR":
        raise MediaTaskStoreError("VISUAL_EVIDENCE_UNAVAILABLE", "An imported frame is not a readable PNG.", status=409)
    width = int.from_bytes(header[16:20], "big")
    height = int.from_bytes(header[20:24], "big")
    if width <= 0 or height <= 0:
        raise MediaTaskStoreError("VISUAL_EVIDENCE_UNAVAILABLE", "An imported frame has no dimensions.", status=409)
    return width, height


class MediaProductMaterializer:
    """Publish a transcript-backed product outline without accepting client evidence."""

    def __init__(
        self,
        store: MediaTaskStore,
        transcript_projection: Any,
        private_root: str | Path,
        *,
        lease_store: CredentialLeaseStore | None = None,
        visual_sandbox: TaskArtifactSandbox | None = None,
        visual_downloader: Any = None,
        visual_downloader_resolver: Callable[[Any], Any] | None = None,
        snapshot_resolver: Callable[[str], Any] | None = None,
        imported_visual_receipt: Callable[[str], dict[str, Any] | None] | None = None,
        visual_terminal: Callable[[str], None] | None = None,
        vision_consent: VisionConsentStore | None = None,
        vision_providers: VisionProviderStore | None = None,
        vision_adapters: VisionProviderAdapterRegistry | None = None,
    ) -> None:
        self._store = store
        self._transcript_projection = transcript_projection
        self._private_root = Path(private_root)
        self._generator = DeterministicExtractiveOutlineGenerator()
        self._lease_store = lease_store
        self._visual_sandbox = visual_sandbox
        self._visual_downloader = visual_downloader
        # WP-A: the visual path resolves its downloader from the SAME per-task
        # dependency snapshot as acquisition and transcript. There is no second
        # global dependency owner.
        self._visual_downloader_resolver = visual_downloader_resolver
        self._snapshot_resolver = snapshot_resolver
        # WP-B: the local route's visual evidence comes from the imported
        # receipt; the barrier owns cleanup once the product is terminal.
        self._imported_visual_receipt_resolver = imported_visual_receipt
        self._visual_terminal = visual_terminal
        # WP-B: the owned root the local preparer rendered its frames into. It
        # is Runtime-owned and supplied by the orchestrator; nothing here ever
        # accepts a client path.
        self._imported_frame_root: Any = None
        self._vision_consent = vision_consent
        self._vision_providers = vision_providers
        self._vision_adapters = vision_adapters
        self._lock = RLock()
        self._task_locks: dict[str, RLock] = {}

    def materialize(self, task_id: str) -> dict[str, Any]:
        with self._task_lock(task_id):
            return self._materialize(task_id)

    def _task_lock(self, task_id: str) -> RLock:
        with self._lock:
            return self._task_locks.setdefault(task_id, RLock())

    def cancel(self, task_id: str) -> str:
        state = self._store.begin_cancel_source_task(task_id)
        if state != "cancelling":
            return state
        with self._task_lock(task_id):
            authority = self._store.source_authority_by_task(task_id)
            if authority is not None and authority["state"] == "cancelled":
                return "cancelled"
            try:
                if self._visual_sandbox is not None:
                    self._visual_sandbox.cleanup(task_id)
                self._discard_or_block(task_id)
            except Exception as error:
                self._store.mark_source_authority(task_id, "cleanup_incomplete")
                raise MediaTaskStoreError(
                    "V3_MEDIA_CLEANUP_INCOMPLETE", "Cancelled media evidence could not be cleaned.", status=500
                ) from error
            return self._store.finish_cancel_source_task(task_id)

    def cleanup_abandoned(self, task_id: str) -> None:
        with self._task_lock(task_id):
            if self._visual_sandbox is not None:
                self._visual_sandbox.cleanup(task_id)
            self._discard_or_block(task_id)

    def _imported_visual_receipt(self, task_id: str) -> dict[str, Any] | None:
        resolver = self._imported_visual_receipt_resolver
        return resolver(task_id) if resolver is not None else None

    def _resolve_visual_downloader(self, task_id: str) -> Any:
        """Resolve the visual downloader for ONE task from its own snapshot."""
        snapshot = self._snapshot_resolver(task_id) if self._snapshot_resolver is not None else None
        if self._visual_downloader_resolver is not None:
            return self._visual_downloader_resolver(snapshot)
        return self._visual_downloader

    def _require_active(self, task_id: str) -> None:
        authority = self._store.source_authority_by_task(task_id)
        if authority is None:
            try:
                product = self._store.get(task_id)
            except MediaTaskStoreError as error:
                if error.code == "TASK_NOT_FOUND":
                    return
                raise
            if self._store.source_authority(product["sourceIdentity"]) is not None:
                raise MediaTaskStoreError("TASK_CANCELLED", "Source authority moved to another task.", status=409)
        elif authority["state"] != "active":
            raise MediaTaskStoreError("TASK_CANCELLED", "Source task is no longer active.", status=409)

    def _discard_unpublished_evidence(self, task_id: str) -> None:
        if not TASK_ID_RE.fullmatch(task_id):
            raise MediaTaskStoreError("TASK_IDENTITY_MISMATCH", "Task ID is invalid.", status=409)
        directory = self._private_root / "evidence" / task_id
        if directory.is_symlink():
            raise MediaTaskStoreError("V3_MEDIA_CLEANUP_INCOMPLETE", "Evidence directory is not owned.", status=500)
        if directory.exists():
            shutil.rmtree(directory)
        if directory.exists() or directory.is_symlink():
            raise MediaTaskStoreError("V3_MEDIA_CLEANUP_INCOMPLETE", "Evidence directory remains after cleanup.", status=500)

    def _discard_or_block(self, task_id: str) -> None:
        try:
            self._discard_unpublished_evidence(task_id)
        except Exception as error:
            self._store.mark_source_authority(task_id, "cleanup_incomplete")
            raise MediaTaskStoreError(
                "V3_MEDIA_CLEANUP_INCOMPLETE", "Unpublished media evidence could not be cleaned.", status=500
            ) from error

    def _materialize(self, task_id: str) -> dict[str, Any]:
        projection = self._transcript_projection.get(task_id)
        if projection.get("taskId") != task_id:
            raise MediaTaskStoreError("TASK_IDENTITY_MISMATCH", "Transcript projection belongs to another task.", status=409)
        if projection.get("state") != "succeeded" or not projection.get("terminal"):
            raise MediaTaskStoreError("TASK_INPUT_NOT_READY", "Transcript input is not ready for product materialization.", status=409)
        source_identity = projection.get("sourceIdentity")
        segments = projection.get("segments")
        if not isinstance(source_identity, str) or not isinstance(segments, list) or not segments:
            raise MediaTaskStoreError("OUTLINE_EVIDENCE_REQUIRED", "A completed transcript with segments is required.", status=409)

        task = self._store.create(task_id, source_identity)
        if task["state"] in TERMINAL_STATES:
            return self._store.get(task_id)
        for expected, next_state in (
            ("created", "acquiring"),
            ("acquiring", "transcribing"),
            ("transcribing", "extracting_frames"),
            ("extracting_frames", "synthesizing"),
            ("analyzing_vision", "synthesizing"),
        ):
            if task["state"] == expected:
                task = self._store.transition(task_id, task["revision"], next_state)
        if task["state"] != "synthesizing":
            raise MediaTaskStoreError("TASK_TRANSITION_INVALID", "Product task cannot be materialized from its current state.", status=409)

        published = False
        try:
            self._require_active(task_id)
            evidence = self._compact_segments(task_id, segments)
            self._persist_private_evidence(evidence)
            self._require_active(task_id)
            source_title = source_identity.split(":")[2] if len(source_identity.split(":")) >= 3 else "媒体任务"
            bundle = self._generator.generate(
                task_id=task_id,
                source_identity=source_identity,
                revision=task["revision"] + 1,
                source_title=source_title,
                evidence=evidence,
                state="degraded",
                terminal_failure_code="VISUAL_EVIDENCE_UNAVAILABLE",
            )
            self._store.commit_terminal(
                bundle,
                expected_revision=task["revision"],
                idempotency_key=f"materialize-{task_id}",
            )
            published = True
            self._store.mark_source_authority(task_id, "published")
            return self._store.get(task_id)
        except Exception:
            if not published:
                self._discard_or_block(task_id)
            raise

    def materialize_visual(self, task_id: str, credential_lease_id: str | None = None) -> dict[str, Any]:
        with self._task_lock(task_id):
            try:
                existing = self._store.get(task_id)
                if existing["state"] in TERMINAL_STATES:
                    # AC1: the product is already durable, but a previous run may
                    # have died between the product commit and the barrier's
                    # visual-terminal receipt. Reconcile that receipt here
                    # instead of returning early: the durable barrier is
                    # idempotent, so a duplicate submission is harmless and a
                    # missing one is what blocks the cleanup forever.
                    self._submit_visual_terminal(task_id)
                    return self._store.get(task_id)
            except MediaTaskStoreError as error:
                if error.code != "TASK_NOT_FOUND":
                    raise
            return self._materialize_visual(task_id, credential_lease_id)

    def _materialize_visual(self, task_id: str, credential_lease_id: str | None = None) -> dict[str, Any]:
        """Publish a fresh transcript + local OCR + governed selected-frame product."""
        # WP-B: the imported receipt is resolved FIRST and decides the route.
        # When it is present the local product uses the frames that were already
        # rendered from the user's own bytes, so the downloader, the credential
        # lease and the capture path are not even resolved — let alone called.
        imported = self._imported_visual_receipt(task_id)
        if imported is not None:
            required = (self._visual_sandbox, self._vision_consent, self._vision_providers, self._vision_adapters)
        elif any(value is None for value in (
            self._lease_store,
            self._visual_sandbox,
            self._resolve_visual_downloader(task_id),
            self._vision_consent,
            self._vision_providers,
            self._vision_adapters,
        )):
            required = ()
        else:
            required = ()
        if imported is None and any(value is None for value in (
            self._lease_store,
            self._visual_sandbox,
            self._resolve_visual_downloader(task_id),
            self._vision_consent,
            self._vision_providers,
            self._vision_adapters,
        )):
            raise MediaTaskStoreError("VISUAL_PIPELINE_UNAVAILABLE", "Visual product dependencies are unavailable.", status=503)
        if any(value is None for value in required):
            raise MediaTaskStoreError("VISUAL_PIPELINE_UNAVAILABLE", "Visual product dependencies are unavailable.", status=503)
        projection = self._transcript_projection.get(task_id)
        if projection.get("taskId") != task_id:
            raise MediaTaskStoreError("TASK_IDENTITY_MISMATCH", "Transcript projection belongs to another task.", status=409)
        if projection.get("state") != "succeeded" or not projection.get("terminal"):
            raise MediaTaskStoreError("TASK_INPUT_NOT_READY", "Transcript input is not ready for visual materialization.", status=409)
        source_identity = projection.get("sourceIdentity")
        segments = projection.get("segments")
        identity = self._media_identity(source_identity)
        if not isinstance(segments, list) or not segments:
            raise MediaTaskStoreError("OUTLINE_EVIDENCE_REQUIRED", "A completed transcript is required.", status=409)
        # The local route NEVER resolves a credential: there is no lease to
        # resolve, and resolving one would put a portal credential in scope for a
        # file the user handed over directly.
        credentials: dict[str, Any] = (
            {} if imported is not None
            else self._lease_store.resolve_credentials(credential_lease_id, task_id)
        )
        task = self._store.create(task_id, source_identity)
        if task["state"] in TERMINAL_STATES:
            return self._store.get(task_id)

        consent_granted = False
        sandbox_created = False
        published = False
        try:
            for expected, next_state in (
                ("created", "acquiring"),
                ("acquiring", "transcribing"),
                ("transcribing", "extracting_frames"),
            ):
                if task["state"] == expected:
                    task = self._store.transition(task_id, task["revision"], next_state)
            if task["state"] != "extracting_frames":
                raise MediaTaskStoreError("TASK_TRANSITION_INVALID", "Visual product task is not ready for frame extraction.", status=409)

            self._require_active(task_id)
            self._visual_sandbox.create(task_id)
            sandbox_created = True
            extractor = FrameExtractor(self._visual_sandbox)
            task = self._store.transition(task_id, task["revision"], "analyzing_vision")
            self._require_active(task_id)
            self._vision_consent.grant()
            consent_granted = True
            governed = GovernedMediaVisionAdapter(
                self._visual_sandbox,
                self._vision_consent,
                self._vision_providers,
                self._vision_adapters,
            )
            ocr_adapter = LocalOcrAdapter(self._visual_sandbox)
            evidence = self._compact_segments(task_id, segments)
            duration_ms = max(int(item["endMs"]) for item in segments)
            # WP-B: an explicit local import already produced its frames from
            # the user's own bytes. That receipt is the ONLY visual evidence for
            # the local route: the frames are imported into THIS task's visual
            # sandbox as real artifacts, and nothing is downloaded or extracted.
            receipt = imported
            imported_frames: list[ExtractedFrame] = []
            if receipt is not None:
                imported_frames = self._import_receipt_frames(task_id, receipt, source_identity)
                binding = None
                imported_timestamps = tuple(
                    int(item["timestampMs"]) for item in receipt["frames"]
                )
            elif hasattr(self._resolve_visual_downloader(task_id), "acquire_video"):
                self._require_active(task_id)
                media, downloaded_duration_ms = self._resolve_visual_downloader(task_id).acquire_video(
                    task_id, identity, credentials
                )
                binding = VisionMediaBinding(
                    task_id, source_identity, media, media.sha256, downloaded_duration_ms
                )
            else:
                binding = None
            for global_timestamp_ms in (
                imported_timestamps if imported is not None
                else self._distributed_frame_timestamps(duration_ms)
            ):
                self._require_active(task_id)
                if imported is not None:
                    # The frame IS the receipt entry. No ffmpeg, no media
                    # binding, no downloader section.
                    frame = imported_frames[imported_timestamps.index(global_timestamp_ms)]
                elif binding is None:
                    start_seconds = max(0, global_timestamp_ms // 1000 - 2)
                    end_seconds = min(max(1, (duration_ms + 999) // 1000), start_seconds + 8)
                    if end_seconds <= start_seconds:
                        start_seconds = max(0, end_seconds - 1)
                    media, clip_duration_ms = self._resolve_visual_downloader(task_id).acquire_video_section(
                        task_id,
                        identity,
                        credentials,
                        start_seconds=start_seconds,
                        end_seconds=end_seconds,
                    )
                    frame_binding = VisionMediaBinding(task_id, source_identity, media, media.sha256, clip_duration_ms)
                    local_timestamp_ms = min(
                        max(0, global_timestamp_ms - start_seconds * 1000),
                        max(0, clip_duration_ms - 1),
                    )
                else:
                    frame_binding = binding
                    local_timestamp_ms = min(global_timestamp_ms, binding.declared_duration_ms - 1)
                self._require_active(task_id)
                if imported is None:
                    frame = extractor.extract(frame_binding, local_timestamp_ms)
                frame_evidence_id = "mev_" + hashlib.sha256(
                    f"{task_id}:selected-frame:{global_timestamp_ms}:{frame.artifact.sha256}".encode()
                ).hexdigest()[:32]
                self._require_active(task_id)
                ocr = ocr_adapter.observe(task_id, frame.artifact)
                self._require_active(task_id)
                vision = governed.dispatch(SelectedVisionFrame(
                    task_id,
                    frame_evidence_id,
                    frame.artifact,
                    True,
                    frame.width_px,
                    frame.height_px,
                ))
                self._require_active(task_id)
                frame_evidence = self._typed_evidence(
                    task_id,
                    "frame",
                    global_timestamp_ms,
                    f"选中画面 {frame.width_px}x{frame.height_px}，内容哈希 {frame.artifact.sha256[:16]}",
                    len(evidence),
                )
                frame_evidence["thumbnailRelativeRef"] = self._persist_frame_thumbnail(
                    task_id, frame_evidence["evidenceId"], frame.artifact
                )
                evidence.append(frame_evidence)
                ocr_text = " ".join(block.text for block in ocr.blocks).strip() or "本地 OCR 未识别到可用文字"
                evidence.append(self._typed_evidence(task_id, "ocr_block", global_timestamp_ms, ocr_text, len(evidence)))
                evidence.append(self._typed_evidence(
                    task_id, "vision_caption", global_timestamp_ms, vision.caption, len(evidence)
                ))
            self._require_active(task_id)
            receipt = self._visual_sandbox.cleanup(task_id)
            if receipt["residualCount"] != 0:
                raise MediaTaskStoreError("V3_MEDIA_CLEANUP_INCOMPLETE", "Visual sandbox retained raw media.", status=500)
            sandbox_created = False
            self._vision_consent.revoke(task_id)
            consent_granted = False
            task = self._store.transition(task_id, task["revision"], "synthesizing")
            self._require_active(task_id)
            self._persist_private_evidence(evidence)
            source_title = projection.get("sourceTitle")
            if not isinstance(source_title, str) or not source_title.strip():
                source_title = identity.media_id
            bundle = self._generator.generate(
                task_id=task_id,
                source_identity=source_identity,
                revision=task["revision"] + 1,
                source_title=source_title.strip()[:240],
                evidence=evidence,
                state="ready",
            )
            self._store.commit_terminal(
                bundle,
                expected_revision=task["revision"],
                idempotency_key=f"materialize-visual-{task_id}",
            )
            published = True
            self._store.mark_source_authority(task_id, "published")
            # WP-B: the visual consumer's terminal receipt is submitted ONLY now,
            # after the VISUAL product commit AND the source-authority
            # publication are both durable. Before this point the barrier must
            # keep owning the shared input. It is exactly-once per task, so a
            # duplicate materialization or a retried callback cannot release
            # twice.
            self._submit_visual_terminal(task_id)
            return self._store.get(task_id)
        except Exception as error:
            if isinstance(error, (MediaTaskStoreError, MediaAcquisitionError)):
                raise
            code = str(getattr(error, "code", "VISUAL_EVIDENCE_UNAVAILABLE"))
            raise MediaTaskStoreError(code, "Visual evidence materialization failed.", status=502) from error
        finally:
            credentials.clear()
            if consent_granted:
                try:
                    self._vision_consent.revoke(task_id)
                except GovernedVisionError:
                    pass
            try:
                if sandbox_created:
                    receipt = self._visual_sandbox.cleanup(task_id)
                    if receipt["residualCount"] != 0:
                        raise MediaTaskStoreError("V3_MEDIA_CLEANUP_INCOMPLETE", "Visual sandbox retained raw media.", status=500)
                if not published:
                    self._discard_or_block(task_id)
            except Exception as error:
                self._store.mark_source_authority(task_id, "cleanup_incomplete")
                raise MediaTaskStoreError(
                    "V3_MEDIA_CLEANUP_INCOMPLETE", "Visual materialization cleanup failed.", status=500
                ) from error

    @staticmethod
    def _distributed_frame_timestamps(duration_ms: int, *, limit: int = 8) -> tuple[int, ...]:
        if type(duration_ms) is not int or duration_ms <= 0 or type(limit) is not int or limit < 1 or limit > 8:
            raise MediaTaskStoreError("VISUAL_EVIDENCE_UNAVAILABLE", "Media duration is invalid for frame selection.", status=409)
        count = min(limit, max(1, (duration_ms + 59_999) // 60_000))
        if count == 1:
            return (min(duration_ms - 1, duration_ms // 2),)
        # Keep points away from unstable first/last frames while covering the
        # complete transcript duration deterministically.
        return tuple(round((index + 1) * (duration_ms - 1) / (count + 1)) for index in range(count))

    @staticmethod
    def _compact_segments(task_id: str, segments: list[dict[str, Any]]) -> list[dict[str, Any]]:
        result: list[dict[str, Any]] = []
        bucket: list[dict[str, Any]] = []
        for segment in segments:
            try:
                start_ms = int(segment["startMs"])
                end_ms = int(segment["endMs"])
                text = " ".join(str(segment["text"]).split()).strip()
            except (KeyError, TypeError, ValueError) as error:
                raise MediaTaskStoreError("OUTLINE_EVIDENCE_REQUIRED", "Transcript segment is invalid.", status=409) from error
            if start_ms < 0 or end_ms <= start_ms or not text:
                raise MediaTaskStoreError("OUTLINE_EVIDENCE_REQUIRED", "Transcript segment is invalid.", status=409)
            bucket.append({"startMs": start_ms, "endMs": end_ms, "text": text})
            elapsed = bucket[-1]["endMs"] - bucket[0]["startMs"]
            if len(bucket) >= 12 or elapsed >= 45_000:
                result.append(MediaProductMaterializer._evidence(task_id, bucket, len(result)))
                bucket = []
        if bucket:
            result.append(MediaProductMaterializer._evidence(task_id, bucket, len(result)))
        if not result:
            raise MediaTaskStoreError("OUTLINE_EVIDENCE_REQUIRED", "Transcript evidence is empty.", status=409)
        return result

    @staticmethod
    def _evidence(task_id: str, bucket: list[dict[str, Any]], sequence: int) -> dict[str, Any]:
        text = " ".join(item["text"] for item in bucket)
        digest = hashlib.sha256(text.encode("utf-8")).hexdigest()
        identity = hashlib.sha256(
            f"{task_id}:transcript:{sequence}:{bucket[0]['startMs']}:{bucket[-1]['endMs']}:{digest}".encode()
        ).hexdigest()[:32]
        return {
            "evidenceId": f"mtr_{identity}",
            "taskId": task_id,
            "kind": "transcript",
            "timestampStartMs": bucket[0]["startMs"],
            "timestampEndMs": bucket[-1]["endMs"],
            "contentSha256": digest,
            "relativeArtifactRef": f"evidence/{task_id}/{sequence:04d}.json",
            "text": text,
        }

    @staticmethod
    def _typed_evidence(task_id: str, kind: str, timestamp_ms: int, text: str, sequence: int) -> dict[str, Any]:
        normalized = " ".join(text.split()).strip()
        digest = hashlib.sha256(normalized.encode("utf-8")).hexdigest()
        identity = hashlib.sha256(f"{task_id}:{kind}:{sequence}:{timestamp_ms}:{digest}".encode()).hexdigest()[:32]
        return {
            "evidenceId": f"mev_{identity}",
            "taskId": task_id,
            "kind": kind,
            "timestampStartMs": timestamp_ms,
            "timestampEndMs": timestamp_ms + 1,
            "contentSha256": digest,
            "relativeArtifactRef": f"evidence/{task_id}/{sequence:04d}.json",
            "text": normalized,
        }

    @staticmethod
    def _media_identity(source_identity: Any) -> MediaIdentity:
        parts = source_identity.split(":") if isinstance(source_identity, str) else []
        if len(parts) != 5 or parts[0] != "portal" or parts[1] != "bilibili":
            raise MediaTaskStoreError("TASK_IDENTITY_MISMATCH", "Visual materialization requires a Bilibili source identity.", status=409)
        part_value = parts[4][1:] if parts[4].startswith("p") else parts[4]
        try:
            part_index = int(part_value)
        except ValueError as error:
            raise MediaTaskStoreError("TASK_IDENTITY_MISMATCH", "Bilibili part identity is invalid.", status=409) from error
        if part_index < 1:
            raise MediaTaskStoreError("TASK_IDENTITY_MISMATCH", "Bilibili part identity is invalid.", status=409)
        return MediaIdentity("bilibili", parts[2], parts[3], parts[4], part_index, part_index, 1.0)

    def _persist_private_evidence(self, evidence: list[dict[str, Any]]) -> None:
        for item in evidence:
            destination = self._private_root / item["relativeArtifactRef"]
            destination.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
            destination.write_text(
                json.dumps(
                    {
                        "text": item["text"],
                        "contentSha256": item["contentSha256"],
                        **(
                            {"thumbnailRelativeRef": item["thumbnailRelativeRef"]}
                            if item.get("thumbnailRelativeRef") else {}
                        ),
                    },
                    ensure_ascii=False,
                    sort_keys=True,
                    separators=(",", ":"),
                )
                + "\n",
                encoding="utf-8",
            )
            try:
                destination.chmod(0o600)
            except OSError:
                pass


    # -- WP-B: the imported receipt is the ONLY visual evidence for the local route.

    def _import_receipt_frames(
        self, task_id: str, receipt: dict[str, Any], source_identity: str
    ) -> list[ExtractedFrame]:
        """Turn each receipt frame into a REAL artifact in THIS task's sandbox.

        A receipt is a claim; an artifact is a fact. Every frame is revalidated
        against the task, the source, the media digest and its own byte digest
        BEFORE it is copied in, and it is copied through the sandbox so the
        published `ArtifactRef` is the production type every downstream consumer
        already expects.
        """
        if self._visual_sandbox is None:
            raise MediaTaskStoreError("VISUAL_PIPELINE_UNAVAILABLE", "Visual sandbox is unavailable.", status=503)
        if receipt.get("taskId") != task_id or receipt.get("sourceIdentity") != source_identity:
            raise MediaTaskStoreError("TASK_IDENTITY_MISMATCH", "The imported receipt belongs to another task.", status=409)
        media_sha256 = receipt.get("mediaSha256")
        if not isinstance(media_sha256, str) or not re.fullmatch(r"[a-f0-9]{64}", media_sha256):
            raise MediaTaskStoreError("VISUAL_EVIDENCE_UNAVAILABLE", "The imported receipt has no media digest.", status=409)
        duration_ms = receipt.get("durationMs")
        if not isinstance(duration_ms, int) or duration_ms <= 0:
            raise MediaTaskStoreError("VISUAL_EVIDENCE_UNAVAILABLE", "The imported receipt has no duration.", status=409)
        frames = receipt.get("frames")
        if not isinstance(frames, list) or not frames:
            raise MediaTaskStoreError("VISUAL_EVIDENCE_UNAVAILABLE", "The imported receipt carries no frame.", status=409)
        if len(frames) > 8:
            raise MediaTaskStoreError("VISUAL_EVIDENCE_UNAVAILABLE", "The imported receipt exceeds the frozen frame window.", status=409)

        resolver = self._imported_frame_root
        root = resolver(task_id) if callable(resolver) else resolver
        if root is None:
            raise MediaTaskStoreError("VISUAL_EVIDENCE_UNAVAILABLE", "The imported frames are unavailable.", status=409)
        root = Path(root)

        imported: list[ExtractedFrame] = []
        previous_timestamp = -1
        for entry in frames:
            if not isinstance(entry, dict):
                raise MediaTaskStoreError("VISUAL_EVIDENCE_UNAVAILABLE", "An imported frame entry is invalid.", status=409)
            timestamp_ms = entry.get("timestampMs")
            if not isinstance(timestamp_ms, int) or timestamp_ms < 0 or timestamp_ms >= duration_ms or timestamp_ms <= previous_timestamp:
                raise MediaTaskStoreError("VISUAL_EVIDENCE_UNAVAILABLE", "Imported frame timestamps are not monotonic.", status=409)
            previous_timestamp = timestamp_ms
            descriptor = entry.get("artifact")
            if not isinstance(descriptor, dict):
                raise MediaTaskStoreError("VISUAL_EVIDENCE_UNAVAILABLE", "An imported frame has no artifact.", status=409)
            artifact_id = descriptor.get("artifactId")
            # The relative reference is rebuilt from the receipt id alone; a
            # client-supplied path could otherwise escape the owned root. The
            # id is the FROZEN artifact id, and it is also the file name.
            if not isinstance(artifact_id, str) or not re.fullmatch(r"artifact_[a-f0-9]{32}", artifact_id):
                raise MediaTaskStoreError("VISUAL_EVIDENCE_UNAVAILABLE", "An imported frame id is outside the frozen set.", status=409)
            expected_sha256 = descriptor.get("sha256")
            expected_length = descriptor.get("byteLength")
            if (
                not isinstance(expected_sha256, str)
                or not re.fullmatch(r"[a-f0-9]{64}", expected_sha256)
                or not isinstance(expected_length, int)
                or expected_length <= 0
            ):
                raise MediaTaskStoreError("VISUAL_EVIDENCE_UNAVAILABLE", "An imported frame descriptor is invalid.", status=409)
            source = root / f"{artifact_id}.png"
            if not source.is_file() or source.is_symlink():
                raise MediaTaskStoreError("VISUAL_EVIDENCE_UNAVAILABLE", "An imported frame file is missing.", status=409)
            if source.stat().st_size != expected_length:
                raise MediaTaskStoreError("VISUAL_EVIDENCE_UNAVAILABLE", "An imported frame changed size.", status=409)
            if _sha256_file(source) != expected_sha256:
                raise MediaTaskStoreError("VISUAL_EVIDENCE_UNAVAILABLE", "An imported frame changed its bytes.", status=409)
            artifact = self._visual_sandbox.import_private_file(task_id, "frame", source)
            if artifact.sha256 != expected_sha256 or artifact.byte_length != expected_length:
                raise MediaTaskStoreError("VISUAL_EVIDENCE_UNAVAILABLE", "An imported frame changed while being published.", status=409)
            width_px, height_px = _png_dimensions(self._visual_sandbox.private_path(task_id, artifact))
            imported.append(ExtractedFrame(task_id, timestamp_ms, artifact, width_px, height_px))
        return imported


    def _submit_visual_terminal(self, task_id: str) -> bool:
        """Submit the visual consumer's terminal receipt to the barrier.

        There is NO process-memory claim. The durable barrier is the only
        owner of the receipt and it is idempotent, so a duplicate submission
        costs nothing while a lost one is what blocks the cleanup forever. The
        submission is never marked as done before the hook actually succeeded.
        """
        hook = self._visual_terminal
        if hook is None:
            return False
        with self._task_lock(task_id):
            hook(task_id)
        return True

    def reconcile_visual_terminal(self, task_id: str) -> bool:
        """Submit the missing visual-terminal receipt for a durable product.

        This is the startup repair: the product commit and the source-authority
        publication are durable, so the only thing that can be missing is the
        barrier's receipt. It is submitted from the DURABLE facts, never from
        process memory, and it is idempotent.
        """
        try:
            task = self._store.get(task_id)
        except MediaTaskStoreError:
            return False
        if task.get("state") not in TERMINAL_STATES:
            return False
        try:
            return self._submit_visual_terminal(task_id)
        except Exception:  # noqa: BLE001 - a failed submission must be retried
            return False

    def _persist_frame_thumbnail(self, task_id: str, evidence_id: str, artifact: Any) -> str:
        if self._visual_sandbox is None:
            raise MediaTaskStoreError("VISUAL_PIPELINE_UNAVAILABLE", "Visual sandbox is unavailable.", status=503)
        source = self._visual_sandbox.private_path(task_id, artifact)
        payload = source.read_bytes()
        if hashlib.sha256(payload).hexdigest() != artifact.sha256:
            raise MediaTaskStoreError("VISUAL_EVIDENCE_UNAVAILABLE", "Selected frame changed before retention.", status=409)
        relative = f"evidence/{task_id}/frames/{evidence_id}.png"
        destination = self._private_root / relative
        destination.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        destination.write_bytes(payload)
        try:
            destination.chmod(0o600)
        except OSError:
            pass
        return relative
