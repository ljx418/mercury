# V3-2-0b-5 低资源真实推理验收结果

日期：2026-09-22  
accepted runId：`v3-2-0b-5-20260922T063133Z`

```text
B05-01..B05-16: 16/16 PASS
independent verifier: 16/16 PASS
Fatal=0 / Major=0 / Minor=0
V3-2-0b-5: PASS
```

三个固定 B站 P1 的 `30s..150s` 真实窗口均完成本地 Paraformer 推理。隔离条件为 CPU 0..7、MemoryMax/address-space 8 GiB、swap 0、`RestrictAddressFamilies=AF_UNIX`、`PrivateDevices=yes`、CUDA disabled。

| sampleId | duration | segments | chars | elapsed | RTF | peak RSS |
|---|---:|---:|---:|---:|---:|---:|
| 01 | 119.9998125s | 14 | 626 | 8.18s | 0.0682 | 317,919,232 B |
| 02 | 120.0s | 26 | 503 | 7.38s | 0.0615 | 317,886,464 B |
| 03 | 120.0s | 30 | 225 | 8.14s | 0.0678 | 317,820,928 B |

公开证据：`runs/v3-2-0b-5-20260922T063133Z/result.json`、`verification.json`。私有 handoff 保留在 Linux 0700 根，WAV/candidate/metrics/handoff 均为 0600，仅供同 lineage 的 0b-6 生成盲评包。

此前六个失败/作废 run 均单独记录；其中两次候选 `passed=true` 因权限审计被 `invalidated.json` 撤销，不得拼接或引用为 PASS。
