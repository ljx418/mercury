#!/usr/bin/env python3
"""Run the isolated V3-2-0c SenseVoiceSmall feasibility spike."""

from __future__ import annotations

import argparse
import ctypes
import errno
import hashlib
import json
import os
import re
import resource
import shutil
import subprocess
import threading
import time
import urllib.request
import wave
from pathlib import Path

MODEL_URL = "https://huggingface.co/FunAudioLLM/SenseVoiceSmall-GGUF/resolve/90c1c61912018b70ada0fcc024ea24aca62f2e63/sensevoice-small-q8.gguf?download=true"
MODEL_BYTES = 254208320
MODEL_SHA = "4ae45c94422de949b387e2e0fb10d7e14e4c42c69db30c3444ecc7d4b844b7c5"
BINARY_SHA = "c41a53b0156f5c6c01a4390aee601831890d2fffe272d34499e1589e64c30edd"
VAD_SHA = "1270f2559c495f4e7b6e739541151027d360761a3fda43fc147034f5719f5479"
SAMPLES = (
    ("sample03-chunk4", "v3-asr-comparison-03.wav", "f4f61c09f8fe19828fb2085ef18459179d5142596b8107cef82df6c7bf7cc97b", 4, "6271ffeeb1f1f1d144bcc0402027c7abc5acf67b1b72c49064094511360c090b"),
    ("sample03-chunk2", "v3-asr-comparison-03.wav", "f4f61c09f8fe19828fb2085ef18459179d5142596b8107cef82df6c7bf7cc97b", 2, "e0a45bf905f458bae924496f25257cc0086675aa363afaf10463937d8c1164bf"),
    ("sample01-chunk0", "v3-asr-comparison-01.wav", "2a11e09975733740d49f4a63ca7b3ec1a9ebc77e8e8897d770e1991d4c1beb05", 0, "48eeadf590c80efbda863b7f91ab60afed45accb3d2f441c3bc3c788bb72c195"),
)
NETWORK_SYSCALLS = ("socket", "socketpair", "connect", "accept", "accept4", "bind", "listen", "sendto", "recvfrom", "sendmsg", "recvmsg", "shutdown")
SRT_TIME = re.compile(r"^(\d\d):(\d\d):(\d\d),(\d{3}) --> (\d\d):(\d\d):(\d\d),(\d{3})$")


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for block in iter(lambda: f.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def download_model(path: Path) -> str:
    if path.is_file() and path.stat().st_size == MODEL_BYTES and sha256(path) == MODEL_SHA:
        return "reused_verified"
    part = path.with_suffix(".part")
    part.unlink(missing_ok=True)
    req = urllib.request.Request(MODEL_URL, headers={"User-Agent": "Navia-V3-Route-C-Spike/1"})
    h, count = hashlib.sha256(), 0
    with urllib.request.urlopen(req, timeout=300) as response, part.open("wb") as out:
        os.chmod(part, 0o600)
        for block in iter(lambda: response.read(1024 * 1024), b""):
            count += len(block)
            if count > MODEL_BYTES:
                raise RuntimeError("model exceeded frozen byte length")
            h.update(block)
            out.write(block)
    if count != MODEL_BYTES or h.hexdigest() != MODEL_SHA:
        part.unlink(missing_ok=True)
        raise RuntimeError("model identity mismatch")
    part.replace(path)
    return "downloaded_verified"


def install_seccomp_and_limits() -> None:
    resource.setrlimit(resource.RLIMIT_AS, (8 * 1024**3, 8 * 1024**3))
    try:
        os.sched_setaffinity(0, set(range(min(8, os.cpu_count() or 1))))
    except OSError:
        pass
    lib = ctypes.CDLL("libseccomp.so.2", use_errno=True)
    lib.seccomp_init.restype = ctypes.c_void_p
    lib.seccomp_syscall_resolve_name.argtypes = [ctypes.c_char_p]
    ctx = lib.seccomp_init(ctypes.c_uint32(0x7FFF0000))  # SCMP_ACT_ALLOW
    if not ctx:
        raise OSError("seccomp_init failed")
    try:
        deny = ctypes.c_uint32(0x00050000 | errno.EPERM)  # SCMP_ACT_ERRNO
        for name in NETWORK_SYSCALLS:
            nr = lib.seccomp_syscall_resolve_name(name.encode())
            if nr < 0 or lib.seccomp_rule_add(ctx, deny, nr, 0) != 0:
                raise OSError(f"seccomp rule failed: {name}")
        if lib.seccomp_load(ctx) != 0:
            raise OSError("seccomp_load failed")
    finally:
        lib.seccomp_release(ctx)


def milliseconds(parts: tuple[str, ...]) -> int:
    h, m, s, ms = map(int, parts)
    return ((h * 60 + m) * 60 + s) * 1000 + ms


def parse_srt(text: str) -> list[dict[str, object]]:
    lines = [line.rstrip() for line in text.replace("\r\n", "\n").split("\n")]
    segments: list[dict[str, object]] = []
    i = 0
    while i < len(lines):
        if not lines[i].strip():
            i += 1
            continue
        if not lines[i].strip().isdigit() or i + 2 >= len(lines):
            raise ValueError("invalid SRT entry")
        match = SRT_TIME.match(lines[i + 1].strip())
        if not match:
            raise ValueError("invalid SRT timestamp")
        start = milliseconds(match.groups()[:4])
        end = milliseconds(match.groups()[4:])
        i += 2
        body = []
        while i < len(lines) and lines[i].strip():
            body.append(lines[i].strip())
            i += 1
        text_value = " ".join(body).strip()
        if not text_value or not (0 <= start < end <= 15000):
            raise ValueError("empty text or timestamp outside window")
        segments.append({"startMs": start, "endMs": end, "text": text_value})
    if not segments:
        raise ValueError("no SRT segments")
    if any(a["endMs"] > b["startMs"] for a, b in zip(segments, segments[1:])):
        raise ValueError("overlapping SRT segments")
    return segments


def monitor_rss(pid: int, stop: threading.Event, peak: list[int]) -> None:
    while not stop.wait(0.01):
        try:
            for line in Path(f"/proc/{pid}/status").read_text().splitlines():
                if line.startswith("VmRSS:"):
                    peak[0] = max(peak[0], int(line.split()[1]) * 1024)
        except (FileNotFoundError, ProcessLookupError):
            return


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--private-root", type=Path, required=True)
    parser.add_argument("--public-root", type=Path, required=True)
    parser.add_argument("--source-root", type=Path, required=True)
    parser.add_argument("--runtime-root", type=Path, required=True)
    parser.add_argument("--asset-root", type=Path, required=True)
    args = parser.parse_args()
    args.private_root.mkdir(parents=True, exist_ok=False, mode=0o700)
    args.public_root.mkdir(parents=True, exist_ok=False)
    assets = args.private_root / "assets"
    work = args.private_root / "work"
    assets.mkdir(mode=0o700); work.mkdir(mode=0o700)
    binary = args.runtime_root.resolve(strict=True) / "llama-funasr-sensevoice"
    vad = args.asset_root.resolve(strict=True) / "fsmn-vad.gguf"
    if sha256(binary) != BINARY_SHA or sha256(vad) != VAD_SHA:
        raise RuntimeError("runtime or VAD identity mismatch")
    model = assets / "sensevoice-small-q8.gguf"
    disposition = download_model(model)
    os.chmod(model, 0o600)
    public_samples = []
    private_samples = []
    for sample_id, source_name, source_sha, chunk_index, payload_sha in SAMPLES:
        source = args.source_root.resolve(strict=True) / source_name
        if sha256(source) != source_sha or (source.stat().st_mode & 0o077):
            raise RuntimeError(f"source identity or mode mismatch: {sample_id}")
        chunk = work / f"{sample_id}.wav"
        with wave.open(str(source), "rb") as src:
            if (src.getnchannels(), src.getsampwidth(), src.getframerate()) != (1, 2, 16000):
                raise RuntimeError("source audio format mismatch")
            src.setpos(chunk_index * 240000)
            payload = src.readframes(240000)
            if len(payload) != 480000 or hashlib.sha256(payload).hexdigest() != payload_sha:
                raise RuntimeError("chunk payload identity mismatch")
            with wave.open(str(chunk), "wb") as dst:
                dst.setparams((1, 2, 16000, 240000, "NONE", "not compressed"))
                dst.writeframes(payload)
        os.chmod(chunk, 0o600)
        cmd = [str(binary), "-m", str(model), "--vad", str(vad), "--vad-maxseg", "15000", "-a", str(chunk), "--backend", "cpu", "--srt"]
        started = time.monotonic()
        proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, preexec_fn=install_seccomp_and_limits)
        stop, peak = threading.Event(), [0]
        thread = threading.Thread(target=monitor_rss, args=(proc.pid, stop, peak), daemon=True); thread.start()
        stdout, stderr = proc.communicate(timeout=120)
        stop.set(); thread.join()
        elapsed_ms = round((time.monotonic() - started) * 1000)
        if proc.returncode != 0:
            raise RuntimeError(f"inference failed for {sample_id}: exit {proc.returncode}")
        segments = parse_srt(stdout)
        (work / f"{sample_id}.srt").write_text(stdout, encoding="utf-8")
        (work / f"{sample_id}.stderr").write_text(stderr, encoding="utf-8")
        os.chmod(work / f"{sample_id}.srt", 0o600); os.chmod(work / f"{sample_id}.stderr", 0o600)
        transcript_hash = hashlib.sha256("\n".join(str(s["text"]) for s in segments).encode()).hexdigest()
        public_samples.append({"sampleKey": sample_id, "chunkIndex": chunk_index, "segmentCount": len(segments), "nonEmpty": True, "timestampsValid": True, "elapsedMs": elapsed_ms, "peakRssBytes": peak[0], "wavSha256": sha256(chunk), "transcriptSha256": transcript_hash})
        private_samples.append({"sampleKey": sample_id, "segments": segments, "stdoutSha256": hashlib.sha256(stdout.encode()).hexdigest(), "stderrSha256": hashlib.sha256(stderr.encode()).hexdigest()})
    asset_bytes = binary.stat().st_size + vad.stat().st_size + model.stat().st_size
    feasible = len(public_samples) == 3 and all(x["nonEmpty"] and x["timestampsValid"] and x["peakRssBytes"] <= 8 * 1024**3 for x in public_samples) and asset_bytes <= 512 * 1024**2
    public = {"schemaVersion": "v3-asr-route-c-spike-result/v1", "candidateId": "sensevoice-small-q8-cpu-spike-v1", "conclusion": "SPIKE_FEASIBLE" if feasible else "SPIKE_FAILED", "modelDisposition": disposition, "networkIsolation": {"kind": "seccomp_deny_network_syscalls", "syscalls": list(NETWORK_SYSCALLS)}, "assetBytes": asset_bytes, "samples": public_samples, "productionQualified": False}
    private = {"schemaVersion": "v3-asr-route-c-private-result/v1", "samples": private_samples}
    (args.public_root / "spike-result.json").write_text(json.dumps(public, indent=2, sort_keys=True) + "\n")
    private_path = args.private_root / "private-result.json"; private_path.write_text(json.dumps(private, ensure_ascii=False, indent=2, sort_keys=True) + "\n"); os.chmod(private_path, 0o600)
    for path in work.glob("*"):
        path.unlink()
    work.rmdir()
    return 0 if feasible else 2


if __name__ == "__main__":
    raise SystemExit(main())
