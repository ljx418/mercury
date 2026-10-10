import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");
const evidenceRoot = process.env.NAVIA_V3_EVIDENCE_ROOT
  ? path.resolve(repoRoot, process.env.NAVIA_V3_EVIDENCE_ROOT)
  : path.join(repoRoot, "docs/active/project/evidence/v3_media_companion/v3-1-page-session-baseline");
const candidatesPath = process.env.NAVIA_V3_CANDIDATES || path.join(evidenceRoot, "probe-candidates.json");
const cookieSeedPath = process.env.NAVIA_V3_BILIBILI_COOKIE_FILE || null;
const profileClass = cookieSeedPath ? "user_authorized_temporary_v3_2" : "fresh_temporary_public";
const browserExecutable = process.env.NAVIA_BROWSER_EXECUTABLE || "/mnt/c/Program Files/Google/Chrome/Application/chrome.exe";
const runId = process.env.NAVIA_V3_RUN_ID || `v3-1p-bilibili-probe-${new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")}`;
const runRoot = process.env.NAVIA_V3_RUN_ROOT
  ? path.resolve(repoRoot, process.env.NAVIA_V3_RUN_ROOT)
  : path.join(evidenceRoot, "runs", runId);
const screenshotRoot = path.join(runRoot, "candidate-screenshots");
const profileRoot = path.join(repoRoot, ".tmp", `${runId}-profile`);
const navigationTimeoutMs = Number(process.env.NAVIA_V3_NAVIGATION_TIMEOUT_MS || 60000);
const naturalReprobeIntervalSeconds = Number(process.env.NAVIA_V3_NATURAL_REPROBE_INTERVAL_SECONDS || 31);
const candidateBvidFilter = new Set(
  String(process.env.NAVIA_V3_CANDIDATE_BVIDS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
);
const allowedCookieNames = new Set(["DedeUserID", "DedeUserID__ckMd5", "SESSDATA", "b_nut", "bili_jct", "buvid3", "buvid4", "buvid_fp", "sid"]);

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
}

function slug(value) {
  return String(value).replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
}

function readAuthorizedCookies() {
  if (!cookieSeedPath) return [];
  if (!fs.existsSync(cookieSeedPath)) throw new Error("Authorized Bilibili session seed is missing");
  const parsed = JSON.parse(fs.readFileSync(cookieSeedPath, "utf8"));
  if (!Array.isArray(parsed)) throw new Error("Authorized Bilibili session seed must be a JSON array");
  const cookies = parsed.flatMap((row) => {
    if (!row || typeof row !== "object" || !allowedCookieNames.has(row.name) || typeof row.value !== "string" || !row.value) return [];
    const normalizedDomain = String(row.domain || "").toLowerCase().replace(/^\./, "");
    if (normalizedDomain !== "bilibili.com" && !normalizedDomain.endsWith(".bilibili.com")) {
      throw new Error("Authorized seed contains a non-Bilibili domain");
    }
    const sameSite = row.sameSite === "strict" ? "Strict" : row.sameSite === "lax" ? "Lax" : row.sameSite === "no_restriction" ? "None" : undefined;
    return [{
      name: row.name,
      value: row.value,
      domain: ".bilibili.com",
      path: typeof row.path === "string" ? row.path : "/",
      httpOnly: row.httpOnly === true,
      secure: row.secure === true,
      ...(sameSite ? { sameSite } : {}),
      ...(Number.isFinite(row.expirationDate) ? { expires: row.expirationDate } : {})
    }];
  });
  if (!cookies.some((cookie) => cookie.name === "SESSDATA")) throw new Error("Authorized seed lacks SESSDATA");
  if (new Set(cookies.map((cookie) => cookie.name)).size !== allowedCookieNames.size) throw new Error("Authorized seed does not match the frozen nine-name registry");
  return cookies;
}

async function toWindowsPath(filePath) {
  const result = await run("wslpath", ["-w", filePath]);
  if (result.code !== 0) throw new Error(`wslpath failed: ${result.stderr || result.stdout}`);
  return result.stdout.trim().replaceAll("\\", "/");
}

function run(command, args) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd: repoRoot, env: process.env, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForCdp(port, timeoutMs = 30000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (response.ok) return true;
    } catch {
      // Chrome is still starting.
    }
    await wait(300);
  }
  return false;
}

async function launchFreshChrome() {
  if (!fs.existsSync(browserExecutable)) throw new Error(`Chrome executable missing: ${browserExecutable}`);
  fs.rmSync(profileRoot, { recursive: true, force: true });
  fs.mkdirSync(profileRoot, { recursive: true, mode: 0o700 });
  const port = 11300 + Math.floor(Math.random() * 500);
  const child = spawn(browserExecutable, [
    "--headless=new",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-sync",
    "--disable-extensions",
    "--disable-popup-blocking",
    "--mute-audio",
    "--window-size=1280,900",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${await toWindowsPath(profileRoot)}`,
    "about:blank"
  ], { cwd: repoRoot, env: process.env, stdio: ["ignore", "pipe", "pipe"] });
  let chromeStderr = "";
  child.stderr.on("data", (chunk) => { chromeStderr += String(chunk); });
  if (!(await waitForCdp(port))) {
    child.kill("SIGTERM");
    throw new Error(`Chrome CDP unavailable. ${chromeStderr.slice(-1000)}`);
  }
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
  const context = browser.contexts()[0];
  if (!context) throw new Error("Chrome exposed no browser context");
  return {
    browser,
    context,
    child,
    close: async () => {
      await browser.close().catch(() => undefined);
      child.kill("SIGTERM");
      const processTreeCleanup = `$root = Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'chrome.exe' -and $_.CommandLine -like '*${runId}-profile*' -and $_.CommandLine -notlike '*--type=*' } | Select-Object -First 1; if ($root) { & taskkill.exe /PID $root.ProcessId /T /F | Out-Null }`;
      await run("powershell.exe", ["-NoProfile", "-Command", processTreeCleanup]).catch(() => undefined);
      await Promise.race([
        new Promise((resolve) => child.once("close", resolve)),
        wait(5000)
      ]);
      await wait(1500);
      fs.rmSync(profileRoot, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 });
    }
  };
}

function extractBvid(url) {
  return new URL(url).pathname.match(/\/video\/(BV[A-Za-z0-9]+)/)?.[1] || "";
}

async function probeCandidate(context, candidate, index) {
  const page = await context.newPage();
  await page.setViewportSize({ width: 1280, height: 900 });
  page.setDefaultNavigationTimeout(navigationTimeoutMs);
  const responseFacts = [];
  page.on("response", (response) => {
    const url = response.url();
    if (/api\.bilibili\.com\/(x\/web-interface\/view|x\/player\/v2)/.test(url)) {
      const parsed = new URL(url);
      responseFacts.push({
        endpoint: parsed.pathname,
        bvid: parsed.searchParams.get("bvid"),
        cid: parsed.searchParams.get("cid"),
        status: response.status()
      });
    }
  });
  const requestedBvid = extractBvid(candidate.url);
  const observedAt = new Date().toISOString();
  let navigationStatus = null;
  let navigationError = null;
  try {
    const response = await page.goto(candidate.url, { waitUntil: "domcontentloaded" });
    navigationStatus = response?.status() ?? null;
    await page.waitForTimeout(6000);
  } catch (error) {
    navigationError = error instanceof Error ? error.message : String(error);
  }

  const pageFacts = await page.evaluate(async ({ requestedBvid }) => {
    const state = globalThis.__INITIAL_STATE__ || {};
    const playinfo = globalThis.__playinfo__ || {};
    const initialVideo = state.videoData || state.videoInfo || {};
    const firstPage = Array.isArray(initialVideo.pages) ? initialVideo.pages[0] : null;
    const bvid = initialVideo.bvid || state.bvid || requestedBvid;
    const cid = String(initialVideo.cid || state.cid || firstPage?.cid || "");
    const fetchJson = async (url) => {
      try {
        const response = await fetch(url, { credentials: "include" });
        const text = await response.text();
        let body = null;
        try { body = JSON.parse(text); } catch { body = null; }
        return { ok: response.ok, status: response.status, text, body };
      } catch (error) {
        return { ok: false, status: 0, text: "", body: null, error: error instanceof Error ? error.message : String(error) };
      }
    };
    const view = await fetchJson(`https://api.bilibili.com/x/web-interface/view?bvid=${encodeURIComponent(bvid)}`);
    const viewData = view.body?.data || initialVideo || {};
    const pages = Array.isArray(viewData.pages) ? viewData.pages : Array.isArray(initialVideo.pages) ? initialVideo.pages : [];
    // The page bootstrap cid reflects the selected ?p= part; the view API cid is
    // normally the collection default and must not override that selection.
    const resolvedCid = String(cid || viewData.cid || pages[0]?.cid || "");
    const selectedPage = pages.find((item) => String(item?.cid || "") === resolvedCid) || pages[0] || null;
    const selectedPartIndex = Math.max(1, pages.findIndex((item) => String(item?.cid || "") === resolvedCid) + 1);
    const playerWbi = resolvedCid
      ? await fetchJson(`https://api.bilibili.com/x/player/wbi/v2?bvid=${encodeURIComponent(bvid)}&cid=${encodeURIComponent(resolvedCid)}`)
      : { ok: false, status: 0, text: "", body: null, error: "cid_missing" };
    const playerLegacy = resolvedCid
      ? await fetchJson(`https://api.bilibili.com/x/player/v2?bvid=${encodeURIComponent(bvid)}&cid=${encodeURIComponent(resolvedCid)}`)
      : { ok: false, status: 0, text: "", body: null, error: "cid_missing" };
    const playerSubtitles = [
      ...(playerWbi.body?.data?.subtitle?.subtitles || playerWbi.body?.data?.subtitle?.list || []),
      ...(playerLegacy.body?.data?.subtitle?.subtitles || playerLegacy.body?.data?.subtitle?.list || [])
    ];
    const bootstrapSubtitles = playinfo?.data?.subtitle?.subtitles || playinfo?.data?.subtitle?.list || [];
    const fullBodyText = String(document.body?.innerText || "").replace(/\s+/g, " ");
    const fullHtml = String(document.documentElement?.innerHTML || "");
    const metaDescription = String(
      document.querySelector("meta[name='description']")?.getAttribute("content") ||
      document.querySelector("meta[itemprop='description']")?.getAttribute("content") ||
      ""
    ).replace(/\s+/g, " ");
    const bodyText = fullBodyText.slice(0, 30000);
    const contributorIndex = fullBodyText.indexOf("字幕制作者");
    const subtitleContributorExcerpt = contributorIndex >= 0
      ? fullBodyText.slice(Math.max(0, contributorIndex - 120), contributorIndex + 500)
      : "";
    const htmlContributorIndex = fullHtml.indexOf("字幕制作者");
    const subtitleHtmlContributorExcerpt = htmlContributorIndex >= 0
      ? fullHtml.slice(Math.max(0, htmlContributorIndex - 160), htmlContributorIndex + 650).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")
      : "";
    const classificationMarkers = ["全程无解说", "无人声", "纯音乐无字幕", "无解说、无背景音乐", "该视频为"];
    const classificationIndex = classificationMarkers
      .map((marker) => fullBodyText.indexOf(marker))
      .filter((position) => position >= 0)
      .sort((left, right) => left - right)[0] ?? -1;
    const classificationExcerpt = classificationIndex >= 0
      ? fullBodyText.slice(Math.max(0, classificationIndex - 120), classificationIndex + 600)
      : "";
    const subtitleControls = Array.from(document.querySelectorAll("button,[role='button'],[class*='subtitle']"))
      .map((node) => String(node.textContent || node.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim())
      .filter((text) => /字幕|subtitle|CC/i.test(text))
      .slice(0, 20);
    const subtitleDomCandidates = Array.from(document.querySelectorAll("[class*='subtitle']"))
      .map((node) => ({
        className: typeof node.className === "string" ? node.className.slice(0, 180) : "",
        text: String(node.textContent || "").replace(/\s+/g, " ").trim().slice(0, 300)
      }))
      .filter((item) => item.text && item.text.length <= 300)
      .slice(0, 80);
    const restrictionPatterns = [
      "充电专属", "即可观看", "会员专享", "登录后观看", "地区限制", "非常抱歉", "视频不见了", "试看中"
    ];
    return {
      finalUrl: location.href,
      documentTitle: document.title,
      bvid,
      cid: resolvedCid,
      partId: String(selectedPage?.page || selectedPartIndex),
      partIndex: selectedPartIndex,
      title: viewData.title || initialVideo.title || document.querySelector("h1")?.textContent?.trim() || "",
      author: viewData.owner?.name || initialVideo.owner?.name || "",
      durationSeconds: Number(selectedPage?.duration || viewData.duration || initialVideo.duration || 0),
      partCount: pages.length || 1,
      parts: pages.slice(0, 120).map((item, partIndex) => ({
        partId: String(item.page || partIndex + 1),
        cid: String(item.cid || ""),
        title: String(item.part || ""),
        durationSeconds: Number(item.duration || 0)
      })),
      subtitleItems: [...playerSubtitles, ...bootstrapSubtitles].slice(0, 20).map((item) => ({
        id: String(item.id || item.id_str || item.lan || ""),
        language: String(item.lan || ""),
        label: String(item.lan_doc || item.subtitle_url || "")
      })),
      subtitleControls,
      subtitleDomCandidates,
      subtitleContributorExcerpt,
      subtitleHtmlContributorExcerpt,
      metaDescription: metaDescription.slice(0, 1600),
      classificationExcerpt,
      restrictionSignals: restrictionPatterns.filter((pattern) => fullBodyText.includes(pattern)),
      bodyEvidenceExcerpt: bodyText.slice(0, 1200),
      pageStateCode: Number(state.error?.code || state.errorCode || view.body?.code || 0),
      viewApi: { ok: view.ok, status: view.status, code: view.body?.code ?? null, rawText: view.text },
      playerWbiApi: { ok: playerWbi.ok, status: playerWbi.status, code: playerWbi.body?.code ?? null, rawText: playerWbi.text },
      playerLegacyApi: { ok: playerLegacy.ok, status: playerLegacy.status, code: playerLegacy.body?.code ?? null, rawText: playerLegacy.text }
    };
  }, { requestedBvid }).catch((error) => ({ evaluationError: error instanceof Error ? error.message : String(error) }));

  const screenshotPath = path.join(screenshotRoot, `${String(index + 1).padStart(2, "0")}-${slug(requestedBvid)}.png`);
  fs.mkdirSync(screenshotRoot, { recursive: true });
  await page.screenshot({ path: screenshotPath, fullPage: false }).catch(() => undefined);
  await page.close();

  const viewRaw = pageFacts.viewApi?.rawText || "";
  const playerWbiRaw = pageFacts.playerWbiApi?.rawText || "";
  const playerLegacyRaw = pageFacts.playerLegacyApi?.rawText || "";
  if (pageFacts.viewApi) delete pageFacts.viewApi.rawText;
  if (pageFacts.playerWbiApi) delete pageFacts.playerWbiApi.rawText;
  if (pageFacts.playerLegacyApi) delete pageFacts.playerLegacyApi.rawText;
  const observation = {
    candidate,
    observedAt,
    navigationStatus,
    navigationError,
    responseFacts,
    ...pageFacts,
    viewResponseSha256: sha256(viewRaw),
    playerWbiResponseSha256: sha256(playerWbiRaw),
    playerLegacyResponseSha256: sha256(playerLegacyRaw),
    screenshotPath: path.relative(runRoot, screenshotPath).replaceAll(path.sep, "/"),
    screenshotSha256: fs.existsSync(screenshotPath) ? sha256(fs.readFileSync(screenshotPath)) : null
  };
  observation.observationSha256 = sha256(canonicalJson(observation));
  return observation;
}

async function main() {
  const candidateDocument = JSON.parse(fs.readFileSync(candidatesPath, "utf-8"));
  const allCandidates = candidateDocument.candidates || [];
  const candidates = candidateBvidFilter.size
    ? allCandidates.filter((candidate) => candidateBvidFilter.has(extractBvid(candidate.url)))
    : allCandidates;
  if (!Array.isArray(candidates) || candidates.length < (candidateBvidFilter.size ? 1 : 12)) {
    throw new Error(candidateBvidFilter.size ? "Candidate filter matched no entries" : "At least 12 candidates are required");
  }
  fs.rmSync(runRoot, { recursive: true, force: true });
  fs.mkdirSync(runRoot, { recursive: true, mode: 0o700 });
  const launched = await launchFreshChrome();
  const observations = [];
  try {
    const authorizedCookies = readAuthorizedCookies();
    if (authorizedCookies.length) await launched.context.addCookies(authorizedCookies);
    for (let index = 0; index < candidates.length; index += 1) {
      const candidate = candidates[index];
      process.stdout.write(`[${index + 1}/${candidates.length}] ${candidate.url}\n`);
      observations.push(await probeCandidate(launched.context, candidate, index));
      writeJson(path.join(runRoot, "raw-observations.partial.json"), { runId, observations });
    }
    const capabilitySlotCount = candidates.filter((candidate) => candidate.intendedClass === "asr_capability").length;
    if (!candidateBvidFilter.size && capabilitySlotCount !== 3) {
      throw new Error("Full B3 production probe requires exactly three pre-frozen ASR capability slots");
    }
    const browserVersion = await launched.browser.version();
    const output = {
      schemaVersion: "v3-bilibili-probe-observations/v1",
      runId,
      browser: { name: "Google Chrome", version: browserVersion, profileClass },
      credentialEvidenceClass: cookieSeedPath ? "user_authorized_cookie_seed_private_harness" : "public_anonymous",
      createdAt: new Date().toISOString(),
      observations
    };
    writeJson(path.join(runRoot, "raw-observations.json"), output);
    fs.rmSync(path.join(runRoot, "raw-observations.partial.json"), { force: true });
    process.stdout.write(`${JSON.stringify({ runId, runRoot, observations: observations.length }, null, 2)}\n`);
  } finally {
    await launched.close();
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 2;
});
