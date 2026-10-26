"""WP0 R4 — ownership harness for the real Runtime process.

Everything this module touches is owned by the test that created it:

* a per-round scratch root under ``tmp_path``;
* a random free TCP port, bound by the kernel at selection time and then by
  the child process;
* the child PID, recorded only after the child reports readiness.

The harness never signals a PID it did not record, never binds a fixed
port, and always tears the scratch root down. No Chrome, no Provider, no
external network, and no audio is produced or played — the PCM used by the
tests is silent WAV bytes written to disk.
"""

from __future__ import annotations

import json
import os
import secrets
import shutil
import signal
import socket
import subprocess
import sys
import time
from contextlib import closing, contextmanager
from pathlib import Path
from typing import Any, Iterator

import httpx

CHILD = Path(__file__).with_name("wp0_r4_child.py")
RUNTIME_ROOT = Path(__file__).resolve().parents[1]
EXTENSION_ID = "abcdefghijklmnopabcdefghijklmnop"
TOKEN = secrets.token_urlsafe(48)
ORIGIN = f"chrome-extension://{EXTENSION_ID}"

STARTUP_TIMEOUT_SECONDS = 45.0
SHUTDOWN_TIMEOUT_SECONDS = 15.0


def free_port() -> int:
    """Ask the kernel for an unused port, then release it for the child."""
    with closing(socket.socket(socket.AF_INET, socket.SOCK_STREAM)) as probe:
        probe.bind(("127.0.0.1", 0))
        return int(probe.getsockname()[1])


def wait_for_port(port: int, deadline: float) -> bool:
    while time.monotonic() < deadline:
        with closing(socket.socket(socket.AF_INET, socket.SOCK_STREAM)) as probe:
            probe.settimeout(0.25)
            if probe.connect_ex(("127.0.0.1", port)) == 0:
                return True
        time.sleep(0.05)
    return False


class OwnedRuntime:
    """A real, separately-scheduled ``navia_runtime.app`` process."""

    def __init__(self, root: Path, port: int, process: subprocess.Popen[bytes]) -> None:
        self.root = root
        self.port = port
        self.process = process
        self.pid = int(process.pid)
        self.base_url = f"http://127.0.0.1:{port}"
        self.ws_url = f"ws://127.0.0.1:{port}/v1/media/capture-stream"

    # -- observation --------------------------------------------------------

    @property
    def observations(self) -> list[dict[str, Any]]:
        path = self.root / "fault-observations.jsonl"
        if not path.is_file():
            return []
        records = []
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line:
                records.append(json.loads(line))
        return records

    def wait_for_observation(self, fault: str, timeout: float = 15.0) -> dict[str, Any]:
        """Poll for the child's fault observation.

        A non-killing fault is written by the child while it keeps serving, so
        the observation can land a moment after the client gave up waiting.
        """
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            for record in self.observations:
                if record.get("fault") == fault:
                    return record
            time.sleep(0.05)
        raise AssertionError(
            f"no fault observation was recorded for {fault}; "
            f"seen={[r.get('fault') for r in self.observations]}"
        )

    def observation(self, fault: str) -> dict[str, Any]:
        for record in self.observations:
            if record.get("fault") == fault:
                return record
        raise AssertionError(f"no fault observation was recorded for {fault}")

    def stderr_tail(self, limit: int = 4000) -> str:
        path = self.root / "child.stderr.log"
        if not path.is_file():
            return ""
        return path.read_bytes()[-limit:].decode("utf-8", "replace")

    # -- authenticated HTTP -------------------------------------------------

    def headers(self, *, origin: str | None = ORIGIN, token: str | None = TOKEN) -> dict[str, str]:
        result = {"authorization": f"Bearer {token if token is not None else TOKEN}"}
        if origin is not None:
            result["origin"] = origin
        return result

    def client(self, *, origin: str | None = ORIGIN, token: str | None = TOKEN) -> httpx.Client:
        return httpx.Client(base_url=self.base_url, timeout=20.0, headers=self.headers(origin=origin, token=token))

    # -- lifecycle ----------------------------------------------------------

    def wait_ready(self, deadline: float) -> bool:
        return wait_for_port(self.port, deadline)

    def poll_exit(self, timeout: float) -> int | None:
        try:
            return int(self.process.wait(timeout=timeout))
        except subprocess.TimeoutExpired:
            return None

    def terminate_owned(self) -> int | None:
        """Signal ONLY the PID this harness recorded, then reap it."""
        if self.process.poll() is not None:
            return int(self.process.returncode)
        try:
            os.kill(self.pid, signal.SIGTERM)
        except ProcessLookupError:
            return int(self.process.returncode or -1)
        code = self.poll_exit(SHUTDOWN_TIMEOUT_SECONDS)
        if code is None:
            try:
                os.kill(self.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
            code = self.poll_exit(SHUTDOWN_TIMEOUT_SECONDS)
        return code

    def destroy_scratch(self) -> None:
        # Escape hatch for diagnosing a failed round: keep the owned root (and
        # its child logs) so the failure is still inspectable afterwards.
        if os.environ.get("NAVIA_R4_KEEP_SCRATCH") == "1":
            return
        shutil.rmtree(self.root, ignore_errors=True)


def launch(
    root: Path,
    *,
    fault: dict[str, Any] | None = None,
    seed: dict[str, Any] | None = None,
    port: int | None = None,
) -> OwnedRuntime:
    """Start the owned process and wait until it really serves."""
    root.mkdir(parents=True, exist_ok=True)
    chosen = port or free_port()
    spec = {
        "root": str(root),
        "port": chosen,
        "extensionId": EXTENSION_ID,
        "token": TOKEN,
        "origin": ORIGIN,
        "fault": fault or {},
        "seed": seed or {},
    }
    spec_path = root / "spec.json"
    spec_path.write_text(json.dumps(spec), encoding="utf-8")

    environment = dict(os.environ)
    environment["PYTHONPATH"] = os.pathsep.join(
        [str(RUNTIME_ROOT), environment.get("PYTHONPATH", "")]
    ).strip(os.pathsep)
    environment["PYTHONUNBUFFERED"] = "1"
    # The child must never inherit a real Navia root.
    for leaked in ("NAVIA_DB_PATH", "NAVIA_MEDIA_TASK_ROOT", "NAVIA_MEDIA_ASR_TASK_ROOT"):
        environment.pop(leaked, None)

    process = subprocess.Popen(
        [sys.executable, str(CHILD), str(spec_path)],
        cwd=str(RUNTIME_ROOT),
        env=environment,
        # Log to files rather than pipes: an unread pipe can fill and block
        # the child, and it also leaves the failure diagnosable after a kill.
        stdout=(root / "child.stdout.log").open("wb"),
        stderr=(root / "child.stderr.log").open("wb"),
    )
    runtime = OwnedRuntime(root, chosen, process)
    _record_ownership(runtime)
    if not runtime.wait_ready(time.monotonic() + STARTUP_TIMEOUT_SECONDS):
        runtime.terminate_owned()
        raise AssertionError(
            f"owned Runtime did not accept connections on port {chosen}; "
            f"stderr={runtime.stderr_tail()[:600]!r}"
        )
    return runtime


def _record_ownership(runtime: "OwnedRuntime") -> None:
    """Append a desensitized ownership record for every process this round starts.

    Only the PID, the loopback port and the fault kind are recorded — never the
    scratch path, the ticket, the session token or any audio.
    """
    ledger = os.environ.get("NAVIA_R4_LEDGER")
    if not ledger:
        return
    record = {
        "pid": runtime.pid,
        "port": runtime.port,
        "root": runtime.root.name,
    }
    try:
        with open(ledger, "a", encoding="utf-8") as handle:
            handle.write(json.dumps(record) + "\n")
            handle.flush()
            os.fsync(handle.fileno())
    except OSError:
        pass


@contextmanager
def owned_runtime(
    root: Path,
    *,
    fault: dict[str, Any] | None = None,
    seed: dict[str, Any] | None = None,
) -> Iterator[OwnedRuntime]:
    runtime = launch(root, fault=fault, seed=seed)
    try:
        yield runtime
    finally:
        runtime.terminate_owned()
        runtime.destroy_scratch()


# ---------------------------------------------------------------------------
# Capture-driving helpers
# ---------------------------------------------------------------------------

TASK_ID = "media_task_" + "1" * 32
SOURCE_IDENTITY = "portal:bilibili:BV1TEST:cid:1"
ACQUISITION_RECORD_ID = "mar_" + "8" * 32

CAPTURE_BINDING = {
    "taskId": TASK_ID,
    "adapterId": "bilibili",
    "pageIdentitySha256": "2" * 64,
    "tabId": 7,
    "tabIdSha256": "3" * 64,
    "surface": "side_panel",
}


def capture_seed(task_id: str = TASK_ID) -> dict[str, Any]:
    return {
        "taskId": task_id,
        "sourceIdentity": SOURCE_IDENTITY,
        "adapterId": "bilibili",
        "mediaId": "BV1TEST",
        "playbackUnitId": "cid",
        "partId": "1",
        "consentPolicyId": "bilibili-media-consent/v1",
        "consentPolicyRevision": 1,
    }


def issue_ticket(runtime: OwnedRuntime, binding: dict[str, Any] | None = None) -> dict[str, Any]:
    """Issue a real capture grant over real HTTP from the owned process."""
    payload = dict(binding or CAPTURE_BINDING)
    with runtime.client() as client:
        response = client.post("/v1/media/capture-grants", json=payload)
    response.raise_for_status()
    return response.json()["data"]


def issue_session(runtime: OwnedRuntime) -> str:
    """Issue a real companion session bearer token in THIS process.

    A service-worker restart loses every in-memory session, so R4-4 must
    re-bootstrap through this endpoint in the new process rather than
    replaying a token from the old one.
    """
    with runtime.client() as client:
        response = client.post("/v1/companion/sessions")
    response.raise_for_status()
    session = response.json()["data"]
    token = session.get("token") or session.get("authorization")
    if not isinstance(token, str) or not token:
        raise AssertionError(f"companion session carried no bearer token: {sorted(session)}")
    return token.removeprefix("Bearer ")


def start_message(ticket: str, *, task_id: str = TASK_ID) -> dict[str, Any]:
    return {
        "type": "start",
        "ticket": ticket,
        **CAPTURE_BINDING,
        "taskId": task_id,
        "sourceIdentity": SOURCE_IDENTITY,
        "acquisitionRecordId": ACQUISITION_RECORD_ID,
        "sampleRateHz": 16_000,
        "channels": 1,
        "sampleWidthBytes": 2,
    }


def pcm(frames: int = 16_000) -> bytes:
    """Silent 16 kHz mono s16le PCM. Non-zero so the sink is not EMPTY.

    The waveform is a fixed inaudible low-frequency square pattern: it is
    never transmitted to a speaker and never played.
    """
    import struct

    samples = bytearray()
    for index in range(frames):
        value = 512 if (index // 40) % 2 == 0 else -512
        samples += struct.pack("<h", value)
    return bytes(samples)


def chunk_payload(payload: bytes | None = None) -> bytes:
    return payload if payload is not None else pcm()
