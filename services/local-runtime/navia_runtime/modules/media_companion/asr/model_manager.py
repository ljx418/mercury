from __future__ import annotations

import hashlib
import json
import os
import shutil
import stat
import tarfile
import threading
import time
import urllib.request
import wave
import zipfile
from collections.abc import Callable
from datetime import UTC, datetime
from pathlib import Path, PurePosixPath
from typing import Any
from urllib.parse import urlparse
from uuid import uuid4

from .catalog import ASR_MODEL_BY_ID, ASR_MODELS, ASR_PROVIDERS, DEFAULT_ASR_MODEL_ID, FALLBACK_ASR_MODEL_ID, AsrModelDescriptor


TERMINAL_JOB_STATES = {"ready", "failed", "corrupt", "cancelled"}
ACTIVE_JOB_STATES = {"checking", "downloading", "verifying", "installing", "self_testing", "cancelling"}
MAX_OFFLINE_PACKAGE_BYTES = 2_200_000_000
MAX_OFFLINE_PACKAGE_FILES = 32
DEFAULT_MODEL_SOURCE_HOSTS = frozenset({"github.com", "huggingface.co", "cdn-lfs.hf.co", "cdn-lfs.huggingface.co", "cas-bridge.xethub.hf.co", "release-assets.githubusercontent.com"})
DEFAULT_MODEL_SOURCE_HOST_SUFFIXES = (".cdn.hf.co", ".githubusercontent.com", ".hf.co", ".xethub.hf.co")


def utc_now() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


class AsrModelManagerError(RuntimeError):
    def __init__(self, code: str, message: str, *, status: int = 400):
        super().__init__(message)
        self.code = code
        self.status = status


class _JobCancelled(RuntimeError):
    pass


class _AllowlistedRedirectHandler(urllib.request.HTTPRedirectHandler):
    def __init__(self, validate_url: Callable[[str], None]):
        super().__init__()
        self._validate_url = validate_url

    def redirect_request(self, request, file_pointer, code, message, headers, new_url):
        self._validate_url(new_url)
        return super().redirect_request(request, file_pointer, code, message, headers, new_url)


class AsrModelManager:
    def __init__(
        self,
        root: Path,
        *,
        bundled_root: Path | None = None,
        self_test: Callable[[AsrModelDescriptor, Path], None] | None = None,
        chunk_size: int = 1024 * 1024,
        source_host_allowlist: frozenset[str] = DEFAULT_MODEL_SOURCE_HOSTS,
        source_host_suffix_allowlist: tuple[str, ...] = DEFAULT_MODEL_SOURCE_HOST_SUFFIXES,
        allow_http_sources: bool = False,
    ):
        self.root = root.resolve()
        self.models_root = self.root / "models"
        self.staging_root = self.root / "staging"
        self.import_root = self.root / "imports"
        self.state_path = self.root / "state.json"
        self.bundled_root = bundled_root.resolve() if bundled_root else None
        self._self_test = self_test or self._default_self_test
        self._chunk_size = chunk_size
        self._source_host_allowlist = source_host_allowlist
        self._source_host_suffix_allowlist = source_host_suffix_allowlist
        self._allow_http_sources = allow_http_sources
        self._lock = threading.RLock()
        self._cancel_events: dict[str, threading.Event] = {}
        self._threads: dict[str, threading.Thread] = {}
        for directory in (self.root, self.models_root, self.staging_root, self.import_root):
            directory.mkdir(parents=True, exist_ok=True)
            try:
                directory.chmod(0o700)
            except OSError:
                pass
        self._state = self._read_state()
        self._recover_interrupted_jobs()
        self._model_states = self._inspect_models()

    def catalog(self) -> dict[str, Any]:
        with self._lock:
            models = []
            for descriptor in ASR_MODELS:
                item = descriptor.public_dict()
                item["installation"] = dict(self._model_states[descriptor.model_id])
                models.append(item)
            return {
                "schemaVersion": "v3-asr-model-catalog/v1",
                "providers": [provider.public_dict() for provider in ASR_PROVIDERS],
                "models": models,
                "lowResourceBaseline": {"cpuCores": 8, "ramBytes": 8 * 1024**3, "gpuRequired": False},
            }

    def settings(self) -> dict[str, Any]:
        with self._lock:
            requested = self._state.get("requestedModelId", DEFAULT_ASR_MODEL_ID)
            effective, reason = self._resolve_effective(requested)
            return {
                "schemaVersion": "v3-asr-selection/v1",
                "requestedModelId": requested,
                "effectiveModelId": effective,
                "fallbackActive": effective is not None and effective != requested,
                "fallbackReason": reason,
                "updatedAt": self._state.get("updatedAt"),
            }

    def patch_settings(self, payload: dict[str, Any]) -> dict[str, Any]:
        model_id = payload.get("requestedModelId")
        descriptor = ASR_MODEL_BY_ID.get(model_id) if isinstance(model_id, str) else None
        if descriptor is None:
            raise AsrModelManagerError("V3_ASR_MODEL_UNKNOWN", "ASR model is not in the immutable catalog.", status=404)
        if not descriptor.selectable:
            raise AsrModelManagerError("V3_ASR_MODEL_NOT_QUALIFIED", "ASR model cannot be selected before qualification.", status=409)
        with self._lock:
            if self._model_states.get(descriptor.model_id, {}).get("state") != "ready":
                raise AsrModelManagerError(
                    "V3_ASR_MODEL_NOT_READY",
                    "ASR model must be installed and verified before selection.",
                    status=409,
                )
            self._state["requestedModelId"] = descriptor.model_id
            self._state["updatedAt"] = utc_now()
            self._write_state()
            return self.settings()

    def start_install(self, model_id: str, *, asynchronous: bool = True) -> dict[str, Any]:
        descriptor = self._installable_descriptor(model_id)
        if descriptor.bundled:
            raise AsrModelManagerError("V3_ASR_BUNDLED_MODEL_IMMUTABLE", "Bundled ASR model is managed by the Runtime release.", status=409)
        with self._lock:
            self._assert_no_active_job(model_id)
            job = self._new_job(model_id, "remote")
            self._cancel_events[job["jobId"]] = threading.Event()
        if asynchronous:
            thread = threading.Thread(target=self._run_remote_install, args=(job["jobId"],), daemon=True, name=f"navia-asr-{job['jobId']}")
            with self._lock:
                self._threads[job["jobId"]] = thread
            thread.start()
        else:
            self._run_remote_install(job["jobId"])
        return self.get_job(job["jobId"])

    def create_import_path(self, model_id: str) -> tuple[str, Path]:
        descriptor = self._installable_descriptor(model_id)
        if descriptor.bundled:
            raise AsrModelManagerError("V3_ASR_BUNDLED_MODEL_IMMUTABLE", "Bundled ASR model cannot be imported.", status=409)
        upload_id = f"upload_{uuid4().hex}"
        return upload_id, self.import_root / f"{upload_id}.navia-asrpack"

    def start_import(self, model_id: str, package_path: Path, *, asynchronous: bool = True) -> dict[str, Any]:
        self._installable_descriptor(model_id)
        if package_path.parent.resolve() != self.import_root:
            raise AsrModelManagerError("V3_ASR_IMPORT_PATH_INVALID", "Offline package is outside the controlled import root.")
        with self._lock:
            self._assert_no_active_job(model_id)
            job = self._new_job(model_id, "offline_package")
            self._cancel_events[job["jobId"]] = threading.Event()
        if asynchronous:
            thread = threading.Thread(target=self._run_import, args=(job["jobId"], package_path), daemon=True, name=f"navia-asr-{job['jobId']}")
            with self._lock:
                self._threads[job["jobId"]] = thread
            thread.start()
        else:
            self._run_import(job["jobId"], package_path)
        return self.get_job(job["jobId"])

    def cancel_job(self, job_id: str) -> dict[str, Any]:
        with self._lock:
            job = self._job(job_id)
            if job["state"] in TERMINAL_JOB_STATES:
                return dict(job)
            event = self._cancel_events.get(job_id)
            if event is None:
                raise AsrModelManagerError("V3_ASR_JOB_NOT_ACTIVE", "Installation job is not active.", status=409)
            event.set()
            self._update_job(job_id, state="cancelling", message="Cancelling and cleaning temporary files.")
            return dict(self._job(job_id))

    def get_job(self, job_id: str) -> dict[str, Any]:
        with self._lock:
            return dict(self._job(job_id))

    def list_jobs(self) -> list[dict[str, Any]]:
        with self._lock:
            return [dict(job) for job in self._state.get("jobs", {}).values()]

    def uninstall(self, model_id: str) -> dict[str, Any]:
        descriptor = ASR_MODEL_BY_ID.get(model_id)
        if descriptor is None:
            raise AsrModelManagerError("V3_ASR_MODEL_UNKNOWN", "ASR model is not in the immutable catalog.", status=404)
        if descriptor.bundled:
            raise AsrModelManagerError("V3_ASR_BUNDLED_MODEL_IMMUTABLE", "Bundled fallback cannot be removed.", status=409)
        with self._lock:
            self._assert_no_active_job(model_id)
            target = self.models_root / model_id
            if target.exists():
                shutil.rmtree(target)
            self._model_states[model_id] = {"state": "not_installed", "verifiedAt": None}
            if self._state.get("requestedModelId") == model_id:
                self._state["requestedModelId"] = FALLBACK_ASR_MODEL_ID
                self._state["updatedAt"] = utc_now()
            self._write_state()
            return self.settings()

    def wait(self, job_id: str, timeout: float = 30.0) -> dict[str, Any]:
        thread = self._threads.get(job_id)
        if thread:
            thread.join(timeout)
        return self.get_job(job_id)

    def model_path(self, model_id: str) -> Path | None:
        descriptor = ASR_MODEL_BY_ID.get(model_id)
        if not descriptor:
            return None
        if descriptor.bundled:
            candidate = self.bundled_root / model_id if self.bundled_root else None
        else:
            candidate = self.models_root / model_id
        return candidate if candidate and candidate.is_dir() else None

    def _run_remote_install(self, job_id: str) -> None:
        job = self.get_job(job_id)
        descriptor = ASR_MODEL_BY_ID[job["modelId"]]
        stage = self.staging_root / job_id
        try:
            self._transition(job_id, "checking", "Checking catalog and disk target.")
            self._prepare_stage(stage)
            self._transition(job_id, "downloading", "Downloading verified model assets.")
            transfer_started = time.monotonic()
            source_root = stage / "source"
            for expected in descriptor.files:
                self._check_cancel(job_id)
                if not expected.source_url:
                    raise AsrModelManagerError("V3_ASR_SOURCE_NOT_FROZEN", "Catalog source is not frozen.", status=409)
                self._download_file(
                    job_id,
                    expected.source_url,
                    source_root / expected.path,
                    expected.byte_length,
                    transfer_started,
                )
            self._finish_install(job_id, descriptor, stage)
        except _JobCancelled:
            self._finish_cancelled(job_id, stage)
        except AsrModelManagerError as exc:
            self._finish_failed(job_id, stage, exc.code, str(exc), corrupt=exc.code == "V3_ASR_HASH_MISMATCH")
        except Exception:
            self._finish_failed(job_id, stage, "V3_ASR_INSTALL_FAILED", "ASR model installation failed.")

    def _run_import(self, job_id: str, package_path: Path) -> None:
        job = self.get_job(job_id)
        descriptor = ASR_MODEL_BY_ID[job["modelId"]]
        stage = self.staging_root / job_id
        try:
            self._transition(job_id, "checking", "Checking offline package.")
            self._prepare_stage(stage)
            self._extract_package(job_id, descriptor, package_path, stage)
            self._finish_install(job_id, descriptor, stage)
        except _JobCancelled:
            self._finish_cancelled(job_id, stage)
        except AsrModelManagerError as exc:
            self._finish_failed(job_id, stage, exc.code, str(exc), corrupt=exc.code in {"V3_ASR_HASH_MISMATCH", "V3_ASR_PACKAGE_INVALID"})
        except Exception:
            self._finish_failed(job_id, stage, "V3_ASR_IMPORT_FAILED", "Offline ASR package import failed.")
        finally:
            package_path.unlink(missing_ok=True)

    def _finish_install(self, job_id: str, descriptor: AsrModelDescriptor, stage: Path) -> None:
        self._check_cancel(job_id)
        source_root = stage / "source"
        install_root = stage / "install"
        self._transition(job_id, "verifying", "Verifying source asset sizes and SHA-256 hashes.")
        self._verify_source_directory(descriptor, source_root)
        self._check_cancel(job_id)
        with self._lock:
            self._update_job(job_id, message="Materializing the frozen runtime and model file set under verification.")
        self._materialize_installation(descriptor, source_root, install_root)
        self._verify_directory(descriptor, install_root)
        self._check_cancel(job_id)
        self._transition(job_id, "self_testing", "Loading model locally for self-test.")
        self._self_test(descriptor, install_root)
        self._check_cancel(job_id)
        self._transition(job_id, "installing", "Publishing verified model atomically.")
        target = self.models_root / descriptor.model_id
        backup = self.staging_root / f"{job_id}.previous"
        if backup.exists():
            shutil.rmtree(backup)
        if target.exists():
            self._rename_with_retry(target, backup)
        try:
            self._rename_with_retry(install_root, target)
        except Exception:
            if backup.exists() and not target.exists():
                self._rename_with_retry(backup, target)
            raise
        if backup.exists():
            shutil.rmtree(backup)
        if stage.exists():
            shutil.rmtree(stage)
        with self._lock:
            self._model_states[descriptor.model_id] = {"state": "ready", "verifiedAt": utc_now()}
            self._update_job(job_id, state="ready", message="Model is verified and ready.", percent=100.0, finishedAt=utc_now())

    def _download_file(
        self,
        job_id: str,
        url: str,
        destination: Path,
        expected_size: int,
        transfer_started: float,
    ) -> None:
        destination.parent.mkdir(parents=True, exist_ok=True)
        self._validate_source_url(url)
        request = urllib.request.Request(url, headers={"User-Agent": "Navia-ASR-Model-Manager/1"})
        opener = urllib.request.build_opener(_AllowlistedRedirectHandler(self._validate_source_url))
        with opener.open(request, timeout=60) as response, destination.open("wb") as output:
            try:
                destination.chmod(0o600)
            except OSError:
                pass
            written = 0
            while True:
                self._check_cancel(job_id)
                chunk = response.read(self._chunk_size)
                if not chunk:
                    break
                written += len(chunk)
                if written > expected_size:
                    raise AsrModelManagerError("V3_ASR_SIZE_MISMATCH", "Downloaded model file exceeded its frozen byte length.")
                output.write(chunk)
                self._record_bytes(job_id, len(chunk), transfer_started)
        if written != expected_size:
            raise AsrModelManagerError("V3_ASR_SIZE_MISMATCH", "Downloaded model file did not match its frozen byte length.")

    def _validate_source_url(self, value: str) -> None:
        parsed = urlparse(value)
        allowed_schemes = {"https"} | ({"http"} if self._allow_http_sources else set())
        hostname = parsed.hostname or ""
        allowed_host = hostname in self._source_host_allowlist or any(
            hostname.endswith(suffix) and hostname != suffix.removeprefix(".")
            for suffix in self._source_host_suffix_allowlist
        )
        if parsed.scheme not in allowed_schemes or parsed.username or parsed.password or not allowed_host:
            raise AsrModelManagerError("V3_ASR_SOURCE_NOT_ALLOWED", "Model source or redirect target is not allowlisted.", status=409)

    def _extract_package(self, job_id: str, descriptor: AsrModelDescriptor, package_path: Path, stage: Path) -> None:
        if package_path.stat().st_size > MAX_OFFLINE_PACKAGE_BYTES:
            raise AsrModelManagerError("V3_ASR_PACKAGE_TOO_LARGE", "Offline ASR package exceeds the size limit.", status=413)
        with zipfile.ZipFile(package_path) as archive:
            infos = archive.infolist()
            if len(infos) > MAX_OFFLINE_PACKAGE_FILES:
                raise AsrModelManagerError("V3_ASR_PACKAGE_INVALID", "Offline ASR package contains too many files.")
            names = {info.filename for info in infos}
            if "manifest.json" not in names:
                raise AsrModelManagerError("V3_ASR_PACKAGE_INVALID", "Offline ASR package has no manifest.")
            try:
                manifest = json.loads(archive.read("manifest.json"))
            except (json.JSONDecodeError, UnicodeDecodeError, KeyError):
                raise AsrModelManagerError("V3_ASR_PACKAGE_INVALID", "Offline ASR package manifest is invalid.") from None
            if manifest.get("schemaVersion") != "v3-asr-offline-package/v1" or manifest.get("modelId") != descriptor.model_id or manifest.get("revision") != descriptor.revision:
                raise AsrModelManagerError("V3_ASR_PACKAGE_MODEL_MISMATCH", "Offline package does not match the selected immutable model.")
            manifest_files = manifest.get("files")
            expected_manifest_files = [
                {"path": item.path, "byteLength": item.byte_length, "sha256": item.sha256}
                for item in descriptor.files
            ]
            if manifest_files != expected_manifest_files:
                raise AsrModelManagerError("V3_ASR_PACKAGE_INVALID", "Offline package manifest file metadata does not match the catalog.")
            expected_names = {item.path for item in descriptor.files}
            if names != expected_names | {"manifest.json"}:
                raise AsrModelManagerError("V3_ASR_PACKAGE_INVALID", "Offline package file set does not match the catalog.")
            total_uncompressed = 0
            for info in infos:
                path = PurePosixPath(info.filename)
                mode = info.external_attr >> 16
                file_type = stat.S_IFMT(mode)
                if path.is_absolute() or ".." in path.parts or file_type not in {0, stat.S_IFREG}:
                    raise AsrModelManagerError("V3_ASR_PACKAGE_INVALID", "Offline package contains an unsafe path or link.")
                total_uncompressed += info.file_size
            if total_uncompressed > MAX_OFFLINE_PACKAGE_BYTES:
                raise AsrModelManagerError("V3_ASR_PACKAGE_TOO_LARGE", "Offline package expands beyond the size limit.", status=413)
            source_root = stage / "source"
            self._transition(job_id, "installing", "Extracting offline package into source staging.")
            transfer_started = time.monotonic()
            for expected in descriptor.files:
                self._check_cancel(job_id)
                destination = source_root / expected.path
                destination.parent.mkdir(parents=True, exist_ok=True)
                with archive.open(expected.path) as source, destination.open("wb") as output:
                    copied = 0
                    while True:
                        chunk = source.read(self._chunk_size)
                        if not chunk:
                            break
                        copied += len(chunk)
                        if copied > expected.byte_length:
                            raise AsrModelManagerError("V3_ASR_SIZE_MISMATCH", "Offline model file exceeded its frozen byte length.")
                        output.write(chunk)
                        self._record_bytes(job_id, len(chunk), transfer_started)

    def _verify_source_directory(self, descriptor: AsrModelDescriptor, directory: Path) -> None:
        expected_paths = {item.path for item in descriptor.files}
        actual_paths = {str(path.relative_to(directory).as_posix()) for path in directory.rglob("*") if path.is_file()}
        if actual_paths != expected_paths:
            raise AsrModelManagerError("V3_ASR_FILE_SET_MISMATCH", "Installed ASR model file set does not match the catalog.")
        for expected in descriptor.files:
            path = directory / expected.path
            if path.is_symlink() or not path.is_file() or path.stat().st_nlink != 1:
                raise AsrModelManagerError("V3_ASR_FILE_TYPE_INVALID", "Installed ASR model contains a link or non-regular file.")
            if path.stat().st_size != expected.byte_length:
                raise AsrModelManagerError("V3_ASR_SIZE_MISMATCH", "Installed ASR model file size does not match the catalog.")
            digest = hashlib.sha256()
            with path.open("rb") as handle:
                for chunk in iter(lambda: handle.read(self._chunk_size), b""):
                    digest.update(chunk)
            if digest.hexdigest() != expected.sha256:
                raise AsrModelManagerError("V3_ASR_HASH_MISMATCH", "Installed ASR model hash does not match the catalog.")

    def _verify_directory(self, descriptor: AsrModelDescriptor, directory: Path) -> None:
        expected_paths = {item.published_path for item in descriptor.files}
        actual_paths = {str(path.relative_to(directory).as_posix()) for path in directory.rglob("*") if path.is_file()}
        if actual_paths != expected_paths:
            raise AsrModelManagerError("V3_ASR_FILE_SET_MISMATCH", "Published ASR file set does not match the catalog.")
        for expected in descriptor.files:
            path = directory / expected.published_path
            if path.is_symlink() or not path.is_file() or path.stat().st_nlink != 1:
                raise AsrModelManagerError("V3_ASR_FILE_TYPE_INVALID", "Published ASR model contains a link or non-regular file.")
            if path.stat().st_size != expected.published_byte_length:
                raise AsrModelManagerError("V3_ASR_SIZE_MISMATCH", "Published ASR file size does not match the catalog.")
            digest = hashlib.sha256()
            with path.open("rb") as handle:
                for chunk in iter(lambda: handle.read(self._chunk_size), b""):
                    digest.update(chunk)
            if digest.hexdigest() != expected.published_sha256:
                raise AsrModelManagerError("V3_ASR_HASH_MISMATCH", "Published ASR file hash does not match the catalog.")
            if expected.executable and os.name != "nt" and not os.access(path, os.X_OK):
                raise AsrModelManagerError("V3_ASR_FILE_MODE_INVALID", "Published ASR runtime is not executable.")

    def _materialize_installation(self, descriptor: AsrModelDescriptor, source_root: Path, install_root: Path) -> None:
        if install_root.exists():
            shutil.rmtree(install_root)
        install_root.mkdir(parents=True, mode=0o700)
        for expected in descriptor.files:
            source = source_root / expected.path
            destination = install_root / expected.published_path
            destination.parent.mkdir(parents=True, exist_ok=True)
            if expected.archive_member:
                self._extract_frozen_archive_member(source, expected.archive_member, destination, expected.published_byte_length)
            else:
                shutil.copyfile(source, destination)
            try:
                destination.chmod(0o700 if expected.executable else 0o600)
            except OSError:
                pass

    def _extract_frozen_archive_member(self, archive_path: Path, member_name: str, destination: Path, expected_size: int) -> None:
        member_path = PurePosixPath(member_name)
        if member_path.is_absolute() or ".." in member_path.parts:
            raise AsrModelManagerError("V3_ASR_ARCHIVE_MEMBER_UNSAFE", "Frozen runtime member path is unsafe.")
        if archive_path.name.endswith(".zip"):
            with zipfile.ZipFile(archive_path) as archive:
                try:
                    info = archive.getinfo(member_name)
                except KeyError as exc:
                    raise AsrModelManagerError("V3_ASR_ARCHIVE_MEMBER_MISSING", "Frozen runtime member is missing from the archive.") from exc
                mode = info.external_attr >> 16
                if info.is_dir() or stat.S_IFMT(mode) not in {0, stat.S_IFREG}:
                    raise AsrModelManagerError("V3_ASR_ARCHIVE_MEMBER_UNSAFE", "Frozen runtime member is not a regular file.")
                with archive.open(info) as source:
                    self._copy_bounded(source, destination, expected_size)
            return
        if archive_path.name.endswith((".tar.gz", ".tgz")):
            with tarfile.open(archive_path, "r:gz") as archive:
                try:
                    info = archive.getmember(member_name)
                except KeyError as exc:
                    raise AsrModelManagerError("V3_ASR_ARCHIVE_MEMBER_MISSING", "Frozen runtime member is missing from the archive.") from exc
                if not info.isfile():
                    raise AsrModelManagerError("V3_ASR_ARCHIVE_MEMBER_UNSAFE", "Frozen runtime member is not a regular file.")
                source = archive.extractfile(info)
                if source is None:
                    raise AsrModelManagerError("V3_ASR_ARCHIVE_MEMBER_MISSING", "Frozen runtime member could not be read.")
                with source:
                    self._copy_bounded(source, destination, expected_size)
            return
        raise AsrModelManagerError("V3_ASR_ARCHIVE_FORMAT_UNSUPPORTED", "Frozen runtime archive format is not supported.")

    def _copy_bounded(self, source, destination: Path, expected_size: int) -> None:
        copied = 0
        with destination.open("wb") as output:
            while True:
                chunk = source.read(self._chunk_size)
                if not chunk:
                    break
                copied += len(chunk)
                if copied > expected_size:
                    raise AsrModelManagerError("V3_ASR_SIZE_MISMATCH", "Frozen runtime member exceeded its expected size.")
                output.write(chunk)
        if copied != expected_size:
            destination.unlink(missing_ok=True)
            raise AsrModelManagerError("V3_ASR_SIZE_MISMATCH", "Frozen runtime member did not match its expected size.")

    def _rename_with_retry(self, source: Path, destination: Path, *, timeout: float = 5.0) -> None:
        deadline = time.monotonic() + timeout
        while True:
            try:
                source.rename(destination)
                return
            except PermissionError:
                if time.monotonic() >= deadline:
                    raise
                time.sleep(0.05)

    def _default_self_test(self, descriptor: AsrModelDescriptor, directory: Path) -> None:
        try:
            if descriptor.provider_id == "faster_whisper_local":
                from faster_whisper import WhisperModel

                model = WhisperModel(str(directory), device="cpu", compute_type="int8", local_files_only=True)
                del model
                return
            if descriptor.provider_id == "funasr_edge_local":
                from .funasr_llamacpp import FunAsrLlamaCppProviderAdapter
                from .provider import TaskAudioRef

                tasks_root = directory.parent / "self-test-tasks"
                audio_path = tasks_root / "install-self-test" / "audio.wav"
                audio_path.parent.mkdir(parents=True, exist_ok=True)
                with wave.open(str(audio_path), "wb") as writer:
                    writer.setnchannels(1)
                    writer.setsampwidth(2)
                    writer.setframerate(16000)
                    writer.writeframes(b"\x00\x00" * 16000)
                adapter = FunAsrLlamaCppProviderAdapter(directory, tasks_root, model_id=descriptor.model_id)
                adapter.load()
                adapter.self_test(TaskAudioRef("install-self-test", "audio.wav"))
                adapter.close()
                if tasks_root.exists():
                    shutil.rmtree(tasks_root)
                return
            raise AsrModelManagerError("V3_ASR_PROVIDER_NOT_QUALIFIED", "ASR provider self-test is not qualified.", status=409)
        except Exception as exc:
            if descriptor.provider_id == "funasr_edge_local":
                tasks_root = directory.parent / "self-test-tasks"
                if tasks_root.exists():
                    shutil.rmtree(tasks_root)
            raise AsrModelManagerError("V3_ASR_SELF_TEST_FAILED", "Installed ASR model could not be loaded locally.") from exc

    def _inspect_models(self) -> dict[str, dict[str, Any]]:
        states: dict[str, dict[str, Any]] = {}
        for descriptor in ASR_MODELS:
            path = self.model_path(descriptor.model_id)
            if path is None:
                state = "qualification_required" if descriptor.install_kind == "qualification_required" else "not_installed"
                states[descriptor.model_id] = {"state": state, "verifiedAt": None}
                continue
            try:
                self._verify_directory(descriptor, path)
                states[descriptor.model_id] = {"state": "ready", "verifiedAt": utc_now()}
            except AsrModelManagerError:
                states[descriptor.model_id] = {"state": "corrupt", "verifiedAt": None}
        return states

    def _resolve_effective(self, requested: str) -> tuple[str | None, str | None]:
        if self._model_states.get(requested, {}).get("state") == "ready":
            return requested, None
        if self._model_states.get(FALLBACK_ASR_MODEL_ID, {}).get("state") == "ready":
            return FALLBACK_ASR_MODEL_ID, f"requested_model_{self._model_states.get(requested, {}).get('state', 'unavailable')}"
        return None, "bundled_fallback_unavailable"

    def _installable_descriptor(self, model_id: str) -> AsrModelDescriptor:
        descriptor = ASR_MODEL_BY_ID.get(model_id)
        if descriptor is None:
            raise AsrModelManagerError("V3_ASR_MODEL_UNKNOWN", "ASR model is not in the immutable catalog.", status=404)
        if not descriptor.installable:
            code = "V3_ASR_MODEL_NOT_QUALIFIED" if descriptor.install_kind == "qualification_required" else "V3_ASR_MODEL_NOT_INSTALLABLE"
            raise AsrModelManagerError(code, "ASR model is not available for installation.", status=409)
        return descriptor

    def _read_state(self) -> dict[str, Any]:
        if not self.state_path.exists():
            return {"schemaVersion": "v3-asr-model-manager-state/v1", "requestedModelId": DEFAULT_ASR_MODEL_ID, "updatedAt": utc_now(), "jobs": {}}
        try:
            state = json.loads(self.state_path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            state = {}
        if state.get("schemaVersion") != "v3-asr-model-manager-state/v1" or not isinstance(state.get("jobs"), dict):
            return {"schemaVersion": "v3-asr-model-manager-state/v1", "requestedModelId": DEFAULT_ASR_MODEL_ID, "updatedAt": utc_now(), "jobs": {}}
        migrated = False
        for job in state["jobs"].values():
            if isinstance(job, dict) and not isinstance(job.get("history"), list):
                job["history"] = [{
                    "state": job.get("state", "failed"),
                    "sequence": int(job.get("sequence", 1)),
                    "at": job.get("updatedAt") or job.get("createdAt") or utc_now(),
                }]
                migrated = True
        if migrated:
            temporary = self.state_path.with_suffix(".migration.tmp")
            temporary.write_text(json.dumps(state, ensure_ascii=True, sort_keys=True, separators=(",", ":")), encoding="utf-8")
            temporary.replace(self.state_path)
        return state

    def _write_state(self) -> None:
        temporary = self.state_path.with_suffix(".tmp")
        temporary.write_text(json.dumps(self._state, ensure_ascii=True, sort_keys=True, separators=(",", ":")), encoding="utf-8")
        try:
            temporary.chmod(0o600)
        except OSError:
            pass
        temporary.replace(self.state_path)

    def _recover_interrupted_jobs(self) -> None:
        changed = False
        for job in self._state.get("jobs", {}).values():
            if job.get("state") in ACTIVE_JOB_STATES:
                now = utc_now()
                next_sequence = int(job.get("sequence", 0)) + 1
                job.update({
                    "state": "failed",
                    "failureCode": "V3_ASR_RUNTIME_RESTARTED",
                    "message": "Runtime restarted before installation completed.",
                    "sequence": next_sequence,
                    "updatedAt": now,
                    "finishedAt": now,
                })
                job.setdefault("history", []).append({"state": "failed", "sequence": next_sequence, "at": now})
                changed = True
        for path in self.staging_root.iterdir():
            if path.is_dir():
                shutil.rmtree(path)
            else:
                path.unlink(missing_ok=True)
        if changed:
            self._write_state()

    def _new_job(self, model_id: str, source: str) -> dict[str, Any]:
        descriptor = ASR_MODEL_BY_ID[model_id]
        job_id = f"asrjob_{uuid4().hex}"
        job = {
            "schemaVersion": "v3-asr-installation-job/v1",
            "jobId": job_id,
            "modelId": model_id,
            "source": source,
            "state": "checking",
            "bytesCompleted": 0,
            "bytesTotal": sum(item.byte_length for item in descriptor.files),
            "percent": 0.0,
            "bytesPerSecond": 0,
            "etaSeconds": None,
            "message": "Installation queued.",
            "failureCode": None,
            "sequence": 1,
            "history": [{"state": "checking", "sequence": 1, "at": utc_now()}],
            "createdAt": utc_now(),
            "updatedAt": utc_now(),
            "finishedAt": None,
        }
        self._state.setdefault("jobs", {})[job_id] = job
        self._write_state()
        return job

    def _job(self, job_id: str) -> dict[str, Any]:
        job = self._state.get("jobs", {}).get(job_id)
        if not isinstance(job, dict):
            raise AsrModelManagerError("V3_ASR_JOB_NOT_FOUND", "ASR installation job was not found.", status=404)
        return job

    def _assert_no_active_job(self, model_id: str) -> None:
        if any(job.get("modelId") == model_id and job.get("state") in ACTIVE_JOB_STATES for job in self._state.get("jobs", {}).values()):
            raise AsrModelManagerError("V3_ASR_JOB_CONFLICT", "An installation job is already active for this model.", status=409)

    def _transition(self, job_id: str, state: str, message: str) -> None:
        with self._lock:
            self._update_job(job_id, state=state, message=message)

    def _update_job(self, job_id: str, **changes: Any) -> None:
        job = self._job(job_id)
        previous_state = job.get("state")
        next_sequence = int(job.get("sequence", 0)) + 1
        now = utc_now()
        job.update(changes)
        job["updatedAt"] = now
        job["sequence"] = next_sequence
        if "state" in changes and changes["state"] != previous_state:
            job.setdefault("history", []).append({"state": changes["state"], "sequence": next_sequence, "at": now})
        self._write_state()

    def _record_bytes(self, job_id: str, count: int, started: float) -> None:
        with self._lock:
            job = self._job(job_id)
            completed = int(job.get("bytesCompleted", 0)) + count
            total = max(int(job.get("bytesTotal", 0)), 1)
            elapsed = max(time.monotonic() - started, 0.001)
            speed = int(completed / elapsed)
            eta = int(max(total - completed, 0) / speed) if speed else None
            self._update_job(job_id, bytesCompleted=completed, percent=round(min(completed / total * 100, 99.9), 1), bytesPerSecond=speed, etaSeconds=eta)

    def _check_cancel(self, job_id: str) -> None:
        event = self._cancel_events.get(job_id)
        if event and event.is_set():
            raise _JobCancelled()

    def _prepare_stage(self, stage: Path) -> None:
        if stage.exists():
            shutil.rmtree(stage)
        stage.mkdir(parents=True, mode=0o700)

    def _finish_cancelled(self, job_id: str, stage: Path) -> None:
        if stage.exists():
            shutil.rmtree(stage)
        with self._lock:
            self._update_job(job_id, state="cancelled", message="Installation cancelled and temporary files removed.", failureCode=None, finishedAt=utc_now())

    def _finish_failed(self, job_id: str, stage: Path, code: str, message: str, *, corrupt: bool = False) -> None:
        if stage.exists():
            shutil.rmtree(stage)
        with self._lock:
            state = "corrupt" if corrupt else "failed"
            self._update_job(job_id, state=state, message=message, failureCode=code, finishedAt=utc_now())
