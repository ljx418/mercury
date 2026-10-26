import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  buildExtensionMenuInvocationScript,
  buildOwnedChromeAutomationClickScript,
  buildOwnedChromePointByPidScript,
  calibrateOwnedChromeScreenPoint,
  NATIVE_CONTROL_PROCESS_TIMEOUT_MS,
  NATIVE_CONTROL_WAIT_MS,
  projectOwnedChromeScreenPoint,
} from "./windowsExtensionInvocation.mjs";

test("matches one owned Navia extension menu item with a Chrome status suffix", () => {
  const script = buildExtensionMenuInvocationScript("/tmp/navia-t01-profile-R5B123");

  assert.match(script, /\^Navia/);
  assert.match(script, /targets\.Count -ne 1/);
  assert.match(script, /targeted-extension-menu-native-pointer/);
});

test("builds a PID- and profile-bound UI Automation native pointer click", () => {
  const script = buildOwnedChromeAutomationClickScript(
    "/tmp/navia-t01-profile-R5B123",
    4242,
    "捕获当前标签页",
  );

  assert.match(script, /ProcessId =/);
  assert.match(script, /\$ownedPid=4242/);
  assert.match(script, /navia-t01-profile-R5B123/);
  assert.match(script, /ControlTypeProperty/);
  assert.match(script, /ControlType\]::Button/);
  assert.match(script, /FromHandle\(\$p\.MainWindowHandle\)/);
  assert.doesNotMatch(script, /AutomationElement\]::RootElement/);
  assert.doesNotMatch(script, /ProcessIdProperty/);
  assert.match(script, /GetWindowRect/);
  assert.match(script, /insideOwnedWindow/);
  assert.match(script, /AddMilliseconds\(20000\)/);
  assert.match(script, /matches\.Count -ne 1/);
  assert.match(script, /candidate\.Current\.IsEnabled/);
  assert.match(script, /candidateRect\.Width -gt 1/);
  assert.match(script, /IsOffscreen/);
  assert.match(script, /mouse_event\(2/);
  assert.match(script, /owned-pid-uia-native-pointer/);
});

test("allows the native permission-enabling control", () => {
  const script = buildOwnedChromeAutomationClickScript(
    "/tmp/navia-t01-profile-R5B123",
    4242,
    "启用并分析当前视频",
  );

  assert.match(script, /启用并分析当前视频/);
  assert.match(script, /FromHandle\(\$p\.MainWindowHandle\)/);
});

test("uses the product's exact cancel label", () => {
  assert.doesNotThrow(
    () => buildOwnedChromeAutomationClickScript("/tmp/navia-t01-profile-R5B123", 4242, "取消"),
  );
  assert.throws(
    () => buildOwnedChromeAutomationClickScript("/tmp/navia-t01-profile-R5B123", 4242, "取消采集"),
    /unexpected control/,
  );
});

test("rejects an unowned control name", () => {
  assert.throws(
    () => buildOwnedChromeAutomationClickScript("/tmp/navia-t01-profile-R5B123", 4242, "删除历史"),
    /unexpected control/,
  );
});

test("keeps the PowerShell process alive beyond the UI Automation wait budget", () => {
  assert.equal(NATIVE_CONTROL_WAIT_MS, 20_000);
  assert.ok(NATIVE_CONTROL_PROCESS_TIMEOUT_MS >= NATIVE_CONTROL_WAIT_MS + 5_000);
});

test("rejects a non-owned profile or invalid PID", () => {
  assert.throws(
    () => buildOwnedChromeAutomationClickScript("/tmp/browser-profile", 4242, "捕获当前标签页"),
    /unexpected profile/,
  );
  assert.throws(
    () => buildOwnedChromeAutomationClickScript("/tmp/navia-t01-profile-R5B123", 0, "捕获当前标签页"),
    /invalid process id/,
  );
});

test("calibrates later native points from an exact owned-control observation", () => {
  const calibration = calibrateOwnedChromeScreenPoint(
    { x: 187, y: 225.1875, width: 310, height: 40 },
    "method=owned-pid-uia-native-pointer;name=启用并分析当前视频;automationId=;rect=876,401,310,41",
  );
  assert.deepEqual(calibration, { offsetX: 844, offsetY: 196.3125 });
  assert.deepEqual(
    projectOwnedChromeScreenPoint(calibration, { x: 220, y: 300, width: 200, height: 40 }),
    { x: 1064, y: 496.3125 },
  );
});

test("rejects calibration without matching owned-control geometry", () => {
  assert.throws(
    () => calibrateOwnedChromeScreenPoint(
      { x: 187, y: 225, width: 310, height: 40 },
      "method=owned-pid-uia-native-pointer;rect=876,401,200,41",
    ),
    /mismatched control geometry/,
  );
  assert.throws(
    () => projectOwnedChromeScreenPoint(null, { x: 1, y: 1, width: 10, height: 10 }),
    /valid owned-window calibration/,
  );
});

test("uses one physical-pixel coordinate space for owned-window bounds and pointer", () => {
  const automationScript = buildOwnedChromeAutomationClickScript(
    "/tmp/navia-t01-profile-R5B123",
    4242,
    "启用并分析当前视频",
  );
  const pointScript = buildOwnedChromePointByPidScript(
    "/tmp/navia-t01-profile-R5B123",
    4242,
    1024,
    818,
  );
  for (const script of [automationScript, pointScript]) {
    assert.match(script, /SetProcessDpiAwarenessContext/);
    assert.match(script, /\[IntPtr\]\(-4\)/);
    assert.ok(script.indexOf("SetProcessDpiAwarenessContext") < script.lastIndexOf("GetWindowRect"));
  }
});

test("runner centers and hit-tests a trusted control before native projection", () => {
  const runner = fs.readFileSync(new URL("../v3-acquisition-orchestration-e2e.mjs", import.meta.url), "utf8");
  assert.match(runner, /scrollIntoView\(\{ block: "center", inline: "nearest" \}\)/);
  assert.match(runner, /document\.elementFromPoint\(x, y\)/);
  assert.match(runner, /point\.hitTestId === testId/);
  assert.doesNotMatch(runner, /scroller\.scrollTop = Math\.max/);
});

test("trusted capture action is outside the collapsed diagnostic details", () => {
  const sidePanel = fs.readFileSync(
    new URL("../../entrypoints/sidepanel/main.tsx", import.meta.url),
    "utf8",
  );
  const captureIndex = sidePanel.indexOf("<TrustedTabCaptureCard");
  const detailsCloseBeforeCapture = sidePanel.lastIndexOf("</details>", captureIndex);
  const messagesAfterCapture = sidePanel.indexOf('<div className="messages-frame">', captureIndex);
  assert.ok(captureIndex >= 0);
  assert.equal(sidePanel.indexOf("<TrustedTabCaptureCard", captureIndex + 1), -1);
  assert.ok(detailsCloseBeforeCapture >= 0 && detailsCloseBeforeCapture < captureIndex);
  assert.ok(messagesAfterCapture > captureIndex);
});
