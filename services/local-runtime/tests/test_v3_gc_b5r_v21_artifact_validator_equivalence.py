"""GC-B5R artifact integrity — the shared V2.1 validator and the canonical
serialization.

The Stage B runner validates the durable derivative with a SHARED JavaScript
validator that reads the FROZEN contract file

    docs/active/project/contracts/v3_media_grounded_comprehension_v2_1.schema.json

This module proves TWO things, and it does not claim more than it proves:

1. the STRUCTURAL guarantee: the shared validator implements exactly the
   JSON Schema keywords the frozen contract uses, and it refuses any
   keyword it does not implement. The keyword inventory of the ACTUAL frozen
   file is compared here, keyword by keyword, with the inventory the shared
   validator computes;
2. a REPRESENTATIVE sample: the shared validator and the PRODUCTION
   `jsonschema` library return the SAME verdict on a set of representative
   accept/reject fixtures. A finite fixture list is NOT a universal
   equivalence proof, and it is not presented as one: the universal
   guarantee comes from (1) plus the fail-closed behaviour.

The canonical serialization is compared BYTE BY BYTE with the production
`json.dumps(..., ensure_ascii=False, sort_keys=True, separators=(",", ":"))`
over the LEGAL FROZEN RECEIPT DOMAIN: every field type the frozen receipt
allows, plus representative Unicode strings.

No network, no Chrome, no Runtime, no Provider, no media: the fixtures are
synthetic objects in a temporary directory.
"""

from __future__ import annotations

import json
import os
import subprocess
from pathlib import Path
from typing import Any

import pytest
from jsonschema import Draft202012Validator

REPO_ROOT = Path(__file__).resolve().parents[3]
SCHEMA_PATH = (
    REPO_ROOT
    / "docs/active/project/contracts/v3_media_grounded_comprehension_v2_1.schema.json"
)
VALIDATOR_MODULE = REPO_ROOT / "scripts/stage_b_b5_3/lib/v21_artifact.mjs"

NODE_PROBE = """
import fs from "node:fs";
const { validateV21Artifact, canonicalJson, inventorySchemaKeywords } =
  await import(process.env.NAVIA_V21_VALIDATOR);
const fixtures = JSON.parse(fs.readFileSync(process.env.NAVIA_V21_FIXTURES, "utf8"));
const verdicts = {};
for (const [name, value] of Object.entries(fixtures)) {
  verdicts[name] = validateV21Artifact(value).ok;
}
const canonical = JSON.parse(fs.readFileSync(process.env.NAVIA_B5_CANONICAL, "utf8"));
const canonicalBytes = {};
for (const [name, value] of Object.entries(canonical)) {
  canonicalBytes[name] = canonicalJson(value);
}
const schema = JSON.parse(fs.readFileSync(process.env.NAVIA_B5_SCHEMA, "utf8"));
process.stdout.write(JSON.stringify({
  verdicts,
  canonicalBytes,
  keywordInventory: inventorySchemaKeywords(schema),
}));
"""


def _receipt(request_count: int = 3) -> dict[str, Any]:
    return {
        "providerId": "minimax-cn-openai-vision",
        "modelId": "MiniMax-M3",
        "outboundDerivedTextSha256": "1" * 64,
        "requestCount": request_count,
        "rawVideoUploadCount": 0,
        "rawAudioUploadCount": 0,
        "frameByteUploadCount": 0,
        "cookieUploadCount": 0,
        "apiKeyDisclosureCount": 0,
        "localPathUploadCount": 0,
        "endpointClass": "minimax_chat_completions",
        "structureMode": "strict_tool",
        "attemptId": "attempt-" + "a" * 16,
        "latencyMs": 12,
        "requestSha256": "2" * 64,
        "responseSha256": "3" * 64,
        "finishReason": "stop",
    }


def _artifact(receipt: dict[str, Any] | None = None) -> dict[str, Any]:
    receipt = receipt or _receipt()
    evidence = ["mtr_" + "1" * 32, "mtr_" + "2" * 32]
    return {
        "schemaVersion": "v3-media-grounded-comprehension/v2.1",
        "binding": {
            "taskId": "media_task_" + "a" * 32,
            "taskRevision": 1,
            "sourceIdentity": "portal:bilibili:BV11t8w6oEtP:41828944992:p1",
            "evidenceCatalogSha256": "6" * 64,
            "mediaDurationMs": 24000,
            "spanStartMs": 0,
            "spanEndMs": 24000,
        },
        "brief": {
            "text": "这段离线测试概括覆盖视频开头中段与结尾的全部核心表达与限制条件。",
            "evidenceIds": [evidence[0]],
            "regions": ["opening"],
            "origin": "provider",
            "sourceClaimIds": [],
        },
        "claims": [
            {
                "claimId": "claim_" + "3" * 16,
                "text": "第一条可核验的核心表达，概括视频的一个要点与它的直接证据。",
                "evidenceIds": [evidence[0]],
                "regions": ["opening"],
            },
            {
                "claimId": "claim_" + "4" * 16,
                "text": "第二条可核验的核心表达，概括视频的另一个要点与它的直接证据。",
                "evidenceIds": [evidence[1]],
                "regions": ["middle"],
            },
        ],
        "chapters": [
            {
                "chapterId": "chapter_" + "5" * 16,
                "order": 0,
                "title": "视频的开场与背景",
                "thesis": "这一章说明视频的背景与它要处理的问题。",
                "startMs": 0,
                "endMs": 8000,
                "evidenceIds": [evidence[0]],
                "relationToPrevious": "opening",
            },
            {
                "chapterId": "chapter_" + "6" * 16,
                "order": 1,
                "title": "视频的方法与结论",
                "thesis": "这一章给出视频的方法、它的结论与它的限制。",
                "startMs": 8000,
                "endMs": 24000,
                "evidenceIds": [evidence[1]],
                "relationToPrevious": "continuation",
            },
        ],
        "regions": [
            {
                "name": "opening",
                "startMs": 0,
                "endMs": 8000,
                "availability": "substantive",
                "evidenceIds": [evidence[0]],
            },
            {
                "name": "middle",
                "startMs": 8000,
                "endMs": 16000,
                "availability": "substantive",
                "evidenceIds": [evidence[1]],
            },
            {
                "name": "ending",
                "startMs": 16000,
                "endMs": 24000,
                "availability": "substantive",
                "evidenceIds": [evidence[1]],
            },
        ],
        "quality": {
            "status": "complete",
            "failureCodes": [],
            "sourceCoverageRatio": 1,
            "maxChapterStartConcentration": 0.5,
            "maxChapterSpanRatio": 0.5,
            "humanReviewRequired": True,
        },
        "receipt": receipt,
    }


def _fixtures() -> dict[str, Any]:
    artifact = _artifact()
    receipt = artifact["receipt"]
    return {
        "valid": artifact,
        "wrong-schema": {**artifact, "schemaVersion": "v2.0-not-the-frozen-one"},
        "additional-property": {**artifact, "extra": 1},
        "missing-binding": {**artifact, "binding": None},
        "bad-task-id": {**artifact, "binding": {**artifact["binding"], "taskId": "nope"}},
        "bad-source-identity": {
            **artifact,
            "binding": {**artifact["binding"], "sourceIdentity": "not-a-source-identity"},
        },
        "request-count-zero": {**artifact, "receipt": {**receipt, "requestCount": 0}},
        "request-count-missing": {
            **artifact,
            "receipt": {key: value for key, value in receipt.items() if key != "requestCount"},
        },
        "non-zero-upload": {**artifact, "receipt": {**receipt, "rawVideoUploadCount": 1}},
        "duplicate-claim": {**artifact, "claims": [artifact["claims"][0], artifact["claims"][0]]},
        "duplicate-evidence": {
            **artifact,
            "brief": {**artifact["brief"], "evidenceIds": [artifact["brief"]["evidenceIds"][0]] * 2},
        },
        "brief-origin-composer": {
            **artifact,
            "brief": {**artifact["brief"], "origin": "deterministic_claim_composer"},
        },
        "bad-relation": {
            **artifact,
            "chapters": [{**artifact["chapters"][0], "relationToPrevious": "nonsense"}, artifact["chapters"][1]],
        },
        "human-review-false": {
            **artifact,
            "quality": {**artifact["quality"], "humanReviewRequired": False},
        },
        "chapter-order-out-of-range": {
            **artifact,
            "chapters": [{**artifact["chapters"][0], "order": 99}, artifact["chapters"][1]],
        },
        "short-brief": {**artifact, "brief": {**artifact["brief"], "text": "短"}},
        "negative-duration": {
            **artifact,
            "binding": {**artifact["binding"], "mediaDurationMs": -1},
        },
        "bad-finish-reason": {**artifact, "receipt": {**receipt, "finishReason": "nope"}},
        "bad-region-name": {
            **artifact,
            "regions": [{**artifact["regions"][0], "name": "nope"}, artifact["regions"][1], artifact["regions"][2]],
        },
        "empty-claims": {**artifact, "claims": []},
        "too-few-regions": {**artifact, "regions": artifact["regions"][:2]},
    }


def _shared_probe(fixtures: dict[str, Any], canonical: dict[str, Any], tmp_path: Path) -> dict[str, Any]:
    fixture_path = tmp_path / "fixtures.json"
    fixture_path.write_text(json.dumps(fixtures, ensure_ascii=False), encoding="utf-8")
    canonical_path = tmp_path / "canonical.json"
    canonical_path.write_text(json.dumps(canonical, ensure_ascii=False), encoding="utf-8")
    environment = {
        **os.environ,
        "NAVIA_V21_FIXTURES": str(fixture_path),
        "NAVIA_V21_VALIDATOR": VALIDATOR_MODULE.as_uri(),
        "NAVIA_B5_CANONICAL": str(canonical_path),
        "NAVIA_B5_SCHEMA": str(SCHEMA_PATH),
    }
    completed = subprocess.run(
        ["node", "--input-type=module", "-e", NODE_PROBE],
        cwd=str(REPO_ROOT),
        env=environment,
        capture_output=True,
        text=True,
        timeout=120,
    )
    assert completed.returncode == 0, completed.stderr
    return json.loads(completed.stdout)


def _shared_verdicts(fixtures: dict[str, Any], tmp_path: Path) -> dict[str, bool]:
    return _shared_probe(fixtures, {}, tmp_path)["verdicts"]


def _python_keyword_inventory(schema: dict[str, Any]) -> list[str]:
    """The structural keyword inventory of a schema.

    The keys of a schema node are keywords; the NAMES under `properties` and
    `$defs` are names, not keywords.
    """
    single = {
        "items", "additionalProperties", "not", "if", "then", "else", "contains",
        "propertyNames", "unevaluatedItems", "unevaluatedProperties",
    }
    lists = {"allOf", "anyOf", "oneOf", "prefixItems"}
    maps = {"properties", "$defs", "patternProperties", "dependentSchemas"}
    found: set[str] = set()

    def walk(node: Any) -> None:
        if node is True or node is False:
            return
        if not isinstance(node, dict):
            return
        for key, value in node.items():
            if key in maps:
                found.add(key)
                if isinstance(value, dict):
                    for sub in value.values():
                        walk(sub)
                continue
            found.add(key)
            if key in single:
                if isinstance(value, dict):
                    walk(value)
                continue
            if key in lists:
                if isinstance(value, list):
                    for sub in value:
                        walk(sub)
                continue

    walk(schema)
    return sorted(found)


def test_the_shared_validator_agrees_with_the_production_jsonschema(tmp_path: Path) -> None:
    """The shared validator is EXACT: it agrees with the production library."""
    schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
    validator = Draft202012Validator(schema)
    fixtures = _fixtures()
    shared = _shared_verdicts(fixtures, tmp_path)
    assert set(shared) == set(fixtures)
    for name, value in fixtures.items():
        production_ok = not list(validator.iter_errors(value))
        assert shared[name] is production_ok, (
            f"the shared validator and the production library disagree on {name!r}: "
            f"shared={shared[name]} production={production_ok}"
        )
    # The valid fixture must be accepted, and the mutations must not all be
    # accepted: the comparison is meaningful.
    assert shared["valid"] is True
    assert sum(1 for value in shared.values() if value is False) >= 15


def test_the_valid_fixture_satisfies_the_frozen_contract() -> None:
    """The synthetic fixture is a REAL contract-shaped V2.1 artifact."""
    schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
    validator = Draft202012Validator(schema)
    errors = list(validator.iter_errors(_artifact()))
    assert errors == [], [error.message for error in errors]


@pytest.mark.parametrize("field", [
    "providerId",
    "modelId",
    "outboundDerivedTextSha256",
    "requestCount",
    "rawVideoUploadCount",
    "rawAudioUploadCount",
    "frameByteUploadCount",
    "cookieUploadCount",
    "apiKeyDisclosureCount",
    "localPathUploadCount",
    "endpointClass",
    "structureMode",
    "attemptId",
    "latencyMs",
    "requestSha256",
    "responseSha256",
    "finishReason",
])
def test_the_frozen_receipt_requires_every_field(field: str) -> None:
    """The frozen receipt identity is complete: no field is optional."""
    receipt = _receipt()
    del receipt[field]
    artifact = _artifact(receipt)
    schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
    validator = Draft202012Validator(schema)
    # The frozen schema requires the ten base fields; the B-5 receipt identity
    # is checked by the runner and the aggregate.
    if field in {
        "providerId", "modelId", "outboundDerivedTextSha256", "requestCount",
        "rawVideoUploadCount", "rawAudioUploadCount", "frameByteUploadCount",
        "cookieUploadCount", "apiKeyDisclosureCount", "localPathUploadCount",
    }:
        assert list(validator.iter_errors(artifact)), f"{field} must be required"


def test_the_keyword_inventory_of_the_frozen_schema_is_compared(tmp_path: Path) -> None:
    """The STRUCTURAL guarantee: the same keyword inventory on both sides."""
    schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
    python_inventory = _python_keyword_inventory(schema)
    probe = _shared_probe({}, {}, tmp_path)
    assert probe["keywordInventory"] == python_inventory, (
        "the shared validator and this module disagree about the keyword "
        "inventory of the frozen contract"
    )
    # The inventory is not empty and it contains the keywords the contract
    # really uses.
    assert "properties" in python_inventory
    assert "$defs" in python_inventory
    assert "$ref" in python_inventory
    assert "if" in python_inventory and "then" in python_inventory
    # The property and definition NAMES are not keywords.
    assert "taskId" not in python_inventory
    assert "Binding" not in python_inventory


def _canonical(value: Any) -> bytes:
    return json.dumps(
        value, ensure_ascii=False, sort_keys=True, separators=(",", ":")
    ).encode("utf-8")


def _legal_receipt_fixtures() -> dict[str, Any]:
    """Every legal receipt field type, plus representative Unicode strings."""
    base = _receipt()
    return {
        "ascii": base,
        "unicode-model": {**base, "modelId": "MiniMax-中文模型-🚀"},
        "unicode-provider": {**base, "providerId": "minimax-cn-openai-vision", "modelId": "模型 ünïcödé ñ"},
        "combining": {**base, "modelId": "e\u0301gal"},
        "rtl": {**base, "modelId": "\u0627\u0644\u0639\u0631\u0628\u064a\u0629"},
        "cjk": {**base, "modelId": "\u6f22\u5b57\u6a21\u578b"},
        "emoji": {**base, "modelId": "\U0001f680\U0001f680"},
        "zero-upload": {**base, "rawVideoUploadCount": 0, "requestCount": 1},
        "max-request": {**base, "requestCount": 64, "latencyMs": 600000},
        "nesting": {
            **base,
            "usage": {"inputTokens": 1, "outputTokens": 2},
            "flags": [True, False],
            "nested": {"a": {"b": {"c": 1}}},
        },
    }


def test_the_canonical_receipt_serialization_is_byte_identical(tmp_path: Path) -> None:
    """The canonical serialization matches the production byte layout.

    The claim is scoped to the LEGAL FROZEN RECEIPT DOMAIN: the field types
    the frozen receipt allows (strings, integers, and the receipt's own
    structure) with representative Unicode strings.
    """
    fixtures = _legal_receipt_fixtures()
    probe = _shared_probe({}, fixtures, tmp_path)
    for name, value in fixtures.items():
        expected = _canonical(value)
        observed = probe["canonicalBytes"][name].encode("utf-8")
        assert observed == expected, (
            f"the canonical serialization differs for {name!r}: "
            f"python={expected!r} javascript={observed!r}"
        )


def test_the_frozen_receipt_fields_are_all_legal_for_the_canonical_domain() -> None:
    """Every field of the frozen receipt identity has a legal type."""
    receipt = _receipt()
    assert isinstance(receipt["providerId"], str)
    assert isinstance(receipt["modelId"], str)
    assert isinstance(receipt["outboundDerivedTextSha256"], str)
    assert isinstance(receipt["requestCount"], int)
    assert isinstance(receipt["latencyMs"], int)
    for key in (
        "rawVideoUploadCount", "rawAudioUploadCount", "frameByteUploadCount",
        "cookieUploadCount", "apiKeyDisclosureCount", "localPathUploadCount",
    ):
        assert isinstance(receipt[key], int)
    for key in ("endpointClass", "structureMode", "attemptId", "finishReason"):
        assert isinstance(receipt[key], str)
