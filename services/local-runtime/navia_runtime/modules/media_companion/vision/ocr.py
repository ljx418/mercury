from __future__ import annotations

import hashlib
import json
import math
from dataclasses import dataclass
from importlib.metadata import PackageNotFoundError, version
from pathlib import Path
from typing import Any, Callable, Protocol

import cv2
import numpy as np

from ..acquisition.task_artifacts import ArtifactRef, TaskArtifactError, TaskArtifactSandbox


ENGINE_ID = "rapidocr-onnxruntime-cpu"
ENGINE_VERSION = "3.9.2"
ONNXRUNTIME_VERSION = "1.28.0"
OPENCV_VERSION = "5.0.0.93"
THREAD_LIMIT = 4
MODEL_ASSETS = {
    "PP-OCRv6_det_small.onnx": (9929594, "090f04abcd9d9a7498bc4ebf677e4cb9bdce1fe4197ddb7e529f1ef44e1ff94f"),
    "PP-OCRv6_rec_small.onnx": (21234383, "6f327246b50388f3c176ae304bd95767ea6dc0c9ae92153ef8cbe210b3c14884"),
    "ch_ppocr_mobile_v2.0_cls_mobile.onnx": (585532, "e47acedf663230f8863ff1ab0e64dd2d82b838fceb5957146dab185a89d6215c"),
}


class LocalOcrError(RuntimeError):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


class OcrEngine(Protocol):
    def __call__(self, image: np.ndarray[Any, Any]) -> Any: ...


@dataclass(frozen=True)
class OcrBlock:
    text: str
    confidence: float
    bbox: tuple[float, float, float, float]

    def public_dict(self) -> dict[str, Any]:
        return {
            "text": self.text,
            "confidence": self.confidence,
            "bbox": list(self.bbox),
        }


@dataclass(frozen=True)
class OcrObservation:
    task_id: str
    frame_artifact_id: str
    frame_sha256: str
    provider: str
    engine_version: str
    local_only: bool
    blocks: tuple[OcrBlock, ...]
    content_sha256: str

    def public_dict(self) -> dict[str, Any]:
        return {
            "taskId": self.task_id,
            "frameArtifactId": self.frame_artifact_id,
            "frameSha256": self.frame_sha256,
            "provider": self.provider,
            "engineVersion": self.engine_version,
            "localOnly": self.local_only,
            "blocks": [block.public_dict() for block in self.blocks],
            "contentSha256": self.content_sha256,
        }


def _file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


class LocalOcrAdapter:
    def __init__(
        self,
        sandbox: TaskArtifactSandbox,
        *,
        engine_factory: Callable[[], OcrEngine] | None = None,
        package_root: Path | None = None,
        verify_dependencies: bool = True,
    ) -> None:
        self.sandbox = sandbox
        self._engine_factory = engine_factory
        self._engine: OcrEngine | None = None
        self._package_root = package_root
        if verify_dependencies:
            self._verify_dependencies()

    def _verify_dependencies(self) -> None:
        expected_versions = {
            "rapidocr": ENGINE_VERSION,
            "onnxruntime": ONNXRUNTIME_VERSION,
            "opencv-python": OPENCV_VERSION,
        }
        try:
            actual = {package: version(package) for package in expected_versions}
        except PackageNotFoundError as exc:
            raise LocalOcrError("OCR_ASSET_INVALID", "Frozen OCR dependency is unavailable.") from exc
        if actual != expected_versions:
            raise LocalOcrError("OCR_ASSET_INVALID", "Frozen OCR dependency versions do not match.")

        model_root = self._package_root
        if model_root is None:
            try:
                import rapidocr
            except ImportError as exc:
                raise LocalOcrError("OCR_ASSET_INVALID", "RapidOCR is unavailable.") from exc
            model_root = Path(rapidocr.__file__).resolve().parent / "models"
        for filename, (expected_bytes, expected_hash) in MODEL_ASSETS.items():
            path = model_root / filename
            try:
                matches = path.is_file() and path.stat().st_size == expected_bytes and _file_sha256(path) == expected_hash
            except OSError as exc:
                raise LocalOcrError("OCR_ASSET_INVALID", "Frozen OCR model asset cannot be read.") from exc
            if not matches:
                raise LocalOcrError("OCR_ASSET_INVALID", "Frozen OCR model asset does not match its manifest.")

    def _create_engine(self) -> OcrEngine:
        if self._engine_factory is not None:
            return self._engine_factory()
        try:
            from rapidocr import RapidOCR

            return RapidOCR(
                params={
                    "Global.log_level": "warning",
                    "EngineConfig.onnxruntime.intra_op_num_threads": THREAD_LIMIT,
                    "EngineConfig.onnxruntime.inter_op_num_threads": 1,
                }
            )
        except Exception as exc:
            raise LocalOcrError("OCR_ASSET_INVALID", "Frozen OCR engine could not initialize.") from exc

    def observe(self, task_id: str, frame: ArtifactRef) -> OcrObservation:
        if frame.task_id != task_id or frame.kind != "frame" or len(frame.sha256) != 64:
            raise LocalOcrError("OCR_ASSET_INVALID", "OCR input is not a task-owned frame artifact.")
        try:
            path = self.sandbox.private_path(task_id, frame)
            if _file_sha256(path) != frame.sha256:
                raise LocalOcrError("OCR_ASSET_INVALID", "OCR frame bytes changed after publication.")
            image = cv2.imread(str(path), cv2.IMREAD_COLOR)
        except (OSError, TaskArtifactError) as exc:
            raise LocalOcrError("OCR_ASSET_INVALID", "OCR frame is not available in the task sandbox.") from exc
        if image is None or image.ndim != 3 or image.shape[0] <= 0 or image.shape[1] <= 0:
            raise LocalOcrError("OCR_FAILED", "OCR frame is not a valid image.")

        if self._engine is None:
            self._engine = self._create_engine()
        try:
            result = self._engine(image)
            blocks = self._normalize_result(result, image.shape[1], image.shape[0])
        except LocalOcrError:
            raise
        except Exception as exc:
            raise LocalOcrError("OCR_FAILED", "Local OCR execution failed.") from exc

        canonical = {
            "engineId": ENGINE_ID,
            "engineVersion": ENGINE_VERSION,
            "frameArtifactId": frame.artifact_id,
            "frameSha256": frame.sha256,
            "blocks": [block.public_dict() for block in blocks],
        }
        digest = hashlib.sha256(json.dumps(canonical, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")).hexdigest()
        return OcrObservation(task_id, frame.artifact_id, frame.sha256, "rapidocr_local", ENGINE_VERSION, True, blocks, digest)

    @staticmethod
    def _normalize_result(result: Any, width: int, height: int) -> tuple[OcrBlock, ...]:
        boxes = getattr(result, "boxes", None)
        texts = getattr(result, "txts", None)
        scores = getattr(result, "scores", None)
        if boxes is None and texts is None and scores is None:
            return ()
        if boxes is None or texts is None or scores is None or not (len(boxes) == len(texts) == len(scores)):
            raise LocalOcrError("OCR_FAILED", "OCR engine returned an invalid result shape.")

        normalized: list[OcrBlock] = []
        for box, raw_text, raw_score in zip(boxes, texts, scores, strict=True):
            text = str(raw_text).strip()
            score = float(raw_score)
            points = np.asarray(box, dtype=float)
            if not text or points.shape != (4, 2) or not np.isfinite(points).all() or not math.isfinite(score) or not 0 <= score <= 1:
                raise LocalOcrError("OCR_FAILED", "OCR engine returned an invalid block.")
            if (points[:, 0] < 0).any() or (points[:, 0] > width).any() or (points[:, 1] < 0).any() or (points[:, 1] > height).any():
                raise LocalOcrError("OCR_FAILED", "OCR engine returned an out-of-range bounding box.")
            x1 = float(points[:, 0].min()) / width
            y1 = float(points[:, 1].min()) / height
            x2 = float(points[:, 0].max()) / width
            y2 = float(points[:, 1].max()) / height
            if x1 >= x2 or y1 >= y2:
                raise LocalOcrError("OCR_FAILED", "OCR engine returned a degenerate bounding box.")
            normalized.append(OcrBlock(text, round(score, 6), tuple(round(value, 6) for value in (x1, y1, x2, y2))))
        return tuple(normalized)
