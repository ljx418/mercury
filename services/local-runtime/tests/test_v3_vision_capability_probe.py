from __future__ import annotations

import importlib.util
import json
from pathlib import Path

import pytest


SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "v3_vision_capability_probe.py"
SPEC = importlib.util.spec_from_file_location("v3_vision_capability_probe", SCRIPT)
assert SPEC and SPEC.loader
probe = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(probe)


def test_neutral_probe_request_is_fixed_and_contains_no_user_content():
    image = probe.neutral_probe_png()
    assert image.startswith(b"\x89PNG\r\n\x1a\n")
    payload = probe.build_request(image)
    manifest = probe.probe_manifest(image, payload)
    assert payload["model"] == "gpt-4.1-mini-2025-04-14"
    assert payload["store"] is False
    assert payload["max_output_tokens"] == 300
    assert payload["input"][0]["content"][1]["detail"] == "low"
    assert manifest["image"]["containsUserContent"] is False
    assert manifest["request"]["toolsEnabled"] is False


def test_response_parser_requires_exact_model_usage_and_typed_output():
    response = {
        "id": "resp_123",
        "status": "completed",
        "model": "gpt-4.1-mini-2025-04-14",
        "usage": {"input_tokens": 12, "output_tokens": 9, "total_tokens": 21},
        "output": [{"type": "message", "content": [{"type": "output_text", "text": json.dumps({
            "summary": "A geometric checkerboard.",
            "containsText": False,
            "dominantColors": ["green", "white", "red", "yellow"],
        })}]}],
    }
    parsed = probe.parse_response(response)
    assert parsed["usage"]["total_tokens"] == 21
    assert parsed["observation"]["containsText"] is False
    response["model"] = "unfrozen-model"
    with pytest.raises(ValueError, match="VISION_MODEL_MISMATCH"):
        probe.parse_response(response)


def test_dry_run_writes_redacted_fail_closed_report(tmp_path):
    output = tmp_path / "probe.json"
    assert probe.main(["--output", str(output)]) == 3
    report = json.loads(output.read_text())
    assert report["executed"] is False
    assert report["passed"] is False
    assert report["failureCode"] == "VISION_CAPABILITY_PROBE_NOT_EXECUTED"
    raw = output.read_text().lower()
    assert "authorization" not in raw
    assert "bearer" not in raw
    assert "api_key" not in raw


def test_execute_fails_closed_without_credential(tmp_path, monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    output = tmp_path / "probe.json"
    assert probe.main(["--output", str(output), "--execute-neutral-probe"]) == 2
    report = json.loads(output.read_text())
    assert report["executed"] is False
    assert report["failureCode"] == "VISION_CREDENTIAL_MISSING"
