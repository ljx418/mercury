# V3-5-0 PRD 规格检视

日期：2026-10-08。结论：`PASS / no Fatal / no Major`。

## 规格映射

| PRD 目标 | 当前结果 | 判定 |
|---|---|---|
| Chat、Know/Workspace 分权且不互相改写路由语义 | Media 使用独立 router，Knowledge union 未扩展 | 符合 |
| Runtime 是任务事实权威 | list/get 均由安全会话访问 Runtime；reload 重读 | 符合 |
| 用户看见真实状态而不是 mock | 空数据库显示空状态；失败显示恢复页 | 符合 |
| V3 不提前承诺 V4 知识导入 | UI 明示“知识导入将在 V4 提供”，task 固定 `deferred_to_v4` | 符合 |
| 旧入口可迁移但不得形成双权威 | legacy route 使用 replace 到 canonical overview | 符合 |
| 已有 Knowledge 体验不回退 | 真实 Chrome 同轮验证 Knowledge shell 和会话 | 符合 |

## 偏移与假绿检查

- 未扩大 V3-5-0 到 Ask、导出、播放器控制或任务执行。
- 未用 fixture 或封存 run 填充产品任务列表。
- 未因旧 Runtime 404 而放宽验收；重启最新实现后重新执行完整浏览器路径。
- 没有修改 V3-4 outline 算法、Knowledge route contract 或 Cookie/视觉凭据边界。

## 已知次级风险

1. 用户长期不重启 Companion 时，新路由不会热加载；当前桌面启动方式已能通过重启恢复。后续安装/升级阶段需提供版本提示。
2. 当前真实数据库为空，只证明空态和路由集成；ready/degraded/blocked 产品状态将在 V3-5-1 fresh run 覆盖。
3. Ask、seek、export 仍明确为后续子阶段，不能纳入本结论。

