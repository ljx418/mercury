$ErrorActionPreference = "Stop"

$repoWindows = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoWindows = [IO.Path]::GetFullPath($repoWindows)
if ($repoWindows -notmatch '^[A-Za-z]:\\') {
    throw "Navia must be launched from a Windows drive that is mounted in WSL."
}
$drive = $repoWindows.Substring(0, 1).ToLowerInvariant()
$tail = $repoWindows.Substring(2).Replace('\', '/')
$repoWsl = "/mnt/$drive$tail"

Write-Host "Navia V3-5.1 Fixed Candidate Review Runtime" -ForegroundColor Cyan
Write-Host "Runtime URL: http://127.0.0.1:17861"
Write-Host "This launcher uses the sealed review database and does not modify the daily Runtime database."
Write-Host "Close this window or press Ctrl+C to stop the service."
Write-Host ""

& wsl.exe bash "$repoWsl/scripts/start_v3_5_1_review_runtime.sh"
$exitCode = $LASTEXITCODE
if ($exitCode -ne 0) {
    Read-Host "Press Enter to close"
}
exit $exitCode
