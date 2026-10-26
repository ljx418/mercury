from __future__ import annotations

import hashlib
import json
import os
import secrets
import sqlite3
import stat
import wave
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

from ..asr.provider import TaskAudioRef
from .contracts import AcquisitionAudioRef
from .task_artifacts import TaskArtifactError, TaskArtifactSandbox
from ..task_store import process_start_token


OWNER_SCHEMA = "v3-media-capture-owner-manifest/v10"
RECEIPT_SCHEMA = "v3-media-capture-owner-receipt/v10"
OWNER_FILE = "owner.json"


class AudioStagingError(RuntimeError):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


@dataclass(frozen=True)
class AudioStagingReceipt:
    task_id: str
    source_sha256: str
    staged_sha256: str
    byte_length: int
    duration_ms: int
    sample_rate_hz: int
    channels: int
    sample_width_bytes: int
    relative_path: str = "audio/current-part.wav"


class TaskAudioStager:
    """Copy a published acquisition artifact into an isolated ASR task root."""

    def __init__(self, sandbox: TaskArtifactSandbox, tasks_root: Path, receipt_db_path: Path | None = None) -> None:
        self.sandbox = sandbox
        self.tasks_root = tasks_root.resolve()
        self.tasks_root.mkdir(parents=True, exist_ok=True, mode=0o700)
        self._chmod(self.tasks_root, 0o700)
        self.receipt_db_path = Path(receipt_db_path or self.tasks_root / ".owner-receipts.sqlite3")
        self.receipt_db_path.parent.mkdir(parents=True, exist_ok=True)
        self._migrate_receipts()

    def stage(self, reference: AcquisitionAudioRef) -> tuple[TaskAudioRef, AudioStagingReceipt]:
        try:
            reference.validate()
            source = self.sandbox.private_path(reference.task_id, reference.artifact)
        except (ValueError, TaskArtifactError) as exc:
            raise AudioStagingError("V3_MEDIA_TRANSCRIPT_AUDIO_UNSAFE", "Acquisition audio reference is invalid.") from exc
        source_before = source.stat()
        if not stat.S_ISREG(source_before.st_mode) or source_before.st_nlink != 1:
            raise AudioStagingError("V3_MEDIA_TRANSCRIPT_AUDIO_UNSAFE", "Acquisition audio must be a single-link regular file.")
        source_sha = self._sha256(source)
        if source_sha != reference.artifact.sha256 or source_before.st_size != reference.artifact.byte_length:
            raise AudioStagingError("V3_MEDIA_TRANSCRIPT_AUDIO_UNSAFE", "Acquisition audio changed after publication.")
        shape = self._wave_shape(source)
        expected = (reference.sample_rate_hz, reference.channels, reference.sample_width_bytes)
        if shape[:3] != expected or shape[3] != reference.duration_ms:
            raise AudioStagingError("V3_MEDIA_TRANSCRIPT_AUDIO_UNSAFE", "Acquisition audio shape does not match its binding.")

        task_root = self.tasks_root / reference.task_id
        if task_root.exists() or task_root.is_symlink():
            raise AudioStagingError("V3_MEDIA_TRANSCRIPT_TASK_INVALID", "ASR task staging root already exists.")
        audio_root = task_root / "audio"
        destination = audio_root / "current-part.wav"
        try:
            task_root.mkdir(mode=0o700)
            audio_root.mkdir(mode=0o700)
            descriptor = os.open(destination, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
            digest = hashlib.sha256()
            copied = 0
            with source.open("rb") as source_handle, os.fdopen(descriptor, "wb") as target_handle:
                for chunk in iter(lambda: source_handle.read(1024 * 1024), b""):
                    target_handle.write(chunk)
                    digest.update(chunk)
                    copied += len(chunk)
                target_handle.flush()
                os.fsync(target_handle.fileno())
            self._chmod(destination, 0o600)
            source_after = source.stat()
            target = destination.stat()
            staged_sha = digest.hexdigest()
            if (
                (source_before.st_size, source_before.st_mtime_ns, source_before.st_ino)
                != (source_after.st_size, source_after.st_mtime_ns, source_after.st_ino)
                or copied != reference.artifact.byte_length
                or target.st_nlink != 1
                or target.st_mode & 0o077
                or staged_sha != source_sha
                or self._wave_shape(destination) != shape
            ):
                raise AudioStagingError("V3_MEDIA_TRANSCRIPT_AUDIO_UNSAFE", "Staged audio failed the byte and shape binding.")
            owner = {
                "schemaVersion": OWNER_SCHEMA,
                "taskId": reference.task_id,
                "pid": os.getpid(),
                "processStartToken": process_start_token(os.getpid()),
                "sourceSha256": source_sha,
                "stagedSha256": staged_sha,
                "byteLength": copied,
                "waveShape": {
                    "encoding": "pcm_s16le",
                    "sampleRateHz": shape[0],
                    "channels": shape[1],
                    "sampleWidthBytes": shape[2],
                },
                "state": "staged",
            }
            if not owner["processStartToken"]:
                raise AudioStagingError("V3_MEDIA_TRANSCRIPT_CLEANUP_INCOMPLETE", "Process identity is unavailable.")
            manifest_sha = self._publish_owner_manifest(task_root, owner)
            self._commit_receipt(reference.task_id, manifest_sha)
        except Exception:
            self.cleanup(reference.task_id)
            raise
        audio = TaskAudioRef(task_id=reference.task_id, relative_path="audio/current-part.wav")
        return audio, AudioStagingReceipt(
            task_id=reference.task_id,
            source_sha256=source_sha,
            staged_sha256=staged_sha,
            byte_length=copied,
            duration_ms=shape[3],
            sample_rate_hz=shape[0],
            channels=shape[1],
            sample_width_bytes=shape[2],
        )

    def cleanup(self, task_id: str) -> dict[str, int | bool]:
        if not task_id or "/" in task_id or "\\" in task_id or task_id in {".", ".."}:
            raise AudioStagingError("V3_MEDIA_TRANSCRIPT_TASK_INVALID", "ASR task ID is invalid.")
        task_root = self.tasks_root / task_id
        if task_root.is_symlink():
            raise AudioStagingError("V3_MEDIA_TRANSCRIPT_AUDIO_UNSAFE", "ASR task root cannot be a link.")
        if not task_root.exists():
            self._delete_receipt(task_id)
            return {"removed": False, "residualCount": 0}
        for path in sorted(task_root.rglob("*"), reverse=True):
            metadata = path.lstat()
            if stat.S_ISREG(metadata.st_mode) and metadata.st_nlink == 1:
                path.unlink()
            elif stat.S_ISDIR(metadata.st_mode):
                path.rmdir()
            else:
                raise AudioStagingError("V3_MEDIA_TRANSCRIPT_CLEANUP_INCOMPLETE", "Unsafe ASR staging entry blocked cleanup.")
        task_root.rmdir()
        self._delete_receipt(task_id)
        residual = int(task_root.exists())
        return {"removed": True, "residualCount": residual}

    def recover_cleanup(self, task_id: str) -> dict[str, int | bool]:
        task_root = self.tasks_root / task_id
        # R4: a capture that was interrupted BEFORE the staging barrier owns
        # no staged audio at all. There is nothing to prove ownership OF and
        # nothing to remove, so this is a zero-residual cleanup -- the same
        # verdict `cleanup()` already returns for an absent root. Requiring a
        # manifest here would make every pre-barrier capture unrecoverable and
        # strand the acquisition sandbox behind it.
        if not task_root.exists() and not task_root.is_symlink():
            self._delete_receipt(task_id)
            return {"removed": False, "residualCount": 0}
        try:
            self._validate_recovery_owner(task_id, task_root)
            return self.cleanup(task_id)
        except AudioStagingError:
            raise
        except Exception as exc:
            raise AudioStagingError(
                "V3_MEDIA_TRANSCRIPT_CLEANUP_INCOMPLETE", "ASR recovery ownership is invalid."
            ) from exc

    def receipt(self, task_id: str) -> dict[str, object] | None:
        with self._receipt_connection() as connection:
            row = connection.execute(
                "SELECT task_id,manifest_sha256,state,committed_at FROM media_capture_owner_receipts WHERE task_id=?",
                (task_id,),
            ).fetchone()
        if row is None:
            return None
        return {
            "schemaVersion": RECEIPT_SCHEMA,
            "taskId": row[0],
            "manifestSha256": row[1],
            "state": row[2],
            "committedAt": row[3],
            "durability": "sqlite_transaction_synchronous_FULL_committed",
        }

    def _publish_owner_manifest(self, task_root: Path, owner: dict[str, object]) -> str:
        payload = json.dumps(owner, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
        temporary = task_root / f"{OWNER_FILE}.tmp.{secrets.token_hex(16)}"
        target = task_root / OWNER_FILE
        descriptor = os.open(temporary, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
        try:
            with os.fdopen(descriptor, "wb") as handle:
                handle.write(payload)
                handle.flush()
                os.fsync(handle.fileno())
            temporary.replace(target)
            self._chmod(target, 0o600)
            directory_fd = os.open(task_root, os.O_RDONLY | getattr(os, "O_DIRECTORY", 0))
            try:
                os.fsync(directory_fd)
            finally:
                os.close(directory_fd)
        except Exception:
            temporary.unlink(missing_ok=True)
            raise
        return hashlib.sha256(payload).hexdigest()

    def _validate_recovery_owner(self, task_id: str, task_root: Path) -> None:
        if not task_root.is_dir() or task_root.is_symlink() or task_root.stat().st_mode & 0o077:
            raise AudioStagingError("V3_MEDIA_TRANSCRIPT_CLEANUP_INCOMPLETE", "ASR staging root is unsafe.")
        owner_path = task_root / OWNER_FILE
        metadata = owner_path.lstat()
        if not stat.S_ISREG(metadata.st_mode) or metadata.st_nlink != 1 or metadata.st_mode & 0o077:
            raise AudioStagingError("V3_MEDIA_TRANSCRIPT_CLEANUP_INCOMPLETE", "Owner manifest is unsafe.")
        raw = owner_path.read_bytes()
        try:
            owner = json.loads(raw)
        except json.JSONDecodeError as exc:
            raise AudioStagingError("V3_MEDIA_TRANSCRIPT_CLEANUP_INCOMPLETE", "Owner manifest is invalid.") from exc
        required = {
            "schemaVersion", "taskId", "pid", "processStartToken", "sourceSha256", "stagedSha256",
            "byteLength", "waveShape", "state",
        }
        shape = owner.get("waveShape")
        valid = (
            set(owner) == required and owner.get("schemaVersion") == OWNER_SCHEMA
            and owner.get("taskId") == task_id and type(owner.get("pid")) is int
            and isinstance(owner.get("processStartToken"), str) and owner.get("processStartToken")
            and isinstance(owner.get("sourceSha256"), str) and len(owner["sourceSha256"]) == 64
            and owner.get("sourceSha256") == owner.get("stagedSha256")
            and type(owner.get("byteLength")) is int and owner["byteLength"] > 0
            and owner.get("state") == "staged" and isinstance(shape, dict)
            and shape == {"encoding": "pcm_s16le", "sampleRateHz": 16000, "channels": 1, "sampleWidthBytes": 2}
        )
        canonical = json.dumps(owner, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
        receipt = self.receipt(task_id)
        if not valid or raw != canonical or receipt is None or receipt.get("state") != "ownership_committed" or receipt.get("manifestSha256") != hashlib.sha256(canonical).hexdigest():
            raise AudioStagingError("V3_MEDIA_TRANSCRIPT_CLEANUP_INCOMPLETE", "Owner manifest receipt is not authoritative.")
        audio = task_root / "audio/current-part.wav"
        if not audio.is_file() or audio.is_symlink() or audio.stat().st_nlink != 1 or audio.stat().st_mode & 0o077:
            raise AudioStagingError("V3_MEDIA_TRANSCRIPT_CLEANUP_INCOMPLETE", "Staged audio is unsafe.")
        if audio.stat().st_size != owner["byteLength"] or self._sha256(audio) != owner["stagedSha256"]:
            raise AudioStagingError("V3_MEDIA_TRANSCRIPT_CLEANUP_INCOMPLETE", "Staged audio does not match its owner manifest.")

    def _migrate_receipts(self) -> None:
        with self._receipt_connection() as connection:
            connection.execute(
                """CREATE TABLE IF NOT EXISTS media_capture_owner_receipts(
                       task_id TEXT PRIMARY KEY, manifest_sha256 TEXT NOT NULL,
                       state TEXT NOT NULL, committed_at TEXT NOT NULL
                   )"""
            )

    def _commit_receipt(self, task_id: str, manifest_sha256: str) -> None:
        with self._receipt_connection() as connection:
            connection.execute("BEGIN IMMEDIATE")
            try:
                connection.execute(
                    """INSERT INTO media_capture_owner_receipts(task_id,manifest_sha256,state,committed_at)
                       VALUES (?,?,?,?)""",
                    (task_id, manifest_sha256, "ownership_committed", datetime.now(UTC).isoformat().replace("+00:00", "Z")),
                )
                connection.execute("COMMIT")
            except Exception:
                connection.execute("ROLLBACK")
                raise

    def _delete_receipt(self, task_id: str) -> None:
        with self._receipt_connection() as connection:
            connection.execute("DELETE FROM media_capture_owner_receipts WHERE task_id=?", (task_id,))

    def _receipt_connection(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.receipt_db_path, isolation_level=None)
        connection.execute("PRAGMA synchronous=FULL")
        return connection

    @staticmethod
    def _chmod(path: Path, mode: int) -> None:
        try:
            path.chmod(mode)
        except OSError:
            pass

    @staticmethod
    def _sha256(path: Path) -> str:
        digest = hashlib.sha256()
        with path.open("rb") as handle:
            for block in iter(lambda: handle.read(1024 * 1024), b""):
                digest.update(block)
        return digest.hexdigest()

    @staticmethod
    def _wave_shape(path: Path) -> tuple[int, int, int, int]:
        try:
            with wave.open(str(path), "rb") as reader:
                rate = reader.getframerate()
                channels = reader.getnchannels()
                width = reader.getsampwidth()
                if reader.getcomptype() != "NONE" or rate <= 0:
                    raise wave.Error("unsupported")
                duration_ms = round(reader.getnframes() * 1000 / rate)
        except (OSError, EOFError, wave.Error) as exc:
            raise AudioStagingError("V3_MEDIA_TRANSCRIPT_AUDIO_UNSAFE", "Acquisition audio is not controlled PCM WAV.") from exc
        return rate, channels, width, duration_ms
