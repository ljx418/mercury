import type { PortalSessionPolicyDefinition } from "../contracts";

export const BILIBILI_ALLOWED_COOKIE_NAMES = Object.freeze([
  "DedeUserID",
  "DedeUserID__ckMd5",
  "SESSDATA",
  "b_nut",
  "bili_jct",
  "buvid3",
  "buvid4",
  "buvid_fp",
  "sid"
] as const);

export const BILIBILI_REQUIRED_SESSION_COOKIE_NAMES = Object.freeze(["SESSDATA"] as const);
export const BILIBILI_COOKIE_NAME_SET_SHA256 = "67166981712c0b024632614b43d1c7d4ecf7e23c2557b6f76dc58318a7530fc2";

export const BILIBILI_SESSION_POLICY_DEFINITION: PortalSessionPolicyDefinition = Object.freeze({
  adapterId: "bilibili",
  sessionAdapterId: "bilibili-cookie-session",
  policyId: "bilibili-media-consent/v1",
  policyRevision: 1,
  permissionDescriptor: Object.freeze({
    permissions: Object.freeze(["cookies"] as chrome.runtime.ManifestPermission[]),
    origins: Object.freeze(["https://*.bilibili.com/*"])
  }),
  consentScopeIds: Object.freeze([
    "bilibili_session_access",
    "temporary_media_download",
    "audio_local_processing",
    "frame_local_processing",
    "selected_frame_cloud_vision"
  ]),
  credentialNameSetSha256: BILIBILI_COOKIE_NAME_SET_SHA256
});

export function isBilibiliCookieDomain(domain: string): boolean {
  const normalized = domain.trim().toLowerCase().replace(/^\./, "");
  return normalized === "bilibili.com" || normalized.endsWith(".bilibili.com");
}
