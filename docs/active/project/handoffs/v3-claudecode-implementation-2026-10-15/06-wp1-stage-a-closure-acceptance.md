# WP1：Stage A 完整收口

状态：`BLOCKED BY WP0`。目标不是重做历史 NJ，而是把新 relay 正向日常路径与既有固定负向旅程绑定成完整 Stage A 候选。

## 固定分母

- 正向日常路径：`BV1pohR6rEEh`，fresh Runtime/database/profile/task，可信 capture 到 ready/degraded，Side Panel/Workspace 同权威状态并停止 busy。
- NJ-01..NJ-10：固定 `BV1hMpE6FEXG`，定义与原 `stage-a-negative-journey-development-and-acceptance-plan.md` 一致。
- NJ-09：四状态 x 360/420/768/1280；连续三次 fresh isolated repeat，保留失败 run。
- 原生首次权限弹窗若需可见 UIAutomation，先通知用户；预授权 temporary extension 不能冒充原生弹窗测试。

## 必须结果

1. 转写完成立即展示明确标记的转写预览，不冒充全片概览。
2. 正向终态、计时、最近进展、呼吸灯和内容发布一致；终态后不持续 busy。
3. disconnect 隐藏过期内容，reconnect 重读同 task/revision。
4. cancel 跨 Side Panel/Workspace 收敛且 late response 不能复活。
5. route drift、invalid chapter、evidence return、dialog focus、seek/missing tab 均按 NJ 合同通过。
6. policy switch 保留隔离历史，显式切换新授权；旧证据不自动附着。
7. secret/path 0；owned process/profile/task/temp 归零；全程静音。

## 出门

ClaudeCode生成完整 Stage A candidate、NJ mapping、positive run、verification、PRD review、handoff 后停止。Codex只读复算固定分母；Fatal=0/Major=0 且正向路径与 NJ 同 build 后，才允许 WP2。`LIMITED PASS for bounded NJ` 不足以放行。
