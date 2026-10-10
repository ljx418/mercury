from __future__ import annotations

import json
import os
import threading
import time
import wave
from dataclasses import fields
from pathlib import Path

import pytest

from navia_runtime.modules.media_companion.asr import (
    AsrProviderError,
    AsrProviderRegistry,
    FunAsrLlamaCppProviderAdapter,
    NativeAsrProcessHost,
    NativeProcessSpec,
    TaskAudioRef,
)


def write_wav(path: Path, *, frames: int = 1600) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as writer:
        writer.setnchannels(1)
        writer.setsampwidth(2)
        writer.setframerate(16000)
        writer.writeframes(b"\x00\x00" * frames)


def write_executable(path: Path, body: str) -> None:
    path.write_text("#!/usr/bin/env python3\n" + body, encoding="utf-8")
    path.chmod(0o700)


def make_host(tmp_path: Path, script: str, *, max_output_bytes: int = 4096):
    install = tmp_path / "install"
    tasks = tmp_path / "tasks"
    install.mkdir(parents=True)
    tasks.mkdir(parents=True)
    executable = install / "runner"
    write_executable(executable, script)
    host = NativeAsrProcessHost(install, tasks, allowed_executables=frozenset({"runner"}), max_output_bytes=max_output_bytes, terminate_grace_seconds=0.1)
    return host, install, tasks


def make_task(tasks: Path, task_id: str = "task-1") -> TaskAudioRef:
    write_wav(tasks / task_id / "audio.wav")
    return TaskAudioRef(task_id=task_id, relative_path="audio.wav")


def test_task_audio_contract_has_no_portal_or_credential_fields():
    assert {item.name for item in fields(TaskAudioRef)} == {
        "task_id",
        "relative_path",
        "media_type",
        "sample_rate_hz",
        "channels",
        "sample_format",
    }


def test_closed_provider_registry_rejects_duplicates_unknown_and_identity_mismatch():
    provider = type("Provider", (), {"provider_id": "provider-a"})()
    registry = AsrProviderRegistry({"provider-a": lambda: provider})
    assert registry.provider_ids() == ("provider-a",)
    assert registry.create("provider-a") is provider
    with pytest.raises(AsrProviderError) as unknown:
        registry.create("module.ClassFromClient")
    assert unknown.value.code == "V3_ASR_PROVIDER_UNKNOWN"
    with pytest.raises(AsrProviderError) as duplicate:
        registry.register("provider-a", lambda: provider)
    assert duplicate.value.code == "V3_ASR_PROVIDER_DUPLICATE"
    mismatch = AsrProviderRegistry({"provider-b": lambda: provider})
    with pytest.raises(AsrProviderError) as raised:
        mismatch.create("provider-b")
    assert raised.value.code == "V3_ASR_PROVIDER_ID_MISMATCH"


def test_native_process_uses_controlled_cwd_and_sanitized_environment(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    script = """import json, os\nprint(json.dumps({'cwd': os.getcwd(), 'keys': sorted(os.environ)}))\n"""
    host, _, tasks = make_host(tmp_path, script)
    audio = make_task(tasks)
    monkeypatch.setenv("HTTPS_PROXY", "http://secret.invalid")
    monkeypatch.setenv("HF_TOKEN", "secret")
    host.validate_audio(audio)
    result = host.run(NativeProcessSpec("runner", (), audio.task_id), timeout=2)
    payload = json.loads(result.stdout)
    assert Path(payload["cwd"]) == (tasks / audio.task_id).resolve()
    assert payload["keys"] == ["HOME", "LANG", "LC_ALL", "PATH"]
    assert result.exit_code == 0


def test_native_process_enforces_low_resource_affinity_and_denies_network(tmp_path: Path):
    script = """import json, os, resource, socket
denied = False
try:
    socket.socket(socket.AF_INET, socket.SOCK_STREAM)
except OSError:
    denied = True
print(json.dumps({'denied': denied, 'cores': len(os.sched_getaffinity(0)), 'memory': resource.getrlimit(resource.RLIMIT_AS)[0]}))
"""
    host, _, tasks = make_host(tmp_path, script)
    audio = make_task(tasks)
    payload = json.loads(host.run(NativeProcessSpec("runner", (), audio.task_id), timeout=2).stdout)
    assert payload == {"denied": True, "cores": min(8, len(os.sched_getaffinity(0))), "memory": 8 * 1024**3}


def test_native_process_sandbox_is_safe_when_started_from_runtime_worker_thread(tmp_path: Path):
    script = """import json, os, resource, socket
denied = False
try:
    socket.socket(socket.AF_INET, socket.SOCK_STREAM)
except OSError:
    denied = True
print(json.dumps({'denied': denied, 'cores': len(os.sched_getaffinity(0)), 'memory': resource.getrlimit(resource.RLIMIT_AS)[0]}))
"""
    host, _, tasks = make_host(tmp_path, script)
    audio = make_task(tasks)
    observed: list[dict[str, object]] = []

    def execute() -> None:
        observed.append(json.loads(host.run(NativeProcessSpec("runner", (), audio.task_id), timeout=2).stdout))

    worker = threading.Thread(target=execute)
    worker.start()
    worker.join(timeout=5)
    assert not worker.is_alive()
    assert observed == [{"denied": True, "cores": min(8, len(os.sched_getaffinity(0))), "memory": 8 * 1024**3}]


@pytest.mark.parametrize(
    ("reference", "code"),
    (
        (TaskAudioRef("../task", "audio.wav"), "V3_ASR_AUDIO_REF_INVALID"),
        (TaskAudioRef("task", "../audio.wav"), "V3_ASR_AUDIO_REF_INVALID"),
        (TaskAudioRef("task", "..\\audio.wav"), "V3_ASR_AUDIO_REF_INVALID"),
        (TaskAudioRef("task", "/tmp/audio.wav"), "V3_ASR_AUDIO_REF_INVALID"),
        (TaskAudioRef("task", "audio.mp3"), "V3_ASR_AUDIO_REF_INVALID"),
        (TaskAudioRef("task", "audio.wav", sample_rate_hz=44100), "V3_ASR_AUDIO_FORMAT_UNSUPPORTED"),
    ),
)
def test_audio_reference_shape_rejects_paths_and_non_contract_formats(reference: TaskAudioRef, code: str):
    with pytest.raises(AsrProviderError) as raised:
        reference.validate_shape()
    assert raised.value.code == code


def test_audio_file_rejects_symlink_and_hardlink(tmp_path: Path):
    host, _, tasks = make_host(tmp_path, "print('ok')\n")
    original = tasks / "source.wav"
    write_wav(original)
    symlink_task = tasks / "symlink-task"
    symlink_task.mkdir()
    (symlink_task / "audio.wav").symlink_to(original)
    with pytest.raises(AsrProviderError) as symlink_error:
        host.validate_audio(TaskAudioRef("symlink-task", "audio.wav"))
    assert symlink_error.value.code == "V3_ASR_PATH_LINK_REJECTED"

    hardlink_task = tasks / "hardlink-task"
    hardlink_task.mkdir()
    os.link(original, hardlink_task / "audio.wav")
    with pytest.raises(AsrProviderError) as hardlink_error:
        host.validate_audio(TaskAudioRef("hardlink-task", "audio.wav"))
    assert hardlink_error.value.code == "V3_ASR_AUDIO_FILE_UNSAFE"

    real_task = tasks / "real-task"
    real_task.mkdir()
    write_wav(real_task / "audio.wav")
    (tasks / "linked-task").symlink_to(real_task, target_is_directory=True)
    with pytest.raises(AsrProviderError) as task_link_error:
        host.validate_audio(TaskAudioRef("linked-task", "audio.wav"))
    assert task_link_error.value.code == "V3_ASR_TASK_PATH_UNSAFE"


def test_process_timeout_cancel_crash_and_output_limit_fail_closed(tmp_path: Path):
    timeout_host, _, timeout_tasks = make_host(tmp_path / "timeout", "import time\ntime.sleep(10)\n")
    timeout_audio = make_task(timeout_tasks)
    with pytest.raises(AsrProviderError) as timeout_error:
        timeout_host.run(NativeProcessSpec("runner", (), timeout_audio.task_id), timeout=0.05)
    assert timeout_error.value.code == "V3_ASR_PROCESS_TIMEOUT"

    cancel_host, _, cancel_tasks = make_host(tmp_path / "cancel", "import time\ntime.sleep(10)\n")
    cancel_audio = make_task(cancel_tasks)
    cancelled = threading.Event()
    timer = threading.Timer(0.05, cancelled.set)
    timer.start()
    with pytest.raises(AsrProviderError) as cancel_error:
        cancel_host.run(NativeProcessSpec("runner", (), cancel_audio.task_id), timeout=2, cancel_event=cancelled)
    timer.cancel()
    assert cancel_error.value.code == "V3_ASR_PROCESS_CANCELLED"

    crash_host, _, crash_tasks = make_host(tmp_path / "crash", "raise SystemExit(17)\n")
    crash_audio = make_task(crash_tasks)
    with pytest.raises(AsrProviderError) as crash_error:
        crash_host.run(NativeProcessSpec("runner", (), crash_audio.task_id), timeout=2)
    assert crash_error.value.code == "V3_ASR_PROCESS_FAILED"

    output_host, _, output_tasks = make_host(tmp_path / "output", "print('x' * 100000)\n", max_output_bytes=1024)
    output_audio = make_task(output_tasks)
    with pytest.raises(AsrProviderError) as output_error:
        output_host.run(NativeProcessSpec("runner", (), output_audio.task_id), timeout=2)
    assert output_error.value.code == "V3_ASR_PROCESS_OUTPUT_LIMIT"


def test_executable_allowlist_and_install_links_are_rejected(tmp_path: Path):
    host, install, tasks = make_host(tmp_path, "print('ok')\n")
    audio = make_task(tasks)
    with pytest.raises(AsrProviderError) as executable_error:
        host.run(NativeProcessSpec("other", (), audio.task_id), timeout=2)
    assert executable_error.value.code == "V3_ASR_EXECUTABLE_NOT_ALLOWED"
    (install / "linked").symlink_to(install / "runner")
    with pytest.raises(AsrProviderError) as path_error:
        host.validate_install_file("linked")
    assert path_error.value.code == "V3_ASR_PATH_LINK_REJECTED"


def test_funasr_adapter_uses_fixed_argv_lifecycle_and_cleans_task(tmp_path: Path):
    install = tmp_path / "install"
    tasks = tmp_path / "tasks"
    install.mkdir()
    tasks.mkdir()
    write_executable(
        install / "llama-funasr-paraformer",
        """import pathlib, sys\nargs = sys.argv[1:]\nassert args[0] == '-m' and pathlib.Path(args[1]).name == 'paraformer-q8.gguf'\nassert args[2] == '--vad' and pathlib.Path(args[3]).name == 'fsmn-vad.gguf'\nassert args[4:6] == ['--vad-maxseg', '15000']\nassert args[6] == '-a' and pathlib.Path(args[7]).name == 'audio.wav'\nassert args[8] == '--srt' and len(args) == 9\nprint('1\\n00:00:00,000 --> 00:00:00,100\\nhello\\n')\n""",
    )
    (install / "paraformer-q8.gguf").write_bytes(b"model")
    (install / "fsmn-vad.gguf").write_bytes(b"vad")
    audio = make_task(tasks)
    adapter = FunAsrLlamaCppProviderAdapter(install, tasks)
    with pytest.raises(AsrProviderError) as before_load:
        adapter.transcribe(audio, timeout=2)
    assert before_load.value.code == "V3_ASR_PROVIDER_NOT_LOADED"
    adapter.load()
    result = adapter.transcribe(audio, timeout=2)
    assert result.provider_id == "funasr_edge_local"
    assert result.model_id == "funasr-paraformer-q8"
    assert result.format == "srt"
    assert "hello" in result.text
    assert not (tasks / audio.task_id).exists()
    adapter.close()
    with pytest.raises(AsrProviderError) as after_close:
        adapter.transcribe(audio, timeout=2)
    assert after_close.value.code == "V3_ASR_PROVIDER_CLOSED"


def test_funasr_adapter_builds_platform_specific_executable_name(tmp_path: Path):
    install = tmp_path / "install"
    tasks = tmp_path / "tasks"
    install.mkdir()
    tasks.mkdir()
    for name in ("llama-funasr-paraformer", "llama-funasr-paraformer.exe", "paraformer-q8.gguf", "fsmn-vad.gguf"):
        (install / name).write_bytes(b"asset")
    assert FunAsrLlamaCppProviderAdapter(install, tasks, platform_name="linux").executable_name == "llama-funasr-paraformer"
    assert FunAsrLlamaCppProviderAdapter(install, tasks, platform_name="windows").executable_name == "llama-funasr-paraformer.exe"
    with pytest.raises(AsrProviderError) as unsupported:
        FunAsrLlamaCppProviderAdapter(install, tasks, platform_name="darwin")
    assert unsupported.value.code == "V3_ASR_PLATFORM_UNSUPPORTED"


def test_sensevoice_adapter_uses_frozen_binary_model_and_cpu_arguments(tmp_path: Path):
    install = tmp_path / "install"
    tasks = tmp_path / "tasks"
    install.mkdir()
    tasks.mkdir()
    write_executable(
        install / "llama-funasr-sensevoice",
        """import pathlib, sys\nargs = sys.argv[1:]\nassert args[0] == '-m' and pathlib.Path(args[1]).name == 'sensevoice-small-q8.gguf'\nassert args[2] == '--vad' and pathlib.Path(args[3]).name == 'fsmn-vad.gguf'\nassert args[4:6] == ['--vad-maxseg', '15000']\nassert args[6] == '-a' and pathlib.Path(args[7]).name == 'audio.wav'\nassert args[8:] == ['--backend', 'cpu', '--srt']\nprint('[sensevoice] VAD ready: 1 segments', file=sys.stderr)\nprint('[sensevoice] 1 vad segments', file=sys.stderr)\nprint('1\\n00:00:00,000 --> 00:00:00,100\\nSenseVoice baseline\\n')\n""",
    )
    (install / "sensevoice-small-q8.gguf").write_bytes(b"model")
    (install / "fsmn-vad.gguf").write_bytes(b"vad")
    audio = make_task(tasks, "sensevoice-task")
    adapter = FunAsrLlamaCppProviderAdapter(install, tasks, model_id="funasr-sensevoice-small-q8")
    adapter.load()
    result = adapter.transcribe(audio, timeout=2)
    assert result.model_id == "funasr-sensevoice-small-q8"
    assert result.vad_segment_count == 1
    assert "SenseVoice baseline" in result.text
    assert not (tasks / audio.task_id).exists()


@pytest.mark.parametrize(
    "stderr",
    [
        "",
        "[sensevoice] VAD ready: 0 segments\n[sensevoice] 0 vad segments\n",
        "[sensevoice] VAD ready: 1 segments\n",
        "[sensevoice] VAD ready: 1 segments\n[sensevoice] 2 vad segments\n",
        "[sensevoice] VAD ready: 1 segments\n[sensevoice] VAD ready: 1 segments\n[sensevoice] 1 vad segments\n",
    ],
)
def test_sensevoice_adapter_rejects_missing_conflicting_or_duplicate_vad_receipt(tmp_path: Path, stderr: str):
    install = tmp_path / "install"
    tasks = tmp_path / "tasks"
    install.mkdir()
    tasks.mkdir()
    write_executable(
        install / "llama-funasr-sensevoice",
        "import sys\n"
        + f"sys.stderr.write({stderr!r})\n"
        + "print('1\\n00:00:00,000 --> 00:00:00,100\\ntext\\n')\n",
    )
    (install / "sensevoice-small-q8.gguf").write_bytes(b"model")
    (install / "fsmn-vad.gguf").write_bytes(b"vad")
    audio = make_task(tasks, "sensevoice-task")
    adapter = FunAsrLlamaCppProviderAdapter(install, tasks, model_id="funasr-sensevoice-small-q8")
    adapter.load()
    with pytest.raises(AsrProviderError) as raised:
        adapter.transcribe(audio, timeout=2)
    assert raised.value.code == "V3_ASR_VAD_RECEIPT_INVALID"
    assert not (tasks / audio.task_id).exists()


def test_sensevoice_self_test_allows_consistent_zero_vad_but_production_does_not(tmp_path: Path):
    install = tmp_path / "install"
    tasks = tmp_path / "tasks"
    install.mkdir()
    tasks.mkdir()
    write_executable(
        install / "llama-funasr-sensevoice",
        "import sys\nprint('[sensevoice] VAD ready: 0 segments', file=sys.stderr)\n"
        "print('[sensevoice] 0 vad segments', file=sys.stderr)\n",
    )
    (install / "sensevoice-small-q8.gguf").write_bytes(b"model")
    (install / "fsmn-vad.gguf").write_bytes(b"vad")
    adapter = FunAsrLlamaCppProviderAdapter(install, tasks, model_id="funasr-sensevoice-small-q8")
    adapter.load()
    audio = make_task(tasks, "self-test")
    assert adapter.self_test(audio).vad_segment_count == 0
    audio = make_task(tasks, "production")
    with pytest.raises(AsrProviderError) as raised:
        adapter.transcribe(audio, timeout=2)
    assert raised.value.code == "V3_ASR_VAD_RECEIPT_INVALID"


def test_funasr_adapter_rejects_unregistered_model(tmp_path: Path):
    with pytest.raises(AsrProviderError) as raised:
        FunAsrLlamaCppProviderAdapter(tmp_path / "install", tmp_path / "tasks", model_id="client.module.Class")
    assert raised.value.code == "V3_ASR_MODEL_NOT_REGISTERED"


def test_funasr_adapter_cancellation_cleans_task_audio(tmp_path: Path):
    install = tmp_path / "install"
    tasks = tmp_path / "tasks"
    install.mkdir()
    tasks.mkdir()
    write_executable(install / "llama-funasr-paraformer", "import time\ntime.sleep(10)\n")
    (install / "paraformer-q8.gguf").write_bytes(b"model")
    (install / "fsmn-vad.gguf").write_bytes(b"vad")
    audio = make_task(tasks)
    adapter = FunAsrLlamaCppProviderAdapter(install, tasks)
    adapter.load()
    cancelled = threading.Event()
    timer = threading.Timer(0.05, cancelled.set)
    timer.start()
    with pytest.raises(AsrProviderError) as raised:
        adapter.transcribe(audio, timeout=2, cancel_event=cancelled)
    timer.cancel()
    assert raised.value.code == "V3_ASR_PROCESS_CANCELLED"
    assert not (tasks / audio.task_id).exists()
