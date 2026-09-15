import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { deriveFacts } from "./v2PxDerivedFacts.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../");
const base = "docs/active/project/evidence/v2_external_brain_productization/px-5";
const current = path.join(repoRoot, base, "t02.5-t01-structured-regression-recollection/runs/t02-r2-t01-structured-production-input-20260914T125700");
const t02_4 = path.join(repoRoot, base, "t02.4-runtime-offline-boundary-recollection/runs/t02-r2-runtime-offline-boundary-production-input-20260914T095030");
const old = path.join(repoRoot, base, "t02.1-r2-production-input-recollection/runs/t02-r2-raw-production-input-20260912T053500");
const implementation = { artifactRoot: "validation_run", path: "input/generator.mjs", sha256: "a".repeat(64), byteLength: 1, mediaType: "text/javascript" };

test("T02.5 derives a deterministic production-positive fact set with sealed T01 assertion details", () => {
  const first = deriveFacts({ runRoot: current, generatorImplementation: implementation });
  const second = deriveFacts({ runRoot: current, generatorImplementation: implementation });
  assert.deepEqual(first.facts, second.facts);
  assert.deepEqual(first.gaps, []);
  assert.equal(first.facts.summary.t01Regression.assertionsTotal, 36);
  assert.equal(first.facts.summary.t01Regression.assertionsPassed, 36);
  assert.equal(new Set(first.facts.summary.t01Regression.assertionIds).size, 36);
  assert.equal(first.facts.sourceMappings.length, 12);
  assert.deepEqual(first.facts.summary.sourceDistribution, { web: 6, note: 3, local: 3 });
  assert.equal(first.facts.summary.durableForgetTriggers, 12);
  assert.equal(first.facts.summary.durableForgetRecoveries, 12);
  const eventIds = new Set(first.raw.events.map((event) => event.eventId));
  for (const scenario of first.facts.scenarioFacts) for (const ids of Object.values(scenario.provenance)) for (const id of ids) assert.ok(eventIds.has(id));
});

test("T02.4 fails closed without sealed T01 assertion details", () => {
  const result = deriveFacts({ runRoot: t02_4, generatorImplementation: implementation });
  assert.deepEqual(result.gaps.map((gap) => gap.requirementId), ["T03-IN-11"]);
  assert.equal(result.facts.summary.t01Regression, null);
});

test("older T02.1 input fails closed on missing durable Forget recovery", () => {
  const result = deriveFacts({ runRoot: old, generatorImplementation: implementation });
  assert.ok(result.gaps.some((gap) => gap.requirementId === "T03-IN-09"));
  assert.ok(result.gaps.find((gap) => gap.requirementId === "T03-IN-09").observed < 12);
});
