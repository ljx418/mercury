import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "../../..");
const read = (relative) => fs.readFileSync(path.join(repoRoot, relative));
const readJson = (relative) => JSON.parse(read(relative).toString("utf8"));
const sha256 = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const checks = [];
const check = (id, passed, actual) => checks.push({ id, passed: Boolean(passed), actual });

const sessionRegistryPath = "docs/active/project/contracts/v3-media-session-policy-registry.json";
const transportRegistry = readJson("docs/active/project/contracts/v3-media-credential-transport-policy-registry.json");
const fixtures = readJson("docs/active/project/fixtures/v3-media-credential-lease-contract-fixtures.json");
const genericFiles = [
  "services/local-runtime/navia_runtime/modules/media_companion/credential_transport.py",
  "apps/chrome-extension/src/modules/media_companion/session/credential/contracts.ts",
  "apps/chrome-extension/src/modules/media_companion/session/credential/PortalCredentialChannelClient.ts",
  "apps/chrome-extension/src/modules/media_companion/session/credential/PortalCredentialMessageClient.ts",
  "apps/chrome-extension/src/modules/media_companion/session/credential/PortalCredentialMessageRouter.ts",
  "apps/chrome-extension/src/modules/media_companion/session/credential/createBrowserSessionBinding.ts",
  "apps/chrome-extension/src/modules/media_companion/session/credential/isCredentialTransportPath.ts",
  "apps/chrome-extension/src/modules/media_companion/session/credential/validateCredentialTransportContracts.ts"
];
const forbiddenPortalTerms = ["bilibili.com", "SESSDATA", "bvid", "cid"];
const genericHits = genericFiles.flatMap((file) => {
  const source = read(file).toString("utf8");
  return forbiddenPortalTerms.filter((term) => source.includes(term)).map((term) => ({ file, term }));
});
const requirementPairs = new Set(fixtures.requirements.map((item) => `${item.requirementId}\0${item.failureCode}`));
const casePairs = new Set(fixtures.cases.map((item) => `${item.requirementId}\0${item.expectedFailureCode}`));

check("session_policy_hash_frozen", sha256(read(sessionRegistryPath)) === "7ce7d8b4f68dc85fa5d5945d17a3c5232fbec99ab4557137436b0856ce7b42ac", sha256(read(sessionRegistryPath)));
check("failure_code_count", transportRegistry.failureCodes?.length === 17, transportRegistry.failureCodes?.length);
check("requirement_count", fixtures.requirements?.length === 25, fixtures.requirements?.length);
check("fixture_count", fixtures.cases?.length === 25, fixtures.cases?.length);
check("schema_fixture_count", fixtures.cases?.filter((item) => item.expectedSchemaValid === false).length === 12, fixtures.cases?.filter((item) => item.expectedSchemaValid === false).length);
check("semantic_fixture_count", fixtures.cases?.filter((item) => item.expectedSchemaValid === true).length === 13, fixtures.cases?.filter((item) => item.expectedSchemaValid === true).length);
check("requirement_case_mapping", requirementPairs.size === 25 && casePairs.size === 25 && [...requirementPairs].every((item) => casePairs.has(item)), `${requirementPairs.size}/${casePairs.size}`);
check("generic_layer_portal_terms_zero", genericHits.length === 0, genericHits.length);
check("future_portals_not_registered", transportRegistry.adapters?.length === 1 && transportRegistry.adapters[0]?.adapterId === "bilibili", transportRegistry.adapters?.map((item) => item.adapterId));

const result = {
  schemaVersion: "v3-media-credential-static-audit/v1",
  checks,
  summary: { total: checks.length, passed: checks.filter((item) => item.passed).length },
  passed: checks.every((item) => item.passed)
};
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
if (!result.passed) process.exitCode = 2;
