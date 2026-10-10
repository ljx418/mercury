# V3-2-0b-5.3 固定窗口文档准备度审计

日期：2026-09-22  
内部结论：`DOCUMENT READY FOR EXTERNAL INDEPENDENT REVIEW`  
实现状态：`NO-GO`

## 1. 决策范围

本轮只判断固定 15 秒窗口路线的规格是否足以指导后续自动化实现，不能证明真实推理、延迟、质量或产品出门。原 V3-2-0b 长窗候选继续 `FAIL / REPLAN`，Paraformer 继续 `failed_current_gate/selectable=false`，V3-2-1..7 继续 BLOCKED。

## 2. 文档交付

- PRD §18.7：目标体验、低资源和质量分母。
- Architecture §22.10：`TaskAudioRef -> FixedWindowAsrOrchestrator -> Provider -> ProcessHost`。
- Development Plan §18.5：5.3-0..7 线性开发顺序。
- Acceptance Plan §8.20.10：FW01..FW20 与假绿拒绝。
- Stage Gate §15：外审与新用户授权前 implementation NO-GO。
- 固定窗口 ADR、合同/API、开发、验收、威胁模型。
- Schema、20 项 registry、candidate manifest、20 negative fixtures。
- 8 页中文 Draw.io 原位更新；无新增页面。

本工作包没有新交互原型，因为它不新增按钮、路由或展示状态。现有 Settings 的质量失败卡片和匿名比较页是后续真实回归对象；在机器门禁通过前不允许生成新比较包。强行新增原型会暗示尚未实现的用户能力，构成规格偏移。

## 3. 关键架构结论

1. 固定窗口策略只有一个 owner：`FixedWindowAsrOrchestrator`。
2. 每样本 8 个 `[i*15000,(i+1)*15000)` chunk，0 gap/overlap，单并发。
3. 任一失败后的新 attempt 从 chunk 0 开始；0 partial reuse，0 cross-run splice。
4. local timestamp 先校验再加 offset；0 文本修正、猜词或相邻复制。
5. 三样本 wall time 分别 <=16360/14760/16280ms；平均值不能替代逐项门槛。
6. Runtime private data 与公开 evidence 分离，cleanup barrier 先于终态。
7. orchestrator 只接受 `TaskAudioRef`，不包含 B站、YouTube、小红书身份或凭据。

## 4. 内部多轮审查

第一轮发现 4 Major/2 Minor：sample03 hash 抄录错误、数组唯一性、逐样本延迟上限和 Draw.io 状态漂移，以及原型边界与进程启动体验风险。全部修订关闭。

第二轮攻击 12 类假绿：单 bin 补跑、5.2 拼接、静音 N/A、文本复制、8 进程并发、平均延迟、reviewer 复用、安装即 qualified、cleanup 假绿、门户污染、PASS 继承和声明扩大，均有确定性拒绝点。结论 Fatal=0/Major=0/Minor=3；三个 Minor 是只能通过真实实现验证的进程启动延迟、边界词质量和外部组织独立性。

## 5. 机器复算

```text
Schema Draft 2020-12 meta: PASS
candidate instance: PASS / 0 errors
synthetic FixedWindowRun: PASS / 0 errors
schema negative probes: 9/9 rejected
requirements / cases: 20 / 20
requirement tuple set: exact equality
acceptance IDs: FW01..FW20, 20/20
Draw.io: 8 pages / 113 vertices / 54 edges
Draw.io duplicate IDs / out-of-page / broken edge refs: 0 / 0 / 0
portal secret terms in candidate manifest: 0
git diff --check: PASS
```

Schema probes覆盖：少样本、14 秒窗口、错误音频格式、边界 gap、concurrency=8、空 chunk、cleanup 残留、RSS>8GiB、sample02 elapsed=14761ms。

## 6. 关键文件哈希

```text
ad5c9548490cd53064886aaed5653cb6c11d74b8de19481a280dabe4e6e85290  01-prd.md
45287cc2d1df7d107a16db5d4fa45f0e180673ac4b4785eeee71861a720266ed  02-architecture.md
956cf9e668055f7c8c467e6b0ae03c856532f6d70710302b308c3de40379c688  03-development-plan.md
eb74a9c3ac358a61a86affaea5bef7dee188cbdc25414759bcff13b3691bfeb2  04-acceptance-plan.md
aeb74b98625b1728f1362678b36c9c25ee3bcdb1f6622b49485b3e4237d31a43  v3-media-companion.md
35db79431a32967e5b8b6e705bf1d9593040f45e60c546ab0ca100471ac25ad4  v3-media-companion-gap.drawio
a819bb1401d2710f00cd9d717f37a3ba4d23822c4159df41fad98e74dedf421d  v3_asr_fixed_window_contracts.schema.json
877edbe549afb100004049d27b4b00218bf33fc27aac7e097493d277eee174ff  v3-asr-fixed-window-policy-registry.json
bfef1ace73df862acae98799ac758bd5a468542d43312562ec4f2d07ff1d4590  v3-asr-fixed-window-candidate-manifest.json
2c99e7089cdfca80c46f3a2e440801860db1f89e0b5b7bde6f09e5cb87385e0e  v3-asr-fixed-window-contract-fixtures.json
3097b0cb2a25b6096ffb586793741a1c3292166b466fbfdd1ca9a2835d68289d  v3-2-0b-fixed-window-adr.md
a47ad2330b5f95dcceebd269d52e7ff42048e08e8bdfedfd2ed33e1956c30476  contract-and-api-spec.md
808f781d866be7572a637c3dc0fdc761bbe5260a78b0c36b9e3dd2408188eca6  development-plan.md
1ed9787065959fea280f61da61df8e336396d3d8365ce05f745a39dd9ba6d7e3  acceptance-plan.md
20e3b84e84da81d68b9de498448cb76d94a3b516a750d490ec0445da27b26b9c  threat-model.md
```

## 7. 残余风险与外部审查要求

外部 reviewer 必须重点判断：

- 15 秒固定切片是否引入未被门禁覆盖的边界语义损失。
- 逐 chunk 原生进程能否在当前架构下实现，且是否需要在实现前先设计持久 worker。
- <=2x 延迟是否既能拒绝体验回退又不构成无依据承诺。
- Schema/registry/fixtures 是否足以拒绝重复 sample/chunk、跨 run 和 partial retry。
- 通用 `TaskAudioRef` 是否真正避免门户权限和 provider 耦合。
- cleanup、公开证据和人工 review 是否仍存在秘密/正文泄漏或分母缩小路径。

外部审查需给出 Fatal/Major/Minor、每项复现/影响/最小修复，并明确回答：`V3-2-0b-5.3 document candidate PASS/FAIL`。即使 PASS，也只能请求用户实施授权，不自动开始代码。

## 8. 结论

内部结论：Fatal=0、Major=0、Minor=3。当前文档完整覆盖实现实体、依赖方向、状态、失败语义、开发顺序、真实操作、固定分母和出门条件，没有偏离 V3 PRD 或把门户扩展误报为已支持。需要 Claude Code CLI 外部独立文档审查；在结果 Fatal=0/Major=0 和用户新授权之前，产品代码保持 NO-GO。
