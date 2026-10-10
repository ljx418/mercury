import fs from "node:fs";
import path from "node:path";
import {
  extractCredentialNeedles,
  scanRootsForCredentialNeedles
} from "./lib/v3CredentialSecretScan.mjs";

function parseArgs(argv) {
  const result = { roots: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--needle-file") result.needleFile = argv[++index];
    else if (argument === "--output") result.output = argv[++index];
    else if (argument === "--root") {
      const pair = argv[++index] ?? "";
      const separator = pair.indexOf("=");
      if (separator < 1) throw new Error("--root must be label=/absolute/path");
      result.roots.push({ label: pair.slice(0, separator), path: path.resolve(pair.slice(separator + 1)) });
    } else throw new Error(`Unknown argument: ${argument}`);
  }
  if (!result.needleFile || !result.output || result.roots.length === 0) {
    throw new Error("Usage: node v3-credential-secret-scan.mjs --needle-file <file> --root label=path --output <json>");
  }
  return result;
}

const options = parseArgs(process.argv.slice(2));
const needles = extractCredentialNeedles(fs.readFileSync(options.needleFile, "utf8"));
const result = scanRootsForCredentialNeedles(options.roots, needles);
fs.mkdirSync(path.dirname(path.resolve(options.output)), { recursive: true });
fs.writeFileSync(path.resolve(options.output), `${JSON.stringify(result, null, 2)}\n`, { mode: 0o600 });
process.stdout.write(`${JSON.stringify(result)}\n`);
if (!result.passed) process.exitCode = 2;
