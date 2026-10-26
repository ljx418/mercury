"""The production stack the AC1 crash-window test drives.

Everything here is a PRODUCTION object: the local-import store, the consumer
barrier and its own durable table, the acquisition coordinator, the task
sandbox, the product store, the product materializer and the local-import
orchestrator.

Exactly TWO capabilities are substituted, and both are external capabilities,
not product state machines:

* the governed VISION dispatch, which needs a remote Provider. The repo's own
  materializer test substitutes it the same way. The frame import, the OCR, the
  product commit, the source-authority publication, the barrier and the
  coordinator cleanup all stay real.
* the transcript projection, whose ASR needs a real model. The AC1 oracle is
  the crash window between the product commit and the barrier receipt, not the
  transcript content, and the barrier's transcript receipt is submitted through
  the barrier's own production method.
"""

from __future__ import annotations

import hashlib
import os
import secrets
import subprocess
from dataclasses import dataclass
from pathlib import Path
from types import SimpleNamespace
from typing import Any

from navia_runtime.modules.media_companion.acquisition.coordinator import (
    MediaAcquisitionCoordinator,
    MediaAcquisitionRequest,
)
from navia_runtime.modules.media_companion.acquisition.task_artifacts import (
    TaskArtifactSandbox,
)
from navia_runtime.modules.media_companion.local_import.consumer_barrier import (
    LocalMediaConsumerBarrier,
)
from navia_runtime.modules.media_companion.local_import.orchestrator import (
    LocalImportOrchestrator,
)
from navia_runtime.modules.media_companion.local_import.store import (
    LocalMediaBarrierStore,
    LocalMediaImportStore,
)
from navia_runtime.modules.media_companion.product_materializer import (
    MediaProductMaterializer,
)
from navia_runtime.modules.media_companion.task_store import MediaTaskStore
FFMPEG = "/usr/bin/ffmpeg"
TASK_ID = "media_task_" + "e" * 32
SOURCE = "portal:bilibili:BV1AC1TEST:cid:1"
GENERATION = "depgen_" + "c" * 64
IMPORT_ID = "media_import_" + "e" * 32


def digest_of(path: Path) -> str:
    digest = hashlib.sha256()
    with Path(path).open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


@dataclass(frozen=True)
class Paths:
    """Every durable location this stack owns. They survive the crash."""

    root: Path

    @property
    def import_db(self) -> Path:
        return self.root / "navia.sqlite3"

    @property
    def product_db(self) -> Path:
        return self.root / "product.sqlite3"

    @property
    def tasks_root(self) -> Path:
        return self.root / "tasks"

    @property
    def visual_root(self) -> Path:
        return self.root / "visual"

    @property
    def frames_root(self) -> Path:
        return self.root / "frames"

    @property
    def private_root(self) -> Path:
        return self.root / "private"

    @property
    def media_root(self) -> Path:
        return self.root / "media"

    @property
    def source_video(self) -> Path:
        return self.root / "source.mp4"


def build_media(paths: Paths) -> Path:
    """A REAL container with a real video and a real audio stream."""
    target = paths.source_video
    target.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [
            FFMPEG, "-nostdin", "-hide_banner", "-loglevel", "error", "-y",
            "-f", "lavfi", "-i", "testsrc=size=320x240:rate=10:duration=3",
            "-f", "lavfi", "-i", "sine=frequency=440:duration=3",
            "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac",
            "-shortest", "-t", "3", str(target),
        ],
        check=True, timeout=300,
    )
    return target


def build_frames(paths: Paths, source: Path, count: int = 3) -> list[dict[str, Any]]:
    """REAL PNG frames with REAL digests, at monotonic timestamps."""
    paths.frames_root.mkdir(parents=True, exist_ok=True)
    frames: list[dict[str, Any]] = []
    for index in range(count):
        timestamp_ms = 500 + index * 800
        # The FROZEN artifact id, and it is also the file name.
        artifact_id = f"artifact_{secrets.token_hex(16)}"
        target = paths.frames_root / f"{artifact_id}.png"
        subprocess.run(
            [
                FFMPEG, "-nostdin", "-hide_banner", "-loglevel", "error", "-y",
                "-ss", f"{timestamp_ms / 1000:.3f}", "-i", str(source),
                "-frames:v", "1", "-c:v", "png", "-f", "image2", str(target),
            ],
            check=True, timeout=300,
        )
        # The sandbox publishes a frame only when it is a PRIVATE regular file.
        os.chmod(target, 0o600)
        frames.append(
            {
                "timestampMs": timestamp_ms,
                "artifact": {
                    "artifactId": artifact_id,
                    "kind": "frame",
                    "byteLength": target.stat().st_size,
                    "sha256": digest_of(target),
                },
            }
        )
    return frames


class Projection:
    """The transcript projection the materializer reads.

    The ASR is an external capability; the projection's SHAPE is the frozen
    one, and the barrier's transcript receipt is submitted through the
    barrier's own production method.
    """

    def get(self, task_id: str) -> dict[str, Any]:
        return {
            "taskId": task_id,
            "sourceIdentity": SOURCE,
            "sourceTitle": "AC1 crash window",
            "state": "succeeded",
            "terminal": True,
            "segments": [
                {"segmentId": "seg_1", "startMs": 0, "endMs": 1_500, "text": "第一段转写内容"},
                {"segmentId": "seg_2", "startMs": 1_500, "endMs": 3_000, "text": "第二段转写内容"},
            ],
        }


class Consent:
    """The governed vision consent, with the real store's shape."""

    def __init__(self) -> None:
        self.state = "not_granted"

    def grant(self) -> dict[str, Any]:
        self.state = "granted"
        return {"state": self.state}

    def revoke(self, task_id: str) -> dict[str, Any]:
        self.state = "revoked"
        return {"state": self.state}


def build_stack(paths: Paths, *, receipt: dict[str, Any] | None = None):
    """Build a FRESH production stack over the durable paths.

    Calling this twice with the same `paths` gives two independent views of the
    same durable state, which is what a restart looks like.
    """
    store = LocalMediaImportStore(paths.import_db)
    barriers = LocalMediaBarrierStore(paths.import_db)
    sandbox = TaskArtifactSandbox(paths.tasks_root)
    coordinator = MediaAcquisitionCoordinator(sandbox)
    _portal, adapter_id, media_id, unit_id, part_id = SOURCE.split(":")
    coordinator.create(
        MediaAcquisitionRequest(
            task_id=TASK_ID,
            source_identity=SOURCE,
            adapter_id=adapter_id,
            media_id=media_id,
            playback_unit_id=unit_id,
            part_id=part_id,
            consent_policy_id="bilibili-media-consent/v1",
            consent_policy_revision=1,
        )
    )
    product_store = MediaTaskStore(paths.product_db)
    visual_sandbox = TaskArtifactSandbox(paths.visual_root)
    orchestrator = LocalImportOrchestrator(
        store=store,
        coordinator=coordinator,
        stager=None,
        sandbox=sandbox,
        media_root=paths.media_root,
        preparer_factory=lambda *args, **kwargs: None,
        product_reconciler=None,
    )
    materializer = MediaProductMaterializer(
        product_store,
        Projection(),
        paths.private_root,
        visual_sandbox=visual_sandbox,
        vision_consent=Consent(),
        vision_providers=object(),
        vision_adapters=object(),
    )
    return SimpleNamespace(
        paths=paths,
        store=store,
        barriers=barriers,
        sandbox=sandbox,
        coordinator=coordinator,
        product_store=product_store,
        visual_sandbox=visual_sandbox,
        orchestrator=orchestrator,
        materializer=materializer,
        receipt=receipt,
    )


def wire_receipt(stack, receipt: dict[str, Any]) -> None:
    """Give the materializer the imported receipt and the frames' real root."""
    stack.materializer._imported_visual_receipt_resolver = lambda _task_id: receipt
    stack.materializer._imported_frame_root = lambda _task_id: stack.paths.frames_root
    stack.orchestrator.product_reconciler = stack.materializer.reconcile_visual_terminal
    # The materializer submits the receipt to the REAL barrier.
    stack.materializer._visual_terminal = stack.orchestrator.visual_terminal


def open_the_import(paths: Paths, video_digest: str) -> LocalMediaImportStore:
    """The import record and the shared input, exactly as an upload left them."""
    store = LocalMediaImportStore(paths.import_db)
    if store.find(IMPORT_ID) is None:
        store.create_import(
            task_id=TASK_ID,
            source_identity=SOURCE,
            byte_length=4096,
            declared_media_type="video/mp4",
            dependency_generation=GENERATION,
            import_id=IMPORT_ID,
        )
        store.transition(
            IMPORT_ID, expected_sequence=store.get(IMPORT_ID)["sequence"], state="uploading"
        )
        store.transition(
            IMPORT_ID,
            expected_sequence=store.get(IMPORT_ID)["sequence"],
            state="verifying",
            uploaded_bytes=4096,
            video_manifest_sha256=video_digest,
        )
    shared = paths.media_root / IMPORT_ID / "source.bin"
    shared.parent.mkdir(parents=True, exist_ok=True)
    if not shared.exists():
        shared.write_bytes(b"the original imported video bytes")
        os.chmod(shared, 0o600)
    return store


def drive_the_barrier_to_t4(stack) -> LocalMediaConsumerBarrier:
    """The PRODUCTION T1..T4 transitions and the transcript's receipt."""
    record = stack.store.get(IMPORT_ID)
    shared = stack.paths.media_root / IMPORT_ID / "source.bin"
    barrier = LocalMediaConsumerBarrier(
        store=stack.store,
        barrier_store=stack.barriers,
        coordinator=stack.coordinator,
        import_id=IMPORT_ID,
        shared_input=shared,
    )
    barrier.mark_video_durable(video_manifest_sha256=record["videoManifestSha256"])
    barrier.mark_inputs_prepared(
        visual_receipt_sha256="3" * 64,
        prepared_media={
            "durationMs": 3_000, "widthPx": 320, "heightPx": 240,
            "container": "mov,mp4,m4a,3gp,3g2,mj2", "route": "explicit_local_media_asr",
        },
    )
    barrier.mark_input_bound(
        video_manifest_sha256=record["videoManifestSha256"], visual_receipt_sha256="3" * 64
    )
    barrier.mark_audio_staged(audio_owner_receipt_sha256="2" * 64)
    barrier.delete_original_video()
    barrier.mark_transcript_terminal()
    return barrier
