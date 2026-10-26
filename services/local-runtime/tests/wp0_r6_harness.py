"""WP0 R6 owned-Runtime harness.

Every R6-G3/G4 case drives a REAL owned Uvicorn process over real HTTP and
real WebSockets. The R4 harness supplied the process lifecycle and the capture
primitives; this module adds the R6 receipts: a run/task identity, an ownership
ledger, and assertions that read the product's own state back rather than
inferring cleanup from test source.

Nothing here stubs FastAPI, and no case may be satisfied by fixture parsing.
"""

from __future__ import annotations

import contextlib
import json
import os
import sqlite3
import sys
import time
from pathlib import Path
from typing import Any, Iterator

sys.path.insert(0, str(Path(__file__).resolve().parent))

import wp0_r4_harness as r4  # noqa: E402  (path bootstrap must precede the import)

OwnedRuntime = r4.OwnedRuntime
launch = r4.launch
capture_seed = r4.capture_seed
issue_session = r4.issue_session
issue_ticket = r4.issue_ticket
start_message = r4.start_message
chunk_payload = r4.chunk_payload
pcm = r4.pcm
CAPTURE_BINDING = r4.CAPTURE_BINDING
SOURCE_IDENTITY = r4.SOURCE_IDENTITY
TASK_ID = r4.TASK_ID
ORIGIN = r4.ORIGIN

# R6 uses its own fixed identity so receipts never collide with an R4 run.
R6_TASK_ID = "media_task_" + "6" * 32
R6_SOURCE_IDENTITY = "portal:bilibili:BV1R6TEST:cid:1"

R6_BINDING: dict[str, Any] = {
    "taskId": R6_TASK_ID,
    "adapterId": "bilibili",
    "pageIdentitySha256": "6" * 64,
    "tabId": 66,
    "tabIdSha256": "7" * 64,
    "surface": "side_panel",
}


def r6_seed(task_id: str = R6_TASK_ID) -> dict[str, Any]:
    """A seeded capture task that binds to the R6 identity."""
    seed = dict(capture_seed(task_id))
    seed["taskId"] = task_id
    seed["sourceIdentity"] = R6_SOURCE_IDENTITY
    seed["mediaId"] = "BV1R6TEST"
    return seed


def r6_ticket(runtime: OwnedRuntime, binding: dict[str, Any] | None = None) -> dict[str, Any]:
    return issue_ticket(runtime, binding or R6_BINDING)


def r6_start_message(
    ticket: str,
    *,
    task_id: str = R6_TASK_ID,
    binding: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """The frozen `start` frame, bound to the SAME identity the grant used."""
    return {
        "type": "start",
        "ticket": ticket,
        **(binding or R6_BINDING),
        "taskId": task_id,
        "sourceIdentity": R6_SOURCE_IDENTITY,
        "acquisitionRecordId": "mar_" + "6" * 32,
        "sampleRateHz": 16_000,
        "channels": 1,
        "sampleWidthBytes": 2,
    }


def open_ws(runtime: OwnedRuntime, origin: str | None = ORIGIN):
    """Open the real capture WebSocket from the real client stack."""
    import websockets.sync.client as ws_client

    headers = {"Origin": origin} if origin is not None else {}
    return ws_client.connect(runtime.ws_url, additional_headers=headers, open_timeout=20)


# ---------------------------------------------------------------------------
# Product-state assertions
#
# Cleanup is read back out of the product's own SQLite, after the terminal.
# It is never inferred from a `finally` block in test source.
# ---------------------------------------------------------------------------


def product_state(root: Path) -> dict[str, Any]:
    """Read the four frozen residual classes out of the product's own state.

    Two of them (the capture grant and the active sink) are PROCESS-LOCAL in
    production, so they are read back through the product's own API rather than
    invented in a database. The other two are durable and are read from SQLite
    and the owned filesystem.
    """
    database = Path(root) / "navia.sqlite3"
    state: dict[str, Any] = {"database": False}
    if database.is_file():
        connection = sqlite3.connect(f"file:{database}?mode=ro", uri=True)
        try:
            tables = {
                row[0]
                for row in connection.execute("SELECT name FROM sqlite_master WHERE type='table'")
            }

            def count(table: str, where: str = "") -> int:
                if table not in tables:
                    return 0
                sql = f"SELECT COUNT(*) FROM {table}"
                if where:
                    sql += f" WHERE {where}"
                return int(connection.execute(sql).fetchone()[0])

            state.update(
                {
                    "database": True,
                    # Unpublished product work: a task that never reached a
                    # terminal product state.
                    "unpublishedProducts": count(
                        "media_tasks",
                        "current_outline_id IS NULL AND state NOT IN "
                        "('succeeded','failed','cancelled','blocked','abandoned')",
                    ),
                    "ownerReceipts": count("media_capture_owner_receipts"),
                    "asrStagingRoots": sum(
                        1
                        for path in (Path(root) / "media-asr-tasks").iterdir()
                        if path.is_dir()
                    )
                    if (Path(root) / "media-asr-tasks").is_dir()
                    else 0,
                    # Only TASK sandboxes are acquisition residue. The
                    # product-side `visual-products` directory is durable
                    # product evidence and is not an acquisition residual.
                    "acquisitionRoots": sum(
                        1
                        for path in (Path(root) / "media-tasks").iterdir()
                        if path.is_dir() and path.name.startswith("media_task_")
                    )
                    if (Path(root) / "media-tasks").is_dir()
                    else 0,
                }
            )
        finally:
            connection.close()
    state.setdefault("unpublishedProducts", 0)
    state.setdefault("ownerReceipts", 0)
    state.setdefault("asrStagingRoots", 0)
    state.setdefault("acquisitionRoots", 0)
    return state


def sink_state(runtime: OwnedRuntime, grant_id: str) -> dict[str, Any]:
    """Read the process-local active-sink count from the product's own API.

    The frozen cleanup counters are returned by the authenticated DELETE
    (the cancel path the product itself uses), so the case reads the same
    numbers the product would report to a real user.
    """
    token = issue_session(runtime)
    with runtime.client(token=token) as client:
        response = client.delete(f"/v1/media/capture-grants/{grant_id}")
    if response.status_code != 200:
        return {"available": False, "statusCode": response.status_code}
    body = response.json().get("data", {})
    cleanup = body.get("cleanup") or {}
    return {
        "available": True,
        "activeCaptureCount": cleanup.get("activeCaptureCount"),
        "residualRawAudioCount": cleanup.get("residualRawAudioCount"),
        "state": (body.get("grant") or {}).get("state"),
    }


@contextlib.contextmanager
def owned_runtime(
    root: Path,
    *,
    fault: dict[str, Any] | None = None,
    seed: dict[str, Any] | None = None,
) -> Iterator[OwnedRuntime]:
    """An owned Runtime that is always terminated and always scrubbed."""
    runtime = launch(root, fault=fault, seed=seed if seed is not None else r6_seed())
    try:
        yield runtime
    finally:
        runtime.terminate_owned()
        runtime.destroy_scratch()


def ledger(root: Path, case_id: str, **fields: Any) -> dict[str, Any]:
    """Write a desensitized per-case receipt next to the run.

    Only identifiers, counters and dispositions are recorded — never a ticket,
    a session token, raw audio, a transcript or an absolute private path.
    """
    record = {"caseId": case_id, **fields}
    target = Path(root).parent / f"{case_id}-receipt.json"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(record, ensure_ascii=False, indent=2, sort_keys=True))
    return record


def wait_until(predicate, timeout: float = 10.0, interval: float = 0.05):
    """Poll a product-state predicate until it holds or the bound expires."""
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        value = predicate()
        if value:
            return value
        time.sleep(interval)
    return None


def owned_process_alive(runtime: OwnedRuntime) -> bool:
    return os.path.isdir(f"/proc/{runtime.pid}")
