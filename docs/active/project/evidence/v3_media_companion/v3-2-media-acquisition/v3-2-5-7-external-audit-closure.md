# V3-2-5..7 外部文档审查 Minor 闭环

日期：2026-10-06。来源：本轮独立只读审查 `Fatal=0 / Major=0 / Minor=2`。

## M-1 审计包测试路径

问题：测试原先固定 `parents[3]`，从审计包副本直接运行时可能解析到错误根目录。

修复：`find_repo_root()` 从当前文件逐级查找权威 Schema；若不存在仓库根，则回退同目录的 `15-transcript-exit.schema.json` 和 `16-positive-fixture.json`。权威测试路径和审计包平铺副本均可执行。

状态：`CLOSED`。

## M-2 正例重复 hash

问题：正例使用重复的 64 字符 digest，虽为合法 shape fixture，但可能被误解为真实运行证据。

修复：测试模块文档明确标注 fixture 仅证明 shape/denominator，生产 hash 必须来自 sealed runtime run。开发、验收和 ExitCandidate 规则继续禁止 fixture 计 production pass；没有放宽 SHA-256 Schema。

状态：`CLOSED`。

## 决定

外审 Fatal=0/Major=0 保持。两项 Minor 闭环后仍只允许 `DOCUMENT PASS / IMPLEMENTATION BLOCKED BY PREDECESSOR`；不改变 V3-2-2..4 前序状态，不放行 V3-2-5 代码，不执行 H01..H10。
