from __future__ import annotations

import json

import cv2
import numpy as np
import pytest

from navia_runtime.modules.adapters.media_vision import (
    GovernedMediaVisionAdapter,
    GovernedVisionError,
    SelectedVisionFrame,
    VisionConsentStore,
)
from navia_runtime.modules.media_companion.acquisition import TaskArtifactSandbox
from navia_runtime.modules.media_companion.vision.provider_settings import (
    MINIMAX_ADAPTER_KIND,
    MINIMAX_CN_API_BASE,
    MINIMAX_CN_MODEL_IDS,
    MINIMAX_CN_PROVIDER_ID,
    MemorySecretStore,
    VisionProviderError,
    VisionProviderStore,
)


TASK_ID = "media_task_99999999999999999999999999999999"
EVIDENCE_ID = "mev_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
SECRET = "minimax-test-secret-never-persisted"


class FakeAdapters:
    def __init__(self, error: VisionProviderError | None = None) -> None:
        self.calls = 0
        self.error = error

    def analyze_frame(self, provider, image):
        self.calls += 1
        assert provider["apiKey"] == SECRET
        assert image.startswith(b"\x89PNG")
        if self.error:
            raise self.error
        return {
            "caption": "A person stands beside visible interface text.",
            "model": MINIMAX_CN_MODEL_IDS[0],
            "usage": {"inputTokens": 120, "outputTokens": 18, "estimatedCostUsd": None},
        }


def setup(tmp_path):
    sandbox = TaskArtifactSandbox(tmp_path / "tasks")
    sandbox.create(TASK_ID)
    image = np.full((120, 240, 3), 245, dtype=np.uint8)
    cv2.putText(image, "NAVIA", (20, 75), cv2.FONT_HERSHEY_SIMPLEX, 1.5, (0, 0, 0), 3, cv2.LINE_AA)
    ok, encoded = cv2.imencode(".png", image)
    assert ok
    artifact = sandbox.write_bytes(TASK_ID, "frame", encoded.tobytes())
    selected = SelectedVisionFrame(TASK_ID, EVIDENCE_ID, artifact, True, 240, 120)
    providers = VisionProviderStore(tmp_path / "provider.sqlite3", MemorySecretStore())
    providers.upsert(MINIMAX_CN_PROVIDER_ID, {
        "adapterKind": MINIMAX_ADAPTER_KIND,
        "name": "MiniMax Vision（中国区）",
        "baseUrl": MINIMAX_CN_API_BASE,
        "model": MINIMAX_CN_MODEL_IDS[0],
        "apiKey": SECRET,
    })
    providers.update_test_status(MINIMAX_CN_PROVIDER_ID, {"status": "ok", "model": MINIMAX_CN_MODEL_IDS[0]})
    providers.select(MINIMAX_CN_PROVIDER_ID)
    consent = VisionConsentStore(tmp_path / "consent.sqlite3")
    adapters = FakeAdapters()
    governed = GovernedMediaVisionAdapter(sandbox, consent, providers, adapters)
    return sandbox, selected, consent, adapters, governed


def test_governed_dispatch_requires_consent_and_returns_bound_receipt(tmp_path) -> None:
    _, selected, consent, adapters, governed = setup(tmp_path)
    with pytest.raises(GovernedVisionError) as missing:
        governed.dispatch(selected)
    assert missing.value.code == "VISION_CONSENT_REQUIRED"
    assert adapters.calls == 0

    granted = consent.grant()
    result = governed.dispatch(selected).public_dict()
    assert result["consentDecisionId"] == granted["decisionId"]
    assert result["dispatchSequence"] == 0
    assert result["providerId"] == MINIMAX_CN_PROVIDER_ID
    assert result["modelId"] == MINIMAX_CN_MODEL_IDS[0]
    assert result["usage"] == {"inputImageCount": 1, "inputBytes": selected.artifact.byte_length, "inputTokens": 120, "outputTokens": 18, "estimatedCostUsd": None}
    assert len(result["requestSha256"]) == len(result["responseSha256"]) == 64
    serialized = json.dumps(result)
    assert SECRET not in serialized
    assert "base64" not in serialized
    assert str(tmp_path) not in serialized


def test_revoke_and_budget_block_before_provider_dispatch(tmp_path) -> None:
    _, selected, consent, adapters, governed = setup(tmp_path)
    consent.grant()
    assert governed.dispatch(selected).dispatch_sequence == 0
    revoked = consent.revoke(TASK_ID)
    with pytest.raises(GovernedVisionError) as after_revoke:
        governed.dispatch(selected)
    assert after_revoke.value.code == "VISION_CONSENT_REVOKED"
    assert adapters.calls == 1
    assert revoked["authorizedDispatchCount"] == 1
    assert revoked["postRevocationDispatchCount"] == 0
    assert revoked["outboundBarrierAt"] is not None


def test_identity_and_provider_failures_are_fail_closed(tmp_path) -> None:
    sandbox, selected, consent, adapters, governed = setup(tmp_path)
    consent.grant()
    bad = SelectedVisionFrame(TASK_ID, EVIDENCE_ID, selected.artifact, False, 240, 120)
    with pytest.raises(GovernedVisionError) as identity:
        governed.dispatch(bad)
    assert identity.value.code == "EVIDENCE_IDENTITY_MISMATCH"
    assert adapters.calls == 0

    path = sandbox.private_path(TASK_ID, selected.artifact)
    path.write_bytes(path.read_bytes() + b"drift")
    with pytest.raises(GovernedVisionError) as drift:
        governed.dispatch(selected)
    assert drift.value.code == "EVIDENCE_IDENTITY_MISMATCH"
    assert adapters.calls == 0


@pytest.mark.parametrize("code", ["VISION_RATE_LIMITED", "VISION_TIMEOUT", "VISION_RESPONSE_INVALID", "VISION_PROVIDER_UNAVAILABLE"])
def test_provider_failure_codes_do_not_generate_success(code, tmp_path) -> None:
    sandbox, selected, consent, _, governed = setup(tmp_path)
    consent.grant()
    failing = FakeAdapters(VisionProviderError(code, "failed", 503))
    governed.adapters = failing
    with pytest.raises(GovernedVisionError) as raised:
        governed.dispatch(selected)
    assert raised.value.code == code
    assert failing.calls == 1
    assert consent.receipt(TASK_ID)["authorizedDispatchCount"] == 1


def test_regrant_does_not_reset_per_task_dispatch_budget(tmp_path) -> None:
    _, selected, consent, adapters, governed = setup(tmp_path)
    consent.grant()
    for _ in range(4):
        governed.dispatch(selected)
    consent.grant()
    for _ in range(4):
        governed.dispatch(selected)
    with pytest.raises(GovernedVisionError) as budget:
        governed.dispatch(selected)
    assert budget.value.code == "VISION_BUDGET_EXCEEDED"
    assert adapters.calls == 8
    assert consent.receipt(TASK_ID)["authorizedDispatchCount"] == 8
