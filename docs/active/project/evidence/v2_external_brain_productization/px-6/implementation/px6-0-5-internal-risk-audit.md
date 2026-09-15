# PX6-0..5 内部架构与假绿审计

日期：2026-09-15

## 架构

数据流保持单向：

```text
T04.1 immutable candidate
-> explicit CandidateBinding
-> raw-byte / canonical / ArtifactRef reader
-> raw-derived facts + AST architecture replay
-> MachineExitAudit
-> ReviewRequest + EvidenceIndex + read-only HTML
-> machine-only archive
-> mandatory human stop
```

没有 P7 到 P0-P6 的写路径；没有调用旧 `audit-v2-external-brain-exit.mjs`；没有扫描目录选择 newest candidate。

## 假绿防线

- ExitManifest raw/content、T04.1 audit、public archive 均重算。
- 从 Git bundle 的 exact acceptance commit 复原 1152 文件 closure。
- 架构扫描从 28 个 tracked source 原始字节执行 AST，不信任 `violations=0`。
- raw-run 重新派生 facts，不能只读 Report 布尔值。
- A11 绑定 4 份 active Markdown 与 Draw.io 的源路径、源字节哈希和长度，并把可逆 Base64 快照纳入 `px6_run` 机器包；活动状态更新不再破坏候选时点文档的可重算性。
- PX6-N-001..020 实际 mutation 全部命中 expected primary failure。
- 公开机器包在 `/mnt/c` 与 `/tmp` ext4 重建 hash 完全一致，且不含人类身份、ReviewSubmission、FinalDisposition 或生产成功 claim。
- production finalizer 在独立终审绑定缺失时 fail closed。

## 严重度

```text
PX6-0..5 machine stage: Fatal=0 / Major=0 / Minor=0
PX6-7 future production path: Fatal=0 / Major=1 (document/contract handshake; separately blocked)
```

该 Major 不撤销机器候选，但禁止执行 production PX6-7，详见 `px6-7-final-audit-handshake-risk-stop.md`。
