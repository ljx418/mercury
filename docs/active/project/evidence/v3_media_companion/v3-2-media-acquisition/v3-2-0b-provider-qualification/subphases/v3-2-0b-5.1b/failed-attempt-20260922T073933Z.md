# V3-2-0b-5.1b 公开路径泄漏失败记录

日期：2026-09-22。

候选 run `v3-2-0b-5.1b-20260922T073933Z` 的产品与 Chrome 检查为 16/16，但 `prerequisites.json` 保存了依赖警告中的 `/home/administrator/...`。B04-16 只扫描 repo root 和秘密关键字，漏掉通用 home/mount 路径，形成证据层假绿。

该路径不含 Cookie、token 或产品数据，但违反公开证据不得包含私有绝对路径的规则。run 已作废，不得作为 5.1b 出门依据。修复要求：日志生成时脱敏 home/drive，扫描器增加 `/home/`、`/mnt/`、`C:\\Users\\` 与 `C:/Users/`，随后全新完整重跑。
