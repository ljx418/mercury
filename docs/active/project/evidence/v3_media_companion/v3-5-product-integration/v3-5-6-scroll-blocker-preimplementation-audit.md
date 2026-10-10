# V3-5-6 Chat / Know 滚动阻塞实施前审计

日期：2026-10-09。决定：`GO FOR SCROLL FIX ONLY`。

- Fatal：0。
- Major：1，Chat/Know 超长内容不可达，阻塞 H01..H10；根因已定位到缺失滚动父容器。
- 新增 Major：0。
- 风险控制：不把 `body` 改为全页滚动，不移动工具栏；不删除消息局部滚动；用真实 wheel 后的 `scrollTop` 证明而非只检查 `overflow:auto`。

