#!/usr/bin/env python3
"""Private V3-2 discovery probe for real audio and offline ASR viability."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import stat
import subprocess
import tempfile
from typing import Any
from urllib.parse import urlparse

from faster_whisper import WhisperModel


COOKIE_NAMES = {
    "DedeUserID",
    "DedeUserID__ckMd5",
    "SESSDATA",
    "b_nut",
    "bili_jct",
    "buvid3",
    "buvid4",
    "buvid_fp",
    "sid",
}
BVID_PATTERN = re.compile(r"^BV[A-Za-z0-9]+$")


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
    path.write_text(json.dumps(value, ensure_ascii=True, indent=2) + "\n", encoding="utf-8")
    path.chmod(stat.S_IRUSR | stat.S_IWUSR)


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
    names = {str(row["name"]) for row in selected}
    if names != COOKIE_NAMES or "SESSDATA" not in names:
        raise ValueError("Authorized seed does not match the frozen nine-name registry")
    return selected, raw_values


def write_netscape_cookie_file(path: Path, rows: list[dict[str, Any]]) -> None:
    lines = ["# Netscape HTTP Cookie File", "# Private disposable V3-2 probe input"]
    for row in sorted(rows, key=lambda value: str(value["name"])):
        expiry = int(float(row.get("expirationDate", 0) or 0))
        secure = "TRUE" if row.get("secure") is True else "FALSE"
        cookie_path = str(row.get("path") or "/")
        lines.append(
            "\t".join(
                [
                    ".bilibili.com",
                    "TRUE",
                    cookie_path,
                    secure,
                    str(expiry),
                    str(row["name"]),
                    str(row["value"]),
                ]
            )
        )
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")
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


def validate_candidates(document: Any) -> list[dict[str, str]]:
    rows = document.get("candidates") if isinstance(document, dict) else None
    if not isinstance(rows, list) or not rows:
        raise ValueError("At least one ASR candidate is required")
    candidates: list[dict[str, str]] = []
    seen: set[str] = set()
    for row in rows:
        bvid = str(row.get("bvid", ""))
        url = str(row.get("url", ""))
        parsed = urlparse(url)
        if not BVID_PATTERN.fullmatch(bvid):
            raise ValueError("Invalid candidate BVID")
        if parsed.scheme != "https" or parsed.hostname != "www.bilibili.com" or f"/video/{bvid}" not in parsed.path:
            raise ValueError("Candidate URL must be a canonical Bilibili video URL")
        if bvid in seen:
            raise ValueError("Candidate BVIDs must be unique")
        seen.add(bvid)
        candidates.append(
            {
                "bvid": bvid,
                "url": url,
                "pageObservationRunId": str(row.get("pageObservationRunId", "")),
            }
        )
    return candidates


def scan_for_raw_values(root: Path, raw_values: list[bytes]) -> dict[str, Any]:
    scanned_files = 0
    scanned_bytes = 0
    hits: list[dict[str, Any]] = []
    needles = [value for value in raw_values if len(value) >= 6]
    for path in sorted(root.rglob("*")):
        if not path.is_file():
            continue
        data = path.read_bytes()
        scanned_files += 1
        scanned_bytes += len(data)
        for index, needle in enumerate(needles):
            if needle in data:
                hits.append({"path": path.relative_to(root).as_posix(), "needleIndex": index})
    return {
        "scannedFiles": scanned_files,
        "scannedBytes": scanned_bytes,
        "hitCount": len(hits),
        "hits": hits,
        "passed": not hits,
    }


def probe_candidate(
    candidate: dict[str, str],
    work_root: Path,
    cookie_file: Path,
    yt_dlp: Path,
    ffmpeg: Path,
    ffprobe: Path,
    model: WhisperModel,
) -> dict[str, Any]:
    candidate_root = work_root / candidate["bvid"]
    candidate_root.mkdir(mode=0o700)
    output_template = str(candidate_root / "source.%(ext)s")
    download = run_checked(
        [
            str(yt_dlp),
            "--ignore-config",
            "--no-plugin-dirs",
            "--no-update",
            "--no-playlist",
            "--cookies",
            str(cookie_file),
            "--format",
            "ba/b",
            "--concurrent-fragments",
            "1",
            "--retries",
            "1",
            "--fragment-retries",
            "1",
            "--socket-timeout",
            "30",
            "--no-write-comments",
            "--no-write-info-json",
            "--no-write-thumbnail",
            "--no-write-subs",
            "--no-write-auto-subs",
            "--quiet",
            "--output",
            output_template,
            candidate["url"],
        ],
        timeout_seconds=600,
    )
    source_files = [path for path in candidate_root.glob("source.*") if path.is_file() and not path.name.endswith(".part")]
    if download.returncode != 0 or len(source_files) != 1:
        return {
            **candidate,
            "passed": False,
            "failureCode": "V3_ASR_AUDIO_DOWNLOAD_FAILED",
            "downloadExitCode": download.returncode,
            "downloadStderrSha256": sha256_bytes(download.stderr),
        }

    source_path = source_files[0]
    segment_path = candidate_root / "segment.wav"
    trim = run_checked(
        [
            str(ffmpeg),
            "-nostdin",
            "-hide_banner",
            "-loglevel",
            "error",
            "-protocol_whitelist",
            "file,pipe",
            "-ss",
            "30",
            "-t",
            "150",
            "-i",
            str(source_path),
            "-vn",
            "-ac",
            "1",
            "-ar",
            "16000",
            "-c:a",
            "pcm_s16le",
            "-y",
            str(segment_path),
        ],
        timeout_seconds=180,
    )
    source_sha256 = sha256_file(source_path)
    source_size = source_path.stat().st_size
    source_path.unlink(missing_ok=True)
    if trim.returncode != 0 or not segment_path.exists():
        return {
            **candidate,
            "passed": False,
            "failureCode": "V3_ASR_AUDIO_TRIM_FAILED",
            "downloadExitCode": download.returncode,
            "sourceSha256": source_sha256,
            "sourceBytes": source_size,
            "trimExitCode": trim.returncode,
            "trimStderrSha256": sha256_bytes(trim.stderr),
        }

    duration_probe = run_checked(
        [
            str(ffprobe),
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            str(segment_path),
        ],
        timeout_seconds=30,
    )
    try:
        duration_seconds = float(duration_probe.stdout.decode("utf-8").strip())
    except ValueError:
        duration_seconds = 0.0
    segment_sha256 = sha256_file(segment_path)
    segment_bytes = segment_path.stat().st_size

    segments_iterator, info = model.transcribe(
        str(segment_path),
        beam_size=1,
        vad_filter=True,
        vad_parameters={"min_silence_duration_ms": 500},
        condition_on_previous_text=False,
    )
    transcript_parts: list[str] = []
    segment_count = 0
    speech_seconds = 0.0
    for segment in segments_iterator:
        text = segment.text.strip()
        if not text:
            continue
        transcript_parts.append(text)
        segment_count += 1
        speech_seconds += max(0.0, float(segment.end) - float(segment.start))
    transcript = "\n".join(transcript_parts)
    segment_path.unlink(missing_ok=True)
    passed = duration_seconds >= 115 and segment_count >= 5 and len(transcript) >= 50 and speech_seconds >= 20
    return {
        **candidate,
        "passed": passed,
        "failureCode": None if passed else "V3_ASR_SPEECH_EVIDENCE_INSUFFICIENT",
        "downloadExitCode": download.returncode,
        "sourceSha256": source_sha256,
        "sourceBytes": source_size,
        "trimExitCode": trim.returncode,
        "segmentSha256": segment_sha256,
        "segmentBytes": segment_bytes,
        "durationSeconds": round(duration_seconds, 3),
        "asr": {
            "language": info.language,
            "languageProbability": round(float(info.language_probability), 6),
            "segmentCount": segment_count,
            "speechSeconds": round(speech_seconds, 3),
            "characterCount": len(transcript),
            "transcriptSha256": sha256_bytes(transcript.encode("utf-8")),
        },
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--candidates", type=Path, required=True)
    parser.add_argument("--cookie-seed", type=Path, required=True)
    parser.add_argument("--yt-dlp", type=Path, required=True)
    parser.add_argument("--ffmpeg", type=Path, default=Path("/usr/bin/ffmpeg"))
    parser.add_argument("--ffprobe", type=Path, default=Path("/usr/bin/ffprobe"))
    parser.add_argument("--model", type=Path, required=True)
    parser.add_argument("--run-root", type=Path, required=True)
    parser.add_argument("--bvid")
    args = parser.parse_args()

    candidates = validate_candidates(json.loads(args.candidates.read_text(encoding="utf-8")))
    if args.bvid:
        candidates = [candidate for candidate in candidates if candidate["bvid"] == args.bvid]
        if not candidates:
            raise ValueError("Requested BVID is absent from candidate registry")
    cookie_rows, raw_values = load_cookie_rows(args.cookie_seed)
    for required_path in (args.yt_dlp, args.ffmpeg, args.ffprobe, args.model):
        if not required_path.exists():
            raise FileNotFoundError(f"Required frozen dependency is missing: {required_path.name}")

    args.run_root.mkdir(parents=True, exist_ok=False, mode=0o700)
    work_parent = args.run_root / "private-work"
    work_parent.mkdir(mode=0o700)
    results: list[dict[str, Any]] = []
    model = WhisperModel(str(args.model), device="cpu", compute_type="int8", local_files_only=True)
    try:
        with tempfile.TemporaryDirectory(prefix="credential-", dir=work_parent) as credential_dir_name:
            cookie_file = Path(credential_dir_name) / "cookies.txt"
            write_netscape_cookie_file(cookie_file, cookie_rows)
            for index, candidate in enumerate(candidates, start=1):
                print(f"[{index}/{len(candidates)}] {candidate['bvid']}", flush=True)
                candidate_result = probe_candidate(
                    candidate,
                    work_parent,
                    cookie_file,
                    args.yt_dlp,
                    args.ffmpeg,
                    args.ffprobe,
                    model,
                )
                results.append(candidate_result)
                shutil.rmtree(work_parent / candidate["bvid"], ignore_errors=True)
    finally:
        shutil.rmtree(work_parent, ignore_errors=True)

    summary = {
        "total": len(results),
        "passed": sum(1 for result in results if result["passed"]),
        "failed": sum(1 for result in results if not result["passed"]),
    }
    output = {
        "schemaVersion": "v3-asr-audio-probe-result/v1",
        "evidenceClass": "private_candidate_discovery",
        "segmentWindow": {"startSeconds": 30, "durationSeconds": 150},
        "thresholds": {"durationSeconds": 115, "segmentCount": 5, "characterCount": 50, "speechSeconds": 20},
        "dependencies": {
            "ytDlpSha256": sha256_file(args.yt_dlp),
            "ffmpegSha256": sha256_file(args.ffmpeg),
            "ffprobeSha256": sha256_file(args.ffprobe),
            "modelFileSet": sorted(
                {path.relative_to(args.model).as_posix(): sha256_file(path) for path in args.model.rglob("*") if path.is_file()}.items()
            ),
        },
        "summary": summary,
        "results": results,
        "cleanup": {
            "cookieFileDeleted": True,
            "sourceMediaDeleted": True,
            "segmentAudioDeleted": True,
            "privateWorkDeleted": not work_parent.exists(),
        },
    }
    write_json(args.run_root / "result.json", output)
    secret_scan = scan_for_raw_values(args.run_root, raw_values)
    write_json(args.run_root / "secret-scan.json", secret_scan)
    passed = summary["failed"] == 0 and secret_scan["passed"] and output["cleanup"]["privateWorkDeleted"]
    print(json.dumps({"summary": summary, "secretScan": secret_scan, "cleanup": output["cleanup"], "passed": passed}))
    return 0 if passed else 2


if __name__ == "__main__":
    raise SystemExit(main())
