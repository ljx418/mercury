param(
  [Parameter(Mandatory = $true)][string]$ProfileName,
  [Parameter(Mandatory = $true)][string]$StatusPath,
  [Parameter(Mandatory = $true)][string]$StopPath,
  [int]$PollMilliseconds = 150
)

$ErrorActionPreference = "Stop"
$OutputEncoding = [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()

if ($ProfileName -notmatch '^navia-t01-profile-[A-Za-z0-9]+$') {
  throw "Unexpected owned Chrome profile name."
}

Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;

namespace Navia.AudioIsolation {
  public enum EDataFlow { eRender, eCapture, eAll, EDataFlowEnumCount }
  public enum ERole { eConsole, eMultimedia, eCommunications, ERoleEnumCount }

  [ComImport]
  [Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]
  internal class MMDeviceEnumerator { }

  [Guid("A95664D2-9614-4F35-A746-DE8DB63617E6")]
  [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  internal interface IMMDeviceEnumerator {
    int NotImplemented1();
    [PreserveSig]
    int GetDefaultAudioEndpoint(EDataFlow dataFlow, ERole role, out IMMDevice device);
  }

  [Guid("D666063F-1587-4E43-81F1-B948E807363F")]
  [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  internal interface IMMDevice {
    [PreserveSig]
    int Activate(ref Guid iid, int classContext, IntPtr activationParameters,
      [MarshalAs(UnmanagedType.IUnknown)] out object activatedInterface);
  }

  [Guid("77AA99A0-1BD6-484F-8BC7-2C654C9A9B6F")]
  [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  internal interface IAudioSessionManager2 {
    int NotImplemented1();
    int NotImplemented2();
    [PreserveSig]
    int GetSessionEnumerator(out IAudioSessionEnumerator sessionEnumerator);
  }

  [Guid("E2F5BB11-0570-40CA-ACDD-3AA01277DEE8")]
  [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  internal interface IAudioSessionEnumerator {
    [PreserveSig]
    int GetCount(out int sessionCount);
    [PreserveSig]
    int GetSession(int sessionIndex, out IAudioSessionControl2 session);
  }

  [Guid("BFB7FF88-7239-4FC9-8FA2-07C950BE9C6D")]
  [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  internal interface IAudioSessionControl2 {
    int NotImplemented0();
    int GetDisplayName([MarshalAs(UnmanagedType.LPWStr)] out string value);
    int SetDisplayName([MarshalAs(UnmanagedType.LPWStr)] string value, IntPtr eventContext);
    int GetIconPath([MarshalAs(UnmanagedType.LPWStr)] out string value);
    int SetIconPath([MarshalAs(UnmanagedType.LPWStr)] string value, IntPtr eventContext);
    int GetGroupingParam(out Guid value);
    int SetGroupingParam(ref Guid value, IntPtr eventContext);
    int NotImplemented1();
    int NotImplemented2();
    int GetSessionIdentifier([MarshalAs(UnmanagedType.LPWStr)] out string value);
    int GetSessionInstanceIdentifier([MarshalAs(UnmanagedType.LPWStr)] out string value);
    [PreserveSig]
    int GetProcessId(out int processId);
    int IsSystemSoundsSession();
    int SetDuckingPreference([MarshalAs(UnmanagedType.Bool)] bool optOut);
  }

  [Guid("87CE5498-68D6-44E5-9215-6DA47EF883D8")]
  [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  internal interface ISimpleAudioVolume {
    [PreserveSig]
    int SetMasterVolume(float level, ref Guid eventContext);
    [PreserveSig]
    int GetMasterVolume(out float level);
    [PreserveSig]
    int SetMute([MarshalAs(UnmanagedType.Bool)] bool muted, ref Guid eventContext);
    [PreserveSig]
    int GetMute([MarshalAs(UnmanagedType.Bool)] out bool muted);
  }

  public sealed class MuteResult {
    public int MatchedSessionCount;
    public int MutedSessionCount;
    public bool AllMatchedSessionsMuted;
  }

  public static class SessionMuter {
    private const int ClsCtxInprocServer = 1;

    public static MuteResult MuteOwnedSessions(int[] processIds) {
      HashSet<int> owned = new HashSet<int>(processIds ?? new int[0]);
      MuteResult result = new MuteResult();
      result.AllMatchedSessionsMuted = true;
      IMMDeviceEnumerator deviceEnumerator = null;
      IMMDevice device = null;
      IAudioSessionManager2 manager = null;
      IAudioSessionEnumerator sessions = null;
      try {
        deviceEnumerator = (IMMDeviceEnumerator)(new MMDeviceEnumerator());
        ThrowIfFailed(deviceEnumerator.GetDefaultAudioEndpoint(EDataFlow.eRender, ERole.eMultimedia, out device));
        Guid managerId = typeof(IAudioSessionManager2).GUID;
        object activated;
        ThrowIfFailed(device.Activate(ref managerId, ClsCtxInprocServer, IntPtr.Zero, out activated));
        manager = (IAudioSessionManager2)activated;
        ThrowIfFailed(manager.GetSessionEnumerator(out sessions));
        int count;
        ThrowIfFailed(sessions.GetCount(out count));
        for (int index = 0; index < count; index++) {
          IAudioSessionControl2 control = null;
          try {
            if (sessions.GetSession(index, out control) < 0 || control == null) continue;
            int processId;
            if (control.GetProcessId(out processId) < 0 || !owned.Contains(processId)) continue;
            result.MatchedSessionCount++;
            ISimpleAudioVolume volume = control as ISimpleAudioVolume;
            if (volume == null) {
              result.AllMatchedSessionsMuted = false;
              continue;
            }
            Guid eventContext = new Guid("87C385A0-DCB7-4CF1-A843-FA5F6F036CC9");
            bool muted;
            int setResult = volume.SetMute(true, ref eventContext);
            int getResult = volume.GetMute(out muted);
            if (setResult >= 0 && getResult >= 0 && muted) result.MutedSessionCount++;
            else result.AllMatchedSessionsMuted = false;
          } finally {
            Release(control);
          }
        }
        if (result.MatchedSessionCount == 0) result.AllMatchedSessionsMuted = false;
        return result;
      } finally {
        Release(sessions);
        Release(manager);
        Release(device);
        Release(deviceEnumerator);
      }
    }

    private static void ThrowIfFailed(int result) {
      if (result < 0) Marshal.ThrowExceptionForHR(result);
    }

    private static void Release(object value) {
      if (value != null && Marshal.IsComObject(value)) Marshal.FinalReleaseComObject(value);
    }
  }
}
'@

function Write-Status([hashtable]$Value) {
  $Value.updatedAt = [DateTime]::UtcNow.ToString('o')
  $temporaryPath = "$StatusPath.tmp"
  $Value | ConvertTo-Json -Compress | Set-Content -LiteralPath $temporaryPath -Encoding UTF8
  Move-Item -LiteralPath $temporaryPath -Destination $StatusPath -Force
}

Write-Status @{
  schemaVersion = 'navia-owned-chrome-audio-isolation/v1'
  watcherReady = $true
  ownedProcessCount = 0
  matchedSessionCount = 0
  mutedSessionCount = 0
  allMatchedSessionsMuted = $false
}

while (-not (Test-Path -LiteralPath $StopPath)) {
  $processes = @(Get-CimInstance Win32_Process | Select-Object ProcessId, ParentProcessId, Name, CommandLine)
  $owned = [System.Collections.Generic.HashSet[int]]::new()
  $roots = @($processes | Where-Object {
    $_.Name -eq 'chrome.exe' -and $_.CommandLine -and
    $_.CommandLine.Contains($ProfileName) -and -not $_.CommandLine.Contains('--type=')
  })
  foreach ($root in $roots) { $null = $owned.Add([int]$root.ProcessId) }
  do {
    $changed = $false
    foreach ($process in $processes) {
      if ($process.Name -eq 'chrome.exe' -and $owned.Contains([int]$process.ParentProcessId)) {
        if ($owned.Add([int]$process.ProcessId)) { $changed = $true }
      }
    }
  } while ($changed)

  try {
    $mute = [Navia.AudioIsolation.SessionMuter]::MuteOwnedSessions([int[]]$owned)
    Write-Status @{
      schemaVersion = 'navia-owned-chrome-audio-isolation/v1'
      watcherReady = $true
      ownedProcessCount = $owned.Count
      matchedSessionCount = $mute.MatchedSessionCount
      mutedSessionCount = $mute.MutedSessionCount
      allMatchedSessionsMuted = $mute.AllMatchedSessionsMuted
    }
  } catch {
    Write-Status @{
      schemaVersion = 'navia-owned-chrome-audio-isolation/v1'
      watcherReady = $true
      ownedProcessCount = $owned.Count
      matchedSessionCount = 0
      mutedSessionCount = 0
      allMatchedSessionsMuted = $false
      errorKind = $_.Exception.GetType().Name
    }
  }
  Start-Sleep -Milliseconds $PollMilliseconds
}

