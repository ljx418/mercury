# V3-5-5 自动 UI 与可访问性开发计划

日期：2026-10-09。状态：`IMPLEMENTATION CANDIDATE`。

## 目标

在全新真实 B站 production task 上，对 V3-5 成品执行双容器四视口自动验收，不新增业务能力。通过后只允许进入 V3-5-6 人工验收包生成。

## 实施范围

1. 扩展 `v3-acquisition-orchestration-e2e.mjs`，增加隔离的 `V3-5-5` 模式；沿用完整真实 pipeline，但创建新的 task/DB/profile/evidence root。
2. Side Panel 在 360x900、420x900 检查身份、任务状态、快速摘要/打开 Workspace 主路径；Workspace 在 768x900、1280x900 检查 Overview、Outline、Evidence、Ask、Export 的可操作性。
3. 每个视口记录实际 viewport、document/client/scroll width、根溢出、Axe serious/critical 和截图 SHA-256；截图只捕获扩展产品面，不捕获 B站账户区域。
4. 键盘至少覆盖 Side Panel 主按钮、Workspace tab/route、Evidence 打开与 Escape 焦点返回、Ask 输入/提交、Export 操作；同时检查 `prefers-reduced-motion` 不破坏操作。
5. 自动产物仅保留最终验收截图及去敏结构结果；数据库、日志、媒体、帧和过程截图在摘要后删除。

## 非目标

- 不修改 Ask、seek、export、TaskStore 或 portal 合同。
- 不把 Axe 0/0 等同于人工可用性，不自动签署 H01..H10。
- 不使用历史截图、V3-5-4 task 或概念原型作为本轮产品证据。

## 顺序

`5-5-0 runner/schema -> 5-5-1 fresh task -> 5-5-2 四视口 -> 5-5-3 Axe -> 5-5-4 keyboard/focus -> 5-5-5 screenshot metadata -> 5-5-6 PRD review -> 5-5-7 internal exit`。
