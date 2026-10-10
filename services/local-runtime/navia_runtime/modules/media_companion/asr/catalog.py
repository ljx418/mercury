from __future__ import annotations

import os
from dataclasses import asdict, dataclass


MIB = 1024 * 1024
GIB = 1024 * MIB
DEFAULT_ASR_MODEL_ID = "faster-whisper-tiny"
FALLBACK_ASR_MODEL_ID = DEFAULT_ASR_MODEL_ID
V3_BASELINE_ASR_MODEL_ID = "funasr-sensevoice-small-q8"


@dataclass(frozen=True)
class AsrProviderDescriptor:
    provider_id: str
    name: str
    engine: str
    engine_version: str
    locality: str
    status: str
    description: str
    runtime_kind: str | None = None
    capabilities: tuple[str, ...] = ()

    def public_dict(self) -> dict:
        result = {
            "providerId": self.provider_id,
            "name": self.name,
            "engine": self.engine,
            "engineVersion": self.engine_version,
            "locality": self.locality,
            "status": self.status,
            "description": self.description,
        }
        if self.runtime_kind is not None:
            result["runtimeKind"] = self.runtime_kind
        if self.capabilities:
            result["capabilities"] = list(self.capabilities)
        return result


@dataclass(frozen=True)
class AsrModelFile:
    path: str
    byte_length: int
    sha256: str
    source_url: str | None = None
    archive_member: str | None = None
    installed_path: str | None = None
    installed_byte_length: int | None = None
    installed_sha256: str | None = None
    executable: bool = False

    @property
    def published_path(self) -> str:
        return self.installed_path or self.path

    @property
    def published_byte_length(self) -> int:
        return self.installed_byte_length if self.installed_byte_length is not None else self.byte_length

    @property
    def published_sha256(self) -> str:
        return self.installed_sha256 or self.sha256


@dataclass(frozen=True)
class AsrResourceProfile:
    download_bytes: int
    disk_bytes: int
    estimated_peak_ram_bytes: int
    requires_gpu: bool
    recommended_cpu_cores: int
    vram_bytes: int
    installation_free_space_required_bytes: int = 0
    platform_download_bytes: tuple[tuple[str, int], ...] = ()

    def public_dict(self) -> dict:
        result = {
            "downloadBytes": self.download_bytes,
            "diskBytes": self.disk_bytes,
            "estimatedPeakRamBytes": self.estimated_peak_ram_bytes,
            "requiresGpu": self.requires_gpu,
            "recommendedCpuCores": self.recommended_cpu_cores,
            "vramBytes": self.vram_bytes,
            "installationFreeSpaceRequiredBytes": self.installation_free_space_required_bytes,
        }
        if self.platform_download_bytes:
            result["platformDownloadBytes"] = dict(self.platform_download_bytes)
        return result


@dataclass(frozen=True)
class AsrModelDescriptor:
    model_id: str
    provider_id: str
    name: str
    repository: str
    revision: str
    license: str
    install_kind: str
    installable: bool
    selectable: bool
    bundled: bool
    fallback_only: bool
    quality_status: str
    quality_note: str
    resources: AsrResourceProfile
    files: tuple[AsrModelFile, ...] = ()
    runtime_kind: str | None = None
    capabilities: tuple[str, ...] = ()
    quality_gate_version: str | None = None
    qualification_run_id: str | None = None

    def public_dict(self) -> dict:
        result = {
            "modelId": self.model_id,
            "providerId": self.provider_id,
            "name": self.name,
            "repository": self.repository,
            "revision": self.revision,
            "license": self.license,
            "installKind": self.install_kind,
            "installable": self.installable,
            "selectable": self.selectable,
            "bundled": self.bundled,
            "fallbackOnly": self.fallback_only,
            "quality": {"status": self.quality_status, "note": self.quality_note},
            "resources": self.resources.public_dict(),
        }
        if self.runtime_kind is not None:
            result["runtimeKind"] = self.runtime_kind
        if self.capabilities:
            result["capabilities"] = list(self.capabilities)
        if self.quality_gate_version is not None:
            result["quality"]["gateVersion"] = self.quality_gate_version
        if self.qualification_run_id is not None:
            result["quality"]["qualificationRunId"] = self.qualification_run_id
        return result


def _hf_url(repository: str, revision: str, path: str) -> str:
    return f"https://huggingface.co/{repository}/resolve/{revision}/{path}?download=true"


ASR_PROVIDERS: tuple[AsrProviderDescriptor, ...] = (
    AsrProviderDescriptor(
        provider_id="faster_whisper_local",
        name="Faster Whisper Local",
        engine="faster-whisper",
        engine_version="1.2.1",
        locality="local_only",
        status="ready",
        description="CPU/GPU local Whisper inference through CTranslate2.",
    ),
    AsrProviderDescriptor(
        provider_id="funasr_edge_local",
        name="FunASR Edge Local",
        engine="funasr-llamacpp",
        engine_version="runtime-llamacpp-v0.2.6",
        locality="local_only",
        status="ready",
        description="Frozen local CPU runtime for the SenseVoiceSmall V3 development baseline and the failed Paraformer diagnostic candidate.",
        runtime_kind="native_process",
        capabilities=("asr", "fsmn_vad", "srt_timestamps", "cpu_only"),
    ),
)


_tiny_files = (
    AsrModelFile("config.json", 2249, "a73a28cdfe1c43ccc7202fa333d1f89c202477271407ae9a7f19afa52039cac8"),
    AsrModelFile("model.bin", 75538270, "dcb76c6586fc06cbdac6dd21f14cfd129cc4cdd9dce19bf4ffa62e59cbe6e6d1"),
    AsrModelFile("tokenizer.json", 2203239, "fb7b63191e9bb045082c79fd742a3106a12c99513ab30df4a0d47fa6cb6fd0ab"),
    AsrModelFile("vocabulary.txt", 459861, "34ce3fe1c5041027b3f8d42912270993f986dbc4bb34cf27f951e34a1e453913"),
)
_small_repository = "Systran/faster-whisper-small"
_small_revision = "536b0662742c02347bc0e980a01041f333bce120"
_small_files = tuple(
    AsrModelFile(path, size, sha256, _hf_url(_small_repository, _small_revision, path))
    for path, size, sha256 in (
        ("config.json", 2370, "b55496ac7940a7ae47d2c01eab40edfd8701feec1229d9cce3b40014383fb828"),
        ("model.bin", 483546902, "3e305921506d8872816023e4c273e75d2419fb89b24da97b4fe7bce14170d671"),
        ("tokenizer.json", 2203239, "fb7b63191e9bb045082c79fd742a3106a12c99513ab30df4a0d47fa6cb6fd0ab"),
        ("vocabulary.txt", 459861, "34ce3fe1c5041027b3f8d42912270993f986dbc4bb34cf27f951e34a1e453913"),
    )
)

_funasr_runtime = (
    AsrModelFile(
        path="funasr-llamacpp-windows-x64.zip",
        byte_length=4967457,
        sha256="f6a73a548413ba9fbaf2145263ea66ec53cbdad1fb11790dbeeee493e339492e",
        source_url="https://github.com/modelscope/FunASR/releases/download/runtime-llamacpp-v0.2.6/funasr-llamacpp-windows-x64.zip",
        archive_member="llama-funasr-paraformer.exe",
        installed_path="llama-funasr-paraformer.exe",
        installed_byte_length=1510400,
        installed_sha256="5448c33f21872ca5ad4088b4082ecd120b70485a8d3da9a2d684ef0d437bf0fc",
        executable=True,
    )
    if os.name == "nt"
    else AsrModelFile(
        path="funasr-llamacpp-linux-x64.tar.gz",
        byte_length=8014474,
        sha256="779967de1c528c2be966bcc47f246e7d3e6fcdb748d9491263062f4120f35e52",
        source_url="https://github.com/modelscope/FunASR/releases/download/runtime-llamacpp-v0.2.6/funasr-llamacpp-linux-x64.tar.gz",
        archive_member="./llama-funasr-paraformer",
        installed_path="llama-funasr-paraformer",
        installed_byte_length=2424840,
        installed_sha256="aec677df81ac5d8a2274342d92df1290e4bc901f4ebb74f113d3e5d95377c0c2",
        executable=True,
    )
)
_funasr_files = (
    _funasr_runtime,
    AsrModelFile(
        path="paraformer-q8.gguf",
        byte_length=236929024,
        sha256="42bf76ea1575a336aaca4c1b7c01a82b79113e6d04d0d6b799561bfcf07ee011",
        source_url="https://huggingface.co/FunAudioLLM/Paraformer-GGUF/resolve/1a5063b305a2b4e418ccffaf7be2c02a3cac6c89/paraformer-q8.gguf?download=true",
    ),
    AsrModelFile(
        path="fsmn-vad.gguf",
        byte_length=1720512,
        sha256="1270f2559c495f4e7b6e739541151027d360761a3fda43fc147034f5719f5479",
        source_url="https://huggingface.co/FunAudioLLM/fsmn-vad-GGUF/resolve/6840bae4c5c92ee8c04faaf4db23dd0105098d7f/fsmn-vad.gguf?download=true",
    ),
)

_sensevoice_runtime = (
    AsrModelFile(
        path="funasr-llamacpp-windows-x64.zip",
        byte_length=4967457,
        sha256="f6a73a548413ba9fbaf2145263ea66ec53cbdad1fb11790dbeeee493e339492e",
        source_url="https://github.com/modelscope/FunASR/releases/download/runtime-llamacpp-v0.2.6/funasr-llamacpp-windows-x64.zip",
        archive_member="llama-funasr-sensevoice.exe",
        installed_path="llama-funasr-sensevoice.exe",
        installed_byte_length=1561600,
        installed_sha256="e92b69bc3b0d395dc611572566f91abcf5318ef7a54b27dcdf445bd231ded426",
        executable=True,
    )
    if os.name == "nt"
    else AsrModelFile(
        path="funasr-llamacpp-linux-x64.tar.gz",
        byte_length=8014474,
        sha256="779967de1c528c2be966bcc47f246e7d3e6fcdb748d9491263062f4120f35e52",
        source_url="https://github.com/modelscope/FunASR/releases/download/runtime-llamacpp-v0.2.6/funasr-llamacpp-linux-x64.tar.gz",
        archive_member="./llama-funasr-sensevoice",
        installed_path="llama-funasr-sensevoice",
        installed_byte_length=2442392,
        installed_sha256="c41a53b0156f5c6c01a4390aee601831890d2fffe272d34499e1589e64c30edd",
        executable=True,
    )
)
_sensevoice_files = (
    _sensevoice_runtime,
    AsrModelFile(
        path="sensevoice-small-q8.gguf",
        byte_length=254208320,
        sha256="4ae45c94422de949b387e2e0fb10d7e14e4c42c69db30c3444ecc7d4b844b7c5",
        source_url=_hf_url("FunAudioLLM/SenseVoiceSmall-GGUF", "90c1c61912018b70ada0fcc024ea24aca62f2e63", "sensevoice-small-q8.gguf"),
    ),
    AsrModelFile(
        path="fsmn-vad.gguf",
        byte_length=1720512,
        sha256="1270f2559c495f4e7b6e739541151027d360761a3fda43fc147034f5719f5479",
        source_url=_hf_url("FunAudioLLM/fsmn-vad-GGUF", "6840bae4c5c92ee8c04faaf4db23dd0105098d7f", "fsmn-vad.gguf"),
    ),
)


ASR_MODELS: tuple[AsrModelDescriptor, ...] = (
    AsrModelDescriptor(
        model_id=DEFAULT_ASR_MODEL_ID,
        provider_id="faster_whisper_local",
        name="Tiny (bundled fallback)",
        repository="Systran/faster-whisper-tiny",
        revision="d90ca5fe260221311c53c58e660288d3deb8d356",
        license="MIT",
        install_kind="bundled",
        installable=False,
        selectable=True,
        bundled=True,
        fallback_only=True,
        quality_status="fallback_only",
        quality_note="Minimum offline fallback. Installation or inference success does not pass V3-2-A06 quality.",
        resources=AsrResourceProfile(sum(item.byte_length for item in _tiny_files), sum(item.byte_length for item in _tiny_files), 2 * GIB, False, 4, 0),
        files=_tiny_files,
    ),
    AsrModelDescriptor(
        model_id="faster-whisper-small",
        provider_id="faster_whisper_local",
        name="Small (current comparison candidate)",
        repository=_small_repository,
        revision=_small_revision,
        license="MIT",
        install_kind="remote_verified",
        installable=True,
        selectable=True,
        bundled=False,
        fallback_only=False,
        quality_status="failed_current_gate",
        quality_note="The 2026-09-21 human comparison did not pass V3-2-A06. Install only for comparison or future retest.",
        resources=AsrResourceProfile(sum(item.byte_length for item in _small_files), sum(item.byte_length for item in _small_files), 8 * GIB, False, 8, 0),
        files=_small_files,
    ),
    AsrModelDescriptor(
        model_id="funasr-paraformer-q8",
        provider_id="funasr_edge_local",
        name="Paraformer Q8 (quality gate failed)",
        repository="FunAudioLLM/Paraformer-GGUF",
        revision="1a5063b305a2b4e418ccffaf7be2c02a3cac6c89",
        license="Apache-2.0 + MIT runtime",
        install_kind="remote_verified",
        installable=True,
        selectable=False,
        bundled=False,
        fallback_only=False,
        quality_status="failed_current_gate",
        quality_note="The fixed real-audio preflight found a non-silent 15-second omission. Install only for diagnostics; production selection remains blocked.",
        resources=AsrResourceProfile(
            sum(item.byte_length for item in _funasr_files),
            sum(item.published_byte_length for item in _funasr_files),
            8 * GIB,
            False,
            8,
            0,
            1 * GIB,
            (("linuxX64", 246664010), ("windowsX64", 243616993)),
        ),
        files=_funasr_files,
        runtime_kind="native_process",
        capabilities=("asr", "fsmn_vad", "srt_timestamps", "pcm_s16le_mono_16000hz"),
        quality_gate_version="v3-2-a06/v1",
        qualification_run_id=None,
    ),
    AsrModelDescriptor(
        model_id=V3_BASELINE_ASR_MODEL_ID,
        provider_id="funasr_edge_local",
        name="SenseVoiceSmall Q8 (V3 baseline)",
        repository="FunAudioLLM/SenseVoiceSmall-GGUF",
        revision="90c1c61912018b70ada0fcc024ea24aca62f2e63",
        license="Apache-2.0 + MIT runtime",
        install_kind="remote_verified",
        installable=True,
        selectable=True,
        bundled=False,
        fallback_only=False,
        quality_status="development_baseline",
        quality_note="Selected as the V3 local transcription baseline after a real low-resource spike. Comparative degradation detection and quality fallback are deferred to V4.",
        resources=AsrResourceProfile(
            sum(item.byte_length for item in _sensevoice_files),
            sum(item.published_byte_length for item in _sensevoice_files),
            2 * GIB,
            False,
            8,
            0,
            1 * GIB,
            (("linuxX64", 263943306), ("windowsX64", 260896289)),
        ),
        files=_sensevoice_files,
        runtime_kind="native_process",
        capabilities=("asr", "fsmn_vad", "srt_timestamps", "pcm_s16le_mono_16000hz", "cpu_only"),
        quality_gate_version="v3-2-0c-baseline/v1",
        qualification_run_id="v3-2-0c-spike-20260922T131329Z",
    ),
    AsrModelDescriptor(
        model_id="faster-whisper-large-v3-turbo",
        provider_id="faster_whisper_local",
        name="Large v3 Turbo (high resource)",
        repository="deepdml/faster-whisper-large-v3-turbo-ct2",
        revision="qualification_required",
        license="qualification_required",
        install_kind="qualification_required",
        installable=False,
        selectable=False,
        bundled=False,
        fallback_only=False,
        quality_status="not_evaluated",
        quality_note="High-resource option excluded from the 8 GiB/no-GPU acceptance denominator.",
        resources=AsrResourceProfile(1600 * MIB, 1600 * MIB, 12 * GIB, True, 8, 6 * GIB),
    ),
)

ASR_MODEL_BY_ID = {model.model_id: model for model in ASR_MODELS}
