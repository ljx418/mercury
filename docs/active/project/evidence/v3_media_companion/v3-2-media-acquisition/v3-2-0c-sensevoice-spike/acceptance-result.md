# V3-2-0c 真实最小 Spike 验收结果

日期：2026-09-22  
run：`v3-2-0c-spike-20260922T131329Z`  
结论：`SPIKE_FEASIBLE / PRODUCTION NOT QUALIFIED`

## 固定门槛结果

SC01..SC08 PASS：Runtime archive/binary、SenseVoice Q8、FSMN-VAD 与冻结 bytes/hash/license/revision 一致；两个 source hash/mode/格式一致；3 个窗口均为 240000 frames 且 payload hash 匹配；子进程限制为 8 cores/8 GiB/no-GPU；seccomp 拒绝 12 类 network syscall，独立 socket 自测得到 `EPERM`；argv 无 shell。

SC09..SC12 PASS：

| 窗口 | segment | SRT 范围 | wall | peak RSS |
|---|---:|---:|---:|---:|
| sample03/chunk4（原完整遗漏） | 1 | `0..14980ms` | 1170ms | 322363392 bytes |
| sample03/chunk2（同源控制） | 1 | `0..14980ms` | 1118ms | 320917504 bytes |
| sample01/chunk0（跨源控制） | 1 | `0..14980ms` | 1116ms | 325156864 bytes |

三窗均 exit 0、文本非空、SRT 可解析、时间戳单调且在 15 秒内。资产总量 `258371224` bytes，低于 512 MiB；峰值 RSS 远低于 8 GiB。

SC13..SC15 PASS：0 活跃推理进程；窗口和原始 SRT/stderr 临时件已删除；冻结 source hash 不变；公开 `spike-result.json` 扫描 0 Cookie/token/audio/transcript/绝对路径命中；`productionQualified=false`。

## 限定解释

三条结果均为接近整窗的单 segment。它满足本 spike 的结构和遗漏恢复门槛，但不证明语音级时间粒度、24-bin 完整性或语义质量。不得把本结果写为 V3-2-A06 PASS。

测试补充：runner seccomp/socket 与 SRT 正负例自检 PASS；`test_v3_asr_srt_normalizer.py + test_v3_asr_fixed_window.py` 为 `23 passed`。首次 pytest 未带 `PYTHONPATH` 导致 collection error，补齐仓库运行前提后通过，属于命令环境错误而非产品失败。
