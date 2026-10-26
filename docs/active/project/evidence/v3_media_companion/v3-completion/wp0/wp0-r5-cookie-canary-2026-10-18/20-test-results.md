# R5 cookie canary test results

## Passed

- Cookie parser: 9 `.bilibili.com` entries; required `SESSDATA`, `bili_jct`, and `DedeUserID` present.
- Product Settings import: configured / verified / enabled.
- SenseVoice preflight: installation ready and verified; effective model `funasr-sensevoice-small-q8`.
- Production extension build: exit 0, 4.66 MB.
- Real user path: permission dialog accepted through visible UI; acquisition succeeded; 598 nonempty subtitle segments; materialization reached degraded; UI exited busy.
- Prior affected tests: launch card 5/5; user-reachable composition 1/1; typecheck exit 0.

## Failed R5 oracle

- PCM bytes/chunks/duration: 0 / 0 / 0.
- SenseVoice process for this canary: 0.
- ASR transcript for this canary: 0.
- Cause: the frozen fixed video exposed authenticated subtitles, so the production route arbiter correctly selected `credentialed_subtitle` before capture fallback.

The consolidated R5 closeout regression was not run after this outcome because section 6 requires immediate NO-GO on a real-path mismatch.

## Runtime ownership and cleanup

- owned Runtime PID: 1159949, stopped normally
- owned Chrome PID: 60044, verified by profile and `--mute-audio`, stopped
- audio playback: 0
- cloud Provider: 0
- owned Runtime/profile/scratch/media-cache residue: 0
- user Chrome PID 18968: untouched

