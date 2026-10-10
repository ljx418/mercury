# V3-2-0b-5.3 外部审查澄清与实施前风险闭环

日期：2026-09-22  
状态：`CLOSED BEFORE IMPLEMENTATION`  
独立审查：`independent-document-audit.md`，SHA-256 `56c83e444774107193fdf82712b677635c81cabb007f8faa062afc32b57b3000`

## 1. 不修改原审查记录

原独立审查保持原字节，不回写、不覆盖。本文件只记录实施代理在开始代码前对载荷和真实 WAV 的复核结果。

## 2. 审查报告事实澄清

原报告第 3.4 节四项摘录与实际已审载荷不一致，权威值如下：

| 字段 | 报告摘录 | 实际载荷 |
|---|---|---|
| candidateId | `v3-asr-fixed-window-parallel-baseline` | `funasr-paraformer-q8-fixed15-cpu-v2` |
| status | `qualification_pending` | `document_candidate_not_authorized` |
| qualityPolicy.binCount | 8 | 24（每样本 8，共 24） |
| transcriptTextAllowed | true | false |

这些是报告转录错误，不改变报告的 Fatal=0/Major=0 决定，也不能被后续实现引用为合同值。

## 3. 三项 Minor 闭环

- M-1：`acceptance-plan.md` 已明确 FW01..FW17/FW20 为自动化步骤，FW18..FW19 为唯一人类步骤；每项命令、输入、退出码和证据路径必须进入子阶段验收结果。
- M-2：5.3-0 verifier 必须比较 registry、fixtures、Schema/semantic target 和 FailureCode 四元组，20 项精确相等且无孤儿。
- M-3：Draw.io 修复保持，无新增图变更。

## 4. 新发现的真实输入 Major 及关闭方式

实施前对三份冻结 WAV 独立读取帧头，得到 `1919997/1920000/1920000` 帧。sample 01 比 120 秒少 3 帧（0.1875ms）；原文档仅写 120000ms，若直接实现会导致最终 chunk 不足 240000 帧，形成合同和真实输入冲突。

关闭方式：源 WAV 与 SHA-256 保持不变；Schema/manifest/ADR/API/acceptance 显式冻结 `sourceFrameCount`，只允许最终尾部不足不超过 16 帧时追加 PCM 零帧，且 chunk hash 覆盖实际输出 WAV。超长、缺失超过 16 帧、非尾部或非零填充全部 fail closed。

该修订不更换样本、不缩小 24 chunk/48 判断分母、不改延迟/资源/质量阈值，也不引入门户字段。它是对真实输入的确定性实现收紧。修订后关键哈希：

- candidate manifest：`40c599dcd0b30a228badb720912dea765a570424a94eb288c27285c523c79c5e`
- schema：`df96dd69fabd1a306e31881f6f2003c27dc96b96f8e08b64e4fc083136e0c38f`
- fixtures：`975d8765dac4ad6f4db0847c13d1b6011c4773325082d5fd3dfb1e222daa0ae3`
- registry：`877edbe549afb100004049d27b4b00218bf33fc27aac7e097493d277eee174ff`

## 5. 决定

```text
Fatal open: 0
Major open: 0
Minor open: 0
Scope expansion: none
Implementation may start only under the explicit user authorization recorded separately.
```

若 5.3-0 contract verifier 不能同时证明修订后的 schema meta、positive、20 负例与 FailureCode 映射，则本闭环自动失效并停止实施。
