# V3-2-0b-5.1a 验收计划

日期：2026-09-22。固定 `B051A-01..B051A-08`，无 N/A。

| ID | 操作 | 必须结果 |
|---|---|---|
| B051A-01 | 复核输入绑定 | source run、三 WAV hash、模型/VAD/runtime hash 与 0b-5.1 一致 |
| B051A-02 | 执行全新 run | 三个真实样本均重新推理；8 cores/8 GiB/swap 0/断网/无 GPU |
| B051A-03 | 复核时间合同 | 所有 segment 为 `1..15000ms`，0 越界/逆序/重叠 |
| B051A-04 | 触发真实负路径 | sample 03 的 bin 2 保持空，runner 返回非零，不生成 accepted handoff |
| B051A-05 | 复核非静音证据 | 空 bin 的 PCM RMS 非零并公开为数值，不公开音频或正文 |
| B051A-06 | 复核公开失败产物 | `failure-diagnostic.json` 与 `invalidated.json` 存在、结构一致、无私有路径/正文/秘密 |
| B051A-07 | 复核私有边界 | audio/candidate/metrics 仍为 0600，private root 为 0700 |
| B051A-08 | 回归与 PRD | Runtime 全量测试通过；状态保持 `FAIL / REPLAN`，0b-6/0b-7 不放行 |

出门要求：8/8 PASS，Fatal=0、Major=0。这里的 PASS 只说明失败证据链可审计，不表示 ASR 候选通过。
