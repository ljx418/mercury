import fs from "node:fs";
import path from "node:path";

const resultPath = process.argv[2];
if (!resultPath) throw new Error("Usage: node v3-session-capability-verify.mjs <result.json>");
const result = JSON.parse(fs.readFileSync(resultPath, "utf8"));
const checks = [];
const check = (id, passed) => checks.push({ id, passed: Boolean(passed) });

check("schema_version", result.schemaVersion === "v3-media-session-capability-run/v1");
check("production_candidate", result.evidenceClass === "production_candidate");
check("segment_count", Array.isArray(result.segments) && result.segments.length === 2);
const anonymous = result.segments?.find((segment) => segment.segmentId === "anonymous");
const seeded = result.segments?.find((segment) => segment.segmentId === "live-seed");
const requiredSegmentCheckIds = [
  "keyboard_authorize_and_deny_reachable",
  "axe_serious_critical_zero",
  "explicit_denial_persisted",
  "denial_focus_retained",
  "denied_inspect_fail_closed",
  "extra_fields_rejected",
  "unknown_adapter_rejected",
  "denied_and_attack_cookie_read_zero",
  "native_permission_prompt_confirmed",
  "trusted_click_optional_permissions_granted",
  "grant_focus_moved_to_stable_action",
  "revision_mismatch_fail_closed_without_cookie_read",
  "authorized_inspect_reads_cookie_once",
  "private_storage_secret_scan_before_restart",
  "reload_policy_restored",
  "reopen_policy_restored",
  "browser_restart_policy_restored",
  "browser_restart_permissions_authoritative",
  "service_worker_restart_counter_reset",
  "browser_restart_capability_recomputed",
  "revoke_focus_moved_to_stable_action",
  "revoke_removed_permissions",
  "revoke_policy_persisted",
  "revoked_inspect_fail_closed_without_cookie_read",
  "private_storage_secret_scan_after_revoke"
];

function segmentCheckMap(segment) {
  return new Map((segment?.checks ?? []).map((item) => [item.id, item.passed]));
}

function attackByPhase(segment, phase) {
  return segment?.attackObservations?.find((item) => item.phase === phase);
}

check("anonymous_class", anonymous?.evidenceClass === "fresh_anonymous_profile");
check("seed_class", seeded?.evidenceClass === "user_authorized_live_session_seed");
check("server_input_valid", result.serverInputValidation?.httpStatus === 200 && result.serverInputValidation?.code === 0 && result.serverInputValidation?.isLogin === true && result.serverInputValidation?.passed === true);
check("anonymous_passed", anonymous?.passed === true);
check("seeded_passed", seeded?.passed === true);
for (const segment of [anonymous, seeded]) {
  const segmentId = segment?.segmentId ?? "missing";
  const checkMap = segmentCheckMap(segment);
  check(`${segmentId}_required_checks_present`, requiredSegmentCheckIds.every((id) => checkMap.has(id)));
  check(`${segmentId}_required_checks_passed`, requiredSegmentCheckIds.every((id) => checkMap.get(id) === true));
  check(`${segmentId}_capability_check_passed`, checkMap.get(segmentId === "live-seed" ? "live_seed_candidate_available" : "anonymous_candidate_unavailable") === true);
  check(`${segmentId}_storage_scan_zero`, segment?.storageScan?.passed === true
    && segment.storageScan.beforeRestart?.rawValueHitCount === 0
    && segment.storageScan.afterRevoke?.rawValueHitCount === 0);
  check(`${segmentId}_focus_return`, segment?.focusReturn?.afterDenial === "media-consent-deny"
    && segment.focusReturn.afterGrant === "media-consent-refresh"
    && segment.focusReturn.afterRevoke === "media-consent-authorize");
  check(`${segmentId}_authorized_cookie_read_delta`, Number.isInteger(segment?.cookieReadObservations?.authorizedRefresh?.before)
    && segment.cookieReadObservations.authorizedRefresh.after === segment.cookieReadObservations.authorizedRefresh.before + 1);
  const restart = segment?.restartObservation;
  const persistedPermissionRestart = restart?.permissionsPersisted === true
    && Number.isInteger(segment?.cookieReadObservations?.restartRefresh?.before)
    && segment.cookieReadObservations.restartRefresh.after === segment.cookieReadObservations.restartRefresh.before + 1;
  const removedPermissionRestart = restart?.permissionsPersisted === false
    && restart.status?.includes("浏览器权限已移除")
    && restart.cookieReadCountAfterOpen === 0
    && restart.cookieReadCountAfterRefresh === 0;
  check(`${segmentId}_restart_permission_authority`, persistedPermissionRestart || removedPermissionRestart);
  check(`${segmentId}_screenshots`, Array.isArray(segment?.screenshots)
    && segment.screenshots.length >= 5
    && segment.screenshots.every((item) => typeof item.sha256 === "string" && /^[a-f0-9]{64}$/.test(item.sha256)));
  const denied = attackByPhase(segment, "denied");
  const revisionMismatch = attackByPhase(segment, "revision_mismatch");
  const revoked = attackByPhase(segment, "revoked");
  check(`${segmentId}_denied_attack_fail_closed`, denied?.cookieReadCount === 0
    && denied.capabilityStatus === "permission_denied"
    && denied.extraFieldFailureCode === "V3_MEDIA_SESSION_POLICY_MISMATCH"
    && denied.unknownAdapterFailureCode === "V3_MEDIA_SESSION_ADAPTER_UNSUPPORTED");
  check(`${segmentId}_revision_attack_fail_closed`, revisionMismatch?.cookieReadCountBefore === revisionMismatch?.cookieReadCountAfter
    && revisionMismatch?.capabilityStatus === "unknown"
    && revisionMismatch?.failureCode === "V3_MEDIA_SESSION_POLICY_MISMATCH");
  check(`${segmentId}_revoked_attack_fail_closed`, revoked?.cookieReadCountBefore === revoked?.cookieReadCountAfter
    && revoked?.capabilityStatus === "revoked"
    && revoked?.failureCode === "V3_MEDIA_SESSION_REVOKED");
  check(`${segmentId}_accessibility`, segment?.accessibility?.serious === 0 && segment?.accessibility?.critical === 0);
}
check("secret_scan_zero", result.secretScan?.hitCount === 0 && result.secretScan?.passed === true);
check("profiles_deleted", result.cleanup?.profilesDeleted === true);
check("overall_passed", result.passed === true);
const forbiddenKeys = ["cookie", "cookieValue", "credentialValue", "header", "authorization", "uid", "uname", "mid"];
const serialized = JSON.stringify(result);
check("forbidden_keys_absent", forbiddenKeys.every((key) => !serialized.includes(`\"${key}\"`)));

const output = {
  schemaVersion: "v3-media-session-capability-verification/v1",
  source: path.resolve(resultPath),
  checks,
  summary: { total: checks.length, passed: checks.filter((item) => item.passed).length },
  passed: checks.every((item) => item.passed)
};
process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
if (!output.passed) process.exitCode = 2;
