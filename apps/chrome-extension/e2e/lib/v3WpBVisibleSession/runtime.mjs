/**
 * WP-B VH2 — the OWNED production Runtime.
 *
 * The harness starts its own local Runtime with its OWN PID, its OWN private
 * data, config, log and media roots and its OWN port. It never reuses, never
 * terminates and never mutates an existing Runtime: if the port is occupied the
 * harness refuses to start.
 *
 * The implementation is ADAPTER-INJECTED so the offline tests can prove the
 * ownership, the occupied-port refusal, the readiness timeout and the
 * process-tree cleanup without starting a Runtime.
 */

import fs from "node:fs";
import path from "node:path";
import { HarnessError } from "./plan.mjs";

export const RUNTIME_ROUTES = Object.freeze({
  health: "/v1/health",
  companionStatus: "/v1/companion/status",
  companionSessions: "/v1/companion/sessions"
});

/**
 * The owned Runtime's private layout. Everything lives under the owned root.
 */
export function buildOwnedRuntimePlan({ ownedRoot, port, extensionId }) {
  if (!ownedRoot) throw new HarnessError("The owned Runtime needs the owned root.");
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new HarnessError(`The owned Runtime port ${port} is not a usable port.`);
  }
  const privateRoot = path.join(ownedRoot, "runtime");
  return {
    ownedRoot,
    privateRoot,
    configPath: path.join(privateRoot, "companion.json"),
    dbPath: path.join(privateRoot, "navia.sqlite3"),
    mediaRoot: path.join(privateRoot, "media-tasks"),
    asrRoot: path.join(privateRoot, "asr-tasks"),
    logsRoot: path.join(privateRoot, "logs"),
    port,
    extensionId: extensionId ?? null,
    baseUrl: `http://127.0.0.1:${port}`
  };
}

/**
 * The private environment the owned Runtime gets. It never inherits the
 * user's Runtime roots.
 */
export function buildOwnedRuntimeEnvironment(plan, baseEnvironment) {
  return {
    ...baseEnvironment,
    NAVIA_DB_PATH: plan.dbPath,
    NAVIA_MEDIA_TASK_ROOT: plan.mediaRoot,
    NAVIA_MEDIA_ASR_TASK_ROOT: plan.asrRoot,
    // This owned acceptance Runtime is the only process allowed to expose the
    // read-only numeric observation route. Default/product launches omit it.
    NAVIA_E2E_LOCAL_IMPORT_OBSERVATIONS: "1"
  };
}

/**
 * Start the owned Runtime.
 *
 * `adapters.process` is `{ spawn, run }`, `adapters.net` is `{ isPortFree }` and
 * `adapters.fetch` is the fetch used for the health poll.
 */
export async function startOwnedRuntime({ plan, adapters, clock }) {
  const { process: processAdapter, net: netAdapter, fetch: fetchAdapter } = adapters;

  // 1. The port must be FREE. An occupied port means somebody else's Runtime is
  //    there, and the harness refuses rather than reusing or killing it.
  const occupied = !(await netAdapter.isPortFree(plan.port));
  if (occupied) {
    throw new HarnessError(
      `EXTERNAL-INPUT BLOCK: the Runtime port ${plan.port} is already in use. The harness refuses to reuse, terminate or mutate an existing Runtime.`,
    );
  }

  fs.mkdirSync(plan.privateRoot, { recursive: true, mode: 0o700 });
  fs.mkdirSync(plan.logsRoot, { recursive: true, mode: 0o700 });

  // 2. The configuration step writes the extension id and the owned port.
  if (plan.extensionId) {
    const configured = processAdapter.run([
      "-m",
      "navia_runtime.companion",
      "--config",
      plan.configPath,
      "--install-extension-id",
      plan.extensionId,
      "--port",
      String(plan.port)
    ]);
    if (configured.status !== 0) {
      throw new HarnessError(
        `EXTERNAL-INPUT BLOCK: the companion Runtime could not be configured: ${configured.stderr || configured.stdout}`,
      );
    }
  }

  // 3. The Runtime process, with the private roots.
  const child = processAdapter.spawnRuntime(
    ["-m", "navia_runtime.companion", "--config", plan.configPath],
    { env: plan.environment }
  );

  const runtime = {
    pid: child.pid,
    port: plan.port,
    baseUrl: plan.baseUrl,
    requests: [],
    child,
    measureRss() {
      return processAdapter.readRuntimeRss?.(child) ?? null;
    },
    async waitForHealth(timeoutMs = 30_000) {
      const started = clock?.now ? clock.now() : Date.now();
      const deadline = started + timeoutMs;
      for (;;) {
        if (child.exited) {
          throw new HarnessError("The owned Runtime exited before it became healthy.");
        }
        try {
          const response = await fetchAdapter(`${plan.baseUrl}${RUNTIME_ROUTES.health}`);
          if (response && response.ok) return true;
        } catch {
          // The Runtime is not listening yet.
        }
        if ((clock?.now ? clock.now() : Date.now()) >= deadline) {
          throw new HarnessError(
            `EXTERNAL-INPUT BLOCK: the owned Runtime did not become healthy within ${timeoutMs} ms.`,
          );
        }
        await (clock?.sleep ? clock.sleep(200) : new Promise((resolve) => setTimeout(resolve, 200)));
      }
    },
    async request(routePath, options = {}) {
      const response = await fetchAdapter(`${plan.baseUrl}${routePath}`, options);
      const record = {
        method: options.method ?? "GET",
        path: routePath,
        status: response?.status ?? 0
      };
      runtime.requests.push(record);
      return response;
    },
    async stop() {
      await processAdapter.terminateRuntimeTree(child);
      return true;
    }
  };
  return runtime;
}

/**
 * Establish the REAL companion session through the PRODUCTION session route.
 *
 * The bearer is returned to the caller and is never logged, printed or
 * persisted by the harness.
 */
export async function establishCompanionSession({ runtime, origin, fetchAdapter }) {
  const response = await fetchAdapter(`${runtime.baseUrl}${RUNTIME_ROUTES.companionSessions}`, {
    method: "POST",
    headers: { Origin: origin }
  });
  if (!response || !response.ok) {
    throw new HarnessError(
      `EXTERNAL-INPUT BLOCK: the companion session could not be established (status ${response?.status ?? 0}).`,
    );
  }
  const payload = await response.json();
  const token = payload?.data?.token;
  if (typeof token !== "string" || !token) {
    throw new HarnessError("EXTERNAL-INPUT BLOCK: the companion session returned no token.");
  }
  runtime.requests.push({
    method: "POST",
    path: RUNTIME_ROUTES.companionSessions,
    status: response.status
  });
  return { token, sessionId: payload?.data?.sessionId ?? null };
}

/**
 * Prove that every local-import request was addressed to the OWNED Runtime.
 */
export function assertRequestsReachedOwnedRuntime(runtime, prefixes) {
  const wrong = runtime.requests.filter(
    (entry) => prefixes.some((prefix) => entry.path.startsWith(prefix)) && !entry.path.startsWith("/"),
  );
  if (wrong.length) {
    throw new HarnessError("A local-import request was not addressed to the owned Runtime.");
  }
  const addressed = runtime.requests.filter((entry) =>
    prefixes.some((prefix) => entry.path.startsWith(prefix)),
  );
  if (!addressed.length) {
    throw new HarnessError("No local-import request reached the owned Runtime at all.");
  }
  return addressed.length;
}
