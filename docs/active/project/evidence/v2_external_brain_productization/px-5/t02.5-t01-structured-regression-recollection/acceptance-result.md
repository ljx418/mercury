# T02.5 验收结果

日期：2026-09-14。状态：`SELF-AUDIT PASS / LIMITED PRODUCTION INPUT`。

## 不可变候选

```text
runId: t02-r2-t01-structured-production-input-20260914T125700
snapshotCommit: 430cddcb7ff618978851af1f3b9a3c48f2370d36
rawSha256: ce272df479499e10092bc5d6a24610ebcd91782c87d4be34dceb09f296a5f0c3
sealSha256: fed6155ace6c0132c70c86bd3daccef987bd7c441df8960811e734274ea1b70f
T01 sourceSha256: 5df8a82fb3c0315020851fe8958ee3f6ff6226fb9b4b7ce1feea55c002f98c75
T01 structured artifactSha256: 2ac95cd1225f55f21a9197134d4c85c392e5d79088bea624bfae294c0839632e
```

T02.5-A01..A14：14/14 PASS。专用 verifier：37/37 PASS。事件 1387、artifact 1172、场景 88；Runtime 560 requests = 545 responses + 15 transport failures，0 orphan；offline interval 15 requests / 15 failures / 0 responses。T01 36 个唯一 assertion ID、36/36 passed，公开结构化 artifact 不含 detail 或私有路径。collector 17、frontend 169、Runtime 307、T01 36 全部通过；cleanup 4/4。

首次 run `...T125102` 因 36 checks 只有 34 个唯一 ID 在 seal 前失败，见 `failed-attempt-20260914T125102.md`，不得拼接或使用。

本结论只放行 T03-1..T03-5 重放与后续 T03 实施；不等于 T03、PX-5、PX-6 或 V2 通过。
