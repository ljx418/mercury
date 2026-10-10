"""Isolated V3 media fault observations.

This module is deliberately not imported by the Runtime application. It is used
only by the signed, private acceptance runner and has no HTTP or extension entry.
"""

from __future__ import annotations

import hashlib
import hmac
import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


FAULT_CLASSES = (
    "downloader_403",
    "downloader_timeout",
    "redirect_private_network",
    "quota_exceeded",
    "disk_readonly",
    "disk_full",
    "ffmpeg_exit",
    "asr_exit",
    "runtime_disconnect",
    "capture_socket_loss",
    "lease_expired",
    "consent_revoked",
    "cancel_race",
    "orphan_process",
)
TERMINAL_STATES = frozenset({"degraded", "blocked", "failed", "cancelled"})


def canonical_json(value: Any) -> bytes:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")


def sign_profile(profile: dict[str, Any], key: bytes) -> str:
    unsigned = {name: value for name, value in profile.items() if name != "signature"}
    return hmac.new(key, canonical_json(unsigned), hashlib.sha256).hexdigest()


def verify_profile(path: Path, key: bytes, expected_root: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    required = {"schemaVersion", "runId", "isolatedTaskRoot", "faultClasses", "nonce", "signature"}
    if not isinstance(value, dict) or set(value) != required:
        raise ValueError("Fault profile has an invalid closed shape.")
    if value["schemaVersion"] != "v3-media-test-fault-profile/v1":
        raise ValueError("Fault profile schema is not accepted.")
    if tuple(value["faultClasses"]) != FAULT_CLASSES:
        raise ValueError("Fault profile denominator changed.")
    if not hmac.compare_digest(str(value["signature"]), sign_profile(value, key)):
        raise ValueError("Fault profile signature is invalid.")
    profile_root = Path(value["isolatedTaskRoot"]).resolve()
    if profile_root != expected_root.resolve() or profile_root == Path.home().resolve():
        raise ValueError("Fault profile root is not the isolated runner root.")
    return value


@dataclass
class FaultObservationRecorder:
    fault_id: str
    fault_class: str
    task_id: str
    events: list[dict[str, Any]] = field(default_factory=list)
    terminal_state: str | None = None
    terminal_count: int = 0
    committed_post_terminal_writes: int = 0
    rejected_post_terminal_writes: int = 0

    def observe(self, event: str, detail: dict[str, Any] | None = None) -> None:
        if self.terminal_state is not None:
            self.rejected_post_terminal_writes += 1
            raise RuntimeError("Terminal barrier rejected a post-terminal write.")
        safe_detail = detail or {}
        self.events.append({
            "sequence": len(self.events),
            "event": event,
            "detailSha256": hashlib.sha256(canonical_json(safe_detail)).hexdigest(),
        })

    def terminal(self, state: str, detail: dict[str, Any] | None = None) -> None:
        if state not in TERMINAL_STATES:
            raise ValueError("Fault terminal state is outside the frozen set.")
        if self.terminal_state is not None:
            raise RuntimeError("A fault task cannot have multiple terminal states.")
        self.observe("terminal", {"state": state, **(detail or {})})
        self.terminal_state = state
        self.terminal_count = 1

    def receipt(self, *, residual_count: int, secret_hit_count: int) -> dict[str, Any]:
        if self.terminal_state is None or self.terminal_count != 1:
            raise RuntimeError("Fault task did not reach exactly one terminal state.")
        evidence = {
            "faultId": self.fault_id,
            "faultClass": self.fault_class,
            "taskIdSha256": hashlib.sha256(self.task_id.encode("utf-8")).hexdigest(),
            "events": self.events,
            "rejectedPostTerminalWrites": self.rejected_post_terminal_writes,
        }
        return {
            "faultId": self.fault_id,
            "faultClass": self.fault_class,
            "terminalState": self.terminal_state,
            "terminalCount": self.terminal_count,
            "postTerminalWriteCount": self.committed_post_terminal_writes,
            "residualCount": residual_count,
            "secretHitCount": secret_hit_count,
            "evidenceSha256": hashlib.sha256(canonical_json(evidence)).hexdigest(),
        }
