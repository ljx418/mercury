"""WP-A Runtime media-dependency manager.

The Runtime is the ONLY owner of dependency download, verification, atomic
publication, job state and generation. The Extension only issues the frozen
commands and renders the status it reads back.

Design constraints honoured here:

* content-addressed, immutable version directories;
* exactly ONE active repair job;
* the atomic commit window is bounded by a lock, so cancel-versus-commit has
  exactly two legal outcomes and never a third;
* a Runtime restart turns every active job into ``failed/RUNTIME_RESTARTED``,
  removes its staging, and re-verifies from the final files — never from a
  remembered "downloading" success;
* a task takes ONE snapshot and holds a lease, so publishing a new generation
  cannot hot-swap the tools a running task is already using.
"""

from __future__ import annotations

import contextlib
import hashlib
import json
import os
import shutil
import socket
import subprocess
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

from . import catalog as frozen
from .catalog import JOB_ID_PREFIX, DependencyDescriptor
from .contracts import (
    CANCELABLE_JOB_STATES,
    DEPENDENCY_INSTALLATION_SCHEMA_VERSION,
    DEPENDENCY_STATUS_SCHEMA_VERSION,
    NON_CANCELABLE_JOB_STATES,
    TERMINAL_JOB_STATES,
    DependencyState,
    MediaDependencyError,
    VerifiedDependencySnapshot,
    is_valid_job_id,
    semantic_validate_status,
)

#: The manager keeps the authoritative task leases in ``self._leases``.
#:
#: A lease says which frozen dependency generation a task holds RIGHT NOW. It
#: is deliberately NOT published into a process-global map: a global copy
#: outlives a Runtime restart with stale entries and lets an unrelated
#: instance answer for another Runtime. A caller that needs the CURRENT
#: generation asks the manager, which re-verifies and re-leases on demand.
#:
#: The name is kept only so that an existing import of it keeps working; it
#: stays EMPTY and carries no authority.
DEPENDENCY_LEASES: dict[str, VerifiedDependencySnapshot] = {}


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):  # type: ignore[no-untyped-def]
        return None


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def sha256_file(path: Path, *, chunk: int = 1024 * 1024) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        while True:
            block = handle.read(chunk)
            if not block:
                break
            digest.update(block)
    return digest.hexdigest()


def default_managed_root(db_path: Path) -> Path:
    override = os.environ.get("NAVIA_MEDIA_TOOL_ROOT")
    if override:
        return Path(override)
    return db_path.parent / "managed-tools"


class MediaDependencyManager:
    """Aggregate, verify, repair and publish the four frozen dependencies."""

    def __init__(
        self,
        *,
        asr_manager: Any,
        managed_root: Path,
        now: Callable[[], str] = utc_now,
        downloader: Callable[..., tuple[int, Any]] | None = None,
        runner: Callable[..., subprocess.CompletedProcess[str]] | None = None,
        disk_usage: Callable[[Path], int] | None = None,
    ) -> None:
        self._asr_manager = asr_manager
        self._root = Path(managed_root)
        self._now = now
        self._download = downloader or self._default_download
        self._run = runner or self._default_run
        self._disk_usage = disk_usage or (lambda path: shutil.disk_usage(path).free)
        self._lock = threading.RLock()
        self._commit_lock = threading.RLock()
        self._jobs: dict[str, dict[str, Any]] = {}
        self._active_job_id: str | None = None
        self._latest_job_id: str | None = None
        self._sequence = 0
        self._leases: dict[str, VerifiedDependencySnapshot] = {}
        self._load_jobs()
        self.recover_after_restart()

    # -- paths ---------------------------------------------------------------

    @property
    def managed_root(self) -> Path:
        return self._root

    def _staging_dir(self, job_id: str) -> Path:
        return self._root / frozen.MANAGED_TOOL_STAGING_DIRNAME / job_id

    def _version_dir(self, sha256: str) -> Path:
        return (
            self._root
            / frozen.MANAGED_TOOL_VERSIONS_DIRNAME
            / "yt-dlp"
            / frozen.YT_DLP_VERSION
            / sha256
        )

    @property
    def _active_manifest_path(self) -> Path:
        return self._root / frozen.MANAGED_TOOL_ACTIVE_MANIFEST

    @property
    def _job_state_path(self) -> Path:
        return self._root / "dependency-jobs.json"

    def _load_jobs(self) -> None:
        try:
            payload = json.loads(self._job_state_path.read_text("utf-8"))
            jobs = payload.get("jobs")
            if not isinstance(jobs, dict):
                return
            self._jobs = {
                job_id: dict(job)
                for job_id, job in jobs.items()
                if is_valid_job_id(job_id) and isinstance(job, dict) and job.get("jobId") == job_id
            }
            active = payload.get("activeJobId")
            latest = payload.get("latestJobId")
            self._active_job_id = active if active in self._jobs else None
            self._latest_job_id = latest if latest in self._jobs else None
        except (OSError, json.JSONDecodeError, TypeError, ValueError):
            return

    def _persist_jobs(self) -> None:
        self._root.mkdir(parents=True, exist_ok=True)
        payload = {
            "schemaVersion": "v3-media-dependency-job-store/v1",
            "jobs": self._jobs,
            "activeJobId": self._active_job_id,
            "latestJobId": self._latest_job_id,
        }
        temporary = self._job_state_path.with_suffix(".json.part")
        temporary.write_text(json.dumps(payload, sort_keys=True, separators=(",", ":")), "utf-8")
        os.chmod(temporary, 0o600)
        os.replace(temporary, self._job_state_path)

    # -- restart recovery ----------------------------------------------------

    def recover_after_restart(self) -> None:
        """Fail every active job and re-verify from FINAL files only.

        Nothing about a remembered download is trusted: the manifest and the
        published executable on disk are the only evidence.
        """
        with self._lock:
            staging_root = self._root / frozen.MANAGED_TOOL_STAGING_DIRNAME
            if staging_root.is_dir():
                for entry in staging_root.iterdir():
                    if entry.is_dir():
                        shutil.rmtree(entry, ignore_errors=True)
            for job_id, job in list(self._jobs.items()):
                if job["state"] not in TERMINAL_JOB_STATES:
                    job.update(
                        state="failed",
                        cancelable=False,
                        failureCode="V3_MEDIA_DEPENDENCY_RUNTIME_RESTARTED",
                        updatedAt=self._now(),
                        finishedAt=self._now(),
                    )
                    self._active_job_id = None
            self._latest_job_id = self._latest_job_id or None
            self._persist_jobs()

    # -- verification --------------------------------------------------------

    def _read_active_manifest(self) -> dict[str, Any]:
        path = self._active_manifest_path
        if not path.is_file():
            return {}
        try:
            return json.loads(path.read_text("utf-8"))
        except (OSError, json.JSONDecodeError):
            return {}

    def _verify_managed_yt_dlp(self) -> DependencyState:
        descriptor = frozen.DESCRIPTORS_BY_ID["yt-dlp"]
        manifest = self._read_active_manifest()
        sha = manifest.get("sha256")
        if not isinstance(sha, str) or not frozen.SHA256_RE.fullmatch(sha):
            return self._state(descriptor, "missing", None, None, None, "V3_MEDIA_DEPENDENCY_NOT_READY")
        path = self._version_dir(sha) / "yt-dlp"
        if not path.is_file() or path.is_symlink():
            return self._state(descriptor, "missing", None, None, None, "V3_MEDIA_DEPENDENCY_NOT_READY")
        try:
            observed = sha256_file(path)
        except OSError:
            return self._state(descriptor, "missing", None, None, None, "V3_MEDIA_DEPENDENCY_NOT_READY")
        if observed != sha or sha != frozen.YT_DLP_EXPECTED_SHA256:
            return self._state(
                descriptor, "corrupt", manifest.get("version"), frozen.YT_DLP_EXPECTED_SHA256,
                observed, "V3_MEDIA_DEPENDENCY_HASH_MISMATCH",
            )
        return self._state(descriptor, "ready", manifest.get("version"), frozen.YT_DLP_EXPECTED_SHA256, observed, None, manifest.get("verifiedAt"))

    def _verify_system_tool(self, dependency_id: str, default_path: str, expected: str, version: str | None) -> DependencyState:
        descriptor = frozen.DESCRIPTORS_BY_ID[dependency_id]
        override = os.environ.get(f"NAVIA_MEDIA_{dependency_id.upper()}_PATH")
        path = Path(override or default_path)
        if not path.is_file() or path.is_symlink():
            return self._state(descriptor, "missing", version, expected, None, "V3_MEDIA_DEPENDENCY_SYSTEM_TOOL_MISSING")
        try:
            observed = sha256_file(path)
        except OSError:
            return self._state(descriptor, "missing", version, expected, None, "V3_MEDIA_DEPENDENCY_PERMISSION_DENIED")
        if observed != expected:
            return self._state(descriptor, "corrupt", version, expected, observed, "V3_MEDIA_DEPENDENCY_HASH_MISMATCH")
        return self._state(descriptor, "ready", version, expected, observed, None, self._now())

    def _verify_asr(self) -> DependencyState:
        """SenseVoice is DELEGATED: only the existing manager is read."""
        descriptor = frozen.DESCRIPTORS_BY_ID["sensevoice"]
        try:
            effective = self._asr_manager.settings()
        except Exception:
            return self._state(descriptor, "missing", None, None, None, "V3_MEDIA_DEPENDENCY_NOT_READY")
        effective_id = effective.get("effectiveModelId")
        if effective_id != "funasr-sensevoice-small-q8":
            return self._state(descriptor, "missing", effective_id, None, None, "V3_MEDIA_DEPENDENCY_NOT_READY")
        catalog_entry = next(
            (m for m in self._asr_manager.catalog()["models"] if m["modelId"] == effective_id),
            {},
        )
        if catalog_entry.get("installation", {}).get("state") != "ready":
            return self._state(descriptor, "missing", effective_id, None, None, "V3_MEDIA_DEPENDENCY_NOT_READY")
        return self._state(descriptor, "ready", effective_id, None, None, None, self._now())

    def _state(
        self,
        descriptor: DependencyDescriptor,
        state: str,
        version: str | None,
        expected: str | None,
        observed: str | None,
        failure_code: str | None,
        verified_at: str | None = None,
    ) -> DependencyState:
        return DependencyState(
            dependency_id=descriptor.dependency_id,
            required=descriptor.required,
            kind=descriptor.kind,
            install_mode=descriptor.install_mode,
            storage_scope=descriptor.storage_scope,
            state=state,
            version=version,
            expected_sha256=descriptor.expected_sha256,
            observed_sha256=observed,
            verified_at=verified_at,
            failure_code=failure_code,
        )

    # -- status --------------------------------------------------------------

    def dependency_states(self) -> list[DependencyState]:
        return [
            self._verify_managed_yt_dlp(),
            self._verify_system_tool("ffmpeg", frozen.FFMPEG_DEFAULT_PATH, frozen.FFMPEG_SHA256, frozen.FFMPEG_VERSION),
            self._verify_system_tool("ffprobe", frozen.FFPROBE_DEFAULT_PATH, frozen.FFPROBE_SHA256, None),
            self._verify_asr(),
        ]

    def status(self) -> dict[str, Any]:
        states = self.dependency_states()
        all_ready = all(entry.state == "ready" for entry in states)
        route_ready = all(
            entry.state == "ready"
            for entry in states
            if entry.dependency_id in {"yt-dlp", "ffmpeg", "ffprobe", "sensevoice"}
        ) and all_ready

        route_failure: str | None = None
        for entry in states:
            if entry.state != "ready" and entry.failure_code in {
                "V3_MEDIA_DEPENDENCY_SYSTEM_TOOL_MISSING",
                "V3_MEDIA_DEPENDENCY_NOT_READY",
                "V3_MEDIA_DEPENDENCY_HASH_MISMATCH",
                "V3_MEDIA_DEPENDENCY_SELF_TEST_FAILED",
            }:
                route_failure = entry.failure_code
                break

        snapshot = self._snapshot_from_states(states) if all_ready else None
        with self._lock:
            active_job_id = self._active_job_id
            latest_job_id = self._latest_job_id

        if active_job_id:
            overall = "installing"
        elif all_ready:
            # A failed repair never demotes a still-usable snapshot.
            overall = "ready"
        elif any(entry.state == "corrupt" for entry in states):
            overall = "failed"
        else:
            overall = "action_required"

        payload = {
            "schemaVersion": DEPENDENCY_STATUS_SCHEMA_VERSION,
            "overallState": overall,
            "generation": snapshot.generation if snapshot else None,
            "verifiedAt": snapshot.verified_at if snapshot else None,
            "activeJobId": active_job_id,
            "latestJobId": latest_job_id,
            "routeReadiness": {
                "credentialedMediaAsr": "ready" if route_ready else "blocked",
                "failureCode": None if route_ready else route_failure,
            },
            "dependencies": [entry.to_public() for entry in states],
        }
        semantic_validate_status(payload)
        return payload

    def _snapshot_from_states(self, states: list[DependencyState]) -> VerifiedDependencySnapshot | None:
        by_id = {entry.dependency_id: entry for entry in states}
        if not all(entry.state == "ready" for entry in states):
            return None
        manifest = self._read_active_manifest()
        asr_settings = self._asr_manager.settings()
        asr_entry = next(
            (m for m in self._asr_manager.catalog()["models"] if m["modelId"] == asr_settings.get("effectiveModelId")),
            {},
        )
        return VerifiedDependencySnapshot.build(
            verified_at=self._now(),
            yt_dlp={
                "path": str(self._version_dir(manifest["sha256"]) / "yt-dlp"),
                "version": by_id["yt-dlp"].version,
                "byteLength": frozen.YT_DLP_EXPECTED_BYTES,
                "sha256": by_id["yt-dlp"].observed_sha256,
            },
            ffmpeg={
                "path": os.environ.get("NAVIA_MEDIA_FFMPEG_PATH", frozen.FFMPEG_DEFAULT_PATH),
                "version": frozen.FFMPEG_VERSION,
                "sha256": by_id["ffmpeg"].observed_sha256,
            },
            ffprobe={
                "path": os.environ.get("NAVIA_MEDIA_FFPROBE_PATH", frozen.FFPROBE_DEFAULT_PATH),
                "sha256": by_id["ffprobe"].observed_sha256,
            },
            asr={
                "effectiveModelId": asr_settings.get("effectiveModelId"),
                "catalogRevision": asr_entry.get("revision"),
                "modelRoot": None,
                "assetSetDigest": None,
            },
        )

    # -- jobs ----------------------------------------------------------------

    def _new_job_id(self) -> str:
        return JOB_ID_PREFIX + hashlib.sha256(os.urandom(16)).hexdigest()[:32]

    def _public_job(self, job: dict[str, Any]) -> dict[str, Any]:
        return {
            "schemaVersion": DEPENDENCY_INSTALLATION_SCHEMA_VERSION,
            "jobId": job["jobId"],
            "dependencyIds": list(job["dependencyIds"]),
            "state": job["state"],
            "cancelable": job["cancelable"],
            "progress": dict(job["progress"]),
            "failureCode": job["failureCode"],
            "publishedGeneration": job["publishedGeneration"],
            "sequence": job["sequence"],
            "createdAt": job["createdAt"],
            "updatedAt": job["updatedAt"],
            "finishedAt": job["finishedAt"],
        }

    def _advance(self, job: dict[str, Any], state: str, **fields: Any) -> None:
        if job["state"] in TERMINAL_JOB_STATES:
            return
        job["state"] = state
        job["cancelable"] = state in CANCELABLE_JOB_STATES
        job.update(fields)
        job["sequence"] += 1
        job["updatedAt"] = self._now()
        self._persist_jobs()

    def start_install(self, dependency_ids: list[str]) -> dict[str, Any]:
        """Start the ONE repair job. A second concurrent request is refused."""
        if not isinstance(dependency_ids, list) or not dependency_ids:
            raise MediaDependencyError("REQUEST_INVALID", "dependencyIds must be a non-empty list.")
        if sorted(dependency_ids) != ["yt-dlp"] or len(dependency_ids) != 1:
            raise MediaDependencyError("REQUEST_INVALID", "Only yt-dlp may be installed.")
        with self._lock:
            if self._active_job_id is not None:
                active = self._jobs[self._active_job_id]
                if active["state"] not in TERMINAL_JOB_STATES:
                    raise MediaDependencyError(
                        "JOB_ACTIVE", "A repair job is already running.", details={"jobId": active["jobId"]}
                    )
            job_id = self._new_job_id()
            job = {
                "jobId": job_id,
                "dependencyIds": list(dependency_ids),
                "state": "checking",
                "cancelable": True,
                "progress": {"stage": "checking", "percent": 0, "bytesCompleted": 0, "bytesTotal": 0},
                "failureCode": None,
                "publishedGeneration": None,
                "sequence": 0,
                "createdAt": self._now(),
                "updatedAt": self._now(),
                "finishedAt": None,
            }
            self._jobs[job_id] = job
            self._active_job_id = job_id
            self._latest_job_id = job_id
            self._persist_jobs()
            return self._public_job(job)

    def job(self, job_id: str) -> dict[str, Any]:
        if not is_valid_job_id(job_id):
            raise MediaDependencyError("JOB_NOT_FOUND", "Repair job was not found.")
        with self._lock:
            job = self._jobs.get(job_id)
        if job is None:
            raise MediaDependencyError("JOB_NOT_FOUND", "Repair job was not found.")
        return self._public_job(job)

    def cancel(self, job_id: str) -> dict[str, Any]:
        with self._lock:
            job = self._jobs.get(job_id)
        if job is None:
            raise MediaDependencyError("JOB_NOT_FOUND", "Repair job was not found.")
        if job["state"] in TERMINAL_JOB_STATES:
            return self._public_job(job)
        if job["state"] in NON_CANCELABLE_JOB_STATES:
            # `installing` is the atomic commit window: the commit wins.
            return self._public_job(job)
        self._advance(job, "cancelling")
        self._advance(
            job,
            "cancelled",
            failureCode=None,
            progress=dict(job["progress"]),
            finishedAt=self._now(),
        )
        self._remove_staging(job_id)
        with self._lock:
            if self._active_job_id == job_id:
                self._active_job_id = None
            self._persist_jobs()
        return self._public_job(job)

    def _remove_staging(self, job_id: str) -> None:
        shutil.rmtree(self._staging_dir(job_id), ignore_errors=True)

    # -- job execution -------------------------------------------------------

    def run_job(self, job_id: str, *, cancel_requested: Callable[[str], bool] | None = None) -> dict[str, Any]:
        """Execute ONE repair job end to end.

        Stages are exactly the frozen phase order. Every cancellable stage
        re-checks for cancellation BEFORE doing irreversible work, and the
        atomic commit is guarded by its own lock so a cancel racing a commit
        has exactly two legal outcomes.
        """
        job = self._jobs[job_id]
        wants_cancel = cancel_requested or (lambda _job_id: False)

        def cancelled() -> bool:
            return wants_cancel(job_id) or job["state"] in {"cancelling", "cancelled"}

        try:
            self._advance(job, "checking")
            if cancelled():
                return self._settle_cancel(job)

            # Space is checked BEFORE any download, never after.
            free = self._disk_usage(self._root)
            if free < frozen.INSTALL_FREE_SPACE_BYTES:
                raise MediaDependencyError("DISK_SPACE_LOW", "Not enough free space to install.")

            self._advance(job, "downloading", progress={"stage": "downloading", "percent": 0, "bytesCompleted": 0, "bytesTotal": frozen.YT_DLP_EXPECTED_BYTES})
            staging = self._staging_dir(job_id)
            staging.mkdir(parents=True, exist_ok=True)
            os.chmod(staging, 0o700)
            part = staging / frozen.MANAGED_TOOL_PART_NAME
            if cancelled():
                return self._settle_cancel(job)
            written, _content_type = self._download(frozen.YT_DLP_SOURCE_URL, part)
            if written != frozen.YT_DLP_EXPECTED_BYTES:
                part.unlink(missing_ok=True)
                raise MediaDependencyError("SIZE_MISMATCH", "Downloaded length is not the frozen length.")

            self._advance(job, "verifying", progress={"stage": "verifying", "percent": 70, "bytesCompleted": written, "bytesTotal": frozen.YT_DLP_EXPECTED_BYTES})
            if cancelled():
                return self._settle_cancel(job)
            digest = sha256_file(part)
            if digest != frozen.YT_DLP_EXPECTED_SHA256:
                part.unlink(missing_ok=True)
                raise MediaDependencyError("HASH_MISMATCH", "Downloaded digest is not the frozen digest.")

            self._advance(job, "self_testing", progress={"stage": "self_testing", "percent": 85, "bytesCompleted": written, "bytesTotal": frozen.YT_DLP_EXPECTED_BYTES})
            if cancelled():
                return self._settle_cancel(job)
            os.chmod(part, 0o700)
            completed = self._run(
                frozen.self_test_command(str(part)), timeout=frozen.SELF_TEST_DEADLINE_SECONDS
            )
            if completed.returncode != 0 or completed.stdout.strip() != frozen.YT_DLP_VERSION:
                raise MediaDependencyError("SELF_TEST_FAILED", "The installed tool failed its self-test.")

            # Atomic commit window: NOT cancellable, guarded by its own lock.
            with self._commit_lock:
                self._advance(job, "installing", progress={"stage": "installing", "percent": 100, "bytesCompleted": written, "bytesTotal": frozen.YT_DLP_EXPECTED_BYTES})
                target_dir = self._version_dir(digest)
                target_dir.mkdir(parents=True, exist_ok=True)
                os.chmod(target_dir, 0o700)
                target = target_dir / "yt-dlp"
                os.replace(part, target)
                os.chmod(target, 0o700)
                # fsync the file, then the parent directory, then the manifest.
                self._fsync_path(target)
                self._fsync_path(target_dir)
                manifest = {"sha256": digest, "version": frozen.YT_DLP_VERSION, "verifiedAt": self._now()}
                manifest_path = self._active_manifest_path
                temporary = manifest_path.with_suffix(".json.part")
                temporary.write_text(json.dumps(manifest, sort_keys=True), "utf-8")
                os.replace(temporary, manifest_path)
                self._fsync_path(manifest_path)

            snapshot = self._snapshot_from_states(self.dependency_states())
            generation = snapshot.generation if snapshot else None
            self._advance(
                job,
                "ready",
                publishedGeneration=generation,
                progress={"stage": "ready", "percent": 100, "bytesCompleted": written, "bytesTotal": written},
                finishedAt=self._now(),
            )
            self._remove_staging(job_id)
            with self._lock:
                if self._active_job_id == job_id:
                    self._active_job_id = None
                self._persist_jobs()
            return self._public_job(job)
        except MediaDependencyError as error:
            self._remove_staging(job_id)
            self._advance(
                job,
                "failed",
                failureCode=error.code,
                progress=dict(job["progress"]),
                finishedAt=self._now(),
            )
            with self._lock:
                if self._active_job_id == job_id:
                    self._active_job_id = None
                self._persist_jobs()
            return self._public_job(job)

    def _settle_cancel(self, job: dict[str, Any]) -> dict[str, Any]:
        self._remove_staging(job["jobId"])
        self._advance(job, "cancelled", progress=dict(job["progress"]), finishedAt=self._now())
        with self._lock:
            if self._active_job_id == job["jobId"]:
                self._active_job_id = None
            self._persist_jobs()
        return self._public_job(job)

    @staticmethod
    def _fsync_path(path: Path) -> None:
        descriptor = os.open(path, os.O_RDONLY)
        try:
            os.fsync(descriptor)
        finally:
            os.close(descriptor)

    # -- task leases ---------------------------------------------------------

    def acquire_snapshot(self, task_id: str) -> VerifiedDependencySnapshot | None:
        """Bind ONE snapshot for a task. Published generations never hot-swap it."""
        with self._lock:
            existing = self._leases.get(task_id)
            if existing is not None:
                return existing
        states = self.dependency_states()
        if not all(entry.state == "ready" for entry in states):
            return None
        snapshot = self._snapshot_from_states(states)
        if snapshot is None:
            return None
        with self._lock:
            self._leases.setdefault(task_id, snapshot)
            return self._leases[task_id]

    def release_lease(self, task_id: str) -> None:
        with self._lock:
            self._leases.pop(task_id, None)

    def leased_snapshot(self, task_id: str) -> VerifiedDependencySnapshot | None:
        with self._lock:
            return self._leases.get(task_id)

    # -- default primitives --------------------------------------------------

    def _default_run(self, command: list[str], *, timeout: float) -> subprocess.CompletedProcess[str]:
        with contextlib.suppress(subprocess.TimeoutExpired):
            pass
        return subprocess.run(  # noqa: S603 - frozen, allowlisted command
            command,
            capture_output=True,
            text=True,
            timeout=timeout,
            stdin=subprocess.DEVNULL,
            check=False,
        )

    def _default_download(self, url: str, destination: Path) -> tuple[int, Any]:
        """Download ONE frozen asset with the frozen redirect/host policy."""
        started = time.monotonic()
        opener = urllib.request.build_opener(_NoRedirect())
        current_url = url
        redirects = 0
        attempts = 0
        while True:
            parsed = urllib.parse.urlparse(current_url)
            if parsed.scheme != "https" or parsed.hostname not in frozen.ALLOWED_SOURCE_HOSTS:
                raise MediaDependencyError("SOURCE_NOT_ALLOWED", "Download source is not allowed.")
            if time.monotonic() - started > frozen.DOWNLOAD_DEADLINE_SECONDS:
                raise MediaDependencyError("TIMEOUT", "Download deadline was exceeded.")
            request = urllib.request.Request(current_url, headers={"User-Agent": "Navia-Media-Dependency-Manager/1"})
            try:
                with opener.open(request, timeout=frozen.READ_TIMEOUT_SECONDS) as response:
                    declared = response.headers.get("Content-Length")
                    if declared is not None and int(declared) != frozen.YT_DLP_EXPECTED_BYTES:
                        raise MediaDependencyError("SIZE_MISMATCH", "Download length is not the frozen length.")
                    written = 0
                    destination.parent.mkdir(parents=True, exist_ok=True)
                    os.chmod(destination.parent, 0o700)
                    with destination.open("wb") as handle:
                        os.chmod(destination, 0o600)
                        while True:
                            if time.monotonic() - started > frozen.DOWNLOAD_DEADLINE_SECONDS:
                                raise MediaDependencyError("TIMEOUT", "Download deadline was exceeded.")
                            block = response.read(64 * 1024)
                            if not block:
                                break
                            written += len(block)
                            if written > frozen.YT_DLP_EXPECTED_BYTES:
                                raise MediaDependencyError("SIZE_MISMATCH", "Download exceeded the frozen length.")
                            handle.write(block)
                        handle.flush()
                        os.fsync(handle.fileno())
                    return written, response.headers.get("Content-Type")
            except urllib.error.HTTPError as error:
                if error.code in {301, 302, 303, 307, 308}:
                    location = error.headers.get("Location")
                    redirects += 1
                    if not location or redirects > frozen.MAX_REDIRECTS:
                        raise MediaDependencyError("SOURCE_NOT_ALLOWED", "Too many redirects.") from None
                    current_url = urllib.parse.urljoin(current_url, location)
                    continue
                if 500 <= error.code < 600:
                    attempts += 1
                    destination.unlink(missing_ok=True)
                    if attempts <= frozen.MAX_DOWNLOAD_RETRIES:
                        continue
                    raise MediaDependencyError("NETWORK_FAILED", "Upstream returned a server error.") from None
                raise MediaDependencyError("NETWORK_FAILED", "Upstream rejected the download.") from None
            except MediaDependencyError:
                raise
            except (TimeoutError, socket.timeout):
                attempts += 1
                destination.unlink(missing_ok=True)
                if attempts <= frozen.MAX_DOWNLOAD_RETRIES:
                    continue
                raise MediaDependencyError("TIMEOUT", "Download timed out.") from None
            except (urllib.error.URLError, OSError):
                attempts += 1
                destination.unlink(missing_ok=True)
                if attempts <= frozen.MAX_DOWNLOAD_RETRIES:
                    continue
                raise MediaDependencyError("NETWORK_FAILED", "Download could not be completed.") from None


def build_media_dependency_manager(*, asr_manager: Any, db_path: Path) -> MediaDependencyManager:
    return MediaDependencyManager(asr_manager=asr_manager, managed_root=default_managed_root(db_path))
