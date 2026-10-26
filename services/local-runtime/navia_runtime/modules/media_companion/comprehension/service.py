from __future__ import annotations

import hashlib
import json
import logging
import math
import re
from collections import Counter
from pathlib import Path
from typing import Any, Callable

from ..outline import canonical_hash
from ..task_store import MediaTaskStore, MediaTaskStoreError
from .quality import compose_brief_from_validated_claims, validate_grounded_comprehension
from .synthesis import GroundedSynthesisReceipt, MiniMaxGroundedSynthesisProvider, synthesis_style


_SENTENCE_SPLIT = re.compile(r"(?<=[。！？!?；;])\s*|\n+")
_LATIN_TOKEN = re.compile(r"[A-Za-z0-9_]{2,}")
_TRANSITION_PREFIX = re.compile(
    r"^(?:首先|第一|其次|第二|然后|接下来|随后|另一方面|最后|最终|总结|结论|这里|现在|我们(?:先|再|来|看))"
)
_VISUAL_KINDS = {"frame", "ocr_block", "vision_caption"}
_BRIEF_COMPOSER_FAILURES = {"V3510B_BRIEF_LENGTH_INVALID", "V3510B_BRIEF_RAW_PREFIX"}
_NO_RETRY_FAILURES = {
    "V3510B_PROVIDER_REFUSAL",
    "V3510B_PROVIDER_AUTHORIZATION_DENIED",
    "V3510B_PROVIDER_QUALIFICATION_DENIED",
    "V3510B_PROVIDER_REGION_MISMATCH",
    "V3510B_PROVIDER_CONTRACT_MISMATCH",
}
# The input-authority refusals. Every code here already exists in the frozen
# media failure inventory; this workpack adds no code and edits no inventory.
_INPUT_REFUSAL_MESSAGES = {
    "V3510B_TASK_REVISION_CONFLICT": "Task revision changed.",
    "V3_MEDIA_TRANSCRIPT_SOURCE_MISMATCH": "The media input does not belong to this task under this identity.",
    "V3_MEDIA_CROSS_TASK_REUSE": "The media input was prepared for another task or another run.",
    "V3_MEDIA_IMPORT_CANCELLED": "The local media import of this task was cancelled.",
    "V3_MEDIA_IMPORT_WRITE_FAILED": "The local media import of this task did not complete.",
    "V3_MEDIA_DEPENDENCY_NOT_READY": "The current dependency generation of this task could not be verified.",
}
_INPUT_REFUSAL_CODES = frozenset(_INPUT_REFUSAL_MESSAGES)
logger = logging.getLogger(__name__)


def _stable_id(prefix: str, *parts: object, length: int) -> str:
    digest = hashlib.sha256("\x1f".join(str(part) for part in parts).encode("utf-8")).hexdigest()
    return f"{prefix}_{digest[:length]}"


def _clean(value: object) -> str:
    return " ".join(str(value or "").split()).strip()


def _sentences(text: str) -> list[str]:
    result: list[str] = []
    for value in _SENTENCE_SPLIT.split(_clean(text)):
        sentence = value.strip(" ，,。！？!?；;：:")
        if len(sentence) >= 4 and sentence not in result:
            result.append(sentence)
    return result


def _tokens(text: str) -> set[str]:
    normalized = re.sub(r"\s+", "", text.lower())
    chinese = "".join(re.findall(r"[\u4e00-\u9fff]", normalized))
    grams = {chinese[index:index + 2] for index in range(max(0, len(chinese) - 1))}
    return grams | set(_LATIN_TOKEN.findall(normalized))


def _jaccard(left: set[str], right: set[str]) -> float:
    union = left | right
    return len(left & right) / len(union) if union else 1.0


class MediaComprehensionService:
    """Builds an evidence-closed local preview or validated grounded projection."""

    def __init__(
        self,
        store: MediaTaskStore,
        private_evidence_root: str | Path,
        synthesis_provider_factory: Callable[[], MiniMaxGroundedSynthesisProvider] | None = None,
        input_authority: Any | None = None,
    ) -> None:
        self._store = store
        self._private_root = Path(private_evidence_root).resolve()
        self._synthesis_provider_factory = synthesis_provider_factory
        # The ONE composition point that binds the input of a task to the
        # grounded chain. When no authority is injected, the service composes
        # the default one from the durable owners of the SAME Runtime: the
        # local-import binding and the task's dependency lease.
        self._input_authority = input_authority
        self._default_input_authority: Any | None = None

    def get(self, task_id: str, expected_revision: int | None = None) -> dict[str, Any]:
        task = self._store.get(task_id)
        if expected_revision is not None and task["revision"] != expected_revision:
            raise MediaTaskStoreError("TASK_REVISION_CONFLICT", "Task revision changed.", status=409)
        bundle = task.get("projections")
        if task["state"] not in {"ready", "degraded"} or not isinstance(bundle, dict) or not bundle.get("outline"):
            raise MediaTaskStoreError("V351_TASK_NOT_READY", "Workspace comprehension requires a published media task.", status=409)
        catalog = bundle.get("evidenceCatalog")
        if not isinstance(catalog, list) or not catalog:
            raise MediaTaskStoreError("V351_EVIDENCE_REQUIRED", "Workspace comprehension requires evidence.", status=409)
        evidence = [self._evidence_with_text(item) for item in catalog]
        ordered = sorted(evidence, key=lambda item: (item["timestampStartMs"], item["timestampEndMs"], item["evidenceId"]))
        duration_ms = max(item["timestampEndMs"] for item in ordered)
        evidence_sha256 = canonical_hash([
            {key: item[key] for key in ("evidenceId", "contentSha256", "timestampStartMs", "timestampEndMs")}
            for item in ordered
        ])
        grounded_v2 = (
            self._load_grounded_v2_1(task_id, task["revision"], evidence_sha256)
            or self._load_grounded_v2(task_id, task["revision"], evidence_sha256)
        )
        synthesis = self._load_synthesis(task_id, task["revision"], evidence_sha256) if grounded_v2 is None else None
        grounded_result = None
        if grounded_v2 is not None:
            grounded_result = {
                "summary": grounded_v2["brief"]["text"],
                "chapters": [{
                    **chapter,
                    "keyPoints": [chapter["thesis"]],
                    "evidenceNote": "",
                } for chapter in grounded_v2["chapters"]],
            }
        projection_result = grounded_result or (synthesis["result"] if synthesis else None)
        chapters = (
            self._synthesized_chapters(task_id, task["revision"], ordered, projection_result)
            if projection_result else self._chapters(task_id, task["revision"], ordered, duration_ms)
        )
        outline_id = _stable_id(
            "outline", task_id, task["revision"], "grounded-v2" if grounded_v2 else ("comprehension-v2" if synthesis else "comprehension-v1"),
            evidence_sha256,
            canonical_hash(projection_result) if projection_result else "local",
            synthesis.get("style", "structured") if synthesis else ("structured" if grounded_v2 else "local"),
            length=32,
        )
        title = _clean(bundle["outline"].get("title")) or task["sourceIdentity"].split(":")[2]
        outline = {
            "outlineId": outline_id,
            "taskId": task_id,
            "taskRevision": task["revision"],
            "title": title[:240],
            "summary": projection_result["summary"] if projection_result else " ".join(chapter["thesis"] for chapter in chapters)[:4000],
            "chapters": chapters,
        }
        outline["contentSha256"] = canonical_hash(outline)
        timeline = self._timeline(outline_id, chapters, ordered)
        mindmap = self._mindmap(outline_id, task_id, title, chapters)
        public_catalog = [
            {
                **{key: item[key] for key in (
                    "evidenceId", "taskId", "kind", "timestampStartMs", "timestampEndMs",
                    "contentSha256", "relativeArtifactRef",
                )},
                "thumbnailAvailable": bool(item.get("thumbnailRelativeRef")),
                "excerpt": item["text"][:280],
            }
            for item in ordered
        ]
        return {
            "schemaVersion": "v3-media-workspace-comprehension-projection/v2" if projection_result else "v3-media-workspace-comprehension-projection/v1",
            "task": {
                "taskId": task_id,
                "taskRevision": task["revision"],
                "sourceIdentity": task["sourceIdentity"],
                "mediaDurationMs": duration_ms,
                "outlineId": outline_id,
            },
            "authorization": {
                "groundedTextCloudStatus": "granted" if projection_result else "disabled",
                "providerId": (grounded_v2 or synthesis)["receipt"]["providerId"] if projection_result else None,
                "modelId": (grounded_v2 or synthesis)["receipt"]["modelId"] if projection_result else None,
                "outboundDerivedTextSha256": (grounded_v2 or synthesis)["receipt"]["outboundDerivedTextSha256"] if projection_result else None,
                "rawMediaUploadCount": 0,
            },
            "quality": {
                "mode": "grounded_model" if projection_result else "local_extract_only",
                "humanQualityReviewRequired": True,
                "warning": (
                    "当前结果证据覆盖受限，不能标记为完整视频理解。"
                    if grounded_v2 and grounded_v2["quality"]["status"] == "limited"
                    else (None if projection_result else "当前为本地提取预览，不能代表完整视频理解。")
                ),
                "style": synthesis.get("style") if synthesis else None,
                "styleRisk": synthesis.get("styleRisk") if synthesis else None,
                "status": grounded_v2["quality"]["status"] if grounded_v2 else None,
                "failureCodes": grounded_v2["quality"]["failureCodes"] if grounded_v2 else [],
            },
            "grounded": ({
                "brief": grounded_v2["brief"],
                "claims": grounded_v2["claims"],
                "regions": grounded_v2["regions"],
            } if grounded_v2 else None),
            "evidenceCatalog": public_catalog,
            "outline": outline,
            "timeline": timeline,
            "mindmap": mindmap,
        }

    def _write_stage_b_diagnostic(
        self,
        *,
        task_id: str,
        stage: str,
        failure_code: str,
        candidate: Any,
        evidence: list[dict[str, Any]],
        provider: Any = None,
    ) -> None:
        """Write the PRIVATE redacted diagnostic of a failed validation stage.

        It is an internal record: it never changes a public endpoint, a public
        schema or a public error envelope, and it never contains a Provider
        response, a transcript, an evidence text, a title, a Cookie, a key, a
        private path, raw media or an evidence id.
        """
        from .diagnostics import build_stage_b_diagnostic

        stages: list[dict[str, Any]] = []
        for entry in getattr(provider, "stage_b_diagnostics", []) or []:
            if isinstance(entry, dict):
                stages.append(entry)
        stages.append(build_stage_b_diagnostic(
            stage=stage,
            failure_code=failure_code,
            candidate=candidate,
            evidence=evidence,
            final_outcome="fail_closed",
            provider_outbound_http_attempts=self._provider_outbound_attempts(provider),
        ))
        payload = {
            "schemaVersion": "v3-media-grounded-chapter-diagnostic-set/v1",
            "taskId": task_id,
            "stages": stages,
        }
        try:
            directory = self._private_root / "diagnostics" / task_id
            directory.mkdir(parents=True, exist_ok=True, mode=0o700)
            target = directory / "stage-b-diagnostic.json"
            temporary = target.with_name(target.name + ".tmp")
            temporary.write_bytes(
                json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
            )
            try:
                temporary.chmod(0o600)
            except OSError:
                pass
            temporary.replace(target)
        except OSError:
            # The diagnostic is a record, never a gate: a failed write must not
            # change the failure the caller sees.
            logger.warning("V3510B_DIAGNOSTIC_WRITE_FAILED taskId=%s stage=%s", task_id, stage)

    @staticmethod
    def _provider_outbound_attempts(provider: Any) -> int | None:
        """The ACTUAL number of outbound Provider HTTP attempts.

        It is owned by the production adapter and it is a COUNT only: no
        response text, no prompt, no evidence id, no path and no secret.
        """
        value = getattr(provider, "provider_outbound_http_attempts", None)
        if isinstance(value, int) and not isinstance(value, bool) and value >= 0:
            return value
        return None

    @staticmethod
    def _provider_receipt_extras(provider: Any) -> dict[str, Any]:
        """The Provider's receipt extras, read AFTER its request."""
        extras = getattr(provider, "b5_provider_receipt_extras", None)
        if callable(extras):
            try:
                extras = extras()
            except Exception:  # noqa: BLE001 - the extras are a record, not a gate
                extras = {}
        return extras if isinstance(extras, dict) else {}

    def _default_authority(self) -> Any:
        """The default input authority, composed from the durable owners.

        It is composed once per service and reads only the durable owners. It
        carries NO dependency-generation resolver, so a LOCAL input can never
        be verified against a CURRENT generation here and the local route is
        refused before the Provider. The production composition in
        `navia_runtime/app.py` injects the manager-owned resolver.
        """
        if self._default_input_authority is None:
            from ..input_authority import MediaInputAuthority

            self._default_input_authority = MediaInputAuthority.for_task_store(self._store)
        return self._default_input_authority

    def _require_current_input(self, task_id: str, expected_revision: int) -> None:
        """Refuse a task whose input is not the CURRENT task's own input.

        The refusal happens BEFORE any Provider is asked and again before the
        publication, so a stale or foreign asset can never reach a Provider
        and can never be published.
        """
        authority = self._input_authority
        if authority is None:
            authority = self._default_authority()
        try:
            authority.require_current_input(
                task_id, expected_revision=expected_revision
            )
        except ValueError as error:
            code = str(error)
            if code in _INPUT_REFUSAL_CODES:
                raise MediaTaskStoreError(
                    code, _INPUT_REFUSAL_MESSAGES[code], status=409,
                ) from error
            raise MediaTaskStoreError(
                "V3_MEDIA_TRANSCRIPT_SOURCE_MISMATCH",
                "The media input does not belong to this task under this identity.",
                status=409,
            ) from error

    def synthesize(self, task_id: str, expected_revision: int, consent: bool, style: str = "structured") -> dict[str, Any]:
        self._store.require_current_authority(task_id)
        # G1: the input must be the current task's own input BEFORE any
        # Provider is asked.
        self._require_current_input(task_id, expected_revision)
        if consent is not True:
            raise MediaTaskStoreError(
                "V3510B_CONSENT_REQUIRED",
                "发送派生字幕与画面描述前需要本次任务授权。",
                status=403,
            )
        if self._synthesis_provider_factory is None:
            raise MediaTaskStoreError("V352_SYNTHESIS_PROVIDER_MISSING", "没有可用的高质量理解模型。", status=409)
        style_risk = synthesis_style(style)
        task = self._store.get(task_id)
        if task["revision"] != expected_revision:
            raise MediaTaskStoreError("V3510B_TASK_REVISION_CONFLICT", "Task revision changed.", status=409)
        bundle = task.get("projections")
        if task["state"] not in {"ready", "degraded"} or not isinstance(bundle, dict):
            raise MediaTaskStoreError("V351_TASK_NOT_READY", "Workspace comprehension requires a published media task.", status=409)
        evidence = [self._evidence_with_text(item) for item in bundle.get("evidenceCatalog", [])]
        ordered = sorted(evidence, key=lambda item: (item["timestampStartMs"], item["timestampEndMs"], item["evidenceId"]))
        if not ordered:
            raise MediaTaskStoreError("V351_EVIDENCE_REQUIRED", "Workspace comprehension requires evidence.", status=409)
        evidence_sha256 = canonical_hash([
            {key: item[key] for key in ("evidenceId", "contentSha256", "timestampStartMs", "timestampEndMs")}
            for item in ordered
        ])
        title = _clean(bundle.get("outline", {}).get("title")) or task["sourceIdentity"].split(":")[2]
        outbound = [{
            "evidenceId": item["evidenceId"],
            "kind": item["kind"],
            "timestampStartMs": item["timestampStartMs"],
            "timestampEndMs": item["timestampEndMs"],
            "text": item["text"],
        } for item in ordered]
        provider = self._synthesis_provider_factory()
        # The Provider's receipt extras (attempt id, request/response digests,
        # latency, finish reason) are a record of the request that ALREADY
        # HAPPENED. They are therefore read AFTER the request, never before it:
        # reading them before would publish an empty attemptId and empty
        # digests, and the published V2.1 derivative would not satisfy the
        # frozen schema.
        provider_receipt_extras = {}
        if hasattr(provider, "synthesize_v2"):
            try:
                candidate, receipt = provider.synthesize_v2(title=title, evidence=outbound, style=style)
            except MediaTaskStoreError as error:
                # The adapter refused. The INTERNAL diagnostic records the
                # ACTUAL number of outbound Provider HTTP attempts, so the
                # runner never has to guess one attempt per endpoint call.
                self._write_stage_b_diagnostic(
                    task_id=task_id,
                    stage="provider_attempt",
                    failure_code=error.code,
                    candidate=None,
                    evidence=ordered,
                    provider=provider,
                )
                if error.code == "V352_SYNTHESIS_TIMEOUT":
                    raise MediaTaskStoreError("V3510B_PROVIDER_TIMEOUT", str(error), status=error.status) from error
                if error.code == "V352_SYNTHESIS_PROVIDER_UNAVAILABLE":
                    raise MediaTaskStoreError("V3510B_PROVIDER_UNAVAILABLE", str(error), status=error.status) from error
                if error.code == "V352_SYNTHESIS_CREDENTIAL_REGION_MISMATCH":
                    raise MediaTaskStoreError("V3510B_PROVIDER_AUTHORIZATION_DENIED", str(error), status=error.status) from error
                if error.code.startswith("V352_SYNTHESIS_"):
                    raise MediaTaskStoreError("V3510B_PROVIDER_RESPONSE_INVALID", str(error), status=error.status) from error
                raise
            provider_receipt_extras = self._provider_receipt_extras(provider)
            validation_args = {
                "task_id": task_id,
                "task_revision": expected_revision,
                "source_identity": task["sourceIdentity"],
                "evidence_catalog_sha256": evidence_sha256,
                "media_duration_ms": max(item["timestampEndMs"] for item in ordered),
                "schema_version": "v3-media-grounded-comprehension/v2.1",
                "provider_receipt_extras": provider_receipt_extras,
            }
            try:
                derivative = validate_grounded_comprehension(
                    candidate, ordered, receipt=self._receipt_dict(receipt), **validation_args,
                )
            except MediaTaskStoreError as error:
                self._write_stage_b_diagnostic(
                    task_id=task_id,
                    stage="validator_initial",
                    failure_code=error.code,
                    candidate=candidate,
                    evidence=ordered,
                    provider=provider,
                )
                if error.code in _NO_RETRY_FAILURES:
                    logger.warning(
                        "V3510B_NO_REPAIR taskId=%s revision=%s code=%s",
                        task_id, expected_revision, error.code,
                    )
                    raise
                repair = getattr(provider, "repair_v2", None)
                if repair is None or not error.code.startswith("V3510B_"):
                    raise
                try:
                    candidate, receipt = repair(
                        title=title, evidence=outbound, candidate=candidate,
                        failure_code=error.code, style=style,
                    )
                except MediaTaskStoreError as repair_refusal:
                    # The bounded repair REFUSED. The INTERNAL diagnostic
                    # records the ACTUAL number of outbound Provider HTTP
                    # attempts, so the runner never has to guess one attempt
                    # per endpoint call, and it records the FINAL refusal
                    # rather than the previous one.
                    self._write_stage_b_diagnostic(
                        task_id=task_id,
                        stage="provider_bounded_repair",
                        failure_code=repair_refusal.code,
                        candidate=None,
                        evidence=ordered,
                        provider=provider,
                    )
                    raise
                provider_receipt_extras = self._provider_receipt_extras(provider)
                validation_args["provider_receipt_extras"] = provider_receipt_extras
                try:
                    derivative = validate_grounded_comprehension(
                        candidate, ordered, receipt=self._receipt_dict(receipt), **validation_args,
                    )
                except MediaTaskStoreError as repair_error:
                    self._write_stage_b_diagnostic(
                        task_id=task_id,
                        stage="validator_bounded_repair",
                        failure_code=repair_error.code,
                        candidate=candidate,
                        evidence=ordered,
                        provider=provider,
                    )
                    if repair_error.code in _NO_RETRY_FAILURES:
                        logger.warning(
                            "V3510B_NO_COMPOSER taskId=%s revision=%s code=%s",
                            task_id, expected_revision, repair_error.code,
                        )
                        raise
                    if repair_error.code not in _BRIEF_COMPOSER_FAILURES:
                        raise
                    composition = compose_brief_from_validated_claims(
                        candidate,
                        ordered,
                        task_id=task_id,
                        task_revision=expected_revision,
                        media_duration_ms=validation_args["media_duration_ms"],
                    )
                    if composition is None:
                        logger.warning(
                            "V3510B_COMPOSER_NO_VALID_SUBSET taskId=%s revision=%s catalog=%s original=%s",
                            task_id,
                            expected_revision,
                            evidence_sha256,
                            repair_error.code,
                        )
                        raise
                    derivative = validate_grounded_comprehension(
                        composition.candidate,
                        ordered,
                        receipt=self._receipt_dict(receipt),
                        brief_origin="deterministic_claim_composer",
                        source_claim_indexes=composition.source_claim_indexes,
                        **validation_args,
                    )
            # Coverage-only output is valid and publishable, but the brief can
            # often be completed without another cloud request. Recompose it
            # exclusively from already validated claims; if no closed subset
            # exists, retain the honest limited result unchanged.
            if derivative["quality"]["failureCodes"] == ["V3510B_BRIEF_COVERAGE_INSUFFICIENT"]:
                composition = compose_brief_from_validated_claims(
                    candidate,
                    ordered,
                    task_id=task_id,
                    task_revision=expected_revision,
                    media_duration_ms=validation_args["media_duration_ms"],
                )
                if composition is not None:
                    derivative = validate_grounded_comprehension(
                        composition.candidate,
                        ordered,
                        receipt=self._receipt_dict(receipt),
                        brief_origin="deterministic_claim_composer",
                        source_claim_indexes=composition.source_claim_indexes,
                        **validation_args,
                    )
            # G1: the authority is checked again immediately before the
            # atomic publication, so a task that moved during the Provider
            # call can never publish.
            self._require_current_input(task_id, expected_revision)
            self._assert_current_binding(task_id, expected_revision, evidence_sha256)
            self._save_grounded_v2_1(derivative)
        else:
            result, receipt = provider.synthesize(title=title, evidence=outbound, style=style)
            self._store.require_current_authority(task_id)
            # The V1 route publishes its own bytes, so the same input
            # authority applies to it.
            self._require_current_input(task_id, expected_revision)
            self._save_synthesis(task_id, expected_revision, evidence_sha256, result, receipt, style, style_risk)
        return self.get(task_id, expected_revision)

    def _synthesis_path(self, task_id: str, revision: int) -> Path:
        return self._private_root / "synthesis" / task_id / f"revision-{revision}.json"

    def _grounded_v2_path(self, task_id: str, revision: int, evidence_sha256: str) -> Path:
        return self._private_root / "grounded-comprehension-v2" / task_id / f"revision-{revision}" / f"{evidence_sha256}.json"

    def _grounded_v2_1_path(self, task_id: str, revision: int, evidence_sha256: str) -> Path:
        return self._private_root / "grounded-comprehension-v2.1" / task_id / f"revision-{revision}" / f"{evidence_sha256}.json"

    def _load_grounded_v2_1(self, task_id: str, revision: int, evidence_sha256: str) -> dict[str, Any] | None:
        return self._load_versioned_grounded(
            self._grounded_v2_1_path(task_id, revision, evidence_sha256),
            "v3-media-grounded-comprehension/v2.1",
            task_id,
            revision,
            evidence_sha256,
        )

    def _load_grounded_v2(self, task_id: str, revision: int, evidence_sha256: str) -> dict[str, Any] | None:
        return self._load_versioned_grounded(
            self._grounded_v2_path(task_id, revision, evidence_sha256),
            "v3-media-grounded-comprehension/v2",
            task_id,
            revision,
            evidence_sha256,
        )

    @staticmethod
    def _load_versioned_grounded(
        path: Path,
        schema_version: str,
        task_id: str,
        revision: int,
        evidence_sha256: str,
    ) -> dict[str, Any] | None:
        try:
            value = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return None
        binding = value.get("binding") if isinstance(value, dict) else None
        if value.get("schemaVersion") != schema_version or not isinstance(binding, dict):
            return None
        if (binding.get("taskId"), binding.get("taskRevision"), binding.get("evidenceCatalogSha256")) != (task_id, revision, evidence_sha256):
            return None
        return value

    def _assert_current_binding(self, task_id: str, revision: int, evidence_sha256: str) -> None:
        self._store.require_current_authority(task_id)
        task = self._store.get(task_id)
        if task["revision"] != revision:
            raise MediaTaskStoreError("V3510B_TASK_REVISION_CONFLICT", "Task revision changed before commit.", status=409)
        bundle = task.get("projections") or {}
        evidence = [self._evidence_with_text(item) for item in bundle.get("evidenceCatalog", [])]
        ordered = sorted(evidence, key=lambda item: (item["timestampStartMs"], item["timestampEndMs"], item["evidenceId"]))
        current_hash = canonical_hash([
            {key: item[key] for key in ("evidenceId", "contentSha256", "timestampStartMs", "timestampEndMs")}
            for item in ordered
        ])
        if current_hash != evidence_sha256:
            raise MediaTaskStoreError("V3510B_EVIDENCE_CATALOG_CHANGED", "Evidence catalog changed before commit.", status=409)

    def _save_grounded_v2(self, value: dict[str, Any]) -> None:
        binding = value["binding"]
        path = self._grounded_v2_path(binding["taskId"], binding["taskRevision"], binding["evidenceCatalogSha256"])
        self._atomic_save_grounded(path, value)

    def _save_grounded_v2_1(self, value: dict[str, Any]) -> None:
        if value.get("schemaVersion") != "v3-media-grounded-comprehension/v2.1":
            raise MediaTaskStoreError("V3510B_PROVIDER_RESPONSE_INVALID", "V2.1 writer requires a V2.1 derivative.", status=500)
        binding = value["binding"]
        path = self._grounded_v2_1_path(binding["taskId"], binding["taskRevision"], binding["evidenceCatalogSha256"])
        self._atomic_save_grounded(path, value)

    @staticmethod
    def _atomic_save_grounded(path: Path, value: dict[str, Any]) -> None:
        path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        temporary = path.with_name(path.name + ".tmp")
        temporary.write_bytes(json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8"))
        try:
            temporary.chmod(0o600)
        except OSError:
            pass
        temporary.replace(path)

    @staticmethod
    def _receipt_dict(receipt: GroundedSynthesisReceipt) -> dict[str, Any]:
        return {
            "providerId": receipt.provider_id,
            "modelId": receipt.model_id,
            "outboundDerivedTextSha256": receipt.outbound_sha256,
            "requestCount": receipt.request_count,
            "usage": dict(receipt.usage) if isinstance(getattr(receipt, "usage", None), dict) else {},
        }

    def _load_synthesis(self, task_id: str, revision: int, evidence_sha256: str) -> dict[str, Any] | None:
        path = self._synthesis_path(task_id, revision)
        try:
            value = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return None
        if not isinstance(value, dict) or value.get("evidenceSha256") != evidence_sha256:
            return None
        if not isinstance(value.get("result"), dict) or not isinstance(value.get("receipt"), dict):
            return None
        return value

    def _save_synthesis(
        self,
        task_id: str,
        revision: int,
        evidence_sha256: str,
        result: dict[str, Any],
        receipt: GroundedSynthesisReceipt,
        style: str,
        style_risk: dict[str, str],
    ) -> None:
        path = self._synthesis_path(task_id, revision)
        path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        value = {
            "schemaVersion": "v3-grounded-media-synthesis/v1",
            "taskId": task_id,
            "taskRevision": revision,
            "evidenceSha256": evidence_sha256,
            "style": style,
            "styleRisk": {key: style_risk[key] for key in ("label", "riskLevel", "riskCode", "riskDescription")},
            "result": result,
            "receipt": {
                "providerId": receipt.provider_id,
                "modelId": receipt.model_id,
                "outboundDerivedTextSha256": receipt.outbound_sha256,
                "requestCount": receipt.request_count,
                "usage": receipt.usage,
                "rawMediaUploadCount": 0,
            },
        }
        temporary = path.with_suffix(".tmp")
        temporary.write_bytes(json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8"))
        temporary.replace(path)
        try:
            path.chmod(0o600)
        except OSError:
            pass

    @staticmethod
    def _synthesized_chapters(
        task_id: str,
        revision: int,
        evidence: list[dict[str, Any]],
        result: dict[str, Any],
    ) -> list[dict[str, Any]]:
        by_id = {item["evidenceId"]: item for item in evidence}
        chapters: list[dict[str, Any]] = []
        for order, value in enumerate(result["chapters"]):
            ids = list(value["evidenceIds"])
            frames = [by_id[item] for item in ids if by_id[item]["kind"] == "frame"]
            midpoint = value["startMs"] + (value["endMs"] - value["startMs"]) // 2
            representative = min(frames, key=lambda item: abs(item["timestampStartMs"] - midpoint))["evidenceId"] if frames else None
            chapters.append({
                "chapterId": _stable_id("chapter", task_id, revision, "grounded", order, value["startMs"], length=16),
                "parentChapterId": None,
                "depth": 1,
                "order": order,
                "startMs": value["startMs"],
                "endMs": value["endMs"],
                "title": value["title"],
                "thesis": value["thesis"],
                "keyPoints": list(value["keyPoints"]),
                "evidenceIds": ids,
                "representativeFrameEvidenceId": representative,
                "evidenceNote": value.get("evidenceNote", ""),
                "relationToPrevious": value.get("relationToPrevious", "continuation"),
            })
        return chapters

    def thumbnail(self, task_id: str, evidence_id: str) -> Path:
        task = self._store.get(task_id)
        bundle = task.get("projections") or {}
        item = next((value for value in bundle.get("evidenceCatalog", []) if value.get("evidenceId") == evidence_id), None)
        if not item or item.get("kind") != "frame":
            raise MediaTaskStoreError("V351_THUMBNAIL_NOT_FOUND", "Frame thumbnail was not found.", status=404)
        metadata = self._read_metadata(item)
        relative = metadata.get("thumbnailRelativeRef")
        if not isinstance(relative, str):
            raise MediaTaskStoreError("V351_THUMBNAIL_NOT_FOUND", "Frame thumbnail was not retained.", status=404)
        target = (self._private_root / relative).resolve()
        if self._private_root not in target.parents or not target.is_file() or target.suffix.lower() != ".png":
            raise MediaTaskStoreError("V351_THUMBNAIL_NOT_FOUND", "Frame thumbnail is unavailable.", status=404)
        return target

    def _evidence_with_text(self, item: dict[str, Any]) -> dict[str, Any]:
        if item.get("taskId") is None:
            raise MediaTaskStoreError("V351_EVIDENCE_ORPHAN", "Evidence task binding is missing.", status=409)
        metadata = self._read_metadata(item)
        text = _clean(metadata.get("text"))
        if not text:
            raise MediaTaskStoreError("V351_EVIDENCE_REQUIRED", "Evidence text is unavailable.", status=409)
        return {**item, "text": text, "thumbnailRelativeRef": metadata.get("thumbnailRelativeRef")}

    def _read_metadata(self, item: dict[str, Any]) -> dict[str, Any]:
        target = (self._private_root / str(item.get("relativeArtifactRef", ""))).resolve()
        if self._private_root not in target.parents or not target.is_file():
            raise MediaTaskStoreError("V351_EVIDENCE_UNAVAILABLE", "Private evidence is unavailable.", status=409)
        try:
            value = json.loads(target.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as error:
            raise MediaTaskStoreError("V351_EVIDENCE_UNAVAILABLE", "Private evidence metadata is invalid.", status=409) from error
        if not isinstance(value, dict) or value.get("contentSha256") != item.get("contentSha256"):
            raise MediaTaskStoreError("V351_EVIDENCE_HASH_MISMATCH", "Private evidence metadata changed.", status=409)
        return value

    def _chapters(
        self,
        task_id: str,
        revision: int,
        evidence: list[dict[str, Any]],
        duration_ms: int,
    ) -> list[dict[str, Any]]:
        transcript = [item for item in evidence if item["kind"] == "transcript"]
        units = self._transcript_units(transcript or evidence)
        count = len(units)
        target_count = min(12, count, max(1, round(math.sqrt(count))))
        if count >= 3:
            target_count = max(3, target_count)
        boundary_scores: list[tuple[float, int]] = []
        for index in range(1, count):
            previous, current = units[index - 1], units[index]
            similarity = _jaccard(_tokens(previous["text"]), _tokens(current["text"]))
            gap = max(0, current["timestampStartMs"] - previous["timestampEndMs"])
            cue = 1.5 if _TRANSITION_PREFIX.search(current["text"]) else 0.0
            score = (1.0 - similarity) * 4.0 + min(2.0, gap / 10_000) + cue
            boundary_scores.append((score, index))
        selected = {index for _, index in sorted(boundary_scores, key=lambda item: (-item[0], item[1]))[: max(0, target_count - 1)]}
        boundaries = [0, *sorted(selected), count]
        chapters = []
        for order, (start, end) in enumerate(zip(boundaries, boundaries[1:])):
            items = units[start:end]
            key_points = self._key_points(items)
            title = self._chapter_title(items, key_points, order)
            start_ms = items[0]["timestampStartMs"]
            end_ms = min(duration_ms, max(item["timestampEndMs"] for item in items))
            if end_ms <= start_ms:
                end_ms = min(duration_ms, start_ms + 1)
            attached = [
                item for item in evidence
                if item["timestampStartMs"] < end_ms and item["timestampEndMs"] > start_ms
            ]
            if not attached:
                attached = [min(evidence, key=lambda item: abs(item["timestampStartMs"] - start_ms))]
            midpoint = start_ms + (end_ms - start_ms) // 2
            frames = [item for item in attached if item["kind"] == "frame"]
            representative = min(frames, key=lambda item: abs(item["timestampStartMs"] - midpoint))["evidenceId"] if frames else None
            chapter_id = _stable_id("chapter", task_id, revision, order, start_ms, end_ms, length=16)
            evidence_ids = list(dict.fromkeys(item["evidenceId"] for item in attached))
            chapters.append({
                "chapterId": chapter_id,
                "parentChapterId": None,
                "depth": 1,
                "order": order,
                "startMs": start_ms,
                "endMs": end_ms,
                "title": title,
                "thesis": "；".join(key_points[:2])[:1000],
                "keyPoints": key_points,
                "evidenceIds": evidence_ids,
                "representativeFrameEvidenceId": representative,
            })
        return chapters

    @staticmethod
    def _transcript_units(evidence: list[dict[str, Any]]) -> list[dict[str, Any]]:
        units: list[dict[str, Any]] = []
        for item in evidence:
            sentences = _sentences(item["text"])
            if len(sentences) < 3 and len(item["text"]) >= 18:
                text = _clean(item["text"])
                width = max(6, math.ceil(len(text) / 3))
                sentences = [text[index:index + width] for index in range(0, len(text), width)]
            sentences = sentences or [item["text"]]
            span = max(1, item["timestampEndMs"] - item["timestampStartMs"])
            for index, sentence in enumerate(sentences):
                start_ms = item["timestampStartMs"] + round(span * index / len(sentences))
                end_ms = item["timestampStartMs"] + round(span * (index + 1) / len(sentences))
                units.append({
                    **item,
                    "timestampStartMs": start_ms,
                    "timestampEndMs": max(start_ms + 1, end_ms),
                    "text": sentence,
                })
        return sorted(units, key=lambda item: (item["timestampStartMs"], item["timestampEndMs"], item["evidenceId"]))

    @staticmethod
    def _key_points(items: list[dict[str, Any]]) -> list[str]:
        candidates: list[str] = []
        for item in items:
            for sentence in _sentences(item["text"]):
                normalized = _TRANSITION_PREFIX.sub("", sentence).strip(" ，,：:")
                if normalized and normalized not in candidates:
                    candidates.append(normalized[:180])
        if not candidates:
            candidates.append(_clean(items[0]["text"])[:180])
        group_tokens = Counter(token for item in items for token in _tokens(item["text"]))
        candidates.sort(key=lambda sentence: (-sum(group_tokens[token] for token in _tokens(sentence)), len(sentence)))
        return candidates[:4]

    @staticmethod
    def _chapter_title(items: list[dict[str, Any]], key_points: list[str], order: int) -> str:
        visual = next((item for item in items if item["kind"] in _VISUAL_KINDS), None)
        sentence = key_points[0] if key_points else _clean(items[0]["text"])
        sentence = re.sub(r"^(?:这个|这里|视频|我们)", "", sentence).strip(" ，,：:")
        if len(sentence) > 26:
            clause = re.split(r"[，,：:（(]", sentence, maxsplit=1)[0]
            sentence = clause if len(clause) >= 6 else sentence[:26]
        suffix = "与画面" if visual and len(sentence) <= 20 else ""
        return (sentence + suffix or f"主题 {order + 1}")[:40]

    @staticmethod
    def _timeline(outline_id: str, chapters: list[dict[str, Any]], evidence: list[dict[str, Any]]) -> dict[str, Any]:
        evidence_by_id = {item["evidenceId"]: item for item in evidence}
        moments: list[dict[str, Any]] = []
        for chapter in chapters:
            first_evidence = evidence_by_id[chapter["evidenceIds"][0]]
            moments.append({
                "momentId": _stable_id("moment", outline_id, chapter["chapterId"], "chapter", length=16),
                "chapterId": chapter["chapterId"], "timestampMs": chapter["startMs"], "kind": "chapter",
                "title": chapter["title"], "evidenceIds": [first_evidence["evidenceId"]], "frameEvidenceId": None,
            })
            for index, point in enumerate(chapter["keyPoints"][:2]):
                source = evidence_by_id[chapter["evidenceIds"][min(index, len(chapter["evidenceIds"]) - 1)]]
                point_count = min(2, len(chapter["keyPoints"]))
                semantic_timestamp = chapter["startMs"] + round(
                    (chapter["endMs"] - chapter["startMs"]) * (index + 1) / (point_count + 1)
                )
                moments.append({
                    "momentId": _stable_id("moment", outline_id, chapter["chapterId"], "point", index, length=16),
                    "chapterId": chapter["chapterId"], "timestampMs": semantic_timestamp, "kind": "key_point",
                    "title": point[:120], "evidenceIds": [source["evidenceId"]], "frameEvidenceId": None,
                })
            frame_id = chapter["representativeFrameEvidenceId"]
            if frame_id:
                frame = evidence_by_id[frame_id]
                moments.append({
                    "momentId": _stable_id("moment", outline_id, chapter["chapterId"], "frame", length=16),
                    "chapterId": chapter["chapterId"], "timestampMs": frame["timestampStartMs"], "kind": "frame",
                    "title": f"{chapter['title']}代表画面", "evidenceIds": [frame_id], "frameEvidenceId": frame_id,
                })
        result = {
            "projectionId": _stable_id("timeline", outline_id, length=32),
            "outlineId": outline_id,
            "chapterIds": [chapter["chapterId"] for chapter in chapters],
            "moments": sorted(moments, key=lambda item: (item["timestampMs"], item["momentId"])),
        }
        result["contentSha256"] = canonical_hash(result)
        return result

    @staticmethod
    def _mindmap(outline_id: str, task_id: str, title: str, chapters: list[dict[str, Any]]) -> dict[str, Any]:
        root_id = _stable_id("node", outline_id, "root", length=16)
        nodes: list[dict[str, Any]] = [{
            "nodeId": root_id, "parentNodeId": None, "depth": 0, "kind": "root", "label": title,
            "chapterId": None, "timestampMs": None, "evidenceIds": [],
        }]
        for chapter in chapters:
            chapter_node_id = _stable_id("node", outline_id, chapter["chapterId"], length=16)
            nodes.append({
                "nodeId": chapter_node_id, "parentNodeId": root_id, "depth": 1, "kind": "chapter",
                "label": chapter["title"], "chapterId": chapter["chapterId"], "timestampMs": chapter["startMs"],
                "evidenceIds": chapter["evidenceIds"],
            })
            for index, key_point in enumerate(chapter["keyPoints"]):
                nodes.append({
                    "nodeId": _stable_id("node", outline_id, chapter["chapterId"], "point", index, length=16),
                    "parentNodeId": chapter_node_id, "depth": 2, "kind": "key_point", "label": key_point,
                    "chapterId": chapter["chapterId"], "timestampMs": chapter["startMs"],
                    "evidenceIds": chapter["evidenceIds"][:1],
                })
        result = {
            "projectionId": _stable_id("mindmap", outline_id, task_id, length=32),
            "outlineId": outline_id,
            "nodes": nodes,
        }
        result["contentSha256"] = canonical_hash(result)
        return result
