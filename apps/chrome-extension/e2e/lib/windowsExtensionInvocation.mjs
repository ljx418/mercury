import path from "node:path";
import { spawnSync } from "node:child_process";

const PROFILE_NAME = /^navia-(?:t01|b5-3)-profile-[A-Za-z0-9]+$/;
const TRUSTED_CAPTURE_CONTROL_NAMES = new Set([
  "启用并分析当前视频",
  "捕获当前标签页",
  "完成并转写",
  "取消",
]);
export const NATIVE_CONTROL_WAIT_MS = 20_000;
export const NATIVE_CONTROL_PROCESS_TIMEOUT_MS = 30_000;

function finitePoint(point, label) {
  const x = Number(point?.x);
  const y = Number(point?.y);
  const width = Number(point?.width);
  const height = Number(point?.height);
  if (![x, y, width, height].every(Number.isFinite) || width <= 1 || height <= 1) {
    throw new Error(`Refusing invalid ${label} geometry`);
  }
  return { x, y, width, height };
}

export function calibrateOwnedChromeScreenPoint(localPoint, nativeClickDiagnostic) {
  const local = finitePoint(localPoint, "calibration control");
  const match = /(?:^|;)rect=(-?\d+),(-?\d+),(\d+),(\d+)(?:;|$)/.exec(String(nativeClickDiagnostic));
  if (!match) throw new Error("Refusing screen calibration without a native owned-control rectangle");
  const native = { left: Number(match[1]), top: Number(match[2]), width: Number(match[3]), height: Number(match[4]) };
  if (native.width <= 1 || native.height <= 1
    || Math.abs(native.width - local.width) > 3 || Math.abs(native.height - local.height) > 3) {
    throw new Error("Refusing screen calibration with mismatched control geometry");
  }
  return {
    offsetX: native.left + native.width / 2 - local.x,
    offsetY: native.top + native.height / 2 - local.y,
  };
}

export function projectOwnedChromeScreenPoint(calibration, localPoint) {
  const local = finitePoint(localPoint, "target control");
  const offsetX = Number(calibration?.offsetX);
  const offsetY = Number(calibration?.offsetY);
  if (!Number.isFinite(offsetX) || !Number.isFinite(offsetY)) {
    throw new Error("Refusing native pointer projection without a valid owned-window calibration");
  }
  return { x: local.x + offsetX, y: local.y + offsetY };
}

function profileName(profilePath) {
  const value = path.basename(profilePath);
  if (!PROFILE_NAME.test(value)) {
    throw new Error(`Refusing native invocation for unexpected profile name: ${value}`);
  }
  return value;
}

export function buildExtensionMenuInvocationScript(profilePath) {
  const profile = profileName(profilePath);
  return [
    "$OutputEncoding=[Console]::OutputEncoding=[System.Text.UTF8Encoding]::new()",
    "Add-Type -AssemblyName UIAutomationClient",
    "Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public static class NaviaActionClick { [DllImport(\"user32.dll\")] public static extern bool ShowWindowAsync(IntPtr h,int n); [DllImport(\"user32.dll\")] public static extern bool SetCursorPos(int x,int y); [DllImport(\"user32.dll\")] public static extern void mouse_event(uint f,uint x,uint y,uint d,UIntPtr e); }'",
    `$profile='${profile}'`,
    "$pi=Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'chrome.exe' -and $_.CommandLine -and $_.CommandLine.Contains($profile) -and -not $_.CommandLine.Contains('--type=') } | Select-Object -First 1",
    "if(-not $pi){exit 2}",
    "$shell=New-Object -ComObject WScript.Shell",
    "$p=Get-Process -Id $pi.ProcessId; $null=[NaviaActionClick]::ShowWindowAsync($p.MainWindowHandle,9); if(-not $shell.AppActivate($p.MainWindowTitle) -and -not $shell.AppActivate([int]$pi.ProcessId)){exit 3}",
    "Start-Sleep -Milliseconds 400",
    "$root=[System.Windows.Automation.AutomationElement]::FromHandle($p.MainWindowHandle)",
    "$buttons=$root.FindAll([System.Windows.Automation.TreeScope]::Descendants,[System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::ControlTypeProperty,[System.Windows.Automation.ControlType]::Button))",
    "$extensions=$null; foreach($button in $buttons){$name=$button.Current.Name; if(-not $extensions -and ($name -match '扩展程序.*菜单' -or $name -match '已允许在此网站上使用扩展程序' -or $name -match '选择即可打开菜单' -or $name -match '^Extensions')){$extensions=$button}}",
    "if(-not $extensions){exit 4}",
    "$r=$extensions.Current.BoundingRectangle; $null=[NaviaActionClick]::SetCursorPos([int]($r.Left+$r.Width/2),[int]($r.Top+$r.Height/2)); [NaviaActionClick]::mouse_event(2,0,0,0,[UIntPtr]::Zero); Start-Sleep -Milliseconds 80; [NaviaActionClick]::mouse_event(4,0,0,0,[UIntPtr]::Zero); Start-Sleep -Milliseconds 400",
    "$desktop=[System.Windows.Automation.AutomationElement]::RootElement; $items=$desktop.FindAll([System.Windows.Automation.TreeScope]::Descendants,[System.Windows.Automation.Condition]::TrueCondition); $targets=@(); foreach($item in $items){$name=$item.Current.Name; $type=$item.Current.ControlType.ProgrammaticName; if(($type -eq 'ControlType.MenuItem' -or $type -eq 'ControlType.Button') -and ($name -eq 'Open Navia' -or $name -match '^Navia(?:\\s|$)')){$targets += $item}}; if($targets.Count -ne 1){Write-Output ('targetCount=' + $targets.Count); Write-Output ('candidateNames=' + (($targets | ForEach-Object {$_.Current.Name}) -join '|')); exit 5}; $target=$targets[0]",
    "if(-not $target){exit 5}",
    "$targetRect=$target.Current.BoundingRectangle; if($targetRect.Width -le 0 -or $targetRect.Height -le 0){exit 6}; $null=[NaviaActionClick]::SetCursorPos([int]($targetRect.Left+$targetRect.Width/2),[int]($targetRect.Top+$targetRect.Height/2)); [NaviaActionClick]::mouse_event(2,0,0,0,[UIntPtr]::Zero); Start-Sleep -Milliseconds 100; [NaviaActionClick]::mouse_event(4,0,0,0,[UIntPtr]::Zero)",
    "Write-Output 'method=targeted-extension-menu-native-pointer'",
    "Write-Output ('targetName=' + $target.Current.Name)",
    "Write-Output ('targetType=' + $target.Current.ControlType.ProgrammaticName)",
    "Write-Output ('targetAutomationId=' + $target.Current.AutomationId)",
    "Start-Sleep -Milliseconds 300",
  ].join("; ");
}

export function buildExtensionShortcutInvocationScript(profilePath, shortcutKind = "project-command") {
  if (!new Set(["project-command", "execute-action"]).has(shortcutKind)) {
    throw new Error(`Unsupported extension shortcut kind: ${shortcutKind}`);
  }
  const profile = profileName(profilePath);
  const virtualKey = shortcutKind === "project-command" ? "0x59" : "0x4E";
  const modifierKey = shortcutKind === "project-command" ? "0x11" : "0x12";
  return [
    "$OutputEncoding=[Console]::OutputEncoding=[System.Text.UTF8Encoding]::new()",
    "Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public static class NaviaShortcut { [DllImport(\"user32.dll\")] public static extern bool ShowWindowAsync(IntPtr h,int n); [DllImport(\"user32.dll\")] public static extern bool SetForegroundWindow(IntPtr h); [DllImport(\"user32.dll\")] public static extern void keybd_event(byte v,byte s,uint f,UIntPtr e); }'",
    `$profile='${profile}'`,
    "$pi=Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'chrome.exe' -and $_.CommandLine -and $_.CommandLine.Contains($profile) -and -not $_.CommandLine.Contains('--type=') } | Select-Object -First 1",
    "if(-not $pi){exit 2}",
    "$p=Get-Process -Id $pi.ProcessId -ErrorAction Stop",
    "$shell=New-Object -ComObject WScript.Shell; $null=[NaviaShortcut]::ShowWindowAsync($p.MainWindowHandle,9)",
    "$activated=$false; if($p.MainWindowTitle){$activated=$shell.AppActivate($p.MainWindowTitle)}; if(-not $activated){$activated=$shell.AppActivate([int]$pi.ProcessId)}; if(-not $activated){$activated=[NaviaShortcut]::SetForegroundWindow($p.MainWindowHandle)}; if(-not $activated){exit 3}",
    "Start-Sleep -Milliseconds 350",
    `[NaviaShortcut]::keybd_event(${modifierKey},0,0,[UIntPtr]::Zero)`,
    "[NaviaShortcut]::keybd_event(0x10,0,0,[UIntPtr]::Zero)",
    `[NaviaShortcut]::keybd_event(${virtualKey},0,0,[UIntPtr]::Zero)`,
    "Start-Sleep -Milliseconds 100",
    `[NaviaShortcut]::keybd_event(${virtualKey},0,2,[UIntPtr]::Zero)`,
    "[NaviaShortcut]::keybd_event(0x10,0,2,[UIntPtr]::Zero)",
    `[NaviaShortcut]::keybd_event(${modifierKey},0,2,[UIntPtr]::Zero)`,
    `Write-Output 'method=${shortcutKind === "project-command" ? "manifest-open-sidepanel-command-shortcut" : "manifest-execute-action-shortcut"}'`,
    "Start-Sleep -Milliseconds 300",
  ].join("; ");
}

export function buildOwnedPidExtensionShortcutInvocationScript(profilePath, processId, shortcutKind = "project-command") {
  if (!new Set(["project-command", "execute-action"]).has(shortcutKind)) {
    throw new Error(`Unsupported extension shortcut kind: ${shortcutKind}`);
  }
  const profile = profileName(profilePath);
  const ownedPid = Number(processId);
  if (!Number.isInteger(ownedPid) || ownedPid <= 0) {
    throw new Error(`Refusing native invocation for invalid process id: ${processId}`);
  }
  const virtualKey = shortcutKind === "project-command" ? "0x59" : "0x4E";
  const modifierKey = shortcutKind === "project-command" ? "0x11" : "0x12";
  return [
    "$OutputEncoding=[Console]::OutputEncoding=[System.Text.UTF8Encoding]::new()",
    "Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public static class NaviaOwnedShortcut { [DllImport(\"user32.dll\")] public static extern bool ShowWindowAsync(IntPtr h,int n); [DllImport(\"user32.dll\")] public static extern bool SetForegroundWindow(IntPtr h); [DllImport(\"user32.dll\")] public static extern void keybd_event(byte v,byte s,uint f,UIntPtr e); }'",
    `$profile='${profile}'`,
    `$ownedPid=${ownedPid}`,
    "$pi=Get-CimInstance Win32_Process -Filter (\"ProcessId = \" + $ownedPid)",
    "if(-not $pi -or $pi.Name -ne 'chrome.exe' -or -not $pi.CommandLine -or -not $pi.CommandLine.Contains($profile) -or $pi.CommandLine.Contains('--type=')){exit 2}",
    "$p=Get-Process -Id $ownedPid -ErrorAction Stop",
    "$shell=New-Object -ComObject WScript.Shell; $null=[NaviaOwnedShortcut]::ShowWindowAsync($p.MainWindowHandle,9)",
    "$activated=$false; if($p.MainWindowTitle){$activated=$shell.AppActivate($p.MainWindowTitle)}; if(-not $activated){$activated=$shell.AppActivate([int]$ownedPid)}; if(-not $activated){$activated=[NaviaOwnedShortcut]::SetForegroundWindow($p.MainWindowHandle)}; if(-not $activated){exit 3}",
    "Start-Sleep -Milliseconds 120",
    `[NaviaOwnedShortcut]::keybd_event(${modifierKey},0,0,[UIntPtr]::Zero)`,
    "[NaviaOwnedShortcut]::keybd_event(0x10,0,0,[UIntPtr]::Zero)",
    `[NaviaOwnedShortcut]::keybd_event(${virtualKey},0,0,[UIntPtr]::Zero)`,
    "Start-Sleep -Milliseconds 80",
    `[NaviaOwnedShortcut]::keybd_event(${virtualKey},0,2,[UIntPtr]::Zero)`,
    "[NaviaOwnedShortcut]::keybd_event(0x10,0,2,[UIntPtr]::Zero)",
    `[NaviaOwnedShortcut]::keybd_event(${modifierKey},0,2,[UIntPtr]::Zero)`,
    `Write-Output 'method=${shortcutKind === "project-command" ? "owned-pid-open-sidepanel-command-shortcut" : "owned-pid-execute-action-shortcut"}'`,
    "Start-Sleep -Milliseconds 120",
  ].join("; ");
}

export function buildOwnedChromePointerClickScript(profilePath, screenX, screenY) {
  const profile = profileName(profilePath);
  const x = Number(screenX);
  const y = Number(screenY);
  if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0) {
    throw new Error(`Refusing native pointer click at invalid coordinates: ${screenX},${screenY}`);
  }
  return [
    "$OutputEncoding=[Console]::OutputEncoding=[System.Text.UTF8Encoding]::new()",
    "Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public static class NaviaOwnedClick { [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left; public int Top; public int Right; public int Bottom; } [DllImport(\"user32.dll\")] public static extern bool ShowWindowAsync(IntPtr h,int n); [DllImport(\"user32.dll\")] public static extern bool SetForegroundWindow(IntPtr h); [DllImport(\"user32.dll\")] public static extern bool GetWindowRect(IntPtr h,out RECT r); [DllImport(\"user32.dll\")] public static extern bool SetCursorPos(int x,int y); [DllImport(\"user32.dll\")] public static extern void mouse_event(uint f,uint x,uint y,uint d,UIntPtr e); }'",
    `$profile='${profile}'`,
    `$x=${Math.round(x)}`,
    `$y=${Math.round(y)}`,
    "$pi=Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'chrome.exe' -and $_.CommandLine -and $_.CommandLine.Contains($profile) -and -not $_.CommandLine.Contains('--type=') } | Select-Object -First 1",
    "if(-not $pi){exit 2}",
    "$p=Get-Process -Id $pi.ProcessId -ErrorAction Stop; $null=[NaviaOwnedClick]::ShowWindowAsync($p.MainWindowHandle,9)",
    "$shell=New-Object -ComObject WScript.Shell; $activated=$false; if($p.MainWindowTitle){$activated=$shell.AppActivate($p.MainWindowTitle)}; if(-not $activated){$activated=$shell.AppActivate([int]$pi.ProcessId)}; if(-not $activated){$activated=[NaviaOwnedClick]::SetForegroundWindow($p.MainWindowHandle)}; if(-not $activated){exit 3}",
    "Start-Sleep -Milliseconds 350",
    "$rect=New-Object NaviaOwnedClick+RECT; if(-not [NaviaOwnedClick]::GetWindowRect($p.MainWindowHandle,[ref]$rect)){exit 4}",
    "if($x -lt $rect.Left -or $x -ge $rect.Right -or $y -lt $rect.Top -or $y -ge $rect.Bottom){exit 5}",
    "$null=[NaviaOwnedClick]::SetCursorPos($x,$y); [NaviaOwnedClick]::mouse_event(2,0,0,0,[UIntPtr]::Zero); Start-Sleep -Milliseconds 100; [NaviaOwnedClick]::mouse_event(4,0,0,0,[UIntPtr]::Zero)",
    "Write-Output 'method=owned-profile-native-pointer'",
    "Start-Sleep -Milliseconds 300",
  ].join("; ");
}

export function buildOwnedChromeAutomationClickScript(profilePath, processId, controlName) {
  const profile = profileName(profilePath);
  const ownedPid = Number(processId);
  if (!Number.isInteger(ownedPid) || ownedPid <= 0) {
    throw new Error(`Refusing UI Automation click for invalid process id: ${processId}`);
  }
  if (!TRUSTED_CAPTURE_CONTROL_NAMES.has(controlName)) {
    throw new Error(`Refusing UI Automation click for unexpected control: ${controlName}`);
  }
  return [
    "$OutputEncoding=[Console]::OutputEncoding=[System.Text.UTF8Encoding]::new()",
    "Add-Type -AssemblyName UIAutomationClient",
    "Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public static class NaviaOwnedAutomationClick { [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left; public int Top; public int Right; public int Bottom; } [DllImport(\"user32.dll\")] public static extern bool SetProcessDpiAwarenessContext(IntPtr value); [DllImport(\"user32.dll\")] public static extern bool ShowWindowAsync(IntPtr h,int n); [DllImport(\"user32.dll\")] public static extern bool SetForegroundWindow(IntPtr h); [DllImport(\"user32.dll\")] public static extern bool GetWindowRect(IntPtr h,out RECT r); [DllImport(\"user32.dll\")] public static extern bool SetCursorPos(int x,int y); [DllImport(\"user32.dll\")] public static extern void mouse_event(uint f,uint x,uint y,uint d,UIntPtr e); }'",
    `$profile='${profile}'`, `$ownedPid=${ownedPid}`, `$controlName='${controlName}'`,
    "$pi=Get-CimInstance Win32_Process -Filter (\"ProcessId = \" + $ownedPid)",
    "if(-not $pi -or $pi.Name -ne 'chrome.exe' -or -not $pi.CommandLine -or -not $pi.CommandLine.Contains($profile) -or $pi.CommandLine.Contains('--type=')){exit 2}",
    "$null=[NaviaOwnedAutomationClick]::SetProcessDpiAwarenessContext([IntPtr](-4))",
    "$p=Get-Process -Id $ownedPid -ErrorAction Stop; if($p.MainWindowHandle -eq 0){exit 3}",
    "$null=[NaviaOwnedAutomationClick]::ShowWindowAsync($p.MainWindowHandle,9); $null=[NaviaOwnedAutomationClick]::SetForegroundWindow($p.MainWindowHandle); Start-Sleep -Milliseconds 350",
    "$root=[System.Windows.Automation.AutomationElement]::FromHandle($p.MainWindowHandle); if(-not $root){exit 7}",
    "$ownedRect=New-Object NaviaOwnedAutomationClick+RECT; if(-not [NaviaOwnedAutomationClick]::GetWindowRect($p.MainWindowHandle,[ref]$ownedRect)){exit 8}",
    "$nameCondition=[System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::NameProperty,$controlName)",
    "$typeCondition=[System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::ControlTypeProperty,[System.Windows.Automation.ControlType]::Button)",
    "$condition=[System.Windows.Automation.AndCondition]::new($nameCondition,$typeCondition)",
    `$deadline=[DateTime]::UtcNow.AddMilliseconds(${NATIVE_CONTROL_WAIT_MS}); $matches=$null`,
    "while([DateTime]::UtcNow -lt $deadline){$matches=$root.FindAll([System.Windows.Automation.TreeScope]::Descendants,$condition); if($matches.Count -eq 1){$candidate=$matches.Item(0); $candidateRect=$candidate.Current.BoundingRectangle; $insideOwnedWindow=$candidateRect.Left -ge $ownedRect.Left -and $candidateRect.Top -ge $ownedRect.Top -and $candidateRect.Right -le $ownedRect.Right -and $candidateRect.Bottom -le $ownedRect.Bottom; if($candidate.Current.IsEnabled -and -not $candidate.Current.IsOffscreen -and $candidateRect.Width -gt 1 -and $candidateRect.Height -gt 1 -and $insideOwnedWindow){break}}; Start-Sleep -Milliseconds 200}",
    "if($matches.Count -ne 1){Write-Output ('matchCount=' + $matches.Count); exit 4}",
    "$target=$matches.Item(0); if(-not $target.Current.IsEnabled -or $target.Current.IsOffscreen -or -not $insideOwnedWindow){Write-Output ('enabled=' + $target.Current.IsEnabled + ';offscreen=' + $target.Current.IsOffscreen + ';insideOwnedWindow=' + $insideOwnedWindow); exit 5}",
    "$rect=$target.Current.BoundingRectangle; if($rect.Width -le 1 -or $rect.Height -le 1){exit 6}",
    "$x=[int]($rect.Left+$rect.Width/2); $y=[int]($rect.Top+$rect.Height/2)",
    "$null=[NaviaOwnedAutomationClick]::SetCursorPos($x,$y); [NaviaOwnedAutomationClick]::mouse_event(2,0,0,0,[UIntPtr]::Zero); Start-Sleep -Milliseconds 100; [NaviaOwnedAutomationClick]::mouse_event(4,0,0,0,[UIntPtr]::Zero)",
    "Write-Output ('method=owned-pid-uia-native-pointer;name=' + $target.Current.Name + ';automationId=' + $target.Current.AutomationId + ';rect=' + [int]$rect.Left + ',' + [int]$rect.Top + ',' + [int]$rect.Width + ',' + [int]$rect.Height)",
    "Start-Sleep -Milliseconds 300",
  ].join("; ");
}

function runPowerShell(script, timeout) {
  return spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], {
    encoding: "utf8",
    timeout,
  });
}

export function invokeExtensionOnActiveTab(profilePath) {
  const result = runPowerShell(buildExtensionMenuInvocationScript(profilePath), 10_000);
  if (result.status !== 0) {
    throw new Error(`native extension invocation failed (status=${result.status}): ${String(result.stdout || "").trim()} ${String(result.stderr || "").trim()}`);
  }
  return result.stdout;
}

export function invokeExtensionShortcut(profilePath, shortcutKind = "project-command") {
  const result = runPowerShell(buildExtensionShortcutInvocationScript(profilePath, shortcutKind), 10_000);
  if (result.status !== 0) throw new Error(`native extension shortcut invocation failed (status=${result.status})`);
  return result.stdout;
}

export function invokeOwnedPidExtensionShortcut(profilePath, processId, shortcutKind = "project-command") {
  const result = runPowerShell(buildOwnedPidExtensionShortcutInvocationScript(profilePath, processId, shortcutKind), 5_000);
  if (result.status !== 0) throw new Error(`native owned-pid extension shortcut invocation failed (status=${result.status})`);
  return result.stdout;
}

export function clickOwnedChromePoint(profilePath, screenX, screenY) {
  const result = runPowerShell(buildOwnedChromePointerClickScript(profilePath, screenX, screenY), 10_000);
  if (result.status !== 0) {
    throw new Error(`native owned-profile pointer click failed (status=${result.status}): ${String(result.stdout || "").trim()} ${String(result.stderr || "").trim()}`);
  }
  return result.stdout;
}

export function clickOwnedChromeAutomationControlByPid(profilePath, processId, controlName) {
  const result = runPowerShell(
    buildOwnedChromeAutomationClickScript(profilePath, processId, controlName),
    NATIVE_CONTROL_PROCESS_TIMEOUT_MS,
  );
  if (result.status !== 0) {
    const processFailure = result.error
      ? `${result.error.name}:${result.error.code ?? "unknown"}:${result.error.message}`
      : `signal=${result.signal ?? "none"}`;
    throw new Error(`native owned-pid UI Automation click failed (status=${result.status}; ${processFailure}): ${String(result.stdout || "").trim()} ${String(result.stderr || "").trim()}`);
  }
  return String(result.stdout || "").trim();
}

export function buildOwnedChromePointByPidScript(profilePath, processId, screenX, screenY) {
  const profile = profileName(profilePath);
  const ownedPid = Number(processId);
  const x = Math.round(Number(screenX));
  const y = Math.round(Number(screenY));
  if (!Number.isInteger(ownedPid) || ownedPid <= 0 || !Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0) {
    throw new Error("Refusing native pointer click with invalid owned process or coordinates");
  }
  return [
    "Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public static class NaviaOwnedPidClick { [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left; public int Top; public int Right; public int Bottom; } [DllImport(\"user32.dll\")] public static extern bool SetProcessDpiAwarenessContext(IntPtr value); [DllImport(\"user32.dll\")] public static extern bool ShowWindowAsync(IntPtr h,int n); [DllImport(\"user32.dll\")] public static extern bool SetForegroundWindow(IntPtr h); [DllImport(\"user32.dll\")] public static extern bool GetWindowRect(IntPtr h,out RECT r); [DllImport(\"user32.dll\")] public static extern bool SetCursorPos(int x,int y); [DllImport(\"user32.dll\")] public static extern void mouse_event(uint f,uint x,uint y,uint d,UIntPtr e); }'",
    `$profile='${profile}'`, `$ownedPid=${ownedPid}`, `$x=${x}`, `$y=${y}`,
    "$pi=Get-CimInstance Win32_Process -Filter (\"ProcessId = \" + $ownedPid)",
    "if(-not $pi -or $pi.Name -ne 'chrome.exe' -or -not $pi.CommandLine -or -not $pi.CommandLine.Contains($profile) -or $pi.CommandLine.Contains('--type=')){exit 2}",
    "$null=[NaviaOwnedPidClick]::SetProcessDpiAwarenessContext([IntPtr](-4))",
    "$p=Get-Process -Id $ownedPid -ErrorAction Stop; $null=[NaviaOwnedPidClick]::ShowWindowAsync($p.MainWindowHandle,9); $null=[NaviaOwnedPidClick]::SetForegroundWindow($p.MainWindowHandle); Start-Sleep -Milliseconds 250",
    "$rect=New-Object NaviaOwnedPidClick+RECT; if(-not [NaviaOwnedPidClick]::GetWindowRect($p.MainWindowHandle,[ref]$rect)){exit 4}",
    "Write-Output ('rect=' + $rect.Left + ',' + $rect.Top + ',' + $rect.Right + ',' + $rect.Bottom + ';point=' + $x + ',' + $y)",
    "if($x -lt $rect.Left -or $x -ge $rect.Right -or $y -lt $rect.Top -or $y -ge $rect.Bottom){exit 5}",
    "$null=[NaviaOwnedPidClick]::SetCursorPos($x,$y); [NaviaOwnedPidClick]::mouse_event(2,0,0,0,[UIntPtr]::Zero); Start-Sleep -Milliseconds 100; [NaviaOwnedPidClick]::mouse_event(4,0,0,0,[UIntPtr]::Zero)",
  ].join("; ");
}

export function clickOwnedChromePointByPid(profilePath, processId, screenX, screenY) {
  const script = buildOwnedChromePointByPidScript(profilePath, processId, screenX, screenY);
  const result = runPowerShell(script, 10_000);
  if (result.status !== 0) throw new Error(`native owned-pid pointer click failed (status=${result.status}): ${String(result.stdout || "").trim()}`);
}

export function clickOwnedChromeRelativePointByPid(profilePath, processId, relativeX, relativeY, logicalWidth, logicalHeight) {
  const profile = profileName(profilePath);
  const values = [processId, relativeX, relativeY, logicalWidth, logicalHeight].map(Number);
  const [ownedPid, relX, relY, width, height] = values;
  if (!Number.isInteger(ownedPid) || ownedPid <= 0 || values.slice(1).some((value) => !Number.isFinite(value)) || width <= 0 || height <= 0) {
    throw new Error("Refusing native relative click with invalid owned process or geometry");
  }
  const script = [
    "Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public static class NaviaRelativeClick { [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left; public int Top; public int Right; public int Bottom; } [DllImport(\"user32.dll\")] public static extern bool ShowWindowAsync(IntPtr h,int n); [DllImport(\"user32.dll\")] public static extern bool SetForegroundWindow(IntPtr h); [DllImport(\"user32.dll\")] public static extern bool GetWindowRect(IntPtr h,out RECT r); [DllImport(\"user32.dll\")] public static extern bool SetCursorPos(int x,int y); [DllImport(\"user32.dll\")] public static extern void mouse_event(uint f,uint x,uint y,uint d,UIntPtr e); }'",
    `$profile='${profile}'`, `$ownedPid=${ownedPid}`, `$relX=${relX}`, `$relY=${relY}`, `$logicalWidth=${width}`, `$logicalHeight=${height}`,
    "$pi=Get-CimInstance Win32_Process -Filter (\"ProcessId = \" + $ownedPid)",
    "if(-not $pi -or $pi.Name -ne 'chrome.exe' -or -not $pi.CommandLine -or -not $pi.CommandLine.Contains($profile) -or $pi.CommandLine.Contains('--type=')){exit 2}",
    "$p=Get-Process -Id $ownedPid -ErrorAction Stop; $null=[NaviaRelativeClick]::ShowWindowAsync($p.MainWindowHandle,9); $null=[NaviaRelativeClick]::SetForegroundWindow($p.MainWindowHandle); Start-Sleep -Milliseconds 250",
    "$rect=New-Object NaviaRelativeClick+RECT; if(-not [NaviaRelativeClick]::GetWindowRect($p.MainWindowHandle,[ref]$rect)){exit 4}",
    "$x=[int]($rect.Left + $relX * ($rect.Right-$rect.Left) / $logicalWidth); $y=[int]($rect.Top + $relY * ($rect.Bottom-$rect.Top) / $logicalHeight)",
    "if($x -lt $rect.Left -or $x -ge $rect.Right -or $y -lt $rect.Top -or $y -ge $rect.Bottom){exit 5}",
    "$null=[NaviaRelativeClick]::SetCursorPos($x,$y); [NaviaRelativeClick]::mouse_event(2,0,0,0,[UIntPtr]::Zero); Start-Sleep -Milliseconds 100; [NaviaRelativeClick]::mouse_event(4,0,0,0,[UIntPtr]::Zero)",
  ].join("; ");
  const result = runPowerShell(script, 10_000);
  if (result.status !== 0) throw new Error(`native owned-pid relative click failed (status=${result.status})`);
}

export function inspectOwnedWindowsChromeProfile(profilePath) {
  const profile = profileName(profilePath);
  const script = [
    `$profile='${profile}'`,
    "$rows=@(Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'chrome.exe' -and $_.CommandLine -and $_.CommandLine.Contains($profile) -and -not $_.CommandLine.Contains('--type=') } | Select-Object ProcessId,CommandLine)",
    "$rows | ConvertTo-Json -Compress",
  ].join("; ");
  const result = runPowerShell(script, 10_000);
  if (result.status !== 0) throw new Error(`native Chrome inspection failed (status=${result.status})`);
  const raw = String(result.stdout || "").trim();
  if (!raw) return [];
  const parsed = JSON.parse(raw);
  return (Array.isArray(parsed) ? parsed : [parsed]).map((row) => ({
    processId: Number(row.ProcessId),
    commandLine: String(row.CommandLine || ""),
  }));
}
