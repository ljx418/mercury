# V3-2-0b-5.1a 验收结果

日期：2026-09-22。结论：`PASS`，仅限失败证据可审计化。

权威 run：`v3-2-0b-5.1-20260922T072602Z`。

- runner 退出码：2（预期 fail-closed）。
- `B051A-01..08`：8/8 PASS。
- 唯一空 bin：sample 03 / bin 2；PCM16 RMS=1948。
- 三样本 segment 数：16 / 28 / 31；最大 segment 均不超过 15000ms。
- 峰值 RSS：317,968,384 / 318,263,296 / 318,685,184 bytes。
- `failure-diagnostic.json` SHA-256：`e8605bc6dd956cbf1acb722ff691b3ec9d4dff7fa297b4f9f4f9674875607964`。
- `invalidated.json` SHA-256：`abd3b42d00fea84c84a8a9ef34c0e87151984c1c857b806fb2be1f0d496d8a51`。
- `verification.json` SHA-256：`d3a1f7ba113b5bd5bd7feed0163e8bf794d45269e59f6504344ee3eb196b4cbf`。

本 PASS 不改变 V3-2-0b-5.1 的质量 FAIL。
