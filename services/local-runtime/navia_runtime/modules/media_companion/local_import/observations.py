"""WP-B — the E2E-ONLY, READ-ONLY local-import observation channel.

The visible-session harness needs a few NUMERIC facts the product already
knows but does not publish: the server-observed maximum writer slice, how many
times the barrier claimed the cleanup, and the owned residue counts.

They are exposed through ONE endpoint that:

* is **absent** unless the explicit owned-E2E flag is set, so a production
  Runtime and a default startup never expose it;
* authenticates the exact extension origin and a live companion session, like
  every other media route;
* is **read-only**: it creates, uploads, cancels, polls, binds, materializes
  and cleans nothing.

The public API, the schemas and the failure-code universe are untouched: this
channel lives entirely outside them and only reports NUMBERS and identifiers
that the product already produced.
"""

from __future__ import annotations

import os
import threading
from pathlib import Path
from typing import Any

#: The explicit owned-E2E flag. It is set ONLY in the owned E2E Runtime
#: environment; a production build and a default startup never set it.
OBSERVATIONS_ENV = "NAVIA_E2E_LOCAL_IMPORT_OBSERVATIONS"
OBSERVATIONS_ENABLED_VALUE = "1"


def enabled() -> bool:
    """True only in the explicitly owned E2E Runtime environment."""
    return os.environ.get(OBSERVATIONS_ENV) == OBSERVATIONS_ENABLED_VALUE


class _Observations:
    """The in-process facts, recorded by the production path as it happens."""

    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._writer_slice_max: dict[str, int] = {}
        self._cleanup_claims: dict[str, int] = {}
        self._cancel_requests: dict[str, int] = {}

    def record_writer_slice(self, import_id: str, size: int) -> None:
        if not enabled():
            return
        with self._lock:
            current = self._writer_slice_max.get(import_id, 0)
            if size > current:
                self._writer_slice_max[import_id] = size

    def record_cleanup_claim(self, import_id: str) -> None:
        if not enabled():
            return
        with self._lock:
            self._cleanup_claims[import_id] = self._cleanup_claims.get(import_id, 0) + 1

    def record_cancel_request(self, import_id: str) -> None:
        if not enabled():
            return
        with self._lock:
            self._cancel_requests[import_id] = self._cancel_requests.get(import_id, 0) + 1

    def snapshot(self, import_id: str) -> dict[str, Any]:
        with self._lock:
            return {
                "writerSliceMaxBytes": self._writer_slice_max.get(import_id),
                "cleanupCount": self._cleanup_claims.get(import_id, 0),
                "cancelRequestCount": self._cancel_requests.get(import_id, 0),
            }


observations = _Observations()


def count_files(root: Path | str | None) -> int:
    """The number of regular files below a root. Read-only counting."""
    if not root:
        return 0
    path = Path(root)
    if not path.exists():
        return 0
    total = 0
    for entry in path.rglob("*"):
        try:
            if entry.is_file() and not entry.is_symlink():
                total += 1
        except OSError:
            continue
    return total


def build_snapshot(
    import_id: str,
    *,
    source_root: Path | str | None,
    sandbox_root: Path | str | None,
) -> dict[str, Any]:
    """The sanitized observation for one import."""
    facts = observations.snapshot(import_id)
    return {
        "importId": import_id,
        "writerSliceMaxBytes": facts["writerSliceMaxBytes"],
        "cleanupCount": facts["cleanupCount"],
        "cancelRequestCount": facts["cancelRequestCount"],
        "residue": {
            "source": count_files(source_root),
            "sandbox": count_files(sandbox_root),
        },
    }
