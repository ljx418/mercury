"""The durable binding between a local import and its acquisition task.

A local asset is valid ONLY after the real user-selection lifecycle bound it to
the CURRENT task under the CURRENT source identity. Nothing here infers an
identity from a file name, a digest, a similarity or a test seed: the binding is
read from the durable import record and the durable barrier record.

The composed facts are the ones the grounded-comprehension chain needs before
it may synthesize or publish:

* the task the asset belongs to;
* the media identity, so the media id, the playback unit and the part are
  covered by the one exact identity string;
* the dependency generation the asset was prepared under;
* the owner-manifest digest of the uploaded bytes;
* the visual-receipt digest of the prepared evidence.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

#: The existing media failure code for "this asset does not belong to that
#: task under that identity". It is reused; no inventory is edited.
SOURCE_MISMATCH_CODE = "V3_MEDIA_TRANSCRIPT_SOURCE_MISMATCH"

#: The existing media failure code for an asset prepared for another run.
CROSS_RUN_REUSE_CODE = "V3_MEDIA_CROSS_TASK_REUSE"

#: The existing media failure codes for a closed local import.
IMPORT_CANCELLED_CODE = "V3_MEDIA_IMPORT_CANCELLED"
IMPORT_FAILED_CODE = "V3_MEDIA_IMPORT_WRITE_FAILED"

#: The existing media failure code for a dependency generation that cannot be
#: verified right now.
DEPENDENCY_NOT_READY_CODE = "V3_MEDIA_DEPENDENCY_NOT_READY"

#: The states in which an import no longer owns anything.
_DEAD_STATES = frozenset({"cancelled", "failed"})


@dataclass(frozen=True)
class LocalImportBinding:
    """The durable facts that bind a local asset to a task."""

    import_id: str
    task_id: str
    source_identity: str
    dependency_generation: str
    video_manifest_sha256: str | None
    visual_receipt_sha256: str | None
    barrier_phase: str
    state: str

    def as_dict(self) -> dict[str, Any]:
        return {
            "importId": self.import_id,
            "taskId": self.task_id,
            "sourceIdentity": self.source_identity,
            "dependencyGeneration": self.dependency_generation,
            "videoManifestSha256": self.video_manifest_sha256,
            "visualReceiptSha256": self.visual_receipt_sha256,
            "barrierPhase": self.barrier_phase,
            "state": self.state,
        }


def resolve_binding(*, store: Any, task_id: str) -> LocalImportBinding | None:
    """The local import bound to THIS task, or None.

    The lookup is by the durable record, never by a file name, a digest or a
    similarity. A `ready` import DOES own the current input of its task, so it
    is a candidate; a cancelled or failed import owns nothing and closes the
    local route of the task.
    """
    if store is None:
        return None
    records = list(store.list_for_task(task_id))
    if not records:
        return None
    live = [record for record in records if record.get("state") not in _DEAD_STATES]
    if not live:
        # The task had a local import and it is closed. The local route may not
        # silently fall back to another input.
        states = {str(record.get("state") or "") for record in records}
        if "cancelled" in states:
            raise ValueError(IMPORT_CANCELLED_CODE)
        raise ValueError(IMPORT_FAILED_CODE)
    if len(live) > 1:
        # Two live imports for one task would mean two owners of one input.
        raise ValueError(SOURCE_MISMATCH_CODE)
    record = live[0]
    return LocalImportBinding(
        import_id=str(record["importId"]),
        task_id=str(record["taskId"]),
        source_identity=str(record["sourceIdentity"]),
        dependency_generation=str(record.get("dependencyGeneration") or ""),
        video_manifest_sha256=record.get("videoManifestSha256"),
        visual_receipt_sha256=record.get("visualReceiptSha256"),
        barrier_phase=str(record.get("barrierPhase") or ""),
        state=str(record.get("state") or ""),
    )


def source_identity_parts(source_identity: str) -> tuple[str, str, str, str]:
    """(adapter, mediaId, playbackUnitId, partId) of an exact source identity.

    The identity is the ONE exact key; a mismatch in ANY component is a
    mismatch of the whole media.
    """
    parts = source_identity.split(":")
    if len(parts) != 5:
        raise ValueError(SOURCE_MISMATCH_CODE)
    return parts[1], parts[2], parts[3], parts[4]


def verify_binding(
    binding: LocalImportBinding,
    *,
    task_id: str,
    source_identity: str,
    dependency_generation: str | None,
) -> None:
    """Refuse a binding that does not match the CURRENT task and identity.

    `dependency_generation` is the CURRENT verified generation of the task. It
    is REQUIRED: a binding whose current generation cannot be verified is
    refused, never compared against nothing. A binding prepared under another
    generation is a cross-run reuse.

    Raises `ValueError` with one of the frozen media codes; the caller maps it
    to its own error type. No new failure code is introduced.
    """
    if binding.task_id != task_id:
        raise ValueError(CROSS_RUN_REUSE_CODE)
    if binding.source_identity != source_identity:
        raise ValueError(SOURCE_MISMATCH_CODE)
    if not dependency_generation:
        # No verifiable current generation: the comparison is refused, never
        # skipped.
        raise ValueError(DEPENDENCY_NOT_READY_CODE)
    if binding.dependency_generation != dependency_generation:
        # The asset was prepared under another generation: a cross-run reuse.
        raise ValueError(CROSS_RUN_REUSE_CODE)
