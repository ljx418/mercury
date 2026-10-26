// The STUB runner of the authorization composition tests.
//
// It records its argv and writes the COMPLETE, CONTRACT-SHAPED audit set: the
// durable ledger events, the machine receipt with the full internal
// publication shape, and the receipt mirror with the frozen V2.1 receipt
// identity.
//
// It launches nothing: no Chrome, no Runtime, no Provider, no Cookie.

import fs from "node:fs";
import path from "node:path";

import { writeContractShapedEvidence } from "./contract_shaped_stub.mjs";

const argv = process.argv.slice(2);
const get = (name) => (argv.find((a) => a.startsWith(`--${name}=`)) || "").split("=").slice(1).join("=");
const order = get("order");
const bvid = get("bvid");
const runId = get("run-id");
const evidenceRoot = get("evidence-root");
const dir = path.join(evidenceRoot, `bvid-${order}-${bvid}`);
fs.mkdirSync(dir, { recursive: true, mode: 0o700 });

writeContractShapedEvidence({
  dir,
  order,
  bvid,
  runId,
  stageRoot: process.env.NAVIA_B5_STAGE_ROOT || null,
  mutation: "none",
  requestCount: 3,
});

fs.writeFileSync(path.join(dir, "stub-argv.json"), `${JSON.stringify({
  order,
  bvid,
  grantId: get("grant-id"),
  authorizationDigest: get("authorization-digest"),
}, null, 2)}\n`, { mode: 0o600 });

process.exit(0);
