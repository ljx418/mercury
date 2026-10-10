from __future__ import annotations

import os
import shutil
import signal
import stat
import subprocess
import sys
import threading
import time
import wave
from dataclasses import dataclass
from pathlib import Path
from threading import Event

from .provider import AsrProviderError, TaskAudioRef

SENSITIVE_ENV_FRAGMENTS = ("TOKEN", "COOKIE", "AUTH", "PROXY", "HF_", "HUGGINGFACE", "AWS_", "AZURE_", "GOOGLE_")


@dataclass(frozen=True)
class NativeProcessSpec:
    executable_name: str
    arguments: tuple[str, ...]
    task_id: str


@dataclass(frozen=True)
class NativeProcessResult:
    exit_code: int
    stdout: str
    stderr: str
    elapsed_seconds: float
    peak_rss_bytes: int = 0


class NativeAsrProcessHost:
    def __init__(
        self,
        install_root: Path,
        tasks_root: Path,
        *,
        allowed_executables: frozenset[str],
        max_output_bytes: int = 4 * 1024 * 1024,
        terminate_grace_seconds: float = 1.0,
    ):
        self.install_root = install_root.resolve(strict=True)
        self.tasks_root = tasks_root.resolve()
        self.allowed_executables = allowed_executables
        self.max_output_bytes = max_output_bytes
        self.terminate_grace_seconds = terminate_grace_seconds
        self.tasks_root.mkdir(parents=True, exist_ok=True, mode=0o700)
        self._processes: set[subprocess.Popen[bytes]] = set()
        self._process_lock = threading.RLock()
        self._closed = False

    def validate_audio(self, audio: TaskAudioRef) -> Path:
        audio.validate_shape()
        task_root = self._task_root(audio.task_id, require_exists=True)
        candidate = task_root / Path(audio.relative_path)
        self._reject_link_components(candidate, task_root)
        try:
            resolved = candidate.resolve(strict=True)
        except OSError as exc:
            raise AsrProviderError("V3_ASR_AUDIO_NOT_FOUND", "Task audio file was not found.") from exc
        if not resolved.is_relative_to(task_root) or resolved.suffix.lower() != ".wav":
            raise AsrProviderError("V3_ASR_AUDIO_REF_INVALID", "Task audio escaped the controlled task directory.")
        metadata = resolved.stat()
        if not stat.S_ISREG(metadata.st_mode) or metadata.st_nlink != 1:
            raise AsrProviderError("V3_ASR_AUDIO_FILE_UNSAFE", "Task audio must be a single-link regular file.")
        try:
            with wave.open(str(resolved), "rb") as reader:
                shape = (reader.getframerate(), reader.getnchannels(), reader.getsampwidth(), reader.getcomptype())
        except (wave.Error, EOFError, OSError) as exc:
            raise AsrProviderError("V3_ASR_AUDIO_FORMAT_UNSUPPORTED", "Task audio is not a readable PCM WAV file.") from exc
        if shape != (16000, 1, 2, "NONE"):
            raise AsrProviderError("V3_ASR_AUDIO_FORMAT_UNSUPPORTED", "Task audio must be mono PCM S16LE at 16 kHz.")
        return resolved

    def validate_install_file(self, relative_name: str) -> Path:
        relative = Path(relative_name)
        if relative.is_absolute() or len(relative.parts) != 1 or relative.name != relative_name or relative.name in {".", ".."}:
            raise AsrProviderError("V3_ASR_INSTALL_PATH_INVALID", "ASR install file must be a frozen root-level name.")
        candidate = self.install_root / relative
        self._reject_link_components(candidate, self.install_root)
        try:
            resolved = candidate.resolve(strict=True)
        except OSError as exc:
            raise AsrProviderError("V3_ASR_INSTALL_FILE_MISSING", "Frozen ASR install file is missing.") from exc
        metadata = resolved.stat()
        if not resolved.is_relative_to(self.install_root) or not stat.S_ISREG(metadata.st_mode) or metadata.st_nlink != 1:
            raise AsrProviderError("V3_ASR_INSTALL_FILE_UNSAFE", "ASR install file must be a single-link regular file.")
        return resolved

    def run(
        self,
        spec: NativeProcessSpec,
        *,
        timeout: float,
        cancel_event: Event | None = None,
    ) -> NativeProcessResult:
        if self._closed:
            raise AsrProviderError("V3_ASR_PROVIDER_CLOSED", "Native ASR process host is closed.")
        if spec.executable_name not in self.allowed_executables:
            raise AsrProviderError("V3_ASR_EXECUTABLE_NOT_ALLOWED", "Native ASR executable is not allowlisted.")
        executable = self.validate_install_file(spec.executable_name)
        task_root = self._task_root(spec.task_id, require_exists=True)
        if timeout <= 0:
            raise AsrProviderError("V3_ASR_TIMEOUT_INVALID", "ASR timeout must be positive.")
        if any(not isinstance(value, str) or "\x00" in value for value in spec.arguments):
            raise AsrProviderError("V3_ASR_ARGUMENT_INVALID", "Native ASR arguments are invalid.")

        environment = {
            "HOME": str(task_root),
            "LANG": "C.UTF-8",
            "LC_ALL": "C.UTF-8",
            "PATH": os.defpath,
        }
        if any(any(fragment in key.upper() for fragment in SENSITIVE_ENV_FRAGMENTS) for key in environment):
            raise AsrProviderError("V3_ASR_ENVIRONMENT_UNSAFE", "Native ASR environment contains a sensitive variable.")

        started = time.monotonic()
        command = [str(executable), *spec.arguments]
        if os.name == "posix":
            launcher = Path(__file__).with_name("asr_sandbox_launcher.py").resolve(strict=True)
            metadata = launcher.stat()
            if not stat.S_ISREG(metadata.st_mode) or metadata.st_nlink != 1:
                raise AsrProviderError("V3_ASR_INSTALL_FILE_UNSAFE", "ASR sandbox launcher is not a trusted regular file.")
            command = [sys.executable, str(launcher), *command]
        try:
            process = subprocess.Popen(
                command,
                cwd=task_root,
                env=environment,
                stdin=subprocess.DEVNULL,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                shell=False,
                start_new_session=True,
            )
        except OSError as exc:
            raise AsrProviderError("V3_ASR_PROCESS_START_FAILED", "Native ASR process could not start.") from exc
        with self._process_lock:
            if self._closed:
                self._stop_process(process)
                raise AsrProviderError("V3_ASR_PROVIDER_CLOSED", "Native ASR process host is closed.")
            self._processes.add(process)

        stdout_buffer = bytearray()
        stderr_buffer = bytearray()
        overflow = Event()
        readers = [
            threading.Thread(target=self._read_bounded, args=(process.stdout, stdout_buffer, overflow), daemon=True),
            threading.Thread(target=self._read_bounded, args=(process.stderr, stderr_buffer, overflow), daemon=True),
        ]
        for reader in readers:
            reader.start()

        try:
            failure_code: str | None = None
            peak_rss_bytes = 0
            while process.poll() is None:
                peak_rss_bytes = max(peak_rss_bytes, self._read_rss_bytes(process.pid))
                if self._closed:
                    failure_code = "V3_ASR_PROCESS_CANCELLED"
                    break
                if cancel_event and cancel_event.is_set():
                    failure_code = "V3_ASR_PROCESS_CANCELLED"
                    break
                if overflow.is_set():
                    failure_code = "V3_ASR_PROCESS_OUTPUT_LIMIT"
                    break
                if time.monotonic() - started > timeout:
                    failure_code = "V3_ASR_PROCESS_TIMEOUT"
                    break
                time.sleep(0.02)
            if failure_code:
                self._stop_process(process)
            for reader in readers:
                reader.join(timeout=self.terminate_grace_seconds)
            if overflow.is_set() and failure_code is None:
                failure_code = "V3_ASR_PROCESS_OUTPUT_LIMIT"
            elapsed = time.monotonic() - started
            if failure_code:
                raise AsrProviderError(failure_code, "Native ASR process did not complete safely.")
            if process.returncode != 0:
                raise AsrProviderError(
                    "V3_ASR_PROCESS_FAILED",
                    "Native ASR process exited with a non-zero status.",
                    private_diagnostic={
                        "exitCode": process.returncode,
                        "stdout": bytes(stdout_buffer).decode("utf-8", errors="replace"),
                        "stderr": bytes(stderr_buffer).decode("utf-8", errors="replace"),
                        "elapsedSeconds": elapsed,
                        "peakRssBytes": peak_rss_bytes,
                    },
                )
            return NativeProcessResult(
                exit_code=process.returncode,
                stdout=bytes(stdout_buffer).decode("utf-8", errors="replace"),
                stderr=bytes(stderr_buffer).decode("utf-8", errors="replace"),
                elapsed_seconds=elapsed,
                peak_rss_bytes=peak_rss_bytes,
            )
        finally:
            with self._process_lock:
                self._processes.discard(process)

    def close(self) -> None:
        with self._process_lock:
            if self._closed:
                return
            self._closed = True
            processes = tuple(self._processes)
        for process in processes:
            if process.poll() is None:
                self._stop_process(process)

    def active_process_count(self) -> int:
        with self._process_lock:
            return sum(process.poll() is None for process in self._processes)

    def cleanup_task(self, task_id: str) -> None:
        task_root = self._task_root(task_id, require_exists=False)
        if task_root.exists():
            shutil.rmtree(task_root)

    def _task_root(self, task_id: str, *, require_exists: bool) -> Path:
        if not task_id or "/" in task_id or "\\" in task_id or task_id in {".", ".."}:
            raise AsrProviderError("V3_ASR_TASK_ID_INVALID", "ASR task ID is invalid.")
        candidate = self.tasks_root / task_id
        if candidate.is_symlink():
            raise AsrProviderError("V3_ASR_TASK_PATH_UNSAFE", "ASR task directory cannot be a link.")
        if require_exists and not candidate.is_dir():
            raise AsrProviderError("V3_ASR_TASK_NOT_FOUND", "ASR task directory was not found.")
        resolved = candidate.resolve(strict=require_exists)
        if not resolved.is_relative_to(self.tasks_root):
            raise AsrProviderError("V3_ASR_TASK_PATH_UNSAFE", "ASR task directory escaped the controlled root.")
        return resolved

    def _reject_link_components(self, candidate: Path, root: Path) -> None:
        relative = candidate.relative_to(root)
        current = root
        for part in relative.parts:
            current = current / part
            try:
                if current.is_symlink():
                    raise AsrProviderError("V3_ASR_PATH_LINK_REJECTED", "Links are not accepted in ASR controlled paths.")
            except OSError as exc:
                raise AsrProviderError("V3_ASR_PATH_INVALID", "ASR controlled path could not be inspected.") from exc

    def _read_bounded(self, stream, output: bytearray, overflow: Event) -> None:
        if stream is None:
            return
        while True:
            chunk = stream.read(64 * 1024)
            if not chunk:
                return
            remaining = self.max_output_bytes - len(output)
            if remaining <= 0 or len(chunk) > remaining:
                if remaining > 0:
                    output.extend(chunk[:remaining])
                overflow.set()
                return
            output.extend(chunk)

    @staticmethod
    def _read_rss_bytes(pid: int) -> int:
        try:
            for line in Path(f"/proc/{pid}/status").read_text(encoding="utf-8").splitlines():
                if line.startswith("VmRSS:"):
                    return int(line.split()[1]) * 1024
        except (FileNotFoundError, PermissionError, ProcessLookupError, ValueError, OSError):
            return 0
        return 0

    def _stop_process(self, process: subprocess.Popen) -> None:
        if process.poll() is not None:
            return
        try:
            if os.name == "posix":
                os.killpg(process.pid, signal.SIGTERM)
            else:
                process.terminate()
            process.wait(timeout=self.terminate_grace_seconds)
        except (ProcessLookupError, subprocess.TimeoutExpired):
            if process.poll() is None:
                try:
                    if os.name == "posix":
                        os.killpg(process.pid, signal.SIGKILL)
                    else:
                        process.kill()
                except ProcessLookupError:
                    pass
                process.wait(timeout=self.terminate_grace_seconds)
