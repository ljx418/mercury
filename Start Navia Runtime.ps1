$ErrorActionPreference = "Stop"

$repoWindows = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoWindows = [IO.Path]::GetFullPath($repoWindows)
if ($repoWindows -notmatch '^[A-Za-z]:\\') {
    throw "Navia must be launched from a Windows drive that is mounted in WSL."
}
$drive = $repoWindows.Substring(0, 1).ToLowerInvariant()
$tail = $repoWindows.Substring(2).Replace('\', '/')
$repoWsl = "/mnt/$drive$tail"

Write-Host "Navia Local Companion" -ForegroundColor Cyan
Write-Host "Runtime URL: http://127.0.0.1:17861"
Write-Host "Close this window or press Ctrl+C to stop the service."
Write-Host ""

& wsl.exe bash -lc 'test -f "$HOME/.navia/companion.json"'
$configured = $LASTEXITCODE -eq 0
$extensionId = ""

if (-not $configured) {
    Write-Host "One-time pairing is required." -ForegroundColor Yellow
    Write-Host "1. Open chrome://extensions in Chrome."
    Write-Host "2. Turn on Developer mode."
    Write-Host "3. Find Navia and copy its 32-character ID."
    Write-Host ""
    $extensionId = (Read-Host "Paste the Navia extension ID").Trim().ToLowerInvariant()
    if ($extensionId -notmatch '^[a-p]{32}$') {
        throw "Invalid Chrome extension ID. Expected 32 letters in the range a-p."
    }
    Write-Host "The pairing stores only the extension ID; no browser cookie or Runtime token is persisted."
}

$launcher = "$repoWsl/scripts/start_companion.sh"
if ($configured) {
    & wsl.exe bash $launcher
} else {
    & wsl.exe bash $launcher $extensionId
}
$exitCode = $LASTEXITCODE

Write-Host ""
Write-Host "Navia Local Companion stopped with exit code $exitCode."
if ($exitCode -ne 0) {
    Read-Host "Press Enter to close"
}
exit $exitCode
