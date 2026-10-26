// The privacy helpers of the B-5 evidence.
//
// The evidence may NOT carry an absolute runtime, database, profile or
// repository path, and it may NOT carry a matched secret character. These
// helpers are the ONLY way the runner produces text for its evidence.
//
//   * detectAbsolutePaths  — a generic POSIX / Windows / UNC absolute-path
//                             detector
//   * redactAbsolutePaths  — replaces every detected path with a stable
//                             hash reference
//   * safeFileReference    — a hashed file reference (never the path)
//   * classifyRuntimeFailure— the allowlisted frozen failure code of a
//                             structured Runtime response

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/**
 * The narrow, STRUCTURED, NON-PRIVATE allowlist.
 *
 * Every entry is a PUBLIC ROUTE of the product: a route name that the
 * evidence legitimately records. Nothing else is allowlisted: a runtime,
 * database, profile or repository path is always detected.
 *
 * A FILE under an allowlisted prefix is NOT allowlisted: a segment with a
 * dot is a file name, and a file name is never public.
 */
export const NON_PRIVATE_PATH_ALLOWLIST = Object.freeze([
  Object.freeze({ kind: "runtime-route", prefix: "/v1/", note: "the public route prefix of the local Runtime" }),
  Object.freeze({ kind: "runtime-route", prefix: "/v3/", note: "the public route prefix of the local Runtime" }),
  Object.freeze({ kind: "runtime-route", prefix: "/health", note: "the public health route of the local Runtime" }),
  Object.freeze({ kind: "provider-route", prefix: "/chat/completions", note: "the public route of the selected Provider" }),
  Object.freeze({ kind: "provider-route", prefix: "/beta/chat/completions", note: "the public route of the selected Provider" }),
]);

/**
 * The detection patterns.
 *
 * The boundary group keeps a URL out of the detection: the path of a URL is
 * never preceded by a boundary character, so "https://host/v1/chat" is not a
 * path.
 */
const POSIX_ABSOLUTE = /(^|[\s"'`(<|])(\/[A-Za-z0-9._@+~-]+(?:\/[A-Za-z0-9._@+~-]*)*)/g;
const WINDOWS_BACKSLASH = /(^|[\s"'`(<|])([A-Za-z]:\\[^"'`\s<>|]+)/g;
const WINDOWS_FORWARD = /(^|[\s"'`(<|])([A-Za-z]:\/[^"'`\s<>|]+)/g;
const UNC_BACKSLASH = /(^|[\s"'`(<|])(\\\\[^\\/\s"'`|<>]+\\[^\\/\s"'`|<>]+)/g;
const UNC_FORWARD = /(^|[\s"'`(<|])(\/\/[^/\s"'`|<>]+\/[^/\s"'`|<>]+)/g;

/** TRUE when the match is a PUBLIC ROUTE of the product. */
function isAllowlisted(match) {
  const prefix = NON_PRIVATE_PATH_ALLOWLIST.find((entry) => match.startsWith(entry.prefix));
  if (!prefix) return false;
  // A public ROUTE is allowlisted; a FILE is not. A segment with a dot is a
  // file name, and a file name is never public.
  return !match.split("/").some((segment) => segment.includes("."));
}

/** Every match of a pattern, with its value. */
function collect(text, pattern) {
  const values = [];
  pattern.lastIndex = 0;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    values.push(match[2]);
    // A zero-length match would loop forever.
    if (match.index === pattern.lastIndex) pattern.lastIndex += 1;
  }
  return values;
}

/** The absolute paths of a text, with the non-private allowlist applied. */
export function detectAbsolutePaths(text) {
  if (typeof text !== "string" || !text) return [];
  const found = [];
  for (const pattern of [
    POSIX_ABSOLUTE,
    WINDOWS_BACKSLASH,
    WINDOWS_FORWARD,
    UNC_BACKSLASH,
    UNC_FORWARD,
  ]) {
    for (const value of collect(text, pattern)) {
      if (isAllowlisted(value)) continue;
      found.push(value);
    }
  }
  return [...new Set(found)];
}

/** A stable reference for a path: its digest, never the path. */
export function pathReference(value) {
  return `path-ref:${createHash("sha256").update(String(value)).digest("hex").slice(0, 32)}`;
}

/**
 * Replace every absolute path of a text with a stable hash reference.
 *
 * The result stays readable and carries no local path.
 */
export function redactAbsolutePaths(text) {
  if (typeof text !== "string" || !text) return text;
  let result = text;
  for (const pattern of [
    POSIX_ABSOLUTE,
    WINDOWS_BACKSLASH,
    WINDOWS_FORWARD,
    UNC_BACKSLASH,
    UNC_FORWARD,
  ]) {
    pattern.lastIndex = 0;
    result = result.replace(pattern, (whole, _boundary, value) => (
      isAllowlisted(value) ? whole : pathReference(value)
    ));
  }
  return result;
}

/** A hashed file reference: the RELATIVE name, never the absolute path. */
export function safeFileReference(relativePath) {
  const normalized = String(relativePath).split(path.sep).join("/");
  return `file-ref:${createHash("sha256").update(normalized).digest("hex").slice(0, 32)}`;
}

/** The digest of a file, for an evidence record. */
export function fileDigest(filePath) {
  return createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

/** The allowlisted frozen Runtime failure codes. */
export const FROZEN_RUNTIME_CODE = /^(?:V3510B_[A-Z0-9_]{1,64}|V352_[A-Z0-9_]{1,64})$/;

/**
 * The safe classification of a structured Runtime failure response.
 *
 * ONLY an allowlisted frozen code may be recorded. The response body is
 * never stored, and an unparsable body contributes no code at all.
 */
export function classifyRuntimeFailure(status, body) {
  const result = { failureCode: null, httpStatus: Number.isFinite(Number(status)) ? Number(status) : null };
  if (typeof body !== "string" || !body) return result;
  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch {
    return result;
  }
  const candidate = parsed && typeof parsed === "object" ? parsed.error?.code : null;
  if (typeof candidate === "string" && FROZEN_RUNTIME_CODE.test(candidate)) {
    result.failureCode = candidate;
  }
  return result;
}
