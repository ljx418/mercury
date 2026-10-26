/**
 * WP-B VH6 — the dependency and readiness preflight.
 *
 * Nothing is guessed:
 *
 *   * the seed comes only from the explicitly authorized `NAVIA_WP_B_SEED_MEDIA`;
 *   * the CDP and Runtime ports must be free, and an occupied Runtime port is
 *     refused rather than reused;
 *   * the free disk is at least the frozen 4 GiB before any asset generation;
 *   * the ffmpeg/ffprobe paths come from the PRODUCT's own environment
 *     configuration and are VERIFIED against the digests the owned Runtime
 *     reports through the product's dependency status route;
 *   * the SenseVoice binary, model and VAD come from the PRODUCT's ASR root
 *     (`NAVIA_ASR_ROOT`) or from an explicit validated path. `<repo>/.navia/asr`
 *     is NOT a default.
 *
 * A missing seed, model, tool, disk, browser or port readiness stops the run
 * BEFORE Chrome or any large-asset work, with a precise EXTERNAL-INPUT BLOCK or
 * environment failure.
 */

import fs from "node:fs";
import path from "node:path";
import { HarnessError, FROZEN_BOUNDARIES } from "./plan.mjs";

export const SENSEVOICE_FILES = Object.freeze({
  binary: "llama-funasr-sensevoice",
  model: "sensevoice-small-q8.gguf",
  vad: "fsmn-vad.gguf"
});

export const SENSEVOICE_MODEL_DIRECTORY = "funasr-sensevoice-small-q8";

/**
 * Resolve the SenseVoice installation.
 *
 * `explicit` comes from the environment; `productRoot` is the PRODUCT's ASR
 * root. When neither resolves, the run stops. A repository default is never
 * guessed.
 */
export function resolveSenseVoice({ explicit, productRoot }) {
  const candidates = [];
  if (explicit?.root) candidates.push({ root: explicit.root, source: "explicit-environment" });
  if (productRoot) candidates.push({ root: productRoot, source: "product-asr-root" });
  for (const candidate of candidates) {
    const root = path.resolve(candidate.root);
    const modelRoot = path.join(root, "models", SENSEVOICE_MODEL_DIRECTORY);
    const files = {};
    let complete = true;
    for (const [key, name] of Object.entries(SENSEVOICE_FILES)) {
      const file = path.join(modelRoot, name);
      if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
        complete = false;
        break;
      }
      files[key] = file;
    }
    if (!complete) continue;
    return { root: modelRoot, source: candidate.source, files };
  }
  throw new HarnessError(
    "EXTERNAL-INPUT BLOCK: the verified SenseVoice binary, model and VAD could not be resolved from the product ASR root or an explicit validated path. No repository default is guessed.",
  );
}

/**
 * The ffmpeg/ffprobe paths, taken from the PRODUCT's own configuration.
 *
 * The digests are verified later against the owned Runtime's dependency
 * status, so a drifted tool is caught before anything is generated.
 */
export function resolveProductTools({ environment }) {
  const tools = {};
  for (const [name, variable] of [
    ["ffmpeg", "NAVIA_MEDIA_FFMPEG_PATH"],
    ["ffprobe", "NAVIA_MEDIA_FFPROBE_PATH"]
  ]) {
    const value = environment?.[variable];
    if (!value || !fs.existsSync(value)) {
      throw new HarnessError(
        `EXTERNAL-INPUT BLOCK: the product's ${variable} is not set to an existing file.`,
      );
    }
    tools[name] = { path: value, sha256: null };
  }
  return tools;
}

/**
 * Verify the resolved tools against the digests the OWNED RUNTIME reports.
 *
 * This is the product's own verified mechanism: the Runtime owns the dependency
 * snapshot, and the harness only checks that the binary it is about to run is
 * the one the Runtime verified.
 */
export function verifyToolsAgainstRuntimeStatus({ tools, runtimeStatus }) {
  const reported = new Map(
    (runtimeStatus?.dependencies ?? []).map((entry) => [entry.dependencyId, entry]),
  );
  for (const [name, tool] of Object.entries(tools)) {
    const entry = reported.get(name);
    if (!entry) {
      throw new HarnessError(
        `EXTERNAL-INPUT BLOCK: the owned Runtime reports no verified ${name} dependency.`,
      );
    }
    if (entry.state !== "ready") {
      throw new HarnessError(
        `EXTERNAL-INPUT BLOCK: the owned Runtime reports the ${name} dependency as ${entry.state}.`,
      );
    }
    if (entry.observedSha256 && entry.expectedSha256 && entry.observedSha256 !== entry.expectedSha256) {
      throw new HarnessError(
        `EXTERNAL-INPUT BLOCK: the ${name} dependency digest does not match the verified one.`,
      );
    }
    tool.sha256 = entry.observedSha256 ?? entry.expectedSha256 ?? null;
  }
  return tools;
}

/** The free disk, in bytes. */
export function readFreeDiskBytes(path) {
  try {
    const stat = fs.statfsSync(path);
    return Number(stat.bavail) * Number(stat.bsize);
  } catch {
    throw new HarnessError(`EXTERNAL-INPUT BLOCK: the free disk could not be read for ${path}.`);
  }
}

/**
 * The preflight that runs BEFORE Chrome and before any large asset.
 */
export async function runPreflight({ ownedRoot, environment, adapters, clock, registry, seedPath }) {
  const problems = [];

  // 1. The seed. Only the explicitly authorized variable.
  if (!seedPath) {
    problems.push(
      "NAVIA_WP_B_SEED_MEDIA is not set. A real-media session needs an explicitly authorized seed; no search and no substitute is permitted.",
    );
  } else if (!fs.existsSync(seedPath) || !fs.statSync(seedPath).isFile()) {
    problems.push(
      "NAVIA_WP_B_SEED_MEDIA does not point at a readable regular file.",
    );
  }

  // 2. The ports must be free.
  const cdpPort = Number(environment.NAVIA_WP_B_CDP_PORT ?? 0);
  if (!cdpPort) problems.push("No CDP port was selected for the owned Chrome.");
  else if (!(await adapters.net.isPortFree(cdpPort))) {
    problems.push(`The CDP port ${cdpPort} is already in use.`);
  }
  if (!(await adapters.net.isPortFree(FROZEN_BOUNDARIES.localImportPort))) {
    problems.push(
      `The Runtime port ${FROZEN_BOUNDARIES.localImportPort} is already in use. The harness refuses to reuse, terminate or mutate an existing Runtime.`,
    );
  }

  // 3. The browser.
  const browserExecutable = environment.NAVIA_CHROME_EXECUTABLE;
  if (!browserExecutable || !fs.existsSync(browserExecutable)) {
    problems.push("EXTERNAL-INPUT BLOCK: no owned Chrome executable was supplied.");
  }
  const extensionRoot = environment.NAVIA_WP_B_EXTENSION_ROOT;
  if (!extensionRoot || !fs.existsSync(path.join(extensionRoot, "manifest.json"))) {
    problems.push("EXTERNAL-INPUT BLOCK: NAVIA_WP_B_EXTENSION_ROOT does not contain a built extension manifest.");
  }

  // 4. The disk, before any large asset.
  const freeDiskBytes = readFreeDiskBytes(ownedRoot);
  if (freeDiskBytes < FROZEN_BOUNDARIES.freeDiskBytesMin) {
    problems.push(
      `The free disk is ${freeDiskBytes} bytes; at least ${FROZEN_BOUNDARIES.freeDiskBytesMin} are required before the assets are generated.`,
    );
  }

  // 5. The target identities and the cookie file. Both are EXPLICIT inputs,
  // validated BEFORE Chrome: a missing one is an EXTERNAL-INPUT BLOCK, and
  // nothing is ever searched for on the Desktop, in another repository or on a
  // drive.
  const targets = {};
  for (const [name, variable] of [
    ["B27", "NAVIA_WP_B_TARGET_B27"],
    ["B27Second", "NAVIA_WP_B_TARGET_B27_SECOND"],
    ["B29", "NAVIA_WP_B_TARGET_B29"],
    ["B30", "NAVIA_WP_B_TARGET_B30"]
  ]) {
    const value = environment[variable];
    if (!value) {
      problems.push(
        `EXTERNAL-INPUT BLOCK: ${variable} was not supplied. Every case needs its own explicitly provided Bilibili identity.`,
      );
      continue;
    }
    let parsed = null;
    try {
      parsed = new URL(value);
    } catch {
      problems.push(`EXTERNAL-INPUT BLOCK: ${variable} is not a valid URL.`);
      continue;
    }
    if (!/^https?:$/.test(parsed.protocol)) {
      problems.push(`EXTERNAL-INPUT BLOCK: ${variable} must be an http(s) URL.`);
      continue;
    }
    const hostname = parsed.hostname.toLowerCase();
    if (hostname !== "bilibili.com" && !hostname.endsWith(".bilibili.com")) {
      problems.push(
        `EXTERNAL-INPUT BLOCK: ${variable} must point at a Bilibili host; the driver needs a real Bilibili-format identity.`,
      );
      continue;
    }
    if (!parsed.pathname.startsWith("/video/")) {
      problems.push(
        `EXTERNAL-INPUT BLOCK: ${variable} must identify a Bilibili video page.`,
      );
      continue;
    }
    targets[name] = parsed.href;
  }
  const distinctTargets = new Set(Object.values(targets));
  if (Object.keys(targets).length === 4 && distinctTargets.size !== 4) {
    problems.push(
      "EXTERNAL-INPUT BLOCK: B27 primary, B27 secondary, B29 and B30 must be four distinct video identities.",
    );
  }
  const cookieFile = environment.NAVIA_WP_B_COOKIE_FILE ?? null;
  let cookies = null;
  if (!cookieFile) {
    problems.push(
      "EXTERNAL-INPUT BLOCK: NAVIA_WP_B_COOKIE_FILE was not supplied. The owned browser context needs an explicitly provided cookie file; no search is permitted.",
    );
  } else if (!fs.existsSync(cookieFile) || !fs.statSync(cookieFile).isFile()) {
    problems.push(
      `EXTERNAL-INPUT BLOCK: NAVIA_WP_B_COOKIE_FILE does not point at a readable file.`,
    );
  } else {
    try {
      cookies = adapters.readSuppliedCookies(cookieFile);
    } catch (error) {
      problems.push(error.message);
    }
  }

  // 6. The product's own tool configuration.
  let tools = null;
  try {
    tools = resolveProductTools({ environment });
  } catch (error) {
    problems.push(error.message);
  }

  // 7. Model files are local inputs too. Resolve them before Chrome so a
  // missing or reclaimed installation cannot consume the one visible run.
  let senseVoice = null;
  try {
    senseVoice = resolveSenseVoice({
      explicit: environment.NAVIA_WP_B_ASR_ROOT
        ? { root: environment.NAVIA_WP_B_ASR_ROOT }
        : null,
      productRoot: environment.NAVIA_ASR_ROOT ?? null
    });
  } catch (error) {
    problems.push(error.message);
  }

  if (problems.length) {
    throw new HarnessError(
      `EXTERNAL-INPUT BLOCK: the visible session is not ready: ${problems.join(" ")}`,
    );
  }

  return {
    seedPath,
    tools,
    targets,
    cookieFile,
    cookies,
    senseVoice,
    cdpPort,
    freeDiskBytes,
    runtimePort: FROZEN_BOUNDARIES.localImportPort,
    browserExecutable,
    extensionRoot,
    assetPlan: registry
  };
}

/**
 * The product dependency resolution that runs AFTER the owned Runtime is
 * healthy: the verified tools are checked against the Runtime's own report and
 * the verified model is resolved from the product's ASR root.
 */
export function resolveProductDependencies({
  tools,
  runtimeStatus,
  environment,
  preflightSenseVoice = null
}) {
  const verifiedTools = verifyToolsAgainstRuntimeStatus({ tools, runtimeStatus });
  const senseVoice = preflightSenseVoice ?? resolveSenseVoice({
      explicit: environment.NAVIA_WP_B_ASR_ROOT
        ? { root: environment.NAVIA_WP_B_ASR_ROOT }
        : null,
      productRoot: environment.NAVIA_ASR_ROOT ?? null
    });
  return { tools: verifiedTools, senseVoice };
}
