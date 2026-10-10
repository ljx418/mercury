# V3-1.4 当前工作树再验证审计

日期：2026-10-08  
对象：当前工作树的 Manual Companion Runtime、扩展连接组件及其既有合同。  
候选 run：`v3-1.4-revalidation-20261008T030000Z`。

## 1. 决定

`V3-1.4 LIMITED PASS` 保持。Fatal=0，Major=0，Minor=2。

该决定只证明手动启动本机伴侣、自动短期安全会话、显式停止与重启恢复；不证明 V3-3+、Chat/Know 或 V3 总体通过。

## 2. 新鲜验证

| 门槛 | 当前结果 |
|---|---|
| Companion Runtime 白盒 | 6/6 PASS |
| Runtime client / LocalRuntimeAccess | 15/15 PASS |
| Credential/capture 前端回归 | 65/65 PASS |
| Runtime companion/credential/capture 回归 | 55/55 PASS |
| TypeScript typecheck | exit 0 |
| E2E build | exit 0 |
| 真实 Chrome/Runtime | 7/7 PASS |
| 公开证据秘密扫描 | 2 文件、121,067 bytes、0 hit |
| 清理 | 17861 无监听、伴侣进程 0、本次 profile 已删除 |

真实流程覆盖：错扩展 Origin 拒绝、自动 bootstrap、刷新重连、界面显式停止、Runtime 重启后实例变化、最终清理、配置不含秘密。

## 3. 证据绑定

- `runs/v3-1.4-revalidation-20261008T030000Z/public/result.json`  
  SHA-256：`25c2b7368e94f55a9ca2dceed8c9b0b1ba31cbfdd4783568e9b84fde815c410e`
- `runs/v3-1.4-revalidation-20261008T030000Z/public/companion-connected.png`  
  SHA-256：`a2e1cef04e904cb9b3fbeca369aecc25cb79ccfc307608d22a34ef41ea6740c9`

原 `v3-1.4-20261007T144806Z` 保持字节不变；本次没有跨 run 拼接通过分母。

## 4. PRD 规格检视

- 一次配置：配置只含 extensionId、loopback host 与 port。
- 日常启动：用户显式点击桌面入口；扩展不自动拉起本机进程。
- 自动会话：打开扩展后无需粘贴 token，自动取得进程级短期 bearer。
- 生命周期：用户可从界面断开或停止；Runtime 重启后实例与会话均更换。
- 原计划：V3-1.1..1.3 与 V3-2..V3-7 均未删除、替换或缩小。

## 5. Minor

- M-1：当前桌面入口仍是安装脚本生成的 launcher，不是签名安装包；正式分发包装仍须在 V3-7 前冻结。
- M-2：当前截图仍出现 Knowledge Mock 与 Agent/Debug 历史导航；它们不属于 V3-1.4 范围，分别由 V3-4.1 与 V3-5 的既定增量门槛关闭。

## 6. 下一门禁

V3-1.4 不再阻塞后续。继续使用已取得 `V3-2 LIMITED PASS` 的封存生产基线推进 V3-3；V3-3 的真实云端 VLM 帧上传仍必须获得用户对指定 provider/model/留存边界的明确高风险授权。
