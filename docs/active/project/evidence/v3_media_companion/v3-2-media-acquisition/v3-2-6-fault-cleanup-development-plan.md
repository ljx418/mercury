# V3-2-6 故障、清理与回归开发计划

日期：2026-10-06。状态：`V3-2-6 LIMITED PASS (2026-10-08)`。权威 FaultMatrix run 为 `v3-2-6-faults-20261008T110000Z`，权威 Chrome UI run 为 `v3-2-6-ui-20261008T153000Z`。

## 1. 目标

用真实 Runtime/Chrome 边界上的可控故障证明每个任务只有一个终态、终态后零写入、Cookie/媒体/音频/capture/子进程零残留。故障注入只替换边界结果，不伪造成功媒体或 transcript。

## 2. 工具实体

| 实体 | 目标路径 | 责任 |
|---|---|---|
| `v3-media-fault-runner.mjs` | `apps/chrome-extension/e2e/` | 创建全新 task/profile，驱动真实 Chrome 操作和浏览器故障 |
| `v3-media-runtime-faults.py` | `services/local-runtime/scripts/` | 受控 downloader/ffmpeg/ASR/disk/socket/process 故障 |
| `v3-media-fault-verifier.py` | `services/local-runtime/scripts/` | 独立复算终态、后续写、清理和 secret scan |
| `FaultObservationRecorder` | acquisition test-support 边界 | 记录故障开始/结束与 hash；生产构建默认关闭 |

注入接口只接受闭集 `faultClass`，仅在 `NAVIA_V3_FAULT_PROFILE` 指向签名测试 profile 且 isolated task root 时启用；生产 API、Extension message 和用户输入均不能选择故障。

## 3. 固定故障

`F01..F14`：downloader 403、timeout、私网重定向、配额、只读磁盘、磁盘满、ffmpeg exit、ASR exit、Runtime 断连、capture socket 丢失、lease 到期、授权撤销、取消竞态、orphan process。每项使用独立 taskId 和独立 artifact root。

## 4. 实施顺序

| 子阶段 | 内容 | 出门条件 |
|---|---|---|
| `2-6-0` | 冻结 FaultMatrix Schema、F01..F14 和 test-only 边界 | 合同负例通过；生产入口不可达 |
| `2-6-1` | downloader/network/quota/disk 故障 | F01..F06 通过 |
| `2-6-2` | ffmpeg/ASR/native process 故障 | F07/F08/F14 通过 |
| `2-6-3` | Runtime/capture 断连 | F09/F10 通过 |
| `2-6-4` | lease/撤销/取消竞态 | F11..F13 通过 |
| `2-6-5` | 五终态 cleanup 与 restart orphan recovery | 全部 residual=0，owner root 外文件不变 |
| `2-6-6` | V3-1.1..V3-2-5 和全量前后端回归 | 无权限/合同/用户体验回退 |
| `2-6-7` | PRD review 与独立出门审计 | Fatal=0/Major=0，仅放行 V3-2-7 |

## 5. 停止条件

故障注入可从生产入口调用；多个故障共用 task；终态计数不为 1；终态后 observation/artifact 增长；清理删除 owner root 外数据；secret/path 命中；用 fixture transcript 证明恢复；或回归失败时立即停止。
