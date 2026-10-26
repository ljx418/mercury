from __future__ import annotations

import hashlib
import itertools
import math
import re
from copy import deepcopy
from dataclasses import dataclass
from typing import Any

from ..task_store import MediaTaskStoreError


_SUBSTANTIVE_KINDS = {"transcript", "ocr_block", "vision_caption"}
_RELATIONS = {"opening", "continuation", "contrast", "cause_effect", "example", "conclusion"}
_PLACEHOLDER = re.compile(r"^(?:无|暂无|未知|未识别|没有|none|unknown|n/?a)[。.!！]?\s*$", re.I)


def _text(value: object) -> str:
    return " ".join(str(value or "").split()).strip()


def _compact(value: object) -> str:
    return re.sub(r"\s+", "", str(value or "")).lower()


def _stable_id(prefix: str, *parts: object) -> str:
    digest = hashlib.sha256("\x1f".join(str(part) for part in parts).encode("utf-8")).hexdigest()
    return f"{prefix}_{digest[:16]}"


def _fail(code: str, message: str, status: int = 502) -> None:
    raise MediaTaskStoreError(code, message, status=status)


@dataclass(frozen=True)
class EvidenceSpan:
    span_start_ms: int
    span_end_ms: int
    media_duration_ms: int
    regions: tuple[dict[str, Any], ...]

    @property
    def substantive_regions(self) -> set[str]:
        return {item["name"] for item in self.regions if item["availability"] == "substantive"}

    @property
    def source_coverage_ratio(self) -> float:
        return min(1.0, self.span_end_ms / self.media_duration_ms)


class EvidenceSpanAnalyzer:
    """Derives deterministic source thirds and availability from direct evidence."""

    @staticmethod
    def analyze(evidence: list[dict[str, Any]], media_duration_ms: int) -> EvidenceSpan:
        if not evidence:
            _fail("V3510B_EVIDENCE_UNCLOSED", "Grounded comprehension requires direct evidence.", 409)
        start = min(int(item["timestampStartMs"]) for item in evidence)
        end = max(int(item["timestampEndMs"]) for item in evidence)
        if start < 0 or end <= start or media_duration_ms < end:
            _fail("V3510B_EVIDENCE_UNCLOSED", "Evidence span is invalid.", 409)
        width = end - start
        boundaries = [start, start + width // 3, start + (2 * width) // 3, end]
        regions = EvidenceSpanAnalyzer.regions(evidence, start, end)
        return EvidenceSpan(start, end, media_duration_ms, tuple(regions))

    @staticmethod
    def regions(evidence: list[dict[str, Any]], start: int, end: int) -> list[dict[str, Any]]:
        """The source thirds of an evidence span and their availability.

        It is PURE: the same evidence span always yields the same regions.
        The adapter and the independent validator share it, so the
        substantive-region availability of a candidate can never differ
        between them.
        """
        width = end - start
        boundaries = [start, start + width // 3, start + (2 * width) // 3, end]
        names = ("opening", "middle", "ending")
        regions: list[dict[str, Any]] = []
        for index, name in enumerate(names):
            region_start = boundaries[index]
            region_end = boundaries[index + 1]
            ids = []
            for item in evidence:
                item_start = int(item["timestampStartMs"])
                item_end = int(item["timestampEndMs"])
                intersects = item_start <= region_end and item_end > region_start if index == 2 else item_start < region_end and item_end > region_start
                content = _text(item.get("text"))
                substantive = (
                    item.get("kind") in _SUBSTANTIVE_KINDS
                    and len(_compact(content)) >= 8
                    and not _PLACEHOLDER.match(content)
                )
                if intersects and substantive:
                    ids.append(str(item["evidenceId"]))
            regions.append({
                "name": name,
                "startMs": region_start,
                "endMs": region_end,
                "availability": "substantive" if ids else "empty_or_unavailable",
                "evidenceIds": list(dict.fromkeys(ids)),
            })
        return regions

    @staticmethod
    def max_start_concentration(starts: list[int], span: EvidenceSpan) -> float:
        return _max_start_concentration(starts, span.span_start_ms, span.span_end_ms)

    @staticmethod
    def max_chapter_span_ratio(chapters: list[dict[str, Any]], span: EvidenceSpan) -> float:
        windows = [(int(chapter["startMs"]), int(chapter["endMs"])) for chapter in chapters]
        return _max_chapter_span_ratio(windows, span.span_start_ms, span.span_end_ms)


def substantive_region_count(evidence: list[dict[str, Any]], *, span_start_ms: int, span_end_ms: int) -> int:
    """The number of SUBSTANTIVE regions of an evidence span.

    It is the availability fact the balance rules need. It is a COUNT: no
    region name, no evidence id and no text ever enters it.
    """
    regions = EvidenceSpanAnalyzer.regions(evidence, int(span_start_ms), int(span_end_ms))
    return sum(1 for item in regions if item["availability"] == "substantive")


#: The FROZEN chapter-balance thresholds. This module is the SOLE owner of
#: the chapter-balance semantics: the independent validator AND the adapter's
#: pre-validator call the SAME assessment, so they may never disagree about a
#: balance fact.
_BALANCE_CONCENTRATION_MIN_CHAPTERS = 6
_BALANCE_SPAN_MIN_CHAPTERS = 4
_BALANCE_MAX_SPAN_RATIO = 0.60
_BALANCE_MIN_SUBSTANTIVE_REGIONS = 3
_BALANCE_VIOLATION_CODE = "V3510B_CHAPTER_IMBALANCE"

#: The frozen violation classes. A class is a stable enum, never a message.
BALANCE_VIOLATION_CLASSES = ("chapter_start_concentration", "chapter_span_ratio")

#: The frozen message of each class. The CODE is the contract; the message is
#: not.
_BALANCE_VIOLATION_MESSAGES = {
    "chapter_start_concentration": "Chapter starts are excessively clustered.",
    "chapter_span_ratio": "A chapter consumes too much of the source span.",
}


def _max_start_concentration(starts: list[int], span_start_ms: int, span_end_ms: int) -> float:
    """The concentration of the chapter starts in the tightest time window."""
    if not starts:
        return 0.0
    window = max(1, math.ceil((span_end_ms - span_start_ms) * 0.2))
    maximum = max(sum(1 for other in starts if start <= other < start + window) for start in starts)
    return maximum / len(starts)


def _max_chapter_span_ratio(windows: list[tuple[int, int]], span_start_ms: int, span_end_ms: int) -> float:
    """The largest chapter window as a ratio of the evidence span."""
    if not windows:
        return 0.0
    width = max(1, span_end_ms - span_start_ms)
    return max((end - start) / width for start, end in windows)


def chapter_anchors(candidate: Any, evidence: list[dict[str, Any]]) -> list[int]:
    """The chapter start anchors of a candidate.

    The anchor of a chapter is the MINIMUM `timestampStartMs` of the evidence
    it cites: the SAME rule the independent validator applies. An unknown
    evidence id is ignored here; the shape and the anchor checks refuse it
    before any balance fact is derived from it.
    """
    by_id = {
        str(item.get("evidenceId")): item
        for item in (evidence or [])
        if isinstance(item, dict) and item.get("evidenceId") is not None
    }
    chapters = candidate.get("chapters") if isinstance(candidate, dict) else None
    anchors: list[int] = []
    if not isinstance(chapters, list):
        return anchors
    for chapter in chapters:
        ids = chapter.get("evidenceIds") if isinstance(chapter, dict) else None
        if not isinstance(ids, list) or not ids:
            continue
        starts = []
        for evidence_id in ids:
            item = by_id.get(str(evidence_id))
            if item is None:
                continue
            try:
                starts.append(int(item["timestampStartMs"]))
            except (KeyError, TypeError, ValueError):
                continue
        if starts:
            anchors.append(min(starts))
    return anchors


@dataclass(frozen=True)
class ChapterBalanceAssessment:
    """The structural balance facts of a candidate's chapters.

    It carries COUNTS, RATIOS, a boolean and a stable class/code only. It
    never carries a title, a thesis, a claim text, an evidence id, a Provider
    identity, a path, a prompt, a response, a secret or raw media.
    """

    chapter_count: int
    concentration: float
    max_span_ratio: float
    substantive_region_count: int
    violation_class: str | None
    violation_code: str | None

    @property
    def ok(self) -> bool:
        """TRUE when no balance rule is violated."""
        return self.violation_code is None

    def as_diagnostic(self) -> dict[str, Any]:
        """The privacy-safe projection of the assessment."""
        return {
            "chapterCount": int(self.chapter_count),
            "startConcentration": round(float(self.concentration), 6),
            "maximumChapterSpanRatio": round(float(self.max_span_ratio), 6),
            "substantiveRegionCount": int(self.substantive_region_count),
            "violationClass": self.violation_class,
            "violationCode": self.violation_code,
        }


def assess_chapter_balance(
    *,
    anchors: list[int],
    span_start_ms: int,
    span_end_ms: int,
    substantive_region_count: int,
) -> ChapterBalanceAssessment:
    """The ONE chapter-balance assessment. Pure and deterministic.

    The chapter windows are the anchor intervals, exactly as the independent
    validator derives them: a chapter ends where the next chapter starts and
    the last chapter ends at the evidence span.
    """
    starts = [int(value) for value in anchors]
    count = len(starts)
    windows: list[tuple[int, int]] = []
    for index, start in enumerate(starts):
        end = starts[index + 1] if index + 1 < count else int(span_end_ms)
        windows.append((start, end))
    concentration = _max_start_concentration(starts, int(span_start_ms), int(span_end_ms))
    max_span = _max_chapter_span_ratio(windows, int(span_start_ms), int(span_end_ms))
    violation_class: str | None = None
    if count >= _BALANCE_CONCENTRATION_MIN_CHAPTERS:
        allowed = math.ceil(count / 2) / count
        if concentration > allowed:
            violation_class = "chapter_start_concentration"
    if violation_class is None and count >= _BALANCE_SPAN_MIN_CHAPTERS:
        if (
            int(substantive_region_count) >= _BALANCE_MIN_SUBSTANTIVE_REGIONS
            and max_span > _BALANCE_MAX_SPAN_RATIO
        ):
            violation_class = "chapter_span_ratio"
    return ChapterBalanceAssessment(
        chapter_count=count,
        concentration=concentration,
        max_span_ratio=max_span,
        substantive_region_count=int(substantive_region_count),
        violation_class=violation_class,
        violation_code=_BALANCE_VIOLATION_CODE if violation_class is not None else None,
    )


def chapter_balance_constraints(
    chapter_count: int,
    substantive_region_count: int = _BALANCE_MIN_SUBSTANTIVE_REGIONS,
) -> dict[str, Any]:
    """The FROZEN constraints of the balance rules for a chapter count.

    They are the explicit constraints a regeneration request states. They are
    thresholds, never a formula and never a value of the content.
    """
    count = max(0, int(chapter_count))
    region_count = max(0, int(substantive_region_count))
    return {
        "maximumStartConcentration": (math.ceil(count / 2) / count) if count else 0.0,
        "maximumChapterSpanRatio": _BALANCE_MAX_SPAN_RATIO,
        "minimumChaptersForConcentrationRule": _BALANCE_CONCENTRATION_MIN_CHAPTERS,
        "minimumChaptersForSpanRule": _BALANCE_SPAN_MIN_CHAPTERS,
        "minimumSubstantiveRegionsForSpanRule": _BALANCE_MIN_SUBSTANTIVE_REGIONS,
        "startConcentrationRuleApplies": count >= _BALANCE_CONCENTRATION_MIN_CHAPTERS,
        "chapterSpanRuleApplies": (
            count >= _BALANCE_SPAN_MIN_CHAPTERS
            and region_count >= _BALANCE_MIN_SUBSTANTIVE_REGIONS
        ),
    }


def chapter_balance_requirements(
    chapter_count: int | None,
    substantive_region_count: int = _BALANCE_MIN_SUBSTANTIVE_REGIONS,
) -> list[str]:
    """The balance requirement statements of a candidate request.

    A KNOWN chapter count states ONLY the rules that apply to it: a rule
    below its applicability threshold is never stated as active. An UNKNOWN
    chapter count (the initial generation, where the Provider chooses the
    count) states the rules together with their applicability condition.
    """
    if chapter_count is None:
        return [
            "章节起点必须按时间严格递增，并且在时间轴上分散。",
            f"章节数达到 {_BALANCE_CONCENTRATION_MIN_CHAPTERS} 章或更多时，任一 20% 时间窗内的章节起点数不得超过章节数除以 2 向上取整。",
            f"章节数达到 {_BALANCE_SPAN_MIN_CHAPTERS} 章或更多、且开头中段结尾均有实质证据时，单章跨度不得超过总证据跨度的 {_BALANCE_MAX_SPAN_RATIO}。",
        ]
    constraints = chapter_balance_constraints(chapter_count, substantive_region_count)
    statements = ["章节起点必须按时间严格递增。"]
    if constraints["startConcentrationRuleApplies"]:
        statements.append(
            f"任一 20% 时间窗内的章节起点数不得超过 {math.ceil(int(chapter_count) / 2)}。"
        )
    if constraints["chapterSpanRuleApplies"]:
        statements.append(
            f"单章跨度不得超过总证据跨度的 {constraints['maximumChapterSpanRatio']:.6g}。"
        )
    return statements


@dataclass(frozen=True)
class PreparedCandidate:
    by_id: dict[str, dict[str, Any]]
    span: EvidenceSpan
    evidence_regions: dict[str, set[str]]
    claims: tuple[dict[str, Any], ...]
    chapters: tuple[dict[str, Any], ...]
    failures: tuple[str, ...]
    concentration: float
    max_chapter_span_ratio: float


@dataclass(frozen=True)
class BriefComposition:
    candidate: dict[str, Any]
    source_claim_indexes: tuple[int, ...]


def _is_raw_transcript_excerpt(text: str, evidence: list[dict[str, Any]]) -> bool:
    compact_text = _compact(text)
    for item in evidence:
        if item.get("kind") != "transcript":
            continue
        source = _compact(item.get("text"))
        if len(source) >= 20 and (
            compact_text == source or source.startswith(compact_text) or compact_text in source
        ):
            return True
    return False


def _prepare_candidate(
    candidate: dict[str, Any],
    evidence: list[dict[str, Any]],
    *,
    task_id: str,
    task_revision: int,
    media_duration_ms: int,
) -> PreparedCandidate:
    if not isinstance(candidate, dict) or set(candidate) != {"brief", "claims", "chapters", "unresolvedEvidenceConflict"}:
        _fail("V3510B_PROVIDER_RESPONSE_INVALID", "Grounded provider fields are invalid.")
    by_id = {str(item["evidenceId"]): item for item in evidence}
    if len(by_id) != len(evidence):
        _fail("V3510B_EVIDENCE_UNCLOSED", "Evidence identifiers are not unique.", 409)
    span = EvidenceSpanAnalyzer.analyze(evidence, media_duration_ms)
    evidence_regions: dict[str, set[str]] = {item: set() for item in by_id}
    for region in span.regions:
        for evidence_id in region["evidenceIds"]:
            evidence_regions[evidence_id].add(region["name"])

    raw_claims = candidate.get("claims")
    if not isinstance(raw_claims, list) or not 2 <= len(raw_claims) <= 8:
        _fail("V3510B_PROVIDER_RESPONSE_INVALID", "Claim count is invalid.")
    claims: list[dict[str, Any]] = []
    seen_claims: set[str] = set()
    for index, raw in enumerate(raw_claims):
        if not isinstance(raw, dict) or set(raw) != {"text", "evidenceIds"}:
            _fail("V3510B_PROVIDER_RESPONSE_INVALID", "Claim fields are invalid.")
        text = _text(raw.get("text"))
        if not 8 <= len(text) <= 240:
            _fail("V3510B_PROVIDER_RESPONSE_INVALID", "Claim text length is invalid.")
        normalized = _compact(text)
        if normalized in seen_claims:
            _fail("V3510B_CLAIM_DUPLICATE", "Duplicate claims are not allowed.")
        seen_claims.add(normalized)
        ids = _ids(raw.get("evidenceIds"), by_id, "V3510B_CLAIM_EVIDENCE_UNCLOSED")
        claims.append({
            "claimId": _stable_id("claim", task_id, task_revision, index, text, *ids),
            "text": text,
            "evidenceIds": ids,
            "regions": _regions_for(ids, evidence_regions),
        })

    raw_chapters = candidate.get("chapters")
    if not isinstance(raw_chapters, list) or not 2 <= len(raw_chapters) <= 12:
        _fail("V3510B_PROVIDER_RESPONSE_INVALID", "Chapter count is invalid.")
    chapters: list[dict[str, Any]] = []
    prior_start = -1
    for index, raw in enumerate(raw_chapters):
        if not isinstance(raw, dict) or set(raw) != {"title", "thesis", "evidenceIds", "relationToPrevious"}:
            _fail("V3510B_PROVIDER_RESPONSE_INVALID", "Chapter fields are invalid.")
        title = _text(raw.get("title"))
        thesis = _text(raw.get("thesis"))
        relation = str(raw.get("relationToPrevious") or "")
        if not 4 <= len(title) <= 80 or not 8 <= len(thesis) <= 500 or relation not in _RELATIONS:
            _fail("V3510B_PROVIDER_RESPONSE_INVALID", "Chapter content is invalid.")
        ids = _ids(raw.get("evidenceIds"), by_id, "V3510B_EVIDENCE_UNCLOSED")
        start_ms = min(int(by_id[item]["timestampStartMs"]) for item in ids)
        if start_ms <= prior_start:
            _fail("V3510B_CHAPTER_TIME_INVALID", "Chapter starts must strictly increase.")
        prior_start = start_ms
        chapters.append({
            "chapterId": _stable_id("chapter", task_id, task_revision, index, start_ms, title),
            "order": index,
            "title": title,
            "thesis": thesis,
            "startMs": start_ms,
            "endMs": 0,
            "evidenceIds": ids,
            "relationToPrevious": relation,
        })
    if chapters[0]["startMs"] != span.span_start_ms:
        _fail("V3510B_CHAPTER_TIME_INVALID", "The first chapter must start at the evidence span.")
    for index, chapter in enumerate(chapters):
        chapter["endMs"] = chapters[index + 1]["startMs"] if index + 1 < len(chapters) else span.span_end_ms
        if chapter["endMs"] <= chapter["startMs"]:
            _fail("V3510B_CHAPTER_TIME_INVALID", "Chapter intervals are invalid.")
        if not any(
            int(by_id[item]["timestampStartMs"]) < chapter["endMs"]
            and int(by_id[item]["timestampEndMs"]) > chapter["startMs"]
            for item in chapter["evidenceIds"]
        ):
            _fail("V3510B_CHAPTER_TIME_INVALID", "Chapter evidence does not intersect its interval.")

    failures: list[str] = []
    substantive = span.substantive_regions
    chapter_regions = set().union(*(_regions_for(item["evidenceIds"], evidence_regions) for item in chapters))
    if not substantive.issubset(chapter_regions):
        failures.append("V3510B_CHAPTER_COVERAGE_INSUFFICIENT")
    if span.source_coverage_ratio < 0.90:
        failures.append("V3510B_ENDING_EVIDENCE_MISSING")
    if candidate["unresolvedEvidenceConflict"] is True:
        failures.append("V3510B_EVIDENCE_CONFLICT_UNRESOLVED")
    elif candidate["unresolvedEvidenceConflict"] is not False:
        _fail("V3510B_PROVIDER_RESPONSE_INVALID", "Conflict disclosure flag is invalid.")

    starts = [item["startMs"] for item in chapters]
    # The SHARED chapter-balance owner: the adapter's pre-validator calls the
    # SAME assessment, so the two may never disagree about a balance fact.
    balance = assess_chapter_balance(
        anchors=starts,
        span_start_ms=span.span_start_ms,
        span_end_ms=span.span_end_ms,
        substantive_region_count=len(substantive),
    )
    if balance.violation_code is not None:
        _fail(
            balance.violation_code,
            _BALANCE_VIOLATION_MESSAGES[str(balance.violation_class)],
        )
    concentration = balance.concentration
    max_span = balance.max_span_ratio
    return PreparedCandidate(
        by_id=by_id,
        span=span,
        evidence_regions=evidence_regions,
        claims=tuple(claims),
        chapters=tuple(chapters),
        failures=tuple(failures),
        concentration=concentration,
        max_chapter_span_ratio=max_span,
    )


def compose_brief_from_validated_claims(
    candidate: dict[str, Any],
    evidence: list[dict[str, Any]],
    *,
    task_id: str,
    task_revision: int,
    media_duration_ms: int,
) -> BriefComposition | None:
    """Select a deterministic, evidence-closed brief without adding words."""

    prepared = _prepare_candidate(
        candidate,
        evidence,
        task_id=task_id,
        task_revision=task_revision,
        media_duration_ms=media_duration_ms,
    )
    # Brief coverage is the one limitation this function can remove: the
    # claims and chapters have already passed the independent validator, and
    # the composer only selects their existing words/evidence. Every other
    # limitation remains outside this helper's authority.
    if set(prepared.failures) - {"V3510B_BRIEF_COVERAGE_INSUFFICIENT"}:
        return None
    substantive = prepared.span.substantive_regions
    eligible = [
        (index, claim)
        for index, claim in enumerate(prepared.claims)
        if claim["regions"] and not _is_raw_transcript_excerpt(claim["text"], evidence)
    ]
    choices: list[tuple[tuple[int, int, tuple[int, ...]], str, list[str], tuple[int, ...]]] = []
    for size in (2, 3):
        for group in itertools.combinations(eligible, size):
            indexes = tuple(item[0] for item in group)
            claims = [item[1] for item in group]
            regions = set().union(*(set(item["regions"]) for item in claims))
            if not substantive.issubset(regions):
                continue
            text = "；".join(item["text"] for item in claims)
            if not 20 <= len(text) <= 100 or _is_raw_transcript_excerpt(text, evidence):
                continue
            evidence_ids = list(dict.fromkeys(
                evidence_id for item in claims for evidence_id in item["evidenceIds"]
            ))
            choices.append(((-len(regions & substantive), len(text), indexes), text, evidence_ids, indexes))
    if not choices:
        return None
    _, text, evidence_ids, indexes = min(choices, key=lambda item: item[0])
    composed = deepcopy(candidate)
    composed["brief"] = {"text": text, "evidenceIds": evidence_ids}
    return BriefComposition(composed, indexes)


def _text_length_bucket(length: int) -> str:
    """The frozen length bucket of a composed text. It is an enum, not a value."""
    if length < 20:
        return "under-20"
    if length < 40:
        return "20-39"
    if length <= 80:
        return "40-80"
    return "over-80"


def brief_coverage_diagnostic(
    candidate: dict[str, Any],
    evidence: list[dict[str, Any]],
    *,
    task_id: str,
    task_revision: int,
    media_duration_ms: int,
) -> dict[str, Any]:
    """The STRUCTURAL facts of a brief that could not cover every region.

    It records counts, region NAMES, length BUCKETS and a stable reason. It
    NEVER records the brief text, a claim text, an evidence id, a path, a
    Provider identity, a prompt, a response, a secret or raw media, and it
    NEVER changes the disposition of the candidate: the frozen 2..3
    claim-reference limit and every other threshold stay exactly as they are.
    """
    try:
        prepared = _prepare_candidate(
            candidate,
            evidence,
            task_id=task_id,
            task_revision=task_revision,
            media_duration_ms=media_duration_ms,
        )
    except MediaTaskStoreError:
        return {
            "eligibleClaimCount": 0,
            "testedCombinationCounts": {"2": 0, "3": 0},
            "coveredRegionCount": 0,
            "requiredRegionCount": 0,
            "substantiveRegions": [],
            "textLengthBuckets": [],
            "maxCoveredRegionCount": 0,
            "fullRegionSubsetCount": 0,
            "fullRegionSubsetCountAfterLengthFilter": 0,
            "reason": "candidate_not_preparable",
        }
    substantive = sorted(prepared.span.substantive_regions)
    eligible = [
        (index, claim)
        for index, claim in enumerate(prepared.claims)
        if claim["regions"] and not _is_raw_transcript_excerpt(claim["text"], evidence)
    ]
    tested = {"2": 0, "3": 0}
    covered: set[str] = set()
    buckets: list[str] = []
    # The PARTIAL coverage: the largest number of substantive regions that
    # ANY tested subset reached. It is tracked SEPARATELY from the valid
    # full-subset count, so a diagnostic answers WHY the coverage failed
    # instead of only reporting zero.
    max_covered_region_count = 0
    # The subsets that cover EVERY required region, before and after the
    # frozen length rule.
    full_region_subset_count = 0
    full_region_subset_count_after_length = 0
    for size in (2, 3):
        for group in itertools.combinations(eligible, size):
            tested[str(size)] += 1
            regions = set().union(*(set(item[1]["regions"]) for item in group))
            overlapping = regions & set(substantive)
            max_covered_region_count = max(max_covered_region_count, len(overlapping))
            if not set(substantive).issubset(regions):
                continue
            full_region_subset_count += 1
            text = "；".join(item[1]["text"] for item in group)
            if not 20 <= len(text) <= 100 or _is_raw_transcript_excerpt(text, evidence):
                continue
            full_region_subset_count_after_length += 1
            covered |= overlapping
            buckets.append(_text_length_bucket(len(text)))
    if covered:
        reason = "valid_claim_subset_exists"
    elif not eligible:
        reason = "no_eligible_claims"
    elif full_region_subset_count == 0:
        reason = "no_full_region_subset"
    else:
        reason = "length_rule_rejected_all"
    return {
        "eligibleClaimCount": len(eligible),
        "testedCombinationCounts": tested,
        "coveredRegionCount": len(covered & set(substantive)),
        "requiredRegionCount": len(substantive),
        "substantiveRegions": substantive,
        "textLengthBuckets": sorted(set(buckets)),
        "maxCoveredRegionCount": max_covered_region_count,
        "fullRegionSubsetCount": full_region_subset_count,
        "fullRegionSubsetCountAfterLengthFilter": full_region_subset_count_after_length,
        "reason": reason,
    }


def conflict_diagnostic(candidate: dict[str, Any], *, repair_attempt_count: int = 0) -> dict[str, Any]:
    """The STRUCTURAL facts of an unresolved evidence conflict.

    It records the BOOLEAN conflict outcome, the BOUNDED repair attempt
    count and a stable terminal reason. It NEVER records the conflicting
    texts, the evidence ids, a path, a Provider identity, a prompt, a
    response, a secret or raw media, and it NEVER forces the flag to false
    and NEVER publishes a rejected result.
    """
    disclosed = candidate.get("unresolvedEvidenceConflict") if isinstance(candidate, dict) else None
    attempts = max(0, min(8, int(repair_attempt_count or 0)))
    if disclosed is True:
        reason = "unresolved_conflict_disclosed"
    elif disclosed is False:
        reason = "no_conflict_disclosed"
    else:
        reason = "conflict_flag_absent_or_invalid"
    return {
        "conflictDisclosed": disclosed if isinstance(disclosed, bool) else None,
        "repairAttemptCount": attempts,
        "repairAttemptBound": 8,
        "reason": reason,
    }


def validate_grounded_comprehension(
    candidate: dict[str, Any],
    evidence: list[dict[str, Any]],
    *,
    task_id: str,
    task_revision: int,
    source_identity: str,
    evidence_catalog_sha256: str,
    media_duration_ms: int,
    receipt: dict[str, Any],
    schema_version: str = "v3-media-grounded-comprehension/v2",
    brief_origin: str = "provider",
    source_claim_indexes: tuple[int, ...] = (),
    provider_receipt_extras: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Validate a provider candidate and return a V2 or V2.1 derivative.

    V2 derivative: receipt contains the original 4 fields (`providerId`,
    `modelId`, `outboundDerivedTextSha256`, `requestCount`) and the upload
    counters. V2.1 derivative additionally records the B-5 task-level Provider
    lock fields (`endpointClass`, `structureMode`, `attemptId`, `latencyMs`,
    `requestSha256`, `responseSha256`, `finishReason`). The extras are only
    honored when `schema_version` ends with `/v2.1`; otherwise the V2 byte
    layout is preserved (no drift across revisions). Single-task single-Provider
    is enforced by `service.py`; this validator only records what `synthesis.py`
    passed in via `provider_receipt_extras`.
    """

    if schema_version not in {
        "v3-media-grounded-comprehension/v2",
        "v3-media-grounded-comprehension/v2.1",
    }:
        _fail("V3510B_PROVIDER_RESPONSE_INVALID", "Grounded schema version is invalid.")
    prepared = _prepare_candidate(
        candidate,
        evidence,
        task_id=task_id,
        task_revision=task_revision,
        media_duration_ms=media_duration_ms,
    )
    by_id = prepared.by_id
    span = prepared.span
    evidence_regions = prepared.evidence_regions
    claims = list(prepared.claims)
    chapters = list(prepared.chapters)

    brief = candidate.get("brief")
    if not isinstance(brief, dict) or set(brief) != {"text", "evidenceIds"}:
        _fail("V3510B_PROVIDER_RESPONSE_INVALID", "Brief fields are invalid.")
    brief_text = _text(brief.get("text"))
    if not 20 <= len(brief_text) <= 100:
        _fail("V3510B_BRIEF_LENGTH_INVALID", "Brief must contain 20-100 Unicode characters.")
    if _is_raw_transcript_excerpt(brief_text, evidence):
        _fail("V3510B_BRIEF_RAW_PREFIX", "Brief cannot be a raw transcript excerpt.")
    brief_ids = _ids(brief.get("evidenceIds"), by_id, "V3510B_EVIDENCE_UNCLOSED")
    brief_regions = _regions_for(brief_ids, evidence_regions)
    failures = list(prepared.failures)
    substantive = span.substantive_regions
    if not substantive.issubset(set(brief_regions)):
        failures.append("V3510B_BRIEF_COVERAGE_INSUFFICIENT")

    if brief_origin not in {"provider", "deterministic_claim_composer"}:
        _fail("V3510B_PROVIDER_RESPONSE_INVALID", "Brief origin is invalid.")
    source_claim_ids: list[str] = []
    if brief_origin == "provider":
        if source_claim_indexes:
            _fail("V3510B_PROVIDER_RESPONSE_INVALID", "Provider brief cannot cite source claims.")
    else:
        if not 2 <= len(source_claim_indexes) <= 3 or len(set(source_claim_indexes)) != len(source_claim_indexes):
            _fail("V3510B_PROVIDER_RESPONSE_INVALID", "Composed brief source claims are invalid.")
        if any(index < 0 or index >= len(claims) for index in source_claim_indexes):
            _fail("V3510B_PROVIDER_RESPONSE_INVALID", "Composed brief cited an unknown source claim.")
        source_claim_ids = [claims[index]["claimId"] for index in source_claim_indexes]

    normalized_receipt = _receipt(receipt, schema_version=schema_version, extras=provider_receipt_extras)
    return {
        "schemaVersion": schema_version,
        "binding": {
            "taskId": task_id,
            "taskRevision": task_revision,
            "sourceIdentity": source_identity,
            "evidenceCatalogSha256": evidence_catalog_sha256,
            "mediaDurationMs": media_duration_ms,
            "spanStartMs": span.span_start_ms,
            "spanEndMs": span.span_end_ms,
        },
        "brief": {
            "text": brief_text,
            "evidenceIds": brief_ids,
            "regions": brief_regions,
            **({"origin": brief_origin, "sourceClaimIds": source_claim_ids}
               if schema_version.endswith("/v2.1") else {}),
        },
        "claims": claims,
        "chapters": chapters,
        "regions": list(span.regions),
        "quality": {
            "status": "limited" if failures else "complete",
            "failureCodes": failures,
            "sourceCoverageRatio": round(span.source_coverage_ratio, 6),
            "maxChapterStartConcentration": round(prepared.concentration, 6),
            "maxChapterSpanRatio": round(prepared.max_chapter_span_ratio, 6),
            "humanReviewRequired": True,
        },
        "receipt": normalized_receipt,
    }


def _ids(value: object, known: dict[str, dict[str, Any]], code: str) -> list[str]:
    if not isinstance(value, list):
        _fail("V3510B_PROVIDER_RESPONSE_INVALID", "Evidence identifiers must be an array.")
    ids = list(dict.fromkeys(str(item) for item in value))
    if not ids or any(item not in known for item in ids):
        _fail(code, "A grounded result cited unknown evidence.")
    return ids


def _regions_for(ids: list[str], evidence_regions: dict[str, set[str]]) -> list[str]:
    order = ("opening", "middle", "ending")
    touched = set().union(*(evidence_regions[item] for item in ids))
    return [item for item in order if item in touched]


_PROVIDER_FINISH_REASONS = frozenset({
    "stop",
    "tool_calls",
    "length",
    "content_filter",
    "refusal",
    "authorization_denied",
    "empty",
    "malformed",
    "schema_invalid",
})


def _normalize_provider_extras(extras: dict[str, Any] | None) -> dict[str, Any]:
    if not isinstance(extras, dict):
        return {}
    allowed = {
        "endpointClass": str,
        "structureMode": str,
        "attemptId": str,
        "latencyMs": int,
        "requestSha256": str,
        "responseSha256": str,
        "finishReason": str,
    }
    normalized: dict[str, Any] = {}
    for key, caster in allowed.items():
        if key not in extras:
            continue
        try:
            normalized[key] = caster(extras[key])
        except (TypeError, ValueError):
            continue
    if "finishReason" in normalized and normalized["finishReason"] not in _PROVIDER_FINISH_REASONS:
        normalized["finishReason"] = "malformed"
    return normalized


def _receipt(
    value: dict[str, Any],
    *,
    schema_version: str,
    extras: dict[str, Any] | None = None,
) -> dict[str, Any]:
    required = {"providerId", "modelId", "outboundDerivedTextSha256", "requestCount"}
    if not isinstance(value, dict) or not required.issubset(value):
        _fail("V3510B_PROVIDER_RESPONSE_INVALID", "Provider receipt is invalid.")
    receipt: dict[str, Any] = {
        "providerId": str(value["providerId"]),
        "modelId": str(value["modelId"]),
        "outboundDerivedTextSha256": str(value["outboundDerivedTextSha256"]),
        "requestCount": int(value["requestCount"]),
        "rawVideoUploadCount": 0,
        "rawAudioUploadCount": 0,
        "frameByteUploadCount": 0,
        "cookieUploadCount": 0,
        "apiKeyDisclosureCount": 0,
        "localPathUploadCount": 0,
    }
    if schema_version.endswith("/v2.1"):
        receipt.update(_normalize_provider_extras(extras))
    return receipt
