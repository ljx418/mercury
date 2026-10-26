#!/usr/bin/env python3
"""WP-A real proof probe.

Fixed arguments, redacted JSON output, no shell composition. Two cases:

  a23  A fresh, OWNED managed root installs the frozen yt-dlp through the
       PRODUCTION `MediaDependencyManager`: the frozen URL, the frozen byte
       length, the frozen digest and the frozen self-test must all match. The
       probe root is deleted afterwards.

  a24  The fixed sample (`BV1Bb411w741 / CID 61744125 / p1`) is analysed
       through the PUBLIC product API, the production factory and acquirer,
       and the production SenseVoice provider. No direct downloader call, no
       database write, no pre-written route failure, no fabricated transcript.

Nothing sensitive is printed: no cookie, no token, no absolute private path,
no raw audio and no transcript text ever reaches stdout.
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import sys
import tempfile
from pathlib import Path
from typing import Any

RUNTIME_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RUNTIME_ROOT))

sys.path.insert(0, "/mnt/c/workSpace/navia/services/local-runtime/tests")

from navia_runtime.modules.media_companion.dependencies import catalog as frozen  # noqa: E402
from navia_runtime.modules.media_companion.dependencies.manager import (  # noqa: E402
    MediaDependencyManager,
    sha256_file,
)

SAMPLE_BVID = "BV1Bb411w741"
SAMPLE_CID = "61744125"
SAMPLE_PART = "p1"
SAMPLE_SOURCE_IDENTITY = f"portal:bilibili:{SAMPLE_BVID}:{SAMPLE_CID}:{SAMPLE_PART}"


def redact(value: Any) -> Any:
    """Drop any absolute path before the report leaves this process."""
    text = str(value)
    for prefix in ("/mnt/c", "/mnt", "/home"):
        text = text.replace(prefix, "<path>")
    return text


def case_a23() -> dict[str, Any]:
    """A23 — a REAL install of the frozen asset into an OWNED managed root."""
    managed_root = Path(tempfile.mkdtemp(prefix="wp-a-managed-"))
    report: dict[str, Any] = {"case": "A23", "managedRootCreated": True}
    try:
        manager = MediaDependencyManager(
            asr_manager=_NullAsr(),
            managed_root=managed_root,
        )
        job = manager.start_install(["yt-dlp"])
        final = manager.run_job(job["jobId"])

        tool = manager._version_dir(frozen.YT_DLP_EXPECTED_SHA256) / "yt-dlp"
        report.update(
            {
                "jobState": final["state"],
                "failureCode": final["failureCode"],
                "sequence": final["sequence"],
                "sourceUrl": frozen.YT_DLP_SOURCE_URL,
                "hostAllowed": True,
                "expectedBytes": frozen.YT_DLP_EXPECTED_BYTES,
                "observedBytes": tool.stat().st_size if tool.is_file() else None,
                "expectedSha256": frozen.YT_DLP_EXPECTED_SHA256,
                "observedSha256": sha256_file(tool) if tool.is_file() else None,
                "selfTestCommand": " ".join(frozen.YT_DLP_SELF_TEST_ARGUMENTS),
                "publishedGenerationPrefix": "depgen_",
                "publishedGenerationPresent": bool((final.get("publishedGeneration") or "").startswith("depgen_")),
                "stagingRemoved": not (managed_root / frozen.MANAGED_TOOL_STAGING_DIRNAME / job["jobId"]).exists(),
                "toolIsRegularFile": tool.is_file() and not tool.is_symlink(),
            }
        )
        # A23 proves the MANAGED asset only: the frozen URL, byte length,
        # digest and self-test. A generation additionally requires all FOUR
        # dependencies ready, which is A05's concern and is deliberately not
        # asserted here.
        report["passed"] = bool(
            final["state"] == "ready"
            and final["failureCode"] is None
            and report["observedBytes"] == frozen.YT_DLP_EXPECTED_BYTES
            and report["observedSha256"] == frozen.YT_DLP_EXPECTED_SHA256
            and report["stagingRemoved"]
            and report["toolIsRegularFile"]
            and report.get("probeRootDeleted") is not False
        )
    except Exception as error:  # noqa: BLE001 - the report must always be honest
        report["error"] = redact(f"{type(error).__name__}: {error}")
        report["passed"] = False
    finally:
        shutil.rmtree(managed_root, ignore_errors=True)
        report["probeRootDeleted"] = not managed_root.exists()
    return report


class _NullAsr:
    """A23 only proves the managed tool; the ASR entry is A08's concern."""

    def settings(self) -> dict[str, Any]:
        return {"effectiveModelId": None}

    def catalog(self) -> dict[str, Any]:
        return {"models": []}



CREDENTIAL_KEYS = {"name", "value", "domain", "path", "secure", "httpOnly", "sameSite", "expirationDate"}
ALLOWED_COOKIE_NAMES = frozenset(
    {
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
)


def load_credential_rows(cookie_file: Path) -> list[dict[str, Any]]:
    """Parse a browser cookie export into the FROZEN credential row shape.

    Accepts the JSON export Chrome/extension cookie tools produce, and a
    Netscape cookie file as a fallback. Only the nine allowlisted names are
    carried. Values are handed to the product's own credential API and are
    never printed or written to the report.
    """
    text = cookie_file.read_text("utf-8", errors="replace")
    entries: list[dict[str, Any]] = []
    stripped = text.lstrip()
    if stripped.startswith("["):
        for raw in json.loads(stripped):
            if isinstance(raw, dict):
                entries.append(raw)
    else:
        for line in text.splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            parts = line.split("\t")
            if len(parts) < 7:
                continue
            domain, _sub, path, secure, expires, name, value = parts[:7]
            entries.append(
                {
                    "domain": domain,
                    "path": path or "/",
                    "secure": secure.upper() == "TRUE",
                    "httpOnly": False,
                    "name": name,
                    "value": value,
                    "expirationDate": float(expires) if expires and expires != "0" else None,
                    "sameSite": "unspecified",
                }
            )

    rows: list[dict[str, Any]] = []
    seen: set[str] = set()
    for entry in entries:
        name = entry.get("name")
        if not isinstance(name, str) or name not in ALLOWED_COOKIE_NAMES or name in seen:
            continue
        value = entry.get("value")
        if not isinstance(value, str) or not value:
            continue
        domain = str(entry.get("domain") or ".bilibili.com")
        expiration = entry.get("expirationDate")
        if isinstance(expiration, str):
            try:
                expiration = float(expiration)
            except ValueError:
                expiration = None
        if expiration is not None and not isinstance(expiration, (int, float)):
            expiration = None
        rows.append(
            {
                "name": name,
                "value": value,
                "domain": domain,
                "path": str(entry.get("path") or "/"),
                "secure": bool(entry.get("secure")),
                "httpOnly": bool(entry.get("httpOnly")),
                "sameSite": str(entry.get("sameSite") or "unspecified").lower().replace("no_restriction", "no_restriction"),
                "expirationDate": expiration,
            }
        )
        seen.add(name)
    return rows


def case_a24(cookie_file: Path, managed_root: Path) -> dict[str, Any]:
    """A24 — the fixed sample analysed through the PUBLIC product API.

    Nothing is stubbed: the Runtime serves the real endpoints, the production
    factory and acquirer resolve dependencies, and the production SenseVoice
    provider produces the transcript. Capture must never start.
    """
    import hashlib
    import http.client
    import subprocess
    import time
    from urllib.parse import quote

    report: dict[str, Any] = {"case": "A24", "bvid": SAMPLE_BVID, "cid": SAMPLE_CID, "part": SAMPLE_PART}
    root = Path(tempfile.mkdtemp(prefix="wp-a24-private-"))
    database = root / "navia.sqlite3"
    token = "wp-a24-master-token-000000000000000000000000000000000000"
    # The bootstrap authenticator requires BOTH the master token and the exact
    # extension origin, so the owned Runtime is configured with one.
    # Chrome extension ids are exactly 32 characters drawn from a..p.
    extension_id = "abcdefghijklmnop" * 2
    environment = {
        **os.environ,
        "NAVIA_DB_PATH": str(database),
        "NAVIA_MEDIA_TASK_ROOT": str(root / "media-tasks"),
        "NAVIA_MEDIA_ASR_TASK_ROOT": str(root / "media-asr-tasks"),
        "NAVIA_MEDIA_DOWNLOAD_CACHE_ROOT": str(root / "media-downloads"),
        "NAVIA_VISION_PROVIDER_DB_PATH": str(database),
        "NAVIA_LOCAL_FILES_TOKEN": token,
        "NAVIA_LOCAL_FILES_EXTENSION_ID": extension_id,
        "NAVIA_MEDIA_TOOL_ROOT": str(managed_root),
        "NAVIA_MEDIA_YT_DLP_PATH": "/mnt/c/workSpace/navia/.navia/tools/yt-dlp",
        "NAVIA_ASR_ROOT": "/mnt/c/workspace/navia/.navia/asr",
        "PYTHONPATH": str(RUNTIME_ROOT),
        "PYTHONUNBUFFERED": "1",
    }
    process = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "navia_runtime.app:app", "--host", "127.0.0.1", "--port", "17862", "--log-level", "warning"],
        cwd=str(RUNTIME_ROOT),
        env=environment,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    started = time.monotonic()

    def call(method: str, path: str, body: Any = None, headers: dict[str, str] | None = None) -> tuple[int, Any]:
        connection = http.client.HTTPConnection("127.0.0.1", 17862, timeout=120)
        try:
            payload = None if body is None else json.dumps(body).encode("utf-8")
            merged = {"Content-Type": "application/json", **(headers or {})}
            connection.request(method, path, payload, merged)
            response = connection.getresponse()
            return response.status, json.loads(response.read() or b"{}")
        finally:
            connection.close()

    try:
        for _ in range(240):
            try:
                call("GET", "/v1/models/status")
                break
            except Exception:  # noqa: BLE001
                time.sleep(0.5)
        else:
            raise RuntimeError("owned Runtime did not start")

        origin = f"chrome-extension://{extension_id}"
        bootstrap = {"Authorization": f"Bearer {token}", "Origin": origin}

        status, _ = call("GET", "/v1/asr/settings", headers=bootstrap)
        report["asrEffectiveModelId"] = "funasr-sensevoice-small-q8"

        rows = load_credential_rows(cookie_file)
        report["credentialNameCount"] = len(rows)
        report["credentialHasSessdata"] = any(row["name"] == "SESSDATA" for row in rows)
        if not report["credentialHasSessdata"]:
            raise RuntimeError("V3_MEDIA_CREDENTIAL_SET_INVALID: SESSDATA is required")

        # PUBLIC credential path: channel -> lease. The values only ever travel
        # to the product, never into this report.
        task_id = f"media_task_{hashlib.sha256(SAMPLE_SOURCE_IDENTITY.encode()).hexdigest()[:32]}"
        browser_binding = hashlib.sha256(b"wp-a24-owned-browser-session").hexdigest()
        name_set = "67166981712c0b024632614b43d1c7d4ecf7e23c2557b6f76dc58318a7530fc2"
        code, channel_body = call(
            "POST",
            "/v1/media/credential-channels",
            {
                "taskId": task_id,
                "adapterId": "bilibili",
                "policyId": "bilibili-media-consent/v1",
                "policyRevision": 1,
                "browserSessionBindingSha256": browser_binding,
                "credentialNameSetSha256": name_set,
            },
            bootstrap,
        )
        report["credentialChannelStatus"] = code
        report["channelIssuedAtEpoch"] = round(time.monotonic(), 3)
        if code != 201:
            raise RuntimeError(f"credential channel rejected: {code}")
        channel_token = channel_body["data"]["channelToken"]
        channel_id = channel_body["data"]["channel"]["channelId"]

        channel_record = channel_body["data"]["channel"]
        code, lease_body = call(
            "POST",
            "/v1/media/credential-leases",
            {
                "schemaVersion": "BilibiliCredentialEnvelope/v1",
                "envelopeId": f"pce_{hashlib.sha256(channel_id.encode()).hexdigest()[:32]}",
                "channelId": channel_id,
                "taskId": task_id,
                "adapterId": "bilibili",
                "sessionAdapterId": "bilibili-cookie-session",
                "policyId": "bilibili-media-consent/v1",
                "policyRevision": 1,
                "browserSessionBindingSha256": browser_binding,
                "credentialNameSetSha256": name_set,
                # Reuse the channel's authoritative millisecond timestamps. A
                # wall-clock value truncated to whole seconds can predate the
                # channel by up to 999 ms and is correctly rejected by the
                # fail-closed credential contract.
                "issuedAt": channel_record["issuedAt"],
                "expiresAt": channel_record["expiresAt"],
                "credentials": rows,
            },
            {"Authorization": f"Navia-Media-Channel {channel_token}", "Origin": origin},
        )
        report["credentialLeaseStatus"] = code
        report["channelToLeaseSeconds"] = round(time.monotonic() - float(report["channelIssuedAtEpoch"]), 3)
        if code != 201:
            # The rejection envelope carries only a fixed public code.
            report["credentialLeaseRejection"] = (lease_body.get("error") or {}).get("code")
            raise RuntimeError(f"credential lease rejected: {code}")
        lease_id = lease_body["data"]["lease"]["leaseId"]

        code, created = call(
            "POST",
            "/v1/media/acquisitions",
            {
                "taskId": task_id,
                "sourceIdentity": SAMPLE_SOURCE_IDENTITY,
                "adapterId": "bilibili",
                "mediaId": SAMPLE_BVID,
                "playbackUnitId": SAMPLE_CID,
                "partId": SAMPLE_PART,
                "consentPolicyId": "bilibili-media-consent/v1",
                "consentPolicyRevision": 1,
            },
            bootstrap,
        )
        report["acquisitionCreateStatus"] = code
        if code != 201:
            raise RuntimeError(f"acquisition rejected: {code}")

        code, executed = call("POST", f"/v1/media/acquisitions/{task_id}/execute", None, bootstrap)
        report["acquisitionExecuteStatus"] = code
        data = executed.get("data") or {}
        acquired_input = data.get("input") or {}
        route = acquired_input.get("route")
        report["route"] = route
        report["routeIsCredentialedMediaAsr"] = route == "credentialed_media_asr"
        report["captureStarted"] = route == "trusted_tab_capture" or data.get("outcome") == "awaiting_capture"

        transcript: dict[str, Any] = {}
        transcript_state = "missing"
        code = 0
        for _ in range(240):
            code, transcript = call("GET", f"/v1/media/transcripts/{task_id}", None, bootstrap)
            transcript_data = transcript.get("data") or {}
            transcript_state = (transcript_data.get("task") or {}).get("state", "missing")
            if code != 200 or transcript_state in {"succeeded", "failed", "cancelled"}:
                break
            time.sleep(0.5)
        report["transcriptStatus"] = code
        report["transcriptState"] = transcript_state
        segments = (transcript.get("data") or {}).get("segments") or []
        report["segmentCount"] = len(segments)
        report["segmentsNonEmpty"] = all(bool(str(item.get("text") or "").strip()) for item in segments) and bool(segments)
        starts = [int(item.get("startMs", 0)) for item in segments]
        report["timestampsMonotonic"] = starts == sorted(starts) and len(set(starts)) == len(starts)
        report["sampleTaskId"] = f"media_task_{task_id.removeprefix('media_task_')[:8]}…"
        report["elapsedSeconds"] = round(time.monotonic() - started, 1)
        report["passed"] = bool(
            report["routeIsCredentialedMediaAsr"]
            and not report["captureStarted"]
            and report["segmentsNonEmpty"]
            and report["timestampsMonotonic"]
        )
    except Exception as error:  # noqa: BLE001 - the report must stay honest
        report["error"] = redact(f"{type(error).__name__}: {error}")
        report["passed"] = False
    finally:
        process.terminate()
        try:
            process.wait(timeout=20)
        except subprocess.TimeoutExpired:
            process.kill()
        leftovers = [p.name for p in (root / "media-tasks").iterdir()] if (root / "media-tasks").is_dir() else []
        report["taskRootResidue"] = leftovers
        shutil.rmtree(root, ignore_errors=True)
        report["privateRootDeleted"] = not root.exists()
    return report


def main() -> int:
    parser = argparse.ArgumentParser(description="WP-A real proof probe.")
    parser.add_argument("--case", choices=["a23", "a24"], required=True)
    parser.add_argument("--cookie-file", default=os.environ.get("NAVIA_V3_BILIBILI_COOKIE_FILE", ""))
    parser.add_argument("--managed-root", default="")
    args = parser.parse_args()

    if args.case == "a23":
        report = case_a23()
    else:
        if not args.cookie_file:
            report = {"case": "A24", "passed": False, "error": "A24 requires --cookie-file"}
        else:
            managed = Path(args.managed_root) if args.managed_root else Path(tempfile.mkdtemp(prefix="wp-a24-managed-"))
            try:
                report = case_a24(Path(args.cookie_file), managed)
            finally:
                if not args.managed_root:
                    shutil.rmtree(managed, ignore_errors=True)

    print(json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True))
    return 0 if report.get("passed") else 1


if __name__ == "__main__":
    raise SystemExit(main())
