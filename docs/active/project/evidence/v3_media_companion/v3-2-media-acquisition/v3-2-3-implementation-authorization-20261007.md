# V3-2-3 实施授权记录

日期：2026-10-07  
授权来源：当前用户会话  
授权范围：`V3-2-3 / 2-3-0..2-3-7`

## 1. 授权依据

- 用户已明确同意以 SenseVoice 作为 V3 转写基线，并要求继续下一阶段开发实现。
- 用户恢复自动化开发，要求按既有文档和门禁继续执行。
- 第二轮独立文档复审：`v3-2-3-resumption-independent-document-audit-round2-20261007.md`。
- 复审结论：`DOCUMENT CONDITIONAL GO`，Fatal=0、Major=0、Minor=2。
- 审计报告 SHA-256：`e710a8025b19aced8962f9700151685249642d3fa447afcd6578618de80dc69c`。

## 2. 允许范围

1. 按冻结开发计划实施 `2-3-0..2-3-7`。
2. 使用三个 Route B3 固定能力槽位创建一个全新真实 run。
3. 使用已授权的本地 B站 Cookie 私有文件完成真实 acquisition；Cookie 值不得进入公开证据。
4. 下载并重新校验冻结的 SenseVoiceSmall Q8、FSMN-VAD 和 native runtime 资产。
5. 实施 portal-neutral 的音频交接、转写服务、Runtime API、runner/verifier/sealer 和自动验收。

## 3. 禁止范围

- 不实施 V3-2-4、V3-3+、V4、PX-6 或 RKM。
- 不更换三个固定 URL、模型、revision、权重 hash 或 B3 预绑定故障。
- 不复用 B3 已清理音频、旧 transcript 或跨 run artifact。
- 不请求人类听写；人工 H01..H10 继续推迟至 V3-5。
- 不将 `development_baseline` 宣称为 `production_qualified`。

## 4. 子阶段门禁

每个子阶段必须先有开发/验收口径，完成后执行定向测试、真实证据检查和 PRD 规格检视。任何 Fatal/Major、真实分母不足、秘密泄漏、清理残留、覆盖率不可判定或资源越界均立即 `FAIL/REPLAN`。
