# V3-5-5 证据路由焦点 Major 闭环

日期：2026-10-09。初始审计：Fatal=0 / Major=1 / Minor=0。修订决定：`GO AFTER TEST`。

## Major

`MediaEvidenceDrawer` 在当前实现中是 canonical evidence route，可 direct-open，但从 Outline/Ask 等入口打开后没有 Escape 返回，也没有把焦点恢复到原触发器。它满足 V3-5-4 鼠标跳转和证据展示，却不满足 V3-5-5 键盘/焦点门槛。

## 最小修复

1. evidence 链接点击前仅在 `sessionStorage` 保存 return hash 与稳定 trigger id，不保存证据正文。
2. evidence route 监听 Escape；存在同 task return binding 时返回来源 route。direct-open 没有 binding 时 Escape 不伪造历史。
3. 来源 route 恢复完成后查找对应 trigger 并 focus；无对应元素时 fail-closed，不把 body focus 计为通过。
4. 增加组件测试：点击证据 -> evidence route -> Escape -> 原 route -> 原链接恢复焦点；direct-open 不错误跳转。

修复不改变 Runtime、evidence、seek 或 public API 合同。测试通过后 Major 关闭，方可启动 fresh real Chrome。
