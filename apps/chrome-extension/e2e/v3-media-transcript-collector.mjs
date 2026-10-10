import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] || "");
const output = path.resolve(process.argv[3] || path.join(root, "artifact-index.json"));
if (!root || !fs.existsSync(root)) throw new Error("V3-2-7 run root is required");

const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
const ignored = new Set([path.relative(root, output).replaceAll(path.sep, "/")]);
const files = [];

function visit(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const absolute = path.join(directory, entry.name);
    const relative = path.relative(root, absolute).replaceAll(path.sep, "/");
    if (entry.isSymbolicLink()) throw new Error(`V3-2-7 symlink forbidden: ${relative}`);
    if (entry.isDirectory()) visit(absolute);
    if (entry.isFile() && !ignored.has(relative)) {
      const payload = fs.readFileSync(absolute);
      files.push({
        path: relative,
        bytes: payload.length,
        sha256: sha256(payload),
        visibility: relative.split("/").includes("private") ? "private" : "public"
      });
    }
  }
}

visit(root);
const index = {
  schemaVersion: "v3-media-transcript-artifact-index/v1",
  runId: path.basename(root),
  fileCount: files.length,
  publicCount: files.filter((item) => item.visibility === "public").length,
  privateCount: files.filter((item) => item.visibility === "private").length,
  files
};
fs.writeFileSync(output, `${JSON.stringify(index, null, 2)}\n`, { mode: 0o600 });
process.stdout.write(`${JSON.stringify({ runId: index.runId, fileCount: index.fileCount })}\n`);
