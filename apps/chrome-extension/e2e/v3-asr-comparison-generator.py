#!/usr/bin/env python3
"""Generate private, real-audio V3-2 ASR blind-comparison materials."""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
import shutil
import stat
import subprocess
import tempfile
from typing import Any
from urllib.parse import urlencode

from faster_whisper import WhisperModel


COOKIE_NAMES = {
    "DedeUserID", "DedeUserID__ckMd5", "SESSDATA", "b_nut", "bili_jct",
    "buvid3", "buvid4", "buvid_fp", "sid",
}
BVID_PATTERN = re.compile(r"^BV[A-Za-z0-9]+$")
WINDOW_START_SECONDS = 30
WINDOW_DURATION_SECONDS = 120
BIN_SECONDS = 15
MODEL_FILES = ("config.json", "model.bin", "tokenizer.json", "vocabulary.txt")


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    path.chmod(stat.S_IRUSR | stat.S_IWUSR)


def run_checked(command: list[str], timeout_seconds: int) -> subprocess.CompletedProcess[bytes]:
    return subprocess.run(
        command,
        stdin=subprocess.DEVNULL,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
        timeout=timeout_seconds,
    )


def load_cookie_rows(path: Path) -> tuple[list[dict[str, Any]], list[bytes]]:
    parsed = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(parsed, list):
        raise ValueError("Authorized Bilibili session seed must be a JSON array")
    selected: list[dict[str, Any]] = []
    raw_values: list[bytes] = []
    for row in parsed:
        if not isinstance(row, dict) or row.get("name") not in COOKIE_NAMES:
            continue
        value = row.get("value")
        if not isinstance(value, str) or not value:
            continue
        domain = str(row.get("domain", "")).lower().lstrip(".")
        if domain != "bilibili.com" and not domain.endswith(".bilibili.com"):
            raise ValueError("Authorized seed contains a non-Bilibili domain")
        selected.append(row)
        raw_values.append(value.encode("utf-8"))
    if {str(row["name"]) for row in selected} != COOKIE_NAMES:
        raise ValueError("Authorized seed does not match the frozen nine-name registry")
    return selected, raw_values


def write_netscape_cookie_file(path: Path, rows: list[dict[str, Any]]) -> None:
    lines = ["# Netscape HTTP Cookie File", "# Private disposable V3-2 comparison input"]
    for row in sorted(rows, key=lambda item: str(item["name"])):
        lines.append("\t".join([
            ".bilibili.com", "TRUE", str(row.get("path") or "/"),
            "TRUE" if row.get("secure") is True else "FALSE",
            str(int(float(row.get("expirationDate", 0) or 0))),
            str(row["name"]), str(row["value"]),
        ]))
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    path.chmod(stat.S_IRUSR | stat.S_IWUSR)


def validate_model(model_root: Path, expected: dict[str, Any]) -> None:
    rows = []
    for name in MODEL_FILES:
        path = model_root / name
        if not path.is_file():
            raise FileNotFoundError(f"Frozen model file missing: {name}")
        rows.append({"path": name, "byteLength": path.stat().st_size, "sha256": sha256_file(path)})
    if rows != expected.get("files"):
        raise ValueError(f"Frozen model file bytes mismatch: {expected['modelId']}")
    material = "".join(f"{row['path']}\t{row['byteLength']}\t{row['sha256']}\n" for row in rows)
    if sha256_bytes(material.encode("utf-8")) != expected["fileSetSha256"]:
        raise ValueError(f"Frozen model file set mismatch: {expected['modelId']}")


def validate_candidates(document: Any) -> list[dict[str, Any]]:
    rows = document.get("candidates") if isinstance(document, dict) else None
    if not isinstance(rows, list) or len(rows) != 3:
        raise ValueError("Exactly three comparison candidates are required")
    seen: set[str] = set()
    for row in rows:
        bvid = str(row.get("bvid", ""))
        if not BVID_PATTERN.fullmatch(bvid) or bvid in seen:
            raise ValueError("Comparison BVIDs must be valid and unique")
        if row.get("partIndex") != 1 or not str(row.get("cid", "")).isdigit():
            raise ValueError("Comparison part identity is invalid")
        seen.add(bvid)
    return rows


def transcribe(model: WhisperModel, audio_path: Path) -> dict[str, Any]:
    iterator, info = model.transcribe(
        str(audio_path), beam_size=1, vad_filter=True,
        vad_parameters={"min_silence_duration_ms": 500},
        condition_on_previous_text=False,
    )
    segments = []
    for index, segment in enumerate(iterator, start=1):
        text = segment.text.strip()
        if not text:
            continue
        segments.append({
            "segmentId": f"seg_{index:03d}",
            "startMs": int(round(float(segment.start) * 1000)),
            "endMs": int(round(float(segment.end) * 1000)),
            "text": text,
            "textSha256": sha256_bytes(text.encode("utf-8")),
            "avgLogprob": round(float(segment.avg_logprob), 6),
        })
    if not segments:
        raise RuntimeError("ASR produced no segments")
    return {
        "language": info.language,
        "languageProbability": round(float(info.language_probability), 6),
        "segments": segments,
    }


def output_for_bin(segments: list[dict[str, Any]], bin_index: int) -> dict[str, Any]:
    start_ms = bin_index * BIN_SECONDS * 1000
    end_ms = start_ms + BIN_SECONDS * 1000
    selected = [
        segment for segment in segments
        if start_ms <= (segment["startMs"] + segment["endMs"]) / 2 < end_ms
    ]
    text = " ".join(segment["text"] for segment in selected).strip()
    return {
        "text": text,
        "textSha256": sha256_bytes(text.encode("utf-8")),
        "segmentIds": [segment["segmentId"] for segment in selected],
    }


def scan_raw_values(root: Path, raw_values: list[bytes]) -> dict[str, Any]:
    hits = []
    scanned_files = 0
    scanned_bytes = 0
    for path in sorted(root.rglob("*")):
        if not path.is_file():
            continue
        data = path.read_bytes()
        scanned_files += 1
        scanned_bytes += len(data)
        for index, value in enumerate(raw_values):
            if len(value) >= 6 and value in data:
                hits.append({"path": path.relative_to(root).as_posix(), "needleIndex": index})
    return {"scannedFiles": scanned_files, "scannedBytes": scanned_bytes, "hitCount": len(hits), "passed": not hits}


def render_html(template_path: Path, bundle: dict[str, Any], bundle_sha256: str) -> str:
    presentation = {
        "schemaVersion": "v3-asr-comparison-presentation/v1",
        "bundleSha256": bundle_sha256,
        "runId": bundle["runId"],
        "window": bundle["window"],
        "samples": [
            {
                "sampleId": sample["sampleId"], "bvid": sample["bvid"], "cid": sample["cid"],
                "partIndex": sample["partIndex"], "title": sample["title"], "bins": sample["bins"],
                "labelMap": sample["labelMap"],
            }
            for sample in bundle["samples"]
        ],
    }
    encoded = json.dumps(presentation, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c")
    template = template_path.read_text(encoding="utf-8")
    if "__NAVIA_COMPARISON_BUNDLE__" not in template:
        raise ValueError("Comparison HTML template placeholder is missing")
    return template.replace("__NAVIA_COMPARISON_BUNDLE__", encoded)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--candidates", type=Path, required=True)
    parser.add_argument("--cookie-seed", type=Path, required=True)
    parser.add_argument("--yt-dlp", type=Path, required=True)
    parser.add_argument("--ffmpeg", type=Path, default=Path("/usr/bin/ffmpeg"))
    parser.add_argument("--ffprobe", type=Path, default=Path("/usr/bin/ffprobe"))
    parser.add_argument("--production-model", type=Path, required=True)
    parser.add_argument("--baseline-model", type=Path, required=True)
    parser.add_argument("--model-manifest", type=Path, required=True)
    parser.add_argument("--html-template", type=Path, required=True)
    parser.add_argument("--run-root", type=Path, required=True)
    args = parser.parse_args()

    candidates = validate_candidates(json.loads(args.candidates.read_text(encoding="utf-8")))
    manifest = json.loads(args.model_manifest.read_text(encoding="utf-8"))
    validate_model(args.production_model, manifest["production"])
    validate_model(args.baseline_model, manifest["baseline"])
    for required in (args.yt_dlp, args.ffmpeg, args.ffprobe, args.html_template):
        if not required.is_file():
            raise FileNotFoundError(f"Required input is missing: {required.name}")
    rows, raw_values = load_cookie_rows(args.cookie_seed)
    args.run_root.mkdir(parents=True, exist_ok=False, mode=0o700)
    work_root = args.run_root / "private-work"
    work_root.mkdir(mode=0o700)
    sample_work: list[dict[str, Any]] = []
    try:
        with tempfile.TemporaryDirectory(prefix="credential-", dir=work_root) as credential_dir:
            cookie_file = Path(credential_dir) / "cookies.txt"
            write_netscape_cookie_file(cookie_file, rows)
            for index, candidate in enumerate(candidates, start=1):
                print(f"[media {index}/3] {candidate['bvid']}", flush=True)
                root = work_root / candidate["bvid"]
                root.mkdir(mode=0o700)
                template = str(root / "source.%(ext)s")
                download = run_checked([
                    str(args.yt_dlp), "--ignore-config", "--no-plugin-dirs", "--no-update", "--no-playlist",
                    "--cookies", str(cookie_file), "--format", "ba/b", "--concurrent-fragments", "1",
                    "--retries", "1", "--fragment-retries", "1", "--socket-timeout", "30",
                    "--no-write-comments", "--no-write-info-json", "--no-write-thumbnail", "--no-write-subs",
                    "--no-write-auto-subs", "--quiet", "--output", template, str(candidate["url"]),
                ], 600)
                sources = [path for path in root.glob("source.*") if path.is_file() and not path.name.endswith(".part")]
                if download.returncode != 0 or len(sources) != 1:
                    raise RuntimeError(f"Media download failed for {candidate['bvid']}: {download.returncode}")
                source = sources[0]
                audio = root / "window.wav"
                trim = run_checked([
                    str(args.ffmpeg), "-nostdin", "-hide_banner", "-loglevel", "error",
                    "-protocol_whitelist", "file,pipe", "-ss", str(WINDOW_START_SECONDS),
                    "-t", str(WINDOW_DURATION_SECONDS), "-i", str(source), "-vn", "-ac", "1", "-ar", "16000",
                    "-c:a", "pcm_s16le", "-y", str(audio),
                ], 180)
                if trim.returncode != 0 or not audio.is_file():
                    raise RuntimeError(f"Audio trim failed for {candidate['bvid']}: {trim.returncode}")
                duration = run_checked([
                    str(args.ffprobe), "-v", "error", "-show_entries", "format=duration",
                    "-of", "default=noprint_wrappers=1:nokey=1", str(audio),
                ], 30)
                seconds = float(duration.stdout.decode("utf-8").strip())
                if not 119.5 <= seconds <= 120.5:
                    raise RuntimeError(f"Unexpected audio duration for {candidate['bvid']}: {seconds}")
                sample_work.append({
                    **candidate, "root": root, "source": source, "audio": audio,
                    "sourceSha256": sha256_file(source), "audioWindowSha256": sha256_file(audio),
                })

            outputs: dict[str, dict[str, Any]] = {}
            for model_key, model_path in (("production_small", args.production_model), ("independent_base", args.baseline_model)):
                print(f"[model] {model_key}", flush=True)
                model = WhisperModel(str(model_path), device="cpu", compute_type="int8", local_files_only=True)
                for index, sample in enumerate(sample_work, start=1):
                    print(f"[asr {model_key} {index}/3] {sample['bvid']}", flush=True)
                    outputs.setdefault(sample["bvid"], {})[model_key] = transcribe(model, sample["audio"])
                del model

        samples = []
        for index, sample in enumerate(sample_work):
            label_map = (
                {"candidateA": "production_small", "candidateB": "independent_base"}
                if index % 2 == 0 else
                {"candidateA": "independent_base", "candidateB": "production_small"}
            )
            bins = []
            for bin_index in range(WINDOW_DURATION_SECONDS // BIN_SECONDS):
                absolute_start = (WINDOW_START_SECONDS + bin_index * BIN_SECONDS) * 1000
                params = {"p": sample["partIndex"], "t": absolute_start // 1000}
                model_outputs = outputs[sample["bvid"]]
                bins.append({
                    "binIndex": bin_index,
                    "absoluteStartMs": absolute_start,
                    "absoluteEndMs": absolute_start + BIN_SECONDS * 1000,
                    "deepLink": f"https://www.bilibili.com/video/{sample['bvid']}?{urlencode(params)}",
                    "candidateA": output_for_bin(model_outputs[label_map["candidateA"]]["segments"], bin_index),
                    "candidateB": output_for_bin(model_outputs[label_map["candidateB"]]["segments"], bin_index),
                })
            samples.append({
                "sampleId": sample["sampleId"], "bvid": sample["bvid"], "cid": str(sample["cid"]),
                "partIndex": sample["partIndex"], "title": sample["title"],
                "sourceSha256": sample["sourceSha256"], "audioWindowSha256": sample["audioWindowSha256"],
                "labelMap": label_map,
                "detectedLanguage": outputs[sample["bvid"]]["production_small"]["language"], "bins": bins,
            })

        shutil.rmtree(work_root)
        now = datetime.now(timezone.utc).replace(microsecond=0)
        profile = manifest["commonProfile"]
        model_ref = lambda item: {
            "modelId": item["modelId"], "repository": item["repository"], "revision": item["revision"],
            "fileSetSha256": item["fileSetSha256"], **profile,
        }
        bundle = {
            "schemaVersion": "v3-asr-comparison-bundle/v1", "runId": args.run_root.name,
            "createdAt": now.isoformat().replace("+00:00", "Z"),
            "window": {"startMs": 30000, "endMs": 150000, "durationMs": 120000, "binDurationMs": 15000, "binCount": 8},
            "models": {"production": model_ref(manifest["production"]), "baseline": model_ref(manifest["baseline"])},
            "samples": samples,
            "cleanup": {"cookieFileDeleted": True, "sourceMediaDeleted": True, "audioWindowDeleted": True, "privateWorkDeleted": True},
            "secretScan": {"hitCount": 0, "passed": True},
        }
        bundle_path = args.run_root / "comparison-bundle.private.json"
        write_json(bundle_path, bundle)
        bundle_sha256 = sha256_file(bundle_path)
        html_path = args.run_root / "asr-comparison-review.html"
        html_path.write_text(render_html(args.html_template, bundle, bundle_sha256), encoding="utf-8")
        html_path.chmod(stat.S_IRUSR | stat.S_IWUSR)
        scan = scan_raw_values(args.run_root, raw_values)
        if not scan["passed"]:
            raise RuntimeError("Authorized Cookie value entered comparison output")
        summary = {
            "schemaVersion": "v3-asr-comparison-generation-summary/v1", "runId": bundle["runId"],
            "bundleSha256": bundle_sha256, "reviewPageSha256": sha256_file(html_path),
            "sampleCount": len(samples), "binCount": sum(len(sample["bins"]) for sample in samples),
            "modelInferenceCount": len(samples) * 2,
            "candidateCharacterCounts": {
                sample["bvid"]: {
                    "candidateA": sum(len(item["candidateA"]["text"]) for item in sample["bins"]),
                    "candidateB": sum(len(item["candidateB"]["text"]) for item in sample["bins"]),
                } for sample in samples
            },
            "cleanup": bundle["cleanup"], "secretScan": scan, "passed": True,
        }
        write_json(args.run_root / "generation-summary.json", summary)
        print(json.dumps(summary, ensure_ascii=False, indent=2))
        return 0
    except Exception:
        shutil.rmtree(work_root, ignore_errors=True)
        raise


if __name__ == "__main__":
    raise SystemExit(main())
