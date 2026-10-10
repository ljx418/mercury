# V3-2-0c 路线 C 真实最小 Spike 验收计划

日期：2026-09-22  
状态：`FROZEN`

## 1. 用户场景

用户保持当前低资源默认模型；工程侧在隔离环境验证新候选能否对既有完整遗漏窗口产生有时间边界的非空转写，且不提高 8 GiB/no-GPU/512 MiB 门槛。spike 不要求人类听写，不改变设置页。

## 2. 固定门槛

| ID | 操作 | 必须结果 |
|---|---|---|
| SC01 | 对账 Runtime archive/binary | 固定 bytes/hash/tag/source commit/license 全匹配 |
| SC02 | 对账模型 metadata/download | 固定 repository/revision/bytes/SHA/license 全匹配 |
| SC03 | 对账 VAD | SHA-256 匹配既有冻结资产 |
| SC04 | 对账 source | 2 个 source WAV hash、owner、mode、格式匹配 |
| SC05 | 切出 3 个窗口 | 3/3 为 240000 frames；payload hash 可复算 |
| SC06 | 限制执行 | CPU cores<=8、address space<=8GiB、GPU 未使用 |
| SC07 | 推理断网 | 模型就绪后在 network namespace 或等价 fail-closed 隔离中执行 |
| SC08 | CLI 完整性 | 固定 argv，no shell，binary/model/VAD 均为冻结路径和 hash |
| SC09 | 输出完整性 | 3/3 exit=0、至少 1 segment、去标签后文本非空 |
| SC10 | 时间戳 | SRT 可解析；`0<=start<end<=15000ms`；单调且不重叠 |
| SC11 | 目标遗漏恢复 | `sample03/chunk4` 满足 SC09/SC10 |
| SC12 | 性能 | 逐窗口 wall time 与 peak RSS 均记录；RSS<=8GiB；总资产<=512MiB |
| SC13 | 清理 | 0 活跃子进程；临时窗口/输出删除；私有 source 保持只读 |
| SC14 | 公开证据扫描 | 0 audio/transcript/Cookie/token/绝对路径；仅 hash/count/resource |
| SC15 | PRD/状态审计 | 不修改用户状态；结论仅 `SPIKE_FEASIBLE|SPIKE_FAILED` |

SC01..SC15 不得 N/A。任一失败即 `SPIKE_FAILED`，不得挑选成功窗口替代。

## 3. 防假绿

禁止：无 VAD 时用整窗 SRT 冒充语音时间戳；只跑目标遗漏窗口；复用 Paraformer 文本；删除空结果；LLM 修文；仅报平均资源；在公开材料记录正文/音频/私有路径；把 3/3 扩大为 24/24、质量通过或生产资格。

## 4. 出门条件

SC01..SC15 全 PASS 且内部实施审计 Fatal=0/Major=0，路线 C 才可进入“生产候选详细文档与威胁建模”。代码接入仍需新的外部文档审查和用户明确授权。
