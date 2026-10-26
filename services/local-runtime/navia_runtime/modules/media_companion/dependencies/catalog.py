"""WP-A frozen media-dependency catalog.

Every value here is FROZEN and comes from
`v3-2-0-contract-dependency-samples/dependency-manifest.json` plus the frozen
network/resource policy in `03-api-contract-and-state-machine.md`.

This module is pure data plus pure validators. It performs no network, no
subprocess and no filesystem writes, so it is safe to import anywhere.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Final

from ..media_cache import SOURCE_IDENTITY_RE  # noqa: F401  (kept for symmetry; unused)

DEPENDENCY_STATUS_SCHEMA_VERSION: Final = "v3-media-dependency-status/v1"
DEPENDENCY_INSTALLATION_SCHEMA_VERSION: Final = "v3-media-dependency-installation/v1"

DEPENDENCY_IDS: Final[tuple[str, ...]] = ("yt-dlp", "ffmpeg", "ffprobe", "sensevoice")

# --- yt-dlp: the only managed download -------------------------------------
YT_DLP_VERSION: Final = "2026.08.19"
YT_DLP_SOURCE_URL: Final = (
    "https://github.com/yt-dlp/yt-dlp/releases/download/2026.08.19/yt-dlp"
)
YT_DLP_EXPECTED_BYTES: Final = 3_072_469
YT_DLP_EXPECTED_SHA256: Final = (
    "1fa6733c37ea6fb51c99ad8fe785e7b7e5f3246c9b980230329d4fb72ed8d4d6"
)
YT_DLP_RUNTIME_ARGUMENTS: Final[tuple[str, ...]] = (
    "--ignore-config",
    "--no-plugin-dirs",
    "--no-update",
    "--no-playlist",
)
#: The frozen minimum command probe. Its stdout must equal the frozen version.
YT_DLP_SELF_TEST_ARGUMENTS: Final[tuple[str, ...]] = (
    *YT_DLP_RUNTIME_ARGUMENTS,
    "--simulate",
    "--version",
)
YT_DLP_FORBIDDEN_ARGUMENTS: Final[frozenset[str]] = frozenset(
    {
        "--exec",
        "--exec-before-download",
        "--use-postprocessor",
        "--update",
        "--update-to",
        "--plugin-dirs",
    }
)

# --- network policy ---------------------------------------------------------
ALLOWED_SOURCE_HOSTS: Final[frozenset[str]] = frozenset(
    {"github.com", "release-assets.githubusercontent.com"}
)
MAX_REDIRECTS: Final = 2
CONNECT_TIMEOUT_SECONDS: Final = 15.0
READ_TIMEOUT_SECONDS: Final = 30.0
DOWNLOAD_DEADLINE_SECONDS: Final = 180.0
MAX_DOWNLOAD_RETRIES: Final = 2
SELF_TEST_DEADLINE_SECONDS: Final = 30.0

#: Free space required before installing: ``2 * expectedBytes + 64 MiB``.
DISK_HEADROOM_BYTES: Final = 64 * 1024 * 1024
INSTALL_FREE_SPACE_BYTES: Final = 2 * YT_DLP_EXPECTED_BYTES + DISK_HEADROOM_BYTES

# --- system tools: verified only, never installed ---------------------------
FFMPEG_VERSION: Final = "6.1.1-3ubuntu5"
FFMPEG_SHA256: Final = (
    "ed16af623947494a72e284b6eb8ff225f2da22b38b5d5069c2fd4b4ba3384e41"
)
FFPROBE_SHA256: Final = (
    "272f6ebc634a63d9c8b4ca68e964119d980f25154e5aa2c35e5487da48e9a58f"
)
FFMPEG_DEFAULT_PATH: Final = "/usr/bin/ffmpeg"
FFPROBE_DEFAULT_PATH: Final = "/usr/bin/ffprobe"
FFMPEG_REQUIRED_INPUT_PROTOCOLS: Final[tuple[str, ...]] = ("file", "pipe")
FFMPEG_FORBIDDEN_NETWORK_PROBE_INPUT: Final = "https://example.com/forbidden"

# --- identifiers ------------------------------------------------------------
SHA256_RE: Final = re.compile(r"^[a-f0-9]{64}$")
GENERATION_RE: Final = re.compile(r"^depgen_[a-f0-9]{64}$")
JOB_ID_RE: Final = re.compile(r"^media_dep_job_[a-f0-9]{32}$")

JOB_ID_PREFIX: Final = "media_dep_job_"
GENERATION_PREFIX: Final = "depgen_"

MANAGED_TOOL_STAGING_DIRNAME: Final = "staging"
MANAGED_TOOL_VERSIONS_DIRNAME: Final = "versions"
MANAGED_TOOL_ACTIVE_MANIFEST: Final = "active.json"
MANAGED_TOOL_PART_NAME: Final = "yt-dlp.part"


@dataclass(frozen=True)
class DependencyDescriptor:
    """One of the four fixed dependencies."""

    dependency_id: str
    kind: str
    install_mode: str
    storage_scope: str
    required: bool
    expected_sha256: str | None
    version: str | None


#: Exactly four entries, unique by id, with the frozen kind/mode/scope mapping.
DEPENDENCY_DESCRIPTORS: Final[tuple[DependencyDescriptor, ...]] = (
    DependencyDescriptor(
        dependency_id="yt-dlp",
        kind="managed_tool",
        install_mode="managed_download",
        storage_scope="windows_persistent",
        required=True,
        expected_sha256=YT_DLP_EXPECTED_SHA256,
        version=YT_DLP_VERSION,
    ),
    DependencyDescriptor(
        dependency_id="ffmpeg",
        kind="system_tool",
        install_mode="system_verified",
        storage_scope="runtime_system",
        required=True,
        expected_sha256=FFMPEG_SHA256,
        version=FFMPEG_VERSION,
    ),
    DependencyDescriptor(
        dependency_id="ffprobe",
        kind="system_tool",
        install_mode="system_verified",
        storage_scope="runtime_system",
        required=True,
        expected_sha256=FFPROBE_SHA256,
        version=None,
    ),
    DependencyDescriptor(
        dependency_id="sensevoice",
        kind="asr_model",
        install_mode="delegated_manager",
        storage_scope="asr_managed",
        required=True,
        # SenseVoice is delegated: its authoritative digest belongs to the
        # existing multi-asset ASR manager, so the single-file digest is null.
        expected_sha256=None,
        version=None,
    ),
)

DESCRIPTORS_BY_ID: Final[dict[str, DependencyDescriptor]] = {
    descriptor.dependency_id: descriptor for descriptor in DEPENDENCY_DESCRIPTORS
}


def catalog_is_closed() -> bool:
    """The four ids must be unique, complete and consistently classified."""
    ids = [descriptor.dependency_id for descriptor in DEPENDENCY_DESCRIPTORS]
    return (
        len(ids) == len(DEPENDENCY_IDS)
        and len(set(ids)) == len(ids)
        and set(ids) == set(DEPENDENCY_IDS)
    )


def self_test_command(tool_path: str) -> list[str]:
    """The exact frozen minimum self-test command for yt-dlp."""
    return [tool_path, *YT_DLP_SELF_TEST_ARGUMENTS]


def ffmpeg_network_deny_command(tool_path: str) -> list[str]:
    """The frozen protocol-constraint probe for ffmpeg."""
    return [
        tool_path,
        "-hide_banner",
        "-protocol_whitelist",
        ",".join(FFMPEG_REQUIRED_INPUT_PROTOCOLS),
        "-i",
        FFMPEG_FORBIDDEN_NETWORK_PROBE_INPUT,
        "-t",
        "1",
        "-f",
        "null",
        "-",
    ]
