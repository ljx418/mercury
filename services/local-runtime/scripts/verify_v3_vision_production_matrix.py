#!/usr/bin/env python3
"""Independently verify a sealed V3-3-6 production vision matrix."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from pathlib import Path
from typing import Any


SHA256_RE = re.compile(r"^[a-f0-9]{64}$")
RUN_ID_RE = re.compile(r"^v3-3-vision-production-[0-9]{8}T[0-9]{6}Z$")
FORBIDDEN_PUBLIC_RE = re.compile(
    rb"(?i)(authorization\s*[:=]\s*bearer|sessdata|bili_jct|cookies\.txt|/mnt/[a-z]/users/|\\users\\)"
)


def canonical(value: object) -> bytes:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def require(condition: bool, code: str) -> None:
    if not condition:
        raise ValueError(code)


def verify(run_root: Path, registry_path: Path) -> dict[str, Any]:
    require(run_root.is_dir(), "RUN_ROOT_NOT_FOUND")
    require(RUN_ID_RE.fullmatch(run_root.name) is not None, "RUN_ID_INVALID")
    files = sorted(path.name for path in run_root.iterdir() if path.is_file())
    require(files == ["run-result.json", "run-seal.json"], "PUBLIC_FILE_SET_INVALID")

    result_path = run_root / "run-result.json"
    seal_path = run_root / "run-seal.json"
    result = json.loads(result_path.read_text(encoding="utf-8"))
    seal = json.loads(seal_path.read_text(encoding="utf-8"))
    registry = json.loads(registry_path.read_text(encoding="utf-8"))

    content = dict(result)
    stated_content_hash = content.pop("contentSha256", None)
    require(result.get("schemaVersion") == "v3-3-6-production-matrix/v1", "RESULT_SCHEMA_VERSION_INVALID")
    require(seal.get("schemaVersion") == "v3-3-6-run-seal/v1", "SEAL_SCHEMA_VERSION_INVALID")
    require(result.get("runId") == run_root.name == seal.get("runId"), "RUN_ID_MISMATCH")
    require(hashlib.sha256(canonical(content)).hexdigest() == stated_content_hash == seal.get("contentSha256"), "CONTENT_HASH_MISMATCH")
    require(sha256_file(result_path) == seal.get("resultSha256"), "RESULT_HASH_MISMATCH")
    require(result.get("sourceRunId") == registry.get("sourceRunId") == "v3-2-production-20261007T174158Z", "SOURCE_RUN_MISMATCH")
    require(result.get("registryFileSha256") == sha256_file(registry_path), "REGISTRY_FILE_HASH_MISMATCH")
    require(result.get("registryContentSha256") == registry.get("contentSha256"), "REGISTRY_CONTENT_HASH_MISMATCH")
    require(result.get("provider") == {"providerId": "minimax-cn-openai-vision", "modelId": "MiniMax-M3"}, "PROVIDER_BASELINE_MISMATCH")

    samples = result.get("samples")
    expected = registry.get("samples")
    require(isinstance(samples, list) and isinstance(expected, list) and len(samples) == len(expected) == 10, "SAMPLE_COUNT_INVALID")
    expected_ids = [f"v3-sample-{index:02d}" for index in range(1, 11)]
    require([sample.get("sampleId") for sample in samples] == expected_ids, "SAMPLE_ORDER_INVALID")
    require(len({sample.get("taskIdSha256") for sample in samples}) == 10, "TASK_ID_NOT_UNIQUE")

    for index, (sample, frozen) in enumerate(zip(samples, expected, strict=True), start=1):
        prefix = f"SAMPLE_{index:02d}"
        for key in ("sampleId", "mediaId", "playbackUnitId", "sourceClass", "cloudVisionTarget"):
            require(sample.get(key) == frozen.get(key), f"{prefix}_{key.upper()}_MISMATCH")
        require(all(SHA256_RE.fullmatch(str(sample.get(key, ""))) for key in ("taskIdSha256", "samplingSha256", "receiptSha256")), f"{prefix}_HASH_INVALID")
        media = sample.get("media", {})
        frame = sample.get("frame", {})
        ocr = sample.get("ocr", {})
        require(type(media.get("byteLength")) is int and media["byteLength"] > 0 and SHA256_RE.fullmatch(str(media.get("sha256", ""))) is not None, f"{prefix}_MEDIA_INVALID")
        require(type(media.get("durationMs")) is int and media["durationMs"] > 0, f"{prefix}_DURATION_INVALID")
        require(type(frame.get("timestampMs")) is int and 0 <= frame["timestampMs"] < media["durationMs"], f"{prefix}_FRAME_TIME_INVALID")
        require(type(frame.get("byteLength")) is int and frame["byteLength"] > 0 and SHA256_RE.fullmatch(str(frame.get("sha256", ""))) is not None, f"{prefix}_FRAME_INVALID")
        require(all(type(frame.get(key)) is int and frame[key] > 0 for key in ("widthPx", "heightPx")) and max(frame["widthPx"], frame["heightPx"]) <= 1280, f"{prefix}_FRAME_DIMENSION_INVALID")
        require(ocr.get("completed") is True and type(ocr.get("blockCount")) is int and ocr["blockCount"] >= 0, f"{prefix}_OCR_INVALID")
        require(ocr.get("networkDispatchCount") == 0 and SHA256_RE.fullmatch(str(ocr.get("contentSha256", ""))) is not None, f"{prefix}_OCR_BOUNDARY_INVALID")
        require(sample.get("schemaValid") is True, f"{prefix}_RECEIPT_NOT_SCHEMA_VALID")
        cleanup = sample.get("cleanup", {})
        require(cleanup.get("terminalStatus") == "succeeded" and cleanup.get("residualNonEvidenceFrameCount") == 0 and cleanup.get("pendingOutboundRequestCount") == 0, f"{prefix}_CLEANUP_INVALID")

        vision = sample.get("vision")
        if index <= 8:
            require(isinstance(vision, dict), f"{prefix}_VISION_MISSING")
            require(vision.get("providerId") == "minimax-cn-openai-vision" and vision.get("modelId") == "MiniMax-M3", f"{prefix}_VISION_PROVIDER_INVALID")
            require(all(SHA256_RE.fullmatch(str(vision.get(key, ""))) for key in ("requestSha256", "responseSha256", "captionSha256")), f"{prefix}_VISION_HASH_INVALID")
            usage = vision.get("usage", {})
            require(usage.get("inputImageCount") == 1 and usage.get("inputBytes") == frame["byteLength"], f"{prefix}_VISION_INPUT_INVALID")
            require(type(usage.get("inputTokens")) is int and usage["inputTokens"] > 0 and type(usage.get("outputTokens")) is int and usage["outputTokens"] > 0, f"{prefix}_VISION_USAGE_INVALID")
            require(SHA256_RE.fullmatch(str(sample.get("consentDecisionIdSha256", ""))) is not None, f"{prefix}_CONSENT_HASH_INVALID")
        else:
            require(vision is None and sample.get("consentDecisionIdSha256") is None, f"{prefix}_NON_TARGET_DISPATCH")

    summary = result.get("summary")
    require(summary == {
        "sampleCount": 10,
        "classificationCounts": {"subtitle": 6, "asr": 3, "multipart": 1},
        "ocrCompletedCount": 10,
        "visionTargetCount": 8,
        "visionSucceededCount": 8,
        "nonTargetProviderDispatchCount": 0,
        "schemaValidReceiptCount": 10,
        "cleanupPassedCount": 10,
    }, "SUMMARY_INVALID")
    require(result.get("privateTaskRootResidualCount") == 0, "PRIVATE_ROOT_RESIDUAL")
    require(result.get("secretMaterialIncluded") is False and result.get("rawFrameIncluded") is False and result.get("captionTextIncluded") is False and result.get("publicAbsolutePathCount") == 0, "PUBLIC_BOUNDARY_FLAG_INVALID")
    public_bytes = result_path.read_bytes() + seal_path.read_bytes()
    require(FORBIDDEN_PUBLIC_RE.search(public_bytes) is None, "FORBIDDEN_PUBLIC_TEXT")

    return {
        "schemaVersion": "v3-3-7-production-matrix-verification/v1",
        "runId": run_root.name,
        "checks": 16,
        "sampleChecks": 10,
        "ocrCompleted": 10,
        "visionSucceeded": 8,
        "nonTargetProviderDispatchCount": 0,
        "contentSha256": stated_content_hash,
        "resultSha256": seal["resultSha256"],
        "passed": True,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run-root", type=Path, required=True)
    parser.add_argument("--registry", type=Path, required=True)
    args = parser.parse_args()
    try:
        output = verify(args.run_root, args.registry)
    except (ValueError, KeyError, TypeError, json.JSONDecodeError) as exc:
        print(json.dumps({"passed": False, "failureCode": str(exc)}, indent=2))
        return 2
    print(json.dumps(output, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
