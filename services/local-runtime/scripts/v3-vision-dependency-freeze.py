#!/usr/bin/env python3
"""Freeze V3-3 OCR assets and derive its visual sample denominator."""

from __future__ import annotations

import argparse
import hashlib
import json
import resource
import sys
import time
from importlib.metadata import distribution, version
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_SOURCE_RUN = REPO_ROOT / (
    "docs/active/project/evidence/v3_media_companion/v3-2-media-acquisition/"
    "v3-2-7-production-exit/runs/v3-2-production-20261007T174158Z"
)
DEFAULT_OUTPUT = REPO_ROOT / (
    "docs/active/project/evidence/v3_media_companion/v3-3-dependency-freeze"
)

EXPECTED_PACKAGES = {
    "rapidocr": {
        "version": "3.9.2",
        "license": "Apache-2.0",
        "wheel": "rapidocr-3.9.2-py3-none-any.whl",
        "wheelSha256": "04d6b8d151f823d930bd91910555f57bea897c0c44fa6794267b94cf9c1ef9a0",
        "source": "https://pypi.org/project/rapidocr/3.9.2/",
    },
    "onnxruntime": {
        "version": "1.28.0",
        "license": "MIT",
        "wheel": "onnxruntime-1.28.0-cp312-cp312-manylinux_2_27_x86_64.manylinux_2_28_x86_64.whl",
        "wheelSha256": "0a83bdb70d143cede762b677789bf2a7acca54b3fb82565601d5c30695aa933c",
        "source": "https://pypi.org/project/onnxruntime/1.28.0/",
    },
    "opencv-python": {
        "version": "5.0.0.93",
        "license": "Apache-2.0",
        "wheel": "opencv_python-5.0.0.93-cp37-abi3-manylinux_2_28_x86_64.whl",
        "wheelSha256": "c8de2dec111122a02e8beb28e16c31904992dfd6186560b142a92c71403c1039",
        "source": "https://pypi.org/project/opencv-python/5.0.0.93/",
    },
}

EXPECTED_MODELS = {
    "models/PP-OCRv6_det_small.onnx": (
        9_929_594,
        "090f04abcd9d9a7498bc4ebf677e4cb9bdce1fe4197ddb7e529f1ef44e1ff94f",
    ),
    "models/PP-OCRv6_rec_small.onnx": (
        21_234_383,
        "6f327246b50388f3c176ae304bd95767ea6dc0c9ae92153ef8cbe210b3c14884",
    ),
    "models/ch_ppocr_mobile_v2.0_cls_mobile.onnx": (
        585_532,
        "e47acedf663230f8863ff1ab0e64dd2d82b838fceb5957146dab185a89d6215c",
    ),
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def canonical_hash(value: Any) -> str:
    payload = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def write_json(path: Path, value: Any) -> None:
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def package_manifest() -> tuple[dict[str, Any], Path]:
    import rapidocr

    rapid_root = Path(rapidocr.__file__).resolve().parent
    packages = []
    for package_id, expected in EXPECTED_PACKAGES.items():
        actual_version = version(package_id)
        if actual_version != expected["version"]:
            raise RuntimeError(f"{package_id} version drift: {actual_version}")
        metadata = distribution(package_id).metadata
        packages.append(
            {
                "packageId": package_id,
                **expected,
                "installedVersion": actual_version,
                "metadataLicense": metadata.get("License-Expression") or metadata.get("License"),
            }
        )

    assets = []
    for relative, (expected_bytes, expected_hash) in EXPECTED_MODELS.items():
        path = rapid_root / relative
        actual_bytes = path.stat().st_size
        actual_hash = sha256(path)
        if (actual_bytes, actual_hash) != (expected_bytes, expected_hash):
            raise RuntimeError(f"RapidOCR asset drift: {relative}")
        assets.append(
            {
                "assetId": Path(relative).stem,
                "pathWithinWheel": relative,
                "bytes": actual_bytes,
                "sha256": actual_hash,
                "modelFamily": "PP-OCRv6" if "OCRv6" in relative else "PP-OCRv2-cls",
            }
        )

    manifest = {
        "schemaVersion": "v3-vision-dependency-manifest/v1",
        "engineId": "rapidocr-onnxruntime-cpu",
        "engineVersion": "3.9.2",
        "executionBackend": "onnxruntime-cpu",
        "offlineRequired": True,
        "gpuRequired": False,
        "threadLimit": 4,
        "packages": packages,
        "assets": assets,
        "assetBytes": sum(item["bytes"] for item in assets),
        "sourcePolicy": "assets_bundled_in_pinned_rapidocr_wheel",
    }
    manifest["contentSha256"] = canonical_hash(manifest)
    return manifest, rapid_root


def derive_samples(source_run: Path) -> dict[str, Any]:
    source_registry_path = source_run / "route/sample-registry-v5.json"
    source_registry = json.loads(source_registry_path.read_text(encoding="utf-8"))
    samples = [item for item in source_registry["samples"] if item["expectedOutcome"] == "success"]
    if len(samples) != 10:
        raise RuntimeError(f"expected exactly 10 successful V3-2 samples, got {len(samples)}")
    counts: dict[str, int] = {}
    derived = []
    for index, item in enumerate(samples):
        screenshot = source_run / "probe" / item["screenshot"]["path"]
        actual_hash = sha256(screenshot)
        if actual_hash != item["screenshot"]["sha256"]:
            raise RuntimeError(f"source screenshot drift: {item['sampleId']}")
        counts[item["primaryClass"]] = counts.get(item["primaryClass"], 0) + 1
        derived.append(
            {
                "sampleId": item["sampleId"],
                "adapterId": item["adapterId"],
                "url": item["url"],
                "mediaId": item["mediaId"],
                "partId": item["partId"],
                "playbackUnitId": item["playbackUnitId"],
                "sourceClass": item["primaryClass"],
                "expectedEvidence": ["frame", "ocr", "vlm"] if index < 8 else ["frame", "ocr"],
                "cloudVisionTarget": index < 8,
                "sourceScreenshot": {
                    "path": str(screenshot.relative_to(REPO_ROOT)),
                    "sha256": actual_hash,
                },
            }
        )
    if counts != {"subtitle": 6, "asr": 3, "multipart": 1}:
        raise RuntimeError(f"V3-3 denominator drift: {counts}")
    result = {
        "schemaVersion": "v3-vision-sample-registry/v1",
        "sourceRunId": source_run.name,
        "sourceRouteRunId": source_registry["runId"],
        "sourceRegistryPath": str(source_registry_path.relative_to(REPO_ROOT)),
        "sourceRegistrySha256": sha256(source_registry_path),
        "selectionRule": "all_expectedOutcome_success_in_source_order_first_8_cloud_targets",
        "sampleCount": 10,
        "cloudVisionTargetCount": 8,
        "classificationCounts": counts,
        "samples": derived,
    }
    result["contentSha256"] = canonical_hash(result)
    return result


def run_offline_probe(manifest: dict[str, Any], sample_registry: dict[str, Any]) -> dict[str, Any]:
    from rapidocr import RapidOCR

    network_attempts: list[dict[str, str]] = []

    def audit(event: str, args: tuple[Any, ...]) -> None:
        if event in {"socket.connect", "socket.getaddrinfo"}:
            network_attempts.append({"event": event, "arguments": repr(args)})
            raise RuntimeError("network access denied by V3-3 offline probe")

    sys.addaudithook(audit)
    source = REPO_ROOT / sample_registry["samples"][7]["sourceScreenshot"]["path"]
    started = time.perf_counter()
    engine = RapidOCR(
        params={
            "EngineConfig.onnxruntime.use_cuda": False,
            "EngineConfig.onnxruntime.intra_op_num_threads": 4,
            "EngineConfig.onnxruntime.inter_op_num_threads": 1,
        }
    )
    output = engine(str(source))
    elapsed = time.perf_counter() - started
    texts = [str(item) for item in (output.txts or [])]
    scores = [float(item) for item in (output.scores or [])]
    if not texts or network_attempts:
        raise RuntimeError("RapidOCR offline self-test failed")
    normalized = [{"text": text, "score": round(score, 6)} for text, score in zip(texts, scores)]
    return {
        "schemaVersion": "v3-vision-offline-probe/v1",
        "passed": True,
        "engineManifestSha256": manifest["contentSha256"],
        "sourceSampleId": sample_registry["samples"][7]["sampleId"],
        "sourceImagePath": str(source.relative_to(REPO_ROOT)),
        "sourceImageSha256": sha256(source),
        "networkPolicy": "python_audit_hook_deny_socket_connect_and_getaddrinfo",
        "networkAttemptCount": len(network_attempts),
        "gpuUsed": False,
        "threadLimit": 4,
        "textCount": len(texts),
        "meanConfidence": round(sum(scores) / len(scores), 6),
        "resultSha256": canonical_hash(normalized),
        "wallClockSeconds": round(elapsed, 6),
        "peakRssKiB": resource.getrusage(resource.RUSAGE_SELF).ru_maxrss,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-run", type=Path, default=DEFAULT_SOURCE_RUN)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    source_run = args.source_run.resolve()
    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=True)

    manifest, _ = package_manifest()
    samples = derive_samples(source_run)
    probe = run_offline_probe(manifest, samples)
    write_json(output / "v3-3-rapidocr-manifest.json", manifest)
    write_json(output / "v3-3-vision-sample-registry.json", samples)
    write_json(output / "v3-3-rapidocr-offline-probe.json", probe)
    print(json.dumps({"manifest": manifest["contentSha256"], "samples": samples["contentSha256"], "probe": probe}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
