# R5-B PRD review

| Requirement | Decision | Evidence |
|---|---|---|
| R5B-01 fresh owners | PASS | owned Runtime/profile/task root |
| R5B-02 fixed source | PASS | BVID/CID/p1 unchanged |
| R5B-03 three-route fallback | PASS | real production route failure before capture |
| R5B-04 no forbidden direct success injection | PASS | user UI and native extension invocation only |
| R5B-05 trusted action/grant | PASS | real grant and tabCapture start |
| R5B-06 Background sole WebSocket owner | PASS | relay v11 plus real Runtime ACKs |
| R5B-07 real PCM and duration | FAIL | duration and bytes pass; source samples are all zero |
| R5B-08 SenseVoice transcript | NOT REACHED | Runtime correctly rejects empty audio |
| R5B-09 handoff/materialize order | NOT REACHED | no valid transcript |
| R5B-10 terminal consistency/UI idle | NOT REACHED | capture cannot publish success |
| R5B-11 public secret scan | PASS | zero hits |
| R5B-12 cleanup | PASS | owned resources removed |

The product must continue to reject all-zero audio. Relaxing that check, injecting PCM, using a downloaded
file as if it were tabCapture, or declaring transport ACKs equivalent to successful transcription would be
false acceptance.

## Required decision before another visible run

One of these must be explicitly authorized and documented:

1. amend the automated acceptance environment to use a verified OS-level mute/isolation mechanism instead
   of Chromium `--mute-audio`, while preserving zero audible output; or
2. retain `--mute-audio` for UI/security composition and split the non-zero real-audio/SenseVoice proof into
   a separately attributable real-media canary, revising the R5-B denominator so the two proofs cannot be
   misrepresented as one tabCapture run.

Until then: `R5-B NO-GO / R6 IMPLEMENTATION NO-GO`.

