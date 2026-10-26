// The shared EXACT validator of the frozen V2.1 grounded-comprehension
// contract.
//
// The contract is the FROZEN SCHEMA FILE itself:
//   docs/active/project/contracts/v3_media_grounded_comprehension_v2_1.schema.json
// There is NO reduced duplicate schema here: the module is a generic
// validator that reads the frozen file and implements exactly the JSON
// Schema 2020-12 keywords that file uses. Its equivalence with the
// production `jsonschema` library is proven by a Runtime test.
//
// The module also owns the PRODUCTION canonical serialization:
//
//   json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
//
// which is the byte layout the Runtime writes its derivative with, and it
// owns the contracted artifact file name.

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../..");

/** The contracted name of the durable derivative artifact. */
export const V21_ARTIFACT_FILENAME = "derivative-v2.1.json";

/** The frozen schema version of the derivative. */
export const V21_SCHEMA_VERSION = "v3-media-grounded-comprehension/v2.1";

/** The path of the frozen contract. */
export const V21_SCHEMA_PATH = path.join(
  repoRoot,
  "docs/active/project/contracts/v3_media_grounded_comprehension_v2_1.schema.json",
);

/** The sha256 of a string or a buffer. */
export function sha256Hex(value) {
  return createHash("sha256").update(value).digest("hex");
}

/** Sort the object keys recursively, so the serialization is canonical. */
function sortKeysDeep(value) {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value && typeof value === "object") {
    const sorted = {};
    for (const key of Object.keys(value).sort()) sorted[key] = sortKeysDeep(value[key]);
    return sorted;
  }
  return value;
}

/**
 * The PRODUCTION canonical serialization.
 *
 * It is byte-identical to the Runtime's
 * `json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))`.
 */
export function canonicalJson(value) {
  return JSON.stringify(sortKeysDeep(value));
}

/** The canonical bytes of a value (the production byte layout). */
export function canonicalBytes(value) {
  return Buffer.from(canonicalJson(value), "utf8");
}

/** TRUE when two JSON values are equal. */
export function deepEqual(left, right) {
  return canonicalJson(left) === canonicalJson(right);
}

function typeOf(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (typeof value === "number") return Number.isInteger(value) ? "integer" : "number";
  return typeof value;
}

function resolveRef(ref, root) {
  if (typeof ref !== "string" || !ref.startsWith("#/")) {
    throw new Error(`unsupported $ref: ${ref}`);
  }
  let node = root;
  for (const segment of ref.slice(2).split("/")) {
    node = node?.[segment.replaceAll("~1", "/").replaceAll("~0", "~")];
    if (node === undefined) throw new Error(`unresolved $ref: ${ref}`);
  }
  return node;
}

/**
 * Validate a value against a JSON Schema 2020-12 SUBSET.
 *
 * This is the CHECKED PUBLIC entry point: it inventories the schema's
 * keywords and REFUSES an unsupported one BEFORE the value is evaluated, so
 * a caller can never use this API with a constraint the validator does not
 * implement. The recursive traversal is PRIVATE and assumes the check has
 * already passed, so the inventory runs exactly once per call.
 *
 * The subset is exactly the keyword set of the frozen contract: type, const,
 * enum, pattern, minLength, maxLength, minimum, maximum, minItems,
 * maxItems, uniqueItems, items, properties, required, additionalProperties,
 * $ref, allOf, if/then/else.
 */
export function validateAgainstSchema(schema, value, { root = schema, path = "$" } = {}) {
  // Check the complete graph used for reference resolution as well as the
  // entry schema. Otherwise a caller could put an unsupported constraint in
  // an alternate root and reach it through $ref after only the entry schema
  // had been inventoried.
  assertSchemaKeywordSupport(root);
  if (root !== schema) assertSchemaKeywordSupport(schema);
  const errors = [];
  evaluateSchema(schema, value, root, path, errors);
  return { ok: errors.length === 0, errors };
}

/**
 * The PRIVATE recursive evaluator.
 *
 * It assumes the keyword support was already checked by the public entry
 * point and it never re-inventories the schema.
 */
function evaluateSchema(schema, value, root, path, errors) {
  const visit = (node, item, at, sink) => {
    if (node === true || node === undefined) return;
    if (node === false) {
      sink.push(`${at}: no value is allowed here`);
      return;
    }
    if (typeof node !== "object" || Array.isArray(node)) {
      throw new Error(`invalid schema node at ${at}`);
    }
    if (node.$ref !== undefined) {
      visit(resolveRef(node.$ref, root), item, at, sink);
      const siblings = { ...node };
      delete siblings.$ref;
      if (Object.keys(siblings).length > 0) visit(siblings, item, at, sink);
      return;
    }
    if (node.type !== undefined) {
      const types = Array.isArray(node.type) ? node.type : [node.type];
      const actual = typeOf(item);
      const ok = types.some((type) => (
        type === actual || (type === "number" && actual === "integer")
      ));
      if (!ok) {
        sink.push(`${at}: expected ${types.join("|")}, got ${actual}`);
        return;
      }
    }
    if (node.const !== undefined && !deepEqual(node.const, item)) {
      sink.push(`${at}: value is not the declared constant`);
    }
    if (Array.isArray(node.enum) && !node.enum.some((entry) => deepEqual(entry, item))) {
      sink.push(`${at}: value is not one of the declared enum values`);
    }
    if (typeof item === "string") {
      if (typeof node.pattern === "string" && !new RegExp(node.pattern, "u").test(item)) {
        sink.push(`${at}: value does not match the declared pattern`);
      }
      const length = [...item].length;
      if (Number.isInteger(node.minLength) && length < node.minLength) {
        sink.push(`${at}: string is shorter than the declared minimum`);
      }
      if (Number.isInteger(node.maxLength) && length > node.maxLength) {
        sink.push(`${at}: string is longer than the declared maximum`);
      }
    }
    if (typeof item === "number") {
      if (typeof node.minimum === "number" && item < node.minimum) {
        sink.push(`${at}: number is below the declared minimum`);
      }
      if (typeof node.maximum === "number" && item > node.maximum) {
        sink.push(`${at}: number is above the declared maximum`);
      }
    }
    if (Array.isArray(item)) {
      if (Number.isInteger(node.minItems) && item.length < node.minItems) {
        sink.push(`${at}: array has fewer items than the declared minimum`);
      }
      if (Number.isInteger(node.maxItems) && item.length > node.maxItems) {
        sink.push(`${at}: array has more items than the declared maximum`);
      }
      if (node.uniqueItems === true) {
        const seen = new Set();
        for (const entry of item) {
          const key = canonicalJson(entry);
          if (seen.has(key)) sink.push(`${at}: array items are not unique`);
          seen.add(key);
        }
      }
      if (node.items !== undefined) {
        item.forEach((entry, index) => visit(node.items, entry, `${at}[${index}]`, sink));
      }
    }
    if (item && typeof item === "object" && !Array.isArray(item)) {
      const properties = node.properties ?? {};
      // An `undefined` value is ABSENT in JSON: the validator follows the
      // JSON semantics, so it agrees with the production library on an
      // object that was serialized.
      const present = (key) => (key in item) && item[key] !== undefined;
      for (const key of node.required ?? []) {
        if (!present(key)) sink.push(`${at}: the required property ${key} is missing`);
      }
      for (const [key, sub] of Object.entries(properties)) {
        if (present(key)) visit(sub, item[key], `${at}.${key}`, sink);
      }
      if (node.additionalProperties === false) {
        for (const key of Object.keys(item)) {
          if (item[key] === undefined) continue;
          if (!(key in properties)) sink.push(`${at}: the additional property ${key} is not allowed`);
        }
      } else if (node.additionalProperties && typeof node.additionalProperties === "object") {
        for (const key of Object.keys(item)) {
          if (item[key] === undefined) continue;
          if (!(key in properties)) visit(node.additionalProperties, item[key], `${at}.${key}`, sink);
        }
      }
    }
    for (const sub of node.allOf ?? []) visit(sub, item, at, sink);
    if (node.if !== undefined) {
      const probe = [];
      visit(node.if, item, at, probe);
      if (probe.length === 0 && node.then !== undefined) visit(node.then, item, at, sink);
      if (probe.length > 0 && node.else !== undefined) visit(node.else, item, at, sink);
    }
  };
  visit(schema, value, path, errors);
}

/**
 * The SCHEMA KEYWORDS this validator implements.
 *
 * A keyword outside this set, outside the annotation set, or outside the
 * container set is a HARD FAILURE: the validator never silently ignores an
 * unsupported constraint.
 */
export const SUPPORTED_SCHEMA_KEYWORDS = Object.freeze([
  // assertions
  "type", "const", "enum", "pattern", "minLength", "maxLength",
  "minimum", "maximum", "minItems", "maxItems", "uniqueItems",
  "required",
  // applicators
  "items", "properties", "additionalProperties", "allOf", "if", "then",
  "else", "$ref",
  // containers (they hold named schemas, they assert nothing)
  "$defs",
]);

/**
 * The ANNOTATION and META keywords: they carry no assertion, so they are
 * allowed and ignored.
 */
export const ALLOWED_ANNOTATION_KEYWORDS = Object.freeze([
  "$schema", "$id", "$comment", "title", "description", "default", "examples",
  "deprecated", "readOnly", "writeOnly",
]);

/** The keywords whose value is a SINGLE schema. */
const SINGLE_SCHEMA_KEYWORDS = Object.freeze([
  "items", "additionalProperties", "not", "if", "then", "else", "contains",
  "propertyNames", "unevaluatedItems", "unevaluatedProperties",
]);

/** The keywords whose value is a LIST of schemas. */
const LIST_SCHEMA_KEYWORDS = Object.freeze([
  "allOf", "anyOf", "oneOf", "prefixItems",
]);

/** The keywords whose value is a MAP of named schemas. */
const MAP_SCHEMA_KEYWORDS = Object.freeze(["properties", "$defs", "patternProperties", "dependentSchemas"]);

/**
 * The COMPLETE keyword inventory of a schema.
 *
 * The inventory is STRUCTURAL: the keys of a schema node are keywords, and
 * the NAMES under `properties` and `$defs` are names, not keywords.
 */
export function inventorySchemaKeywords(schema) {
  const found = new Set();
  const walk = (node, path) => {
    if (node === true || node === false) return;
    if (!node || typeof node !== "object" || Array.isArray(node)) return;
    for (const [key, value] of Object.entries(node)) {
      if (MAP_SCHEMA_KEYWORDS.includes(key)) {
        // The keyword ITSELF is a keyword; the NAMES of the map are not.
        found.add(key);
        if (value && typeof value === "object" && !Array.isArray(value)) {
          for (const [name, sub] of Object.entries(value)) {
            walk(sub, `${path}.${key}.${name}`);
          }
        }
        continue;
      }
      found.add(key);
      if (SINGLE_SCHEMA_KEYWORDS.includes(key)) {
        if (value && typeof value === "object" && !Array.isArray(value)) walk(value, `${path}.${key}`);
        continue;
      }
      if (LIST_SCHEMA_KEYWORDS.includes(key)) {
        if (Array.isArray(value)) {
          value.forEach((sub, index) => walk(sub, `${path}.${key}[${index}]`));
        }
        continue;
      }
    }
  };
  walk(schema, "#");
  return [...found].sort();
}

/**
 * Fail CLOSED on an unsupported schema keyword.
 *
 * The inventory is taken BEFORE the schema is cached or used: a contract
 * revision that introduces a constraint this validator does not implement is
 * a hard error, never a silently ignored constraint.
 *
 * @returns {{keywords: string[], unsupported: string[]}}
 * @throws when an unsupported assertion, applicator or validation keyword is used
 */
export function assertSchemaKeywordSupport(schema) {
  const keywords = inventorySchemaKeywords(schema);
  const unsupported = keywords.filter((keyword) => (
    !SUPPORTED_SCHEMA_KEYWORDS.includes(keyword)
    && !ALLOWED_ANNOTATION_KEYWORDS.includes(keyword)
  ));
  if (unsupported.length > 0) {
    throw new Error(
      `the schema uses the unsupported keyword(s): ${unsupported.join(", ")}`,
    );
  }
  return { keywords, unsupported };
}

let frozenSchema = null;

/** The frozen V2.1 schema, loaded once from the contract file. */
export function frozenV21Schema() {
  if (!frozenSchema) {
    const loaded = JSON.parse(fs.readFileSync(V21_SCHEMA_PATH, "utf8"));
    // The keyword inventory is taken BEFORE the schema is cached: an
    // unsupported keyword is a hard failure.
    assertSchemaKeywordSupport(loaded);
    frozenSchema = loaded;
  }
  return frozenSchema;
}

/**
 * Validate a parsed derivative against the FROZEN V2.1 contract.
 *
 * @returns {{ok: boolean, errors: string[]}}
 */
export function validateV21Artifact(value) {
  const schema = frozenV21Schema();
  const verdict = validateAgainstSchema(schema, value);
  if (!verdict.ok) return verdict;
  if (value?.schemaVersion !== V21_SCHEMA_VERSION) {
    return { ok: false, errors: ["$: the schema version is not the frozen V2.1 version"] };
  }
  return verdict;
}
