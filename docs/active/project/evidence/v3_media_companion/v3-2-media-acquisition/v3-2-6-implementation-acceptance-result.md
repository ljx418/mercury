# V3-2-6 故障与清理实施验收结果

日期：2026-10-08。决定：`V3-2-6 LIMITED PASS`。本结论只覆盖 F01..F14、清理与故障 UI，不代表 V3-2 或 V3 通过。

## 1. 权威输入

- FaultMatrix run：`v3-2-6-faults-20261008T110000Z`。
- FaultMatrix SHA-256：`596f5c45162fad31a03b79362d4be194972a062b6342f3ca9046d4c310d77352`。
- verifier SHA-256：`52a8da9dd95da9d6bf36f4b44ac7bb786dab78e63aaa2bf75060ff28579cad43`。
- 真实 Chrome 故障 UI run：`v3-2-6-ui-20261008T153000Z`。
- UI result SHA-256：`adccc3537b64236f0b5995c2f99da3956cbd8a11a4955a3db9f7e06662d00209`。

先前失败 run 均有 `FAILED.md`，不参与拼接或验收。

## 2. F01..F14

| ID | 边界 | 结果 |
|---|---|---|
| F01 | 本地 HTTP downloader 403 | failed；唯一终态；零残留 |
| F02 | 本地 HTTP downloader timeout | failed；唯一终态；零残留 |
| F03 | 重定向到私网地址 | blocked；未跟随私网 redirect |
| F04 | TaskArtifactSandbox 配额 | failed；超额写入被拒绝 |
| F05 | POSIX 只读文件 | failed；真实写入被 OS 拒绝 |
| F06 | `RLIMIT_FSIZE` 磁盘满等价边界 | failed；子进程非零退出 |
| F07 | ffmpeg 进程非零退出 | failed；exit=7 |
| F08 | ASR 进程非零退出 | failed；exit=8 |
| F09 | Runtime HTTP 中途断连 | failed；不接受 partial response |
| F10 | capture socket 丢失 | failed；closed peer 拒绝写入 |
| F11 | 真实 CredentialLeaseStore 到期 | blocked；原始凭据已清空 |
| F12 | 真实 CaptureGrant 撤销 | cancelled；旧 ticket 不可消费 |
| F13 | 两个并发取消 | cancelled；单飞 cleanup；两调用同一终态 |
| F14 | orphan child + owner-root restart recovery | failed；child 回收；仅 owner root 删除 |

每项均为独立 task，`terminalCount=1`、`postTerminalWriteCount=0`、`residualCount=0`、`secretHitCount=0`。verifier 12/12。

## 3. A01..A12

| ID | 结果 | 证据 |
|---|---|---|
| A01 | PASS | Schema meta/instance 与 21 项合同负例通过 |
| A02 | PASS | F01..F06 独立真实边界 receipts |
| A03 | PASS | F07/F08/F14 子进程回收和 owner-root 隔离 |
| A04 | PASS | F09/F10 真实 HTTP/socket 断开 |
| A05 | PASS | F11/F12 真实 lease/grant 生命周期 |
| A06 | PASS | F13 暴露并修复 coordinator 双 cleanup 竞态 |
| A07 | PASS | 14/14 residual=0 |
| A08 | PASS | restart recovery 保留 unrelated `user-data` |
| A09 | PASS | fault-support 只由 scripts/tests 导入；生产路由/UI 无 selector |
| A10 | PASS | 真实 B站页 + Chrome + Runtime；双容器同 task 显示 `V3_MEDIA_LEASE_REQUIRED`；无假成功；Axe 0/0 |
| A11 | PASS | Runtime 576；Frontend 46 files/313；typecheck/build PASS |
| A12 | PASS | PRD/隐私/假绿审计完成；公开证据无 token/Cookie/私有路径 |

## 4. 实际缺陷修复

F13 首轮真实运行发现 `MediaAcquisitionCoordinator.cancel()` 的并发 cleanup 竞态。修复引入每 task `Event` 单飞屏障：第二个 cancel/complete 等待首个清理终态，不再重复删除 owner manifest。新增并发回归证明 cleanup hook 只执行一次、两个 cancel 均返回同一 cancelled 终态。

## 5. 回归说明

前端第一次与 Runtime/build 并行执行时出现 Vitest worker 启动超时；虽然当次 45 files/308 tests 通过，但该结果不计门禁。资源释放后单独重跑得到 46 files/313 tests、0 unhandled error，作为权威结果。
