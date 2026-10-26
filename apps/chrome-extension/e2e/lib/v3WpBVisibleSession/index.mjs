/**
 * WP-B VH1/VH2/VH4/VH5 — the visible-session orchestration.
 *
 * The order is fixed and every step is OWNED:
 *
 *   1. the preflight (VH6) — before any Chrome or any large asset;
 *   2. the owned Runtime (VH2) — own PID, own roots, own port, own logs;
 *   3. the owned Chrome (VH3) — CDP polled, `Extensions.loadUnpacked`, the
 *      extension, the service worker and the Side Panel target verified;
 *   4. the three cases, each through its own executor (VH4);
 *   5. the cleanup in a `finally` — every owned process, port, profile, asset
 *      and temporary removed, and the residue asserted zero (VH5);
 *   6. the redacted receipt written to the STABLE destination, AFTER the
 *      cleanup, so it survives the owned root's deletion (VH5).
 */

import fs from "node:fs";
import path from "node:path";
import { HarnessError, buildCaseRegistry, buildSessionPlan, assertSessionPlanIsComplete } from "./plan.mjs";
import { buildContext } from "./context.mjs";
import { buildOwnedRuntimePlan, buildOwnedRuntimeEnvironment, startOwnedRuntime } from "./runtime.mjs";
import { establishCompanionSession } from "./runtime.mjs";
import { launchOwnedChrome, loadAndVerifyExtension } from "./chrome.mjs";
import { buildIdentityPlan, buildCookiePlan } from "./driver.mjs";
import {
  createOwnedTempRegistry,
  buildFailureDiagnostic,
  writeStableReceipt
} from "./receipt.mjs";

import { EXECUTOR as B27 } from "./cases/b27.mjs";
import { EXECUTOR as B29 } from "./cases/b29.mjs";
import { EXECUTOR as B30 } from "./cases/b30.mjs";

/** The executor registry of the three frozen visible cases. */
export function buildVisibleRegistry() {
  return buildCaseRegistry({ B27, B29, B30 });
}

/** The plan of the three frozen visible cases. */
export function buildVisiblePlan(registry = buildVisibleRegistry()) {
  const plan = buildSessionPlan(registry);
  assertSessionPlanIsComplete(plan, registry);
  return plan;
}

export async function waitForOwnedDependencies({ runtime, origin, bearer, initial, clock }) {
  let status = initial;
  if (typeof status?.generation === "string" && status.generation) return status;
  const unavailable = (status?.dependencies ?? [])
    .filter((entry) => entry?.state !== "ready")
    .map((entry) => entry?.dependencyId);
  if (unavailable.length !== 1 || unavailable[0] !== "yt-dlp") {
    throw new HarnessError(
      `EXTERNAL-INPUT BLOCK: the owned Runtime cannot establish a verified dependency generation (${unavailable.join(",") || "unknown"}).`
    );
  }
  const headers = {
    Authorization: `Bearer ${bearer}`,
    Origin: origin,
    "Content-Type": "application/json"
  };
  const started = await runtime.request("/v1/media/dependency-installations", {
    method: "POST",
    headers,
    body: JSON.stringify({ dependencyIds: ["yt-dlp"] })
  });
  if (!started?.ok) {
    throw new HarnessError("EXTERNAL-INPUT BLOCK: the product dependency repair could not start.");
  }
  const jobId = (await started.json())?.data?.job?.jobId;
  if (typeof jobId !== "string" || !jobId) {
    throw new HarnessError("EXTERNAL-INPUT BLOCK: the product dependency repair returned no job id.");
  }
  const deadline = (clock?.now ? clock.now() : Date.now()) + 120_000;
  for (;;) {
    const response = await runtime.request(`/v1/media/dependency-installations/${jobId}`, { headers });
    if (!response?.ok) {
      throw new HarnessError("EXTERNAL-INPUT BLOCK: the product dependency repair could not be observed.");
    }
    const job = (await response.json())?.data?.job;
    if (job?.state === "ready") break;
    if (["failed", "cancelled"].includes(job?.state)) {
      throw new HarnessError(
        `EXTERNAL-INPUT BLOCK: the product dependency repair ended in ${job.state}.`
      );
    }
    if ((clock?.now ? clock.now() : Date.now()) >= deadline) {
      throw new HarnessError("EXTERNAL-INPUT BLOCK: the product dependency repair timed out.");
    }
    await (clock?.sleep ? clock.sleep(250) : new Promise((resolve) => setTimeout(resolve, 250)));
  }
  const refreshed = await runtime.request("/v1/media/dependencies", {
    headers: { Authorization: `Bearer ${bearer}`, Origin: origin }
  });
  if (!refreshed?.ok) {
    throw new HarnessError("EXTERNAL-INPUT BLOCK: the repaired dependency snapshot could not be read.");
  }
  status = (await refreshed.json())?.data;
  if (typeof status?.generation !== "string" || !status.generation) {
    throw new HarnessError("EXTERNAL-INPUT BLOCK: dependency repair produced no verified generation.");
  }
  return status;
}

/**
 * Run the one visible session.
 *
 * Every adapter is injected, so the offline tests drive this with recording
 * doubles and never start a process.
 */
export async function runVisibleSession({
  ownedRoot,
  plan,
  registry,
  adapters,
  preflight,
  receiptDestination,
  clock
}) {
  const temp = createOwnedTempRegistry({ ownedRoot });
  const receipts = [];
  const events = [];
  let runtime = null;
  let chrome = null;
  let failure = null;
  let activeCase = null;

  try {
    // 1. Load the extension first because the Runtime origin allow-list needs
    // the exact id assigned by Chrome. No guessed extension id is permitted.
    const chromePlan = {
      browserExecutable: preflight.browserExecutable,
      cdpPort: preflight.cdpPort,
      profileDir: preflight.chromeProfileDir
        ? path.resolve(preflight.chromeProfileDir)
        : temp.registerDirectory(path.join(ownedRoot, "chrome-profile")),
      browserProfileDir: preflight.chromeProfileWindowsPath ?? null,
      extensionRoot: preflight.extensionRoot,
      headless: false,
      dynamicCdp: true,
      environment: adapters.environment ?? {}
    };
    fs.mkdirSync(path.dirname(chromePlan.profileDir), { recursive: true });
    chrome = await launchOwnedChrome({ plan: chromePlan, adapters, clock });
    const extension = await loadAndVerifyExtension({
      browserSession: chrome.browserSession,
      extensionRoot: chromePlan.extensionRoot,
      context: chrome.context,
      clock,
      requireSidePanel: false
    });
    events.push({ type: "chrome-started", detail: { cdpPort: chrome.cdpPort } });

    // 2. Configure the owned Runtime with the exact extension id.
    const runtimePlan = buildOwnedRuntimePlan({
      ownedRoot,
      port: preflight.runtimePort,
      extensionId: extension.extensionId
    });
    runtimePlan.environment = buildOwnedRuntimeEnvironment(runtimePlan, adapters.environment ?? {});
    runtime = await startOwnedRuntime({ plan: runtimePlan, adapters, clock });
    await runtime.waitForHealth(preflight.healthTimeoutMs ?? 30_000);
    events.push({ type: "runtime-started", detail: { port: runtimePlan.port } });

    // 3. Establish a real public session and resolve dependencies from the
    // owned Runtime before generating large assets.
    const origin = `chrome-extension://${extension.extensionId}`;
    const session = await establishCompanionSession({
      runtime,
      origin,
      fetchAdapter: adapters.fetch
    });
    const dependencyResponse = await runtime.request("/v1/media/dependencies", {
      headers: { Authorization: `Bearer ${session.token}`, Origin: origin }
    });
    if (!dependencyResponse?.ok) {
      throw new HarnessError("EXTERNAL-INPUT BLOCK: the owned Runtime dependency snapshot was rejected.");
    }
    const dependencyEnvelope = await dependencyResponse.json();
    const dependencyStatus = await waitForOwnedDependencies({
      runtime,
      origin,
      bearer: session.token,
      initial: dependencyEnvelope?.data,
      clock
    });
    const dependencies = adapters.resolveProductDependencies({
      tools: preflight.tools,
      runtimeStatus: dependencyStatus,
      environment: adapters.environment ?? {},
      preflightSenseVoice: preflight.senseVoice
    });
    let prepared = null;

    // 3b. Every case gets its OWN Bilibili identity, so a successful B29
    // product can never make B30 ineligible and one case's source authority
    // can never block another's.
    const identityPlan = buildIdentityPlan(plan, preflight.targets ?? {});
    const cookiePlan = buildCookiePlan({
      cookieFile: preflight.cookieFile ?? null,
      extensionId: extension.extensionId
    });
    const cookies = preflight.cookies;
    if (!Array.isArray(cookies) || cookies.length === 0) {
      throw new HarnessError(
        "EXTERNAL-INPUT BLOCK: preflight did not provide validated browser cookies."
      );
    }

    // Extensions loaded into a persistent Chrome profile are available only in
    // that profile's default context. Isolation is therefore by owned tab,
    // Side Panel lifecycle, task and source identity, not an incognito context
    // where the extension cannot run.
    await chrome.context.context.addCookies(cookies);

    // Asset generation can take several minutes. Complete it before opening a
    // case so the last-resort card is consumed immediately after it becomes
    // eligible instead of being expected to remain mounted during encoding.
    prepared = await adapters.prepareAssets({ dependencies, temp });

    // 4. The three cases, each through its own executor and its own identity.
    for (const entry of plan) {
      activeCase = entry.case;
      const executor = registry.get(entry.case);
      const caseEvents = [];
      const identity = identityPlan.find((item) => item.case === entry.case && item.kind === "primary");
      const switchIdentity = identityPlan.find(
        (item) => item.case === entry.case && item.kind === "identity-switch"
      );

      const browser = adapters.createCaseBrowser({
        context: chrome.context.context,
        extensionId: extension.extensionId,
        cdpHttpUrl: `http://127.0.0.1:${chrome.cdpPort}`,
        ownedChromeProfileDir: preflight.chromeProfileDir,
        runtime,
        origin,
        bearer: session.token,
        targets: { primary: identity?.target, second: switchIdentity?.target }
      });

      // The REAL user flow: the owned tab, the Side Panel and the visible
      // product controls, until the last-resort card is mounted.
      try {
        await browser.openOwnedBilibiliTab(identity?.target);
        await browser.driveToLastResortCard();

        const context = buildContext({
          plan: entry,
          preflight: {
            ...preflight,
            probeMediaPath: prepared.probeMediaPath,
            asset: prepared.assets?.[entry.case] ?? null,
            identitySwitchTarget: switchIdentity?.target ?? null
          },
          browser,
          runtime,
          fs: temp,
          clock,
          events: caseEvents
        });
        const receipt = await executor.run(context);
        receipts.push(receipt);
        events.push(...caseEvents);
      } finally {
        await browser.closeCase?.();
      }
    }
  } catch (error) {
    failure = error;
  } finally {
    // 4. The cleanup, in an order that leaves nothing owned behind.
    const residue = { chrome: false, runtime: false, assets: false, temporary: false };
    try {
      if (chrome) {
        await chrome.close();
        if (preflight.chromeProfileDir) {
          fs.rmSync(preflight.chromeProfileDir, { recursive: true, force: true });
          if (fs.existsSync(preflight.chromeProfileDir)) {
            throw new HarnessError("The owned Windows Chrome profile remained after cleanup.");
          }
        }
        residue.chrome = true;
      }
    } catch (error) {
      if (!failure) failure = new HarnessError(`Owned Chrome cleanup failed: ${error.message}`);
    }
    try {
      if (runtime) {
        await runtime.stop();
        if (!(await adapters.net.isPortFree(runtime.port))) {
          throw new HarnessError("The owned Runtime port remained occupied after cleanup.");
        }
        residue.runtime = true;
      }
    } catch (error) {
      if (!failure) failure = new HarnessError(`Owned Runtime cleanup failed: ${error.message}`);
    }
    try {
      await temp.cleanup();
      const rootAbsent = !fs.existsSync(ownedRoot);
      residue.temporary = rootAbsent;
      residue.assets = rootAbsent;
      if (!rootAbsent) throw new HarnessError("The owned root remained after cleanup.");
    } catch (error) {
      if (!failure) failure = new HarnessError(`Owned temporary cleanup failed: ${error.message}`);
    }

    // 5. The receipt is written AFTER the cleanup, to the stable destination.
    const receipt = {
      schemaVersion: "v3-wp-b-visible-session-receipt/v1",
      cases: receipts,
      residue,
      failure: failure ? buildFailureDiagnostic({ caseId: activeCase, error: failure }) : null
    };
    try {
      writeStableReceipt({ destination: receiptDestination, receipt });
    } catch (error) {
      if (!failure) failure = error;
    }
  }

  if (failure) throw failure;
  return receipts;
}
