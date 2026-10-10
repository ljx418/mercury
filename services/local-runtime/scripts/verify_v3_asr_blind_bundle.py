#!/usr/bin/env python3
"""Independently verify a V3-2-0b-6 machine-material run."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import stat
from typing import Any, Callable
from urllib.parse import parse_qs, urlparse

from jsonschema import Draft202012Validator, FormatChecker


EXPECTED_RUN = "v3-2-0b-6-20260922T064728Z"
SOURCE_RUN = "v3-2-0b-5-20260922T063133Z"
HANDOFF_SHA = "726dae961e4bd75cb23a71c3d911138fc26b460adf246e0253d6f4359cb66c14"
SAMPLES = (
    ("v3-asr-comparison-01", "BV1sMNtzJE5B", "30592600559", 1, "2a11e09975733740d49f4a63ca7b3ec1a9ebc77e8e8897d770e1991d4c1beb05", "6aaa6151f73140bde48bd32acbf25cfd45ccc1e76686c57e1608165d24beae87"),
    ("v3-asr-comparison-02", "BV1xz4y1S7yF", "286754257", 1, "63eb48d9027e1cfa09747d7261f9e2b7347cbec58daeb38b4aff09cdbd647405", "4521f59532308e378bfa975e46be1bda70c68e37ce7dc6f4723cf197571054d8"),
    ("v3-asr-comparison-03", "BV1Bb411w741", "61744125", 1, "f4f61c09f8fe19828fb2085ef18459179d5142596b8107cef82df6c7bf7cc97b", "15007fbb933eabcb95b5ab9081645710896892c4b68e0f72b9e6501ca2ea9d1a"),
)
MODEL_HASHES = {
    "config.json": (2370, "b55496ac7940a7ae47d2c01eab40edfd8701feec1229d9cce3b40014383fb828"),
    "model.bin": (483546902, "3e305921506d8872816023e4c273e75d2419fb89b24da97b4fe7bce14170d671"),
    "tokenizer.json": (2203239, "fb7b63191e9bb045082c79fd742a3106a12c99513ab30df4a0d47fa6cb6fd0ab"),
    "vocabulary.txt": (459861, "34ce3fe1c5041027b3f8d42912270993f986dbc4bb34cf27f951e34a1e453913"),
}
REVIEW_DENY = (b"funasr", b"paraformer", b"faster-whisper", b"production_small", b"funasr_edge_local", b"labelmap", b"candidateside")


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError(f"not object: {path.name}")
    return value


def mode(path: Path) -> int:
    return stat.S_IMODE(path.stat().st_mode)


def bin_output(segments: list[dict[str, Any]], index: int) -> dict[str, Any]:
    start = index * 15_000
    end = start + 15_000
    selected = [row for row in segments if start <= (row["startMs"] + row["endMs"]) / 2 < end]
    text = " ".join(row["text"].strip() for row in selected).strip()
    return {
        "text": text,
        "textSha256": hashlib.sha256(text.encode()).hexdigest(),
        "segmentIds": [row["segmentId"] for row in selected],
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--run-root", type=Path, required=True)
    parser.add_argument("--private-root", type=Path, required=True)
    parser.add_argument("--source-run-root", type=Path, required=True)
    parser.add_argument("--source-private-root", type=Path, required=True)
    parser.add_argument("--small-model-root", type=Path, required=True)
    parser.add_argument("--contract-schema", type=Path, required=True)
    args = parser.parse_args()
    for name in vars(args):
        setattr(args, name, getattr(args, name).resolve(strict=True))

    checks: list[dict[str, Any]] = []

    def check(identifier: str, description: str, assertion: Callable[[], bool]) -> None:
        try:
            passed = bool(assertion())
            detail = "PASS" if passed else "assertion returned false"
        except Exception as error:
            passed = False
            detail = f"{type(error).__name__}: {error}"
        checks.append({"id": identifier, "description": description, "passed": passed, "detail": detail})

    result = load(args.run_root / "result.json")
    bundle_path = args.run_root / "blind-comparison-bundle.json"
    bundle = load(bundle_path)
    bundle_sha = sha256_file(bundle_path)
    page_path = args.run_root / "asr-provider-qualification-review.html"
    label_path = args.private_root / "label-map.json"
    label_map = load(label_path)
    source_handoff_path = args.source_private_root / "private-handoff.json"
    source_handoff = load(source_handoff_path)
    qa = load(args.run_root / "ui-qa/page-qa-result.json")

    expected_keys = {(sample_id, index) for sample_id, *_ in SAMPLES for index in range(8)}
    observed_keys = {(sample["sampleId"], row["binIndex"]) for sample in bundle["samples"] for row in sample["bins"]}

    check("B06-01", "accepted 0b-5 lineage", lambda: args.run_root.name == EXPECTED_RUN and args.source_run_root.name == SOURCE_RUN and not (args.source_run_root / "invalidated.json").exists() and load(args.source_run_root / "result.json")["passed"] is True and sha256_file(source_handoff_path) == HANDOFF_SHA)
    check("B06-02", "fixed audio bytes", lambda: mode(args.source_private_root) == 0o700 and all(sha256_file(args.source_private_root / row["audioFile"]) == expected[4] and mode(args.source_private_root / row["audioFile"]) == 0o600 for row, expected in zip(source_handoff["samples"], SAMPLES)))
    check("B06-03", "candidate bytes and segments", lambda: all(sha256_file(args.source_private_root / row["candidateFile"]) == expected[5] and load(args.source_private_root / row["candidateFile"])["segments"] for row, expected in zip(source_handoff["samples"], SAMPLES)))
    check("B06-04", "frozen Small model", lambda: all((args.small_model_root / name).stat().st_size == size and sha256_file(args.small_model_root / name) == digest for name, (size, digest) in MODEL_HASHES.items()) and result["baselineModel"]["revision"] == "536b0662742c02347bc0e980a01041f333bce120")
    check("B06-05", "three baseline worker outputs", lambda: len(result["baseline"]) == 3 and all(row["segmentCount"] > 0 and row["characterCount"] > 0 and sha256_file(args.private_root / "baseline" / f"{row['sampleId']}.json") == row["outputSha256"] for row in result["baseline"]))
    check("B06-06", "low-resource isolation", lambda: result["isolation"] == {"cpuCores": 8, "memoryMaxBytes": 8589934592, "swapMaxBytes": 0, "networkAfInetDenied": True, "gpuDevicesHidden": True} and all(row["resources"]["maximumResidentSetKiB"] * 1024 <= 8589934592 for row in result["baseline"]))
    check("B06-07", "baseline timestamp structure", lambda: all((lambda rows: rows and all(0 <= row["startMs"] < row["endMs"] <= 120000 for row in rows) and all(rows[index]["startMs"] >= rows[index - 1]["startMs"] for index in range(1, len(rows))))(load(args.private_root / "baseline" / f"{sample_id}.json")["segments"]) for sample_id, *_ in SAMPLES))
    check("B06-08", "same-source comparison", lambda: result["source"]["audioSha256s"] == [row[4] for row in SAMPLES] and result["source"]["candidateSha256s"] == [row[5] for row in SAMPLES])
    check("B06-09", "fixed 3x8 denominator", lambda: bundle["window"] == {"startMs": 30000, "endMs": 150000, "binDurationMs": 15000, "binsPerSample": 8} and observed_keys == expected_keys and len(observed_keys) == 24)
    check("B06-10", "Bilibili deep links", lambda: all((lambda parsed, row, sample: parsed.scheme == "https" and parsed.hostname == "www.bilibili.com" and parsed.path == f"/video/{sample['bvid']}" and parse_qs(parsed.query) == {"p": [str(sample["partIndex"])], "t": [str(row["absoluteStartMs"] // 1000)]})(urlparse(row["deepLink"]), row, sample) for sample in bundle["samples"] for row in sample["bins"]))

    mapping = {row["sampleId"]: row["candidateSide"] for row in label_map["samples"]}
    def exact_side_binding() -> bool:
        for sample in bundle["samples"]:
            candidate = load(args.source_private_root / "candidate" / f"{sample['sampleId']}.json")["segments"]
            baseline = load(args.private_root / "baseline" / f"{sample['sampleId']}.json")["segments"]
            for row in sample["bins"]:
                expected_candidate = bin_output(candidate, row["binIndex"])
                expected_baseline = bin_output(baseline, row["binIndex"])
                observed_candidate = row["sideA"] if mapping[sample["sampleId"]] == "side_a" else row["sideB"]
                observed_baseline = row["sideB"] if mapping[sample["sampleId"]] == "side_a" else row["sideA"]
                if observed_candidate != expected_candidate or observed_baseline != expected_baseline:
                    return False
        return True

    check("B06-11", "private label map and exact side binding", lambda: mode(args.private_root) == 0o700 and mode(label_path) == 0o600 and label_map["bundleSha256"] == bundle_sha and set(mapping) == {row[0] for row in SAMPLES} and set(mapping.values()) == {"side_a", "side_b"} and exact_side_binding())
    review_bytes = bundle_path.read_bytes().lower() + page_path.read_bytes().lower()
    check("B06-12", "review task has no transcription input", lambda: b"<textarea" not in page_path.read_bytes().lower() and b"machine result a" not in page_path.read_bytes().lower() and all(needle not in review_bytes for needle in REVIEW_DENY))

    review_paths = [args.run_root / "ui-qa/qa_reviewer_a.json", args.run_root / "ui-qa/qa_reviewer_b.json"]
    def valid_raw_review(path: Path) -> bool:
        review = load(path)
        keys = {(row["sampleId"], row["binIndex"]) for row in review["judgments"]}
        return review["schemaVersion"] == "v3-asr-blind-side-review/v1" and review["bundleSha256"] == bundle_sha and len(review["judgments"]) == 24 and keys == expected_keys and all("text" not in json.dumps(row).lower() for row in review["judgments"])

    check("B06-13", "blind review export contract", lambda: all(valid_raw_review(path) for path in review_paths))
    check("B06-14", "distinct review import mechanism", lambda: len({load(path)["reviewerId"] for path in review_paths}) == 2 and qa["reviewExports"][0]["judgmentCount"] == 24 and qa["reviewExports"][1]["judgmentCount"] == 24)

    schema = load(args.contract_schema)
    validator = Draft202012Validator(schema, format_checker=FormatChecker())
    finalized_root = args.private_root / "qa-finalized-contract"
    finalized = [load(finalized_root / "qualification-review-1.json"), load(finalized_root / "qualification-review-2.json"), load(finalized_root / "qualification-adjudication.json")]
    check("B06-15", "private finalization contract", lambda: mode(finalized_root) == 0o700 and all(mode(path) == 0o600 for path in finalized_root.glob("*.json")) and all(not list(validator.iter_errors(document)) for document in finalized) and finalized[-1]["summary"]["totalIndependentJudgments"] == 48 and finalized[-1]["summary"]["resolutionCount"] == 1)
    check("B06-16", "real Chrome four-viewport accessibility", lambda: qa["passed"] is True and len(qa["viewports"]) == 4 and {row["width"] for row in qa["viewports"]} == {360, 420, 768, 1280} and all(row["passed"] and sha256_file(args.run_root / row["screenshotPath"]) == row["screenshotSha256"] for row in qa["viewports"]) and qa["axe"]["serious"] == qa["axe"]["critical"] == 0 and qa["keyboard"]["assertionsPassed"] == qa["keyboard"]["assertionsTotal"] == 3)
    check("B06-17", "hashes, identity scan, and public binary boundary", lambda: bundle_sha == result["bundle"]["sha256"] and sha256_file(page_path) == result["bundle"]["pageSha256"] and sha256_file(label_path) == result["bundle"]["labelMapSha256"] and result["reviewFacingIdentityScan"]["passed"] is True and not any(path.suffix.lower() in {".wav", ".gguf", ".bin"} for path in args.run_root.rglob("*")))
    check("B06-18", "quality claim remains pending", lambda: result["humanReviewStatus"] == "pending" and result["claimsQualityPassed"] is False and all(load(path)["reviewerId"].startswith("qa_") for path in review_paths))

    summary = {"total": len(checks), "passed": sum(row["passed"] for row in checks), "failed": sum(not row["passed"] for row in checks)}
    output = {
        "schemaVersion": "v3-asr-provider-qualification-blind-material-verification/v1",
        "runId": args.run_root.name,
        "checks": checks,
        "summary": summary,
        "humanReviewStatus": "pending",
        "syntheticQaExcludedFromQualityNumerator": True,
        "passed": summary["failed"] == 0,
    }
    (args.run_root / "verification.json").write_text(json.dumps(output, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(output, indent=2))
    return 0 if output["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
