# V3-2-0b-4 实施前审计

日期：2026-09-22

```text
V3-2-0b-4: GO
Fatal=0 / Major=0 / Minor=2
```

- 0b-2 已真实安装/self-test，0b-3 时间轴合同通过。
- 旧 E2E runner 明确使用 `page.route` 模拟安装，只可作 UI contract regression，不能作本阶段生产证据。
- 新 runner 必须使用隔离 Runtime/Chrome/profile 和官方真实下载，状态历史由 Runtime 提供。
- pending 安装与 production selection 继续分离。

Minor：M-1 网络速度可能延长 Chrome run，runner 必须使用确定性 timeout 并保留真实失败；M-2 Windows 本轮只展示并冻结资源，不在 Linux 冒充 Windows 安装。二者已进入 B04-04/B04-05 与边界说明，无 Fatal/Major。
