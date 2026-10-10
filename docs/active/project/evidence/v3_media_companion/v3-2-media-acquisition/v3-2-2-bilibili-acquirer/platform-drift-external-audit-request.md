# V3-2-2 Revision 3 Amendment 1 外部文档审查请求

日期：2026-10-06。审查性质：只读独立文档与合同审查。

## 审查背景

用户更新的授权 Cookie 已通过 B站 server validation。随后真实 Chrome 发现冻结样本发生平台漂移：锚点与一个旧 ASR 候选出现 API 字幕项。候选不得继续生成 productionReady registry，现提交 Amendment 1。

## 固定问题

1. 锚点保留但由 ASR 改为 subtitle，是否与当前真实平台事实、PRD 用户目标和 Revision 3 边界一致？
2. 是否仍严格保持 12 个唯一 URL 与 `6+3+1+1+1`，没有缩小分母或跨 run 拼接？
3. 三个 ASR 候选是否有真实发现证据，且第三个短样本是否符合低资源目标？
4. 字幕分类是否以 API `subtitleItems` 为准；ASR 是否拒绝任一新增字幕？
5. raw probe 的 view/player response hash 字段是否真实映射并 fail closed，是否仍有 `null` 派生 hash 假绿？
6. 当前是否只允许执行全新单 run 12 页 probe，而不允许进入 acquirer、ASR 或后续实现？
7. Cookie、profile、原始 API body 和私有路径是否保持在公开审计边界之外？

## 要求输出

给出 Fatal/Major/Minor；逐项回答 7 个问题；明确 `AMENDMENT 1 DOCUMENT PASS/FAIL`，以及是否允许全新单 run 12 页授权 probe。不得把文档通过扩大为 V3-2-2 implementation PASS。
