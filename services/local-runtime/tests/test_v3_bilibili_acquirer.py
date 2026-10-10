from __future__ import annotations

import hashlib
import json

import httpx
import pytest

from navia_runtime.modules.media_companion.acquisition.bilibili import BilibiliMediaAcquirer
from navia_runtime.modules.media_companion.acquisition.contracts import MediaIdentity, SubtitleCandidate
from navia_runtime.modules.media_companion.acquisition.coordinator import MediaAcquisitionError


IDENTITY = MediaIdentity("bilibili", "BV1ZpYd66ELP", "41828944992", "1", 1, 1, 792)
CREDENTIALS = [{"name": "SESSDATA", "value": "private-test-value", "domain": ".bilibili.com"}]


def client(handler):
    return httpx.Client(transport=httpx.MockTransport(handler), follow_redirects=False)


def test_real_shape_discovery_and_body_are_normalized_without_leaking_url():
    discovery = {
        "code": 0,
        "data": {"subtitle": {"subtitles": [{
            "id_str": "123", "lan": "ai-zh", "lan_doc": "中文（自动生成）",
            "subtitle_url": "//aisubtitle.hdslb.com/bfs/ai_subtitle/private.json",
        }]}},
    }
    body = {"body": [{"from": 0.1, "to": 1.2, "content": "  第一  句  "}, {"from": 1.2, "to": 2.5, "content": "第二句"}]}

    def handler(request: httpx.Request):
        assert "private-test-value" in request.headers.get("cookie", "")
        if request.url.host == "api.bilibili.com":
            assert request.url.params["bvid"] == IDENTITY.media_id
            assert request.url.params["cid"] == IDENTITY.playback_unit_id
            return httpx.Response(200, json=discovery)
        return httpx.Response(200, json=body)

    acquirer = BilibiliMediaAcquirer(client=client(handler))
    candidates = acquirer.probe_subtitles(IDENTITY, CREDENTIALS)
    assert len(candidates) == 1
    assert candidates[0].language == "ai-zh"
    assert candidates[0].discovery_sha256 == hashlib.sha256(json.dumps(discovery, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    result = acquirer.acquire_subtitle(IDENTITY, candidates[0], CREDENTIALS)
    assert [segment.text for segment in result.segments] == ["第一 句", "第二句"]
    assert result.segments[0].start_ms == 100
    assert result.segments[-1].end_ms == 2500
    assert "private" not in json.dumps({"bodySha256": result.body_sha256, "sourceSha256": result.source_sha256})


def test_subtitle_url_allowlist_redirect_and_platform_rejection_fail_closed():
    malicious = {"code": 0, "data": {"subtitle": {"subtitles": [{"id": 1, "subtitle_url": "https://127.0.0.1/private"}]}}}
    acquirer = BilibiliMediaAcquirer(client=client(lambda request: httpx.Response(200, json=malicious)))
    assert acquirer.probe_subtitles(IDENTITY, CREDENTIALS) == ()

    redirect = BilibiliMediaAcquirer(client=client(lambda request: httpx.Response(302, headers={"location": "https://127.0.0.1"})))
    with pytest.raises(MediaAcquisitionError) as raised:
        redirect.probe_subtitles(IDENTITY, CREDENTIALS)
    assert raised.value.code == "V3_MEDIA_SUBTITLE_UNAVAILABLE"

    rejected = BilibiliMediaAcquirer(client=client(lambda request: httpx.Response(403)))
    with pytest.raises(MediaAcquisitionError) as raised:
        rejected.probe_subtitles(IDENTITY, CREDENTIALS)
    assert raised.value.code == "V3_MEDIA_PLATFORM_REJECTED"


def test_empty_real_discovery_still_returns_a_hashed_receipt():
    document = {"code": 0, "data": {"subtitle": {"subtitles": []}}}
    acquirer = BilibiliMediaAcquirer(client=client(lambda request: httpx.Response(200, json=document)))
    receipt = acquirer.probe_subtitles_with_receipt(IDENTITY, CREDENTIALS)
    assert receipt.candidates == ()
    assert receipt.response_sha256 == hashlib.sha256(
        json.dumps(document, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()
    assert receipt.observed_at.endswith("Z")


@pytest.mark.parametrize("part_id", ["1", "p1"])
def test_identity_accepts_platform_and_portal_part_ids(part_id):
    document = {
        "code": 0,
        "data": {
            "bvid": "BV1ZpYd66ELP",
            "pages": [{"page": 1, "cid": 41828944992, "duration": 792}],
        },
    }
    acquirer = BilibiliMediaAcquirer(client=client(lambda request: httpx.Response(200, json=document)))
    identity = acquirer.resolve_identity("BV1ZpYd66ELP", "41828944992", part_id, CREDENTIALS)
    assert identity.part_id == part_id
    assert identity.part_index == 1


def test_missing_or_untrusted_credentials_and_identity_are_rejected_before_network():
    calls = []
    acquirer = BilibiliMediaAcquirer(client=client(lambda request: calls.append(request) or httpx.Response(500)))
    with pytest.raises(MediaAcquisitionError) as raised:
        acquirer.probe_subtitles(IDENTITY, [])
    assert raised.value.code == "V3_MEDIA_LEASE_REQUIRED"
    with pytest.raises(MediaAcquisitionError) as raised:
        acquirer.probe_subtitles(MediaIdentity("youtube", "x", "1", "1", 1, 1, 10), CREDENTIALS)
    assert raised.value.code == "V3_MEDIA_TASK_INVALID"
    assert calls == []


@pytest.mark.parametrize(
    ("operation", "expected"),
    [
        ("identity", "V3_MEDIA_PLATFORM_REJECTED"),
        ("discovery", "V3_MEDIA_SUBTITLE_UNAVAILABLE"),
        ("body", "V3_MEDIA_SUBTITLE_UNAVAILABLE"),
    ],
)
def test_network_transport_failures_map_to_frozen_route_failure_codes(operation, expected):
    def fail(request: httpx.Request):
        raise httpx.ConnectError("transport unavailable", request=request)

    acquirer = BilibiliMediaAcquirer(client=client(fail))
    with pytest.raises(MediaAcquisitionError) as raised:
        if operation == "identity":
            acquirer.resolve_identity("BV1ZpYd66ELP", "41828944992", "1", CREDENTIALS)
        elif operation == "discovery":
            acquirer.probe_subtitles(IDENTITY, CREDENTIALS)
        else:
            candidate = SubtitleCandidate("a" * 64, "zh-CN", "中文", "https://aisubtitle.hdslb.com/bfs/x.json", "b" * 64)
            acquirer.acquire_subtitle(IDENTITY, candidate, CREDENTIALS)
    assert raised.value.code == expected


@pytest.mark.parametrize("body", [
    {"body": []},
    {"body": [{"from": 2, "to": 1, "content": "bad"}]},
    {"body": [{"from": 0, "to": 1, "content": "a"}, {"from": 0.5, "to": 2, "content": "overlap"}]},
    {"body": [{"from": 0, "to": 1000, "content": "out of range"}]},
])
def test_invalid_subtitle_body_fails_closed(body):
    acquirer = BilibiliMediaAcquirer(client=client(lambda request: httpx.Response(200, json=body)))
    candidate = SubtitleCandidate("a" * 64, "zh-CN", "中文", "https://aisubtitle.hdslb.com/bfs/x.json", "b" * 64)
    with pytest.raises(MediaAcquisitionError) as raised:
        acquirer.acquire_subtitle(IDENTITY, candidate, CREDENTIALS)
    assert raised.value.code in {"V3_MEDIA_SUBTITLE_UNAVAILABLE", "V3_MEDIA_TRANSCRIPT_PROVENANCE_INVALID"}
