# R5-B test results

## Offline gate

| Check | Result |
|---|---|
| Windows owned-session isolation/input helper | 20/20 PASS |
| TypeScript typecheck | PASS |
| Production extension build | PASS, 4.67 MB |
| Relay v11 baseline | 50/50 PASS |
| Relay v11 mutations | 16/16 PASS |
| Relay ownership static suite | 45/45 PASS |
| Runtime capture API | 13/13 PASS |

The first Runtime test command used the repository root and failed during import collection. The same
unchanged tests were rerun from their required `services/local-runtime` working directory and passed 13/13;
this was command setup, not a product assertion failure.

## One visible positive

Run: `r5b-audio-isolated-positive-20261019T024000Z`.

| Boundary | Result |
|---|---|
| OS audio isolation before page unmute | 1/1 owned session muted |
| Offscreen real PCM | peak 0.504842; 714,569 non-zero samples |
| Background relay | 182 accepted / 182 sent / 182 ACKed |
| Runtime sink | 195 chunks; 16,636 ms; 255,758 non-zero samples |
| SenseVoice | terminal; transcript GET HTTP 200 |
| Product materialization | visual 503 disclosed; grounded text 200 |
| Durable task | degraded revision 6; published source authority/outline |
| Public secret scan | 0 hits |
| Cleanup | profile/root/process residue 0 |

No second visible run was performed. No cloud grounded-text upload was enabled. Raw media, transcript text,
Cookie values and API keys are not copied into this public checkpoint.
