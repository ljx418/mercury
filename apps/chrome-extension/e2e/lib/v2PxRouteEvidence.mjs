const CANONICAL_ROUTE_ERROR_CODES = new Set([
  "INVALID_ROUTE",
  "WORKSPACE_NOT_FOUND",
  "SOURCE_NOT_FOUND",
  "FORBIDDEN"
]);

export function resolveObservedRouteErrorCode(observedText, expectedErrorCode = null) {
  const observedErrorCode = typeof observedText === "string" && observedText.trim()
    ? observedText.trim()
    : null;

  if (!observedErrorCode) {
    if (expectedErrorCode) {
      throw new Error(`Expected route error ${expectedErrorCode}, but no RouteError code was observed.`);
    }
    return null;
  }
  if (!CANONICAL_ROUTE_ERROR_CODES.has(observedErrorCode)) {
    throw new Error(`Unknown observed route error code: ${observedErrorCode}`);
  }
  if (expectedErrorCode && observedErrorCode !== expectedErrorCode) {
    throw new Error(`Expected route error ${expectedErrorCode}, observed ${observedErrorCode}.`);
  }
  return observedErrorCode;
}
