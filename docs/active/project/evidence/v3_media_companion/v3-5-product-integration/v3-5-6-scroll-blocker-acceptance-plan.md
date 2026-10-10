# V3-5-6 Chat / Know 滚动阻塞验收计划

日期：2026-10-09。

- Chat：`scrollHeight>clientHeight` 时，内容卡片上滚轮可令 `.chat-stage.scrollTop>0`。
- Know：内容上滚轮可令 `.knowledge-view-panel.scrollTop>0`。
- 两面都能通过键盘继续纵向滚动；顶部工具栏不随内容丢失。
- 360/420 宽无横向根溢出，composer、授权卡和 Know 操作不被裁切。
- 现有 Frontend 目标测试、typecheck、build:e2e 通过。
- 真实人类 H01..H10 仍 pending；修复不能自动把任何 H 项写为 PASS。

