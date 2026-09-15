import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { canonicalJson } from "./v2PxRawCollector.mjs";
import { normalizeArtifactPath, sha256 } from "./v2PxArtifactReader.mjs";

export function writeAtomic(filePath, bytes) {
  const target = path.resolve(filePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const temporary = `${target}.tmp-${process.pid}-${randomUUID()}`;
  fs.writeFileSync(temporary, bytes, { flag: "wx", mode: 0o600 });
  fs.renameSync(temporary, target);
}

export function writeJson(filePath, value) {
  writeAtomic(filePath, Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8"));
}

export function copyAsArtifact(sourcePath, outputRoot, relativePath, mediaType) {
  const clean = normalizeArtifactPath(relativePath);
  const bytes = fs.readFileSync(path.resolve(sourcePath));
  writeAtomic(path.join(path.resolve(outputRoot), ...clean.split("/")), bytes);
  return { artifactRoot: "validation_run", path: clean, sha256: sha256(bytes), byteLength: bytes.length, mediaType };
}

export function refForBytes(artifactRoot, relativePath, bytes, mediaType) {
  const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  return { artifactRoot, path: normalizeArtifactPath(relativePath, { allowVirtual: artifactRoot === "repository_snapshot" }), sha256: sha256(buffer), byteLength: buffer.length, mediaType };
}

export function sealCanonical(document) {
  return { inputMode: "canonical_json_without_seal_v1", contentSha256: sha256(Buffer.from(canonicalJson(document), "utf8")) };
}

export function parseArgs(argv, required = []) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--") || token === "--") throw new Error(`Unknown argument: ${token}`);
    const key = token.slice(2);
    if (!key || index + 1 >= argv.length || argv[index + 1].startsWith("--")) throw new Error(`Missing value for --${key}`);
    if (Object.hasOwn(result, key)) throw new Error(`Duplicate argument: --${key}`);
    result[key] = argv[index + 1];
    index += 1;
  }
  for (const key of required) if (!result[key]) throw new Error(`Missing required argument: --${key}`);
  return result;
}

export function jsonSchemaBatchErrors(schemaPath, instances) {
  const program = [
    "import glob,json,os,sys",
    "from jsonschema import Draft202012Validator,RefResolver",
    "p=json.load(sys.stdin)",
    "s=json.load(open(p['schema'],encoding='utf-8'))",
    "Draft202012Validator.check_schema(s)",
    "store={}",
    "for f in glob.glob(os.path.join(os.path.dirname(p['schema']),'*.schema.json')):",
    " d=json.load(open(f,encoding='utf-8'))",
    " if d.get('$id'): store[d['$id']]=d",
    "r=RefResolver.from_schema(s,store=store)",
    "v=Draft202012Validator(s,resolver=r)",
    "out=[]",
    "for i,x in enumerate(p['instances']):",
    " out.extend({'index':i,'message':e.message,'path':'/'.join(str(y) for y in e.absolute_path)} for e in v.iter_errors(x))",
    "print(json.dumps(out))"
  ].join("\n");
  const result = spawnSync("python3", ["-c", program], { input: JSON.stringify({ schema: path.resolve(schemaPath), instances }), encoding: "utf8", maxBuffer: 4 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`Schema validator failed for ${schemaPath}: ${result.stdout}${result.stderr}`);
  return JSON.parse(result.stdout);
}

export function validateJsonSchema(schemaPath, instance) {
  const errors = jsonSchemaBatchErrors(schemaPath, [instance]);
  if (errors.length) throw new Error(`Schema validation failed for ${schemaPath}: ${JSON.stringify(errors)}`);
}
