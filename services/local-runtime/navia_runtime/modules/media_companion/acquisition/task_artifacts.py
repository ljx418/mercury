from __future__ import annotations

import hashlib
import json
import os
import re
import secrets
import shutil
import stat
from dataclasses import dataclass
from pathlib import Path


TASK_ID_RE = re.compile(r"^media_task_[a-f0-9]{32}$")
DIRECTORY_TOKEN_RE = re.compile(r"^task_[a-f0-9]{32}$")
OWNER_FILE = ".navia-owner.json"
OWNER_MARKER = "navia-media-task-artifact/v1"
KIND_SUFFIX = {
    "audio": ".wav",
    "video": ".media",
    "subtitle": ".json",
    "cookie": ".txt",
    "frame": ".png",
    "other": ".bin",
}
STAGING_RE = re.compile(r"^\.stage_[a-f0-9]{32}(?:\.[A-Za-z0-9]{1,12})?$")


class TaskArtifactError(RuntimeError):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


@dataclass(frozen=True)
class ArtifactRef:
    task_id: str
    artifact_id: str
    kind: str
    byte_length: int
    sha256: str

    def public_dict(self) -> dict[str, object]:
        return {
            "artifactId": self.artifact_id,
            "kind": self.kind,
            "byteLength": self.byte_length,
            "sha256": self.sha256,
        }


class TaskArtifactSandbox:
    def __init__(
        self,
        root: Path,
        *,
        maximum_audio_bytes: int = 512 * 1024**2,
        maximum_video_bytes: int = 2 * 1024**3,
        maximum_task_bytes: int = 2_684_354_560,
    ) -> None:
        self.root = root.resolve()
        self.root.mkdir(parents=True, exist_ok=True)
        self._chmod(self.root, 0o700)
        self.maximum_audio_bytes = maximum_audio_bytes
        self.maximum_video_bytes = maximum_video_bytes
        self.maximum_task_bytes = maximum_task_bytes
        self._task_roots: dict[str, Path] = {}
        self.recovered_orphan_count = self._recover_owned_orphans()

    @staticmethod
    def _chmod(path: Path, mode: int) -> None:
        try:
            path.chmod(mode)
        except OSError:
            pass

    @staticmethod
    def _validate_task_id(task_id: str) -> None:
        if not TASK_ID_RE.fullmatch(task_id):
            raise TaskArtifactError("V3_MEDIA_TASK_INVALID", "Task ID is outside the frozen contract.")

    def create(self, task_id: str) -> None:
        self._validate_task_id(task_id)
        if task_id in self._task_roots:
            return
        while True:
            directory = self.root / f"task_{secrets.token_hex(16)}"
            try:
                directory.mkdir(mode=0o700)
                break
            except FileExistsError:
                continue
        owner = {
            "schemaVersion": OWNER_MARKER,
            "directoryToken": directory.name,
            "taskId": task_id,
        }
        owner_path = directory / OWNER_FILE
        owner_bytes = json.dumps(owner, sort_keys=True, separators=(",", ":")).encode("utf-8")
        owner_fd = os.open(owner_path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
        with os.fdopen(owner_fd, "wb") as handle:
            handle.write(owner_bytes)
            handle.flush()
            os.fsync(handle.fileno())
        self._task_roots[task_id] = directory

    def write_bytes(self, task_id: str, kind: str, payload: bytes) -> ArtifactRef:
        self._validate_task_id(task_id)
        if kind not in KIND_SUFFIX:
            raise TaskArtifactError("V3_MEDIA_TASK_INVALID", "Artifact kind is outside the closed set.")
        if not isinstance(payload, bytes):
            raise TaskArtifactError("V3_MEDIA_TASK_INVALID", "Artifact payload must be bytes.")
        directory = self._task_root(task_id)
        current = self._task_bytes(directory)
        limit = self.maximum_video_bytes if kind == "video" else self.maximum_audio_bytes if kind == "audio" else self.maximum_task_bytes
        kind_bytes = sum(
            entry.stat().st_size
            for entry in directory.iterdir()
            if entry.name.endswith(KIND_SUFFIX[kind]) and entry.name != OWNER_FILE
        )
        if kind_bytes + len(payload) > limit or current + len(payload) > self.maximum_task_bytes:
            raise TaskArtifactError("V3_MEDIA_TASK_INVALID", "Artifact quota would be exceeded.")
        artifact_id = f"artifact_{secrets.token_hex(16)}"
        destination = directory / f"{artifact_id}{KIND_SUFFIX[kind]}"
        temporary = directory / f".{artifact_id}.part"
        try:
            file_fd = os.open(temporary, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
            with os.fdopen(file_fd, "wb") as handle:
                handle.write(payload)
                handle.flush()
                os.fsync(handle.fileno())
            self._assert_private_regular_file(temporary)
            if temporary.stat().st_size != len(payload):
                raise TaskArtifactError("V3_MEDIA_TASK_INVALID", "Artifact write was incomplete.")
            temporary.replace(destination)
            self._assert_private_regular_file(destination)
        except Exception:
            temporary.unlink(missing_ok=True)
            raise
        return ArtifactRef(task_id, artifact_id, kind, len(payload), hashlib.sha256(payload).hexdigest())

    def create_private_temp(self, task_id: str, *, suffix: str = "") -> Path:
        if suffix and (not suffix.startswith(".") or not suffix[1:].isalnum() or len(suffix) > 13):
            raise TaskArtifactError("V3_MEDIA_TASK_INVALID", "Temporary file suffix is invalid.")
        directory = self._task_root(task_id)
        while True:
            path = directory / f".stage_{secrets.token_hex(16)}{suffix}"
            try:
                descriptor = os.open(path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
                os.close(descriptor)
                return path
            except FileExistsError:
                continue

    def publish_private_temp(self, task_id: str, kind: str, source: Path) -> ArtifactRef:
        if kind not in KIND_SUFFIX:
            raise TaskArtifactError("V3_MEDIA_TASK_INVALID", "Artifact kind is outside the closed set.")
        directory = self._task_root(task_id)
        source = Path(source)
        if source.parent != directory or not STAGING_RE.fullmatch(source.name):
            raise TaskArtifactError("V3_MEDIA_TASK_INVALID", "Temporary artifact is outside the task sandbox.")
        self._chmod(source, 0o600)
        self._assert_private_regular_file(source)
        byte_length = source.stat().st_size
        if byte_length <= 0:
            raise TaskArtifactError("V3_MEDIA_TASK_INVALID", "Temporary artifact is empty.")
        current = self._task_bytes(directory) - byte_length
        limit = self.maximum_video_bytes if kind == "video" else self.maximum_audio_bytes if kind == "audio" else self.maximum_task_bytes
        kind_bytes = sum(
            entry.stat().st_size
            for entry in directory.iterdir()
            if entry.name.endswith(KIND_SUFFIX[kind]) and entry.name != OWNER_FILE
        )
        if kind_bytes + byte_length > limit or current + byte_length > self.maximum_task_bytes:
            raise TaskArtifactError("V3_MEDIA_TASK_INVALID", "Artifact quota would be exceeded.")
        artifact_id = f"artifact_{secrets.token_hex(16)}"
        destination = directory / f"{artifact_id}{KIND_SUFFIX[kind]}"
        digest = hashlib.sha256()
        with source.open("rb") as handle:
            for chunk in iter(lambda: handle.read(1024 * 1024), b""):
                digest.update(chunk)
        source.replace(destination)
        self._assert_private_regular_file(destination)
        return ArtifactRef(task_id, artifact_id, kind, byte_length, digest.hexdigest())

    def remove_private_temp(self, task_id: str, path: Path) -> None:
        directory = self._task_root(task_id)
        path = Path(path)
        if path.parent != directory or not STAGING_RE.fullmatch(path.name):
            raise TaskArtifactError("V3_MEDIA_TASK_INVALID", "Temporary artifact is outside the task sandbox.")
        if path.exists() or path.is_symlink():
            # A sandboxed subprocess can leave a staging file with an unsafe
            # mode. It must never be published, but cleanup must still remove
            # the owned regular file instead of preserving sensitive bytes.
            metadata = path.lstat()
            if not stat.S_ISREG(metadata.st_mode) or metadata.st_nlink != 1:
                raise TaskArtifactError("V3_MEDIA_TEMP_FILE_MODE_INVALID", "Temporary artifact is not an owned regular file.")
            path.unlink()

    def private_path(self, task_id: str, artifact: ArtifactRef) -> Path:
        if artifact.task_id != task_id:
            raise TaskArtifactError("V3_MEDIA_CROSS_TASK_REUSE", "Artifact belongs to a different task.")
        directory = self._task_root(task_id)
        suffix = KIND_SUFFIX.get(artifact.kind)
        if suffix is None:
            raise TaskArtifactError("V3_MEDIA_TASK_INVALID", "Artifact kind is outside the closed set.")
        path = directory / f"{artifact.artifact_id}{suffix}"
        self._assert_private_regular_file(path)
        if path.stat().st_size != artifact.byte_length:
            raise TaskArtifactError("V3_MEDIA_TASK_INVALID", "Artifact size changed after publication.")
        return path

    def delete_artifact(self, task_id: str, artifact: ArtifactRef) -> None:
        path = self.private_path(task_id, artifact)
        digest = hashlib.sha256()
        with path.open("rb") as handle:
            for chunk in iter(lambda: handle.read(1024 * 1024), b""):
                digest.update(chunk)
        if digest.hexdigest() != artifact.sha256:
            raise TaskArtifactError("V3_MEDIA_TASK_INVALID", "Artifact bytes changed before deletion.")
        path.unlink()

    def cleanup(self, task_id: str) -> dict[str, int | bool]:
        directory = self._task_roots.get(task_id)
        if directory is None:
            return {"residualCount": 0, "removed": False}
        self._validate_owned_directory(directory, task_id=task_id)
        for entry in directory.iterdir():
            self._assert_private_regular_file(entry)
        for entry in directory.iterdir():
            entry.unlink()
        directory.rmdir()
        del self._task_roots[task_id]
        return {"residualCount": 0, "removed": True}

    def active_task_count(self) -> int:
        return len(self._task_roots)

    def _task_root(self, task_id: str) -> Path:
        directory = self._task_roots.get(task_id)
        if directory is None:
            raise TaskArtifactError("V3_MEDIA_TASK_INVALID", "Task sandbox does not exist.")
        self._validate_owned_directory(directory, task_id=task_id)
        return directory

    def _task_bytes(self, directory: Path) -> int:
        total = 0
        for entry in directory.iterdir():
            self._assert_private_regular_file(entry)
            if entry.name != OWNER_FILE:
                total += entry.stat().st_size
        return total

    @staticmethod
    def _assert_private_regular_file(path: Path) -> None:
        metadata = path.lstat()
        if not stat.S_ISREG(metadata.st_mode) or metadata.st_nlink != 1 or metadata.st_mode & 0o077:
            raise TaskArtifactError("V3_MEDIA_TEMP_FILE_MODE_INVALID", "Task artifact is not a private regular file.")

    def _validate_owned_directory(self, directory: Path, *, task_id: str | None = None) -> dict[str, str]:
        metadata = directory.lstat()
        if not stat.S_ISDIR(metadata.st_mode) or metadata.st_mode & 0o077 or not DIRECTORY_TOKEN_RE.fullmatch(directory.name):
            raise TaskArtifactError("V3_MEDIA_TEMP_FILE_MODE_INVALID", "Task directory is not a private owned directory.")
        owner_path = directory / OWNER_FILE
        self._assert_private_regular_file(owner_path)
        try:
            owner = json.loads(owner_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            raise TaskArtifactError("V3_MEDIA_CLEANUP_INCOMPLETE", "Task owner manifest is invalid.") from exc
        if set(owner) != {"schemaVersion", "directoryToken", "taskId"} or owner.get("schemaVersion") != OWNER_MARKER or owner.get("directoryToken") != directory.name or not TASK_ID_RE.fullmatch(str(owner.get("taskId", ""))):
            raise TaskArtifactError("V3_MEDIA_CLEANUP_INCOMPLETE", "Task owner manifest is not authoritative.")
        if task_id is not None and owner["taskId"] != task_id:
            raise TaskArtifactError("V3_MEDIA_CROSS_TASK_REUSE", "Task owner manifest belongs to another task.")
        return owner

    def _recover_owned_orphans(self) -> int:
        recovered = 0
        for entry in self.root.iterdir():
            try:
                owner = self._validate_owned_directory(entry)
                for child in entry.iterdir():
                    self._assert_private_regular_file(child)
            except (OSError, TaskArtifactError):
                continue
            shutil.rmtree(entry)
            recovered += 1
        return recovered
