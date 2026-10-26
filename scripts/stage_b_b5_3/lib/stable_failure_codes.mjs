// The STABLE FAILURE CODE vocabulary of the B6 harness.
//
// ONE owner for the codes that may appear as the terminal failure code of a
// machine receipt and therefore in the public projection.
//
// A terminal code is a STABLE ENUM. A generic `Error`, an exception name, an
// exception message, a private path, a database name, a credential, a key and
// a Provider identity are never a final code: they are refused here, before
// they can reach a public package.

import { CANARY_CODE } from "./order2_canary.mjs";
import { CAPTURE_FAILURE } from "./review_capture.mjs";
import { CAPTURE_GATE_FAILURE } from "./b6_capture_gate.mjs";
import { STAGE_A_CODE } from "./stage_a_diagnostics.mjs";
import { CANDIDATE_DEPENDENCY_CODE } from "./candidate_dependencies.mjs";
import { CANDIDATE_STOP_CODE } from "./candidate_prepare.mjs";

/** The frozen PRODUCT failure codes: the V3510B and the V352 families. */
export const PRODUCT_FAILURE_CODE = /^(?:V3510B|V352)_[A-Z0-9_]{1,64}$/;

/** The runner-level codes of the B6 harness. */
export const RUNNER_FAILURE_CODES = Object.freeze([
  "VISIBLE_AUTHORIZATION_REFUSED",
  "B6_EXECUTION_CLOSURE_INVALID",
  "B6_RUNNER_UNEXPECTED_FAILURE",
  CANDIDATE_STOP_CODE.SNAPSHOT_ABSENT,
  CANDIDATE_STOP_CODE.SNAPSHOT_INVALID,
  CANDIDATE_STOP_CODE.CLOSURE_INVALID,
]);

/**
 * The EXACT allowlist of the terminal failure codes.
 *
 * It is assembled from the OWNERS of the codes, so a new stable code is
 * published by its owner and never by a hand list.
 */
export const PUBLIC_FAILURE_CODES = Object.freeze([
  ...Object.values(STAGE_A_CODE),
  ...Object.values(CAPTURE_FAILURE),
  ...Object.values(CAPTURE_GATE_FAILURE),
  ...Object.values(CANARY_CODE),
  ...Object.values(CANDIDATE_DEPENDENCY_CODE),
  ...RUNNER_FAILURE_CODES,
]);

/**
 * TRUE when a code is a stable, publishable failure code.
 */
export function isPublicFailureCode(code) {
  if (typeof code !== "string" || !code) return false;
  if (PRODUCT_FAILURE_CODE.test(code)) return true;
  return PUBLIC_FAILURE_CODES.includes(code);
}

/**
 * The defects of a terminal failure code.
 *
 * @returns {{ok: boolean, code: string|null}}
 */
export function publicFailureCodeDefect(code) {
  if (code === null || code === undefined) return { ok: true, code: null };
  if (isPublicFailureCode(code)) return { ok: true, code };
  return { ok: false, code: "PUBLIC_FAILURE_CODE_NOT_ALLOWLISTED" };
}
