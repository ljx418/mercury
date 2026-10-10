#!/usr/bin/env python3
"""Verify V3-2 ASR comparison bundle, frozen model bytes, and review page."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import sys
from typing import Any

from jsonschema import Draft202012Validator, FormatChecker


MODEL_FILES = ("config.json", "model.bin", "tokenizer.json", "vocabulary.txt")


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def model_file_set(root: Path) -> str:
    rows = []
    for name in MODEL_FILES:
        path = root / name
        rows.append((name, path.stat().st_size, sha256_file(path)))
    material = "".join(f"{name}\t{length}\t{digest}\n" for name, length, digest in rows)
    return sha256_bytes(material.encode("utf-8"))


def check(condition: bool, check_id: str, actual: Any, expected: Any) -> dict[str, Any]:
    return {"checkId": check_id, "actual": actual, "expected": expected, "passed": bool(condition)}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--run-root", type=Path, required=True)
    parser.add_argument("--schema", type=Path, required=True)
    parser.add_argument("--model-manifest", type=Path, required=True)
    parser.add_argument("--production-model", type=Path, required=True)
    parser.add_argument("--baseline-model", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    schema = json.loads(args.schema.read_text(encoding="utf-8"))
    Draft202012Validator.check_schema(schema)
    bundle_path = args.run_root / "comparison-bundle.private.json"
    page_path = args.run_root / "asr-comparison-review.html"
    summary_path = args.run_root / "generation-summary.json"
    bundle = json.loads(bundle_path.read_text(encoding="utf-8"))
    summary = json.loads(summary_path.read_text(encoding="utf-8"))
    page_qa_path = args.run_root / "ui-qa/page-qa-result.json"
    page_qa = json.loads(page_qa_path.read_text(encoding="utf-8")) if page_qa_path.is_file() else None
    manifest = json.loads(args.model_manifest.read_text(encoding="utf-8"))
    errors = list(Draft202012Validator(schema, format_checker=FormatChecker()).iter_errors(bundle))
    checks = [
        check(not errors, "C01_SCHEMA_INSTANCE", len(errors), 0),
        check(model_file_set(args.production_model) == manifest["production"]["fileSetSha256"], "C02_PRODUCTION_MODEL_BYTES", model_file_set(args.production_model), manifest["production"]["fileSetSha256"]),
        check(model_file_set(args.baseline_model) == manifest["baseline"]["fileSetSha256"], "C02_BASELINE_MODEL_BYTES", model_file_set(args.baseline_model), manifest["baseline"]["fileSetSha256"]),
        check(len(bundle["samples"]) == 3 and len({item["bvid"] for item in bundle["samples"]}) == 3, "C03_SAMPLE_DENOMINATOR", len(bundle["samples"]), 3),
        check(bundle["window"] == {"startMs": 30000, "endMs": 150000, "durationMs": 120000, "binDurationMs": 15000, "binCount": 8}, "C04_FIXED_WINDOW", bundle["window"], "30s..150s / 8x15s"),
        check(summary["modelInferenceCount"] == 6, "C05_MODEL_INFERENCES", summary["modelInferenceCount"], 6),
    ]
    bin_keys = set()
    text_hashes_valid = True
    timeline_valid = True
    label_maps_valid = True
    expected_production_labels = ["candidateA", "candidateB", "candidateA"]
    for sample_index, sample in enumerate(bundle["samples"]):
        labels = sample["labelMap"]
        label_maps_valid &= set(labels.values()) == {"production_small", "independent_base"}
        label_maps_valid &= labels[expected_production_labels[sample_index]] == "production_small"
        if len(sample["bins"]) != 8:
            timeline_valid = False
        for index, item in enumerate(sample["bins"]):
            bin_keys.add((sample["bvid"], item["binIndex"]))
            timeline_valid &= item["binIndex"] == index
            timeline_valid &= item["absoluteStartMs"] == 30000 + index * 15000
            timeline_valid &= item["absoluteEndMs"] == 45000 + index * 15000
            for candidate in (item["candidateA"], item["candidateB"]):
                text_hashes_valid &= sha256_bytes(candidate["text"].encode("utf-8")) == candidate["textSha256"]
    page_text = page_path.read_text(encoding="utf-8")
    visible_requirements = all(value in page_text for value in ["A 更准确", "B 更准确", "等价可接受", "两者均不可接受", "关键含义是否保留", "Reviewer ID", "Adjudicator ID"])
    no_transcription_control = "<textarea" not in page_text.lower() and "逐字转写" not in page_text
    checks.extend([
        check(len(bin_keys) == 24 and timeline_valid and text_hashes_valid, "C06_BIN_INTEGRITY", len(bin_keys), 24),
        check(label_maps_valid, "C07_BLIND_LABEL_MAP", [item["labelMap"] for item in bundle["samples"]], "A/B alternating and distinct"),
        check(visible_requirements and no_transcription_control, "C08_REVIEW_CONTROLS", {"visibleRequirements": visible_requirements, "noTranscriptionControl": no_transcription_control}, {"visibleRequirements": True, "noTranscriptionControl": True}),
        check("v3-asr-independent-comparison-review/v1" in page_text and "judgments" in page_text, "C09_REVIEW_EXPORT", True, True),
        check("v3-asr-comparison-adjudication/v1" in page_text and "review-file-a" in page_text and "review-file-b" in page_text, "C10_ADJUDICATION_IMPORT", True, True),
        check(all(bundle["cleanup"].values()) and bundle["secretScan"] == {"hitCount": 0, "passed": True} and summary["secretScan"]["hitCount"] == 0, "C11_CLEANUP_SECRET_SCAN", {"cleanup": bundle["cleanup"], "secretScan": summary["secretScan"]}, "all cleanup true / 0 hit"),
        check(summary["bundleSha256"] == sha256_file(bundle_path) and summary["reviewPageSha256"] == sha256_file(page_path), "C11_ARTIFACT_HASHES", {"bundle": sha256_file(bundle_path), "page": sha256_file(page_path)}, {"bundle": summary["bundleSha256"], "page": summary["reviewPageSha256"]}),
        check(page_qa is not None and page_qa.get("passed") is True, "C12_REAL_CHROME_UI_QA", None if page_qa is None else {"viewports": len(page_qa["viewports"]), "axe": page_qa["axe"], "keyboard": page_qa["keyboard"], "adjudication": page_qa.get("adjudicationExport"), "cleanup": page_qa["cleanup"]}, "4 viewports / Axe 0/0 / keyboard 3/3 / review+adjudication export / cleanup"),
    ])
    result = {
        "schemaVersion": "v3-asr-comparison-verification/v1",
        "runId": bundle["runId"],
        "summary": {"total": len(checks), "passed": sum(item["passed"] for item in checks), "failed": sum(not item["passed"] for item in checks)},
        "schemaErrors": [{"path": "/".join(map(str, error.absolute_path)), "message": error.message} for error in errors],
        "checks": checks,
    }
    result["passed"] = result["summary"]["failed"] == 0
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result["passed"] else 1


if __name__ == "__main__":
    sys.exit(main())
