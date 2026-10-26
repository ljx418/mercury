#!/usr/bin/env node
/**
 * WP-B — the ONE owned visible session for B27, B29 and B30.
 *
 * The session is DETERMINISTIC and OWNED:
 *
 *   * it starts its OWN local Runtime with its own PID, private data, config,
 *     log and media roots, and it REFUSES to reuse, terminate or mutate an
 *     existing Runtime;
 *   * it launches its OWN muted Chrome with its own profile, PID and debugging
 *     port, and it never touches the user's Chrome or profile;
 *   * it loads the PRODUCTION extension through the browser-level
 *     `Extensions.loadUnpacked` command, because Chrome 137+ ignores the
 *     command-line load path;
 *   * it drives the REAL Side Panel file input and the PUBLIC Runtime routes.
 *     No manager, controller, store, database, coordinator or materializer is
 *     called directly;
 *   * it removes every owned artifact in a `finally` and writes the redacted
 *     receipt to a STABLE destination AFTER the cleanup, so the receipt
 *     survives the owned root's deletion.
 *
 * The OFFLINE phase may not run it. Without BOTH
 * `NAVIA_WP_B_SESSION_PHASE=visible-run` and `NAVIA_WP_B_VISIBLE_APPROVED=1`
 * it refuses before it touches anything, so an accidental invocation can never
 * open a visible window or generate a gigabyte.
 *
 * The later, approved run:
 *
 *   NAVIA_WP_B_SESSION_PHASE=visible-run \
 *   NAVIA_WP_B_VISIBLE_APPROVED=1 \
 *   NAVIA_WP_B_SEED_MEDIA=<absolute path to the authorized seed> \
 *   NAVIA_WP_B_EVIDENCE_ROOT=<stable evidence destination> \
 *   NAVIA_CHROME_EXECUTABLE="<absolute path to Chrome>" \
 *   node e2e/v3-wp-b-local-import-owned-session.mjs
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { HarnessError } from "./lib/v3WpBVisibleSession/plan.mjs";
import { buildVisiblePlan, buildVisibleRegistry, runVisibleSession } from "./lib/v3WpBVisibleSession/index.mjs";
import { runPreflight, resolveProductDependencies } from "./lib/v3WpBVisibleSession/preflight.mjs";
import { buildFailureDiagnostic, createOwnedTempRegistry, resolveStableEvidenceDestination, writeStableReceipt } from "./lib/v3WpBVisibleSession/receipt.mjs";
import { generateRegistryAsset, validateAuthorizedSeed } from "./lib/v3WpBVisibleSession/assets.mjs";
import { prepareOwnedVisionProviderMetadata } from "./lib/v3WpBVisibleSession/visionProvider.mjs";
import {
  createBrowserContextAdapter,
  createCaseBrowserAdapter,
  createChromeAdapter,
  createFetchAdapter,
  createNetAdapter,
  createProcessAdapter,
  readSuppliedCookies,
  toWindowsPath
} from "./lib/v3WpBVisibleSession/realAdapters.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(here, "../../..");

function readEnv(name, fallback = "") {
  return process.env[name] ?? fallback;
}

/**
 * The offline phase.
 *
 * It prepares and proves the plan, launches nothing and generates nothing, and
 * it removes its own owned root.
 */
async function runOffline() {
  const ownedRoot = fs.mkdtempSync(path.join(os.tmpdir(), "navia-wp-b-session-"));
  const registry = buildVisibleRegistry();
  const plan = buildVisiblePlan(registry);
  const receipt = {
    schemaVersion: "v3-wp-b-visible-session-offline/v1",
    phase: "offline",
    launched: false,
    generatedAssets: 0,
    cases: plan.map((entry) => ({
      case: entry.case,
      executorId: entry.executorId,
      requiredInputs: entry.requiredInputs.length,
      requiredReceiptFields: entry.requiredReceiptFields.length
    }))
  };
  fs.rmSync(ownedRoot, { recursive: true, force: true });
  process.stdout.write(`${JSON.stringify(receipt)}\n`);
  return 0;
}

async function runVisible() {
  const { chromium } = await import("playwright");
  // Runtime sandboxes require real Unix 0700/0600 semantics, so they stay on
  // the WSL filesystem. Files selected by Windows Chrome live separately on
  // the project's Windows-backed owned path.
  const ownedRoot = fs.mkdtempSync(path.join(os.tmpdir(), "navia-wp-b-session-"));
  const visibleOwnedParent = path.join(repositoryRoot, ".navia/wp-b/visible-owned");
  fs.mkdirSync(visibleOwnedParent, { recursive: true });
  const assetRoot = fs.mkdtempSync(path.join(visibleOwnedParent, "assets-"));
  const chromeProfileDir = fs.mkdtempSync(path.join(visibleOwnedParent, "chrome-profile-"));
  const temp = createOwnedTempRegistry({ ownedRoot: assetRoot });
  const receiptDestination = resolveStableEvidenceDestination({
    configured: readEnv("NAVIA_WP_B_EVIDENCE_ROOT"),
    ownedRoot
  });
  const environment = { ...process.env };
  // The product defines managed tools as Windows-persistent. Keep its verified
  // publication outside the disposable Runtime database while still under the
  // repository's explicitly owned development root.
  environment.NAVIA_MEDIA_TOOL_ROOT ||= path.join(repositoryRoot, ".navia/managed-tools");
  environment.NAVIA_WP_B_EXTENSION_ROOT ||= path.join(
    repositoryRoot,
    "apps/chrome-extension/chrome-mv3-unpacked"
  );
  const visionProvider = prepareOwnedVisionProviderMetadata({
    sourceDb: readEnv("NAVIA_WP_B_VISION_PROVIDER_DB", path.join(repositoryRoot, ".navia/navia.sqlite3")),
    ownedRoot
  });
  environment.NAVIA_VISION_PROVIDER_DB_PATH = visionProvider.dbPath;
  const seedPath = readEnv("NAVIA_WP_B_SEED_MEDIA") || null;
  const cookieFile = readEnv("NAVIA_WP_B_COOKIE_FILE") || null;
  const caseRegistry = buildVisibleRegistry();
  const plan = buildVisiblePlan(caseRegistry);
  const assetRegistry = JSON.parse(
    fs.readFileSync(
      path.join(
        repositoryRoot,
        "docs/active/project/fixtures/v3-media-local-import-acceptance-assets-v1.json"
      ),
      "utf8"
    )
  );

  const adapters = {
    process: createProcessAdapter({ repositoryRoot }),
    net: createNetAdapter(),
    fetch: createFetchAdapter(),
    browser: createChromeAdapter({ chromium }),
    context: createBrowserContextAdapter(),
    environment,
    resolveProductDependencies,
    createCaseBrowser({ context, extensionId, cdpHttpUrl, ownedChromeProfileDir, runtime, origin, bearer }) {
      return createCaseBrowserAdapter({
        context,
        extensionId,
        cdpHttpUrl,
        ownedChromeProfileDir,
        runtime,
        runtimeBaseUrl: runtime.baseUrl,
        origin,
        bearer
      });
    },
    readSuppliedCookies(cookieFile) {
      return readSuppliedCookies(cookieFile);
    },
    async prepareAssets({ dependencies }) {
      validateAuthorizedSeed({
        seedPath,
        requirements: assetRegistry.privateSeed.requirements,
        tools: dependencies.tools,
        senseVoice: dependencies.senseVoice,
        temp
      });
      const generatedById = new Map();
      for (const asset of assetRegistry.assets ?? []) {
        generatedById.set(asset.id, generateRegistryAsset({
          asset,
          seedPath,
          tools: dependencies.tools,
          temp,
          generator: assetRegistry.generator,
          senseVoice: dependencies.senseVoice,
          requirements: assetRegistry.privateSeed.requirements
        }));
      }
      return {
        // B27 must switch identity while a real upload is still in flight.
        // Reuse the registered 1 GB asset so loopback upload speed cannot turn
        // the interruption case into a race against a small seed file.
        probeMediaPath: generatedById.get("wp-b-real-1gb")?.path ?? seedPath,
        assets: {
          B29: generatedById.get("wp-b-real-100mb"),
          B30: generatedById.get("wp-b-real-1gb")
        }
      };
    }
  };
  try {
    const preflight = await runPreflight({
      ownedRoot: assetRoot,
      environment,
      adapters,
      clock: undefined,
      registry: assetRegistry,
      seedPath
    });
    preflight.extensionRoot = toWindowsPath(preflight.extensionRoot);
    preflight.chromeProfileDir = chromeProfileDir;
    preflight.chromeProfileWindowsPath = toWindowsPath(chromeProfileDir);
    return await runVisibleSession({
      ownedRoot,
      plan,
      registry: caseRegistry,
      adapters,
      receiptDestination,
      preflight
    });
  } catch (error) {
    const receiptFile = path.join(receiptDestination, "visible-session-receipt.json");
    if (!fs.existsSync(receiptFile)) {
      fs.rmSync(ownedRoot, { recursive: true, force: true });
      writeStableReceipt({
        destination: receiptDestination,
        receipt: buildFailureDiagnostic({
          error,
          ownedResidue: { ownedRoot: fs.existsSync(ownedRoot) }
        })
      });
    }
    throw error;
  } finally {
    await temp.cleanup();
    fs.rmSync(ownedRoot, { recursive: true, force: true });
    fs.rmSync(assetRoot, { recursive: true, force: true });
    fs.rmSync(chromeProfileDir, { recursive: true, force: true });
  }
}

async function main() {
  const phase = readEnv("NAVIA_WP_B_SESSION_PHASE", "offline");
  const approved = readEnv("NAVIA_WP_B_VISIBLE_APPROVED") === "1";

  if (phase !== "visible-run") {
    return runOffline();
  }
  if (!approved) {
    throw new HarnessError(
      "A visible session needs NAVIA_WP_B_VISIBLE_APPROVED=1. Nothing was launched."
    );
  }
  await runVisible();
  return 0;
}

main().then(
  (code) => process.exit(code),
  (error) => {
    process.stderr.write(`${error?.stack ?? error}\n`);
    process.exit(1);
  }
);
