from __future__ import annotations

from .credential_transport import CredentialEnvelopePolicy, CredentialTransportPolicy


BILIBILI_CREDENTIAL_TRANSPORT_POLICY = CredentialTransportPolicy(
    adapter_id="bilibili",
    policy_id="bilibili-media-consent/v1",
    policy_revision=1,
    credential_name_set_sha256="67166981712c0b024632614b43d1c7d4ecf7e23c2557b6f76dc58318a7530fc2",
)


def is_bilibili_cookie_domain(domain: str) -> bool:
    normalized = domain.strip().lower().removeprefix(".")
    return normalized == "bilibili.com" or normalized.endswith(".bilibili.com")


BILIBILI_CREDENTIAL_ENVELOPE_POLICY = CredentialEnvelopePolicy(
    adapter_id="bilibili",
    session_adapter_id="bilibili-cookie-session",
    policy_id="bilibili-media-consent/v1",
    policy_revision=1,
    envelope_schema_version="BilibiliCredentialEnvelope/v1",
    credential_name_set_sha256="67166981712c0b024632614b43d1c7d4ecf7e23c2557b6f76dc58318a7530fc2",
    allowed_credential_names=frozenset({
        "DedeUserID", "DedeUserID__ckMd5", "SESSDATA", "b_nut", "bili_jct",
        "buvid3", "buvid4", "buvid_fp", "sid",
    }),
    required_credential_names=frozenset({"SESSDATA"}),
    domain_allowed=is_bilibili_cookie_domain,
)
