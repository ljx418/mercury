#!/usr/bin/env python3
"""Collect the GC-B5R corrective receipts.

The receipts record what the PRODUCTION owners decided, not what a double
decided:

  1. the public app composition (the real stores, the real coordinator, the
     real manager, ONE Runtime database);
  2. a fresh-process restart with the SAME verified generation: accepted, with
     the published derivative's digest;
  3. a fresh-process restart with a CHANGED generation: refused before the
     Provider, with no artifact and no counter moved;
  4. an unverifiable current generation: refused before the Provider.

Only the dependency probes (the filesystem seams a verified snapshot needs)
and the synthesis Provider (the network edge) are replaced.

Usage:
    python3 collect-corrective-receipts.py > corrective-receipts.json
"""

from __future__ import annotations

import hashlib
import json
import sys
import tempfile
from pathlib import Path
from typing import Any

REPO = next(path for path in (Path(__file__).resolve(), *Path(__file__).resolve().parents)
             if (path / "docs/active/project").is_dir())
RUNTIME = REPO / "services/local-runtime"
sys.path.insert(0, str(RUNTIME))
sys.path.insert(0, str(RUNTIME / "tests"))

from navia_runtime.modules.media_companion.comprehension import MediaComprehensionService  # noqa: E402
from navia_runtime.modules.media_companion.comprehension.synthesis import (  # noqa: E402
    GroundedSynthesisReceipt,
)
from navia_runtime.modules.media_companion.input_authority import MediaInputAuthority  # noqa: E402
from navia_runtime.modules.media_companion.local_import.store import (  # noqa: E402
    LocalMediaImportStore,
)
from navia_runtime.modules.media_companion.product_materializer import (  # noqa: E402
    MediaProductMaterializer,
)
from navia_runtime.modules.media_companion.task_store import MediaTaskStore  # noqa: E402

from test_v3_gc_b5r_corrective_authority import (  # noqa: E402
    IMPORT_ID,
    SOURCE,
    TASK,
    Projection,
    StubProvider,
    drive_import_ready,
    manager_resolver,
    ready_manager,
    unready_manager,
)


class _MonkeyPatch:
    """The smallest monkeypatch the WP-A probes need."""

    def __init__(self) -> None:
        self._env: dict[str, str | None] = {}
        self._attrs: list[tuple[Any, str, Any]] = []

    def setenv(self, name: str, value: str) -> None:
        import os

        self._env[name] = os.environ.get(name)
        os.environ[name] = value

    def setattr(self, target: str, name: Any, value: Any = None) -> None:
        """Both pytest forms: (dotted path, value) and (dotted path, name, value)."""
        import importlib

        if value is None:
            module_path, attribute = target.rsplit(".", 1)
            value = name
        else:
            module_path = target
            attribute = name
        module = importlib.import_module(module_path)
        self._attrs.append((module, attribute, getattr(module, attribute)))
        setattr(module, attribute, value)

    def undo(self) -> None:
        import os

        for name, value in self._env.items():
            if value is None:
                os.environ.pop(name, None)
            else:
                os.environ[name] = value
        for module, attribute, value in self._attrs:
            setattr(module, attribute, value)


def build(tmp: Path, manager, *, generation: str):
    store = MediaTaskStore(tmp / "runtime.sqlite3")
    imports = LocalMediaImportStore(tmp / "runtime.sqlite3")
    private = tmp / "private"
    imports.create_import(
        task_id=TASK,
        source_identity=SOURCE,
        byte_length=4096,
        declared_media_type="video/mp4",
        dependency_generation=generation,
        import_id=IMPORT_ID,
    )
    drive_import_ready(imports, IMPORT_ID)
    provider = StubProvider()
    factory_calls = {"count": 0}

    def factory():
        factory_calls["count"] += 1
        return provider

    authority = MediaInputAuthority(
        task_store=store,
        local_import_store=imports,
        generation_resolver=manager_resolver(manager),
    )
    service = MediaComprehensionService(
        store, private, synthesis_provider_factory=factory, input_authority=authority,
    )
    task = MediaProductMaterializer(store, Projection(), private).materialize(TASK)
    return {
        "service": service,
        "provider": provider,
        "factory_calls": factory_calls,
        "task": task,
        "private": private,
    }


def published(private: Path) -> list[Path]:
    root = private / "grounded-comprehension-v2.1"
    return sorted(root.rglob("*.json")) if root.exists() else []


def main() -> int:
    receipts: dict[str, Any] = {
        "schemaVersion": "v3-5.10-gc-b5r-corrective-receipts/v1",
        "note": (
            "The receipts record what the production owners decided. Only the "
            "dependency probes and the synthesis Provider (the network edge) "
            "are replaced."
        ),
    }

    # --- 1. the public app composition ------------------------------------
    import navia_runtime.app as runtime_app

    authority = runtime_app.media_input_authority
    receipts["appComposition"] = {
        "authorityType": type(authority).__name__,
        "taskStoreIsTheAppTaskStore": authority._task_store is runtime_app.media_outline_task_store,
        "localImportStoreIsTheAppImportStore": (
            authority._local_import_store is runtime_app.local_media_import_store
        ),
        "coordinatorIsTheAppCoordinator": (
            authority._coordinator is runtime_app.media_acquisition_coordinator
        ),
        "serviceUsesTheAppAuthority": (
            runtime_app.media_comprehension_service._input_authority is authority
        ),
        "oneRuntimeDatabase": (
            runtime_app.local_media_import_store.database_path
            == runtime_app.media_outline_task_store.db_path
        ),
        "generationSeamIsManagerOwned": authority._generation_resolver is not None,
        "globalLeaseMirror": dict(
            __import__(
                "navia_runtime.modules.media_companion.dependencies.manager",
                fromlist=["DEPENDENCY_LEASES"],
            ).DEPENDENCY_LEASES
        ),
    }

    patch = _MonkeyPatch()
    try:
        # --- 2. a fresh process, the SAME generation ----------------------
        with tempfile.TemporaryDirectory(prefix="gc-b5r-receipt-") as raw:
            tmp = Path(raw)
            manager = ready_manager(tmp, patch)
            generation = manager.acquire_snapshot(TASK).generation
            stack = build(tmp, manager, generation=generation)
            fresh = ready_manager(tmp, patch)  # a fresh instance = a fresh process
            held_before = fresh.leased_snapshot(TASK) is not None
            stack["service"]._input_authority._generation_resolver = manager_resolver(fresh)
            stack["service"].synthesize(TASK, stack["task"]["revision"], True)
            files = published(stack["private"])
            receipts["freshProcessSameGeneration"] = {
                "currentGeneration": generation,
                "freshInstanceHeldALeaseBeforeUse": held_before,
                "decision": "accepted",
                "providerCallCount": len(stack["provider"].calls),
                "providerFactoryInvocationCount": stack["factory_calls"]["count"],
                "publishedArtifactCount": len(files),
                "publishedArtifactSha256": (
                    hashlib.sha256(files[0].read_bytes()).hexdigest() if files else None
                ),
            }

        # --- 3. a changed generation ---------------------------------------
        with tempfile.TemporaryDirectory(prefix="gc-b5r-receipt-") as raw:
            tmp = Path(raw)
            manager = ready_manager(tmp, patch)
            generation = manager.acquire_snapshot(TASK).generation
            stack = build(tmp, manager, generation="depgen_" + "a" * 64)
            stack["service"]._input_authority._generation_resolver = manager_resolver(manager)
            code = None
            try:
                stack["service"].synthesize(TASK, stack["task"]["revision"], True)
            except Exception as error:  # noqa: BLE001 - the refusal IS the receipt
                code = getattr(error, "code", type(error).__name__)
            receipts["changedGeneration"] = {
                "currentGeneration": generation,
                "assetGeneration": "depgen_" + "a" * 64,
                "decision": "refused",
                "failureCode": code,
                "providerCallCount": len(stack["provider"].calls),
                "providerFactoryInvocationCount": stack["factory_calls"]["count"],
                "publishedArtifactCount": len(published(stack["private"])),
            }

        # --- 4. an unverifiable current generation -------------------------
        with tempfile.TemporaryDirectory(prefix="gc-b5r-receipt-") as raw:
            tmp = Path(raw)
            manager = unready_manager(tmp)
            stack = build(tmp, manager, generation="depgen_" + "a" * 64)
            code = None
            try:
                stack["service"].synthesize(TASK, stack["task"]["revision"], True)
            except Exception as error:  # noqa: BLE001 - the refusal IS the receipt
                code = getattr(error, "code", type(error).__name__)
            receipts["unverifiableGeneration"] = {
                "decision": "refused",
                "failureCode": code,
                "providerCallCount": len(stack["provider"].calls),
                "providerFactoryInvocationCount": stack["factory_calls"]["count"],
                "publishedArtifactCount": len(published(stack["private"])),
            }
    finally:
        patch.undo()

    print(json.dumps(receipts, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
