# V2-PX-4 验收计划

日期：2026-09-08

## 硬门槛

- Sources：真实 Runtime 列表、详情和 stable ID；空/加载/错误状态可见。
- Ask：真实问题、answer status 和 EvidenceRef；无 evidence 不得显示 source-backed。
- Trace：展示 Runtime EvidenceRef locator/text/sourceId，不自行升级 located。
- Graph：真实 nodes/edges/status；节点选择只影响视图。
- Permission：用户输入显式 grant，路径按 Runtime 返回脱敏；revoke 后显示 revoked，不声称删除 source。
- Forget：用户二次确认；成功必须显示 Library/Ask/Graph/Trace 四面 verification；原 detail direct route 返回 SOURCE_NOT_FOUND。
- Status：Runtime/Adapter/data_service/source 四域分离。
- UX：1280/768 无横向溢出、关键操作键盘可达、dialog Escape/取消/确认和焦点返回通过。
- 回归：frontend、typecheck、build、Runtime API、PX-0.2 validator 和 PX-3 lifecycle E2E 通过。

真实验收使用当前 PRD source，并额外创建可被 Forget 的独立真实 source，避免删除共享基线样本。

任一仅隐藏 UI、伪造 answer/evidence/graph、未经确认 Forget、或使用原型数据冒充 Runtime 的情况为 Major 并打回。
