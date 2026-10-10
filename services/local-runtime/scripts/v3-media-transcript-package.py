#!/usr/bin/env python3
"""Prepare and seal a deterministic, secret-free V3-2 production candidate."""

from __future__ import annotations

import argparse
import gzip
import hashlib
import io
import json
import tarfile
from pathlib import Path

from jsonschema import Draft202012Validator


FORBIDDEN = (b"SESSDATA", b"bili_jct", b"Cookie:", b"Bearer ", b"myCk.txt", b"/mnt/c/Users", b"\\Users\\")


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write_json(path: Path, value: object) -> None:
    path.write_text(json.dumps(value, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def deterministic_tar(paths: list[tuple[Path, str]], output: Path) -> None:
    memory = io.BytesIO()
    with tarfile.open(fileobj=memory, mode="w", format=tarfile.PAX_FORMAT) as archive:
        for source, name in sorted(paths, key=lambda item: item[1]):
            payload = source.read_bytes()
            info = tarfile.TarInfo(name)
            info.size, info.mode, info.mtime, info.uid, info.gid = len(payload), 0o600, 0, 0, 0
            info.uname = info.gname = ""
            archive.addfile(info, io.BytesIO(payload))
    with output.open("wb") as raw:
        with gzip.GzipFile(filename="", mode="wb", fileobj=raw, mtime=0) as zipped:
            zipped.write(memory.getvalue())


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--run-root", required=True, type=Path)
    parser.add_argument("--schema", required=True, type=Path)
    parser.add_argument("--dependency-manifest", required=True, type=Path)
    parser.add_argument("--model-manifest", required=True, type=Path)
    parser.add_argument("--build-tree-sha256", required=True)
    parser.add_argument("--mode", choices=("prepare", "seal"), required=True)
    args = parser.parse_args()
    root = args.run_root.resolve()
    index = json.loads((root / "artifact-index.json").read_text(encoding="utf-8"))
    if args.mode == "prepare":
        public_paths = []
        private_entries = []
        for item in index["files"]:
            source = root / item["path"]
            if item["visibility"] == "public":
                payload = source.read_bytes()
                if any(needle in payload for needle in FORBIDDEN):
                    raise RuntimeError(f"V3-2-7 public secret/path hit: {item['path']}")
                public_paths.append((source, item["path"]))
            else:
                private_entries.append({"opaqueId": hashlib.sha256(item["path"].encode()).hexdigest(), "bytes": item["bytes"], "sha256": item["sha256"]})
        private_index = {"schemaVersion": "v3-media-private-index/v1", "runId": root.name, "count": len(private_entries), "entries": private_entries}
        write_json(root / "private-index.json", private_index)
        deterministic_tar(public_paths, root / "public-payload.tar.gz")
        print(json.dumps({"publicPackageSha256": digest(root / "public-payload.tar.gz"), "privateIndexSha256": digest(root / "private-index.json")}))
        return 0

    verification = json.loads((root / "verification-result.json").read_text(encoding="utf-8"))
    if not verification["passed"]:
        raise RuntimeError("V3-2-7 verification is not passing")
    ui_root = next((root / "ui/runs").iterdir()) / "public"
    candidate = {
        "schemaVersion": "v3-media-transcript-exit-candidate/v1",
        "candidateId": root.name.replace("v3-2-production-", "v3-2-exit-"),
        "runId": root.name,
        "buildTreeSha256": args.build_tree_sha256,
        "dependencyManifestSha256": digest(args.dependency_manifest),
        "modelManifestSha256": digest(args.model_manifest),
        "sampleRegistrySha256": digest(root / "route/sample-registry-v5.json"),
        "sampleCount": 12,
        "classificationCounts": verification["classificationCounts"],
        "samples": verification["samples"],
        "uiAcceptanceSha256": digest(ui_root / "product-ui-acceptance.json"),
        "faultMatrixSha256": digest(root / "fault-runtime/public/fault-matrix.json"),
        "captureCount": 1,
        "fullAsrCount": 3,
        "requirements": verification["requirements"],
        "publicPackageSha256": digest(root / "public-payload.tar.gz"),
        "privateIndexSha256": digest(root / "private-index.json"),
        "secretHitCount": 0,
        "residualCount": 0,
        "independentAuditStatus": "pending",
        "v3_2Passed": False,
    }
    schema = json.loads(args.schema.read_text(encoding="utf-8"))
    Draft202012Validator(schema).validate(candidate)
    write_json(root / "exit-candidate.json", candidate)
    seal_basis = {name: digest(root / name) for name in (
        "artifact-index.json", "private-index.json", "public-payload.tar.gz", "verification-result.json", "exit-candidate.json")}
    seal = {"schemaVersion": "v3-media-transcript-run-seal/v1", "runId": root.name, "artifacts": seal_basis,
            "contentSha256": hashlib.sha256(json.dumps(seal_basis, sort_keys=True, separators=(",", ":")).encode()).hexdigest()}
    write_json(root / "run-seal.json", seal)
    print(json.dumps({"candidate": digest(root / "exit-candidate.json"), "seal": seal["contentSha256"]}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
