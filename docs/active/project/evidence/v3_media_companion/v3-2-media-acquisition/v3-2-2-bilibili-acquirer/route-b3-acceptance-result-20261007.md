# V3-2-2 Route B3 自动验收结果

日期：2026-10-07。候选 run：`v3-2-route-b3-20261007T014759Z`。结论：`AUTOMATED CANDIDATE PASS / INDEPENDENT EXIT AUDIT PENDING`。

## 1. 固定分母

- 真实 Chrome 12/12：`6 subtitle + 3 ASR capability + 1 multipart + 1 restricted + 1 low_signal`。
- acquisition：7 条真实字幕、3 条真实当前分 P 音频、1 blocked、1 degraded。
- B3 动态触发：`runtimeNoSubtitle=1`、`auditedSubtitleFailure=2`、`totalMediaFallback=3`。
- verifier：`B3-01..B3-20 = 20/20 PASS`。
- focused Runtime：68 passed；Runtime full：449 passed。
- frontend：39 files / 293 tests passed；typecheck/build exit 0。
- production fault reachability：8 files / 10 needles / 0 hit。
- cleanup：private root absent，artifact residual 0。
- public secret scan：17 files，credential value 0 hit，forbidden context 0 hit。

## 2. 平台漂移事实

Chrome 页面探测时 `BV13W41137qV` 有 1 条字幕；acquisition task 随后真实发现为 0，因此按 `runtime_no_subtitle` 直接进入媒体路线。`BV1ZpYd66ELP` 与 `BV1pW421c7DH` 在 acquisition task 各发现 2 条字幕，分别执行预冻结 403 与空体故障一次后进入媒体路线。

该结果证明 B3 没有通过挑选“永久无字幕 URL”获得 PASS，并证明页面快照不能替代任务时 discovery receipt。

## 3. 产物绑定

| 文件 | SHA-256 |
|---|---|
| raw-observations.json | `eebf70ed0ff0aaa6c584a77500f34acb47480bda99c369b543cff8caea6e0af6` |
| enriched-observations.json | `7ad5a23ce744c5af07d5c08a6cefc7ddb19e979d9ae5c31d5d79d05b9b8b1451` |
| sample-registry-v5.json | `7e76c9f30e52aac70d9e89406476f0b893b661a1d46bb3afc3f2ed2004ed5104` |
| acquisition-result.json | `67dd4176538d5f1c5dff1be48e37616963a9262e3b7fffaf961459803a4e2da7` |
| verification-result.json | `a84acd011bcc623d4ca5423cd8a86d59ef038f66641ab54bc7f504ff61b84340` |
| public-run-seal.json | `64c80a7f7f689a466099b85aae78eec7d2d08ae090b4206ac1151c887a863a13` |

Seal canonical content SHA-256：`66b9d6ce6997261e3b6b4291178424b1df69e5d8f57b5e51cf07546f9bcd56ea`，18 members，不含私有媒体和凭据材料。

## 4. 限定声明

本结果只证明 V3-2-2 B3 媒体获取自动化候选。它不证明三条媒体已完成 SenseVoice 全长转写，不证明 V3-2、图文大纲或 V3 PASS。V3-2-3 仍需独立开发、真实 ASR 和验收。

