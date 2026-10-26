# WP-A 独立文档审查与门禁结论

日期：2026-10-19  
最终结论：`DOCUMENT PASS / IMPLEMENTATION MAY START`  
严重度：`Fatal 0 / Major 0 / Minor 0`

## 审查轨迹

1. 隔离 Codex 首轮只读审查发现 5 Major：实际资源 generation、取消/重启、API 合同与负例、下载安全参数、A01-A24 可复算性。
2. 主会话按一个纠偏包补齐内容寻址版本、task lease、三路径 snapshot、提交竞争、重启恢复、API envelope/HTTP、精确下载限制和逐项 24 用例。
3. 隔离 Codex 复审判定 M1/M4/M5 CLOSED；M2 尚有原型 old-ready 文案冲突，M3 尚缺四类 semantic negative；另有两个命令/门禁措辞 Minor。
4. 定向修订新增 schema 条件和 semantic verifier，原型拆成 blocked failure 与 old-ready nonblocking failure，命令改为子 shell，Claude 提示词改为条件式。
5. 隔离 Codex 仅复核上述遗留项，返回 `FOCUSED CLOSURE PASS`；未发起第三次完整项目审计。

## 最终复核

- M1 generation 与实际资源：CLOSED。
- M2 取消/重启/old-ready：CLOSED。
- M3 API/状态关系/负例：CLOSED。
- M4 来源、长度、超时、空间、路径、自检：CLOSED。
- M5 A01-A24、A23/A24 oracle、固定命令：CLOSED。
- WP-B 本地文件导入、WP-C tabCapture：未混入。
- 08 verifier：`42/42`, exit 0。
- Archify：showcase deterministic validation `9/9`；artifact SHA-256 `e89636c01837435f4121e8b1ddfef8c3bacc5fe410ca88a5ab8621b8b9e8ce51`。WSL 无 Chrome，automated browser visual-check 明确 `skipped`，不冒充视觉通过；原型需人类按 HTML 继续审阅。

## 门限

允许 ClaudeCode 只实施 WP-A，并在 `WP-A AWAITING CODEX CHECKPOINT` 停止。不得进入 WP-B/WP-C，不得宣布 WP-A 或 V3 PASS。实现完成后只进行一次集中 Codex checkpoint；除非公共合同、安全边界或真实数据有效性发生新变化，不重做本文档审查。
