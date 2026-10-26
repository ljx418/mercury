from __future__ import annotations

import hashlib
import json
import re
import time
from dataclasses import dataclass
from typing import Any, Callable

import httpx
from jsonschema import Draft202012Validator

from ..task_store import MediaTaskStoreError
from .diagnostics import (
    candidate_contract_requirements,
    candidate_contract_trustworthy,
    evidence_capacity_diagnostic,
    stage_b_candidate_shape_violation,
)
from .quality import (
    ChapterBalanceAssessment,
    assess_chapter_balance,
    chapter_balance_constraints,
    chapter_anchors,
    substantive_region_count,
)


_MAX_CHUNK_CHARS = 18_000
_MAX_EVIDENCE_ITEMS = 240

#: The HARD request bound of ONE adapter instance (one task). Every
#: regeneration by the SAME selected Provider consumes it. The bound is
#: exposed in the receipt's request count and in the tests.
_STAGE_B_MAX_REQUESTS = 8


SYNTHESIS_STYLES: dict[str, dict[str, str]] = {
    "concise": {
        "label": "精简",
        "riskLevel": "medium",
        "riskCode": "coverage_omission",
        "riskDescription": "更短、更易扫描，但可能省略次要例子和限定条件。",
        "instruction": "使用最少章节和短句，只保留主结论、关键因果和必要限制；不得省略影响结论成立的条件。",
    },
    "structured": {
        "label": "结构化",
        "riskLevel": "low",
        "riskCode": "balanced_default",
        "riskDescription": "在覆盖度、可读性和推断约束之间保持平衡，推荐作为默认结果。",
        "instruction": "按视频原有论证或叙事结构组织章节，平衡结论、依据、例子和限制。",
    },
    "detailed": {
        "label": "详细",
        "riskLevel": "medium",
        "riskCode": "over_inclusion",
        "riskDescription": "保留更多细节，但阅读更长，口语重复进入结果的风险更高。",
        "instruction": "尽可能保留有证据支持的步骤、例子、数字和限制，同时合并口语重复；不得为了篇幅补造细节。",
    },
    "tutorial": {
        "label": "教程",
        "riskLevel": "medium",
        "riskCode": "procedural_reframing",
        "riskDescription": "突出操作顺序，非教程视频可能因步骤化重组而损失原叙事关系。",
        "instruction": "仅当证据明确表达操作顺序时整理为步骤；观点、讨论或叙事内容必须保持原结构，不得强行教程化。",
    },
}


def synthesis_style(style: str) -> dict[str, str]:
    value = SYNTHESIS_STYLES.get(style)
    if value is None:
        raise MediaTaskStoreError("V352_SYNTHESIS_STYLE_INVALID", "不支持的结果风格。", status=422)
    return dict(value)


SYSTEM_PROMPT = """你是 Navia 的视频结构化理解器。你只能使用输入中的证据，不得使用外部知识。
目标不是逐句改写，而是理解完整视频后生成可扫描、可跳转、可核验的中文结构。

必须做到：
1. 先理解全局主题与论证/叙事顺序，再划分 2 至 12 个互不重复的语义章节。
2. 标题必须概括该章主题，禁止使用“片段一”“这里讲了”等空泛标题。
3. thesis 是该章的一句话结论；keyPoints 是 2 至 5 个去重后的事实、步骤、原因或结论。
4. 每章必须引用真实 evidenceId。字幕、OCR、画面描述只能互相作证或标记冲突，不能凭画面猜测未说出的事实。
5. 视觉证据与字幕冲突时，保留字幕原意并在 evidenceNote 中说明冲突；不得静默改写。
6. 删除口头填充、广告和重复，不得杜撰人名、数字、因果、观点或结论。
7. summary 必须覆盖“视频在讲什么、如何展开、核心结论、重要限制”中的适用项，不能只摘录开头片段。
8. 章节边界优先依据话题转折、论证阶段、操作阶段或叙事转折；不得按固定时长机械切段。
9. 同一章节同时存在字幕、OCR 与画面描述时，必须在 evidenceIds 中保留能直接作证的跨模态证据；画面只用于作证或纠偏。
10. keyPoints 必须形成可理解的逻辑序列，避免同义改写 thesis；数字、专名、比较和因果需要对应直接证据。

严格禁止：
- 根据单个片段判断整段视频；
- 直接拼接原始字幕充当摘要；
- 输出没有 evidenceId 支撑的结论；
- 输出 Markdown、解释过程或 JSON 之外的文字。
"""


ANSWER_SYSTEM_PROMPT = """你是 Navia 的视频证据问答器。你只能根据输入中的章节索引和派生证据回答。
先理解问题在完整视频中的位置，再用最少但充分的证据作答。禁止使用外部知识、常识补全或猜测。
每个结论必须引用直接支持它的 evidenceId；视觉问题只能引用 OCR 或画面描述证据。
evidenceId 和 chapterId 只能放在 JSON 的 evidenceIds 字段，禁止写入面向用户的 text。
输入不足时必须返回 insufficient_evidence，不能把相似但无关的片段拼成答案。
只输出用户要求的 JSON 对象，不得输出 Markdown、解释过程或额外字段。
"""


def _canonical(value: Any) -> bytes:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")


def _strip_json_fence(value: str) -> str:
    candidate = value.strip()
    if candidate.startswith("```"):
        candidate = re.sub(r"^```(?:json)?\s*|\s*```$", "", candidate, flags=re.IGNORECASE)
    return candidate.strip()


def _parse_json_object(value: str) -> dict[str, Any]:
    candidate = _strip_json_fence(value)
    try:
        direct = json.loads(candidate)
        if isinstance(direct, dict):
            return direct
    except json.JSONDecodeError:
        pass
    decoder = json.JSONDecoder()
    objects: list[dict[str, Any]] = []
    for index, character in enumerate(candidate):
        if character != "{":
            continue
        try:
            parsed, _ = decoder.raw_decode(candidate[index:])
        except json.JSONDecodeError:
            continue
        if isinstance(parsed, dict):
            objects.append(parsed)
    expected_key_sets = (
        {"status", "answerBlocks"},
        {"summary", "chapters"},
        {"summary", "sections"},
    )
    for parsed in reversed(objects):
        if any(keys.issubset(parsed) for keys in expected_key_sets):
            return parsed
    if objects:
        return objects[-1]
    raise json.JSONDecodeError("object not found", candidate, 0)


@dataclass(frozen=True)
class GroundedSynthesisReceipt:
    provider_id: str
    model_id: str
    outbound_sha256: str
    request_count: int
    usage: dict[str, int | None]
    attempt_id: str = ""
    latency_ms: int = 0
    request_sha256: str = ""
    response_sha256: str = ""
    finish_reason: str = "stop"
    endpoint_class: str = ""
    structure_mode: str = ""


class MiniMaxGroundedSynthesisProvider:
    """OpenAI-compatible text synthesis using an already verified vision provider.

    The adapter accepts derived text only. Raw media, frame bytes, cookies and local
    paths are intentionally outside its public method.
    """

    def __init__(
        self,
        provider: dict[str, Any],
        client_factory: Callable[[], httpx.Client] | None = None,
    ) -> None:
        self.provider = provider
        self.client_factory = client_factory or (
            lambda: httpx.Client(timeout=180.0, follow_redirects=False)
        )
        self._requests: list[bytes] = []
        self._usage = {"inputTokens": 0, "outputTokens": 0}
        # The redacted per-stage diagnostics of this adapter instance. They
        # are an INTERNAL record: they never reach a public envelope.
        self._stage_b_diagnostics: list[dict[str, Any]] = []
        self._response_sha256: str = ""
        self._attempt_id: str = ""
        self._latency_ms: int = 0
        self._finish_reason: str = "stop"
        self._endpoint_class: str = (
            str(self.provider.get("adapterKind") or "minimax_chat_completions")
        )
        self._structure_mode: str = "openai_chat_object"

    def b5_provider_receipt_extras(self) -> dict[str, Any]:
        """Return the B-5 V2.1 receipt extras recorded from the latest request.

        Endpoint class and structure mode are kept open. Single-task single-Provider
        is enforced upstream in ``service.py``; this surface is a deterministic
        record of what the provider actually did, never a fallback decision.
        """
        return {
            "endpointClass": self._endpoint_class,
            "structureMode": self._structure_mode,
            "attemptId": self._attempt_id,
            "latencyMs": self._latency_ms,
            "requestSha256": self._outbound_sha256(),
            "responseSha256": self._response_sha256,
            "finishReason": self._finish_reason,
        }

    def _outbound_sha256(self) -> str:
        if not self._requests:
            return ""
        return hashlib.sha256(b"\n".join(self._requests)).hexdigest()

    def synthesize(
        self,
        *,
        title: str,
        evidence: list[dict[str, Any]],
        style: str = "structured",
    ) -> tuple[dict[str, Any], GroundedSynthesisReceipt]:
        if not evidence or len(evidence) > _MAX_EVIDENCE_ITEMS:
            raise MediaTaskStoreError(
                "V352_SYNTHESIS_INPUT_INVALID",
                "Grounded synthesis evidence count is invalid.",
                status=409,
            )
        style_spec = synthesis_style(style)
        groups = self._groups(evidence)
        partials = [self._extract_chunk(title, group, index, len(groups), style_spec) for index, group in enumerate(groups)]
        try:
            result = self._merge(title, evidence, partials, style_spec)
        except MediaTaskStoreError as error:
            if error.code != "V352_SYNTHESIS_RESPONSE_INVALID":
                raise
            result = self._result_from_partials(partials, evidence)
        if isinstance(result.get("chapters"), list) and len(result["chapters"]) > 12:
            result = self._compress_chapters(title, result, style_spec)
        try:
            validated = validate_synthesis(result, evidence)
        except MediaTaskStoreError:
            result = self._result_from_partials(partials, evidence)
            if len(result["chapters"]) > 12:
                result = self._compress_chapters(title, result, style_spec)
            validated = validate_synthesis(result, evidence)
        outbound = hashlib.sha256(b"\n".join(self._requests)).hexdigest()
        receipt = GroundedSynthesisReceipt(
            provider_id=str(self.provider["id"]),
            model_id=str(self.provider["model"]),
            outbound_sha256=outbound,
            request_count=len(self._requests),
            usage=dict(self._usage),
        )
        return validated, receipt

    def synthesize_v2(
        self,
        *,
        title: str,
        evidence: list[dict[str, Any]],
        style: str = "structured",
    ) -> tuple[dict[str, Any], GroundedSynthesisReceipt]:
        """Return an untrusted Stage B candidate for the independent V2 validator.

        This deliberately has no partial-summary fallback: concatenated chunk text
        cannot truthfully satisfy the whole-video brief contract.
        """
        if not evidence or len(evidence) > _MAX_EVIDENCE_ITEMS:
            raise MediaTaskStoreError(
                "V3510B_EVIDENCE_UNCLOSED",
                "Grounded synthesis evidence count is invalid.",
                status=409,
            )
        style_spec = synthesis_style(style)
        groups = self._groups(evidence)
        partials = [self._extract_chunk(title, group, index, len(groups), style_spec) for index, group in enumerate(groups)]
        index = [{
            "evidenceId": item["evidenceId"],
            "kind": item["kind"],
            "startMs": item["timestampStartMs"],
            "endMs": item["timestampEndMs"],
        } for item in evidence]
        candidate = self._complete({
            "task": "produce_grounded_comprehension_v2",
            "videoTitle": title,
            "resultStyle": {"label": style_spec["label"], "instruction": style_spec["instruction"]},
            "evidenceIndex": index,
            "boundaryEvidence": {
                "firstEvidenceId": evidence[0]["evidenceId"],
                "lastEvidenceId": evidence[-1]["evidenceId"],
            },
            "chunkCandidates": partials,
            # The COMPLETE frozen candidate invariants: every request that
            # can produce a candidate carries them, so a targeted repair may
            # never regress an invariant it does not address.
            "candidateContract": self._candidate_contract(evidence=evidence),
            "requirements": [
                "brief 必须是 20 至 100 个中文或 Unicode 字符的全视频概括，覆盖开头、中段和结尾，禁止复制字幕原句。",
                "claims 必须为 2 至 8 条互不重复的核心表达，每条只引用直接支持它的 evidenceId。",
                "chapters 必须为 2 至 12 章，按时间严格递增，首章必须引用最早证据，末章必须引用最晚证据。",
                "章节 evidenceIds 只放本章时间范围内的直接证据，禁止用跨章引用伪造时间覆盖。",
                "发现字幕、OCR 或画面描述存在无法解释的冲突时，将 unresolvedEvidenceConflict 设为 true。",
                "不得输出 Markdown、内部推理、外部知识、原始媒体、路径、Cookie 或密钥。",
            ],
            "outputSchema": {
                "brief": {"text": "全视频精炼概括", "evidenceIds": ["直接证据 ID"]},
                "claims": [{"text": "可核验的核心表达", "evidenceIds": ["直接证据 ID"]}],
                "chapters": [{
                    "title": "语义章节标题",
                    "thesis": "章节核心结论",
                    "evidenceIds": ["本章直接证据 ID"],
                    "relationToPrevious": "opening|continuation|contrast|cause_effect|example|conclusion",
                }],
                "unresolvedEvidenceConflict": False,
            },
        }, system_prompt=SYSTEM_PROMPT, temperature=0.0)

        # C4: the ADAPTER enforces the frozen candidate shape and the frozen
        # temporal contract before the candidate is handed to the independent
        # validator. A violating candidate is regenerated by the SAME selected
        # Provider, inside the HARD request bound. The validator stays
        # authoritative: nothing here accepts a candidate, and nothing here
        # normalizes a semantic value.
        def regenerate(*, shape_violation, temporal_invalid, balance, previous):
            # The repair context is the Provider's OWN authorized derivative
            # when its structure is trusted, and the trusted extraction
            # partials otherwise. Nothing is ever normalized, reordered,
            # split, merged or rewritten locally.
            trusted = self._trusted_repair_context(previous, partials)
            if shape_violation is not None:
                payload = self._shape_repair_payload(
                    title=title,
                    index=index,
                    violation=shape_violation,
                    evidence=evidence,
                    grounded_context=trusted,
                )
            elif temporal_invalid:
                payload = self._temporal_repair_payload(
                    title=title,
                    index=index,
                    candidate=trusted,
                    evidence=evidence,
                )
            else:
                payload = self._balance_repair_payload(
                    title=title,
                    index=index,
                    evidence=evidence,
                    assessment=balance,
                    grounded_context=trusted,
                )
            return self._complete(payload, system_prompt=SYSTEM_PROMPT, temperature=0.0)

        candidate = self._enforce_candidate(
            candidate=candidate,
            evidence=evidence,
            regenerate=regenerate,
            stage="initial_candidate",
        )
        return candidate, self._receipt()

    def repair_v2(
        self,
        *,
        title: str,
        evidence: list[dict[str, Any]],
        candidate: dict[str, Any],
        failure_code: str,
        style: str = "structured",
    ) -> tuple[dict[str, Any], GroundedSynthesisReceipt]:
        """Ask the provider to regenerate the entire contract after one rejection."""
        style_spec = synthesis_style(style)
        index = [{
            "evidenceId": item["evidenceId"], "kind": item["kind"],
            "startMs": item["timestampStartMs"], "endMs": item["timestampEndMs"],
        } for item in evidence]
        repaired = self._complete({
            "task": "repair_rejected_grounded_comprehension_v2",
            "videoTitle": title,
            "resultStyle": {"label": style_spec["label"], "instruction": style_spec["instruction"]},
            "machineFailureCode": failure_code,
            "rejectedCandidate": candidate,
            "evidenceIndex": index,
            # The COMPLETE frozen candidate invariants: the repair rules below
            # are TARGETED context and may never replace or weaken this
            # block.
            "candidateContract": self._candidate_contract(
                evidence=evidence,
                chapter_count=(
                    len(candidate.get("chapters"))
                    if isinstance(candidate, dict) and isinstance(candidate.get("chapters"), list)
                    else None
                ),
            ),
            "requirements": [
                "重新生成整个结果，不得只修一个字段而破坏其他字段。",
                "brief.text 使用 20 至 100 个 Unicode 字符，建议 40 至 80 字；不是任一字幕原句或连续摘录。",
                "brief.evidenceIds 必须覆盖所有有内容的开头、中段、结尾区域。",
                "claims 为 2 至 8 条不重复核心表达，每条 8 至 240 字且只引用直接证据。",
                f"第一章必须引用最早证据 {evidence[0]['evidenceId']}，最后一章必须引用最晚证据 {evidence[-1]['evidenceId']}。",
                "章节为 2 至 12 章；各章最早证据时间严格递增，避免开头聚集和超长尾章。",
                "只能使用 evidenceIndex 中的 ID；不得输出 Markdown、内部推理或额外字段。",
            ],
            "outputSchema": {
                "brief": {"text": "40 至 80 字全片概括", "evidenceIds": ["直接证据 ID"]},
                "claims": [{"text": "可核验的核心表达", "evidenceIds": ["直接证据 ID"]}],
                "chapters": [{"title": "语义章节标题", "thesis": "章节核心结论", "evidenceIds": ["本章直接证据 ID"], "relationToPrevious": "opening|continuation|contrast|cause_effect|example|conclusion"}],
                "unresolvedEvidenceConflict": False,
            },
        }, system_prompt=SYSTEM_PROMPT, temperature=0.0)

        # The SAME enforcement, on the repair route: the frozen shape AND the
        # frozen temporal contract, with the same bounded regeneration by the
        # SAME selected Provider. The two routes may never drift apart.
        def regenerate_repair(*, shape_violation, temporal_invalid, balance, previous):
            # The repair context is the Provider's OWN authorized derivative
            # when its structure is trusted; otherwise the service route has
            # no partial context and the trusted fallback is empty.
            trusted = self._trusted_repair_context(
                previous,
                self._trusted_repair_context(candidate, None),
            )
            if shape_violation is not None:
                payload = self._shape_repair_payload(
                    title=title,
                    index=index,
                    violation=shape_violation,
                    evidence=evidence,
                    grounded_context=trusted,
                )
            elif temporal_invalid:
                payload = self._temporal_repair_payload(
                    title=title,
                    index=index,
                    candidate=trusted,
                    evidence=evidence,
                )
            else:
                payload = self._balance_repair_payload(
                    title=title,
                    index=index,
                    evidence=evidence,
                    assessment=balance,
                    grounded_context=trusted,
                )
            return self._complete(payload, system_prompt=SYSTEM_PROMPT, temperature=0.0)

        repaired = self._enforce_candidate(
            candidate=repaired,
            evidence=evidence,
            regenerate=regenerate_repair,
            stage="bounded_repair",
        )
        return repaired, self._receipt()

    def _receipt(self) -> GroundedSynthesisReceipt:
        return GroundedSynthesisReceipt(
            provider_id=str(self.provider["id"]),
            model_id=str(self.provider["model"]),
            outbound_sha256=self._outbound_sha256(),
            request_count=len(self._requests),
            usage=dict(self._usage),
            attempt_id=self._attempt_id,
            latency_ms=self._latency_ms,
            request_sha256=self._outbound_sha256(),
            response_sha256=self._response_sha256,
            finish_reason=self._finish_reason,
            endpoint_class=self._endpoint_class,
            structure_mode=self._structure_mode,
        )

    # -- the bounded regeneration of a malformed candidate -------------------

    @property
    def request_bound(self) -> int:
        """The HARD request bound of this adapter instance."""
        return _STAGE_B_MAX_REQUESTS

    @property
    def provider_outbound_http_attempts(self) -> int:
        """The ACTUAL number of outbound Provider HTTP attempts.

        Every attempt is counted at the request boundary, so a timeout, a
        malformed response, a regeneration and a terminal rejection are all
        counted. It is a COUNT only.
        """
        return len(self._requests)

    @property
    def stage_b_diagnostics(self) -> list[dict[str, Any]]:
        """The redacted diagnostics of the stages this adapter went through."""
        return list(self._stage_b_diagnostics)

    def _record_stage_diagnostic(
        self,
        *,
        stage: str,
        candidate: Any,
        evidence: list[dict[str, Any]],
        failure_code: str | None,
        final_outcome: str = "fail_closed",
    ) -> None:
        """Record ONE redacted stage diagnostic. Never a value, an id or text.

        A RECOVERED stage records a resolved outcome; only a terminal refusal
        records `fail_closed`.
        """
        from .diagnostics import build_stage_b_diagnostic

        self._stage_b_diagnostics.append(build_stage_b_diagnostic(
            stage=stage,
            failure_code=failure_code,
            candidate=candidate,
            evidence=evidence,
            repair_attempt_count=len(self._requests),
            final_outcome=final_outcome,
            provider_outbound_http_attempts=len(self._requests),
        ))

    def _request_budget_available(self) -> bool:
        return len(self._requests) < _STAGE_B_MAX_REQUESTS

    def _guard_request_budget(self) -> None:
        """The HARD global cap, immediately before an outbound HTTP attempt.

        Every outbound attempt of this adapter instance counts: the initial
        extraction, the candidate generation, the shape repair, the temporal
        repair and the service-level `repair_v2` share ONE cap.
        """
        if not self._request_budget_available():
            raise MediaTaskStoreError(
                "V352_SYNTHESIS_RESPONSE_INVALID",
                "The grounded synthesis request budget is exhausted.",
                status=502,
            )

    @staticmethod
    def _candidate_contract(
        *,
        evidence: list[dict[str, Any]],
        chapter_count: int | None = None,
        target_claim_count: int | None = None,
        target_chapter_count: int | None = None,
    ) -> dict[str, Any]:
        """The COMPLETE frozen candidate invariants of a request.

        Every candidate-producing request composes THIS block: the initial
        synthesis, the shape regeneration, the temporal repair, the balance
        regeneration and `repair_v2`. A targeted request may append its own
        context, but it may never replace or weaken a requirement of this
        block.
        """
        return candidate_contract_requirements(
            evidence=evidence,
            chapter_count=chapter_count,
            target_claim_count=target_claim_count,
            target_chapter_count=target_chapter_count,
        )

    @staticmethod
    def _trusted_repair_context(candidate: Any, fallback: Any) -> Any:
        """The rejected candidate as repair context, ONLY when it is trusted.

        A candidate with the EXACT frozen key vocabulary and safe container
        types is the Provider's own authorized derivative: it is the best
        semantic context a repair can carry. Any other candidate may hold
        arbitrary Provider text, so the caller keeps the TRUSTED fallback (the
        extracted partial context or an already trusted derivative).

        Nothing is ever normalized, reordered, split, merged or rewritten
        locally.
        """
        return candidate if candidate_contract_trustworthy(candidate) else fallback

    @staticmethod
    def _temporal_index(evidence: list[dict[str, Any]]) -> dict[str, Any]:
        """The REDACTED temporal index of the evidence catalog.

        It carries counts and timestamps only: no text, no title and no raw
        payload. The evidence ids are already inside the authorized derived
        text boundary of the request.
        """
        capacity = evidence_capacity_diagnostic(evidence)
        return {
            "evidenceCount": capacity["evidenceCount"],
            "distinctStartCount": capacity["distinctStartCount"],
            "duplicateStartGroupCount": capacity["duplicateStartGroupCount"],
            "maximumDuplicateStartMultiplicity": capacity["maximumDuplicateStartMultiplicity"],
            "firstStartMs": capacity["firstStartMs"],
            "lastStartMs": capacity["lastStartMs"],
            "minimumChapterCount": 2,
            "maximumChapterCount": 12,
            "strictlyIncreasingAnchorsRequired": True,
        }

    def _enforce_candidate(
        self,
        *,
        candidate: dict[str, Any],
        evidence: list[dict[str, Any]],
        regenerate,
        stage: str,
    ) -> dict[str, Any]:
        """The ONE candidate enforcement, used by the initial route AND by
        `repair_v2`.

        The frozen shape and the frozen temporal contract are enforced
        together, in ONE loop, so the two routes may never drift apart. A
        violating candidate is regenerated by the SAME selected Provider,
        inside the HARD request bound. The independent validator stays
        authoritative: nothing here accepts a candidate.

        The diagnostic records the RESOLVED outcome when the regeneration
        succeeded; only a terminal refusal records `fail_closed`.
        """
        initial_violation = stage_b_candidate_shape_violation(candidate, evidence)
        temporal_invalid = initial_violation is None and not self._stage_b_temporal_candidate_valid(candidate, evidence)
        initial_balance = None
        if initial_violation is None and not temporal_invalid:
            initial_balance = self._stage_b_balance_assessment(candidate, evidence)
        if (
            initial_violation is not None
            or temporal_invalid
            or (initial_balance is not None and not initial_balance.ok)
        ):
            self._record_stage_diagnostic(
                stage=stage,
                candidate=candidate,
                evidence=evidence,
                failure_code=self._enforcement_failure_code(
                    shape_violation=initial_violation,
                    temporal_invalid=temporal_invalid,
                    balance=initial_balance,
                ),
                final_outcome="recovering",
            )
        regenerations = 0
        for _ in range(_STAGE_B_MAX_REQUESTS + 1):
            violation = stage_b_candidate_shape_violation(candidate, evidence)
            temporal_invalid = violation is None and not self._stage_b_temporal_candidate_valid(candidate, evidence)
            balance = None
            if violation is None and not temporal_invalid:
                balance = self._stage_b_balance_assessment(candidate, evidence)
            if violation is None and not temporal_invalid and balance is not None and balance.ok:
                if regenerations:
                    # The regeneration RESOLVED the violation: the diagnostic
                    # records a resolved outcome, never a fail-closed one.
                    self._record_stage_diagnostic(
                        stage=stage,
                        candidate=candidate,
                        evidence=evidence,
                        failure_code=None,
                        final_outcome="recovered",
                    )
                return candidate
            if violation is not None:
                refused_stage = "shape_regeneration"
            elif temporal_invalid:
                refused_stage = "temporal_repair"
            else:
                refused_stage = "chapter_balance_repair"
            refused_code = self._enforcement_failure_code(
                shape_violation=violation,
                temporal_invalid=temporal_invalid,
                balance=balance,
            )
            if regenerations:
                # EVERY refusal of the loop keeps its own redacted
                # diagnostic, so the trail of the stages is complete.
                self._record_stage_diagnostic(
                    stage=refused_stage,
                    candidate=candidate,
                    evidence=evidence,
                    failure_code=refused_code,
                    final_outcome="recovering",
                )
            if not self._request_budget_available():
                self._record_stage_diagnostic(
                    stage=refused_stage,
                    candidate=candidate,
                    evidence=evidence,
                    failure_code=refused_code,
                    final_outcome="fail_closed",
                )
                raise MediaTaskStoreError(
                    refused_code,
                    "Grounded synthesis candidate shape is invalid."
                    if violation is not None
                    else (
                        "Grounded synthesis candidate does not satisfy the temporal contract."
                        if temporal_invalid
                        else "Grounded synthesis candidate does not satisfy the chapter balance contract."
                    ),
                    status=502,
                )
            candidate = regenerate(
                shape_violation=violation,
                temporal_invalid=temporal_invalid,
                balance=balance,
                previous=candidate,
            )
            regenerations += 1
        # The iteration bound is a backstop: the request bound binds first.
        self._record_stage_diagnostic(
            stage="candidate_enforcement",
            candidate=candidate,
            evidence=evidence,
            failure_code="V352_SYNTHESIS_RESPONSE_INVALID",
            final_outcome="fail_closed",
        )
        raise MediaTaskStoreError(
            "V352_SYNTHESIS_RESPONSE_INVALID",
            "Grounded synthesis candidate could not be brought into the frozen contract.",
            status=502,
        )

    @staticmethod
    def _enforcement_failure_code(
        *,
        shape_violation: str | None,
        temporal_invalid: bool,
        balance: ChapterBalanceAssessment | None,
    ) -> str:
        """The FROZEN failure code of the enforcement refusal.

        A chapter-balance refusal keeps the INDEPENDENT validator's code:
        the adapter refuses earlier, but the outcome of a persistent
        imbalance is the same frozen code the validator would have raised.
        """
        if shape_violation is not None or temporal_invalid:
            return "V352_SYNTHESIS_RESPONSE_INVALID"
        if balance is not None and not balance.ok:
            return str(balance.violation_code or "V3510B_CHAPTER_IMBALANCE")
        return "V352_SYNTHESIS_RESPONSE_INVALID"

    def _balance_repair_payload(
        self,
        *,
        title: str,
        index: list[dict[str, Any]],
        evidence: list[dict[str, Any]],
        assessment: ChapterBalanceAssessment | None,
        grounded_context: dict[str, Any],
    ) -> dict[str, Any]:
        """The regeneration request for a CHAPTER-BALANCE violation.

        It carries the EXISTING authorized evidence index, the privacy-safe
        balance metrics, the EXPLICIT frozen constraints and the candidate the
        SAME Provider already generated. The latter is the authorized semantic
        context needed to preserve the brief, claims and chapter meaning while
        moving chapter anchors. It never asks for a local rewrite: the WHOLE
        candidate is regenerated by the SAME selected Provider, inside the SAME
        hard request bound.
        """
        metrics = assessment.as_diagnostic() if assessment is not None else {
            "chapterCount": 0,
            "startConcentration": 0.0,
            "maximumChapterSpanRatio": 0.0,
            "substantiveRegionCount": 0,
            "violationClass": None,
            "violationCode": None,
        }
        constraints = chapter_balance_constraints(
            int(metrics["chapterCount"]),
            int(metrics["substantiveRegionCount"]),
        )
        balance_requirements = [
            "以 groundedContext 为语义依据重新生成整个结果；不得只修改一个字段，也不得改变已经正确的事实、结论或证据绑定。",
            "章节起点必须按时间严格递增。",
        ]
        if constraints["startConcentrationRuleApplies"]:
            balance_requirements.append(
                "任一 20% 时间窗内的章节起点占比不得超过 "
                f"{constraints['maximumStartConcentration']:.6g}。"
            )
        if constraints["chapterSpanRuleApplies"]:
            balance_requirements.append(
                "单章跨度不得超过总证据跨度的 "
                f"{constraints['maximumChapterSpanRatio']:.6g}。"
            )
        balance_requirements.extend([
            "只能使用 evidenceIndex 中的 ID；不得创造、改写或缩写 ID。",
            "不得输出 Markdown、内部推理、路径、Cookie 或密钥。",
        ])
        return {
            "task": "regenerate_grounded_comprehension_v2_chapter_balance",
            "videoTitle": title,
            "evidenceIndex": index,
            "groundedContext": grounded_context,
            "chapterBalance": {**metrics, "frozenConstraints": constraints},
            # The COMPLETE frozen candidate invariants: the balance rules
            # below are TARGETED context and may never replace or weaken
            # this block.
            "candidateContract": self._candidate_contract(
                evidence=evidence,
                chapter_count=int(metrics["chapterCount"]) if metrics["chapterCount"] else None,
            ),
            "requirements": balance_requirements,
            "outputSchema": {
                "brief": {"text": "全视频精炼概括", "evidenceIds": ["直接证据 ID"]},
                "claims": [{"text": "可核验的核心表达", "evidenceIds": ["直接证据 ID"]}],
                "chapters": [{"title": "语义章节标题", "thesis": "章节核心结论", "evidenceIds": ["本章直接证据 ID"], "relationToPrevious": "opening|continuation|contrast|cause_effect|example|conclusion"}],
                "unresolvedEvidenceConflict": False,
            },
        }

    def _shape_repair_payload(
        self,
        *,
        title: str,
        index: list[dict[str, Any]],
        violation: str,
        evidence: list[dict[str, Any]],
        grounded_context: Any,
    ) -> dict[str, Any]:
        """The regeneration request for a MALFORMED candidate shape.

        It carries the shape rules, the redacted temporal index and the
        already-authorized derived context from the original request. It never
        carries the newly rejected malformed candidate (which may hold
        arbitrary text), and it never asks for a semantic rewrite.
        """
        temporal_index = self._temporal_index(evidence)
        target_chapter_count = max(2, min(6, temporal_index["distinctStartCount"]))
        target_claim_count = 5
        return {
            "task": "regenerate_grounded_comprehension_v2_shape",
            "videoTitle": title,
            "machineShapeViolation": violation,
            "evidenceIndex": index,
            "temporalIndex": temporal_index,
            "targetCounts": {
                "claims": target_claim_count,
                "chapters": target_chapter_count,
            },
            # The COMPLETE frozen candidate invariants. The targeted shape
            # rules below may APPEND context; they may never replace or
            # weaken this block.
            "candidateContract": self._candidate_contract(
                evidence=evidence,
                chapter_count=target_chapter_count,
                target_claim_count=target_claim_count,
                target_chapter_count=target_chapter_count,
            ),
            "groundedContext": grounded_context,
            "requirements": [
                "依据 groundedContext 重新生成，不得脱离已有派生事实猜测内容。",
                "重新输出完整结果，字段集合必须严格为 brief、claims、chapters、unresolvedEvidenceConflict 四个。",
                "brief 只含 text 与 evidenceIds；text 必须为 40 至 80 个 Unicode 字符，evidenceIds 必须为非空字符串数组。",
                f"claims 必须恰好为 {target_claim_count} 条，每条只含 text 与 evidenceIds；text 必须为 8 至 240 个 Unicode 字符，evidenceIds 必须为非空字符串数组。",
                f"chapters 必须恰好为 {target_chapter_count} 章，每章只含 title、thesis、evidenceIds、relationToPrevious 四个字段；title 为 4 至 80 字，thesis 为 8 至 500 字，evidenceIds 必须为非空字符串数组。",
                "relationToPrevious 只能是 opening、continuation、contrast、cause_effect、example、conclusion 之一。",
                "所有 evidenceId 必须逐字复制 evidenceIndex 中的值，禁止创造、改写或缩写 ID。",
                "不得输出 Markdown、额外字段、内部推理、路径、Cookie 或密钥。",
            ],
            "outputSchema": {
                "brief": {"text": "全视频精炼概括", "evidenceIds": ["直接证据 ID"]},
                "claims": [{"text": "可核验的核心表达", "evidenceIds": ["直接证据 ID"]}],
                "chapters": [{"title": "语义章节标题", "thesis": "章节核心结论", "evidenceIds": ["本章直接证据 ID"], "relationToPrevious": "opening|continuation|contrast|cause_effect|example|conclusion"}],
                "unresolvedEvidenceConflict": False,
            },
        }

    def _temporal_repair_payload(
        self,
        *,
        title: str,
        index: list[dict[str, Any]],
        candidate: dict[str, Any],
        evidence: list[dict[str, Any]],
    ) -> dict[str, Any]:
        """The regeneration request for a TEMPORAL violation.

        The redacted temporal index states the allowed anchor capacity. The
        frozen rule is NOT relaxed: the chapters must still strictly increase
        and must still cover the first and the last evidence.
        """
        return {
            "task": "repair_grounded_comprehension_v2_temporal_contract",
            "videoTitle": title,
            "invalidCandidate": candidate,
            "evidenceIndex": index,
            "temporalIndex": self._temporal_index(evidence),
            "failure": "章节证据锚点不满足全片边界或严格递增合同。",
            # The COMPLETE frozen candidate invariants: the temporal rules
            # below are TARGETED context and may never replace or weaken
            # this block.
            "candidateContract": self._candidate_contract(
                evidence=evidence,
                chapter_count=(
                    len(candidate.get("chapters"))
                    if isinstance(candidate, dict) and isinstance(candidate.get("chapters"), list)
                    else None
                ),
            ),
            "requirements": [
                f"第一章 evidenceIds 必须包含最早证据 {evidence[0]['evidenceId']}。",
                f"最后一章 evidenceIds 必须包含最晚证据 {evidence[-1]['evidenceId']}。",
                "每章最早 evidenceId 的 startMs 必须严格递增；不得删除 brief、claims 或冲突标记。",
                "只能重新选择输入中直接支持对应章节的 evidenceId，不得创造 ID 或改写事实来迁就边界。",
                "严格只返回 brief、claims、chapters、unresolvedEvidenceConflict 四个字段。",
            ],
            "outputSchema": {
                "brief": {"text": "全视频精炼概括", "evidenceIds": ["直接证据 ID"]},
                "claims": [{"text": "可核验的核心表达", "evidenceIds": ["直接证据 ID"]}],
                "chapters": [{"title": "语义章节标题", "thesis": "章节核心结论", "evidenceIds": ["本章直接证据 ID"], "relationToPrevious": "opening|continuation|contrast|cause_effect|example|conclusion"}],
                "unresolvedEvidenceConflict": False,
            },
        }

    @staticmethod
    def _stage_b_temporal_candidate_valid(candidate: dict[str, Any], evidence: list[dict[str, Any]]) -> bool:
        chapters = candidate.get("chapters") if isinstance(candidate, dict) else None
        if not isinstance(chapters, list) or len(chapters) < 2:
            return False
        by_id = {item["evidenceId"]: item for item in evidence}
        anchors: list[int] = []
        for chapter in chapters:
            ids = chapter.get("evidenceIds") if isinstance(chapter, dict) else None
            if not isinstance(ids, list) or not ids or any(item not in by_id for item in ids):
                return False
            anchors.append(min(int(by_id[item]["timestampStartMs"]) for item in ids))
        return (
            evidence[0]["evidenceId"] in chapters[0]["evidenceIds"]
            and evidence[-1]["evidenceId"] in chapters[-1]["evidenceIds"]
            and all(left < right for left, right in zip(anchors, anchors[1:]))
        )

    def _stage_b_balance_assessment(
        self,
        candidate: dict[str, Any],
        evidence: list[dict[str, Any]],
    ) -> ChapterBalanceAssessment:
        """The SHARED chapter-balance assessment of a candidate.

        It is the SAME owner the independent validator uses: the adapter may
        never disagree with the validator about a balance fact, and it never
        relaxes a threshold.
        """
        if not evidence:
            return assess_chapter_balance(
                anchors=[],
                span_start_ms=0,
                span_end_ms=0,
                substantive_region_count=0,
            )
        span_start = min(int(item["timestampStartMs"]) for item in evidence)
        span_end = max(int(item["timestampEndMs"]) for item in evidence)
        return assess_chapter_balance(
            anchors=chapter_anchors(candidate, evidence),
            span_start_ms=span_start,
            span_end_ms=span_end,
            substantive_region_count=substantive_region_count(
                evidence,
                span_start_ms=span_start,
                span_end_ms=span_end,
            ),
        )

    def answer(
        self,
        *,
        question: str,
        category: str,
        chapters: list[dict[str, Any]],
        evidence: list[dict[str, Any]],
    ) -> dict[str, Any]:
        known = {item["evidenceId"]: item for item in evidence}
        payload = {
            "task": "answer_grounded_video_question",
            "question": question,
            "category": category,
            "requirements": [
                "先依据全部章节判断问题意图，再选择直接支持答案的证据。",
                "只能使用输入事实，不得补充外部知识、常识推断或猜测。",
                "每个 answerBlock 必须引用真实 evidenceId；引用不支持结论时不得回答。",
                "回答正文不得出现 evidenceId、chapterId 或其他内部标识。",
                "视觉问题只使用 ocr_block/vision_caption 派生文本，纯语音事实不能用视觉描述证明。",
                "输入没有答案时返回 insufficient_evidence 和空 answerBlocks。",
            ],
            "chapters": chapters,
            "evidence": evidence,
            "outputSchema": {
                "status": "answered 或 insufficient_evidence",
                "answerBlocks": [{"text": "简洁、直接、有概括性的回答块", "evidenceIds": ["真实 evidenceId"]}],
                "answerBlockLimit": "跨章节问题 1 至 6 块，其他问题 1 至 4 块",
            },
        }
        max_blocks = 6 if category == "cross_chapter" else 4
        last_error: MediaTaskStoreError | None = None
        for attempt in range(3):
            retry_payload = payload if attempt == 0 else {
                **payload,
                "retryConstraint": (
                    "上一次结果未通过机器合同。严格只返回 status 和 answerBlocks；"
                    f"answered 必须有 1 至 {max_blocks} 个引用闭合的回答块，"
                    "insufficient_evidence 必须为空数组；text 不得包含 mtr_/mev_/chapter_ 内部标识。"
                ),
            }
            result = self._complete(
                retry_payload,
                system_prompt=ANSWER_SYSTEM_PROMPT,
                temperature=0.0,
            )
            try:
                return self._validate_answer(result, category=category, known=known, max_blocks=max_blocks)
            except MediaTaskStoreError as error:
                last_error = error
                if error.code not in {
                    "V352_ASK_RESPONSE_INVALID",
                    "V352_ASK_EVIDENCE_UNCLOSED",
                    "V352_ASK_VISUAL_EVIDENCE_INVALID",
                } or attempt == 2:
                    raise
        assert last_error is not None
        raise last_error

    @staticmethod
    def _validate_answer(
        result: dict[str, Any],
        *,
        category: str,
        known: dict[str, dict[str, Any]],
        max_blocks: int,
    ) -> dict[str, Any]:
        if set(result) != {"status", "answerBlocks"} or result.get("status") not in {"answered", "insufficient_evidence"}:
            raise MediaTaskStoreError("V352_ASK_RESPONSE_INVALID", "高质量问答返回结构无效。", status=502)
        blocks = result.get("answerBlocks")
        if not isinstance(blocks, list):
            raise MediaTaskStoreError("V352_ASK_RESPONSE_INVALID", "高质量问答缺少回答块。", status=502)
        if result["status"] == "insufficient_evidence":
            if blocks:
                raise MediaTaskStoreError("V352_ASK_RESPONSE_INVALID", "证据不足回答不能包含结论。", status=502)
            return {"status": "insufficient_evidence", "answerBlocks": []}
        if not 1 <= len(blocks) <= max_blocks:
            raise MediaTaskStoreError("V352_ASK_RESPONSE_INVALID", "高质量问答块数量无效。", status=502)
        normalized = []
        for block in blocks:
            if not isinstance(block, dict) or set(block) != {"text", "evidenceIds"}:
                raise MediaTaskStoreError("V352_ASK_RESPONSE_INVALID", "高质量问答块字段无效。", status=502)
            text = " ".join(str(block.get("text") or "").split()).strip()
            ids = list(dict.fromkeys(block.get("evidenceIds") or []))
            if not 8 <= len(text) <= 700 or not ids or any(item not in known for item in ids):
                raise MediaTaskStoreError("V352_ASK_EVIDENCE_UNCLOSED", "高质量问答引用未闭合。", status=502)
            if re.search(r"\b(?:mtr|mev|chapter)_[A-Za-z0-9]+", text):
                raise MediaTaskStoreError("V352_ASK_RESPONSE_INVALID", "高质量问答正文包含内部标识。", status=502)
            if category == "visual" and any(known[item]["kind"] not in {"ocr_block", "vision_caption"} for item in ids):
                raise MediaTaskStoreError("V352_ASK_VISUAL_EVIDENCE_INVALID", "视觉回答引用了非视觉证据。", status=502)
            normalized.append({
                "text": text,
                "evidenceIds": ids,
                "timestampMs": min(int(known[item]["timestampStartMs"]) for item in ids),
            })
        return {"status": "answered", "answerBlocks": normalized}

    @staticmethod
    def _groups(evidence: list[dict[str, Any]]) -> list[list[dict[str, Any]]]:
        groups: list[list[dict[str, Any]]] = []
        current: list[dict[str, Any]] = []
        size = 0
        for item in evidence:
            encoded = len(json.dumps(item, ensure_ascii=False))
            if current and size + encoded > _MAX_CHUNK_CHARS:
                groups.append(current)
                current, size = [], 0
            current.append(item)
            size += encoded
        if current:
            groups.append(current)
        return groups

    def _extract_chunk(
        self,
        title: str,
        evidence: list[dict[str, Any]],
        index: int,
        total: int,
        style_spec: dict[str, str],
    ) -> dict[str, Any]:
        prompt = {
            "task": "extract_grounded_chapter_candidates",
            "videoTitle": title,
            "chunk": {"index": index + 1, "total": total},
            "resultStyle": {"label": style_spec["label"], "instruction": style_spec["instruction"]},
            "evidence": evidence,
            "outputSchema": {
                "summary": "本块内容的一句话概括",
                "sections": [{
                    "title": "具体主题",
                    "thesis": "该部分结论",
                    "keyPoints": ["事实或步骤"],
                    "evidenceIds": ["输入中的 evidenceId"],
                    "evidenceNote": "视觉与字幕一致、补充或冲突的说明；无则空字符串",
                }],
            },
        }
        return self._complete(prompt)

    def _merge(
        self,
        title: str,
        evidence: list[dict[str, Any]],
        partials: list[dict[str, Any]],
        style_spec: dict[str, str],
    ) -> dict[str, Any]:
        index = [{
            "evidenceId": item["evidenceId"],
            "kind": item["kind"],
            "startMs": item["timestampStartMs"],
            "endMs": item["timestampEndMs"],
        } for item in evidence]
        prompt = {
            "task": "merge_complete_video_outline",
            "videoTitle": title,
            "resultStyle": {"label": style_spec["label"], "instruction": style_spec["instruction"]},
            "instruction": (
                "基于全部分块候选重建整段视频结构。合并重复主题，保持时间顺序；"
                "最终必须收敛为 2 至 10 章，长视频优先按论证阶段或叙事转折合并，禁止用斜杠拼接多个标题；"
                "每章 keyPoints 必须严格为 2 至 5 条，超过时先合并同义项；"
                "summary 用 2 至 4 句完整交代主题、展开路径、结论与限制，不能只复述第一块；"
                "每章优先同时引用直接支持该章的字幕与视觉派生证据，视觉证据不足时不得虚构；"
                "relationToPrevious 必须体现真实逻辑关系，使导图能区分延续、对照、因果、例证与结论；"
                "summary 必须概括完整视频，relationToPrevious 只允许 opening/continuation/contrast/"
                "cause_effect/example/conclusion。"
            ),
            "evidenceIndex": index,
            "chunkCandidates": partials,
            "outputSchema": {
                "summary": "完整视频的 2 至 4 句概括",
                "chapters": [{
                    "title": "具体章节主题",
                    "thesis": "章节结论",
                    "keyPoints": ["2 至 5 个关键点"],
                    "evidenceIds": ["证据 ID"],
                    "evidenceNote": "证据一致性或冲突说明",
                    "relationToPrevious": "opening",
                }],
                "chapterCountConstraint": "2 至 10",
            },
        }
        return self._complete(prompt)

    @staticmethod
    def _result_from_partials(partials: list[dict[str, Any]], evidence: list[dict[str, Any]]) -> dict[str, Any]:
        summaries = [" ".join(str(partial.get("summary") or "").split()) for partial in partials]
        known_ids = {item["evidenceId"] for item in evidence}
        chapters: list[dict[str, Any]] = []
        for partial in partials:
            sections = partial.get("sections")
            if not isinstance(sections, list):
                raise MediaTaskStoreError("V352_SYNTHESIS_RESPONSE_INVALID", "Chunk sections are invalid.", status=502)
            for section in sections:
                if not isinstance(section, dict):
                    raise MediaTaskStoreError("V352_SYNTHESIS_RESPONSE_INVALID", "Chunk section is invalid.", status=502)
                evidence_ids = list(dict.fromkeys(
                    item for item in (section.get("evidenceIds") or []) if item in known_ids
                ))
                title = " ".join(str(section.get("title") or "").split()).strip()
                thesis = " ".join(str(section.get("thesis") or "").split()).strip()
                points = list(dict.fromkeys(
                    " ".join(str(item).split()).strip()
                    for item in (section.get("keyPoints") or [])
                    if 4 <= len(" ".join(str(item).split()).strip()) <= 240
                ))
                if not evidence_ids or not 4 <= len(title) <= 80 or not 8 <= len(thesis) <= 1000 or len(points) < 2:
                    continue
                chapters.append({
                    "title": title,
                    "thesis": thesis,
                    "keyPoints": points[:5],
                    "evidenceIds": evidence_ids,
                    "evidenceNote": section.get("evidenceNote", ""),
                    "relationToPrevious": "opening" if not chapters else "continuation",
                })
        return {"summary": "；".join(item for item in summaries if item)[:4000], "chapters": chapters}

    def _compress_chapters(
        self,
        _title: str,
        result: dict[str, Any],
        _style_spec: dict[str, str],
    ) -> dict[str, Any]:
        chapters = result["chapters"]
        target = 10
        groups = [chapters[index * len(chapters) // target:(index + 1) * len(chapters) // target] for index in range(target)]
        output: list[dict[str, Any]] = []
        for group in groups:
            if not group or any(not isinstance(chapter, dict) for chapter in group):
                raise MediaTaskStoreError("V352_SYNTHESIS_RESPONSE_INVALID", "Chapter compression input is invalid.", status=502)
            titles = list(dict.fromkeys(" ".join(str(chapter.get("title") or "").split()) for chapter in group))
            theses = list(dict.fromkeys(" ".join(str(chapter.get("thesis") or "").split()) for chapter in group))
            points = list(dict.fromkeys(
                " ".join(str(point).split())
                for chapter in group
                for point in (chapter.get("keyPoints") or [])
            ))[:5]
            notes = list(dict.fromkeys(
                " ".join(str(chapter.get("evidenceNote") or "").split())
                for chapter in group
                if str(chapter.get("evidenceNote") or "").strip()
            ))
            output.append({
                "title": " / ".join(titles)[:80],
                "thesis": "；".join(theses)[:1000],
                "keyPoints": points,
                "evidenceIds": list(dict.fromkeys(
                    evidence_id
                    for chapter in group
                    for evidence_id in (chapter.get("evidenceIds") or [])
                )),
                "evidenceNote": "；".join(notes)[:500],
                "relationToPrevious": group[0].get("relationToPrevious", "continuation"),
            })
        return {"summary": result.get("summary"), "chapters": output}

    def _complete(
        self,
        user_payload: dict[str, Any],
        *,
        system_prompt: str = SYSTEM_PROMPT,
        temperature: float = 0.1,
    ) -> dict[str, Any]:
        """One request, with a bounded transport retry.

        The HARD request cap is enforced here, immediately before every
        outbound attempt, so the retries after a timeout, a malformed JSON or
        an invalid response count against the SAME cap as the regeneration
        routes.
        """
        last_error: MediaTaskStoreError | None = None
        for attempt in range(3):
            if not self._request_budget_available():
                raise MediaTaskStoreError(
                    "V352_SYNTHESIS_RESPONSE_INVALID",
                    "The grounded synthesis request budget is exhausted.",
                    status=502,
                )
            try:
                return self._complete_once(
                    user_payload,
                    system_prompt=system_prompt,
                    temperature=temperature,
                )
            except MediaTaskStoreError as error:
                last_error = error
                if error.code not in {"V352_SYNTHESIS_RESPONSE_INVALID", "V352_SYNTHESIS_TIMEOUT"} or attempt == 2:
                    raise
                time.sleep(0.5 * (2 ** attempt))
        assert last_error is not None
        raise last_error

    def _complete_once(
        self,
        user_payload: dict[str, Any],
        *,
        system_prompt: str = SYSTEM_PROMPT,
        temperature: float = 0.1,
    ) -> dict[str, Any]:
        self._guard_request_budget()
        user_bytes = _canonical(user_payload)
        self._requests.append(user_bytes)
        request = {
            "model": self.provider["model"],
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_bytes.decode("utf-8")},
            ],
            "thinking": {"type": "disabled"},
            "temperature": temperature,
            "max_completion_tokens": 12_000,
            "stream": False,
        }
        started = time.monotonic()
        attempt_id = hashlib.sha256(
            b"\x1f".join([user_bytes, str(time.time_ns()).encode("ascii")])
        ).hexdigest()[:16]
        self._attempt_id = f"attempt-{attempt_id}"
        try:
            with self.client_factory() as client:
                response = client.post(
                    str(self.provider["baseUrl"]).rstrip("/") + "/chat/completions",
                    headers={
                        "Authorization": f"Bearer {self.provider['apiKey']}",
                        "Content-Type": "application/json",
                    },
                    json=request,
                )
            response.raise_for_status()
            body = response.json()
            response_bytes = json.dumps(body, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
            self._response_sha256 = hashlib.sha256(response_bytes).hexdigest()
            self._latency_ms = round((time.monotonic() - started) * 1000)
            choices = body.get("choices")
            message = choices[0].get("message") if isinstance(choices, list) and choices else None
            content = message.get("content") if isinstance(message, dict) else None
            if not isinstance(content, str):
                raise ValueError("content")
            usage = body.get("usage") if isinstance(body.get("usage"), dict) else {}
            for source, target in (("prompt_tokens", "inputTokens"), ("completion_tokens", "outputTokens")):
                value = usage.get(source)
                if type(value) is int:
                    self._usage[target] += value
            finish = message.get("finish_reason") if isinstance(message, dict) else None
            if not isinstance(finish, str) or not finish:
                finish = body.get("choices", [{}])[0].get("finish_reason") if isinstance(body.get("choices"), list) and body["choices"] else None
            if finish in {"stop", "tool_calls", "length", "content_filter"}:
                self._finish_reason = finish
            else:
                self._finish_reason = "stop" if content else "empty"
            if message.get("refusal") if isinstance(message, dict) else False:
                self._finish_reason = "refusal"
            return _parse_json_object(content)
        except httpx.TimeoutException as error:
            self._finish_reason = "timeout"
            raise MediaTaskStoreError("V352_SYNTHESIS_TIMEOUT", "高质量理解请求超时，原本地结果保持不变。", status=504) from error
        except httpx.HTTPStatusError as error:
            status = getattr(getattr(error, "response", None), "status_code", 0)
            if status in (401, 403):
                self._finish_reason = "authorization_denied"
                raise MediaTaskStoreError(
                    "V352_SYNTHESIS_CREDENTIAL_REGION_MISMATCH",
                    "理解 Provider API Key 与所选区域不匹配或没有访问权限。",
                    status=401,
                ) from error
            self._finish_reason = "unavailable"
            raise MediaTaskStoreError("V352_SYNTHESIS_PROVIDER_UNAVAILABLE", "高质量理解服务请求失败，原本地结果保持不变。", status=503) from error
        except (httpx.HTTPError, json.JSONDecodeError, ValueError, KeyError) as error:
            self._finish_reason = "malformed"
            raise MediaTaskStoreError("V352_SYNTHESIS_RESPONSE_INVALID", "高质量理解服务返回了无效结构，原本地结果保持不变。", status=502) from error


class DeepSeekStrictGroundedSynthesisProvider(MiniMaxGroundedSynthesisProvider):
    """DeepSeek strict-tool adapter with no ordinary JSON fallback."""

    _TOOL_NAME = "submit_navia_grounded_contract"
    _RELATIONS = ["opening", "continuation", "contrast", "cause_effect", "example", "conclusion"]

    def __init__(
        self,
        provider: dict[str, Any],
        client_factory: Callable[[], httpx.Client] | None = None,
    ) -> None:
        super().__init__(provider=provider, client_factory=client_factory)
        self._endpoint_class = "deepseek_strict_tool"
        self._structure_mode = "deepseek_beta_strict_tool_v1"

    @staticmethod
    def _evidence_ids(payload: dict[str, Any]) -> list[str]:
        values: list[str] = []
        for field in ("evidence", "evidenceIndex"):
            items = payload.get(field)
            if isinstance(items, list):
                values.extend(
                    str(item["evidenceId"])
                    for item in items
                    if isinstance(item, dict) and isinstance(item.get("evidenceId"), str)
                )
        return list(dict.fromkeys(values))

    @classmethod
    def _schema_for_task(cls, payload: dict[str, Any]) -> dict[str, Any]:
        task = payload.get("task")
        evidence_ids = cls._evidence_ids(payload)
        if not evidence_ids:
            raise MediaTaskStoreError(
                "V352_SYNTHESIS_INPUT_INVALID",
                "严格结构请求缺少证据目录。",
                status=409,
            )
        evidence_array = {
            "type": "array",
            "minItems": 1,
            "uniqueItems": True,
            "items": {"type": "string", "enum": evidence_ids},
        }
        if task == "extract_grounded_chapter_candidates":
            return {
                "type": "object",
                "additionalProperties": False,
                "required": ["summary", "sections"],
                "properties": {
                    "summary": {"type": "string", "minLength": 8, "maxLength": 1000},
                    "sections": {
                        "type": "array",
                        "minItems": 1,
                        "maxItems": 12,
                        "items": {
                            "type": "object",
                            "additionalProperties": False,
                            "required": ["title", "thesis", "keyPoints", "evidenceIds", "evidenceNote"],
                            "properties": {
                                "title": {"type": "string", "minLength": 4, "maxLength": 80},
                                "thesis": {"type": "string", "minLength": 8, "maxLength": 1000},
                                "keyPoints": {
                                    "type": "array", "minItems": 2, "maxItems": 5,
                                    "items": {"type": "string", "minLength": 4, "maxLength": 240},
                                },
                                "evidenceIds": evidence_array,
                                "evidenceNote": {"type": "string", "maxLength": 500},
                            },
                        },
                    },
                },
            }
        if task in {
            "produce_grounded_comprehension_v2",
            "regenerate_grounded_comprehension_v2_shape",
            "regenerate_grounded_comprehension_v2_chapter_balance",
            "repair_grounded_comprehension_v2_temporal_contract",
            "repair_rejected_grounded_comprehension_v2",
        }:
            return {
                "type": "object",
                "additionalProperties": False,
                "required": ["brief", "claims", "chapters", "unresolvedEvidenceConflict"],
                "properties": {
                    "brief": {
                        "type": "object", "additionalProperties": False,
                        "required": ["text", "evidenceIds"],
                        "properties": {
                            "text": {"type": "string", "minLength": 20, "maxLength": 100},
                            "evidenceIds": evidence_array,
                        },
                    },
                    "claims": {
                        "type": "array", "minItems": 2, "maxItems": 8,
                        "items": {
                            "type": "object", "additionalProperties": False,
                            "required": ["text", "evidenceIds"],
                            "properties": {
                                "text": {"type": "string", "minLength": 8, "maxLength": 240},
                                "evidenceIds": evidence_array,
                            },
                        },
                    },
                    "chapters": {
                        "type": "array", "minItems": 2, "maxItems": 12,
                        "items": {
                            "type": "object", "additionalProperties": False,
                            "required": ["title", "thesis", "evidenceIds", "relationToPrevious"],
                            "properties": {
                                "title": {"type": "string", "minLength": 4, "maxLength": 80},
                                "thesis": {"type": "string", "minLength": 8, "maxLength": 500},
                                "evidenceIds": evidence_array,
                                "relationToPrevious": {"type": "string", "enum": cls._RELATIONS},
                            },
                        },
                    },
                    "unresolvedEvidenceConflict": {"type": "boolean"},
                },
            }
        if task == "answer_grounded_video_question":
            return {
                "type": "object",
                "additionalProperties": False,
                "required": ["status", "answerBlocks"],
                "properties": {
                    "status": {"type": "string", "enum": ["answered", "insufficient_evidence"]},
                    "answerBlocks": {
                        "type": "array", "maxItems": 6,
                        "items": {
                            "type": "object", "additionalProperties": False,
                            "required": ["text", "evidenceIds"],
                            "properties": {
                                "text": {"type": "string", "minLength": 8, "maxLength": 700},
                                "evidenceIds": evidence_array,
                            },
                        },
                    },
                },
            }
        raise MediaTaskStoreError(
            "V352_SYNTHESIS_TASK_UNSUPPORTED",
            "当前严格结构 Provider 不支持该任务。",
            status=409,
        )

    def _complete_once(
        self,
        user_payload: dict[str, Any],
        *,
        system_prompt: str = SYSTEM_PROMPT,
        temperature: float = 0.1,
    ) -> dict[str, Any]:
        schema = self._schema_for_task(user_payload)
        Draft202012Validator.check_schema(schema)
        self._guard_request_budget()
        user_bytes = _canonical(user_payload)
        self._requests.append(user_bytes)
        task = str(user_payload.get("task") or "")
        task_contract = ""
        if task in {
            "produce_grounded_comprehension_v2",
            "regenerate_grounded_comprehension_v2_shape",
            "regenerate_grounded_comprehension_v2_chapter_balance",
            "repair_grounded_comprehension_v2_temporal_contract",
            "repair_rejected_grounded_comprehension_v2",
        }:
            task_contract = (
                "\n本任务输出 brief 而不是旧版 summary。brief.text 必须是 20 至 100 个 Unicode 字符，"
                "该限制优先于通用提示中对 summary 句数的描述；claims 2 至 8 条，chapters 2 至 12 章。"
            )
        request = {
            "model": self.provider["model"],
            "messages": [
                {"role": "system", "content": system_prompt + task_contract},
                {"role": "user", "content": user_bytes.decode("utf-8")},
            ],
            "tools": [{
                "type": "function",
                "function": {
                    "name": self._TOOL_NAME,
                    "description": "Submit the complete Navia evidence-grounded contract.",
                    "strict": True,
                    "parameters": schema,
                },
            }],
            "tool_choice": {"type": "function", "function": {"name": self._TOOL_NAME}},
            "temperature": temperature,
            "max_tokens": 12_000,
            "stream": False,
        }
        try:
            with self.client_factory() as client:
                response = client.post(
                    str(self.provider["baseUrl"]).rstrip("/") + "/beta/chat/completions",
                    headers={
                        "Authorization": f"Bearer {self.provider['apiKey']}",
                        "Content-Type": "application/json",
                    },
                    json=request,
                )
            response.raise_for_status()
            body = response.json()
            choices = body.get("choices")
            message = choices[0].get("message") if isinstance(choices, list) and len(choices) == 1 else None
            calls = message.get("tool_calls") if isinstance(message, dict) else None
            if not isinstance(calls, list) or len(calls) != 1:
                raise ValueError("strict tool call missing")
            function = calls[0].get("function") if isinstance(calls[0], dict) else None
            if not isinstance(function, dict) or function.get("name") != self._TOOL_NAME:
                raise ValueError("strict tool name mismatch")
            arguments = function.get("arguments")
            if not isinstance(arguments, str):
                raise ValueError("strict tool arguments missing")
            value = json.loads(arguments)
            if not isinstance(value, dict):
                raise ValueError("strict tool result is not an object")
            errors = list(Draft202012Validator(schema).iter_errors(value))
            if errors:
                raise ValueError("strict tool result failed local schema validation")
            usage = body.get("usage") if isinstance(body.get("usage"), dict) else {}
            for source, target in (("prompt_tokens", "inputTokens"), ("completion_tokens", "outputTokens")):
                token_count = usage.get(source)
                if type(token_count) is int:
                    self._usage[target] += token_count
            return value
        except httpx.TimeoutException as error:
            raise MediaTaskStoreError("V352_SYNTHESIS_TIMEOUT", "高质量理解请求超时，原本地结果保持不变。", status=504) from error
        except httpx.HTTPStatusError as error:
            raise MediaTaskStoreError("V352_SYNTHESIS_PROVIDER_UNAVAILABLE", "高质量理解服务请求失败，原本地结果保持不变。", status=503) from error
        except (httpx.HTTPError, json.JSONDecodeError, ValueError, KeyError) as error:
            raise MediaTaskStoreError("V352_SYNTHESIS_RESPONSE_INVALID", "严格结构服务返回无效，原本地结果保持不变。", status=502) from error


def validate_synthesis(value: dict[str, Any], evidence: list[dict[str, Any]]) -> dict[str, Any]:
    if set(value) != {"summary", "chapters"}:
        raise MediaTaskStoreError("V352_SYNTHESIS_RESPONSE_INVALID", "Synthesis output fields are invalid.", status=502)
    summary = " ".join(str(value.get("summary") or "").split()).strip()
    chapters = value.get("chapters")
    if not 20 <= len(summary) <= 4000 or not isinstance(chapters, list) or not 2 <= len(chapters) <= 12:
        raise MediaTaskStoreError("V352_SYNTHESIS_RESPONSE_INVALID", "Synthesis summary or chapter count is invalid.", status=502)
    by_id = {item["evidenceId"]: item for item in evidence}
    allowed_relations = {"opening", "continuation", "contrast", "cause_effect", "example", "conclusion"}
    normalized: list[dict[str, Any]] = []
    seen_evidence: set[str] = set()
    prior_anchor = -1
    for index, chapter in enumerate(chapters):
        if not isinstance(chapter, dict):
            raise MediaTaskStoreError("V352_SYNTHESIS_RESPONSE_INVALID", "Synthesis chapter is invalid.", status=502)
        ids = list(dict.fromkeys(chapter.get("evidenceIds") or []))
        if not ids or any(item not in by_id for item in ids):
            raise MediaTaskStoreError("V352_SYNTHESIS_EVIDENCE_UNCLOSED", "Synthesis cited unknown evidence.", status=502)
        points = [" ".join(str(item).split()).strip() for item in chapter.get("keyPoints", [])]
        points = [item for item in dict.fromkeys(points) if 4 <= len(item) <= 240]
        # Trimming excess model detail removes claims but never creates or rewrites one.
        # Unknown evidence, missing support and temporal conflicts still fail closed below.
        points = points[:5]
        title = " ".join(str(chapter.get("title") or "").split()).strip()
        thesis = " ".join(str(chapter.get("thesis") or "").split()).strip()
        relation = str(chapter.get("relationToPrevious") or ("opening" if index == 0 else "continuation"))
        if not 4 <= len(title) <= 80 or not 8 <= len(thesis) <= 1000 or not 2 <= len(points) <= 5 or relation not in allowed_relations:
            raise MediaTaskStoreError("V352_SYNTHESIS_RESPONSE_INVALID", "Synthesis chapter content is invalid.", status=502)
        introduced = [item for item in ids if item not in seen_evidence]
        anchor_candidates = sorted({
            int(by_id[item]["timestampStartMs"])
            for item in (introduced or ids)
            if int(by_id[item]["timestampStartMs"]) > prior_anchor
        })
        if not anchor_candidates:
            raise MediaTaskStoreError("V352_SYNTHESIS_TIME_INVALID", "Synthesis chapters have no increasing evidence anchor.", status=502)
        start_ms = anchor_candidates[0]
        seen_evidence.update(ids)
        prior_anchor = start_ms
        normalized.append({
            "title": title,
            "thesis": thesis,
            "keyPoints": points,
            "evidenceIds": ids,
            "evidenceNote": " ".join(str(chapter.get("evidenceNote") or "").split())[:500],
            "relationToPrevious": relation,
            "startMs": start_ms,
            "endMs": 0,
        })
    duration_ms = max(int(item["timestampEndMs"]) for item in evidence)
    for index, chapter in enumerate(normalized):
        end_ms = normalized[index + 1]["startMs"] if index + 1 < len(normalized) else duration_ms
        if end_ms <= chapter["startMs"]:
            raise MediaTaskStoreError("V352_SYNTHESIS_TIME_INVALID", "Synthesis chapter navigation interval is invalid.", status=502)
        chapter["endMs"] = end_ms
    return {"summary": summary, "chapters": normalized}
