from __future__ import annotations

import hashlib
import io
import json
import os
import stat
import threading
import time
import urllib.error
import zipfile
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from jsonschema import Draft202012Validator, FormatChecker

import navia_runtime.modules.media_companion.asr.model_manager as manager_module
from navia_runtime.modules.media_companion.asr.catalog import AsrModelDescriptor, AsrModelFile, AsrResourceProfile
from navia_runtime.modules.media_companion.asr.model_manager import AsrModelManager, AsrModelManagerError


ROOT = Path(__file__).resolve().parents[3]


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def test_public_contract_schema_and_negative_shapes():
    schema = json.loads((ROOT / "docs/active/project/contracts/v3_asr_model_management_contracts.schema.json").read_text(encoding="utf-8"))
    instance = json.loads((ROOT / "docs/active/project/fixtures/v3-asr-model-management-positive.json").read_text(encoding="utf-8"))
    Draft202012Validator.check_schema(schema)
    validator = Draft202012Validator(schema, format_checker=FormatChecker())
    assert list(validator.iter_errors(instance)) == []
    invalid = json.loads(json.dumps(instance))
    invalid["catalog"]["models"][0]["fallbackOnly"] = "yes"
    assert list(validator.iter_errors(invalid))


def test_production_catalog_matches_public_schema(tmp_path: Path):
    schema = json.loads((ROOT / "docs/active/project/contracts/v3_asr_model_management_contracts.schema.json").read_text(encoding="utf-8"))
    fixture = json.loads((ROOT / "docs/active/project/fixtures/v3-asr-model-management-positive.json").read_text(encoding="utf-8"))
    manager = AsrModelManager(tmp_path / "state", self_test=lambda *_: None)
    instance = {
        "catalog": manager.catalog(),
        "selection": manager.settings(),
        "installationJob": fixture["installationJob"],
    }
    errors = list(Draft202012Validator(schema, format_checker=FormatChecker()).iter_errors(instance))
    assert errors == []
    paraformer = next(model for model in instance["catalog"]["models"] if model["modelId"] == "funasr-paraformer-q8")
    assert paraformer["installable"] is True
    assert paraformer["selectable"] is False
    assert paraformer["quality"]["status"] == "failed_current_gate"
    assert paraformer["runtimeKind"] == "native_process"
    sensevoice = next(model for model in instance["catalog"]["models"] if model["modelId"] == "funasr-sensevoice-small-q8")
    assert sensevoice["installable"] is True
    assert sensevoice["selectable"] is True
    assert sensevoice["quality"]["status"] == "development_baseline"
    assert sensevoice["resources"]["requiresGpu"] is False
    assert sensevoice["resources"]["estimatedPeakRamBytes"] == 2 * 1024**3
    invalid = json.loads(json.dumps(instance))
    invalid["selection"]["absolutePath"] = "/home/user/model"
    validator = Draft202012Validator(schema, format_checker=FormatChecker())
    assert list(validator.iter_errors(invalid))


@pytest.fixture
def fake_catalog(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    tiny_files = {"config.json": b'{"model":"tiny"}', "model.bin": b"tiny-model"}
    remote_files = {"config.json": b'{"model":"small"}', "model.bin": b"small-model-bytes" * 2048}

    server_root = tmp_path / "http"
    server_root.mkdir()
    for name, content in remote_files.items():
        (server_root / name).write_bytes(content)
    handler = partial(SimpleHTTPRequestHandler, directory=str(server_root))
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()

    def descriptor(model_id: str, files: dict[str, bytes], *, bundled: bool, installable: bool):
        entries = tuple(
            AsrModelFile(
                path=name,
                byte_length=len(content),
                sha256=sha256(content),
                source_url=None if bundled else f"http://127.0.0.1:{server.server_port}/{name}",
            )
            for name, content in files.items()
        )
        return AsrModelDescriptor(
            model_id=model_id,
            provider_id="faster_whisper_local",
            name=model_id,
            repository=f"test/{model_id}",
            revision="f" * 40,
            license="MIT",
            install_kind="bundled" if bundled else "remote_verified",
            installable=installable,
            selectable=True,
            bundled=bundled,
            fallback_only=bundled,
            quality_status="fallback_only" if bundled else "failed_current_gate",
            quality_note="test",
            resources=AsrResourceProfile(sum(map(len, files.values())), sum(map(len, files.values())), 1024, False, 1, 0),
            files=entries,
        )

    tiny = descriptor("faster-whisper-tiny", tiny_files, bundled=True, installable=False)
    remote = descriptor("faster-whisper-small", remote_files, bundled=False, installable=True)
    monkeypatch.setattr(manager_module, "ASR_MODELS", (tiny, remote))
    monkeypatch.setattr(manager_module, "ASR_MODEL_BY_ID", {tiny.model_id: tiny, remote.model_id: remote})

    bundled_root = tmp_path / "bundled"
    tiny_root = bundled_root / tiny.model_id
    tiny_root.mkdir(parents=True)
    for name, content in tiny_files.items():
        (tiny_root / name).write_bytes(content)

    yield {"tiny": tiny, "remote": remote, "bundledRoot": bundled_root, "remoteFiles": remote_files}
    server.shutdown()
    thread.join(timeout=2)


def make_manager(tmp_path: Path, catalog: dict) -> AsrModelManager:
    return AsrModelManager(
        tmp_path / "state",
        bundled_root=catalog["bundledRoot"],
        self_test=lambda descriptor, path: (path / "model.bin").read_bytes(),
        chunk_size=1024,
        source_host_allowlist=frozenset({"127.0.0.1"}),
        source_host_suffix_allowlist=(),
        allow_http_sources=True,
    )


def test_uninstalled_model_selection_fails_closed_and_keeps_bundled_fallback(tmp_path: Path, fake_catalog: dict):
    manager = make_manager(tmp_path, fake_catalog)
    assert manager.settings()["effectiveModelId"] == "faster-whisper-tiny"
    assert manager.catalog()["models"][0]["installation"]["state"] == "ready"

    with pytest.raises(AsrModelManagerError) as raised:
        manager.patch_settings({"requestedModelId": "faster-whisper-small"})
    assert raised.value.code == "V3_ASR_MODEL_NOT_READY"
    settings = manager.settings()
    assert settings["requestedModelId"] == "faster-whisper-tiny"
    assert settings["effectiveModelId"] == "faster-whisper-tiny"
    assert settings["fallbackActive"] is False


def test_remote_install_reads_real_http_bytes_verifies_and_survives_restart(tmp_path: Path, fake_catalog: dict):
    manager = make_manager(tmp_path, fake_catalog)
    job = manager.start_install("faster-whisper-small", asynchronous=False)
    assert job["state"] == "ready"
    assert job["bytesCompleted"] == job["bytesTotal"]
    assert job["percent"] == 100.0

    manager.patch_settings({"requestedModelId": "faster-whisper-small"})
    assert manager.settings()["effectiveModelId"] == "faster-whisper-small"
    restarted = make_manager(tmp_path, fake_catalog)
    assert restarted.settings()["effectiveModelId"] == "faster-whisper-small"
    assert restarted.catalog()["models"][1]["installation"]["state"] == "ready"
    assert job["bytesPerSecond"] > 0
    assert job["etaSeconds"] == 0
    assert [item["state"] for item in job["history"]] == ["checking", "downloading", "verifying", "self_testing", "installing", "ready"]


def test_hash_mismatch_never_publishes_model(tmp_path: Path, fake_catalog: dict, monkeypatch: pytest.MonkeyPatch):
    remote = fake_catalog["remote"]
    corrupt = AsrModelDescriptor(
        **{**remote.__dict__, "files": tuple(
            AsrModelFile(item.path, item.byte_length, "0" * 64, item.source_url) if item.path == "model.bin" else item
            for item in remote.files
        )}
    )
    monkeypatch.setattr(manager_module, "ASR_MODELS", (fake_catalog["tiny"], corrupt))
    monkeypatch.setattr(manager_module, "ASR_MODEL_BY_ID", {fake_catalog["tiny"].model_id: fake_catalog["tiny"], corrupt.model_id: corrupt})
    manager = make_manager(tmp_path, fake_catalog)
    job = manager.start_install(corrupt.model_id, asynchronous=False)
    assert job["state"] == "corrupt"
    assert job["failureCode"] == "V3_ASR_HASH_MISMATCH"
    assert not (manager.models_root / corrupt.model_id).exists()
    assert not (manager.staging_root / job["jobId"]).exists()


def write_package(
    path: Path,
    descriptor: AsrModelDescriptor,
    files: dict[str, bytes],
    *,
    unsafe_name: str | None = None,
    manifest_changes: dict | None = None,
):
    manifest = {
        "schemaVersion": "v3-asr-offline-package/v1",
        "modelId": descriptor.model_id,
        "revision": descriptor.revision,
        "files": [{"path": item.path, "byteLength": item.byte_length, "sha256": item.sha256} for item in descriptor.files],
    }
    manifest.update(manifest_changes or {})
    with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("manifest.json", json.dumps(manifest))
        for name, content in files.items():
            archive.writestr(name, content)
        if unsafe_name:
            archive.writestr(unsafe_name, b"escape")


def test_offline_package_import_and_zip_slip_rejection(tmp_path: Path, fake_catalog: dict):
    manager = make_manager(tmp_path, fake_catalog)
    _, valid_path = manager.create_import_path("faster-whisper-small")
    write_package(valid_path, fake_catalog["remote"], fake_catalog["remoteFiles"])
    valid = manager.start_import("faster-whisper-small", valid_path, asynchronous=False)
    assert valid["state"] == "ready"

    manager.uninstall("faster-whisper-small")
    _, invalid_path = manager.create_import_path("faster-whisper-small")
    write_package(invalid_path, fake_catalog["remote"], fake_catalog["remoteFiles"], unsafe_name="../escape")
    invalid = manager.start_import("faster-whisper-small", invalid_path, asynchronous=False)
    assert invalid["state"] == "corrupt"
    assert invalid["failureCode"] == "V3_ASR_PACKAGE_INVALID"
    assert not (tmp_path / "escape").exists()


@pytest.mark.parametrize(
    ("manifest_changes", "mutate_files", "expected_state", "expected_code"),
    (
        ({"modelId": "different-model"}, False, "failed", "V3_ASR_PACKAGE_MODEL_MISMATCH"),
        ({"revision": "0" * 40}, False, "failed", "V3_ASR_PACKAGE_MODEL_MISMATCH"),
        ({}, True, "corrupt", "V3_ASR_HASH_MISMATCH"),
    ),
)
def test_offline_package_rejects_wrong_identity_revision_or_hash(
    tmp_path: Path,
    fake_catalog: dict,
    manifest_changes: dict,
    mutate_files: bool,
    expected_state: str,
    expected_code: str,
):
    manager = make_manager(tmp_path, fake_catalog)
    _, package_path = manager.create_import_path("faster-whisper-small")
    files = dict(fake_catalog["remoteFiles"])
    if mutate_files:
        files["model.bin"] = bytes([files["model.bin"][0] ^ 1]) + files["model.bin"][1:]
    write_package(package_path, fake_catalog["remote"], files, manifest_changes=manifest_changes)
    result = manager.start_import("faster-whisper-small", package_path, asynchronous=False)
    assert result["state"] == expected_state
    assert result["failureCode"] == expected_code
    assert manager.model_path("faster-whisper-small") is None


def test_offline_package_rejects_size_and_file_count_limits(tmp_path: Path, fake_catalog: dict, monkeypatch: pytest.MonkeyPatch):
    manager = make_manager(tmp_path, fake_catalog)
    _, oversized_path = manager.create_import_path("faster-whisper-small")
    write_package(oversized_path, fake_catalog["remote"], fake_catalog["remoteFiles"])
    monkeypatch.setattr(manager_module, "MAX_OFFLINE_PACKAGE_BYTES", oversized_path.stat().st_size - 1)
    oversized = manager.start_import("faster-whisper-small", oversized_path, asynchronous=False)
    assert oversized["state"] == "failed"
    assert oversized["failureCode"] == "V3_ASR_PACKAGE_TOO_LARGE"

    monkeypatch.setattr(manager_module, "MAX_OFFLINE_PACKAGE_BYTES", 2_200_000_000)
    monkeypatch.setattr(manager_module, "MAX_OFFLINE_PACKAGE_FILES", 1)
    _, crowded_path = manager.create_import_path("faster-whisper-small")
    write_package(crowded_path, fake_catalog["remote"], fake_catalog["remoteFiles"])
    crowded = manager.start_import("faster-whisper-small", crowded_path, asynchronous=False)
    assert crowded["state"] == "corrupt"
    assert crowded["failureCode"] == "V3_ASR_PACKAGE_INVALID"


def test_remote_install_failures_never_publish_or_replace_fallback(tmp_path: Path, fake_catalog: dict, monkeypatch: pytest.MonkeyPatch):
    manager = make_manager(tmp_path, fake_catalog)

    def fail_download(_job_id, _url, _destination, _expected_size, _transfer_started):
        raise urllib.error.URLError("connection reset")

    monkeypatch.setattr(manager, "_download_file", fail_download)
    disconnected = manager.start_install("faster-whisper-small", asynchronous=False)
    assert disconnected["state"] == "failed"
    assert disconnected["failureCode"] == "V3_ASR_INSTALL_FAILED"
    assert manager.model_path("faster-whisper-small") is None
    assert manager.settings()["effectiveModelId"] == "faster-whisper-tiny"

    def fail_disk(_job_id, _url, _destination, _expected_size, _transfer_started):
        raise OSError("disk full")

    monkeypatch.setattr(manager, "_download_file", fail_disk)
    disk_failure = manager.start_install("faster-whisper-small", asynchronous=False)
    assert disk_failure["state"] == "failed"
    assert disk_failure["failureCode"] == "V3_ASR_INSTALL_FAILED"
    assert manager.model_path("faster-whisper-small") is None


def test_remote_install_rejects_404_and_truncated_bytes(tmp_path: Path, fake_catalog: dict, monkeypatch: pytest.MonkeyPatch):
    remote = fake_catalog["remote"]
    missing_files = tuple(
        AsrModelFile(item.path, item.byte_length, item.sha256, item.source_url + ".missing")
        for item in remote.files
    )
    missing = AsrModelDescriptor(**{**remote.__dict__, "files": missing_files})
    monkeypatch.setattr(manager_module, "ASR_MODELS", (fake_catalog["tiny"], missing))
    monkeypatch.setattr(manager_module, "ASR_MODEL_BY_ID", {fake_catalog["tiny"].model_id: fake_catalog["tiny"], missing.model_id: missing})
    missing_manager = make_manager(tmp_path / "missing", fake_catalog)
    not_found = missing_manager.start_install(missing.model_id, asynchronous=False)
    assert not_found["state"] == "failed"
    assert not_found["failureCode"] == "V3_ASR_INSTALL_FAILED"

    truncated_files = tuple(
        AsrModelFile(item.path, item.byte_length + 1, item.sha256, item.source_url)
        if item.path == "model.bin" else item
        for item in remote.files
    )
    truncated = AsrModelDescriptor(**{**remote.__dict__, "files": truncated_files})
    monkeypatch.setattr(manager_module, "ASR_MODELS", (fake_catalog["tiny"], truncated))
    monkeypatch.setattr(manager_module, "ASR_MODEL_BY_ID", {fake_catalog["tiny"].model_id: fake_catalog["tiny"], truncated.model_id: truncated})
    truncated_manager = make_manager(tmp_path / "truncated", fake_catalog)
    short = truncated_manager.start_install(truncated.model_id, asynchronous=False)
    assert short["state"] == "failed"
    assert short["failureCode"] == "V3_ASR_SIZE_MISMATCH"
    assert truncated_manager.model_path(truncated.model_id) is None


def test_qualification_and_bundled_removal_fail_closed(tmp_path: Path, fake_catalog: dict):
    manager = make_manager(tmp_path, fake_catalog)
    with pytest.raises(AsrModelManagerError, match="not available"):
        manager.start_install("faster-whisper-tiny", asynchronous=False)
    with pytest.raises(AsrModelManagerError, match="cannot be removed"):
        manager.uninstall("faster-whisper-tiny")
    with pytest.raises(AsrModelManagerError, match="immutable catalog"):
        manager.patch_settings({"requestedModelId": "remote-code-from-user"})


def test_uninstalling_requested_model_explicitly_returns_to_bundled_fallback(tmp_path: Path, fake_catalog: dict):
    manager = make_manager(tmp_path, fake_catalog)
    installed = manager.start_install("faster-whisper-small", asynchronous=False)
    assert installed["state"] == "ready"
    manager.patch_settings({"requestedModelId": "faster-whisper-small"})
    settings = manager.uninstall("faster-whisper-small")
    assert settings["requestedModelId"] == "faster-whisper-tiny"
    assert settings["effectiveModelId"] == "faster-whisper-tiny"
    assert settings["fallbackActive"] is False
    assert manager.model_path("faster-whisper-small") is None


def test_source_allowlist_rejects_local_file_credentials_and_unlisted_redirects(tmp_path: Path, fake_catalog: dict):
    manager = make_manager(tmp_path, fake_catalog)
    for value in (
        "file:///etc/passwd",
        "https://user:secret@huggingface.co/model.bin",
        "https://example.invalid/model.bin",
        "http://localhost/model.bin",
    ):
        with pytest.raises(AsrModelManagerError) as raised:
            manager._validate_source_url(value)
        assert raised.value.code == "V3_ASR_SOURCE_NOT_ALLOWED"
    production_manager = AsrModelManager(tmp_path / "production-policy", bundled_root=fake_catalog["bundledRoot"], self_test=lambda *_: None)
    production_manager._validate_source_url("https://us.aws.cdn.hf.co/xet-bridge-us/model.bin")
    with pytest.raises(AsrModelManagerError):
        production_manager._validate_source_url("https://us.aws.cdn.hf.co.attacker.invalid/model.bin")


def test_cancelled_install_cleans_staging_and_keeps_fallback(tmp_path: Path, fake_catalog: dict, monkeypatch: pytest.MonkeyPatch):
    manager = make_manager(tmp_path, fake_catalog)
    entered = threading.Event()

    def slow_download(job_id, _url, destination, _expected_size, transfer_started):
        destination.parent.mkdir(parents=True, exist_ok=True)
        entered.set()
        while True:
            manager._check_cancel(job_id)
            time.sleep(0.01)

    monkeypatch.setattr(manager, "_download_file", slow_download)
    job = manager.start_install("faster-whisper-small")
    assert entered.wait(timeout=2)
    manager.cancel_job(job["jobId"])
    result = manager.wait(job["jobId"], timeout=2)
    assert result["state"] == "cancelled"
    assert manager.settings()["effectiveModelId"] == "faster-whisper-tiny"
    assert not (manager.staging_root / job["jobId"]).exists()


def test_restart_marks_active_job_failed_and_removes_staging(tmp_path: Path, fake_catalog: dict):
    manager = make_manager(tmp_path, fake_catalog)
    job_id = "asrjob_interrupted"
    manager._state["jobs"][job_id] = manager._new_job("faster-whisper-small", "remote") | {"jobId": job_id, "state": "downloading"}
    manager._state["jobs"].pop(next(key for key in manager._state["jobs"] if key != job_id))
    manager._write_state()
    stage = manager.staging_root / job_id
    stage.mkdir()
    (stage / "partial.bin").write_bytes(b"partial")

    restarted = make_manager(tmp_path, fake_catalog)
    recovered = restarted.get_job(job_id)
    assert recovered["state"] == "failed"
    assert recovered["failureCode"] == "V3_ASR_RUNTIME_RESTARTED"
    assert [entry["state"] for entry in recovered["history"]][-2:] == ["checking", "failed"]
    assert recovered["history"][-1]["sequence"] == recovered["sequence"]
    assert not stage.exists()


def test_runtime_api_exposes_catalog_selection_and_rejects_client_url(tmp_path: Path, fake_catalog: dict, monkeypatch: pytest.MonkeyPatch):
    import navia_runtime.app as runtime_app

    manager = make_manager(tmp_path, fake_catalog)
    monkeypatch.setattr(runtime_app, "asr_model_manager", manager)
    client = TestClient(runtime_app.app)
    catalog = client.get("/v1/asr/catalog").json()["data"]
    assert catalog["schemaVersion"] == "v3-asr-model-catalog/v1"
    assert catalog["models"][0]["fallbackOnly"] is True

    rejected = client.patch("/v1/asr/settings", json={"requestedModelId": "faster-whisper-small", "url": "file:///etc/passwd"})
    assert rejected.status_code == 400
    assert rejected.json()["error"]["code"] == "V3_ASR_REQUEST_INVALID"
    selected = client.patch("/v1/asr/settings", json={"requestedModelId": "faster-whisper-small"})
    assert selected.status_code == 409
    assert selected.json()["error"]["code"] == "V3_ASR_MODEL_NOT_READY"
    install = client.post("/v1/asr/installations", json={"modelId": "unknown", "url": "http://127.0.0.1/private"})
    assert install.status_code == 400
    assert install.json()["error"]["code"] == "V3_ASR_REQUEST_INVALID"
    install = client.post("/v1/asr/installations", json={"modelId": "unknown"})
    assert install.status_code == 404
    assert install.json()["error"]["code"] == "V3_ASR_MODEL_UNKNOWN"


def zip_bytes(member_name: str, content: bytes, *, symlink: bool = False) -> bytes:
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        if symlink:
            info = zipfile.ZipInfo(member_name)
            info.create_system = 3
            info.external_attr = (stat.S_IFLNK | 0o777) << 16
            archive.writestr(info, content)
        else:
            archive.writestr(member_name, content)
    return output.getvalue()


def make_archive_candidate(runtime_archive: bytes, *, archive_member: str = "runner", installed_sha: str | None = None) -> tuple[AsrModelDescriptor, dict[str, bytes]]:
    runner = b"#!/bin/sh\nexit 0\n"
    model = b"model-q8"
    vad = b"vad"
    files = {
        "runtime.zip": runtime_archive,
        "paraformer-q8.gguf": model,
        "fsmn-vad.gguf": vad,
    }
    descriptor = AsrModelDescriptor(
        model_id="funasr-paraformer-q8",
        provider_id="funasr_edge_local",
        name="Paraformer Q8",
        repository="test/paraformer",
        revision="1" * 40,
        license="Apache-2.0 + MIT runtime",
        install_kind="remote_verified",
        installable=True,
        selectable=False,
        bundled=False,
        fallback_only=False,
        quality_status="qualification_pending",
        quality_note="test qualification pending",
        resources=AsrResourceProfile(sum(map(len, files.values())), len(runner) + len(model) + len(vad), 8 * 1024**3, False, 8, 0, 1024**3),
        files=(
            AsrModelFile("runtime.zip", len(runtime_archive), sha256(runtime_archive), archive_member=archive_member, installed_path="runner", installed_byte_length=len(runner), installed_sha256=installed_sha or sha256(runner), executable=True),
            AsrModelFile("paraformer-q8.gguf", len(model), sha256(model)),
            AsrModelFile("fsmn-vad.gguf", len(vad), sha256(vad)),
        ),
        runtime_kind="native_process",
        capabilities=("asr", "srt_timestamps"),
        quality_gate_version="v3-2-a06/v1",
    )
    return descriptor, files


def test_nested_runtime_archive_materializes_only_frozen_member_and_stays_unselectable(tmp_path: Path, fake_catalog: dict, monkeypatch: pytest.MonkeyPatch):
    runner = b"#!/bin/sh\nexit 0\n"
    runtime = zip_bytes("runner", runner)
    candidate, files = make_archive_candidate(runtime)
    tiny = fake_catalog["tiny"]
    monkeypatch.setattr(manager_module, "ASR_MODELS", (tiny, candidate))
    monkeypatch.setattr(manager_module, "ASR_MODEL_BY_ID", {tiny.model_id: tiny, candidate.model_id: candidate})
    manager = AsrModelManager(
        tmp_path / "state",
        bundled_root=fake_catalog["bundledRoot"],
        self_test=lambda _descriptor, path: (path / "runner").read_bytes(),
    )
    _, package = manager.create_import_path(candidate.model_id)
    write_package(package, candidate, files)
    result = manager.start_import(candidate.model_id, package, asynchronous=False)
    assert result["state"] == "ready"
    published = manager.model_path(candidate.model_id)
    assert published is not None
    assert {path.name for path in published.iterdir()} == {"runner", "paraformer-q8.gguf", "fsmn-vad.gguf"}
    assert os.access(published / "runner", os.X_OK)
    assert not (published / "runtime.zip").exists()
    with pytest.raises(AsrModelManagerError) as not_qualified:
        manager.patch_settings({"requestedModelId": candidate.model_id})
    assert not_qualified.value.code == "V3_ASR_MODEL_NOT_QUALIFIED"
    assert manager.settings()["effectiveModelId"] == tiny.model_id


@pytest.mark.parametrize(("archive_member", "symlink"), (("../runner", False), ("runner", True)))
def test_nested_runtime_archive_rejects_unsafe_member_and_never_publishes(
    tmp_path: Path,
    fake_catalog: dict,
    monkeypatch: pytest.MonkeyPatch,
    archive_member: str,
    symlink: bool,
):
    runner = b"#!/bin/sh\nexit 0\n"
    runtime = zip_bytes(archive_member, runner if not symlink else b"outside", symlink=symlink)
    candidate, files = make_archive_candidate(runtime, archive_member=archive_member)
    tiny = fake_catalog["tiny"]
    monkeypatch.setattr(manager_module, "ASR_MODELS", (tiny, candidate))
    monkeypatch.setattr(manager_module, "ASR_MODEL_BY_ID", {tiny.model_id: tiny, candidate.model_id: candidate})
    manager = make_manager(tmp_path, fake_catalog)
    _, package = manager.create_import_path(candidate.model_id)
    write_package(package, candidate, files)
    result = manager.start_import(candidate.model_id, package, asynchronous=False)
    assert result["state"] == "failed"
    assert result["failureCode"] == "V3_ASR_ARCHIVE_MEMBER_UNSAFE"
    assert manager.model_path(candidate.model_id) is None
    assert manager.settings()["effectiveModelId"] == tiny.model_id


def test_atomic_publish_retries_transient_permission_error(tmp_path: Path, fake_catalog: dict, monkeypatch: pytest.MonkeyPatch):
    manager = make_manager(tmp_path, fake_catalog)
    source = tmp_path / "source"
    destination = tmp_path / "destination"
    source.mkdir()
    original = Path.rename
    attempts = 0

    def flaky_rename(path: Path, target: Path):
        nonlocal attempts
        attempts += 1
        if attempts == 1:
            raise PermissionError("transient executable lock")
        return original(path, target)

    monkeypatch.setattr(Path, "rename", flaky_rename)
    manager._rename_with_retry(source, destination, timeout=1)
    assert attempts == 2
    assert destination.is_dir()
