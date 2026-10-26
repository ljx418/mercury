/**
 * WP0 R6-G2 — owned visible Chrome browser-lifecycle cases.
 *
 * R6B-N01, N02, N03, N05, N06, N07, N10.
 *
 * ONE owned Chrome session drives every browser-lifecycle scenario, with a NEW
 * task per scenario and no grant reuse. Only the extension's own production
 * surfaces are touched. Every Chrome command carries `--mute-audio`; this host
 * zeroes tabCapture PCM under that flag, which is why no case here may depend
 * on audio — the frozen contract does not require it.
 *
 * Nothing here touches the user's Chrome profile or any unrelated process.
 * The Runtime, the Chrome browser process, the profile, the port and the
 * scratch root are all created by this run and torn down by it.
 */

import { spawn, spawnSync } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";

// Windows Chrome owns the profile and the extension, so paths handed to
// it (and to the CDP Extensions domain) must be Windows paths.
const EXTENSION_WIN = "C:\\workSpace\\navia\\apps\\chrome-extension\\chrome-mv3-unpacked";
const VIDEO_PREFIX = "https://www.bilibili.com/video/BV1pohR6rEEh";
const RUNTIME_PORT = 17861;
const CDP_PORT = 9222;
const OUT_ROOT = "/mnt/c/workSpace/.r6-canary";
const PROFILE_WIN = "C:\\workspace\\navia\\.navia\\navia-b5-3-profile-r6g2";
const PROFILE_WSL = "/mnt/c/workspace/navia/.navia/navia-b5-3-profile-r6g2";
const PROFILE_NAME = "navia-b5-3-profile-r6g2";
const CHROME_WIN = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const RUNTIME_ROOT = "/mnt/c/workSpace/.r6-canary";

const wait = (ms) => new Promise((resolve_) => setTimeout(resolve_, ms));
const receipts = [];
const log = (...parts) => console.log("[r6g2]", ...parts);

// ---------------------------------------------------------------------------
// Owned Runtime (WSL) — real uvicorn, real HTTP, real WebSocket
// ---------------------------------------------------------------------------


const G2_TASK_IDS = [
  "media_task_" + "1".repeat(32),
  "media_task_" + "2".repeat(32),
  "media_task_" + "3".repeat(32),
  "media_task_" + "4".repeat(32),
  "media_task_" + "5".repeat(32),
  "media_task_" + "6".repeat(32),
  "media_task_" + "7".repeat(32)
];
const G2_SOURCE_IDENTITIES = G2_TASK_IDS.map(
  (id) => `portal:bilibili:BV1R6G2:cid:${id.slice(-1)}`
);

async function releaseOwnedRuntime() {
  // Kill ONLY a uvicorn whose command line names THIS run's scratch root.
  const result = spawnSync("bash", ["-lc",
    "ps -eo pid,args | grep '[n]avia_runtime.app:app' | grep '" + RUNTIME_ROOT + "' | awk '{print $1}'"
  ], { encoding: "utf8" });
  for (const line of String(result.stdout || "").trim().split("\n")) {
    const pid = Number(line.trim());
    if (Number.isInteger(pid) && pid > 1) spawnSync("kill", ["-9", String(pid)]);
  }
  await wait(1500);
}

let runtimeChildPid = null;

async function startRuntime(extensionId) {
  await mkdir(RUNTIME_ROOT, { recursive: true });
  await releaseOwnedRuntime();
  runtimeCredentials = {
    extensionId,
    token: MASTER_TOKEN,
    origin: `chrome-extension://${extensionId}`
  };
  runtimeProcess = spawn(
    ".venv/bin/python",
    [
      "-m", "uvicorn", "wp0_r6_seeded_runtime:app", "--app-dir", "tests",
      "--host", "127.0.0.1", "--port", String(RUNTIME_PORT)
    ],
    {
      cwd: "/mnt/c/workSpace/navia/services/local-runtime",
      env: {
        ...process.env,
        NAVIA_DB_PATH: `${RUNTIME_ROOT}/runtime.sqlite3`,
        NAVIA_MEDIA_TASK_ROOT: `${RUNTIME_ROOT}/media-tasks`,
        NAVIA_MEDIA_ASR_TASK_ROOT: `${RUNTIME_ROOT}/media-asr-tasks`,
        NAVIA_LOCAL_FILES_TOKEN: MASTER_TOKEN,
        NAVIA_LOCAL_FILES_EXTENSION_ID: extensionId,
        NAVIA_MEDIA_YT_DLP_PATH: `${RUNTIME_ROOT}/deliberately-unavailable-yt-dlp`,
        NAVIA_R6_G2_SCENARIOS: JSON.stringify(G2_TASK_IDS.map((taskId, index) => ({
          taskId,
          sourceIdentity: G2_SOURCE_IDENTITIES[index],
          adapterId: "bilibili",
          mediaId: "BV1R6G2",
          playbackUnitId: "cid",
          partId: String(index + 1),
          consentPolicyId: "bilibili-media-consent/v1",
          consentPolicyRevision: 1
        })))
      },
      stdio: ["ignore", "pipe", "pipe"]
    }
  );
  runtimeChildPid = runtimeProcess.pid;
  let runtimeLog = "";
  runtimeProcess.stdout.on("data", (chunk) => { runtimeLog += String(chunk).slice(0, 8000); });
  runtimeProcess.stderr.on("data", (chunk) => { runtimeLog += String(chunk).slice(0, 8000); });
  for (let attempt = 0; attempt < 160; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${RUNTIME_PORT}/v1/health`);
      if (response.ok) return;
    } catch {
      /* not up yet */
    }
    await wait(500);
  }
  throw new Error(`owned Runtime did not become healthy on 17861: ${runtimeLog.slice(-2000)}`);
}

async function stopRuntime() {
  for (const pid of [runtimeChildPid, runtimeProcess?.pid]) {
    if (!Number.isInteger(pid) || pid <= 1) continue;
    spawnSync("kill", ["-TERM", String(pid)]);
  }
  await wait(2500);
  for (const pid of [runtimeChildPid, runtimeProcess?.pid]) {
    if (!Number.isInteger(pid) || pid <= 1) continue;
    spawnSync("kill", ["-9", String(pid)]);
  }
  runtimeChildPid = null;
  await releaseOwnedRuntime();
}

// ---------------------------------------------------------------------------
// Owned Chrome (Windows) — visible, muted, offscreen, owned profile
// ---------------------------------------------------------------------------

let chromeBrowserPid = null;

// The Runtime authenticates every companion call with the extension origin and
// the master token, exactly as the real extension does.
const MASTER_TOKEN = "r6g2-master-token-000000000000000000000000000000000";
let runtimeProcess = null;
let runtimeCredentials = { extensionId: null, token: MASTER_TOKEN, origin: null };

async function startChrome() {
  spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", `
    if (Test-Path '${PROFILE_WIN}') { Remove-Item -Recurse -Force '${PROFILE_WIN}' }
    Start-Process -FilePath '${CHROME_WIN}' -ArgumentList @(
      '--user-data-dir=${PROFILE_WIN}',
      '--remote-debugging-port=${CDP_PORT}',
      '--load-extension=${EXTENSION_WIN}',
      '--mute-audio',
      '--window-position=-3200,-3200',
      '--window-size=1280,900',
      '--no-first-run',
      '--no-default-browser-check',
      '${VIDEO_PREFIX}'
    )
  `], { encoding: "utf8" });
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`);
      if (response.ok) {
        const owned = ownedBrowserPid();
        if (owned) {
          chromeBrowserPid = owned;
          return;
        }
      }
    } catch {
      /* not up yet */
    }
    await wait(500);
  }
  throw new Error("owned Chrome did not expose CDP");
}

function ownedBrowserPid() {
  const script = `
    $rows=@(Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object {
      $_.CommandLine -and -not $_.CommandLine.Contains('--type=') -and $_.CommandLine.Contains('${PROFILE_NAME}') })
    if($rows.Count -gt 0){ Write-Output $rows[0].ProcessId }`;
  const result = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], { encoding: "utf8" });
  const value = String(result.stdout || "").trim();
  return value ? Number(value) : null;
}

async function stopChrome() {
  spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", `
    Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" |
      Where-Object { $_.CommandLine -and $_.CommandLine.Contains('${PROFILE_NAME}') } |
      ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
  `], { encoding: "utf8" });
  await wait(2500);
  await rm(`/mnt/c/workspace/navia/.navia/${PROFILE_NAME}`, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function runtimeJson(path, options = {}) {
  const response = await fetch(`http://127.0.0.1:${RUNTIME_PORT}${path}`, {
    ...options,
    headers: { Origin: runtimeCredentials.origin, ...(options.headers ?? {}) }
  });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body };
}


async function issueSession() {
  const response = await fetch(`http://127.0.0.1:${RUNTIME_PORT}/v1/companion/sessions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${runtimeCredentials.token}`, Origin: runtimeCredentials.origin }
  });
  const body = await response.json();
  if (!response.ok || !body?.data?.token) {
    throw new Error(`companion session failed: ${response.status} ${JSON.stringify(body)}`);
  }
  return body.data.token;
}

/** Register a capture task through the PRODUCT's own endpoint.

This is exactly what a real acquisition does, so no task row is ever
hand-written: the coordinator registers it in its own memory and the grant
endpoint then validates against the same registration.
 */
async function createAcquisition(session, taskId, sourceIdentity) {
  const partId = sourceIdentity.split(":").at(-1);
  const response = await fetch(`http://127.0.0.1:${RUNTIME_PORT}/v1/media/acquisitions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session}`,
      Origin: runtimeCredentials.origin
    },
    body: JSON.stringify({
      taskId,
      sourceIdentity,
      adapterId: "bilibili",
      mediaId: "BV1R6G2",
      playbackUnitId: "cid",
      partId,
      consentPolicyId: "bilibili-media-consent/v1",
      consentPolicyRevision: 1
    })
  });
  const body = await response.json();
  if (!response.ok) throw new Error(`acquisition failed: ${response.status} ${JSON.stringify(body)}`);
  return body.data.task;
}

async function issueGrant(session, taskId, binding) {
  const response = await fetch(`http://127.0.0.1:${RUNTIME_PORT}/v1/media/capture-grants`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session}`,
      Origin: runtimeCredentials.origin
    },
    body: JSON.stringify({
      taskId,
      adapterId: "bilibili",
      pageIdentitySha256: binding.pageIdentitySha256,
      tabId: binding.tabId,
      tabIdSha256: binding.tabIdSha256,
      surface: "side_panel"
    })
  });
  const body = await response.json();
  if (!response.ok) throw new Error(`grant failed: ${response.status} ${JSON.stringify(body)}`);
  return body.data;
}

async function runtimeSinks(grantId) {
  const session = await issueSession();
  const response = await fetch(`http://127.0.0.1:${RUNTIME_PORT}/v1/media/capture-grants/${grantId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${session}`, Origin: runtimeCredentials.origin }
  });
  const body = await response.json();
  return body.data?.cleanup ?? {};
}

function record(caseId, fields) {
  const receipt = { caseId, ...fields };
  receipts.push(receipt);
  log(caseId, JSON.stringify(fields));
}

export {
  OUT_ROOT,
  EXTENSION_WIN,
  PROFILE_NAME,
  PROFILE_WSL,
  RUNTIME_ROOT,
  startRuntime,
  stopRuntime,
  startChrome,
  stopChrome,
  ownedBrowserPid,
  G2_TASK_IDS,
  G2_SOURCE_IDENTITIES,
  runtimeJson,
  issueSession,
  issueGrant,
  runtimeSinks,
  createAcquisition
};
