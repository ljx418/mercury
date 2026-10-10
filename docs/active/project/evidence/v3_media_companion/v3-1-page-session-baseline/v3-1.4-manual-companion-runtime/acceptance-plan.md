# V3-1.4 Manual Companion Runtime 验收计划

日期：2026-10-07。所有门槛均不可 N/A，不得用 fixture 替代真实进程/Chrome 正例。

| ID | 用户场景与操作 | 必须结果 |
|---|---|---|
| A01 | 用户执行一次配置并点击桌面启动入口 | 配置只含 extensionId/host/port；Runtime 仅监听 127.0.0.1 |
| A02 | Runtime 未启动时打开 Navia | 3 秒内显示离线和“启动本机伴侣”指引，不显示已连接 |
| A03 | 用户手动启动 Runtime 后打开 Navia | 无需输入 token，自动建立短期安全会话并显示实例 ID 摘要 |
| A04 | 非配置扩展 Origin 请求 session | 403 + `V3_COMPANION_ORIGIN_MISMATCH`，不签发任何 token |
| A05 | 网页 Origin、无 Origin 与伪造空 Origin 请求 session | 全部 fail closed；健康检查之外无特权能力 |
| A06 | 使用短期会话调用媒体 credential channel/capture grant | 与 V3-1.3 相同 exact-Origin 和授权结果，主 secret 不出 Runtime |
| A07 | Runtime 重启后使用旧会话 | 401，旧 token 不可复用；扩展自动从新实例重新 bootstrap |
| A08 | 会话超过 TTL 或主动断开 | 旧请求中止，后续请求为 expired/revoked，不产生 UI 假成功 |
| A09 | 用户在 Settings 点击停止 | 响应确认后进程退出，界面转离线，媒体临时能力清零 |
| A10 | 重复点击桌面入口 | 单实例锁拒绝第二实例，不破坏现有会话与数据库 |
| A11 | 扫描 storage、数据库、日志、截图、公开 tar | bearer/master secret/Cookie/Authorization 原文 0 命中 |
| A12 | 运行 Runtime、Frontend、typecheck、build 与 V3-1.3 回归 | 全部 exit 0；V3-1.3 固定门槛不退化 |
| A13 | 关闭 Runtime 后检查端口、PID、临时目录 | 无监听残留、无子进程、无临时会话文件 |
| A14 | PRD 规格检视 | 只声明“显式启动后自动连接”；不得声明浏览器自动启动或 V3 完成 |

## 防假绿

- 不得向扩展注入测试 token后宣称自动 bootstrap。
- 不得用普通 HTTP client 代替 Chrome Origin 正例。
- 不得把 `/v1/health` 成功等同于安全会话成功。
- 重启、过期、错 Origin、重复实例和停止必须来自同一 build 的真实负例。
- 真实 E2E 失败即回到计划，不降低 TTL、Origin、秘密扫描或清理门槛。

