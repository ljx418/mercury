"""WP-B AC2 / B01 — the three frozen schemas, the fixtures and the registry.

This is the oracle the earlier packages did not have. It:

* META-VALIDATES all three frozen schema files as Draft 2020-12 schemas;
* proves the Runtime's own constants EQUAL the values the schemas declare, so
  an implementation that drifts from its contract fails here;
* validates the public and internal fixtures against the schemas;
* validates the asset registry, including the environment variable it names;
* runs SEMANTIC MUTATIONS: shapes the JSON Schema cannot express, which the
  Runtime's own semantic validator must refuse.
"""

from __future__ import annotations

import copy
import json
from pathlib import Path
from typing import Any

import pytest
from jsonschema import Draft202012Validator
from referencing import Registry, Resource
from referencing.jsonschema import DRAFT202012

from navia_runtime.modules.media_companion.local_import import contracts as C
from navia_runtime.modules.media_companion.local_import.contracts import ImportError

REPOSITORY_ROOT = Path(__file__).resolve().parents[3]
CONTRACTS = REPOSITORY_ROOT / "docs/active/project/contracts"
FIXTURES = REPOSITORY_ROOT / "docs/active/project/fixtures"

SCHEMA_FILES = {
    "api": CONTRACTS / "v3_media_local_import_api_v1.schema.json",
    "internal": CONTRACTS / "v3_media_local_import_internal_v1.schema.json",
    "status": CONTRACTS / "v3_media_local_import_status_v1.schema.json",
}


def _load(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def _registry(documents: list[dict[str, Any]]) -> Registry:
    """A registry that resolves the frozen `$id`s LOCALLY.

    The contracts name each other by their absolute `$id`. Resolving them over
    the network would be both wrong and slow, so they are registered from the
    files on disk.
    """
    resources = [
        (document["$id"], Resource.from_contents(document, default_specification=DRAFT202012))
        for document in documents
    ]
    return Registry().with_resources(resources)


def _subschema_validator(
    document: dict[str, Any], pointer: str, documents: list[dict[str, Any]] | None = None
) -> Draft202012Validator:
    """A validator for one `$defs` entry that can still resolve `$ref`s.

    The `$defs` entries reference each other by a root-relative pointer, so the
    ROOT document has to stay the resolution base.
    """
    return Draft202012Validator(
        {
            "$schema": document["$schema"],
            "$defs": document.get("$defs", {}),
            "$ref": pointer,
        },
        registry=_registry(documents or [document]),
    )


@pytest.fixture(scope="module")
def schemas() -> dict[str, dict[str, Any]]:
    return {name: _load(path) for name, path in SCHEMA_FILES.items()}


# --- meta-validation ---------------------------------------------------------


@pytest.mark.parametrize("name", sorted(SCHEMA_FILES))
def test_b01_every_schema_is_a_valid_draft_2020_12_schema(name: str, schemas) -> None:
    """B01 — the three contract files are themselves valid schemas."""
    schema = schemas[name]
    assert schema["$schema"] == "https://json-schema.org/draft/2020-12/schema"
    Draft202012Validator.check_schema(schema)


@pytest.mark.parametrize("name", sorted(SCHEMA_FILES))
def test_b01_every_schema_declares_its_own_identity(name: str, schemas) -> None:
    """B01 — each contract file names itself, so a mix-up is caught."""
    schema = schemas[name]
    assert schema["$id"].endswith(SCHEMA_FILES[name].name)


def test_b01_the_runtime_constants_equal_the_schema_values(schemas) -> None:
    """B01 — the implementation may not drift from its frozen contract."""
    status = schemas["status"]
    internal = schemas["internal"]

    assert status["properties"]["schemaVersion"]["const"] == C.PUBLIC_STATUS_SCHEMA_VERSION
    assert (
        internal["$defs"]["storeRecord"]["properties"]["schemaVersion"]["const"]
        == C.SCHEMA_VERSION
    )
    assert (
        internal["$defs"]["consumerBarrier"]["properties"]["schemaVersion"]["const"]
        == C.CONSUMER_BARRIER_SCHEMA_VERSION
    )
    assert (
        internal["$defs"]["visualReceipt"]["properties"]["schemaVersion"]["const"]
        == C.VISUAL_RECEIPT_SCHEMA_VERSION
    )
    # The durable-handoff vocabulary is the schema's, not the implementation's.
    assert tuple(internal["$defs"]["barrierPhase"]["enum"]) == C.BARRIER_PHASES
    # The frozen public container enum.
    media = schemas["status"]["properties"]["media"]["oneOf"][1]
    assert tuple(media["properties"]["container"]["enum"]) == C.MEDIA_CONTAINERS
    # The frozen failure codes.
    assert set(internal["$defs"]["importFailureCode"]["enum"]) - {None} == {
        C.PREFIX + code for code in C.FAILURE_CODES
    }


def test_b01_the_frozen_consumer_barrier_shape_is_what_the_runtime_writes(
    schemas, tmp_path: Path
) -> None:
    """B01 — the durable barrier record validates against the frozen shape."""
    from navia_runtime.modules.media_companion.local_import.store import (
        LocalMediaBarrierStore,
    )

    barriers = LocalMediaBarrierStore(tmp_path / "navia.sqlite3")
    record = barriers.create(import_id="media_import_" + "a" * 32, task_id="media_task_" + "b" * 32)
    validator = _subschema_validator(
        schemas["internal"], "#/$defs/consumerBarrier", [schemas["internal"]]
    )
    errors = sorted(validator.iter_errors(record), key=lambda e: e.path)
    assert not errors, [error.message for error in errors]


def test_b01_the_frozen_store_record_shape_is_what_the_runtime_writes(
    schemas, tmp_path: Path
) -> None:
    """B01 — the durable store record validates against the frozen shape."""
    from navia_runtime.modules.media_companion.local_import.store import (
        LocalMediaImportStore,
    )

    store = LocalMediaImportStore(tmp_path / "navia.sqlite3")
    store.create_import(
        task_id="media_task_" + "b" * 32,
        source_identity="portal:bilibili:BV1abc:cid:1",
        byte_length=1024,
        declared_media_type="video/mp4",
        dependency_generation="depgen_" + "c" * 64,
        import_id="media_import_" + "a" * 32,
    )
    record = store.get("media_import_" + "a" * 32)
    validator = _subschema_validator(
        schemas["internal"], "#/$defs/storeRecord", [schemas["internal"]]
    )
    errors = sorted(validator.iter_errors(record), key=lambda e: list(e.path))
    assert not errors, [error.message for error in errors]


# --- the fixtures ------------------------------------------------------------


def test_b01_the_public_fixtures_validate(schemas) -> None:
    """B01 — every shipped public fixture matches the frozen schemas."""
    every = [schemas["api"], schemas["internal"], schemas["status"]]
    api = Draft202012Validator(schemas["api"], registry=_registry(every))
    status = Draft202012Validator(schemas["status"], registry=_registry(every))
    cases = {
        "v3-media-local-import-api-v1-positive.json": api,
        "v3-media-local-import-api-v1-error.json": api,
        "v3-media-local-import-create-v1-positive.json": api,
        "v3-media-local-import-status-v1-positive.json": status,
    }
    for name, validator in cases.items():
        payload = _load(FIXTURES / name)
        errors = sorted(validator.iter_errors(payload), key=lambda e: list(e.path))
        assert not errors, (name, [error.message for error in errors])


def test_b01_the_internal_fixture_validates(schemas) -> None:
    """B01 — the shipped internal fixture matches the frozen internal schema."""
    payload = _load(FIXTURES / "v3-media-local-import-internal-v1-positive.json")
    validator = Draft202012Validator(
        schemas["internal"],
        registry=_registry([schemas["api"], schemas["internal"], schemas["status"]]),
    )
    errors = sorted(validator.iter_errors(payload), key=lambda e: list(e.path))
    assert not errors, [error.message for error in errors]


def test_b01_the_fixture_values_are_the_ones_the_runtime_uses(schemas) -> None:
    """B01 — a fixture and the implementation may not disagree."""
    status = _load(FIXTURES / "v3-media-local-import-status-v1-positive.json")
    assert status["schemaVersion"] == C.PUBLIC_STATUS_SCHEMA_VERSION
    assert status["media"]["route"] == C.ROUTE
    assert status["media"]["container"] in C.MEDIA_CONTAINERS

    internal = _load(FIXTURES / "v3-media-local-import-internal-v1-positive.json")
    assert internal["consumerBarrier"]["schemaVersion"] == C.CONSUMER_BARRIER_SCHEMA_VERSION
    assert internal["visualReceipt"]["schemaVersion"] == C.VISUAL_RECEIPT_SCHEMA_VERSION
    assert internal["storeRecord"]["barrierPhase"] in C.BARRIER_PHASES


# --- the asset registry ------------------------------------------------------


def test_b01_the_asset_registry_is_the_frozen_one() -> None:
    """B01 — the registry names the seed variable the Runtime reads."""
    registry = _load(FIXTURES / "v3-media-local-import-acceptance-assets-v1.json")
    assert registry["schemaVersion"] == "v3-media-local-import-acceptance-assets/v1"
    seed = registry["privateSeed"]
    assert seed["environmentVariable"] == "NAVIA_WP_B_SEED_MEDIA"
    assert seed["mustRemainOutsideGitAndPublicEvidence"] is True
    requirements = seed["requirements"]
    assert set(requirements["container"]) == {"mp4", "webm", "matroska"}
    assert requirements["minimumDurationMs"] == 30_000
    assert requirements["maximumDurationMs"] == 300_000
    assert requirements["hasVideoStream"] is True
    assert requirements["hasAudioStream"] is True
    assert requirements["senseVoiceMinimumNonEmptySegments"] == 3
    assert requirements["distinctFrameHashesAtLeast"] == 3
    for asset in registry["assets"]:
        assert asset["minimumAllocatedRatio"] >= 0.95
        assert asset["minimumDistinctFrameHashes"] == 3
        assert asset["minimumNonEmptyTranscriptSegments"] == 3


def test_b01_the_registry_is_read_only_outside_the_repository() -> None:
    """B01 — the registry itself never carries a path."""
    raw = (FIXTURES / "v3-media-local-import-acceptance-assets-v1.json").read_text(
        encoding="utf-8"
    )
    for forbidden in ("/mnt/", "C:\\", "Users", "Desktop"):
        assert forbidden not in raw, forbidden


# --- semantic mutations ------------------------------------------------------


def _valid_store_record() -> dict[str, Any]:
    return {
        "schemaVersion": C.SCHEMA_VERSION,
        "importId": "media_import_" + "a" * 32,
        "taskId": "media_task_" + "b" * 32,
        "sourceIdentity": "portal:bilibili:BV1abc:cid:1",
        "state": "verifying",
        "sequence": 3,
        "byteLength": 1024,
        "uploadedBytes": 1024,
        "declaredMediaType": "video/mp4",
        "dependencyGeneration": "depgen_" + "c" * 64,
        "videoManifestSha256": "1" * 64,
        "visualReceiptSha256": None,
        "barrierPhase": "video_durable",
        "failureCode": None,
        "createdAt": "2026-10-20T00:00:00.000Z",
        "updatedAt": "2026-10-20T00:01:00.000Z",
    }


def test_b01_the_semantic_validator_accepts_a_valid_record() -> None:
    """B01 — the mutations below are refused because THIS is accepted."""
    C.semantic_validate_import(_valid_store_record())


@pytest.mark.parametrize(
    "mutation",
    [
        {"byteLength": 0},
        {"uploadedBytes": 2048},
        {"declaredMediaType": "video/quicktime"},
        {"dependencyGeneration": "depgen_short"},
        {"barrierPhase": "not_a_phase"},
        {"failureCode": "V3_MEDIA_IMPORT_NOT_A_CODE"},
        {"state": "not_a_state"},
        {"sourceIdentity": "not-a-portal-identity"},
        {"videoManifestSha256": "not-a-digest"},
    ],
)
def test_b01_every_mutation_is_refused_by_the_schema_and_the_semantics(
    mutation: dict[str, Any], schemas
) -> None:
    """B01 — no mutation may slip through either gate."""
    record = _valid_store_record()
    record.update(mutation)
    with pytest.raises(ImportError):
        C.semantic_validate_import(record)


@pytest.mark.parametrize(
    "mutation",
    [
        {"byteLength": 0},
        {"declaredMediaType": "video/quicktime"},
        {"dependencyGeneration": "depgen_short"},
        {"barrierPhase": "not_a_phase"},
        {"failureCode": "V3_MEDIA_IMPORT_NOT_A_CODE"},
        {"state": "not_a_state"},
        {"sourceIdentity": "not-a-portal-identity"},
        {"videoManifestSha256": "not-a-digest"},
    ],
)
def test_b01_the_same_mutations_fail_the_frozen_schema(
    mutation: dict[str, Any], schemas
) -> None:
    """B01 — the frozen schema refuses them too, so neither gate is the only one."""
    record = _valid_store_record()
    record.update(mutation)
    validator = _subschema_validator(
        schemas["internal"], "#/$defs/storeRecord", [schemas["internal"]]
    )
    assert list(validator.iter_errors(record)), mutation


def test_b01_a_mutation_only_the_semantics_can_catch_is_refused() -> None:
    """B01 — more uploaded bytes than declared is a SEMANTIC rule.

    The frozen schema can only express the range, so this is exactly the class
    of defect a schema-only gate would let through.
    """
    record = _valid_store_record()
    record["uploadedBytes"] = record["byteLength"] + 1
    with pytest.raises(ImportError):
        C.semantic_validate_import(record)


def test_b01_a_mutated_fixture_still_fails_the_schema() -> None:
    """B01 — the schema refuses a mutated fixture, and the semantic validator
    refuses what the schema cannot express."""
    schemas = {name: _load(path) for name, path in SCHEMA_FILES.items()}
    payload = _load(FIXTURES / "v3-media-local-import-internal-v1-positive.json")
    mutated = copy.deepcopy(payload)
    mutated["storeRecord"]["state"] = "not_a_state"
    validator = _subschema_validator(
        schemas["internal"], "#/$defs/storeRecord", [schemas["internal"]]
    )
    assert list(validator.iter_errors(mutated["storeRecord"]))

    mutated = copy.deepcopy(payload)
    mutated["storeRecord"]["uploadedBytes"] = 999_999_999
    record = mutated["storeRecord"]
    with pytest.raises(ImportError):
        C.semantic_validate_import(record)
