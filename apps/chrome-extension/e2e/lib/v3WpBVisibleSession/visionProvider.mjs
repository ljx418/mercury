import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { HarnessError } from "./plan.mjs";

const COPY_VERIFIED_PROVIDER = String.raw`
import json, sqlite3, sys
source, target = sys.argv[1], sys.argv[2]
src = sqlite3.connect(f"file:{source}?mode=ro", uri=True)
src.row_factory = sqlite3.Row
selected = src.execute("SELECT selected_provider_id FROM vision_provider_settings WHERE singleton=1").fetchone()
if not selected or not selected[0]: raise SystemExit("no selected vision provider")
row = src.execute("SELECT * FROM vision_providers WHERE id=? AND enabled=1", (selected[0],)).fetchone()
if not row: raise SystemExit("selected vision provider is missing")
status = json.loads(row["test_status_json"] or "{}")
if status.get("status") != "ok": raise SystemExit("selected vision provider is not verified")
dst = sqlite3.connect(target)
with dst:
    dst.execute("CREATE TABLE vision_providers (id TEXT PRIMARY KEY, adapter_kind TEXT NOT NULL, name TEXT NOT NULL, base_url TEXT NOT NULL, model TEXT NOT NULL, secret_ref TEXT NOT NULL, secret_storage TEXT NOT NULL, test_status_json TEXT, enabled INTEGER NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)")
    dst.execute("CREATE TABLE vision_provider_settings (singleton INTEGER PRIMARY KEY CHECK(singleton=1), selected_provider_id TEXT, updated_at TEXT NOT NULL)")
    columns = ("id","adapter_kind","name","base_url","model","secret_ref","secret_storage","test_status_json","enabled","created_at","updated_at")
    dst.execute("INSERT INTO vision_providers VALUES (?,?,?,?,?,?,?,?,?,?,?)", tuple(row[name] for name in columns))
    dst.execute("INSERT INTO vision_provider_settings VALUES (1,?,?)", (row["id"], row["updated_at"]))
print(row["id"])
`;

export function prepareOwnedVisionProviderMetadata({ sourceDb, ownedRoot, run = spawnSync }) {
  if (!sourceDb || !fs.existsSync(sourceDb) || !fs.statSync(sourceDb).isFile()) {
    throw new HarnessError("EXTERNAL-INPUT BLOCK: the configured vision Provider database is missing.");
  }
  const runtimeRoot = path.join(ownedRoot, "runtime");
  fs.mkdirSync(runtimeRoot, { recursive: true, mode: 0o700 });
  const destination = path.join(runtimeRoot, "vision-providers.sqlite3");
  fs.rmSync(destination, { force: true });
  const result = run("python3", ["-c", COPY_VERIFIED_PROVIDER, sourceDb, destination], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
  if (result.status !== 0 || !fs.existsSync(destination) || !fs.statSync(destination).isFile()) {
    fs.rmSync(destination, { force: true });
    throw new HarnessError(
      `EXTERNAL-INPUT BLOCK: no selected, verified vision Provider metadata is available (${String(result.stderr || "copy failed").trim()}).`
    );
  }
  return { dbPath: destination, providerId: String(result.stdout).trim() };
}
