#!/usr/bin/env python3
"""Verify the public/private evidence for the V3 ASR real-speech omission."""

from __future__ import annotations

import argparse
from array import array
import hashlib
import json
import math
from pathlib import Path
import stat
import sys
import wave


EXPECTED_AUDIO = {
    "v3-asr-comparison-01": "2a11e09975733740d49f4a63ca7b3ec1a9ebc77e8e8897d770e1991d4c1beb05",
    "v3-asr-comparison-02": "63eb48d9027e1cfa09747d7261f9e2b7347cbec58daeb38b4aff09cdbd647405",
    "v3-asr-comparison-03": "f4f61c09f8fe19828fb2085ef18459179d5142596b8107cef82df6c7bf7cc97b",
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load(path: Path) -> dict:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError(f"V3_ASR_VERIFY_OBJECT_REQUIRED:{path.name}")
    return value


def rms_bins(path: Path) -> list[int]:
    with wave.open(str(path), "rb") as stream:
        if (stream.getnchannels(), stream.getsampwidth(), stream.getframerate()) != (1, 2, 16_000):
            raise ValueError("V3_ASR_VERIFY_AUDIO_FORMAT")
        result = []
        for _ in range(8):
            samples = array("h")
            samples.frombytes(stream.readframes(240_000))
            if sys.byteorder != "little":
                samples.byteswap()
            result.append(math.isqrt(sum(sample * sample for sample in samples) // len(samples)))
        return result


def inspect_candidate(path: Path) -> tuple[int, int, list[int], list[int]]:
    rows = load(path).get("segments")
    if not isinstance(rows, list) or not rows:
        raise ValueError("V3_ASR_VERIFY_TRANSCRIPT_EMPTY")
    counts = [0] * 8
    characters = [0] * 8
    previous_end = 0
    maximum = 0
    for row in rows:
        start, end, text = row.get("startMs"), row.get("endMs"), row.get("text")
        if not isinstance(start, int) or not isinstance(end, int) or not isinstance(text, str):
            raise ValueError("V3_ASR_VERIFY_SEGMENT_SHAPE")
        if start < previous_end or end <= start or end > 120_000 or end - start > 15_000 or not text.strip():
            raise ValueError("V3_ASR_VERIFY_SEGMENT_CONTRACT")
        index = min(7, int(((start + end) / 2) // 15_000))
        counts[index] += 1
        characters[index] += len(text.strip())
        maximum = max(maximum, end - start)
        previous_end = end
    return len(rows), maximum, counts, characters


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--run-root", type=Path, required=True)
    parser.add_argument("--private-root", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    args.run_root = args.run_root.resolve(strict=True)
    args.private_root = args.private_root.resolve(strict=True)
    diagnostic = load(args.run_root / "failure-diagnostic.json")
    invalidated = load(args.run_root / "invalidated.json")
    checks = []

    def add(check_id: str, passed: bool, observed: object) -> None:
        checks.append({"id": check_id, "passed": bool(passed), "observed": observed})

    add("B051A-01", diagnostic.get("sourceRunId") == "v3-2-0b-5-20260922T063133Z" and diagnostic.get("sourceHandoffSha256") == "726dae961e4bd75cb23a71c3d911138fc26b460adf246e0253d6f4359cb66c14", {"sourceRunId": diagnostic.get("sourceRunId"), "sourceHandoffSha256": diagnostic.get("sourceHandoffSha256")})
    add("B051A-02", len(diagnostic.get("samples", [])) == 3, {"sampleCount": len(diagnostic.get("samples", []))})
    sample_observations = []
    for record in diagnostic.get("samples", []):
        sample_id = record.get("sampleId")
        audio = args.private_root / "audio" / f"{sample_id}.wav"
        candidate = args.private_root / "candidate" / f"{sample_id}.json"
        metrics = args.private_root / "metrics" / f"{sample_id}.txt"
        count, maximum, bins, characters = inspect_candidate(candidate)
        rms = rms_bins(audio)
        mode_ok = all(stat.S_IMODE(path.stat().st_mode) == 0o600 for path in (audio, candidate, metrics))
        sample_observations.append({
            "sampleId": sample_id,
            "audioSha256": sha256(audio),
            "candidateSha256": sha256(candidate),
            "segmentCount": count,
            "maxSegmentDurationMs": maximum,
            "binSegmentCounts": bins,
            "binCharacterCounts": characters,
            "binPcm16Rms": rms,
            "privateModes0600": mode_ok,
            "matchesPublic": all((
                record.get("audioSha256") == sha256(audio),
                record.get("candidateSha256") == sha256(candidate),
                record.get("segmentCount") == count,
                record.get("maxSegmentDurationMs") == maximum,
                record.get("binSegmentCounts") == bins,
                record.get("binCharacterCounts") == characters,
                record.get("binPcm16Rms") == rms,
            )),
        })
    add("B051A-03", all(row["maxSegmentDurationMs"] <= 15_000 and row["matchesPublic"] for row in sample_observations), sample_observations)
    expected_empty = [{"sampleId": "v3-asr-comparison-03", "binIndex": 2, "pcm16Rms": sample_observations[2]["binPcm16Rms"][2]}]
    add("B051A-04", diagnostic.get("emptyBins") == expected_empty and invalidated.get("humanReviewAllowed") is False, diagnostic.get("emptyBins"))
    add("B051A-05", expected_empty[0]["pcm16Rms"] > 0, expected_empty)
    public_bytes = b"\n".join(path.read_bytes() for path in sorted(args.run_root.glob("*.json")))
    forbidden = [token.decode() for token in (b'"text"', b'Cookie', b'/home/administrator', b'private-handoff') if token in public_bytes]
    add("B051A-06", invalidated.get("failureCode") == "V3_ASR_QUAL_REAL_SPEECH_BIN_OMITTED" and invalidated.get("diagnosticSha256") == sha256(args.run_root / "failure-diagnostic.json") and not forbidden, {"forbidden": forbidden, "failureCode": invalidated.get("failureCode")})
    add("B051A-07", stat.S_IMODE(args.private_root.stat().st_mode) == 0o700 and all(row["privateModes0600"] for row in sample_observations), {"privateRootMode": oct(stat.S_IMODE(args.private_root.stat().st_mode))})
    add("B051A-08", diagnostic.get("passed") is False and diagnostic.get("claimsQualityPassed") is False and invalidated.get("mayEnterV3_2_0b_6") is False, {"passed": diagnostic.get("passed"), "claimsQualityPassed": diagnostic.get("claimsQualityPassed"), "mayEnterV3_2_0b_6": invalidated.get("mayEnterV3_2_0b_6")})
    passed = all(item["passed"] for item in checks)
    result = {"schemaVersion": "v3-asr-vad-failure-verification/v1", "runId": args.run_root.name, "summary": {"total": len(checks), "passed": sum(item["passed"] for item in checks), "failed": sum(not item["passed"] for item in checks)}, "checks": checks, "passed": passed}
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result["summary"] | {"passed": passed}, ensure_ascii=False))
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())
