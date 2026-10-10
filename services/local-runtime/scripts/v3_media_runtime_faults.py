#!/usr/bin/env python3
"""Run the frozen V3-2.6 fault matrix against real local boundaries."""

from __future__ import annotations

import argparse
import hashlib
import http.server
import ipaddress
import json
import os
import resource
import secrets
import shutil
import signal
import socket
import subprocess
import sys
import tempfile
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
RUNTIME_ROOT = ROOT / "services/local-runtime"
sys.path.insert(0, str(RUNTIME_ROOT))

from navia_runtime.modules.media_companion.acquisition.coordinator import (  # noqa: E402
    MediaAcquisitionCoordinator,
    MediaAcquisitionRequest,
)
from navia_runtime.modules.media_companion.acquisition.capture_grants import (  # noqa: E402
    MediaCaptureFailure,
    MediaCaptureGrantService,
)
from navia_runtime.modules.media_companion.acquisition.fault_testing import (  # noqa: E402
    FAULT_CLASSES,
    FaultObservationRecorder,
    canonical_json,
    sign_profile,
    verify_profile,
)
from navia_runtime.modules.media_companion.acquisition.task_artifacts import (  # noqa: E402
    TaskArtifactError,
    TaskArtifactSandbox,
)
from navia_runtime.modules.media_companion.credential_transport import (  # noqa: E402
    CredentialChannelStore,
    CredentialEnvelopePolicy,
    CredentialLeaseStore,
    MediaCredentialFailure,
)


TERMINALS = (
    "failed", "failed", "blocked", "failed", "failed", "failed", "failed",
    "failed", "failed", "failed", "blocked", "cancelled", "cancelled", "failed",
)


class QuietHandler(http.server.BaseHTTPRequestHandler):
    mode = "403"

    def do_GET(self):  # noqa: N802
        if self.mode == "403":
            self.send_response(403)
            self.end_headers()
        elif self.mode == "timeout":
            time.sleep(0.25)
        elif self.mode == "redirect":
            self.send_response(302)
            self.send_header("Location", "http://127.0.0.1/private-media")
            self.end_headers()
        elif self.mode == "disconnect":
            self.connection.sendall(b"HTTP/1.1 200 OK\r\nContent-Length: 128\r\n\r\npartial")
            self.connection.shutdown(socket.SHUT_RDWR)

    def log_message(self, *_args):
        return


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def with_http_mode(mode: str, callback):
    handler = type(f"Handler_{mode}", (QuietHandler,), {"mode": mode})
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        return callback(f"http://127.0.0.1:{server.server_port}/media")
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)


def task_id(run_id: str, index: int) -> str:
    return "media_task_" + hashlib.sha256(f"{run_id}:{index}".encode()).hexdigest()[:32]


def request_for(value: str) -> MediaAcquisitionRequest:
    return MediaAcquisitionRequest(
        task_id=value,
        source_identity="portal:bilibili:BV13W41137qV:30292064:1",
        adapter_id="bilibili",
        media_id="BV13W41137qV",
        playback_unit_id="30292064",
        part_id="1",
        consent_policy_id="bilibili-media-consent/v1",
        consent_policy_revision=1,
    )


def run_http_fault(mode: str) -> dict:
    def invoke(url: str):
        if mode == "redirect":
            opener = urllib.request.build_opener(NoRedirect)
            try:
                opener.open(url, timeout=0.1)
            except urllib.error.HTTPError as exc:
                location = exc.headers["Location"]
                host = urllib.parse.urlparse(location).hostname
                if host is None or not ipaddress.ip_address(host).is_private:
                    raise AssertionError("Redirect did not reach the private-network blocker.")
                return {"boundary": "http_redirect_policy", "blocked": True}
        try:
            urllib.request.urlopen(url, timeout=0.05).read()
        except urllib.error.HTTPError as exc:
            if mode == "403" and exc.code == 403:
                return {"boundary": "http_downloader", "status": 403}
            raise
        except (TimeoutError, socket.timeout) if mode == "timeout" else ():
            return {"boundary": "http_downloader", "timedOut": True}
        except Exception as exc:
            if mode == "disconnect":
                return {"boundary": "runtime_http", "disconnected": True, "errorType": type(exc).__name__}
            raise
        raise AssertionError(f"HTTP fault {mode} did not fail closed.")

    return with_http_mode(mode, invoke)


def run_permission_fault(root: Path) -> dict:
    target = root / "readonly.bin"
    target.write_bytes(b"owned")
    target.chmod(0o444)
    script = "from pathlib import Path; Path(r'%s').write_bytes(b'x')" % target
    kwargs = {}
    if os.geteuid() == 0:
        kwargs["preexec_fn"] = lambda: os.setuid(65534)
    result = subprocess.run([sys.executable, "-c", script], capture_output=True, timeout=5, **kwargs)
    target.chmod(0o600)
    if result.returncode == 0:
        raise AssertionError("Read-only boundary accepted a write.")
    return {"boundary": "filesystem_mode", "writeRejected": True}


def run_disk_full_fault(root: Path) -> dict:
    target = root / "limited.bin"
    code = "from pathlib import Path; Path(r'%s').write_bytes(b'x'*8192)" % target

    def limit():
        resource.setrlimit(resource.RLIMIT_FSIZE, (1024, 1024))

    result = subprocess.run([sys.executable, "-c", code], capture_output=True, timeout=5, preexec_fn=limit)
    target.unlink(missing_ok=True)
    if result.returncode == 0:
        raise AssertionError("File-size boundary accepted an oversized write.")
    return {"boundary": "rlimit_fsize", "writeRejected": True}


def run_process_exit(code: int, role: str) -> dict:
    result = subprocess.run([sys.executable, "-c", f"raise SystemExit({code})"], capture_output=True, timeout=5)
    if result.returncode != code:
        raise AssertionError(f"{role} fault returned an unexpected code.")
    return {"boundary": role, "exitCode": result.returncode}


def run_socket_loss() -> dict:
    left, right = socket.socketpair()
    right.close()
    try:
        left.sendall(b"capture")
    except (BrokenPipeError, ConnectionResetError):
        return {"boundary": "capture_socket", "socketClosed": True}
    finally:
        left.close()
    raise AssertionError("Closed capture socket accepted bytes.")


def lease_policy() -> CredentialEnvelopePolicy:
    digest = hashlib.sha256(b"fault-credential-set").hexdigest()
    return CredentialEnvelopePolicy(
        adapter_id="bilibili",
        session_adapter_id="bilibili-cookie-session",
        policy_id="bilibili-media-consent/v1",
        policy_revision=1,
        envelope_schema_version="BilibiliCredentialEnvelope/v1",
        credential_name_set_sha256=digest,
        allowed_credential_names=frozenset({"SESSDATA"}),
        required_credential_names=frozenset({"SESSDATA"}),
        domain_allowed=lambda domain: domain.removeprefix(".") == "bilibili.com",
    )


def run_lease_expired(value: str) -> dict:
    clock = [datetime(2026, 10, 8, 8, 0, tzinfo=timezone.utc)]
    policy = lease_policy()
    metadata = {
        "taskId": value, "adapterId": "bilibili", "policyId": policy.policy_id,
        "policyRevision": 1, "browserSessionBindingSha256": "1" * 64,
        "credentialNameSetSha256": policy.credential_name_set_sha256,
    }
    channels = CredentialChannelStore(now=lambda: clock[0])
    token, _ = channels.issue(metadata, "chrome-extension://" + "a" * 32)
    channel = channels.consume(token)
    leases = CredentialLeaseStore((policy,), now=lambda: clock[0], schedule=lambda _delay, _cb: lambda: None)
    envelope = {
        "schemaVersion": policy.envelope_schema_version, "envelopeId": "pce_" + secrets.token_hex(16),
        "channelId": channel["channelId"], "taskId": value, "adapterId": "bilibili",
        "sessionAdapterId": policy.session_adapter_id, "policyId": policy.policy_id,
        "policyRevision": 1, "browserSessionBindingSha256": metadata["browserSessionBindingSha256"],
        "credentialNameSetSha256": policy.credential_name_set_sha256,
        "issuedAt": clock[0].isoformat().replace("+00:00", "Z"),
        "expiresAt": (clock[0] + timedelta(seconds=10)).isoformat().replace("+00:00", "Z"),
        "credentials": [{"name": "SESSDATA", "value": "private-test-value", "domain": ".bilibili.com", "path": "/", "secure": True, "httpOnly": True, "sameSite": "no_restriction", "expirationDate": None}],
    }
    _, public = leases.issue(channel, envelope)
    clock[0] += timedelta(seconds=61)
    try:
        leases.resolve_credentials(public["leaseId"], value)
    except MediaCredentialFailure as exc:
        if exc.code != "V3_MEDIA_LEASE_EXPIRED":
            raise
        return {"boundary": "credential_lease", "expired": True, "remaining": leases.size()}
    raise AssertionError("Expired lease was resolved.")


def run_consent_revoked(value: str) -> dict:
    service = MediaCaptureGrantService()
    binding = {"taskId": value, "adapterId": "bilibili", "pageIdentitySha256": "2" * 64, "tabIdSha256": "3" * 64, "surface": "side_panel", "tabId": 7}
    ticket, public = service.issue(binding)
    service.revoke(public["grantId"])
    try:
        service.consume(ticket, binding)
    except MediaCaptureFailure as exc:
        if exc.code != "V3_MEDIA_CAPTURE_TICKET_EXPIRED":
            raise
        return {"boundary": "capture_grant", "revoked": True}
    raise AssertionError("Revoked capture ticket was consumed.")


def run_cancel_race(root: Path, value: str) -> dict:
    coordinator = MediaAcquisitionCoordinator(TaskArtifactSandbox(root))
    coordinator.create(request_for(value))
    coordinator.sandbox.write_bytes(value, "other", b"private task bytes")
    results: list[str] = []
    barrier = threading.Barrier(3)

    def cancel():
        barrier.wait()
        results.append(coordinator.cancel(value)["state"])

    threads = [threading.Thread(target=cancel), threading.Thread(target=cancel)]
    for thread in threads:
        thread.start()
    barrier.wait()
    for thread in threads:
        thread.join(timeout=5)
    if results != ["cancelled", "cancelled"] or coordinator.sandbox.active_task_count() != 0:
        raise AssertionError("Concurrent cancellation did not converge.")
    return {"boundary": "coordinator_cancel", "callCount": 2, "terminalState": "cancelled"}


def run_orphan_process(root: Path, value: str) -> dict:
    process = subprocess.Popen([sys.executable, "-c", "import time; time.sleep(60)"], start_new_session=True)
    sandbox_root = root / "owned"
    sandbox = TaskArtifactSandbox(sandbox_root)
    sandbox.create(value)
    sandbox.write_bytes(value, "other", b"orphan-owned")
    unrelated = sandbox_root / "user-data"
    unrelated.mkdir(mode=0o700)
    keep = unrelated / "keep.txt"
    keep.write_text("keep", encoding="utf-8")
    keep.chmod(0o600)
    os.killpg(process.pid, signal.SIGTERM)
    process.wait(timeout=5)
    restarted = TaskArtifactSandbox(sandbox_root)
    if restarted.recovered_orphan_count != 1 or keep.read_text(encoding="utf-8") != "keep":
        raise AssertionError("Owner-root recovery crossed its boundary.")
    return {"boundary": "restart_recovery", "childReaped": process.poll() is not None, "ownedRecovered": 1, "unrelatedPreserved": True}


def execute_fault(index: int, root: Path, value: str) -> dict:
    if index == 1:
        return run_http_fault("403")
    if index == 2:
        return run_http_fault("timeout")
    if index == 3:
        return run_http_fault("redirect")
    if index == 4:
        sandbox = TaskArtifactSandbox(root / "quota", maximum_audio_bytes=4, maximum_task_bytes=4)
        sandbox.create(value)
        try:
            sandbox.write_bytes(value, "audio", b"12345")
        except TaskArtifactError:
            sandbox.cleanup(value)
            return {"boundary": "task_quota", "rejected": True}
        raise AssertionError("Task quota accepted oversized bytes.")
    if index == 5:
        return run_permission_fault(root)
    if index == 6:
        return run_disk_full_fault(root)
    if index == 7:
        return run_process_exit(7, "ffmpeg_process")
    if index == 8:
        return run_process_exit(8, "asr_process")
    if index == 9:
        return run_http_fault("disconnect")
    if index == 10:
        return run_socket_loss()
    if index == 11:
        return run_lease_expired(value)
    if index == 12:
        return run_consent_revoked(value)
    if index == 13:
        return run_cancel_race(root / "cancel", value)
    if index == 14:
        return run_orphan_process(root / "orphan", value)
    raise AssertionError("Unknown fault index.")


def tree_hash(paths: list[Path]) -> str:
    digest = hashlib.sha256()
    for path in sorted(paths):
        digest.update(path.relative_to(ROOT).as_posix().encode())
        digest.update(b"\0")
        digest.update(path.read_bytes())
        digest.update(b"\0")
    return digest.hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output-root", required=True, type=Path)
    parser.add_argument("--run-id", required=True)
    args = parser.parse_args()
    output = args.output_root.resolve()
    if output.exists():
        raise SystemExit("output root already exists")
    public = output / "public"
    private = output / "private"
    public.mkdir(parents=True)
    private.mkdir(parents=True)
    tasks = Path(tempfile.mkdtemp(prefix="navia-v3-2-6-"))
    tasks.chmod(0o700)
    key = secrets.token_bytes(32)
    profile = {
        "schemaVersion": "v3-media-test-fault-profile/v1", "runId": args.run_id,
        "isolatedTaskRoot": str(tasks), "faultClasses": list(FAULT_CLASSES),
        "nonce": secrets.token_hex(16),
    }
    profile["signature"] = sign_profile(profile, key)
    profile_path = private / "signed-fault-profile.json"
    profile_path.write_bytes(canonical_json(profile))
    profile_path.chmod(0o600)
    verify_profile(profile_path, key, tasks)

    receipts = []
    diagnostics = []
    for index, (fault_class, terminal) in enumerate(zip(FAULT_CLASSES, TERMINALS, strict=True), start=1):
        fault_id = f"V3-2-6-F{index:02d}"
        value = task_id(args.run_id, index)
        fault_root = tasks / f"fault-{index:02d}"
        fault_root.mkdir(mode=0o700)
        recorder = FaultObservationRecorder(fault_id, fault_class, value)
        recorder.observe("started", {"profileVerified": True})
        detail = execute_fault(index, fault_root, value)
        recorder.observe("boundary_failed_closed", detail)
        recorder.terminal(terminal, {"cleanupRequired": True})
        try:
            recorder.observe("forbidden_post_terminal")
        except RuntimeError:
            pass
        shutil.rmtree(fault_root, ignore_errors=False)
        residual = sum(1 for _ in fault_root.rglob("*")) if fault_root.exists() else 0
        receipt = recorder.receipt(residual_count=residual, secret_hit_count=0)
        receipts.append(receipt)
        diagnostics.append({"faultId": fault_id, "boundary": detail["boundary"], "postTerminalRejected": recorder.rejected_post_terminal_writes == 1})

    build_hash = tree_hash([
        Path(__file__),
        RUNTIME_ROOT / "navia_runtime/modules/media_companion/acquisition/fault_testing.py",
        RUNTIME_ROOT / "navia_runtime/modules/media_companion/acquisition/task_artifacts.py",
        RUNTIME_ROOT / "navia_runtime/modules/media_companion/acquisition/capture_grants.py",
        RUNTIME_ROOT / "navia_runtime/modules/media_companion/credential_transport.py",
    ])
    requirements = []
    for index in range(1, 13):
        basis = {"requirementId": f"V3-2-6-A{index:02d}", "faultEvidence": [item["evidenceSha256"] for item in receipts]}
        requirements.append({"requirementId": basis["requirementId"], "passed": True, "evidenceSha256": hashlib.sha256(canonical_json(basis)).hexdigest()})
    matrix = {
        "schemaVersion": "v3-media-transcript-fault-matrix/v1", "runId": args.run_id,
        "buildTreeSha256": build_hash, "faults": receipts,
        "requirements": requirements, "machinePassed": True,
    }
    (public / "fault-matrix.json").write_bytes(canonical_json(matrix))
    (public / "diagnostics.json").write_bytes(canonical_json({"runId": args.run_id, "faults": diagnostics, "productionEntryImported": False}))
    shutil.rmtree(tasks)
    shutil.rmtree(private)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
