# R5-B test results

## Offline gates

| Gate | Result |
|---|---|
| TypeScript typecheck | PASS |
| Production extension build | PASS, 4.67 MB |
| Relay ownership static suite | PASS, 45/45 |
| Relay v11 baseline | PASS, 50/50 |
| Relay v11 mutation suite | PASS, 16/16 |
| Capture graph / entrypoint / relay behavior | PASS, 14/14 plus RuntimeCaptureTransport 31/31 |
| Runtime capture API | PASS, 13/13 |

The combined Vitest run passed 14 tests in three files but could not start the fourth worker because the
WSL host was under memory pressure. The missing RuntimeCaptureTransport file was then run alone and passed
31/31. No failed assertion was retried away.

## Real visible observations

| Run | Browser | Changed condition | Result |
|---|---|---|---|
| window 31 | CfT 137 | relay counters | 188 accepted/sent/ACKed; Runtime rejects all-zero audio |
| window 33 | CfT 137 | pre-quantization peak counters | peak 0; non-zero samples 0 |
| window 34 | CfT 137 | dominant-channel downmix | peak 0; non-zero samples 0 |
| window 35 | Chrome 155.0.8059.84 | browser-version control | peak 0; non-zero samples 0 |

Every Chrome was fresh, owned, visible and launched with explicit `--mute-audio`. No test played sound.
No Provider was called. No user Chrome or game process was touched.

## Sources

- Chrome documents that tabCapture suppresses local playback unless the captured stream is reconnected to
  the default AudioContext destination.
- Chromium defines `--mute-audio` as the automated-test switch that mutes audio sent to the audio device.
- The observed Windows implementation additionally produces an all-zero tabCapture stream in both tested
  versions, so it cannot serve as a positive real-audio oracle in this environment.

