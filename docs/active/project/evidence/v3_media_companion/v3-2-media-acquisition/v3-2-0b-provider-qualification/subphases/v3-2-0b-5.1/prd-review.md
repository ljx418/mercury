# V3-2-0b-5.1 PRD 规格检视

日期：2026-09-22。结论：生产质量目标未达成，无缩分母。

PRD 冻结每个样本 8 bin、2 reviewer，并要求每样本至少 `15/16` 个 candidate meaning-preserved 判断。sample 03 有一个非静音 bin 完全无候选文本；两位 reviewer 对该 bin 均无法将候选判为 meaning preserved，因此该样本理论上限为 `14/16`。

继续生成人工页面不会改变理论上限；删除该 bin、称其静音、改用相邻文本、只要求总体 transcript 非空或降低 `15/16` 都会造成虚假验收。故在人工盲评前机器 fail closed 符合 PRD。

V3-2-0/A06、V3-2-0b、V3-2-1..7 均不得升级。Tiny 继续是最低资源 fallback-only；Small 保留失败基线；Paraformer 保持不可选择。
