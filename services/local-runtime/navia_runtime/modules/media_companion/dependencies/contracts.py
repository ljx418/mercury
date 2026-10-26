"""WP-A media-dependency contracts: states, failure codes and the snapshot.

Pure shapes only. No I/O, no network, no subprocess. The public JSON is
produced by `manager.py` and validated against the three frozen schemas.
"""

from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass, field
from typing import Any, Final

from .catalog import (
    DEPENDENCY_IDS,
    GENERATION_PREFIX,
    GENERATION_RE,
    JOB_ID_RE,
)

DEPENDENCY_STATUS_SCHEMA_VERSION: Final = "v3-media-dependency-status/v1"
DEPENDENCY_INSTALLATION_SCHEMA_VERSION: Final = "v3-media-dependency-installation/v1"

# --- states -----------------------------------------------------------------
#: The frozen job lifecycle.
JOB_STATES: Final[tuple[str, ...]] = (
    "checking",
    "downloading",
    "verifying",
    "self_testing",
    "installing",
    "ready",
    "cancelling",
    "cancelled",
    "failed",
    "corrupt",
)
TERMINAL_JOB_STATES: Final[frozenset[str]] = frozenset(
    {"ready", "cancelled", "failed", "corrupt"}
)
#: A terminal state may never be rewritten by a late worker.
NON_CANCELABLE_JOB_STATES: Final[frozenset[str]] = frozenset(
    {"installing"} | TERMINAL_JOB_STATES
)
CANCELABLE_JOB_STATES: Final[frozenset[str]] = frozenset(
    {"checking", "downloading", "verifying", "self_testing", "cancelling"}
)
#: The frozen phase order a repair job walks through.
JOB_PHASE_ORDER: Final[tuple[str, ...]] = (
    "checking",
    "downloading",
    "verifying",
    "self_testing",
    "installing",
    "ready",
)

OVERALL_STATES: Final[tuple[str, ...]] = (
    "ready",
    "action_required",
    "installing",
    "failed",
)
DEPENDENCY_STATES: Final[tuple[str, ...]] = (
    "missing",
    *JOB_STATES,
)

# --- failure codes ----------------------------------------------------------
FAILURE_CODES: Final[tuple[str, ...]] = (
    "REQUEST_INVALID",
    "JOB_NOT_FOUND",
    "JOB_ACTIVE",
    "SOURCE_NOT_ALLOWED",
    "NETWORK_FAILED",
    "TIMEOUT",
    "SIZE_MISMATCH",
    "HASH_MISMATCH",
    "DISK_SPACE_LOW",
    "PERMISSION_DENIED",
    "SELF_TEST_FAILED",
    "RUNTIME_RESTARTED",
    "SYSTEM_TOOL_MISSING",
    "NOT_READY",
)
FAILURE_PREFIX: Final = "V3_MEDIA_DEPENDENCY_"

#: HTTP status for each frozen failure code, per `03-api-contract-and-state-machine.md`.
FAILURE_HTTP_STATUS: Final[dict[str, int]] = {
    "REQUEST_INVALID": 400,
    "SOURCE_NOT_ALLOWED": 400,
    "JOB_NOT_FOUND": 404,
    "JOB_ACTIVE": 409,
    "NOT_READY": 409,
    "SIZE_MISMATCH": 422,
    "HASH_MISMATCH": 422,
    "SELF_TEST_FAILED": 422,
    "DISK_SPACE_LOW": 507,
    "PERMISSION_DENIED": 500,
    "SYSTEM_TOOL_MISSING": 500,
    "RUNTIME_RESTARTED": 500,
    "NETWORK_FAILED": 502,
    "TIMEOUT": 504,
}

#: `recoverable` is frozen per code, so the UI can render one honest next step.
FAILURE_RECOVERABLE: Final[dict[str, bool]] = {
    "REQUEST_INVALID": False,
    "SOURCE_NOT_ALLOWED": False,
    "JOB_NOT_FOUND": False,
    "JOB_ACTIVE": True,
    "NOT_READY": True,
    "SIZE_MISMATCH": False,
    "HASH_MISMATCH": False,
    "SELF_TEST_FAILED": False,
    "DISK_SPACE_LOW": True,
    "PERMISSION_DENIED": True,
    "SYSTEM_TOOL_MISSING": True,
    "RUNTIME_RESTARTED": True,
    "NETWORK_FAILED": True,
    "TIMEOUT": True,
}

REQUEST_INVALID_RE = re.compile(r"^[A-Za-z0-9_-]{1,64}$")


class MediaDependencyError(Exception):
    """A frozen dependency failure, carrying only its public code."""

    def __init__(self, code: str, message: str, *, details: dict[str, Any] | None = None) -> None:
        if code not in FAILURE_CODES:
            raise AssertionError(f"unregistered dependency failure code: {code}")
        super().__init__(message)
        self.code = f"{FAILURE_PREFIX}{code}"
        self.public_message = message
        self.details = details or {}

    @property
    def http_status(self) -> int:
        return FAILURE_HTTP_STATUS[self.code.removeprefix(FAILURE_PREFIX)]

    @property
    def recoverable(self) -> bool:
        return FAILURE_RECOVERABLE[self.code.removeprefix(FAILURE_PREFIX)]


def canonical_json(value: Any) -> str:
    """UTF-8, sorted keys, no whitespace — the frozen canonical form."""
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def _strip_location(value: Any) -> Any:
    """Drop ``path``/``verifiedAt`` at EVERY depth, not just the top level."""
    if isinstance(value, dict):
        return {
            key: _strip_location(item)
            for key, item in value.items()
            if key not in {"path", "verifiedAt"}
        }
    if isinstance(value, list):
        return [_strip_location(item) for item in value]
    return value


def compute_generation(identity: dict[str, Any]) -> str:
    """``depgen_`` + SHA-256 over the canonical identity document.

    ``path`` and ``verifiedAt`` are deliberately excluded at any depth:
    re-verifying the same bytes in a different directory, or at a different
    moment, must not mint a new generation.
    """
    return GENERATION_PREFIX + hashlib.sha256(
        canonical_json(_strip_location(identity)).encode("utf-8")
    ).hexdigest()


@dataclass(frozen=True)
class DependencyState:
    """One dependency's public status entry."""

    dependency_id: str
    required: bool
    kind: str
    install_mode: str
    storage_scope: str
    state: str
    version: str | None
    expected_sha256: str | None
    observed_sha256: str | None
    verified_at: str | None
    failure_code: str | None

    def to_public(self) -> dict[str, Any]:
        return {
            "dependencyId": self.dependency_id,
            "required": self.required,
            "kind": self.kind,
            "installMode": self.install_mode,
            "state": self.state,
            "version": self.version,
            "expectedSha256": self.expected_sha256,
            "observedSha256": self.observed_sha256,
            "verifiedAt": self.verified_at,
            "storageScope": self.storage_scope,
            "failureCode": self.failure_code,
        }


@dataclass(frozen=True)
class VerifiedDependencySnapshot:
    """The immutable per-task dependency binding.

    ``path`` values never leave the Runtime: the public status surface reports
    identity and digests only.
    """

    schema_version: str
    generation: str
    verified_at: str
    yt_dlp: dict[str, Any]
    ffmpeg: dict[str, Any]
    ffprobe: dict[str, Any]
    asr: dict[str, Any]
    identity: dict[str, Any] = field(default_factory=dict)

    def to_internal(self) -> dict[str, Any]:
        return {
            "schemaVersion": self.schema_version,
            "generation": self.generation,
            "verifiedAt": self.verified_at,
            "ytDlp": self.yt_dlp,
            "ffmpeg": self.ffmpeg,
            "ffprobe": self.ffprobe,
            "asr": self.asr,
        }

    @classmethod
    def build(
        cls,
        *,
        verified_at: str,
        yt_dlp: dict[str, Any],
        ffmpeg: dict[str, Any],
        ffprobe: dict[str, Any],
        asr: dict[str, Any],
    ) -> "VerifiedDependencySnapshot":
        identity = {
            "ytDlp": yt_dlp,
            "ffmpeg": ffmpeg,
            "ffprobe": ffprobe,
            "asr": asr,
        }
        return cls(
            schema_version="v3-media-dependency-snapshot/v1",
            generation=compute_generation(identity),
            verified_at=verified_at,
            yt_dlp=yt_dlp,
            ffmpeg=ffmpeg,
            ffprobe=ffprobe,
            asr=asr,
            identity=identity,
        )


def is_valid_generation(value: Any) -> bool:
    return isinstance(value, str) and bool(GENERATION_RE.fullmatch(value))


def is_valid_job_id(value: Any) -> bool:
    return isinstance(value, str) and bool(JOB_ID_RE.fullmatch(value))


def semantic_validate_status(payload: dict[str, Any]) -> None:
    """Runtime-side semantic validation the JSON Schema cannot express.

    A01/A04 rely on this: uniqueness, completeness, state/failure coherence,
    progress bounds and generation shape.
    """
    from .catalog import catalog_is_closed

    if not catalog_is_closed():
        raise MediaDependencyError("NOT_READY", "Dependency catalog is not closed.")

    ids = [entry.get("dependencyId") for entry in payload["dependencies"]]
    if len(ids) != len(DEPENDENCY_IDS) or set(ids) != set(DEPENDENCY_IDS) or len(set(ids)) != len(ids):
        raise MediaDependencyError("REQUEST_INVALID", "Dependency set is incomplete or duplicated.")

    for entry in payload["dependencies"]:
        state = entry["state"]
        if state not in DEPENDENCY_STATES:
            raise MediaDependencyError("REQUEST_INVALID", "Dependency state is invalid.")
        if state in {"ready", "corrupt", "failed"} and entry.get("verifiedAt") is None and state == "ready":
            raise MediaDependencyError("REQUEST_INVALID", "A ready dependency must carry verifiedAt.")
        if state == "ready" and entry.get("observedSha256") != entry.get("expectedSha256"):
            # SenseVoice is delegated: its single-file digest is intentionally
            # null because the multi-asset ASR manager owns that authority.
            if entry["dependencyId"] != "sensevoice":
                raise MediaDependencyError("HASH_MISMATCH", "A ready dependency must match its digest.")

    overall = payload["overallState"]
    if overall not in OVERALL_STATES:
        raise MediaDependencyError("REQUEST_INVALID", "Overall state is invalid.")
    if overall == "ready":
        if not is_valid_generation(payload.get("generation")):
            raise MediaDependencyError("NOT_READY", "A ready status requires a generation.")
        if payload.get("verifiedAt") is None:
            raise MediaDependencyError("NOT_READY", "A ready status requires verifiedAt.")
        if payload["routeReadiness"]["credentialedMediaAsr"] != "ready":
            raise MediaDependencyError("NOT_READY", "A ready status requires a ready route.")
        if any(entry["state"] != "ready" for entry in payload["dependencies"]):
            raise MediaDependencyError("NOT_READY", "A ready status requires four ready dependencies.")

    for key in ("activeJobId", "latestJobId"):
        value = payload.get(key)
        if value is not None and not is_valid_job_id(value):
            raise MediaDependencyError("REQUEST_INVALID", "Job id is invalid.")
