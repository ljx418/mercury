import test from "node:test";
import assert from "node:assert/strict";

import {
  buildExtensionMenuInvocationScript,
  buildExtensionShortcutInvocationScript,
  buildOwnedPidExtensionShortcutInvocationScript,
  buildOwnedChromePointerClickScript,
} from "../../../apps/chrome-extension/e2e/lib/windowsExtensionInvocation.mjs";

test("native action script targets only the owned profile and Navia menu item", () => {
  const script = buildExtensionMenuInvocationScript("/tmp/navia-b5-3-profile-Ab12");
  assert.match(script, /navia-b5-3-profile-Ab12/);
  assert.match(script, /targeted-extension-menu-native-pointer/);
  assert.match(script, /Navia/);
  assert.match(script, /UIAutomationClient/);
});

test("native project command emits Ctrl+Shift+Y", () => {
  const script = buildExtensionShortcutInvocationScript("/tmp/navia-t01-profile-123abc", "project-command");
  assert.match(script, /keybd_event\(0x11/);
  assert.match(script, /keybd_event\(0x10/);
  assert.match(script, /keybd_event\(0x59/);
  assert.match(script, /manifest-open-sidepanel-command-shortcut/);
});

test("native execute action emits Alt+Shift+N", () => {
  const script = buildExtensionShortcutInvocationScript("/tmp/navia-b5-3-profile-123abc", "execute-action");
  assert.match(script, /keybd_event\(0x12/);
  assert.match(script, /keybd_event\(0x10/);
  assert.match(script, /keybd_event\(0x4E/);
  assert.match(script, /manifest-execute-action-shortcut/);
});

test("owned-pid shortcut validates the previously discovered owned Chrome process", () => {
  const script = buildOwnedPidExtensionShortcutInvocationScript(
    "/tmp/navia-b5-3-profile-123abc",
    4242,
    "project-command",
  );
  assert.match(script, /ProcessId = /);
  assert.match(script, /\$ownedPid=4242/);
  assert.match(script, /CommandLine\.Contains\(\$profile\)/);
  assert.match(script, /owned-pid-open-sidepanel-command-shortcut/);
  assert.throws(
    () => buildOwnedPidExtensionShortcutInvocationScript("/tmp/navia-b5-3-profile-123abc", 0),
    /invalid process id/,
  );
});

test("native invocation rejects unowned profiles and unsupported shortcuts", () => {
  assert.throws(() => buildExtensionMenuInvocationScript("/tmp/Default"), /unexpected profile name/);
  assert.throws(
    () => buildExtensionShortcutInvocationScript("/tmp/navia-b5-3-profile-123abc", "other"),
    /Unsupported extension shortcut kind/,
  );
});

test("native scripts never target an unrestricted Chrome process", () => {
  for (const script of [
    buildExtensionMenuInvocationScript("/tmp/navia-b5-3-profile-abc123"),
    buildExtensionShortcutInvocationScript("/tmp/navia-b5-3-profile-abc123", "project-command"),
    buildOwnedPidExtensionShortcutInvocationScript("/tmp/navia-b5-3-profile-abc123", 4242, "project-command"),
  ]) {
    assert.match(script, /CommandLine\.Contains\(\$profile\)/);
    assert.match(script, /(?:-not \$_\.CommandLine\.Contains\('--type='\)|\$pi\.CommandLine\.Contains\('--type='\))/);
  }
});

test("native pointer click is bounded to the owned Chrome window and validated coordinates", () => {
  const script = buildOwnedChromePointerClickScript("/tmp/navia-b5-3-profile-Ab12", 1200, 700);
  assert.match(script, /navia-b5-3-profile-Ab12/);
  assert.match(script, /GetWindowRect/);
  assert.match(script, /\$x -lt \$rect\.Left/);
  assert.match(script, /SetCursorPos\(\$x,\$y\)/);
  assert.throws(
    () => buildOwnedChromePointerClickScript("/tmp/navia-b5-3-profile-Ab12", -1, 20),
    /invalid coordinates/,
  );
});
