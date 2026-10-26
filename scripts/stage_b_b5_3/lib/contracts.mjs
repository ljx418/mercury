// Pure helpers extracted from run_one_bvid.mjs so they can be unit-tested without
// launching Chrome, Runtime, or any subprocess. The runner continues to use
// these via import; this module must remain side-effect-free.

import { createHash } from "node:crypto";
import fs from "node:fs";

export const BVID_PATTERN = /^BV[0-9A-Za-z]{10}$/;
export const ORDER_PATTERN = /^[1-6]$/;

export const SECRET_PATTERNS = [
  /sk-[A-Za-z0-9_\-]{16,}/,
  /sk_live_[A-Za-z0-9]{8,}/,
  /AIza[0-9A-Za-z_\-]{16,}/,
  /gho_[A-Za-z0-9]{16,}/,
  /deepseek-[A-Za-z0-9]{8,}/,
  /minimax-[A-Za-z0-9]{8,}/,
];

export const UPLOAD_COUNTER_HARD_ZERO = Object.freeze({
  rawVideoUploadCount: 0,
  rawAudioUploadCount: 0,
  frameByteUploadCount: 0,
  cookieUploadCount: 0,
  apiKeyDisclosureCount: 0,
  localPathUploadCount: 0,
});

export const REQUIRED_UPLOAD_COUNTER_KEYS = Object.freeze([
  "rawVideoUploadCount",
  "rawAudioUploadCount",
  "frameByteUploadCount",
  "cookieUploadCount",
  "apiKeyDisclosureCount",
  "localPathUploadCount",
]);

export const REQUIRED_V21_RECEIPT_FIELDS = Object.freeze([
  "providerId",
  "modelId",
  "outboundSha256",
  "requestCount",
  "rawVideoUploadCount",
  "rawAudioUploadCount",
  "frameByteUploadCount",
  "cookieUploadCount",
  "apiKeyDisclosureCount",
  "localPathUploadCount",
  "endpointClass",
  "structureMode",
  "attemptId",
  "latencyMs",
  "requestSha256",
  "responseSha256",
  "finishReason",
]);

/**
 * The task Provider lock.
 *
 * TWO different facts, each in its own field:
 *   - `SELECTED_PROVIDER_ID` is the selected PRODUCT Provider id;
 *   - `PROVIDER_LOCK` is the endpoint/adapter CLASS the runner pins.
 * They are never interchangeable, and neither is ever matched by substring.
 */
export const SELECTED_PROVIDER_ID = "minimax-cn-openai-vision";
export const PROVIDER_LOCK = "minimax_chat_completions";
export const DERIVED_TEXT_SCOPE = Object.freeze(["transcript", "ocr", "vision-caption"]);

/**
 * The PRODUCTION mapping from the artifact quality status to the final
 * disposition.
 *
 * It is the SINGLE rule: the runner uses it to decide the disposition and
 * the aggregate uses it to bind the artifact to the disposition. A quality
 * status that is not in the mapping is a failure, never a default.
 */
export const QUALITY_STATUS_TO_DISPOSITION = Object.freeze({
  complete: "complete",
  limited: "limited",
  rejected: "failed",
});

/** The disposition of a quality status, or null when the status is unknown. */
export function dispositionForQualityStatus(status) {
  const mapped = QUALITY_STATUS_TO_DISPOSITION[String(status ?? "")];
  return mapped ?? null;
}
export const MAXIMUM_BLOCKED_FOR_STAGE_EXIT = 1;

export function parseArgs(argv) {
  const out = {};
  for (const arg of argv) {
    if (!arg.startsWith("--")) continue;
    const eq = arg.indexOf("=");
    if (eq === -1) out[arg.slice(2)] = "1";
    else out[arg.slice(2, eq)] = arg.slice(eq + 1);
  }
  const required = ["order", "bvid", "run-id", "evidence-root"];
  for (const key of required) {
    if (!out[key]) throw new Error(`Missing --${key}`);
  }
  if (!BVID_PATTERN.test(out.bvid)) throw new Error(`Invalid --bvid ${out.bvid}`);
  if (!ORDER_PATTERN.test(out.order)) throw new Error(`Invalid --order ${out.order}`);
  return out;
}

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
}

export function writeText(filePath, text) {
  fs.writeFileSync(filePath, text, { mode: 0o600 });
}

export function ensure(condition, message) {
  if (!condition) throw new Error(message);
}

export function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function detectSecretHits(text) {
  const hits = [];
  for (const pattern of SECRET_PATTERNS) {
    const m = text.match(pattern);
    if (m) hits.push({ pattern: String(pattern), sample: m[0].slice(0, 12) });
  }
  return hits;
}

export function scanFileForSecrets(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const st = fs.statSync(filePath);
  if (st.isDirectory()) {
    const out = [];
    for (const entry of fs.readdirSync(filePath)) {
      out.push(...scanFileForSecrets(`${filePath}/${entry}`));
    }
    return out;
  }
  const text = fs.readFileSync(filePath).toString("utf8");
  return detectSecretHits(text);
}

export function validateUploadCounters(receipt) {
  const offenders = [];
  for (const [key, expected] of Object.entries(UPLOAD_COUNTER_HARD_ZERO)) {
    if (receipt[key] !== expected) offenders.push(`${key}=${receipt[key]}`);
  }
  return offenders;
}

/**
 * The task Provider lock.
 *
 * The PRIMARY oracle is the receipt itself: the selected product Provider id
 * and the endpoint/adapter class are validated EXACTLY, in their own fields.
 * A missing, lookalike or foreign Provider id and a wrong endpoint class are
 * refusals, and a receipt that declares more than one provider authority is a
 * refusal too.
 *
 * A bounded retry by the SAME Provider is not a second Provider: the request
 * count may grow, the Provider id may not.
 */
export function providerLockOffenders(receipt) {
  const offenders = [];
  if (!receipt || typeof receipt !== "object") return ["receipt=missing"];
  const providerId = String(receipt.providerId ?? "");
  if (!providerId) {
    offenders.push("providerId=missing");
  } else if (providerId !== SELECTED_PROVIDER_ID) {
    offenders.push(`providerId=${providerId}`);
  }
  const endpointClass = String(receipt.endpointClass ?? "");
  if (!endpointClass) {
    offenders.push("endpointClass=missing");
  } else if (endpointClass !== PROVIDER_LOCK) {
    offenders.push(`endpointClass=${endpointClass}`);
  }
  // A second declared provider authority is a refusal, never a second
  // Provider that the same task may use.
  if (Array.isArray(receipt.providers) && receipt.providers.length > 1) {
    offenders.push(`providers=${receipt.providers.length}`);
  }
  return offenders;
}

export function missingReceiptFields(receipt) {
  return REQUIRED_V21_RECEIPT_FIELDS.filter((k) => !(k in receipt));
}

export function assertMuteAudioFlag(cmdline) {
  if (!cmdline.includes("--mute-audio")) {
    throw new Error(`Chrome process argv lacks --mute-audio: ${cmdline.slice(0, 400)}`);
  }
}

export function assertChromeCmdlineFlags(cmdline) {
  const required = [
    "--mute-audio",
    "--load-extension",
    "--disable-extensions-except",
    "--user-data-dir=",
  ];
  for (const flag of required) {
    if (!cmdline.includes(flag)) {
      throw new Error(`Chrome process argv lacks ${flag}: ${cmdline.slice(0, 400)}`);
    }
  }
}

export function classifyDispositionFromStageA(state) {
  if (state === "ready" || state === "degraded") return "complete";
  if (state === "cancelled" || state === "failed" || state === "blocked") return "blocked";
  return "blocked";
}