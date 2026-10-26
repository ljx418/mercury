import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(new URL("./windows-owned-audio-session-mute.ps1", import.meta.url));
const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function windowsPath(value) {
  const match = /^\/mnt\/([a-z])\/(.*)$/i.exec(path.resolve(value));
  if (!match) throw new Error(`Windows audio isolation requires a Windows-mounted path: ${value}`);
  return `${match[1].toUpperCase()}:\\${match[2].replaceAll("/", "\\")}`;
}

function readStatus(statusPath) {
  try {
    const value = JSON.parse(fs.readFileSync(statusPath, "utf8").replace(/^\uFEFF/, ""));
    return value?.schemaVersion === "navia-owned-chrome-audio-isolation/v1" ? value : null;
  } catch {
    return null;
  }
}

function assertOwnedProfile(profilePath) {
  const profileName = path.basename(profilePath);
  if (!/^navia-t01-profile-[A-Za-z0-9]+$/.test(profileName)) {
    throw new Error(`Refusing audio isolation for unexpected profile: ${profileName}`);
  }
  return profileName;
}

export async function startOwnedChromeAudioIsolation(profilePath, privateRoot, timeoutMs = 20_000) {
  const profileName = assertOwnedProfile(profilePath);
  fs.mkdirSync(privateRoot, { recursive: true, mode: 0o700 });
  const statusPath = path.join(privateRoot, "owned-chrome-audio-isolation.json");
  const stopPath = path.join(privateRoot, "owned-chrome-audio-isolation.stop");
  fs.rmSync(statusPath, { force: true });
  fs.rmSync(stopPath, { force: true });
  const child = spawn("powershell.exe", [
    "-NoProfile",
    "-NonInteractive",
    "-ExecutionPolicy", "Bypass",
    "-File", windowsPath(scriptPath),
    "-ProfileName", profileName,
    "-StatusPath", windowsPath(statusPath),
    "-StopPath", windowsPath(stopPath),
  ], { stdio: ["ignore", "pipe", "pipe"] });
  let diagnostics = "";
  child.stdout.on("data", (chunk) => { diagnostics += chunk; });
  child.stderr.on("data", (chunk) => { diagnostics += chunk; });

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const status = readStatus(statusPath);
    if (status?.watcherReady) {
      let stopped = false;
      return {
        statusPath,
        async waitUntilMuted(waitTimeoutMs = 20_000) {
          const muteDeadline = Date.now() + waitTimeoutMs;
          let consecutive = 0;
          let latest = null;
          while (Date.now() < muteDeadline) {
            latest = readStatus(statusPath);
            const verified = latest?.ownedProcessCount > 0
              && latest?.matchedSessionCount > 0
              && latest?.mutedSessionCount === latest?.matchedSessionCount
              && latest?.allMatchedSessionsMuted === true;
            consecutive = verified ? consecutive + 1 : 0;
            if (consecutive >= 2) return latest;
            if (child.exitCode !== null) break;
            await wait(200);
          }
          throw new Error(`owned Chrome audio session was not verifiably muted: ${JSON.stringify(latest)}`);
        },
        async stop() {
          if (stopped) return;
          stopped = true;
          fs.writeFileSync(stopPath, "stop\n", { mode: 0o600 });
          await Promise.race([
            new Promise((resolve) => child.once("exit", resolve)),
            wait(5_000),
          ]);
          if (child.exitCode === null) child.kill("SIGTERM");
          if (diagnostics) fs.writeFileSync(path.join(privateRoot, "owned-chrome-audio-isolation.log"), diagnostics, { mode: 0o600 });
          fs.rmSync(stopPath, { force: true });
        },
      };
    }
    if (child.exitCode !== null) break;
    await wait(100);
  }
  if (child.exitCode === null) child.kill("SIGTERM");
  throw new Error(`Windows owned-Chrome audio isolation did not start: ${diagnostics.trim()}`);
}

export const __test = { assertOwnedProfile, readStatus, windowsPath };

