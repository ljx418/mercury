"""WP-B local media import: frozen contracts.

This module is pure shapes and pure validators. It performs no I/O, no
subprocess and no network, so both the Runtime and the Extension contract tests
can rely on it without touching a browser or a disk.

The failure-code set is a CLOSED eighteen. Nothing outside it may ever leave the
import surface, and the details map may only carry the three safe keys.
"""

from __future__ import annotations

import hashlib
import json
import re
from typing import Any, Final

#: The durable store record version frozen by `v3_media_local_import_internal_v1`.
SCHEMA_VERSION: Final = "v3-media-local-import-store/v1"
#: The PUBLIC status/API version frozen by `v3_media_local_import_status_v1`.
PUBLIC_API_SCHEMA_VERSION: Final = "v3-media-local-import/v1"
PUBLIC_STATUS_SCHEMA_VERSION: Final = PUBLIC_API_SCHEMA_VERSION
API_SCHEMA_VERSION: Final = "v3-media-local-import-api/v1"

PREFIX: Final = "V3_MEDIA_IMPORT_"

#: The frozen eighteen. Order is part of the contract.
FAILURE_CODES: Final[tuple[str, ...]] = (
    "REQUEST_INVALID",
    "AUTH_REQUIRED",
    "ORIGIN_MISMATCH",
    "NOT_FOUND",
    "TASK_NOT_ELIGIBLE",
    "ACTIVE",
    "TOKEN_INVALID",
    "SIZE_MISMATCH",
    "SIZE_LIMIT",
    "TYPE_UNSUPPORTED",
    "MEDIA_INVALID",
    "DURATION_LIMIT",
    "DISK_SPACE_LOW",
    "WRITE_FAILED",
    "PREPARE_FAILED",
    "RUNTIME_RESTARTED",
    "CANCELLED",
    "CLEANUP_INCOMPLETE",
)

HTTP_STATUS: Final[dict[str, int]] = {
    "REQUEST_INVALID": 400,
    "SIZE_MISMATCH": 400,
    "TYPE_UNSUPPORTED": 400,
    "MEDIA_INVALID": 400,
    "AUTH_REQUIRED": 401,
    "TOKEN_INVALID": 401,
    "ORIGIN_MISMATCH": 403,
    "NOT_FOUND": 404,
    "TASK_NOT_ELIGIBLE": 409,
    "ACTIVE": 409,
    "CANCELLED": 409,
    "SIZE_LIMIT": 413,
    "DURATION_LIMIT": 422,
    "PREPARE_FAILED": 422,
    "WRITE_FAILED": 500,
    "RUNTIME_RESTARTED": 500,
    "CLEANUP_INCOMPLETE": 500,
    "DISK_SPACE_LOW": 507,
}

RECOVERABLE: Final[dict[str, bool]] = {
    "REQUEST_INVALID": False,
    "SIZE_MISMATCH": False,
    "TYPE_UNSUPPORTED": False,
    "MEDIA_INVALID": False,
    "AUTH_REQUIRED": False,
    "TOKEN_INVALID": False,
    "ORIGIN_MISMATCH": False,
    "NOT_FOUND": False,
    "TASK_NOT_ELIGIBLE": True,
    "ACTIVE": True,
    "CANCELLED": False,
    "SIZE_LIMIT": False,
    "DURATION_LIMIT": False,
    "PREPARE_FAILED": True,
    "WRITE_FAILED": True,
    "RUNTIME_RESTARTED": True,
    "CLEANUP_INCOMPLETE": True,
    "DISK_SPACE_LOW": True,
}

#: The ONLY keys an error `details` map may carry.
ALLOWED_DETAIL_KEYS: Final[frozenset[str]] = frozenset(
    {"importId", "maximumBytes", "maximumDurationMs"}
)

STATES: Final[tuple[str, ...]] = (
    "awaiting_upload",
    "uploading",
    "verifying",
    "preparing",
    "ready",
    "cancelling",
    "cancelled",
    "failed",
)
TERMINAL_STATES: Final[frozenset[str]] = frozenset({"ready", "cancelled", "failed"})
NON_TERMINAL_STATES: Final[frozenset[str]] = frozenset(STATES) - TERMINAL_STATES

#: The FROZEN durable-handoff vocabulary, exactly as
#: `v3_media_local_import_internal_v1.schema.json` declares it. The schema may
#: not be changed, so the implementation conforms to it.
BARRIER_PHASES: Final[tuple[str, ...]] = (
    "video_durable",
    "inputs_prepared",
    "input_bound",
    "audio_staged",
    "video_deleted",
    "transcript_terminal",
    "visual_terminal",
    "cleaning",
    "cleaned",
    "failed",
)

#: The only legal phase transitions. The two consumer terminals may arrive in
#: EITHER order; the cleanup is claimed only after the second one.
BARRIER_TRANSITIONS: Final[dict[str, frozenset[str]]] = {
    # T1 CONFIRMS the first phase: the store already carries that placeholder,
    # so the first durable handoff step re-asserts it.
    "video_durable": frozenset({"video_durable", "inputs_prepared"}),
    "inputs_prepared": frozenset({"input_bound"}),
    "input_bound": frozenset({"audio_staged"}),
    "audio_staged": frozenset({"video_deleted"}),
    "video_deleted": frozenset({"transcript_terminal", "visual_terminal"}),
    "transcript_terminal": frozenset({"visual_terminal", "cleaning"}),
    "visual_terminal": frozenset({"transcript_terminal", "cleaning"}),
    "cleaning": frozenset({"cleaned"}),
    "cleaned": frozenset(),
    "failed": frozenset(),
}

#: The phase a record carries before the handoff has started. The frozen
#: vocabulary has no "not started" member, and the schema may not be changed,
#: so the first phase is the placeholder. It NEVER authorises a release: the
#: recovery only acts on the durable receipts, and a record whose public state
#: is before `verifying` is settled by the manager instead.
INITIAL_BARRIER_PHASE: Final = "video_durable"

#: The FROZEN internal schema versions.
CONSUMER_BARRIER_SCHEMA_VERSION: Final = "v3-media-import-consumer-barrier/v1"
VISUAL_RECEIPT_SCHEMA_VERSION: Final = "v3-media-import-visual-receipt/v1"

#: The FROZEN public media containers.
MEDIA_CONTAINERS: Final[tuple[str, ...]] = ("mp4", "webm", "matroska")

DECLARED_MEDIA_TYPES: Final[tuple[str, ...]] = (
    "video/mp4",
    "video/webm",
    "video/x-matroska",
    "application/octet-stream",
)
SUPPORTED_MEDIA_TYPES: Final[tuple[str, ...]] = DECLARED_MEDIA_TYPES[:-1]

#: Frozen bounds. The exact boundary is ALLOWED; one past is refused.
MAX_IMPORT_BYTES: Final = 2 * 1024**3
MAX_DURATION_MS: Final = 4 * 60 * 60 * 1000
MAX_FRAME_DIMENSIONS: Final = (7680, 4320)
MAX_IMPORT_FRAMES: Final = 8
WRITER_SLICE_BYTES: Final = 1_048_576
AWAITING_TOKEN_TTL_SECONDS: Final = 600
UPLOAD_WALL_CLOCK_SECONDS: Final = 1800
FFPROBE_DEADLINE_SECONDS: Final = 30
PREPARING_DEADLINE_SECONDS: Final = 1800
#: Free space required BEFORE any download: declared bytes plus the headroom,
#: where the headroom is min(512 MiB, duration-derived PCM bytes + 128 MiB).
DISK_HEADROOM_CAP_BYTES: Final = 512 * 1024 * 1024
DISK_HEADROOM_FLOOR_BYTES: Final = 128 * 1024 * 1024


def required_free_bytes(byte_length: int, duration_ms: int | None = None) -> int:
    """The frozen pre-download space requirement.

    ``declared bytes + min(512 MiB, duration-derived PCM bytes + 128 MiB)``.
    A 16 kHz mono s16le stream carries 32,000 bytes per second.
    """
    if duration_ms is None or duration_ms <= 0:
        return byte_length + DISK_HEADROOM_CAP_BYTES
    pcm_bytes = int(duration_ms / 1000) * 32_000
    headroom = min(DISK_HEADROOM_CAP_BYTES, pcm_bytes + DISK_HEADROOM_FLOOR_BYTES)
    return byte_length + headroom
AUDIO_SAMPLE_RATE_HZ: Final = 16_000
AUDIO_CHANNELS: Final = 1
AUDIO_CODEC: Final = "pcm_s16le"

ROUTE: Final = "explicit_local_media_asr"

IMPORT_ID_RE: Final = re.compile(r"^media_import_[a-f0-9]{32}$")
#: The frozen source identity shape, exactly as the schemas declare it.
SOURCE_IDENTITY_RE: Final = re.compile(
    r"^portal:[a-z][a-z0-9_-]{1,31}:[^:]{1,128}:[^:]{1,128}:[^:]{1,128}$"
)
TASK_ID_RE: Final = re.compile(r"^media_task_[a-f0-9]{32}$")
GENERATION_RE: Final = re.compile(r"^depgen_[a-f0-9]{64}$")
SHA256_RE: Final = re.compile(r"^[a-f0-9]{64}$")
UPLOAD_TOKEN_RE: Final = re.compile(r"^[A-Za-z0-9_-]{43}$")

CREATE_FIELDS: Final[frozenset[str]] = frozenset(
    {"taskId", "sourceIdentity", "declaredMediaType", "byteLength"}
)
#: Names a create request must NEVER accept.
FORBIDDEN_CREATE_FIELDS: Final[frozenset[str]] = frozenset(
    {"fileName", "path", "url", "hash", "extension", "lastModified", "relativePath"}
)


class ImportError(RuntimeError):
    """A frozen import failure carrying only its public code and safe details."""

    def __init__(self, code: str, message: str, *, details: dict[str, Any] | None = None) -> None:
        if code not in FAILURE_CODES:
            raise AssertionError(f"unregistered import failure code: {code}")
        payload = dict(details or {})
        if set(payload) - ALLOWED_DETAIL_KEYS:
            raise AssertionError(f"unsafe import error details: {sorted(set(payload) - ALLOWED_DETAIL_KEYS)}")
        super().__init__(message)
        self.code = f"{PREFIX}{code}"
        self.public_message = message
        self.details = payload

    @property
    def http_status(self) -> int:
        return HTTP_STATUS[self.code.removeprefix(PREFIX)]

    @property
    def recoverable(self) -> bool:
        return RECOVERABLE[self.code.removeprefix(PREFIX)]

    def to_envelope(self, request_id: str | None = None) -> dict[str, Any]:
        return {
            "ok": False,
            "data": None,
            "error": {
                "code": self.code,
                "message": self.public_message,
                "recoverable": self.recoverable,
                "details": dict(self.details),
            },
            "request_id": request_id or "req_local_import",
        }


def canonical_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def digest_of(value: Any) -> str:
    return hashlib.sha256(canonical_json(value).encode("utf-8")).hexdigest()


def can_transition(current: str, nxt: str) -> bool:
    """The frozen state machine. A terminal state never moves again."""
    if nxt not in STATES:
        return False
    if current in TERMINAL_STATES:
        return False
    if nxt == "cancelling":
        return current in {"awaiting_upload", "uploading", "verifying", "preparing", "cancelling"}
    if nxt == "cancelled":
        return current in {"cancelling", "awaiting_upload", "uploading", "verifying", "preparing"}
    if nxt == "failed":
        return True
    order = {"awaiting_upload": 0, "uploading": 1, "verifying": 2, "preparing": 3, "ready": 4}
    if current in order and nxt in order:
        # Forward only, and never more than one phase at a time.
        return order[nxt] == order[current] + 1
    return False


def semantic_validate_import(record: dict[str, Any]) -> None:
    """Validate a durable import record beyond what JSON Schema can express."""
    if record.get("schemaVersion") != SCHEMA_VERSION:
        raise ImportError("REQUEST_INVALID", "Import record schema is unsupported.")
    if not isinstance(record.get("importId"), str) or not IMPORT_ID_RE.fullmatch(record["importId"]):
        raise ImportError("REQUEST_INVALID", "Import id is invalid.")
    if not isinstance(record.get("taskId"), str) or not TASK_ID_RE.fullmatch(record["taskId"]):
        raise ImportError("REQUEST_INVALID", "Task id is invalid.")
    state = record.get("state")
    if state not in STATES:
        raise ImportError("REQUEST_INVALID", "Import state is invalid.")
    sequence = record.get("sequence")
    if not isinstance(sequence, int) or isinstance(sequence, bool) or sequence < 0:
        raise ImportError("REQUEST_INVALID", "Import sequence is invalid.")
    byte_length = record.get("byteLength")
    uploaded = record.get("uploadedBytes")
    for value in (byte_length, uploaded):
        if not isinstance(value, int) or isinstance(value, bool) or value < 0:
            raise ImportError("REQUEST_INVALID", "Import byte counters are invalid.")
    if uploaded > byte_length:
        raise ImportError("REQUEST_INVALID", "Uploaded bytes exceed the declared length.")
    if byte_length > MAX_IMPORT_BYTES:
        raise ImportError("SIZE_LIMIT", "Declared length exceeds the frozen maximum.")
    if record.get("declaredMediaType") not in DECLARED_MEDIA_TYPES:
        raise ImportError("TYPE_UNSUPPORTED", "Declared media type is not supported.")
    if not isinstance(record.get("sourceIdentity"), str) or not SOURCE_IDENTITY_RE.fullmatch(
        record["sourceIdentity"]
    ):
        raise ImportError("REQUEST_INVALID", "Source identity is invalid.")
    if record.get("barrierPhase") not in BARRIER_PHASES:
        raise ImportError("REQUEST_INVALID", "Barrier phase is invalid.")
    if not isinstance(record.get("dependencyGeneration"), str) or not GENERATION_RE.fullmatch(
        record["dependencyGeneration"]
    ):
        raise ImportError("REQUEST_INVALID", "Dependency generation is invalid.")
    for key in ("videoManifestSha256", "visualReceiptSha256"):
        value = record.get(key)
        if value is not None and (not isinstance(value, str) or not SHA256_RE.fullmatch(value)):
            raise ImportError("REQUEST_INVALID", "Manifest digest is invalid.")

    failure_code = record.get("failureCode")
    if failure_code is not None and failure_code.removeprefix(PREFIX) not in FAILURE_CODES:
        raise ImportError("REQUEST_INVALID", "Import failure code is not registered.")

    if state == "ready":
        if failure_code is not None:
            raise ImportError("REQUEST_INVALID", "A ready import must not carry a failure code.")
        if uploaded != byte_length:
            raise ImportError("REQUEST_INVALID", "A ready import must have received every declared byte.")
        if not record.get("videoManifestSha256"):
            raise ImportError("REQUEST_INVALID", "A ready import must carry a durable video manifest.")
    if state == "failed":
        if failure_code is None:
            raise ImportError("REQUEST_INVALID", "A failed import must carry a failure code.")
        if record.get("videoManifestSha256") is not None:
            raise ImportError("REQUEST_INVALID", "A failed import must not claim a durable video manifest.")


def validate_create_body(body: Any) -> dict[str, Any]:
    """The create body is EXACTLY four fields and may carry no client metadata."""
    if not isinstance(body, dict):
        raise ImportError("REQUEST_INVALID", "Create body must be an object.")
    present = set(body)
    if present & FORBIDDEN_CREATE_FIELDS:
        raise ImportError("REQUEST_INVALID", "Create body may not carry client file metadata.")
    if present != CREATE_FIELDS:
        raise ImportError("REQUEST_INVALID", "Create body does not match the frozen contract.")
    if not isinstance(body["taskId"], str) or not TASK_ID_RE.fullmatch(body["taskId"]):
        raise ImportError("REQUEST_INVALID", "Task id is invalid.")
    if not isinstance(body["sourceIdentity"], str) or not body["sourceIdentity"]:
        raise ImportError("REQUEST_INVALID", "Source identity is invalid.")
    if body["declaredMediaType"] not in DECLARED_MEDIA_TYPES:
        raise ImportError("TYPE_UNSUPPORTED", "Declared media type is not supported.")
    byte_length = body["byteLength"]
    if not isinstance(byte_length, int) or isinstance(byte_length, bool) or byte_length <= 0:
        raise ImportError("REQUEST_INVALID", "Declared byte length is invalid.")
    if byte_length > MAX_IMPORT_BYTES:
        raise ImportError("SIZE_LIMIT", "Declared length exceeds the frozen maximum.")
    return {
        "taskId": body["taskId"],
        "sourceIdentity": body["sourceIdentity"],
        "declaredMediaType": body["declaredMediaType"],
        "byteLength": byte_length,
    }


def public_media(
    record: dict[str, Any], prepared: dict[str, Any] | None = None
) -> dict[str, Any] | None:
    """The frozen `media` payload, or null until preparation is durable.

    It is assembled only from DURABLE facts: the verified video manifest digest
    plus the prepared media shape. It never exposes a path, a name or a token.
    """
    if prepared is None:
        prepared = record.get("preparedMedia")
    if not isinstance(prepared, dict):
        return None
    sha256 = record.get("videoManifestSha256")
    if not isinstance(sha256, str) or not SHA256_RE.fullmatch(sha256):
        return None
    container = str(prepared["container"])
    if container not in MEDIA_CONTAINERS:
        # The public projection carries the FROZEN container enum. The raw
        # ffprobe container string never leaves the Runtime.
        raise ImportError("MEDIA_INVALID", "The prepared container is outside the frozen set.")
    return {
        "sha256": sha256,
        "durationMs": int(prepared["durationMs"]),
        "widthPx": int(prepared["widthPx"]),
        "heightPx": int(prepared["heightPx"]),
        "container": container,
        "route": str(prepared["route"]),
    }


def _recoverable(failure_code: str | None) -> bool:
    """PUBLIC only: whether the frozen failure code invites another attempt."""
    if failure_code is None:
        return True
    name = failure_code.removeprefix(PREFIX)
    return RECOVERABLE.get(name, False)


def public_status(
    record: dict[str, Any], prepared: dict[str, Any] | None = None
) -> dict[str, Any]:
    """The PUBLIC view, conforming to `v3_media_local_import_status_v1`."""
    if prepared is None:
        prepared = record.get("preparedMedia")
    return {
        "schemaVersion": PUBLIC_STATUS_SCHEMA_VERSION,
        "importId": record["importId"],
        "taskId": record["taskId"],
        "state": record["state"],
        "sequence": record["sequence"],
        "byteLength": record["byteLength"],
        "uploadedBytes": record["uploadedBytes"],
        "createdAt": record["createdAt"],
        "updatedAt": record["updatedAt"],
        "failureCode": record["failureCode"],
        "recoverable": _recoverable(record["failureCode"]),
        "media": public_media(record, prepared),
    }
