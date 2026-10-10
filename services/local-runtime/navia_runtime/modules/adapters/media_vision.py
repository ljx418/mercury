from __future__ import annotations

import hashlib
import json
import secrets
import sqlite3
from dataclasses import dataclass
from pathlib import Path
from threading import RLock
from typing import Any

import cv2
import numpy as np

from ..media_companion.acquisition.task_artifacts import ArtifactRef, TaskArtifactError, TaskArtifactSandbox
from ..media_companion.vision.provider_settings import VisionProviderAdapterRegistry, VisionProviderError, VisionProviderStore, utc_now


CONSENT_SCOPE = "selected_frame_cloud_vision"
DISPATCH_LIMIT = 8


class GovernedVisionError(RuntimeError):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


@dataclass(frozen=True)
class VisionPermit:
    decision_id: str
    dispatch_sequence: int
    permitted_at: str


@dataclass(frozen=True)
class SelectedVisionFrame:
    task_id: str
    frame_evidence_id: str
    artifact: ArtifactRef
    selected: bool
    width_px: int
    height_px: int


@dataclass(frozen=True)
class GovernedVisionObservation:
    task_id: str
    frame_evidence_id: str
    provider_id: str
    model_id: str
    request_sha256: str
    response_sha256: str
    consent_decision_id: str
    dispatch_sequence: int
    uploaded_at: str
    caption: str
    input_bytes: int
    input_tokens: int | None
    output_tokens: int | None
    estimated_cost_usd: float | None

    def public_dict(self) -> dict[str, Any]:
        return {
            "evidenceId": "mev_" + hashlib.sha256(f"{self.frame_evidence_id}:{self.response_sha256}".encode()).hexdigest()[:32],
            "taskId": self.task_id,
            "frameEvidenceId": self.frame_evidence_id,
            "kind": "vision_caption",
            "providerId": self.provider_id,
            "modelId": self.model_id,
            "requestSha256": self.request_sha256,
            "responseSha256": self.response_sha256,
            "authorized": True,
            "consentDecisionId": self.consent_decision_id,
            "dispatchSequence": self.dispatch_sequence,
            "consentValidAtDispatch": True,
            "uploadedAt": self.uploaded_at,
            "caption": self.caption,
            "usage": {
                "inputImageCount": 1,
                "inputBytes": self.input_bytes,
                "inputTokens": self.input_tokens,
                "outputTokens": self.output_tokens,
                "estimatedCostUsd": self.estimated_cost_usd,
            },
            "status": "succeeded",
            "failureCode": None,
        }


class VisionConsentStore:
    def __init__(self, db_path: str | Path) -> None:
        self._lock = RLock()
        self._conn = sqlite3.connect(Path(db_path), check_same_thread=False, isolation_level=None)
        self._conn.row_factory = sqlite3.Row
        self._conn.execute(
            """
            CREATE TABLE IF NOT EXISTS media_vision_consent (
                scope TEXT PRIMARY KEY,
                state TEXT NOT NULL,
                decision_id TEXT,
                granted_at TEXT,
                revoked_at TEXT,
                outbound_barrier_at TEXT,
                dispatch_count INTEGER NOT NULL
            )
            """
        )
        self._conn.execute(
            """
            CREATE TABLE IF NOT EXISTS media_vision_dispatch_budget (
                task_id TEXT PRIMARY KEY,
                dispatch_count INTEGER NOT NULL
            )
            """
        )

    def grant(self) -> dict[str, Any]:
        decision_id = f"consent_{secrets.token_hex(16)}"
        granted_at = utc_now()
        with self._lock, self._conn:
            self._conn.execute(
                "INSERT INTO media_vision_consent VALUES (?, 'granted', ?, ?, NULL, NULL, 0) "
                "ON CONFLICT(scope) DO UPDATE SET state='granted', decision_id=excluded.decision_id, granted_at=excluded.granted_at, revoked_at=NULL, outbound_barrier_at=NULL, dispatch_count=0",
                (CONSENT_SCOPE, decision_id, granted_at),
            )
        return self.receipt()

    def revoke(self, task_id: str | None = None) -> dict[str, Any]:
        barrier = utc_now()
        with self._lock, self._conn:
            row = self._conn.execute("SELECT state FROM media_vision_consent WHERE scope=?", (CONSENT_SCOPE,)).fetchone()
            if row is None or row["state"] != "granted":
                raise GovernedVisionError("VISION_CONSENT_REQUIRED", "No active selected-frame consent exists.")
            self._conn.execute(
                "UPDATE media_vision_consent SET state='revoked', revoked_at=?, outbound_barrier_at=? WHERE scope=?",
                (barrier, barrier, CONSENT_SCOPE),
            )
        return self.receipt(task_id)

    def permit(self, task_id: str) -> VisionPermit:
        if not task_id.startswith("media_task_") or len(task_id) != 43:
            raise GovernedVisionError("EVIDENCE_IDENTITY_MISMATCH", "Vision task ID is invalid.")
        with self._lock:
            self._conn.execute("BEGIN IMMEDIATE")
            try:
                row = self._conn.execute("SELECT * FROM media_vision_consent WHERE scope=?", (CONSENT_SCOPE,)).fetchone()
                if row is None:
                    raise GovernedVisionError("VISION_CONSENT_REQUIRED", "Selected-frame cloud vision consent is required.")
                if row["state"] != "granted":
                    raise GovernedVisionError("VISION_CONSENT_REVOKED", "Selected-frame cloud vision consent was revoked.")
                budget = self._conn.execute("SELECT dispatch_count FROM media_vision_dispatch_budget WHERE task_id=?", (task_id,)).fetchone()
                sequence = int(budget["dispatch_count"]) if budget else 0
                if sequence >= DISPATCH_LIMIT:
                    raise GovernedVisionError("VISION_BUDGET_EXCEEDED", "Selected-frame cloud vision dispatch budget is exhausted.")
                permitted_at = utc_now()
                self._conn.execute("UPDATE media_vision_consent SET dispatch_count=dispatch_count+1 WHERE scope=?", (CONSENT_SCOPE,))
                self._conn.execute(
                    "INSERT INTO media_vision_dispatch_budget(task_id, dispatch_count) VALUES (?, 1) "
                    "ON CONFLICT(task_id) DO UPDATE SET dispatch_count=dispatch_count+1",
                    (task_id,),
                )
                self._conn.execute("COMMIT")
                return VisionPermit(str(row["decision_id"]), sequence, permitted_at)
            except Exception:
                self._conn.execute("ROLLBACK")
                raise

    def receipt(self, task_id: str | None = None) -> dict[str, Any]:
        with self._lock:
            row = self._conn.execute("SELECT * FROM media_vision_consent WHERE scope=?", (CONSENT_SCOPE,)).fetchone()
            if task_id is None:
                budget = None
            else:
                budget = self._conn.execute("SELECT dispatch_count FROM media_vision_dispatch_budget WHERE task_id=?", (task_id,)).fetchone()
        if row is None:
            return {"scope": CONSENT_SCOPE, "state": "not_granted", "decisionId": None, "grantedAt": None, "revokedAt": None, "outboundBarrierAt": None, "authorizedDispatchCount": 0, "postRevocationDispatchCount": 0, "consentCheckedPerDispatch": True}
        return {
            "scope": CONSENT_SCOPE,
            "state": row["state"],
            "decisionId": row["decision_id"],
            "grantedAt": row["granted_at"],
            "revokedAt": row["revoked_at"],
            "outboundBarrierAt": row["outbound_barrier_at"],
            "authorizedDispatchCount": int(budget["dispatch_count"]) if budget else 0,
            "postRevocationDispatchCount": 0,
            "consentCheckedPerDispatch": True,
        }


class GovernedMediaVisionAdapter:
    def __init__(self, sandbox: TaskArtifactSandbox, consent: VisionConsentStore, providers: VisionProviderStore, adapters: VisionProviderAdapterRegistry) -> None:
        self.sandbox = sandbox
        self.consent = consent
        self.providers = providers
        self.adapters = adapters

    @staticmethod
    def _canonical_hash(value: Any) -> str:
        return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")).hexdigest()

    def dispatch(self, frame: SelectedVisionFrame) -> GovernedVisionObservation:
        if not frame.selected or frame.artifact.task_id != frame.task_id or frame.artifact.kind != "frame" or not frame.frame_evidence_id.startswith("mev_") or len(frame.frame_evidence_id) != 36:
            raise GovernedVisionError("EVIDENCE_IDENTITY_MISMATCH", "Vision input is not a selected task-owned frame.")
        try:
            path = self.sandbox.private_path(frame.task_id, frame.artifact)
            image = path.read_bytes()
        except (OSError, TaskArtifactError) as exc:
            raise GovernedVisionError("EVIDENCE_IDENTITY_MISMATCH", "Vision frame is not available in the task sandbox.") from exc
        if hashlib.sha256(image).hexdigest() != frame.artifact.sha256:
            raise GovernedVisionError("EVIDENCE_IDENTITY_MISMATCH", "Vision frame bytes changed after publication.")
        decoded = cv2.imdecode(np.frombuffer(image, dtype=np.uint8), cv2.IMREAD_COLOR)
        if decoded is None or decoded.shape[1] != frame.width_px or decoded.shape[0] != frame.height_px or max(frame.width_px, frame.height_px) > 1280:
            raise GovernedVisionError("EVIDENCE_IDENTITY_MISMATCH", "Vision frame dimensions do not match the selected evidence.")

        provider_id = self.providers.selected_provider_id()
        if not provider_id:
            raise GovernedVisionError("VISION_PROVIDER_UNAVAILABLE", "No verified vision Provider is selected.")
        try:
            provider = self.providers.get(provider_id, include_secret=True)
        except VisionProviderError as exc:
            raise GovernedVisionError("VISION_PROVIDER_UNAVAILABLE", "Selected vision Provider is unavailable.") from exc
        if provider is None or provider.get("testStatus", {}).get("status") != "ok":
            raise GovernedVisionError("VISION_PROVIDER_UNAVAILABLE", "Selected vision Provider is not verified.")

        permit = self.consent.permit(frame.task_id)
        request = {
            "policyVersion": "v3-governed-frame-vision/v1",
            "taskId": frame.task_id,
            "frameEvidenceId": frame.frame_evidence_id,
            "frameSha256": frame.artifact.sha256,
            "providerId": provider_id,
            "modelId": provider["model"],
            "consentDecisionId": permit.decision_id,
            "dispatchSequence": permit.dispatch_sequence,
            "inputImageCount": 1,
            "inputBytes": len(image),
        }
        try:
            result = self.adapters.analyze_frame(provider, image)
        except VisionProviderError as exc:
            if exc.code in {"VISION_RATE_LIMITED", "VISION_TIMEOUT", "VISION_RESPONSE_INVALID", "VISION_PROVIDER_UNAVAILABLE"}:
                raise GovernedVisionError(exc.code, str(exc)) from exc
            raise GovernedVisionError("VISION_PROVIDER_UNAVAILABLE", "Vision Provider dispatch failed.") from exc
        response = {"caption": result.get("caption"), "model": result.get("model"), "usage": result.get("usage")}
        usage = response["usage"]
        if not isinstance(response["caption"], str) or not response["caption"].strip() or response["model"] != provider["model"] or not isinstance(usage, dict):
            raise GovernedVisionError("VISION_RESPONSE_INVALID", "Vision Provider returned an invalid typed response.")
        return GovernedVisionObservation(
            task_id=frame.task_id,
            frame_evidence_id=frame.frame_evidence_id,
            provider_id=provider_id,
            model_id=provider["model"],
            request_sha256=self._canonical_hash(request),
            response_sha256=self._canonical_hash(response),
            consent_decision_id=permit.decision_id,
            dispatch_sequence=permit.dispatch_sequence,
            uploaded_at=permit.permitted_at,
            caption=response["caption"].strip(),
            input_bytes=len(image),
            input_tokens=usage.get("inputTokens"),
            output_tokens=usage.get("outputTokens"),
            estimated_cost_usd=usage.get("estimatedCostUsd"),
        )
