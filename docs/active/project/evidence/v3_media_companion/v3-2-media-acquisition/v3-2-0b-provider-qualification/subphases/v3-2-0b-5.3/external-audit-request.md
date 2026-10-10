# V3-2-0b-5.3 固定窗口文档独立审查请求

日期：2026-09-22
请求决定：文档候选是否足以进入“显式用户实现授权”门槛。
当前实现状态：`NO-GO`。

## 1. 阅读顺序

先读本文件与 `AUDIT_MANIFEST.md`，再按 02..18 顺序阅读。所有文件均为平铺传输副本；权威路径和 SHA-256 在 manifest。

## 2. 已确认前情

- 原 V3-2-0b 长窗候选在 sample03/bin2 产生非静音 0 segment，结论 `FAIL / REPLAN`。
- 原 0b-5 acceptance result SHA-256：`224f58d4a0acd103cad83361f03138666978721eb54234cb38761c1abbd48956`。
- 0b-5.1 failure acceptance result SHA-256：`2a0f1a95f0e2711bd0ebea5c0109984c3368d1a855d768fc1603c8109a046036`。
- 5.2 单 bin 诊断 result SHA-256：`cae48ff635e1a756e4f987768260e4e185bc99a9a5c62c4dd41709d0474ac1f2`；同一 15 秒输入得到 1 segment/28 字符，但不计生产证据。
- 父 candidate manifest SHA-256：`2016e6e87baa440ac240fcf5ceb5653928e1f3b6c284ff586413bd42c71cd1cf`。
- 失败状态已经真实传播到 Settings；Paraformer 仍不可选择，Tiny effective fallback 不变。

## 3. 候选决策

路线 A 在 Runtime 内新增 `FixedWindowAsrOrchestrator`：三个 120 秒 source 均切成 8 个不重叠 15 秒 chunk，concurrency=1，按 offset 合并。禁止只补失败 bin、跨 run、复用成功 chunk、文本改写或并行 8 进程。

体验门槛是三样本完整 wall time 各自不超过原长窗 2 倍：`16360/14760/16280ms`。机器通过后才生成新盲评包；人类质量仍固定为 2 reviewer/48 判断、>=44/48、每样本>=15/16、critical=0、neither=0。

## 4. 请独立验证

1. 重新计算 18 项 payload SHA-256，与 manifest 对账，并检查平铺/总数。
2. Draft 2020-12 meta-validation 与 candidate instance。
3. registry/fixtures 的 20 项 tuple 与 FailureCode 精确一致。
4. Schema 是否拒绝重复 sample/chunk、错误 source hash、gap/overlap、concurrency>1、空 chunk、逐样本延迟超限和 cleanup 残留。
5. PRD、Architecture、Stage Gate、ADR、开发/验收/威胁模型、Draw.io 是否一致。
6. `TaskAudioRef`/orchestrator/provider/process host 是否单向、portal-neutral，是否避免 B站权限扩散到未来门户。
7. attempt/retry/cleanup 是否能拒绝 cherry-pick、跨 run 和残留进程/私有音频。
8. <=2x 延迟是否是明确、可测、按样本 fail-closed 的体验门槛。
9. 24 chunk 与 48 review 分母是否仍有缩小、N/A、复制 reviewer 或文本造绿路径。
10. 文档是否错误承诺了未实现 UI、媒体获取、V3-2 或 V3 完成。

## 5. 审查输出

请落盘到：

```text
docs/active/project/evidence/v3_media_companion/v3-2-media-acquisition/
v3-2-0b-provider-qualification/subphases/v3-2-0b-5.3/
independent-document-audit.md
```

输出需包含：Fatal/Major/Minor；每项复现、影响与最小修复；哈希对账；Schema/Draw.io 复算；PRD/架构偏移；假绿与体验回退判断；最终决定原话。

最终决定只能是：

```text
V3-2-0b-5.3 DOCUMENT PASS / IMPLEMENTATION REQUIRES EXPLICIT USER AUTHORIZATION
```

或：

```text
V3-2-0b-5.3 DOCUMENT FAIL / IMPLEMENTATION NO-GO
```

文档 PASS 不得扩大为代码、ASR 质量、V3-2、媒体获取或 V3 PASS。

## 6. 审查约束

仅做只读静态审查和独立机器复算；不运行产品代码、Runtime、Chrome、ASR，不下载模型，不改主工作树，不执行旧 generator/validator，不把内部审查当组织独立审查。
