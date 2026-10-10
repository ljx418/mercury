# V3-5-6 Chat / Know 滚动阻塞内部出门审计

日期：2026-10-09。决定：`SCROLL BLOCKER CLOSED / V3-5 HUMAN BUNDLE REFRESH REQUIRED`。

## 审计结论

- Fatal：0。
- Major：0。实施前的 1 项 Major（Chat / Know 超长内容不可达）已由双视口真实 wheel 与独立键盘断言关闭。
- Minor：0。旧人工验收 bundle 已由新的完整 V3-5 fresh run 替换；新 bundle 重新绑定 build、截图与证据哈希。

## 防假绿核对

- 未只检查 `overflow:auto`，而是要求 `scrollHeight>clientHeight` 且真实 wheel 后 `scrollTop` 增长。
- PageDown 在 `scrollTop=0` 后独立执行，避免 wheel 已到底造成假判。
- 360 与 420 两个宽度均验证无根横向溢出。
- 全量 340 项前端测试、typecheck、build:e2e 均通过。
- 未修改旧 sealed evidence，也未把本地回归扩大为 H01..H10 或 V3-5 PASS。

## 下一门槛

1. 人类仅基于新 bundle 执行 H01..H10。
2. 旧 bundle 不再具有签署资格；不得复用旧 submission。

