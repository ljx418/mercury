"""The privacy-safe Stage B chapter diagnostic.

It records FACTS about a rejected candidate: shapes, counts, enums and
booleans. It NEVER records a Provider response, a transcript, an evidence
text, a title, a Cookie, a key, a private path, raw media or an evidence id.

Every value it produces is one of:

* an integer (a count, a timestamp, an index),
* a boolean,
* an enum from a frozen vocabulary,
* a key name taken from the FROZEN candidate vocabulary (a model's unknown
  key is counted, never named — a rogue key could carry text).

It is an internal diagnostic: it never changes a public endpoint, a public
schema or a public error envelope.
"""

from __future__ import annotations

from typing import Any

from .quality import (
    assess_chapter_balance,
    chapter_anchors,
    chapter_balance_constraints,
    chapter_balance_requirements,
    substantive_region_count,
)

#: The FROZEN candidate vocabulary. A key outside it is counted, not named.
TOP_LEVEL_KEYS = frozenset({
    "brief", "claims", "chapters", "unresolvedEvidenceConflict",
})
BRIEF_KEYS = frozenset({"text", "evidenceIds"})
CLAIM_KEYS = frozenset({"text", "evidenceIds"})
CHAPTER_KEYS = frozenset({"title", "thesis", "evidenceIds", "relationToPrevious"})
RELATIONS = frozenset({
    "opening", "continuation", "contrast", "cause_effect", "example", "conclusion",
})

#: The frozen chapter bounds (the independent validator's bounds).
MIN_CHAPTERS = 2
MAX_CHAPTERS = 12

#: The frozen claim bounds (the independent validator's bounds).
MIN_CLAIMS = 2
MAX_CLAIMS = 8

#: The frozen normalized text ranges of every candidate text field.
TEXT_RANGES = {
    "brief": (20, 100),
    "claim": (8, 240),
    "chapterTitle": (4, 80),
    "chapterThesis": (8, 500),
}

#: The frozen text TYPE classes.
TEXT_TYPES = frozenset({"absent", "null", "string", "not_a_string"})

#: The frozen normalized text LENGTH buckets.
TEXT_LENGTH_BUCKETS = frozenset({"unknown", "empty", "too_short", "in_range", "too_long"})

#: The frozen evidence-id CONTAINER classes.
EVIDENCE_IDS_CONTAINERS = frozenset({"absent", "null", "list", "not_a_list"})

#: The schema version of the frozen candidate contract block.
CANDIDATE_CONTRACT_SCHEMA = "v3-media-candidate-contract/v1"

#: The frozen shape violation classes.
SHAPE_VIOLATIONS = frozenset({
    "none",
    "not_an_object",
    "top_level_key_set",
    "brief_shape",
    "brief_value_domain",
    "claims_shape",
    "claim_field_set",
    "claim_value_domain",
    "chapters_shape",
    "chapter_count",
    "chapter_field_set",
    "chapter_value_domain",
    "relation_enum",
    "conflict_flag",
})

#: The frozen container classes.
CONTAINER_TYPES = frozenset({"absent", "list", "not_a_list"})


def _key_class(keys: Any, allowed: frozenset[str]) -> dict[str, Any]:
    """The allowlisted classification of a key set.

    The ALLOWED key names may be named (a frozen vocabulary). The UNKNOWN key
    names are only counted: a model may put arbitrary text in a key.
    """
    if not isinstance(keys, (list, tuple, set, frozenset)):
        return {"present": False, "presentCount": 0, "missingCount": 0, "unknownCount": 0}
    names = {str(item) for item in keys}
    return {
        "present": sorted(names & allowed),
        "presentCount": len(names & allowed),
        "missingCount": len(allowed - names),
        "unknownCount": len(names - allowed),
    }


def _field_class(names: set[str], allowed: frozenset[str]) -> str:
    """The class of ONE nested object's key set."""
    if names == set(allowed):
        return "exact"
    if names - set(allowed):
        return "has_unknown_fields"
    return "missing_fields"


def _text_in_range(value: Any, minimum: int, maximum: int) -> bool:
    return isinstance(value, str) and minimum <= len(" ".join(value.split()).strip()) <= maximum


def _evidence_ids_shape(value: Any) -> bool:
    return (
        isinstance(value, list)
        and bool(value)
        and all(isinstance(item, str) and bool(item) for item in value)
    )


def text_type_class(value: Any, present: bool = True) -> str:
    """The privacy-safe TYPE class of ONE text value.

    It is an enum: the text itself is never inspected beyond its type.
    """
    if not present:
        return "absent"
    if value is None:
        return "null"
    if isinstance(value, str):
        return "string"
    return "not_a_string"


def text_length_bucket(value: Any, minimum: int, maximum: int, present: bool = True) -> str:
    """The privacy-safe normalized LENGTH bucket of ONE text value.

    The bucket is a frozen enum: the exact length is never persisted.
    """
    if not present or value is None or not isinstance(value, str):
        return "unknown"
    length = len(" ".join(value.split()).strip())
    if length == 0:
        return "empty"
    if length < minimum:
        return "too_short"
    if length > maximum:
        return "too_long"
    return "in_range"


def evidence_ids_container_class(value: Any, present: bool = True) -> str:
    """The privacy-safe CONTAINER class of ONE evidence-id array."""
    if not present:
        return "absent"
    if value is None:
        return "null"
    if isinstance(value, list):
        return "list" if value else "empty_list"
    return "not_a_list"


def evidence_ids_item_counts(value: Any, known_ids: set[str] | None = None) -> dict[str, int]:
    """The privacy-safe ITEM counts of ONE evidence-id array.

    The counts are the only facts: no id is ever counted by its value.
    """
    if not isinstance(value, list):
        return {
            "evidenceIdsItemCount": 0,
            "evidenceIdsEmptyItemCount": 0,
            "evidenceIdsNonStringItemCount": 0,
            "unknownEvidenceReferenceCount": 0,
        }
    empty = 0
    non_string = 0
    unknown = 0
    for item in value:
        if not isinstance(item, str):
            non_string += 1
            continue
        if not item.strip():
            empty += 1
            continue
        if known_ids is not None and item not in known_ids:
            unknown += 1
    return {
        "evidenceIdsItemCount": len(value),
        "evidenceIdsEmptyItemCount": empty,
        "evidenceIdsNonStringItemCount": non_string,
        "unknownEvidenceReferenceCount": unknown,
    }


def brief_value_domain_diagnostic(brief: Any, known_ids: set[str] | None = None) -> dict[str, Any]:
    """The privacy-safe VALUE-DOMAIN facts of the brief.

    It identifies the failing subdomain with enums and counts only: the text
    type, the normalized length bucket, the evidence-id container class, the
    empty and non-string item counts and the unknown-reference count. It never
    records the text, an evidence id or a Provider value.
    """
    present = isinstance(brief, dict)
    text = brief.get("text") if present else None
    evidence_ids = brief.get("evidenceIds") if present else None
    minimum, maximum = TEXT_RANGES["brief"]
    return {
        "textType": text_type_class(text, present=present),
        "textLengthBucket": text_length_bucket(text, minimum, maximum, present=present),
        "evidenceIdsContainer": evidence_ids_container_class(evidence_ids, present=present),
        **evidence_ids_item_counts(evidence_ids, known_ids),
    }


def collection_value_domain_diagnostic(
    items: Any,
    *,
    text_range: tuple[int, int],
    known_ids: set[str] | None = None,
) -> dict[str, Any]:
    """The privacy-safe VALUE-DOMAIN facts of a claim or chapter collection.

    It follows the same pattern as the brief: the counts of the items that
    break the text domain, the counts that break the evidence-id domain, the
    unknown-reference count and the distinct frozen classes of both.
    """
    values = items if isinstance(items, list) else []
    minimum, maximum = text_range
    text_invalid = 0
    evidence_ids_invalid = 0
    unknown_references = 0
    text_types: list[str] = []
    text_buckets: list[str] = []
    containers: list[str] = []
    for item in values:
        if not isinstance(item, dict):
            text_invalid += 1
            text_types.append("not_a_string")
            text_buckets.append("unknown")
            containers.append("absent")
            continue
        text = item.get("text")
        evidence_ids = item.get("evidenceIds")
        bucket = text_length_bucket(text, minimum, maximum)
        if bucket not in ("in_range",):
            text_invalid += 1
        text_types.append(text_type_class(text))
        text_buckets.append(bucket)
        container = evidence_ids_container_class(evidence_ids)
        containers.append(container)
        counts = evidence_ids_item_counts(evidence_ids, known_ids)
        unknown_references += counts["unknownEvidenceReferenceCount"]
        if container != "list" or counts["evidenceIdsEmptyItemCount"] or counts["evidenceIdsNonStringItemCount"]:
            evidence_ids_invalid += 1
    return {
        "itemCount": len(values),
        "textInvalidItemCount": text_invalid,
        "evidenceIdsInvalidItemCount": evidence_ids_invalid,
        "unknownEvidenceReferenceCount": unknown_references,
        "textTypeClasses": sorted(set(text_types)),
        "textLengthBucketClasses": sorted(set(text_buckets)),
        "evidenceIdsContainerClasses": sorted(set(containers)),
    }


def chapter_value_domain_diagnostic(
    chapters: Any,
    known_ids: set[str] | None = None,
) -> dict[str, Any]:
    """The privacy-safe VALUE-DOMAIN facts of the chapter collection.

    A chapter carries TWO texts with two different frozen ranges, so both are
    reported. The diagnostic names neither of the candidate's own field names:
    a key name of the candidate is never reproduced, only counted.
    """
    values = chapters if isinstance(chapters, list) else []
    name_minimum, name_maximum = TEXT_RANGES["chapterTitle"]
    statement_minimum, statement_maximum = TEXT_RANGES["chapterThesis"]
    name_invalid = 0
    statement_invalid = 0
    evidence_ids_invalid = 0
    unknown_references = 0
    name_buckets: list[str] = []
    statement_buckets: list[str] = []
    containers: list[str] = []
    for item in values:
        if not isinstance(item, dict):
            name_invalid += 1
            statement_invalid += 1
            name_buckets.append("unknown")
            statement_buckets.append("unknown")
            containers.append("absent")
            continue
        name_bucket = text_length_bucket(item.get("title"), name_minimum, name_maximum)
        statement_bucket = text_length_bucket(item.get("thesis"), statement_minimum, statement_maximum)
        if name_bucket != "in_range":
            name_invalid += 1
        if statement_bucket != "in_range":
            statement_invalid += 1
        name_buckets.append(name_bucket)
        statement_buckets.append(statement_bucket)
        evidence_ids = item.get("evidenceIds")
        container = evidence_ids_container_class(evidence_ids)
        containers.append(container)
        counts = evidence_ids_item_counts(evidence_ids, known_ids)
        unknown_references += counts["unknownEvidenceReferenceCount"]
        if container != "list" or counts["evidenceIdsEmptyItemCount"] or counts["evidenceIdsNonStringItemCount"]:
            evidence_ids_invalid += 1
    return {
        "itemCount": len(values),
        "chapterNameInvalidItemCount": name_invalid,
        "chapterStatementInvalidItemCount": statement_invalid,
        "evidenceIdsInvalidItemCount": evidence_ids_invalid,
        "unknownEvidenceReferenceCount": unknown_references,
        "chapterNameLengthBucketClasses": sorted(set(name_buckets)),
        "chapterStatementLengthBucketClasses": sorted(set(statement_buckets)),
        "evidenceIdsContainerClasses": sorted(set(containers)),
    }


def candidate_shape_diagnostic(candidate: Any, evidence: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    """The shape facts of a candidate.

    Candidate text is never recorded. Values are inspected only for the
    frozen type/length domains and non-empty evidence-id array shape.

    EVERY nested object is checked, not only the first one: the brief, EVERY
    claim and EVERY chapter must carry the EXACT frozen key set, and the
    conflict flag must be a REAL boolean. A missing or a null conflict flag is
    a violation: the frozen candidate schema requires it.

    The VALUE-DOMAIN facts identify the failing subdomain of a value-domain
    violation with enums and counts only.
    """
    if not isinstance(candidate, dict):
        return {
            "candidateType": type(candidate).__name__,
            "topLevel": _key_class(None, TOP_LEVEL_KEYS),
            "brief": _key_class(None, BRIEF_KEYS),
            "claims": {"count": 0, "itemShapeClasses": []},
            "chapters": {
                "containerType": "absent",
                "count": 0,
                "fieldSetClasses": [],
                "invalidChapterIndexes": [],
                "invalidRelationCount": 0,
            },
            "conflictFlagType": "absent",
            "shapeViolation": "not_an_object",
        }

    brief = candidate.get("brief")
    claims = candidate.get("claims")
    chapters = candidate.get("chapters")
    conflict = candidate.get("unresolvedEvidenceConflict")

    if isinstance(chapters, list):
        container_type = "list"
    elif chapters is None:
        container_type = "absent"
    else:
        container_type = "not_a_list"

    # EVERY claim is classified, not only the first one.
    claim_classes: list[str] = []
    if isinstance(claims, list):
        for claim in claims:
            if not isinstance(claim, dict):
                claim_classes.append("not_an_object")
                continue
            claim_classes.append(_field_class({str(key) for key in claim.keys()}, CLAIM_KEYS))

    chapter_field_classes: list[str] = []
    invalid_indexes: list[int] = []
    invalid_relations = 0
    if isinstance(chapters, list):
        for index, chapter in enumerate(chapters):
            if not isinstance(chapter, dict):
                chapter_field_classes.append("not_an_object")
                invalid_indexes.append(index)
                continue
            names = {str(key) for key in chapter.keys()}
            field_class = _field_class(names, CHAPTER_KEYS)
            chapter_field_classes.append(field_class)
            if field_class != "exact":
                invalid_indexes.append(index)
            relation = chapter.get("relationToPrevious")
            if not isinstance(relation, str) or relation not in RELATIONS:
                invalid_relations += 1
                if index not in invalid_indexes:
                    invalid_indexes.append(index)

    top = _key_class(list(candidate.keys()), TOP_LEVEL_KEYS)
    brief_class = _key_class(
        list(brief.keys()) if isinstance(brief, dict) else None,
        BRIEF_KEYS,
    )
    known_ids = {
        str(item.get("evidenceId"))
        for item in (evidence or [])
        if isinstance(item, dict) and item.get("evidenceId") is not None
    } or None
    brief_domain = brief_value_domain_diagnostic(brief, known_ids)
    claims_domain = collection_value_domain_diagnostic(
        claims,
        text_range=TEXT_RANGES["claim"],
        known_ids=known_ids,
    )
    chapters_domain = chapter_value_domain_diagnostic(chapters, known_ids=known_ids)

    violation = "none"
    if top["presentCount"] != len(TOP_LEVEL_KEYS) or top["unknownCount"] or top["missingCount"]:
        violation = "top_level_key_set"
    elif not isinstance(brief, dict) or brief_class["unknownCount"] or brief_class["missingCount"]:
        violation = "brief_shape"
    elif (
        not _text_in_range(brief.get("text"), 20, 100)
        or not _evidence_ids_shape(brief.get("evidenceIds"))
        or brief_domain["unknownEvidenceReferenceCount"]
    ):
        violation = "brief_value_domain"
    elif not isinstance(claims, list) or not 2 <= len(claims) <= 8:
        violation = "claims_shape"
    elif any(entry != "exact" for entry in claim_classes):
        violation = "claim_field_set"
    elif any(
        not _text_in_range(claim.get("text"), 8, 240)
        or not _evidence_ids_shape(claim.get("evidenceIds"))
        for claim in claims
    ) or claims_domain["unknownEvidenceReferenceCount"]:
        violation = "claim_value_domain"
    elif container_type != "list":
        violation = "chapters_shape"
    elif not MIN_CHAPTERS <= len(chapters) <= MAX_CHAPTERS:
        violation = "chapter_count"
    elif any(entry != "exact" for entry in chapter_field_classes):
        violation = "chapter_field_set"
    elif any(
        not _text_in_range(chapter.get("title"), 4, 80)
        or not _text_in_range(chapter.get("thesis"), 8, 500)
        or not _evidence_ids_shape(chapter.get("evidenceIds"))
        for chapter in chapters
    ) or chapters_domain["unknownEvidenceReferenceCount"]:
        violation = "chapter_value_domain"
    elif invalid_relations:
        violation = "relation_enum"
    elif not isinstance(conflict, bool):
        # The conflict flag must be a REAL boolean: a missing or a null flag
        # is a violation, never a default.
        violation = "conflict_flag"

    return {
        "candidateType": "object",
        "topLevel": top,
        "brief": {
            **brief_class,
            "valueDomain": brief_domain,
        },
        "claims": {
            "count": len(claims) if isinstance(claims, list) else 0,
            "itemShapeClasses": claim_classes,
            "valueDomain": claims_domain,
        },
        "chapters": {
            "containerType": container_type,
            "count": len(chapters) if isinstance(chapters, list) else 0,
            "fieldSetClasses": chapter_field_classes,
            "invalidChapterIndexes": invalid_indexes,
            "invalidRelationCount": invalid_relations,
            "valueDomain": chapters_domain,
        },
        "conflictFlagType": (
            "boolean" if isinstance(conflict, bool)
            else ("absent" if conflict is None else "not_a_boolean")
        ),
        "shapeViolation": violation,
    }


def evidence_capacity_diagnostic(evidence: list[dict[str, Any]]) -> dict[str, Any]:
    """The temporal capacity of the evidence catalog.

    A frame and the OCR text of the SAME frame share a start timestamp. That
    does not by itself prevent two strictly increasing anchors, so the
    diagnostic reports the DISTINCT starts, not the item count.
    """
    starts: list[int] = []
    for item in evidence or []:
        try:
            starts.append(int(item["timestampStartMs"]))
        except (KeyError, TypeError, ValueError):
            continue
    counts: dict[int, int] = {}
    for value in starts:
        counts[value] = counts.get(value, 0) + 1
    duplicate_groups = [multiplicity for multiplicity in counts.values() if multiplicity > 1]
    distinct = sorted(counts)
    return {
        "evidenceCount": len(starts),
        "distinctStartCount": len(distinct),
        "duplicateStartGroupCount": len(duplicate_groups),
        "maximumDuplicateStartMultiplicity": max(duplicate_groups) if duplicate_groups else 0,
        "firstStartMs": distinct[0] if distinct else None,
        "lastStartMs": distinct[-1] if distinct else None,
        "hasTwoStrictlyIncreasingAnchors": len(distinct) >= 2,
    }


def anchor_diagnostic(candidate: Any, evidence: list[dict[str, Any]]) -> dict[str, Any]:
    """The chapter anchor facts of a candidate against the evidence catalog.

    The anchor VALUES are counts and booleans only: no evidence id and no
    text ever enters the diagnostic.
    """
    by_id = {
        str(item.get("evidenceId")): item
        for item in (evidence or [])
        if isinstance(item, dict) and item.get("evidenceId") is not None
    }
    chapters = candidate.get("chapters") if isinstance(candidate, dict) else None
    anchors: list[int] = []
    unknown_reference = False
    if isinstance(chapters, list):
        for chapter in chapters:
            ids = chapter.get("evidenceIds") if isinstance(chapter, dict) else None
            if not isinstance(ids, list) or not ids:
                unknown_reference = True
                continue
            starts = []
            for evidence_id in ids:
                item = by_id.get(str(evidence_id))
                if item is None:
                    unknown_reference = True
                    continue
                try:
                    starts.append(int(item["timestampStartMs"]))
                except (KeyError, TypeError, ValueError):
                    unknown_reference = True
            if starts:
                anchors.append(min(starts))
    duplicate_anchors = len(anchors) - len(set(anchors))
    non_increasing = 0
    for index in range(1, len(anchors)):
        if anchors[index] <= anchors[index - 1]:
            non_increasing += 1
    first_ids = chapters[0].get("evidenceIds") if isinstance(chapters, list) and chapters and isinstance(chapters[0], dict) else None
    last_ids = chapters[-1].get("evidenceIds") if isinstance(chapters, list) and chapters and isinstance(chapters[-1], dict) else None
    first_evidence = evidence[0].get("evidenceId") if evidence else None
    last_evidence = evidence[-1].get("evidenceId") if evidence else None
    return {
        "chapterAnchorCount": len(anchors),
        "duplicateAnchorCount": duplicate_anchors,
        "nonIncreasingAnchorCount": non_increasing,
        "unknownEvidenceReference": unknown_reference,
        "firstChapterIncludesBoundaryEvidence": (
            isinstance(first_ids, list) and first_evidence is not None
            and str(first_evidence) in {str(item) for item in first_ids}
        ),
        "lastChapterIncludesBoundaryEvidence": (
            isinstance(last_ids, list) and last_evidence is not None
            and str(last_evidence) in {str(item) for item in last_ids}
        ),
    }


def repair_diagnostic(*, repair_attempt_count: int, final_outcome: str) -> dict[str, Any]:
    """The bounded repair outcome. An enum and a count."""
    return {
        "repairAttemptCount": int(repair_attempt_count),
        "finalOutcome": str(final_outcome),
    }


def chapter_balance_diagnostic(candidate: Any, evidence: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    """The privacy-safe chapter-balance facts of a candidate.

    The assessment is the SHARED owner: the adapter's pre-validator and the
    independent validator may never disagree about a balance fact. The
    projection carries a chapter count, two ratios, a region count and a
    stable violation class/code. It never carries a title, a thesis, a claim
    text, an evidence id, a Provider identity, a path, a prompt, a response,
    a secret or raw media.
    """
    items = [item for item in (evidence or []) if isinstance(item, dict)]
    if not items:
        assessment = assess_chapter_balance(
            anchors=[],
            span_start_ms=0,
            span_end_ms=0,
            substantive_region_count=0,
        )
        return assessment.as_diagnostic()
    starts = []
    ends = []
    for item in items:
        try:
            starts.append(int(item["timestampStartMs"]))
            ends.append(int(item["timestampEndMs"]))
        except (KeyError, TypeError, ValueError):
            continue
    if not starts:
        assessment = assess_chapter_balance(
            anchors=[],
            span_start_ms=0,
            span_end_ms=0,
            substantive_region_count=0,
        )
        return assessment.as_diagnostic()
    span_start = min(starts)
    span_end = max(ends)
    assessment = assess_chapter_balance(
        anchors=chapter_anchors(candidate, items),
        span_start_ms=span_start,
        span_end_ms=span_end,
        substantive_region_count=substantive_region_count(
            items,
            span_start_ms=span_start,
            span_end_ms=span_end,
        ),
    )
    return assessment.as_diagnostic()


def quality_diagnostic(
    candidate: Any,
    evidence: list[dict[str, Any]] | None = None,
    *,
    repair_attempt_count: int = 0,
) -> dict[str, Any]:
    """The privacy-safe QUALITY facts of a rejected candidate.

    The brief coverage and the unresolved conflict are recorded as counts,
    region names, length buckets and stable reasons. No text, no evidence id,
    no path, no Provider identity, no prompt, no response, no secret and no
    raw media ever enters the diagnostic, and the facts NEVER change the
    disposition of the candidate.
    """
    from .quality import brief_coverage_diagnostic, conflict_diagnostic

    items = list(evidence or [])
    coverage: dict[str, Any] = {
        "eligibleClaimCount": 0,
        "testedCombinationCounts": {"2": 0, "3": 0},
        "coveredRegionCount": 0,
        "requiredRegionCount": 0,
        "substantiveRegions": [],
        "textLengthBuckets": [],
        "maxCoveredRegionCount": 0,
        "fullRegionSubsetCount": 0,
        "fullRegionSubsetCountAfterLengthFilter": 0,
        "reason": "not_evaluated",
    }
    if items:
        try:
            coverage = brief_coverage_diagnostic(
                candidate,
                items,
                task_id="",
                task_revision=0,
                media_duration_ms=0,
            )
        except Exception:
            coverage = {
                "eligibleClaimCount": 0,
                "testedCombinationCounts": {"2": 0, "3": 0},
                "coveredRegionCount": 0,
                "requiredRegionCount": 0,
                "substantiveRegions": [],
                "textLengthBuckets": [],
                "maxCoveredRegionCount": 0,
                "fullRegionSubsetCount": 0,
                "fullRegionSubsetCountAfterLengthFilter": 0,
                "reason": "not_evaluated",
            }
    return {
        "briefCoverage": coverage,
        "unresolvedConflict": conflict_diagnostic(
            candidate,
            repair_attempt_count=repair_attempt_count,
        ),
    }


def build_stage_b_diagnostic(
    *,
    stage: str,
    failure_code: str | None,
    candidate: Any = None,
    evidence: list[dict[str, Any]] | None = None,
    repair_attempt_count: int = 0,
    final_outcome: str = "fail_closed",
    provider_outbound_http_attempts: int | None = None,
) -> dict[str, Any]:
    """The complete redacted diagnostic of one validation stage.

    `provider_outbound_http_attempts` is the ACTUAL number of outbound
    Provider HTTP attempts the adapter made, counted at the request
    boundary. It is a COUNT only: no response text, no prompt, no evidence
    id, no path and no secret ever enters the diagnostic.
    """
    diagnostic: dict[str, Any] = {
        "schemaVersion": "v3-media-grounded-chapter-diagnostic/v1",
        "stage": str(stage),
        "failureCode": str(failure_code) if failure_code else None,
        "candidateShape": candidate_shape_diagnostic(candidate),
        "evidenceCapacity": evidence_capacity_diagnostic(evidence or []),
        "anchors": anchor_diagnostic(candidate, evidence or []),
        "chapterBalance": chapter_balance_diagnostic(candidate, evidence or []),
        "quality": quality_diagnostic(
            candidate,
            evidence or [],
            repair_attempt_count=repair_attempt_count,
        ),
        "repair": repair_diagnostic(
            repair_attempt_count=repair_attempt_count,
            final_outcome=final_outcome,
        ),
        "providerOutboundHttpAttempts": (
            int(provider_outbound_http_attempts)
            if isinstance(provider_outbound_http_attempts, int)
            and not isinstance(provider_outbound_http_attempts, bool)
            and provider_outbound_http_attempts >= 0
            else None
        ),
    }
    return diagnostic


def candidate_contract_trustworthy(candidate: Any) -> bool:
    """TRUE when the STRUCTURE of a candidate may be handed back to the Provider.

    The trust is about the STRUCTURE only: the exact frozen key vocabulary
    and the safe container types. A value-domain defect (a too long text, an
    unknown evidence reference) does NOT break the trust: the candidate is
    the Provider's own authorized derivative and it is the best semantic
    context a repair can carry.

    A candidate with an UNKNOWN key or an invalid container type is NOT
    trusted: it may hold arbitrary Provider text, so the caller must fall
    back to the trusted partial context.
    """
    if not isinstance(candidate, dict):
        return False
    if set(candidate.keys()) != set(TOP_LEVEL_KEYS):
        return False
    brief = candidate.get("brief")
    if not isinstance(brief, dict) or set(brief.keys()) != set(BRIEF_KEYS):
        return False
    if not _trusted_evidence_id_array(brief.get("evidenceIds")):
        return False
    if not isinstance(brief.get("text"), str):
        return False
    claims = candidate.get("claims")
    if not isinstance(claims, list):
        return False
    for claim in claims:
        if not isinstance(claim, dict) or set(claim.keys()) != set(CLAIM_KEYS):
            return False
        if not _trusted_evidence_id_array(claim.get("evidenceIds")) or not isinstance(claim.get("text"), str):
            return False
    chapters = candidate.get("chapters")
    if not isinstance(chapters, list):
        return False
    for chapter in chapters:
        if not isinstance(chapter, dict) or set(chapter.keys()) != set(CHAPTER_KEYS):
            return False
        if not _trusted_evidence_id_array(chapter.get("evidenceIds")):
            return False
        if not isinstance(chapter.get("title"), str) or not isinstance(chapter.get("thesis"), str):
            return False
        if not isinstance(chapter.get("relationToPrevious"), str):
            return False
    if not isinstance(candidate.get("unresolvedEvidenceConflict"), bool):
        return False
    return True


def _trusted_evidence_id_array(value: Any) -> bool:
    """Structural trust permits only a list of strings.

    Empty strings and unknown identifiers remain value-domain defects that the
    same Provider may repair. Nested objects and other non-string values are
    untrusted structure and must never be reflected into a repair request.
    """
    return isinstance(value, list) and all(isinstance(item, str) for item in value)


def candidate_contract_requirements(
    *,
    evidence: list[dict[str, Any]],
    chapter_count: int | None = None,
    target_claim_count: int | None = None,
    target_chapter_count: int | None = None,
) -> dict[str, Any]:
    """The COMPLETE frozen V2.1 candidate requirements.

    It is the SINGLE owner of the candidate contract: the initial synthesis,
    the shape regeneration, the temporal repair, the balance regeneration and
    `repair_v2` all compose THIS block, so a targeted repair may never
    regress an invariant it does not address.

    The block is PURE and it is the ONLY place where the contract is
    written. It covers the exact key sets, every text length range, the
    evidence-id array shape and membership, the claim and chapter counts, the
    relation enum, the real boolean conflict flag, the first and the last
    boundary evidence, the strictly increasing chapter anchors and the
    chapter-balance constraints that are APPLICABLE to this candidate.
    """
    ids = [
        str(item.get("evidenceId"))
        for item in (evidence or [])
        if isinstance(item, dict) and item.get("evidenceId") is not None
    ]
    first_id = ids[0] if ids else None
    last_id = ids[-1] if ids else None
    region_count = 0
    if ids:
        items = [item for item in (evidence or []) if isinstance(item, dict)]
        try:
            region_count = substantive_region_count(
                items,
                span_start_ms=min(int(item["timestampStartMs"]) for item in items),
                span_end_ms=max(int(item["timestampEndMs"]) for item in items),
            )
        except (KeyError, TypeError, ValueError):
            region_count = 0
    claims_count: dict[str, Any] = {"minimum": MIN_CLAIMS, "maximum": MAX_CLAIMS}
    chapters_count: dict[str, Any] = {"minimum": MIN_CHAPTERS, "maximum": MAX_CHAPTERS}
    if target_claim_count is not None:
        claims_count["target"] = int(target_claim_count)
    if target_chapter_count is not None:
        chapters_count["target"] = int(target_chapter_count)
    requirements = [
        "输出必须严格只含 brief、claims、chapters、unresolvedEvidenceConflict 四个顶层字段。",
        "brief 只含 text 与 evidenceIds；text 为 20 至 100 个 Unicode 字符；evidenceIds 为非空字符串数组。",
        f"claims 为 {MIN_CLAIMS} 至 {MAX_CLAIMS} 条；每条只含 text 与 evidenceIds；text 为 8 至 240 个 Unicode 字符；evidenceIds 为非空字符串数组。",
        f"chapters 为 {MIN_CHAPTERS} 至 {MAX_CHAPTERS} 章；每章只含 title、thesis、evidenceIds、relationToPrevious；title 为 4 至 80 个 Unicode 字符；thesis 为 8 至 500 个 Unicode 字符；evidenceIds 为非空字符串数组。",
        "relationToPrevious 只能是 opening、continuation、contrast、cause_effect、example、conclusion 之一。",
        "unresolvedEvidenceConflict 必须是真正的布尔值，不得省略或置空。",
        "所有 evidenceId 必须逐字复制 evidenceIndex 中的值，禁止创造、改写或缩写 ID；只能引用 evidenceIndex 中存在的证据。",
    ]
    if first_id is not None:
        requirements.append(f"第一章 evidenceIds 必须包含最早证据 {first_id}。")
    if last_id is not None:
        requirements.append(f"最后一章 evidenceIds 必须包含最晚证据 {last_id}。")
    requirements.append("每章最早 evidenceId 的 startMs 必须严格递增。")
    requirements.extend(chapter_balance_requirements(chapter_count, region_count))
    requirements.append("不得输出 Markdown、内部推理、外部知识、原始媒体、路径、Cookie 或密钥。")
    return {
        "schemaVersion": CANDIDATE_CONTRACT_SCHEMA,
        "outputKeys": {
            "top": sorted(TOP_LEVEL_KEYS),
            "brief": sorted(BRIEF_KEYS),
            "claim": sorted(CLAIM_KEYS),
            "chapter": sorted(CHAPTER_KEYS),
        },
        "textRanges": {
            "brief": list(TEXT_RANGES["brief"]),
            "claim": list(TEXT_RANGES["claim"]),
            "chapterTitle": list(TEXT_RANGES["chapterTitle"]),
            "chapterThesis": list(TEXT_RANGES["chapterThesis"]),
        },
        "counts": {"claims": claims_count, "chapters": chapters_count},
        "evidenceIds": {
            "mustBe": "a non-empty array of strings",
            "mustReferenceOnly": "the evidenceIds of evidenceIndex",
        },
        "relations": sorted(RELATIONS),
        "conflictFlag": {"type": "boolean", "required": True},
        "boundaryEvidence": {"firstEvidenceId": first_id, "lastEvidenceId": last_id},
        "anchorOrder": "strictly increasing",
        "chapterBalance": chapter_balance_constraints(
            int(chapter_count) if chapter_count is not None else 0,
            region_count,
        ),
        "requirements": requirements,
    }


def stage_b_candidate_shape_violation(
    candidate: Any,
    evidence: list[dict[str, Any]] | None = None,
) -> str | None:
    """The frozen shape violation of a candidate, or None when it conforms.

    The adapter uses it to ENFORCE the shape before a candidate is handed to
    the independent validator. The validator stays authoritative: this check
    never accepts a candidate, it only refuses a malformed one earlier.
    """
    diagnostic = candidate_shape_diagnostic(candidate, evidence)
    violation = diagnostic.get("shapeViolation")
    return None if violation == "none" else str(violation)
