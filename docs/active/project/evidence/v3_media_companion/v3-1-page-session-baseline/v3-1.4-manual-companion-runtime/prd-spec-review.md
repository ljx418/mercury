# V3-1.4 PRD 规格检视

日期：2026-10-07。

## 对齐结论

- 符合目标体验：用户一次配置并手动启动桌面入口；日常打开 Navia 后自动建立安全会话，不再粘贴 token。
- 符合安全边界：Runtime 仅 loopback；session 签发固定扩展 Origin；bearer 仅内存、短 TTL、可撤销，Runtime 重启失效。
- 符合原 V3 计划：这是 V3-1.3 与 V3-2.4a 之间的增量可用性阶段，没有删除 12 页样本、H01..H10 或 V3-2..V3-7。
- 无体验倒退：旧 master token仍兼容；V3-1.3 one-shot channel、60 秒 lease 和证据零秘密约束未弱化。

## 明确未完成

- 不声明浏览器能自动启动桌面 Runtime；用户仍需点击本机伴侣图标。
- Know 中现存 mock/data_service 状态不属于 V3-1.4 的修复范围。
- 视频采集、ASR、视觉证据、图文大纲、任务恢复、产品级人类验收仍按原 V3-2.4a..V3-7 顺序推进。
- Agent 保持远期规划，不进入本阶段。

## 风险判断

Fatal 0 / Major 0。残余风险是同账户恶意本机进程可伪造 HTTP Origin；若未来威胁边界要求抵抗该攻击，应在不改变上层 session API 的前提下升级 Native Messaging challenge broker。

