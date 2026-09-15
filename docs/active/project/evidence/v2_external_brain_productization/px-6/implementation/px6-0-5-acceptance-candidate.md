# PX6-0..5 机器出门验收候选

日期：2026-09-15

## 决定

```text
PX6-0..5 machine stage: LIMITED PASS
Fatal: 0
Major within machine stage: 0
Minor within machine stage: 0
Independent implementation exit audit: PASS (Fatal 0 / Major 0 / Minor 0)
PX6-6 Human Review: PENDING / REQUIRES HUMAN
PX6-7 production finalization: BLOCKED
PX-6 final: NOT PASSED
```

## 固定分母复算

| 分母 | 实测 |
|---|---:|
| production scenario | 17/17 |
| source | 12 = 6 web + 3 local + 3 note |
| route matrix | 20/20 |
| durable Forget | 12 trigger + 12 trusted click + 12 recovery |
| fault / viewport | 4 / 4 |
| Axe serious / critical | 0 / 0 |
| Keyboard | 5/5 |
| validation rules | 63 = 61 passed + 2 human pending |
| contract / production mutation | 109/109 / 42/42 |
| T04 / T04.1 acceptance | 14/14 / 14/14 |
| T04 / T04.1 negative | 25/25 / 8/8 |
| PX6 negative | 20/20 |

## A01..A16

`PX6-A01..A14=passed`；`PX6-A15..A16=pending`。没有删除 pending 项，也没有把 Human Review 或最终独立审计折算为机器项。

## 证据边界

- 唯一 T04.1 ExitManifest raw SHA-256：`1e37f5ed06dd28bf94cd3fb4b2f92ee7f0fe79f7d041353f6a58b4a1ed1f4186`。
- T04.1 独立实施审计 SHA-256：`5f48071ea11010a485a3e1189330961d8c6f7fda0bf04a468ae28f5831f0e3dc`。
- 正式机器 run：`px6-machine-exit-20260914t164500z`。
- PX-6 MachineExitAudit raw SHA-256：`821d49662c8dc7b0f7c9a4eb1e57fd09f18d116b52b4e1e767c0c578a0e50cd2`。
- PX-6 EvidenceIndex raw SHA-256：`b0090c5e214ff66c32ed483298b2c9b3b054eee6d3ff16a8c984a690a84dbe6c`。
- PX-6 ReviewRequest raw SHA-256：`339de3ffa21bc3925c72db02fd158d58d21b385519529dc6fc1b792060805ea9`。
- PX-6 Document/Drawio audit raw SHA-256：`54ce0ef8898fad9b6737b0b5784a31036d238e59abd1434e8838f352b92588db`；内部 5 个 Base64 快照均已解码并与候选时点的权威文件逐字节复核。
- PX-6 machine public archive SHA-256：`ae3e1cf59adb77906a13873e2a0ffc6b835bdd8a49e1a57567a0d0645baa2925`；22 个成员，235032 bytes。
- `review-submission.json`、`human-review-v3.json`、`final-disposition.json`、`final-report.json` 均不存在。

同一 CandidateBinding 在 `/mnt/c` 正式目录和 `/tmp` ext4 临时目录独立重跑；CandidateBinding、DocumentAudit、MachineExitAudit、ReviewRequest、EvidenceIndex、20 项 negative 和公开 tar 共 7 项逐字节一致。

## 出门条件

不同 reviewer session 已对本候选完成 Fatal/Major 审计并授予 PX6-0..5 LIMITED PASS。该结论只放行机器审查包进入真实人类 H01..H07，不放行 PX6-7 或任何最终成功声明。
