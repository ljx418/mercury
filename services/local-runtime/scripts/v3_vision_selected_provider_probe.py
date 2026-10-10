#!/usr/bin/env python3
"""Run the selected vision provider against Navia's neutral image without exposing credentials."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

from navia_runtime.app import vision_provider_adapter, vision_provider_store
from navia_runtime.modules.media_companion.vision.provider_settings import neutral_probe_png, utc_now


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    provider_id = vision_provider_store.selected_provider_id()
    if not provider_id:
        raise SystemExit("VISION_PROVIDER_NOT_SELECTED")
    provider = vision_provider_store.get(provider_id, include_secret=True)
    if provider is None:
        raise SystemExit("VISION_PROVIDER_MISSING")

    result = vision_provider_adapter.test(provider)
    image = neutral_probe_png()
    public = {
        "schemaVersion": "v3-vision-selected-provider-probe/v1",
        "executedAt": utc_now(),
        "executed": True,
        "passed": result["status"] == "ok",
        "failureCode": None,
        "provider": {
            "providerId": provider["id"],
            "adapterKind": provider["adapterKind"],
            "modelId": result["model"],
            "apiBase": provider["baseUrl"],
            "credentialStorage": provider["secretStorage"],
            "credentialReferenceSha256": hashlib.sha256(provider["secretRef"].encode()).hexdigest(),
        },
        "probeImage": {
            "kind": "generated_neutral_checkerboard",
            "containsUserContent": False,
            "byteLength": len(image),
            "sha256": result["imageSha256"],
        },
        "requestPolicy": {"singleImage": True, "store": result["store"], "toolsEnabled": False},
        "result": {
            "latencyMs": result["latencyMs"],
            "usage": result["usage"],
            "observation": result["observation"],
        },
        "secretMaterialIncluded": False,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(public, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    args.output.chmod(0o600)
    print(json.dumps({"passed": public["passed"], "providerId": provider_id, "modelId": result["model"]}))
    return 0 if public["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
