#!/usr/bin/env python3
"""Fail-closed neutral-image capability probe for the frozen V3-3 VLM candidate."""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
import os
import random
import struct
import time
import urllib.error
import urllib.request
import zlib
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


PROVIDER_ID = "openai-responses-vision"
MODEL_ID = "gpt-4.1-mini-2025-04-14"
API_BASE = "https://api.openai.com/v1"
ENDPOINT = "/responses"
SCHEMA_VERSION = "v3-vision-capability-probe/v1"


def _png_chunk(kind: bytes, payload: bytes) -> bytes:
    return struct.pack(">I", len(payload)) + kind + payload + struct.pack(">I", zlib.crc32(kind + payload) & 0xFFFFFFFF)


def neutral_probe_png(width: int = 256, height: int = 128) -> bytes:
    """Generate a deterministic RGB checkerboard without text or user content."""
    colors = ((28, 112, 104), (242, 246, 245), (218, 78, 68), (246, 191, 38))
    rows = []
    for y in range(height):
        row = bytearray([0])
        for x in range(width):
            tile = (x // 64 + y // 64) % len(colors)
            row.extend(colors[tile])
        rows.append(bytes(row))
    header = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    return b"\x89PNG\r\n\x1a\n" + _png_chunk(b"IHDR", header) + _png_chunk(b"IDAT", zlib.compress(b"".join(rows), 9)) + _png_chunk(b"IEND", b"")


def response_schema() -> dict[str, Any]:
    return {
        "type": "object",
        "properties": {
            "summary": {"type": "string", "minLength": 1, "maxLength": 240},
            "containsText": {"type": "boolean"},
            "dominantColors": {
                "type": "array",
                "items": {"type": "string", "minLength": 1, "maxLength": 40},
                "minItems": 1,
                "maxItems": 4,
            },
        },
        "required": ["summary", "containsText", "dominantColors"],
        "additionalProperties": False,
    }


def build_request(image: bytes) -> dict[str, Any]:
    encoded = base64.b64encode(image).decode("ascii")
    return {
        "model": MODEL_ID,
        "input": [{
            "role": "user",
            "content": [
                {
                    "type": "input_text",
                    "text": (
                        "This is a generated neutral capability-test image with no user content. "
                        "Describe only visible colors and geometry. Do not infer context."
                    ),
                },
                {"type": "input_image", "image_url": f"data:image/png;base64,{encoded}", "detail": "low"},
            ],
        }],
        "text": {
            "format": {
                "type": "json_schema",
                "name": "navia_v3_vision_capability",
                "strict": True,
                "schema": response_schema(),
            }
        },
        "store": False,
        "max_output_tokens": 300,
    }


def canonical_sha256(value: Any) -> str:
    encoded = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def extract_output_text(response: dict[str, Any]) -> str:
    for item in response.get("output", []):
        if item.get("type") != "message":
            continue
        for content in item.get("content", []):
            if content.get("type") == "output_text" and isinstance(content.get("text"), str):
                return content["text"]
    raise ValueError("VISION_RESPONSE_TEXT_MISSING")


def validate_observation(value: Any) -> dict[str, Any]:
    if not isinstance(value, dict) or set(value) != {"summary", "containsText", "dominantColors"}:
        raise ValueError("VISION_RESPONSE_INVALID")
    if not isinstance(value["summary"], str) or not 1 <= len(value["summary"]) <= 240:
        raise ValueError("VISION_RESPONSE_INVALID")
    if type(value["containsText"]) is not bool:
        raise ValueError("VISION_RESPONSE_INVALID")
    colors = value["dominantColors"]
    if not isinstance(colors, list) or not 1 <= len(colors) <= 4 or any(not isinstance(item, str) or not 1 <= len(item) <= 40 for item in colors):
        raise ValueError("VISION_RESPONSE_INVALID")
    return value


def parse_response(response: dict[str, Any]) -> dict[str, Any]:
    if response.get("status") != "completed":
        raise ValueError("VISION_RESPONSE_INCOMPLETE")
    model = response.get("model")
    if model != MODEL_ID:
        raise ValueError("VISION_MODEL_MISMATCH")
    usage = response.get("usage")
    if not isinstance(usage, dict) or any(type(usage.get(key)) is not int for key in ("input_tokens", "output_tokens", "total_tokens")):
        raise ValueError("VISION_USAGE_MISSING")
    observation = validate_observation(json.loads(extract_output_text(response)))
    return {
        "responseIdSha256": hashlib.sha256(str(response.get("id", "")).encode()).hexdigest(),
        "model": model,
        "usage": {key: usage[key] for key in ("input_tokens", "output_tokens", "total_tokens")},
        "observation": observation,
        "responseSha256": canonical_sha256(response),
    }


def execute_request(payload: dict[str, Any], api_key: str, timeout_seconds: float = 30.0) -> dict[str, Any]:
    body = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    request = urllib.request.Request(
        API_BASE + ENDPOINT,
        data=body,
        method="POST",
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
    )
    for attempt in range(2):
        try:
            with urllib.request.urlopen(request, timeout=timeout_seconds) as response:
                return json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as error:
            if attempt == 0 and (error.code == 429 or 500 <= error.code <= 599):
                time.sleep(0.5 + random.random() * 0.5)
                continue
            raise RuntimeError(f"VISION_PROVIDER_HTTP_{error.code}") from None
        except (TimeoutError, urllib.error.URLError) as error:
            raise RuntimeError("VISION_PROVIDER_UNAVAILABLE") from error
    raise RuntimeError("VISION_PROVIDER_UNAVAILABLE")


def probe_manifest(image: bytes, payload: dict[str, Any]) -> dict[str, Any]:
    return {
        "schemaVersion": SCHEMA_VERSION,
        "providerId": PROVIDER_ID,
        "modelId": MODEL_ID,
        "apiBase": API_BASE,
        "endpoint": ENDPOINT,
        "image": {
            "kind": "generated_neutral_checkerboard",
            "mimeType": "image/png",
            "byteLength": len(image),
            "sha256": hashlib.sha256(image).hexdigest(),
            "containsUserContent": False,
        },
        "request": {
            "sha256": canonical_sha256(payload),
            "store": payload["store"],
            "imageDetail": "low",
            "maxOutputTokens": payload["max_output_tokens"],
            "toolsEnabled": False,
        },
    }


def write_report(path: Path, report: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if os.name == "posix":
        path.chmod(0o600)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--execute-neutral-probe", action="store_true")
    parser.add_argument("--credential-env", default="OPENAI_API_KEY")
    args = parser.parse_args(argv)

    image = neutral_probe_png()
    payload = build_request(image)
    report = probe_manifest(image, payload)
    report["executedAt"] = None
    report["executed"] = False
    report["passed"] = False
    report["failureCode"] = "VISION_CAPABILITY_PROBE_NOT_EXECUTED"

    if args.execute_neutral_probe:
        api_key = os.environ.get(args.credential_env, "")
        if len(api_key) < 20:
            report["failureCode"] = "VISION_CREDENTIAL_MISSING"
            write_report(args.output, report)
            return 2
        try:
            parsed = parse_response(execute_request(payload, api_key))
        except (RuntimeError, ValueError, json.JSONDecodeError) as error:
            report["executedAt"] = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
            report["executed"] = True
            report["failureCode"] = str(error)
            write_report(args.output, report)
            return 1
        report.update({
            "executedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "executed": True,
            "passed": True,
            "failureCode": None,
            "result": parsed,
        })
    write_report(args.output, report)
    if report["passed"]:
        return 0
    if not args.execute_neutral_probe:
        return 3
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
