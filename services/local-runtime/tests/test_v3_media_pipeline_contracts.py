from __future__ import annotations

import copy
import hashlib
import json
from datetime import datetime
from pathlib import Path

import jsonschema
import pytest


ROOT = Path(__file__).resolve().parents[3]
CONTRACTS = ROOT / "docs/active/project/contracts"
FIXTURES = ROOT / "docs/active/project/fixtures"


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


TRANSCRIPT_SCHEMA = load_json(CONTRACTS / "v3_media_transcript_execution_v2.schema.json")
CAPTURE_SCHEMA = load_json(CONTRACTS / "v3_media_capture_stream_v1.schema.json")
POSITIVE = load_json(FIXTURES / "v3-media-pipeline-observability-positive.json")
VISION_SCHEMA = load_json(CONTRACTS / "v3_media_vision_evidence_v1.schema.json")
OUTLINE_SCHEMA = load_json(CONTRACTS / "v3_media_outline_taskstore_v1.schema.json")
OUTLINE_SCHEMA_V2 = load_json(CONTRACTS / "v3_media_outline_taskstore_v2.schema.json")
VISION_OUTLINE_POSITIVE = load_json(FIXTURES / "v3-media-vision-outline-positive.json")
OUTLINE_V2_POSITIVE = load_json(FIXTURES / "v3-media-outline-taskstore-v2-positive.json")
OUTLINE_V1_SHA256 = "75f88ea0c366132ba9a2008038062c6984a19295b048698a32746140153438f4"


def validate_transcript_semantics(value: dict) -> None:
    task_id = value["taskId"]
    assert value["audioBinding"]["taskId"] == task_id
    progress = value["progress"]
    assert [item["sequence"] for item in progress] == list(range(len(progress)))
    assert all(a["completedMs"] <= b["completedMs"] for a, b in zip(progress, progress[1:]))
    assert all(a["percent"] <= b["percent"] for a, b in zip(progress, progress[1:]))
    coverage = value["coverage"]
    expected = coverage["coveredSpeechDurationMs"] / coverage["speechDurationMs"]
    assert coverage["coveredSpeechDurationMs"] <= coverage["speechDurationMs"]
    assert coverage["coverageRatio"] == pytest.approx(expected, abs=1e-9)
    result = value["result"]
    if result["status"] == "succeeded":
        assert result["segmentCount"] == coverage["speechIntervalCount"]
        assert coverage["coveredSpeechDurationMs"] == coverage["speechDurationMs"]
        assert coverage["coverageRatio"] == 1.0
        assert coverage["passed"] is True
        assert result["transcriptId"] is not None
        assert result["segmentCount"] > 0
        assert result["contentSha256"] is not None
        assert result["failureCode"] is None


def validate_capture_semantics(value: dict) -> None:
    assert value["grant"]["taskId"] == value["taskId"]
    issued = datetime.fromisoformat(value["grant"]["issuedAt"].replace("Z", "+00:00"))
    expires = datetime.fromisoformat(value["grant"]["expiresAt"].replace("Z", "+00:00"))
    assert 0 < (expires - issued).total_seconds() <= 30
    chunks = value["chunks"]
    assert [item["sequence"] for item in chunks] == list(range(len(chunks)))
    progress = value["progress"]
    assert [item["sequence"] for item in progress] == list(range(len(progress)))
    assert all(a["capturedMs"] <= b["capturedMs"] for a, b in zip(progress, progress[1:]))
    assert all(a["byteLength"] <= b["byteLength"] for a, b in zip(progress, progress[1:]))


def validate_vision_semantics(value: dict) -> None:
    task_id = value["taskId"]
    frames = value["frames"]
    frame_by_id = {item["evidenceId"]: item for item in frames}
    assert len(frame_by_id) == len(frames)
    assert all(item["taskId"] == task_id for item in frames)
    selected = [item for item in frames if item["selected"]]
    assert len(selected) <= value["samplingPolicy"]["selectedEvidenceLimit"]
    assert len(value["visionObservations"]) <= value["samplingPolicy"]["cloudVisionFrameLimit"]
    consent = value["consent"]
    if value["visionObservations"]:
        assert consent["state"] == "granted"
        assert consent["decisionId"] is not None
        assert consent["grantedAt"] is not None
        assert consent["authorizedDispatchCount"] == len(value["visionObservations"])
    revoked_at = (
        datetime.fromisoformat(consent["revokedAt"].replace("Z", "+00:00"))
        if consent["revokedAt"]
        else None
    )
    for item in value["ocrObservations"]:
        assert item["taskId"] == task_id
        assert item["frameEvidenceId"] in frame_by_id
    for item in value["visionObservations"]:
        assert item["taskId"] == task_id
        assert item["frameEvidenceId"] in frame_by_id
        assert frame_by_id[item["frameEvidenceId"]]["selected"] is True
        assert item["consentDecisionId"] == consent["decisionId"]
        assert item["dispatchSequence"] < consent["authorizedDispatchCount"]
        uploaded_at = datetime.fromisoformat(item["uploadedAt"].replace("Z", "+00:00"))
        if revoked_at is not None:
            assert uploaded_at <= revoked_at
    cleanup = value["cleanup"]
    assert cleanup["candidateFrameCount"] == len(frames)
    assert cleanup["retainedEvidenceFrameCount"] == sum(
        item["retention"] == "evidence_until_task_delete" for item in frames
    )
    assert cleanup["deletedNonEvidenceFrameCount"] == sum(
        item["retention"] == "delete_at_terminal" for item in frames
    )


def validate_outline_semantics(value: dict) -> None:
    task = value["task"]
    task_id = task["taskId"]
    outline = value["outline"]
    assert outline["taskId"] == task_id
    assert outline["taskRevision"] == task["revision"]
    catalog = value["evidenceCatalog"]
    catalog_ids = {item["evidenceId"] for item in catalog}
    assert len(catalog_ids) == len(catalog)
    assert all(item["taskId"] == task_id for item in catalog)
    assert all(item["timestampStartMs"] <= item["timestampEndMs"] for item in catalog)
    sections = outline["sections"]
    section_by_id = {item["sectionId"]: item for item in sections}
    assert len(section_by_id) == len(sections)
    assert all(item["startMs"] < item["endMs"] for item in sections)
    assert all(set(item["evidenceIds"]) <= catalog_ids for item in sections)
    timeline = value["timeline"]
    assert [item["sequence"] for item in timeline] == list(range(len(timeline)))
    assert all(item["outlineId"] == outline["outlineId"] for item in timeline)
    assert all(item["sectionId"] in section_by_id for item in timeline)
    assert all(item["startMs"] < item["endMs"] for item in timeline)
    assert all(set(item["evidenceIds"]) <= catalog_ids for item in timeline)
    assert all(a["endMs"] <= b["startMs"] for a, b in zip(timeline, timeline[1:]))
    mindmap = value["mindmap"]
    assert mindmap["taskId"] == task_id
    assert mindmap["outlineId"] == outline["outlineId"]
    nodes = mindmap["nodes"]
    node_ids = {item["nodeId"] for item in nodes}
    assert len(node_ids) == len(nodes)
    roots = [item for item in nodes if item["parentNodeId"] is None]
    assert len(roots) == 1
    assert all(item["parentNodeId"] is None or item["parentNodeId"] in node_ids for item in nodes)
    assert all(item["sectionId"] is None or item["sectionId"] in section_by_id for item in nodes)
    assert all(set(item["evidenceIds"]) <= catalog_ids for item in nodes)
    receipt = value["transactionReceipt"]
    assert receipt["taskId"] == task_id
    assert receipt["committedRevision"] == task["revision"]
    assert receipt["committedRevision"] == receipt["expectedRevision"] + 1


def validate_outline_v2_semantics(value: dict) -> None:
    task = value["task"]
    task_id = task["taskId"]
    receipt = value["transactionReceipt"]
    assert receipt["taskId"] == task_id
    assert receipt["committedRevision"] == task["revision"]
    assert receipt["committedRevision"] == receipt["expectedRevision"] + 1

    catalog = value["evidenceCatalog"]
    catalog_ids = {item["evidenceId"] for item in catalog}
    assert len(catalog_ids) == len(catalog)
    assert all(item["taskId"] == task_id for item in catalog)
    assert all(item["timestampStartMs"] <= item["timestampEndMs"] for item in catalog)

    outline = value["outline"]
    timeline = value["timeline"]
    mindmap = value["mindmap"]
    if task["state"] in {"ready", "degraded"}:
        assert catalog and outline is not None and timeline and mindmap is not None
        assert receipt["outlinePublished"] is True
        assert receipt["projectionPublished"] is True
        assert receipt["projectionEvidenceClosurePassed"] is True
        assert receipt["terminalFailureCode"] is None if task["state"] == "ready" else receipt["terminalFailureCode"] is not None

        assert outline["taskId"] == task_id
        assert outline["taskRevision"] == task["revision"]
        sections = outline["sections"]
        section_by_id = {item["sectionId"]: item for item in sections}
        assert len(section_by_id) == len(sections)
        assert all(item["startMs"] < item["endMs"] for item in sections)
        assert all(set(item["evidenceIds"]) <= catalog_ids for item in sections)

        assert [item["sequence"] for item in timeline] == list(range(len(timeline)))
        assert all(item["outlineId"] == outline["outlineId"] for item in timeline)
        assert all(item["sectionId"] in section_by_id for item in timeline)
        assert all(item["startMs"] < item["endMs"] for item in timeline)
        assert all(set(item["evidenceIds"]) <= catalog_ids for item in timeline)
        assert all(a["endMs"] <= b["startMs"] for a, b in zip(timeline, timeline[1:]))

        assert mindmap["taskId"] == task_id
        assert mindmap["outlineId"] == outline["outlineId"]
        nodes = mindmap["nodes"]
        node_ids = {item["nodeId"] for item in nodes}
        assert len(node_ids) == len(nodes)
        assert len([item for item in nodes if item["parentNodeId"] is None]) == 1
        assert all(item["parentNodeId"] is None or item["parentNodeId"] in node_ids for item in nodes)
        assert all(item["sectionId"] is None or item["sectionId"] in section_by_id for item in nodes)
        assert all(set(item["evidenceIds"]) <= catalog_ids for item in nodes)
    else:
        assert task["state"] in {"blocked", "failed", "cancelled"}
        assert outline is None and timeline == [] and mindmap is None
        assert receipt["outlinePublished"] is False
        assert receipt["projectionPublished"] is False
        assert receipt["projectionEvidenceClosurePassed"] is False
        assert receipt["terminalFailureCode"] is not None


def test_pipeline_schemas_and_positive_fixture() -> None:
    jsonschema.Draft202012Validator.check_schema(TRANSCRIPT_SCHEMA)
    jsonschema.Draft202012Validator.check_schema(CAPTURE_SCHEMA)
    jsonschema.Draft202012Validator(TRANSCRIPT_SCHEMA).validate(POSITIVE["transcriptExecution"])
    jsonschema.Draft202012Validator(CAPTURE_SCHEMA).validate(POSITIVE["captureStream"])
    validate_transcript_semantics(POSITIVE["transcriptExecution"])
    validate_capture_semantics(POSITIVE["captureStream"])


def test_vision_and_outline_schemas_and_positive_fixture() -> None:
    jsonschema.Draft202012Validator.check_schema(VISION_SCHEMA)
    jsonschema.Draft202012Validator.check_schema(OUTLINE_SCHEMA)
    vision = VISION_OUTLINE_POSITIVE["visionEvidence"]
    outline = VISION_OUTLINE_POSITIVE["outlineTaskStore"]
    jsonschema.Draft202012Validator(VISION_SCHEMA).validate(vision)
    jsonschema.Draft202012Validator(OUTLINE_SCHEMA).validate(outline)
    validate_vision_semantics(vision)
    validate_outline_semantics(outline)


def test_outline_v2_schema_meta_v1_immutable_and_terminal_positives() -> None:
    assert hashlib.sha256((CONTRACTS / "v3_media_outline_taskstore_v1.schema.json").read_bytes()).hexdigest() == OUTLINE_V1_SHA256
    jsonschema.Draft202012Validator.check_schema(OUTLINE_SCHEMA_V2)
    validator = jsonschema.Draft202012Validator(OUTLINE_SCHEMA_V2)
    for state in ("ready", "degraded", "blocked"):
        candidate = OUTLINE_V2_POSITIVE[state]
        validator.validate(candidate)
        validate_outline_v2_semantics(candidate)


@pytest.mark.parametrize("state", ["ready", "degraded"])
def test_outline_v2_rejects_publishable_terminal_without_real_evidence_or_projection(state: str) -> None:
    for field, replacement in (("evidenceCatalog", []), ("outline", None), ("timeline", []), ("mindmap", None)):
        candidate = copy.deepcopy(OUTLINE_V2_POSITIVE[state])
        candidate[field] = replacement
        with pytest.raises(AssertionError):
            validate_outline_v2_semantics(candidate)


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("outline", OUTLINE_V2_POSITIVE["ready"]["outline"]),
        ("timeline", OUTLINE_V2_POSITIVE["ready"]["timeline"]),
        ("mindmap", OUTLINE_V2_POSITIVE["ready"]["mindmap"]),
    ],
)
def test_outline_v2_rejects_blocked_terminal_with_fabricated_projection(field: str, value: object) -> None:
    candidate = copy.deepcopy(OUTLINE_V2_POSITIVE["blocked"])
    candidate[field] = copy.deepcopy(value)
    with pytest.raises(AssertionError):
        validate_outline_v2_semantics(candidate)


def test_outline_v2_rejects_cross_task_unknown_evidence_time_and_projection_drift() -> None:
    candidate = copy.deepcopy(OUTLINE_V2_POSITIVE["ready"])
    candidate["evidenceCatalog"][0]["taskId"] = "media_task_00000000000000000000000000000000"
    with pytest.raises(AssertionError):
        validate_outline_v2_semantics(candidate)

    candidate = copy.deepcopy(OUTLINE_V2_POSITIVE["ready"])
    candidate["outline"]["sections"][0]["evidenceIds"].append("mev_00000000000000000000000000000000")
    with pytest.raises(AssertionError):
        validate_outline_v2_semantics(candidate)

    candidate = copy.deepcopy(OUTLINE_V2_POSITIVE["ready"])
    candidate["outline"]["sections"][0]["startMs"] = candidate["outline"]["sections"][0]["endMs"]
    with pytest.raises(AssertionError):
        validate_outline_v2_semantics(candidate)

    candidate = copy.deepcopy(OUTLINE_V2_POSITIVE["ready"])
    candidate["mindmap"]["outlineId"] = "outline_00000000000000000000000000000000"
    with pytest.raises(AssertionError):
        validate_outline_v2_semantics(candidate)


@pytest.mark.parametrize("relative_ref", ["/private/evidence.json", "../evidence.json", "evidence/../../private.json"])
def test_outline_v2_schema_rejects_artifact_path_escape(relative_ref: str) -> None:
    candidate = copy.deepcopy(OUTLINE_V2_POSITIVE["ready"])
    candidate["evidenceCatalog"][0]["relativeArtifactRef"] = relative_ref
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.Draft202012Validator(OUTLINE_SCHEMA_V2).validate(candidate)


@pytest.mark.parametrize(
    ("state", "field", "value"),
    [
        ("ready", "outlinePublished", False),
        ("ready", "projectionPublished", False),
        ("ready", "terminalFailureCode", "OUTLINE_RESPONSE_INVALID"),
        ("degraded", "terminalFailureCode", None),
        ("blocked", "outlinePublished", True),
        ("blocked", "projectionPublished", True),
        ("blocked", "terminalFailureCode", None),
    ],
)
def test_outline_v2_rejects_terminal_receipt_mismatch(state: str, field: str, value: object) -> None:
    candidate = copy.deepcopy(OUTLINE_V2_POSITIVE[state])
    candidate["transactionReceipt"][field] = value
    with pytest.raises(AssertionError):
        validate_outline_v2_semantics(candidate)


@pytest.mark.parametrize(
    ("path", "value"),
    [
        (("audioBinding", "relativeArtifactRef"), "../../outside.wav"),
        (("modelProfile", "modelId"), "faster-whisper-tiny"),
        (("modelProfile", "cloudUpload"), True),
        (("modelProfile", "qualityStatus"), "production_qualified"),
    ],
)
def test_transcript_schema_rejects_contract_drift(path: tuple[str, str], value: object) -> None:
    candidate = copy.deepcopy(POSITIVE["transcriptExecution"])
    candidate[path[0]][path[1]] = value
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.Draft202012Validator(TRANSCRIPT_SCHEMA).validate(candidate)


def test_transcript_semantics_reject_non_monotonic_progress_and_false_coverage() -> None:
    candidate = copy.deepcopy(POSITIVE["transcriptExecution"])
    candidate["progress"][1]["percent"] = -1
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.Draft202012Validator(TRANSCRIPT_SCHEMA).validate(candidate)
    candidate = copy.deepcopy(POSITIVE["transcriptExecution"])
    candidate["coverage"]["coverageRatio"] = 0.91
    with pytest.raises(AssertionError):
        validate_transcript_semantics(candidate)


def test_transcript_semantics_reject_vad_srt_count_mismatch() -> None:
    candidate = copy.deepcopy(POSITIVE["transcriptExecution"])
    candidate["result"]["segmentCount"] += 1
    with pytest.raises(AssertionError):
        validate_transcript_semantics(candidate)


@pytest.mark.parametrize("field", ["ticket", "streamId", "tabId", "absolutePath"])
def test_capture_schema_rejects_private_fields(field: str) -> None:
    candidate = copy.deepcopy(POSITIVE["captureStream"])
    candidate["grant"][field] = "private"
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.Draft202012Validator(CAPTURE_SCHEMA).validate(candidate)


def test_capture_schema_requires_zero_residuals() -> None:
    candidate = copy.deepcopy(POSITIVE["captureStream"])
    candidate["stop"]["residualRawAudioCount"] = 1
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.Draft202012Validator(CAPTURE_SCHEMA).validate(candidate)


def test_capture_semantics_reject_replay_like_sequence_and_long_ttl() -> None:
    candidate = copy.deepcopy(POSITIVE["captureStream"])
    candidate["chunks"].append(copy.deepcopy(candidate["chunks"][0]))
    with pytest.raises(AssertionError):
        validate_capture_semantics(candidate)
    candidate = copy.deepcopy(POSITIVE["captureStream"])
    candidate["grant"]["expiresAt"] = "2026-10-06T13:01:00Z"
    with pytest.raises(AssertionError):
        validate_capture_semantics(candidate)


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("rawVideoUploadAllowed", True),
        ("candidateFrameLimit", 48),
        ("cloudVisionFrameLimit", 24),
        ("maxDimensionPx", 4096),
    ],
)
def test_vision_schema_rejects_budget_expansion(field: str, value: object) -> None:
    candidate = copy.deepcopy(VISION_OUTLINE_POSITIVE["visionEvidence"])
    candidate["samplingPolicy"][field] = value
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.Draft202012Validator(VISION_SCHEMA).validate(candidate)


def test_vision_semantics_reject_unselected_or_revoked_upload() -> None:
    candidate = copy.deepcopy(VISION_OUTLINE_POSITIVE["visionEvidence"])
    candidate["visionObservations"][0]["frameEvidenceId"] = candidate["frames"][1]["evidenceId"]
    with pytest.raises(AssertionError):
        validate_vision_semantics(candidate)


@pytest.mark.parametrize(
    ("container", "field", "value"),
    [
        ("consent", "postRevocationDispatchCount", 1),
        ("consent", "consentCheckedPerDispatch", False),
        ("visionObservations", "consentValidAtDispatch", False),
    ],
)
def test_vision_schema_rejects_unauthorized_dispatch_receipts(
    container: str, field: str, value: object
) -> None:
    candidate = copy.deepcopy(VISION_OUTLINE_POSITIVE["visionEvidence"])
    target = candidate[container][0] if container == "visionObservations" else candidate[container]
    target[field] = value
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.Draft202012Validator(VISION_SCHEMA).validate(candidate)
    candidate = copy.deepcopy(VISION_OUTLINE_POSITIVE["visionEvidence"])
    candidate["consent"]["state"] = "revoked"
    candidate["consent"]["revokedAt"] = "2026-10-06T14:00:30Z"
    candidate["consent"]["outboundBarrierAt"] = "2026-10-06T14:00:31Z"
    with pytest.raises(AssertionError):
        validate_vision_semantics(candidate)


def test_vision_schema_rejects_path_escape_and_private_fields() -> None:
    candidate = copy.deepcopy(VISION_OUTLINE_POSITIVE["visionEvidence"])
    candidate["frames"][0]["relativeArtifactRef"] = "../../private/frame.png"
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.Draft202012Validator(VISION_SCHEMA).validate(candidate)
    candidate = copy.deepcopy(VISION_OUTLINE_POSITIVE["visionEvidence"])
    candidate["visionObservations"][0]["apiKey"] = "secret"
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.Draft202012Validator(VISION_SCHEMA).validate(candidate)


@pytest.mark.parametrize("status", ["ready_for_knowledge_import", "imported", "complete"])
def test_outline_schema_rejects_premature_v4_knowledge_status(status: str) -> None:
    candidate = copy.deepcopy(VISION_OUTLINE_POSITIVE["outlineTaskStore"])
    candidate["task"]["knowledgeImportStatus"] = status
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.Draft202012Validator(OUTLINE_SCHEMA).validate(candidate)


def test_outline_semantics_reject_cross_task_and_unclosed_evidence() -> None:
    candidate = copy.deepcopy(VISION_OUTLINE_POSITIVE["outlineTaskStore"])
    candidate["evidenceCatalog"][0]["taskId"] = "media_task_00000000000000000000000000000000"
    with pytest.raises(AssertionError):
        validate_outline_semantics(candidate)
    candidate = copy.deepcopy(VISION_OUTLINE_POSITIVE["outlineTaskStore"])
    candidate["outline"]["sections"][0]["evidenceIds"].append(
        "mev_00000000000000000000000000000000"
    )
    with pytest.raises(AssertionError):
        validate_outline_semantics(candidate)


def test_outline_semantics_reject_projection_drift_and_revision_replay() -> None:
    candidate = copy.deepcopy(VISION_OUTLINE_POSITIVE["outlineTaskStore"])
    candidate["mindmap"]["outlineId"] = "outline_00000000000000000000000000000000"
    with pytest.raises(AssertionError):
        validate_outline_semantics(candidate)
    candidate = copy.deepcopy(VISION_OUTLINE_POSITIVE["outlineTaskStore"])
    candidate["transactionReceipt"]["expectedRevision"] = 7
    with pytest.raises(AssertionError):
        validate_outline_semantics(candidate)


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("unresolvedEvidenceReferenceCount", 1),
        ("crossTaskEvidenceReferenceCount", 1),
        ("projectionEvidenceClosurePassed", False),
    ],
)
def test_outline_schema_rejects_unclosed_evidence_receipt(field: str, value: object) -> None:
    candidate = copy.deepcopy(VISION_OUTLINE_POSITIVE["outlineTaskStore"])
    candidate["transactionReceipt"][field] = value
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.Draft202012Validator(OUTLINE_SCHEMA).validate(candidate)
