// SB3 — the shared schema validator is FAIL-CLOSED on unknown keywords.
//
// The frozen contract is inventoried BEFORE it is used: an unsupported
// assertion, applicator or validation keyword is a hard error, never a
// silently ignored constraint.
//
// The keyword inventory is STRUCTURAL: the keys of a schema node are
// keywords, and the NAMES under `properties` and `$defs` are names.
//
// No Chrome, no Runtime, no Provider, no Cookie, no media.

import test from "node:test";
import assert from "node:assert/strict";

import {
  ALLOWED_ANNOTATION_KEYWORDS,
  SUPPORTED_SCHEMA_KEYWORDS,
  assertSchemaKeywordSupport,
  frozenV21Schema,
  inventorySchemaKeywords,
  validateAgainstSchema,
  validateV21Artifact,
} from "../lib/v21_artifact.mjs";

/** A minimal schema with the frozen keyword subset. */
function minimalSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["a"],
    properties: {
      a: { type: "string", minLength: 1, maxLength: 8, pattern: "^[a-z]+$" },
      b: { type: "array", minItems: 1, maxItems: 3, uniqueItems: true, items: { type: "integer", minimum: 0, maximum: 9 } },
      c: { enum: ["x", "y"] },
      d: { const: 1 },
    },
    $defs: {
      Nested: { type: "object", required: ["n"], properties: { n: { type: "string" } }, additionalProperties: false },
    },
  };
}

test("SB3: the frozen schema's keyword inventory is fully supported", () => {
  const schema = frozenV21Schema();
  const keywords = inventorySchemaKeywords(schema);
  assert.ok(keywords.length > 0);
  // Every keyword of the ACTUAL frozen file is supported or allowed.
  const unsupported = keywords.filter((keyword) => (
    !SUPPORTED_SCHEMA_KEYWORDS.includes(keyword)
    && !ALLOWED_ANNOTATION_KEYWORDS.includes(keyword)
  ));
  assert.deepEqual(unsupported, [], "the frozen schema must use only supported keywords");
  // The inventory is structural: the property NAMES are not keywords.
  assert.ok(!keywords.includes("a"), "a property name is not a schema keyword");
  assert.ok(!keywords.includes("Nested"), "a definition name is not a schema keyword");
  assert.ok(keywords.includes("properties"), "the properties keyword is a keyword");
  assert.ok(keywords.includes("$defs"), "the $defs keyword is a keyword");
  // The assertion does not throw for the real contract.
  const verdict = assertSchemaKeywordSupport(schema);
  assert.deepEqual(verdict.unsupported, []);
});

test("SB3: an unsupported keyword at the ROOT throws", () => {
  const schema = { ...minimalSchema(), not: { required: ["b"] } };
  assert.throws(() => assertSchemaKeywordSupport(schema), /unsupported keyword\(s\): not/);
  // The PUBLIC validation entry point enforces the contract ITSELF.
  assert.throws(() => validateAgainstSchema(schema, {}), /unsupported keyword\(s\): not/);
});

test("SB3: an unsupported keyword in a $defs schema throws", () => {
  const schema = minimalSchema();
  schema.$defs.Nested = { type: "object", minProperties: 2 };
  assert.throws(() => assertSchemaKeywordSupport(schema), /unsupported keyword\(s\): minProperties/);
  assert.throws(() => validateAgainstSchema(schema, {}), /unsupported keyword\(s\): minProperties/);
});

test("SB3: an unsupported keyword in an items schema throws", () => {
  const schema = minimalSchema();
  schema.properties.b.items = { type: "integer", exclusiveMinimum: 0 };
  assert.throws(() => assertSchemaKeywordSupport(schema), /unsupported keyword\(s\): exclusiveMinimum/);
  assert.throws(() => validateAgainstSchema(schema, {}), /unsupported keyword\(s\): exclusiveMinimum/);
});

test("SB3: an unsupported keyword in a property schema throws", () => {
  const schema = minimalSchema();
  schema.properties.a = { type: "string", pattern: "^[a-z]+$", multipleOf: 2 };
  assert.throws(() => assertSchemaKeywordSupport(schema), /unsupported keyword\(s\): multipleOf/);
  assert.throws(() => validateAgainstSchema(schema, {}), /unsupported keyword\(s\): multipleOf/);
});

test("SB3: an unsupported keyword in an if, then or else schema throws", () => {
  const withIf = minimalSchema();
  withIf.if = { required: ["a"], contains: { const: 1 } };
  assert.throws(() => assertSchemaKeywordSupport(withIf), /unsupported keyword\(s\): contains/);
  assert.throws(() => validateAgainstSchema(withIf, {}), /unsupported keyword\(s\): contains/);

  const withThen = minimalSchema();
  withThen.then = { required: ["b"], propertyNames: { pattern: "^[a-z]+$" } };
  assert.throws(() => assertSchemaKeywordSupport(withThen), /unsupported keyword\(s\): propertyNames/);
  assert.throws(() => validateAgainstSchema(withThen, {}), /unsupported keyword\(s\): propertyNames/);

  const withElse = minimalSchema();
  withElse.else = { required: ["b"], dependentRequired: { a: ["b"] } };
  assert.throws(() => assertSchemaKeywordSupport(withElse), /unsupported keyword\(s\): dependentRequired/);
  assert.throws(() => validateAgainstSchema(withElse, {}), /unsupported keyword\(s\): dependentRequired/);
});

test("SB3: the unsupported keywords are never silently ignored", () => {
  // The reproduction of the review: a value that the unsupported keyword
  // would have rejected must not be ACCEPTED by the validator. The PUBLIC
  // entry point is the one that is called.
  const withNot = {
    type: "object",
    properties: { a: { type: "string", not: { const: "forbidden" } } },
  };
  assert.throws(() => assertSchemaKeywordSupport(withNot), /unsupported keyword\(s\): not/);
  assert.throws(() => validateAgainstSchema(withNot, {}), /unsupported keyword\(s\): not/);

  const withMinProperties = {
    type: "object",
    properties: { a: { type: "string" } },
    minProperties: 3,
  };
  assert.throws(() => assertSchemaKeywordSupport(withMinProperties), /unsupported keyword\(s\): minProperties/);
  assert.throws(() => validateAgainstSchema(withMinProperties, {}), /unsupported keyword\(s\): minProperties/);

  const withExclusiveMinimum = {
    type: "object",
    properties: { a: { type: "integer", exclusiveMinimum: 0 } },
  };
  assert.throws(() => assertSchemaKeywordSupport(withExclusiveMinimum), /unsupported keyword\(s\): exclusiveMinimum/);
  assert.throws(() => validateAgainstSchema(withExclusiveMinimum, {}), /unsupported keyword\(s\): exclusiveMinimum/);
});

test("AC3: the PUBLIC validation entry point is fail-closed on its own", () => {
  // The exact reproduction of the review: the public API with an unsupported
  // keyword must HARD FAIL.
  assert.throws(
    () => validateAgainstSchema({ type: "object", not: {} }, {}),
    /unsupported keyword\(s\): not/,
  );
  // A NESTED unsupported keyword fails too.
  assert.throws(
    () => validateAgainstSchema({
      type: "object",
      properties: { a: { type: "object", properties: { b: { type: "string", minProperties: 1 } } } },
    }, {}),
    /unsupported keyword\(s\): minProperties/,
  );
  // A supported schema still validates through the SAME public API.
  const verdict = validateAgainstSchema(minimalSchema(), { a: "ok" });
  assert.equal(verdict.ok, true);
});

test("BP2: an alternate reference root cannot bypass keyword validation", () => {
  const root = { $defs: { X: { type: "object", not: {} } } };
  const entry = { $ref: "#/$defs/X" };
  assert.throws(
    () => validateAgainstSchema(entry, {}, { root }),
    /unsupported keyword\(s\): not/,
  );
  const chainedRoot = {
    $defs: {
      X: { $ref: "#/$defs/Y" },
      Y: { type: "number", exclusiveMinimum: 0 },
    },
  };
  assert.throws(
    () => validateAgainstSchema({ $ref: "#/$defs/X" }, 1, { root: chainedRoot }),
    /unsupported keyword\(s\): exclusiveMinimum/,
  );
});

test("SB3: the annotation keywords are allowed and asserted by nothing", () => {
  const schema = {
    ...minimalSchema(),
    title: "a title",
    description: "a description",
    $comment: "a comment",
    default: {},
    examples: [{}],
    deprecated: false,
    readOnly: false,
    writeOnly: false,
  };
  const verdict = assertSchemaKeywordSupport(schema);
  assert.deepEqual(verdict.unsupported, []);
  assert.ok(verdict.keywords.includes("title"));
});

test("SB3: the supported keyword subset still validates values", () => {
  const schema = minimalSchema();
  assert.equal(validateAgainstSchema(schema, { a: "ok", b: [1, 2] }).ok, true);
  assert.equal(validateAgainstSchema(schema, { a: "TOO LONG" }).ok, false);
  assert.equal(validateAgainstSchema(schema, { a: "ok", b: [1, 1] }).ok, false);
  assert.equal(validateAgainstSchema(schema, { a: "ok", extra: 1 }).ok, false);
  assert.equal(validateAgainstSchema(schema, {}).ok, false);
});

test("SB3: the real artifact validator refuses an unsupported frozen schema", () => {
  // The frozen schema is validated before it is cached: the real file passes.
  assert.doesNotThrow(() => frozenV21Schema());
  // A schema with an unsupported keyword is refused before it is used.
  const schema = { type: "object", properties: { a: { type: "string", unevaluatedItems: false } } };
  assert.throws(() => assertSchemaKeywordSupport(schema), /unsupported keyword\(s\): unevaluatedItems/);
});

test("SB3: the artifact validator still accepts the real contract", () => {
  // The real frozen schema is supported: the validator is usable.
  const verdict = validateV21Artifact({ schemaVersion: "not-the-frozen-one" });
  assert.equal(verdict.ok, false);
});
