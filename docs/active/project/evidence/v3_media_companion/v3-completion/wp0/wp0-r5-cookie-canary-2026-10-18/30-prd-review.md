# R5 PRD review

## What is proven

The production UI is user-reachable, Cookie import is functional, source arbitration is atomic for the fixed source, authenticated subtitles are materialized into a usable degraded outline, and UI terminal state synchronizes correctly.

## What is not proven

The R1–R4 Background relay, Offscreen producer, Runtime capture sink, and frozen SenseVoice path were not exercised. The frozen BVID is incompatible with that acceptance objective when valid authenticated subtitles are present.

The product should not be changed to ignore a higher-quality subtitle route merely to satisfy a test. R5 acceptance input should instead use an additional frozen no-subtitle video, or the R5 gate should explicitly separate a subtitle canary from a relay/ASR canary.

Fatal 0 / Major 1 acceptance-design mismatch / Minor 0.

