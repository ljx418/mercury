import fs from "node:fs";
import path from "node:path";

export function extractCredentialNeedles(rawText) {
  const text = String(rawText);
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      return [...new Set(parsed
        .filter((item) => item && typeof item === "object" && typeof item.value === "string")
        .map((item) => item.value)
        .filter((value) => Buffer.byteLength(value) >= 8))]
        .map((value) => Buffer.from(value));
    }
  } catch {
    // Cookie header and Netscape formats are parsed below.
  }
  const values = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const tabFields = line.split("\t");
    if (tabFields.length >= 7) {
      values.push(tabFields.at(-1));
      continue;
    }
    for (const item of line.replace(/^cookie\s*:\s*/i, "").split(";")) {
      const separator = item.indexOf("=");
      if (separator >= 0) values.push(item.slice(separator + 1).trim());
    }
  }
  return [...new Set(values.filter((value) => typeof value === "string" && Buffer.byteLength(value) >= 8))]
    .map((value) => Buffer.from(value));
}

function walkRegularFiles(root) {
  const files = [];
  const visit = (current) => {
    const stat = fs.lstatSync(current);
    if (stat.isSymbolicLink()) return;
    if (stat.isFile()) {
      files.push(current);
      return;
    }
    if (!stat.isDirectory()) return;
    for (const entry of fs.readdirSync(current).sort()) visit(path.join(current, entry));
  };
  if (fs.existsSync(root)) visit(root);
  return files;
}

export function scanRootsForCredentialNeedles(roots, needles) {
  if (!Array.isArray(needles) || needles.length === 0) throw new Error("At least one credential needle is required.");
  let scannedFiles = 0;
  let scannedBytes = 0;
  let hitCount = 0;
  for (const root of roots) {
    for (const file of walkRegularFiles(root.path)) {
      const bytes = fs.readFileSync(file);
      scannedFiles += 1;
      scannedBytes += bytes.length;
      for (const needle of needles) if (bytes.includes(needle)) hitCount += 1;
    }
  }
  return {
    schemaVersion: "v3-media-credential-secret-scan/v1",
    scannedRootLabels: roots.map((root) => root.label),
    scannedFiles,
    scannedBytes,
    hitCount,
    passed: hitCount === 0
  };
}
