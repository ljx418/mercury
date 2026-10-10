# V3-2-1 实施出门与 V3-2-2 前置冲突独立审查请求

日期：2026-09-22

## 审查决定对象

1. `V3-2-0c-1 SenseVoice development baseline` 是否可维持 LIMITED PASS。
2. `V3-2-1 Runtime acquisition core` 是否达到 LIMITED PASS，Fatal/Major 是否为 0。
3. V3-2-2 是否必须在 sample registry revision 3 冻结前保持 NO-GO。

## 必须独立复算

- 外包载荷 SHA-256 与权威源一致性。
- 媒体合同 Schema meta、positive 和 49 cases。
- SenseVoice baseline result：官方资产 bytes/hash、未安装 fail closed、requested/effective/restart、真实窗口非空合法。
- V3-2-1 result：真实 WAV bytes/hash、0700/0600、create/cancel idempotency、orphan recovery、API no-store/closed request。
- `TaskArtifactSandbox` 路径/link/quota/owner cleanup 和 `MediaAcquisitionCoordinator` identity/policy/cancel barrier 是否存在假绿。
- 公开材料是否泄漏 Cookie、音频、转写、账号或绝对路径。

## 规格冲突问题

用户已把跨模型退化检测和失败后智能质量回退移入 V4；但 `v3_media_acquisition_sample_registry.schema.json` v2 仍要求旧 comparison review/adjudication 才能 `productionReady=true`。请判断：

- 是否应新增 revision 3（推荐）而非静默放宽 v2；
- revision 3 是否应保留 12 URL、6+3+1+1+1 分类、identity/part/hash/真实授权探测，只移除 V3 已延期的 cross-model review/adjudication；
- 在该修订完成前，V3-2-2 implementation 是否必须 NO-GO。

## 禁止扩大结论

不得将本包扩大为 V3-2、V3、B站媒体获取、字幕、本地全长 ASR、tabCapture、视频理解或图文大纲通过。独立报告请落盘到同级 `independent-implementation-audit.md`。
