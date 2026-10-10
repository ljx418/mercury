#!/usr/bin/env python3
"""Download and verify the frozen V3-2-0b ASR qualification assets."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import posixpath
import re
import shutil
import stat
import tarfile
import time
import urllib.request
import zipfile
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path, PurePosixPath
from typing import Any
from urllib.parse import urlparse


CHUNK_SIZE = 1024 * 1024
MAX_REDIRECTS = 10
ALLOWED_HOSTS = frozenset({"api.github.com", "github.com", "huggingface.co", "raw.githubusercontent.com"})
ALLOWED_SUFFIXES = (".githubusercontent.com", ".github.com", ".huggingface.co", ".hf.co", ".xethub.hf.co")
SECRET_PATTERNS = (
    re.compile(r"(?i)\b(cookie|authorization|set-cookie)\s*[:=]"),
    re.compile(r"(?i)\b(bearer|access[_-]?token|refresh[_-]?token)\s+[A-Za-z0-9._~+/-]+"),
    re.compile(r"(?i)(SESSDATA|bili_jct|DedeUserID)\s*="),
    re.compile(r"(?i)(?:[A-Z]:\\|/home/|/mnt/[a-z]/|/Users/)"),
)


def utc_now() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


def canonical_json(value: Any) -> bytes:
    return json.dumps(value, ensure_ascii=True, sort_keys=True, separators=(",", ":")).encode("utf-8")


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(CHUNK_SIZE), b""):
            digest.update(chunk)
    return digest.hexdigest()


def host_allowed(hostname: str) -> bool:
    host = hostname.lower().rstrip(".")
    return host in ALLOWED_HOSTS or any(host.endswith(suffix) and host != suffix[1:] for suffix in ALLOWED_SUFFIXES)


def validate_url(value: str) -> str:
    parsed = urlparse(value)
    hostname = parsed.hostname or ""
    if parsed.scheme != "https" or parsed.username or parsed.password or not host_allowed(hostname):
        raise ValueError(f"source URL is not allowlisted: {hostname or '<missing>'}")
    return hostname.lower()


class RecordingRedirectHandler(urllib.request.HTTPRedirectHandler):
    def __init__(self, hosts: list[str]):
        super().__init__()
        self.hosts = hosts
        self.redirect_count = 0

    def redirect_request(self, request, file_pointer, code, message, headers, new_url):
        self.redirect_count += 1
        if self.redirect_count > MAX_REDIRECTS:
            raise ValueError("too many redirects")
        self.hosts.append(validate_url(new_url))
        return super().redirect_request(request, file_pointer, code, message, headers, new_url)


@dataclass(frozen=True)
class FrozenAsset:
    asset_id: str
    kind: str
    file_name: str
    byte_length: int
    sha256: str
    source_url: str
    platform: str | None = None
    role: str | None = None
    revision: str | None = None
    license: str | None = None


def parse_assets(manifest: dict[str, Any]) -> list[FrozenAsset]:
    assets: list[FrozenAsset] = []
    for item in manifest.get("runtimeAssets", []):
        assets.append(
            FrozenAsset(
                asset_id=f"runtime:{item['platform']}",
                kind="runtime",
                platform=item["platform"],
                file_name=item["fileName"],
                byte_length=item["byteLength"],
                sha256=item["sha256"],
                source_url=item["sourceUrl"],
                revision=manifest["provider"]["engineVersion"],
                license=manifest["provider"]["license"],
            )
        )
    for item in manifest.get("modelAssets", []):
        assets.append(
            FrozenAsset(
                asset_id=f"model:{item['role']}",
                kind="model",
                role=item["role"],
                file_name=item["fileName"],
                byte_length=item["byteLength"],
                sha256=item["sha256"],
                source_url=item["sourceUrl"],
                revision=item["revision"],
                license=item["license"],
            )
        )
    if len(assets) != 4 or len({item.asset_id for item in assets}) != 4:
        raise ValueError("candidate manifest must contain exactly two runtime and two model assets")
    return assets


def download_bytes(url: str, *, timeout: int) -> tuple[bytes, list[str], str]:
    hosts = [validate_url(url)]
    redirect_handler = RecordingRedirectHandler(hosts)
    opener = urllib.request.build_opener(redirect_handler)
    request = urllib.request.Request(url, headers={"User-Agent": "Navia-V3-ASR-Qualification/1"})
    with opener.open(request, timeout=timeout) as response:
        final_host = validate_url(response.geturl())
        if final_host not in hosts:
            hosts.append(final_host)
        data = response.read()
    return data, hosts, final_host


def download_asset(asset: FrozenAsset, destination: Path, *, timeout: int) -> dict[str, Any]:
    initial_host = validate_url(asset.source_url)
    if destination.is_file() and destination.stat().st_size == asset.byte_length and sha256_file(destination) == asset.sha256:
        return {
            "assetId": asset.asset_id,
            "kind": asset.kind,
            "fileName": asset.file_name,
            "byteLength": asset.byte_length,
            "sha256": asset.sha256,
            "sourceUrl": asset.source_url,
            "initialHost": initial_host,
            "redirectHosts": [],
            "finalHost": initial_host,
            "downloadDisposition": "reused_verified_private_asset",
            "verified": True,
        }

    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_suffix(destination.suffix + ".part")
    temporary.unlink(missing_ok=True)
    hosts = [initial_host]
    redirect_handler = RecordingRedirectHandler(hosts)
    opener = urllib.request.build_opener(redirect_handler)
    request = urllib.request.Request(asset.source_url, headers={"User-Agent": "Navia-V3-ASR-Qualification/1"})
    digest = hashlib.sha256()
    written = 0
    started = time.monotonic()
    try:
        with opener.open(request, timeout=timeout) as response, temporary.open("wb") as output:
            final_host = validate_url(response.geturl())
            if final_host not in hosts:
                hosts.append(final_host)
            os.chmod(temporary, 0o600)
            for chunk in iter(lambda: response.read(CHUNK_SIZE), b""):
                written += len(chunk)
                if written > asset.byte_length:
                    raise ValueError(f"{asset.asset_id} exceeded frozen byte length")
                digest.update(chunk)
                output.write(chunk)
        actual_sha = digest.hexdigest()
        if written != asset.byte_length or actual_sha != asset.sha256:
            raise ValueError(
                f"{asset.asset_id} mismatch: bytes={written}/{asset.byte_length}, sha256={actual_sha}/{asset.sha256}"
            )
        temporary.replace(destination)
    except Exception:
        temporary.unlink(missing_ok=True)
        raise
    return {
        "assetId": asset.asset_id,
        "kind": asset.kind,
        "fileName": asset.file_name,
        "byteLength": written,
        "sha256": digest.hexdigest(),
        "sourceUrl": asset.source_url,
        "initialHost": initial_host,
        "redirectHosts": hosts[1:],
        "finalHost": hosts[-1],
        "downloadDisposition": "downloaded_and_verified",
        "elapsedSeconds": round(time.monotonic() - started, 3),
        "verified": True,
    }


def safe_member_name(name: str) -> PurePosixPath:
    path = PurePosixPath(name)
    if path.is_absolute() or ".." in path.parts or "" in path.parts:
        raise ValueError(f"unsafe archive member path: {name}")
    return path


def safe_link_target(member: PurePosixPath, target: str) -> None:
    target_path = PurePosixPath(target)
    if target_path.is_absolute():
        raise ValueError(f"unsafe absolute archive link: {member}")
    normalized = posixpath.normpath(str(member.parent / target_path))
    if normalized == ".." or normalized.startswith("../"):
        raise ValueError(f"archive link escapes root: {member}")


def inspect_tar(path: Path, asset_id: str) -> dict[str, Any]:
    members: list[dict[str, Any]] = []
    expanded = 0
    with tarfile.open(path, "r:*") as archive:
        for item in archive.getmembers():
            member_path = safe_member_name(item.name)
            if item.isreg():
                kind = "file"
                expanded += item.size
            elif item.isdir():
                kind = "directory"
            elif item.issym():
                kind = "symlink"
                safe_link_target(member_path, item.linkname)
            elif item.islnk():
                kind = "hardlink"
                safe_link_target(member_path, item.linkname)
            else:
                raise ValueError(f"unsupported tar member type: {item.name}")
            members.append({"path": item.name, "type": kind, "size": item.size, "mode": oct(item.mode)})
    return {"assetId": asset_id, "format": "tar", "memberCount": len(members), "expandedBytes": expanded, "members": members}


def inspect_zip(path: Path, asset_id: str) -> dict[str, Any]:
    members: list[dict[str, Any]] = []
    expanded = 0
    with zipfile.ZipFile(path) as archive:
        for item in archive.infolist():
            safe_member_name(item.filename)
            mode = (item.external_attr >> 16) & 0xFFFF
            file_type = stat.S_IFMT(mode)
            if item.is_dir():
                kind = "directory"
            elif file_type == stat.S_IFLNK:
                raise ValueError(f"zip symlink is not accepted: {item.filename}")
            elif file_type in {0, stat.S_IFREG}:
                kind = "file"
                expanded += item.file_size
            else:
                raise ValueError(f"unsupported zip member type: {item.filename}")
            members.append({"path": item.filename, "type": kind, "size": item.file_size, "mode": oct(mode)})
    return {"assetId": asset_id, "format": "zip", "memberCount": len(members), "expandedBytes": expanded, "members": members}


def inspect_archive(asset: FrozenAsset, path: Path) -> dict[str, Any] | None:
    if asset.file_name.endswith((".tar.gz", ".tgz")):
        return inspect_tar(path, asset.asset_id)
    if asset.file_name.endswith(".zip"):
        return inspect_zip(path, asset.asset_id)
    return None


def verify_licenses(manifest: dict[str, Any], *, timeout: int) -> list[dict[str, Any]]:
    provider = manifest["provider"]
    sources = [
        {
            "subject": "provider:funasr-llamacpp",
            "declaredLicense": provider["license"],
            "url": "https://raw.githubusercontent.com/modelscope/FunASR/runtime-llamacpp-v0.2.6/LICENSE",
            "kind": "license_text",
            "expectedMarker": "MIT License",
            "expectedRevision": provider["engineVersion"],
        }
    ]
    for item in manifest["modelAssets"]:
        sources.append(
            {
                "subject": f"model:{item['role']}",
                "declaredLicense": item["license"],
                "url": f"https://huggingface.co/api/models/{item['repository']}/revision/{item['revision']}",
                "kind": "huggingface_revision_metadata",
                "expectedMarker": "apache-2.0",
                "expectedRevision": item["revision"],
                "expectedRepository": item["repository"],
            }
        )
    results: list[dict[str, Any]] = []
    for source in sources:
        data, hosts, final_host = download_bytes(source["url"], timeout=timeout)
        if source["kind"] == "license_text":
            if source["expectedMarker"].encode("utf-8") not in data:
                raise ValueError("FunASR license text did not contain the expected MIT marker")
            observed_license = "MIT"
            revision_matches = True
        else:
            metadata = json.loads(data)
            observed_license = str(metadata.get("cardData", {}).get("license", ""))
            revision_matches = metadata.get("sha") == source["expectedRevision"] and metadata.get("id") == source["expectedRepository"]
            if observed_license.lower() != source["expectedMarker"] or not revision_matches:
                raise ValueError(f"license or revision mismatch for {source['subject']}")
        results.append(
            {
                "subject": source["subject"],
                "declaredLicense": source["declaredLicense"],
                "observedLicense": observed_license,
                "sourceUrl": source["url"],
                "sourceSha256": sha256_bytes(data),
                "sourceBytes": len(data),
                "redirectHosts": hosts[1:],
                "finalHost": final_host,
                "revisionMatches": revision_matches,
                "verified": True,
            }
        )
    return results


def scan_public_evidence(paths: list[Path]) -> dict[str, Any]:
    hits: list[dict[str, Any]] = []
    scanned_bytes = 0
    for path in paths:
        data = path.read_bytes()
        scanned_bytes += len(data)
        text = data.decode("utf-8", errors="replace")
        for pattern in SECRET_PATTERNS:
            if pattern.search(text):
                hits.append({"file": path.name, "pattern": pattern.pattern})
    return {"files": len(paths), "bytes": scanned_bytes, "hits": hits, "passed": not hits}


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(json.dumps(value, ensure_ascii=True, sort_keys=True, indent=2).encode("utf-8") + b"\n")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--private-root", type=Path, required=True)
    parser.add_argument("--output-root", type=Path, required=True)
    parser.add_argument("--timeout", type=int, default=300)
    args = parser.parse_args()

    manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
    assets = parse_assets(manifest)
    args.private_root.mkdir(parents=True, exist_ok=True, mode=0o700)
    try:
        args.private_root.chmod(0o700)
    except OSError:
        pass
    args.output_root.mkdir(parents=True, exist_ok=False)

    asset_results: list[dict[str, Any]] = []
    inventories: list[dict[str, Any]] = []
    for asset in assets:
        print(f"verifying {asset.asset_id} ({asset.byte_length} bytes)", flush=True)
        destination = args.private_root / asset.file_name
        result = download_asset(asset, destination, timeout=args.timeout)
        asset_results.append(result)
        inventory = inspect_archive(asset, destination)
        if inventory:
            inventories.append(inventory)

    licenses = verify_licenses(manifest, timeout=args.timeout)
    run_id = args.output_root.name
    verification = {
        "schemaVersion": "v3-asr-qualification-asset-verification/v1",
        "runId": run_id,
        "candidateId": manifest["candidateId"],
        "generatedAt": utc_now(),
        "assets": asset_results,
        "summary": {"total": len(asset_results), "verified": sum(1 for item in asset_results if item["verified"]), "failed": 0},
    }
    archive_inventory = {
        "schemaVersion": "v3-asr-qualification-archive-inventory/v1",
        "runId": run_id,
        "archives": inventories,
        "summary": {"total": len(inventories), "unsafe": 0},
    }
    license_verification = {
        "schemaVersion": "v3-asr-qualification-license-verification/v1",
        "runId": run_id,
        "licenses": licenses,
        "summary": {"total": len(licenses), "verified": sum(1 for item in licenses if item["verified"]), "failed": 0},
    }
    dependency_manifest = {
        "schemaVersion": "v3-asr-qualification-dependency-manifest/v1",
        "runId": run_id,
        "candidateId": manifest["candidateId"],
        "provider": manifest["provider"],
        "assetSetSha256": sha256_bytes(canonical_json(asset_results)),
        "archiveInventorySha256": sha256_bytes(canonical_json(archive_inventory)),
        "licenseVerificationSha256": sha256_bytes(canonical_json(license_verification)),
        "status": "verified_not_installed_not_qualified",
        "qualityStatus": "qualification_pending",
        "nextStage": "V3-2-0b-1",
    }
    outputs = {
        "asset-verification.json": verification,
        "archive-inventory.json": archive_inventory,
        "license-verification.json": license_verification,
        "dependency-manifest.json": dependency_manifest,
    }
    for name, value in outputs.items():
        write_json(args.output_root / name, value)
    evidence_paths = [args.output_root / name for name in outputs]
    secret_scan = scan_public_evidence(evidence_paths)
    write_json(args.output_root / "secret-scan.json", {"schemaVersion": "v3-public-evidence-secret-scan/v1", **secret_scan})
    if not secret_scan["passed"]:
        shutil.rmtree(args.output_root)
        raise ValueError("public evidence secret scan failed")
    print(json.dumps({"runId": run_id, "assets": len(asset_results), "licenses": len(licenses), "archives": len(inventories), "passed": True}, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
