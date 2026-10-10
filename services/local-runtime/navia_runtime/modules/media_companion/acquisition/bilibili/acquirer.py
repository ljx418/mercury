from __future__ import annotations

import hashlib
import json
import re
from collections.abc import Sequence
from datetime import UTC, datetime
from urllib.parse import urlparse

import httpx

from ...bilibili_policy import BILIBILI_CREDENTIAL_ENVELOPE_POLICY
from ..contracts import AcquiredMedia, MediaIdentity, ResolvedSubtitle, SubtitleCandidate, SubtitleDiscoveryReceipt
from ..coordinator import MediaAcquisitionError
from ..subtitle_resolver import SubtitleResolver


_BVID = re.compile(r"^BV[A-Za-z0-9]+$")
_CID = re.compile(r"^[0-9]+$")
_SUBTITLE_HOSTS = {"aisubtitle.hdslb.com"}
_BILIBILI_BROWSER_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36",
    "Referer": "https://www.bilibili.com/",
    "Origin": "https://www.bilibili.com",
}


def _canonical_json(value: object) -> bytes:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")


def _cookie_mapping(credentials: Sequence[dict[str, object]]) -> dict[str, str]:
    cookies: dict[str, str] = {}
    for credential in credentials:
        name = credential.get("name")
        value = credential.get("value")
        domain = credential.get("domain")
        if (
            not isinstance(name, str)
            or name not in BILIBILI_CREDENTIAL_ENVELOPE_POLICY.allowed_credential_names
            or not isinstance(value, str)
            or not value
            or not isinstance(domain, str)
            or not BILIBILI_CREDENTIAL_ENVELOPE_POLICY.domain_allowed(domain)
            or name in cookies
            or any(ord(char) < 0x21 or ord(char) == 0x7F or char == ";" for char in value)
        ):
            raise MediaAcquisitionError("V3_MEDIA_LEASE_REQUIRED", "Credential lease is not valid for Bilibili.", status=403)
        cookies[name] = value
    if not BILIBILI_CREDENTIAL_ENVELOPE_POLICY.required_credential_names.issubset(cookies):
        raise MediaAcquisitionError("V3_MEDIA_LEASE_REQUIRED", "Credential lease is incomplete.", status=403)
    return cookies


def _cookie_header(credentials: Sequence[dict[str, object]]) -> str:
    return "; ".join(f"{name}={value}" for name, value in _cookie_mapping(credentials).items())


class BilibiliMediaAcquirer:
    def __init__(self, *, client: httpx.Client | None = None, downloader=None, resolver: SubtitleResolver | None = None) -> None:
        self._client = client or httpx.Client(timeout=20, follow_redirects=False, headers=_BILIBILI_BROWSER_HEADERS)
        self._downloader = downloader
        self._resolver = resolver or SubtitleResolver()

    @staticmethod
    def _validate_identity(identity: MediaIdentity) -> None:
        if (
            identity.adapter_id != "bilibili"
            or not _BVID.fullmatch(identity.media_id)
            or not _CID.fullmatch(identity.playback_unit_id)
            or identity.part_index < 1
            or identity.part_count < identity.part_index
            or identity.duration_seconds <= 0
        ):
            raise MediaAcquisitionError("V3_MEDIA_TASK_INVALID", "Bilibili media identity is invalid.")

    def resolve_identity(self, media_id: str, playback_unit_id: str, part_id: str, credentials: Sequence[dict[str, object]]) -> MediaIdentity:
        if not _BVID.fullmatch(media_id) or not _CID.fullmatch(playback_unit_id) or not part_id:
            raise MediaAcquisitionError("V3_MEDIA_TASK_INVALID", "Bilibili media identity is invalid.")
        try:
            response = self._client.get(
                "https://api.bilibili.com/x/web-interface/view",
                params={"bvid": media_id},
                headers={"Cookie": _cookie_header(credentials)},
            )
        except httpx.HTTPError as exc:
            raise MediaAcquisitionError("V3_MEDIA_PLATFORM_REJECTED", "Bilibili media identity lookup failed.", status=502) from exc
        if response.status_code in {401, 403, 412}:
            raise MediaAcquisitionError("V3_MEDIA_PLATFORM_REJECTED", "Bilibili rejected media identity lookup.", status=403)
        if response.status_code != 200:
            raise MediaAcquisitionError("V3_MEDIA_PLATFORM_REJECTED", "Bilibili media identity lookup failed.", status=502)
        try:
            document = response.json()
        except ValueError as exc:
            raise MediaAcquisitionError("V3_MEDIA_PLATFORM_REJECTED", "Bilibili media identity is invalid.", status=502) from exc
        data = document.get("data") if isinstance(document, dict) and isinstance(document.get("data"), dict) else None
        if document.get("code") != 0 or data is None or data.get("bvid") != media_id:
            raise MediaAcquisitionError("V3_MEDIA_PLATFORM_REJECTED", "Bilibili media identity was rejected.", status=403)
        pages = data.get("pages") if isinstance(data.get("pages"), list) else []
        matches = [(index, page) for index, page in enumerate(pages, start=1) if isinstance(page, dict) and str(page.get("cid")) == playback_unit_id]
        if len(matches) != 1:
            raise MediaAcquisitionError("V3_MEDIA_TASK_INVALID", "Playback unit is not part of the requested Bilibili media.")
        part_index, page = matches[0]
        platform_part_id = str(page.get("page") or part_index)
        accepted_part_ids = {platform_part_id, f"p{platform_part_id}"}
        if part_id not in accepted_part_ids:
            raise MediaAcquisitionError("V3_MEDIA_TASK_INVALID", "Bilibili part identity changed.")
        identity = MediaIdentity("bilibili", media_id, playback_unit_id, part_id, part_index, len(pages), float(page.get("duration") or 0))
        self._validate_identity(identity)
        return identity

    def probe_subtitles(self, identity: MediaIdentity, credentials: Sequence[dict[str, object]]) -> tuple[SubtitleCandidate, ...]:
        return self.probe_subtitles_with_receipt(identity, credentials).candidates

    def probe_subtitles_with_receipt(
        self, identity: MediaIdentity, credentials: Sequence[dict[str, object]]
    ) -> SubtitleDiscoveryReceipt:
        self._validate_identity(identity)
        try:
            response = self._client.get(
                "https://api.bilibili.com/x/player/wbi/v2",
                params={"bvid": identity.media_id, "cid": identity.playback_unit_id},
                headers={"Cookie": _cookie_header(credentials)},
            )
        except httpx.HTTPError as exc:
            raise MediaAcquisitionError("V3_MEDIA_SUBTITLE_UNAVAILABLE", "Subtitle discovery failed.", status=502) from exc
        if response.status_code in {401, 403, 412}:
            raise MediaAcquisitionError("V3_MEDIA_PLATFORM_REJECTED", "Bilibili rejected subtitle discovery.", status=403)
        if response.status_code != 200:
            raise MediaAcquisitionError("V3_MEDIA_SUBTITLE_UNAVAILABLE", "Subtitle discovery failed.", status=502)
        try:
            document = response.json()
        except ValueError as exc:
            raise MediaAcquisitionError("V3_MEDIA_SUBTITLE_UNAVAILABLE", "Subtitle discovery returned invalid JSON.", status=502) from exc
        if document.get("code") != 0:
            code = "V3_MEDIA_PLATFORM_REJECTED" if document.get("code") in {-101, -10403, -404, -412} else "V3_MEDIA_SUBTITLE_UNAVAILABLE"
            raise MediaAcquisitionError(code, "Subtitle discovery was not available.", status=403 if code.endswith("REJECTED") else 502)
        discovery_sha256 = hashlib.sha256(_canonical_json(document)).hexdigest()
        data = document.get("data") if isinstance(document.get("data"), dict) else {}
        subtitle = data.get("subtitle") if isinstance(data.get("subtitle"), dict) else {}
        rows = subtitle.get("subtitles") or subtitle.get("list") or []
        candidates: list[SubtitleCandidate] = []
        for index, row in enumerate(rows):
            if not isinstance(row, dict):
                continue
            private_url = row.get("subtitle_url") or row.get("subtitleUrl")
            if isinstance(private_url, str) and private_url.startswith("//"):
                private_url = f"https:{private_url}"
            if not isinstance(private_url, str) or not self._allowed_subtitle_url(private_url):
                continue
            language = str(row.get("lan") or row.get("lang") or "und")[:32]
            label = str(row.get("lan_doc") or row.get("label") or language)[:128]
            opaque = str(row.get("id_str") or row.get("id") or index)
            candidate_id = hashlib.sha256(f"{identity.media_id}:{identity.playback_unit_id}:{opaque}:{language}".encode()).hexdigest()
            candidates.append(SubtitleCandidate(candidate_id, language, label, private_url, discovery_sha256))
        return SubtitleDiscoveryReceipt(
            candidates=tuple(candidates),
            response_sha256=discovery_sha256,
            observed_at=datetime.now(UTC).isoformat().replace("+00:00", "Z"),
        )

    def acquire_subtitle(self, identity: MediaIdentity, candidate: SubtitleCandidate, credentials: Sequence[dict[str, object]]) -> ResolvedSubtitle:
        self._validate_identity(identity)
        if not self._allowed_subtitle_url(candidate.private_body_url):
            raise MediaAcquisitionError("V3_MEDIA_TASK_INVALID", "Subtitle URL is outside the Bilibili allowlist.")
        try:
            response = self._client.get(candidate.private_body_url, headers={"Cookie": _cookie_header(credentials)})
        except httpx.HTTPError as exc:
            raise MediaAcquisitionError("V3_MEDIA_SUBTITLE_UNAVAILABLE", "Subtitle body was unavailable.", status=502) from exc
        if response.status_code in {401, 403, 412}:
            raise MediaAcquisitionError("V3_MEDIA_PLATFORM_REJECTED", "Bilibili rejected subtitle body access.", status=403)
        if response.status_code != 200:
            raise MediaAcquisitionError("V3_MEDIA_SUBTITLE_UNAVAILABLE", "Subtitle body was unavailable.", status=502)
        return self._resolver.resolve(candidate, response.content, duration_seconds=identity.duration_seconds)

    def acquire_audio(self, task_id: str, identity: MediaIdentity, credentials: Sequence[dict[str, object]]) -> AcquiredMedia:
        self._validate_identity(identity)
        if self._downloader is None:
            raise MediaAcquisitionError("V3_MEDIA_RUNTIME_OFFLINE", "Media downloader is unavailable.", status=503)
        return self._downloader.acquire_audio(task_id, identity, credentials)

    @staticmethod
    def _allowed_subtitle_url(value: str) -> bool:
        parsed = urlparse(value)
        return parsed.scheme == "https" and parsed.hostname in _SUBTITLE_HOSTS and parsed.username is None and parsed.password is None
