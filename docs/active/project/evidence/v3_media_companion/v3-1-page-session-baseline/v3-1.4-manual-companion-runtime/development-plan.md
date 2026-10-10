# V3-1.4 Manual Companion Runtime 开发计划

日期：2026-10-07  
状态：`IMPLEMENTATION AUTHORIZED BY ACTIVE V3 GOAL / PREIMPLEMENTATION AUDIT REQUIRED`

## 1. 目标与继承边界

本阶段在已通过的 V3-1.3 Browser-to-Runtime credential transport 上增加“手动启动、自动建立安全会话、可见状态、显式停止”的本机伴侣能力。它不替换 V3-1.3，不改变媒体 Cookie 的一次性 channel、60 秒 lease、exact-Origin 和公开证据零秘密约束。

用户首次配置一次扩展 ID；此后从桌面图标启动 Runtime，打开 Navia 后自动取得当前进程的短期会话。浏览器不得自动启动本机进程。Runtime 退出或重启后，旧会话必须失效，扩展只可从新进程重新引导。

## 2. 架构决定

采用 `loopback session broker`：

1. `navia_runtime.companion` 读取只含 `extensionId/host/port` 的本地配置。
2. 每次进程启动生成新的 256-bit master secret 和 `runtimeInstanceId`，只存在进程内存。
3. Runtime 只绑定 `127.0.0.1`；`POST /v1/companion/sessions` 只接受配置中的精确 `chrome-extension://<id>` Origin。
4. broker 签发短期、可撤销、绑定 Origin 与 runtime instance 的 bearer。现有受保护端点同时接受当前 master token或该短期 bearer。
5. 扩展 bearer 只保存在扩展页面内存；不得进入 URL、Chrome storage、日志、截图、公开 evidence 或 Runtime 数据库。
6. `POST /v1/companion/stop` 仅接受有效短期会话，并在响应发出后终止当前 Runtime。

不选 URI Handler：浏览器可能重复弹外部协议确认。暂不选 Native Messaging：安装、升级和多浏览器 host manifest 成本超出当前原型阶段；若 loopback threat model 失败，再通过 ADR 升级而不改上层 API。

## 3. 实施工作包

| 子阶段 | 实施内容 | 主要文件 | 出门证据 |
|---|---|---|---|
| V3-1.4-0 | 冻结 session/status/stop 合同与错误码 | contracts + fixtures | Schema 与正负例 |
| V3-1.4-1 | `CompanionSessionBroker`、TTL、撤销、实例绑定 | `modules/companion/` | 白盒测试 |
| V3-1.4-2 | Runtime API 与现有媒体 authenticator 接入 | `app.py` | API 测试 |
| V3-1.4-3 | 手动 launcher、配置权限与单实例锁 | `companion.py`、scripts | 启动/重复启动/停止冒烟 |
| V3-1.4-4 | 扩展自动 bootstrap、失效重连 | `runtimeClient.ts` | Vitest |
| V3-1.4-5 | Settings/连接卡移除手工 token 主路径 | `LocalRuntimeAccess.tsx` | 组件测试 |
| V3-1.4-6 | 真实 Runtime + Chrome 流程 | E2E runner | 同 run 证据 |
| V3-1.4-7 | PRD 检视、秘密扫描、清理与出门审计 | evidence | Fatal=0/Major=0 |

## 4. 固定错误码

- `V3_COMPANION_NOT_CONFIGURED`
- `V3_COMPANION_ORIGIN_MISMATCH`
- `V3_COMPANION_SESSION_REQUIRED`
- `V3_COMPANION_SESSION_EXPIRED`
- `V3_COMPANION_SESSION_REVOKED`
- `V3_COMPANION_INSTANCE_CHANGED`
- `V3_COMPANION_ALREADY_RUNNING`
- `V3_COMPANION_STOP_REJECTED`

## 5. 非目标

- 不自动启动 Runtime，不把生命周期绑定到浏览器。
- 不持久化 bearer，不把 Cookie/session secret 交给桌面脚本。
- 不实现自动更新器、系统托盘、远程监听或公网服务。
- 不重做 V3-1.1..1.3，不进入 V3-2.4a 之后的媒体实现。

