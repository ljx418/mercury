"""The ONE composition point between an acquisition input and the grounded
comprehension chain.

The Stage B chain may consume EITHER an automatic acquisition OR an explicit
local import, but always under ONE exact acquisition task and source identity.
This module is that single place: it resolves the authoritative input facts of
a task and refuses anything that does not belong to it.

It never infers an identity from a file name, a digest, a similarity or a test
seed, and it introduces no second orchestrator: it only READS the durable
owners (the task store's source authority, the local-import store and the
coordinator's binding) and VERIFIES that they agree.

The current dependency generation is NOT read from a global map. It is supplied
by the dependency manager itself, which is the only owner of a verified
snapshot, and a task that has no verifiable CURRENT generation is refused
before any Provider is asked.
"""

from __future__ import annotations

from typing import Any, Callable

from .local_import.binding import (
    SOURCE_MISMATCH_CODE,
    LocalImportBinding,
    resolve_binding,
    source_identity_parts,
    verify_binding,
)
from .local_import.store import LocalMediaImportStore

#: The existing Stage B failure code for a revision that moved.
REVISION_CONFLICT_CODE = "V3510B_TASK_REVISION_CONFLICT"
#: The existing media failure code for a dependency generation that cannot be
#: verified right now. It is reused; no inventory is edited.
DEPENDENCY_NOT_READY_CODE = "V3_MEDIA_DEPENDENCY_NOT_READY"

ROUTE_AUTOMATIC = "automatic_acquisition"
ROUTE_LOCAL = "explicit_local_media_asr"


class MediaInputAuthority:
    """Resolve and verify the input provenance of a task.

    The task store owns the source authority, the local-import store owns the
    local binding, the coordinator owns the in-flight acquisition and the
    dependency manager owns the current generation. This class composes them
    into one verdict.
    """

    def __init__(
        self,
        *,
        task_store: Any,
        local_import_store: Any = None,
        coordinator: Any = None,
        generation_resolver: Callable[[str], str | None] | None = None,
    ) -> None:
        self._task_store = task_store
        self._local_import_store = local_import_store
        self._coordinator = coordinator
        self._generation_resolver = generation_resolver

    # -- composition ---------------------------------------------------------

    @classmethod
    def for_task_store(cls, task_store: Any) -> "MediaInputAuthority":
        """The authority composed from the durable owners of ONE Runtime.

        The local-import store lives in the SAME Runtime database as the task
        store, so the durable binding of a task is read from that database.

        This composition carries NO generation resolver: a local input can
        therefore never be verified against a CURRENT dependency generation
        here, and the local route is refused before the Provider. The
        production composition in `navia_runtime/app.py` supplies the
        manager-owned resolver.
        """
        return cls(
            task_store=task_store,
            local_import_store=LocalMediaImportStore(task_store.db_path),
        )

    # -- resolution ----------------------------------------------------------

    def resolve(self, task_id: str) -> dict[str, Any]:
        """The authoritative input facts of a task.

        The facts are read from the durable owners. A task with no local import
        was served by the automatic route.
        """
        facts, _binding = self._resolve(task_id)
        return facts

    def _resolve(
        self, task_id: str
    ) -> tuple[dict[str, Any], LocalImportBinding | None]:
        task = self._task_store.get(task_id)
        source_identity = str(task["sourceIdentity"])
        facts: dict[str, Any] = {
            "taskId": task_id,
            "sourceIdentity": source_identity,
            "route": ROUTE_AUTOMATIC,
            "importId": None,
            "dependencyGeneration": None,
            "videoManifestSha256": None,
            "visualReceiptSha256": None,
            "barrierPhase": None,
        }
        try:
            adapter, media_id, unit_id, part_id = source_identity_parts(source_identity)
            facts["adapterId"] = adapter
            facts["mediaId"] = media_id
            facts["playbackUnitId"] = unit_id
            facts["partId"] = part_id
        except ValueError:
            facts["adapterId"] = None
            facts["mediaId"] = None
            facts["playbackUnitId"] = None
            facts["partId"] = None

        binding = self._local_binding(task_id)
        if binding is not None:
            facts.update(
                route=ROUTE_LOCAL,
                importId=binding.import_id,
                dependencyGeneration=binding.dependency_generation,
                videoManifestSha256=binding.video_manifest_sha256,
                visualReceiptSha256=binding.visual_receipt_sha256,
                barrierPhase=binding.barrier_phase,
            )
        return facts, binding

    def _local_binding(self, task_id: str) -> LocalImportBinding | None:
        return resolve_binding(store=self._local_import_store, task_id=task_id)

    # -- verification --------------------------------------------------------

    def require_current_input(
        self,
        task_id: str,
        *,
        expected_revision: int | None = None,
    ) -> dict[str, Any]:
        """Refuse anything that does not belong to the CURRENT task.

        The caller maps the raised `ValueError` to its own error type. No new
        failure code is introduced and no public contract changes.
        """
        # 1. The source authority must still be the current one.
        self._task_store.require_current_authority(task_id)
        task = self._task_store.get(task_id)
        if expected_revision is not None and int(task["revision"]) != int(expected_revision):
            raise ValueError(REVISION_CONFLICT_CODE)

        facts, binding = self._resolve(task_id)

        # 2. The coordinator's LIVE task, when it holds one, must be THIS task
        #    under THIS identity — on both routes. A coordinator that holds no
        #    live entry (a Runtime restart) is NOT a refusal: the durable
        #    task authority above stays decisive, so a valid durable terminal
        #    product never becomes unreadable because a process restarted.
        acquired = self._acquired_task(task_id)
        if acquired is not None:
            if str(acquired.get("sourceIdentity") or "") != facts["sourceIdentity"]:
                raise ValueError(SOURCE_MISMATCH_CODE)

        if binding is None:
            # The automatic route: the durable task authority and the
            # coordinator's live task are the whole verdict.
            return facts

        # 3. The local route: the asset must belong to THIS task, under THIS
        #    identity, and under the CURRENT dependency generation. A current
        #    generation that cannot be verified is a refusal, never a skipped
        #    comparison.
        verify_binding(
            binding,
            task_id=task_id,
            source_identity=facts["sourceIdentity"],
            dependency_generation=self._current_generation(task_id),
        )
        return facts

    def _current_generation(self, task_id: str) -> str | None:
        """The CURRENT verified dependency generation of a task.

        The resolver is the dependency manager's own seam: it returns the
        generation the task holds right now, re-verifying it when the task
        holds no lease (a Runtime restart). It returns None when no current
        generation can be verified, and the caller then refuses.
        """
        if self._generation_resolver is None:
            return None
        try:
            generation = self._generation_resolver(task_id)
        except Exception:  # noqa: BLE001 - an unverifiable generation is a refusal
            return None
        return generation if isinstance(generation, str) and generation else None

    def _acquired_task(self, task_id: str) -> dict[str, Any] | None:
        """The acquisition task the coordinator holds, if it holds one."""
        if self._coordinator is None:
            return None
        try:
            task = self._coordinator.get(task_id)
        except Exception:  # noqa: BLE001 - an unknown task has no acquisition
            return None
        return task if isinstance(task, dict) else None
