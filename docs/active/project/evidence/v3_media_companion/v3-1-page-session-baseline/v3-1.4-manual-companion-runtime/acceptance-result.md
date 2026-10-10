# V3-1.4 Manual Companion Runtime 验收结果

日期：2026-10-07。候选 run：`v3-1.4-20261007T144806Z`。

## 结论

`V3-1.4 LIMITED PASS`。A01..A14 均有实现或真实/自动化证据支撑；该结论只代表手动启动本机伴侣与自动短期会话闭环，不代表 V3、V3-2、PX-6 或 RKM 通过。

## 固定分母

| ID | 结果 | 证据 |
|---|---|---|
| A01 | PASS | installer 只写 extensionId/127.0.0.1/port；真实子进程仅监听 loopback |
| A02 | PASS | transport 负例与停止后真实 UI 均显示“本机伴侣未启动”，不显示连接成功 |
| A03 | PASS | 真实 Chrome 自动 bootstrap；UI 显示已连接及实例尾 8 位，无 token 输入 |
| A04 | PASS | 同 run 错扩展 Origin 返回 403/`V3_COMPANION_ORIGIN_MISMATCH` |
| A05 | PASS | session 签发的网页 Origin、无 Origin和错误 Origin负例 fail closed |
| A06 | PASS | credential/capture/permission 回归 41 passed；短期 session 不改变 channel/lease 合同 |
| A07 | PASS | Runtime 重启后 instance 从 `...6e92bc` 变为 `...e93f9b3`，页面自动重连 |
| A08 | PASS | broker 过期、撤销、错 Origin 单测通过；generation 中止逻辑回归通过 |
| A09 | PASS | 真实 UI 点击停止，两次 Runtime 均退出，状态转离线 |
| A10 | PASS | 文件锁单测拒绝第二实例，不改写配置 |
| A11 | PASS | 公开证据 2 文件/120,980 bytes，Bearer/Cookie/Authorization/高熵串 0 命中 |
| A12 | PASS | Runtime 567 passed；Frontend 308 passed；定向 15 passed；typecheck/build exit 0 |
| A13 | PASS | run 后 17861 无监听、无 `navia_runtime.companion` 进程、profile 清理完成 |
| A14 | PASS | PRD 复核仅声明“手动启动后自动连接”，V3 后续阶段仍未完成 |

## 真实证据

- 结果：`runs/v3-1.4-20261007T144806Z/public/result.json`，SHA-256 `f373075404baaf4a2765bc74cead0d17f825e1f2cd37abff67479d1dc5fd19fe`。
- 截图：`runs/v3-1.4-20261007T144806Z/public/companion-connected.png`，SHA-256 `f81c78fc9e27e80a1efa36ceb2f66b9f1fa9219f3391d6b674a752faa49b391b`。
- 失败 run：均为私有诊断，不参与通过分母，也未与成功 run 拼接。

## 实施期问题闭环

1. 旧 PermissionService 先检查 legacy master 开关，误拒短期 session：调整为先验证 broker session，再保留旧 master 兼容。
2. Chromium 扩展无请求体 GET 会省略 Origin：签发仍要求精确 Origin；后续请求仅允许“有效进程内 bearer + Origin 缺失”，任何存在但不匹配的 Origin 仍拒绝。
3. SIGTERM 正常退出时 Node `exitCode=null`、`signalCode=SIGTERM`：修正 E2E 进程终态判断，不改变产品门槛。
4. 首次截图缺实例摘要：UI 增加非秘密的 instance 尾 8 位，并补定向测试与重新采集。

## 2026-10-08 当前工作树再验证

本次不覆盖 2026-10-07 封存候选，使用同一当前 build 生成独立 run `v3-1.4-revalidation-20261008T030000Z`：

- Runtime companion 白盒：6/6 PASS。
- Frontend Runtime client / LocalRuntimeAccess：15/15 PASS。
- Credential transport / trusted capture 前端回归：65/65 PASS。
- Runtime companion / credential / capture 回归：55/55 PASS。
- TypeScript typecheck 与 E2E build：exit 0 / exit 0。
- 真实 Chrome + 两次真实 Runtime：7/7 PASS；实例由 `...dce78a7` 变为 `...9485272`。
- 公开证据：2 文件 / 121,067 bytes；Bearer/Cookie/Authorization 扫描 0 命中。
- 清理：端口 17861 无监听，0 `navia_runtime.companion` 进程，本次隔离 profile 已删除。

新证据：

- `runs/v3-1.4-revalidation-20261008T030000Z/public/result.json`，SHA-256 `25c2b7368e94f55a9ca2dceed8c9b0b1ba31cbfdd4783568e9b84fde815c410e`。
- `runs/v3-1.4-revalidation-20261008T030000Z/public/companion-connected.png`，SHA-256 `a2e1cef04e904cb9b3fbeca369aecc25cb79ccfc307608d22a34ef41ea6740c9`。

结论保持 `V3-1.4 LIMITED PASS`。截图中仍可见历史 Knowledge Mock 与 Agent/Debug 导航，这些不计入 V3-1.4 通过能力，必须在既定 V3-4.1/V3-5 阶段分别由真实 Know 投影与生产导航收敛关闭。
