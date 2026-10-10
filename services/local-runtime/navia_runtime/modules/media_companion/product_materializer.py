from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

from ..adapters.media_vision import (
    GovernedMediaVisionAdapter,
    GovernedVisionError,
    SelectedVisionFrame,
    VisionConsentStore,
)
from .acquisition.contracts import MediaIdentity
from .acquisition.coordinator import MediaAcquisitionError
from .acquisition.task_artifacts import TaskArtifactSandbox
from .credential_transport import CredentialLeaseStore
from .outline import DeterministicExtractiveOutlineGenerator
from .task_store import MediaTaskStore, MediaTaskStoreError, TERMINAL_STATES
from .vision import FrameExtractor, LocalOcrAdapter, VisionMediaBinding
from .vision.provider_settings import VisionProviderAdapterRegistry, VisionProviderStore


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
        self._vision_consent = vision_consent
        self._vision_providers = vision_providers
        self._vision_adapters = vision_adapters

    def materialize(self, task_id: str) -> dict[str, Any]:
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

        evidence = self._compact_segments(task_id, segments)
        self._persist_private_evidence(evidence)
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
        return self._store.get(task_id)

    def materialize_visual(self, task_id: str, credential_lease_id: str) -> dict[str, Any]:
        """Publish a fresh transcript + local OCR + governed selected-frame product."""
        if any(value is None for value in (
            self._lease_store,
            self._visual_sandbox,
            self._visual_downloader,
            self._vision_consent,
            self._vision_providers,
            self._vision_adapters,
        )):
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
        credentials = self._lease_store.resolve_credentials(credential_lease_id, task_id)
        task = self._store.create(task_id, source_identity)
        if task["state"] in TERMINAL_STATES:
            return self._store.get(task_id)

        consent_granted = False
        sandbox_created = False
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

            self._visual_sandbox.create(task_id)
            sandbox_created = True
            extractor = FrameExtractor(self._visual_sandbox)
            task = self._store.transition(task_id, task["revision"], "analyzing_vision")
            self._vision_consent.grant()
            consent_granted = True
            governed = GovernedMediaVisionAdapter(
                self._visual_sandbox,
                self._vision_consent,
                self._vision_providers,
                self._vision_adapters,
            )
            evidence = self._compact_segments(task_id, segments)
            duration_ms = max(int(item["endMs"]) for item in segments)
            for global_timestamp_ms in self._distributed_frame_timestamps(duration_ms):
                start_seconds = max(0, global_timestamp_ms // 1000 - 2)
                end_seconds = min(max(1, (duration_ms + 999) // 1000), start_seconds + 8)
                if end_seconds <= start_seconds:
                    start_seconds = max(0, end_seconds - 1)
                media, clip_duration_ms = self._visual_downloader.acquire_video_section(
                    task_id,
                    identity,
                    credentials,
                    start_seconds=start_seconds,
                    end_seconds=end_seconds,
                )
                binding = VisionMediaBinding(task_id, source_identity, media, media.sha256, clip_duration_ms)
                local_timestamp_ms = min(
                    max(0, global_timestamp_ms - start_seconds * 1000),
                    max(0, clip_duration_ms - 1),
                )
                frame = extractor.extract(binding, local_timestamp_ms)
                frame_evidence_id = "mev_" + hashlib.sha256(
                    f"{task_id}:selected-frame:{global_timestamp_ms}:{frame.artifact.sha256}".encode()
                ).hexdigest()[:32]
                ocr = LocalOcrAdapter(self._visual_sandbox).observe(task_id, frame.artifact)
                vision = governed.dispatch(SelectedVisionFrame(
                    task_id,
                    frame_evidence_id,
                    frame.artifact,
                    True,
                    frame.width_px,
                    frame.height_px,
                ))
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
            self._vision_consent.revoke(task_id)
            consent_granted = False
            task = self._store.transition(task_id, task["revision"], "synthesizing")
            self._persist_private_evidence(evidence)
            bundle = self._generator.generate(
                task_id=task_id,
                source_identity=source_identity,
                revision=task["revision"] + 1,
                source_title=identity.media_id,
                evidence=evidence,
                state="ready",
            )
            self._store.commit_terminal(
                bundle,
                expected_revision=task["revision"],
                idempotency_key=f"materialize-visual-{task_id}",
            )
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
            if sandbox_created:
                self._visual_sandbox.cleanup(task_id)

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
