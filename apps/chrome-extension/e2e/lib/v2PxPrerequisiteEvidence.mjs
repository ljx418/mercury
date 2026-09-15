export function summarizeT01Regression(document, sourceSha256) {
  if (!document || document.passed !== true || !Array.isArray(document.checks)) {
    throw new Error("T01 regression result is not a passing structured run.");
  }
  const assertionResults = document.checks.map((item) => ({ assertionId: item?.id, passed: item?.passed === true }));
  const assertionIds = assertionResults.map((item) => item.assertionId);
  if (assertionResults.length !== 36 || new Set(assertionIds).size !== 36 || assertionIds.some((id) => typeof id !== "string" || !id) || assertionResults.some((item) => !item.passed)) {
    throw new Error("T01 regression must contain 36 unique passing assertions.");
  }
  if (!/^[a-f0-9]{64}$/.test(sourceSha256)) throw new Error("T01 regression source SHA-256 is invalid.");
  return {
    resultType: "t01_real_chrome_regression",
    sourceSchemaVersion: document.schemaVersion,
    sourceRunId: document.runId,
    sourceSha256,
    assertionsTotal: assertionResults.length,
    assertionsPassed: assertionResults.filter((item) => item.passed).length,
    assertionResults,
    passed: true
  };
}
