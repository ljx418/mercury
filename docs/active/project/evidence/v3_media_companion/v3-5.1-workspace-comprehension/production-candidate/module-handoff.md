# V3-5.1 Production Candidate Handoff

- Changed product areas: Runtime workspace candidate materialization, MiniMax caption bounding, semantic timeline/mindmap/seek UI, real Chrome production runner.
- Contract changes: no public Runtime API change; production exit verifier adds a separate human quality submission input.
- Tests: Runtime 679; Extension 351; targeted Workspace 6; typecheck/build; three-video real Chrome; human review page desktop/mobile/schema/tamper checks.
- Real data: `BV1sMNtzJE5B`, `BV1PA4m1w7ya`, `BV1ZpYd66ELP`; 24 authorized selected frames; 30 real player readbacks.
- PRD coverage: V3-5.1 timeline/outline/mindmap/Ask workspace quality implementation covered; V3-5.1 human quality, legacy V3-5 H01..H10, V3-6 and V3-7 remain pending.
- Remaining risk: SenseVoice/Ask semantic usefulness is not machine-authoritative; fixed candidate human review is mandatory.
- Integration handoff: do not start V3-6 until both human submissions are valid and independent V3-5.1 exit review has Fatal=0/Major=0.
