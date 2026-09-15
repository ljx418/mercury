# T04 R4 LIMITED PASS 门禁处置

日期：2026-09-14  
候选：`t04-r4-snapshot-revalidation-20260914t105407z`  
决定：`T04 LIMITED PASS / PX-6 NOT AUTHORIZED`

## 1. 独立审计结论

独立实现出门审计：`independent-implementation-exit-audit.md`  
审计文件 SHA-256：`cd64f8dbe685be7e252f65b1226a248885eb7b1a642651cd58c79ba752090c9b`

```text
Fatal = 0
Major = 0
Minor = 1
T04 LIMITED PASS = GRANTED
```

候选 ExitManifest 原始字节 SHA-256：`5e492bd50a7dc3a1be5c5d57b7b694601b9563f4c6f79871b72093b3e56316cd`。候选、ExitManifest、public archive 和用于本轮外审的平铺包均保持封存，不因本处置文档回写或重生成。

## 2. 已通过范围

- R4-P 在 detached acceptance snapshot 中实际执行 T03 四步，10 项 exact artifact、1 项仅忽略 `/recordedAt` 的 normalized artifact 和 8 项 stdout/stderr 比较通过。
- R4-E 从同一快照建立全新 build/profile/Runtime/database/raw/seal，完成真实 Chrome、12 source、5 route x 4 recovery、3 source x 4 durable Forget、Axe 0/0、Keyboard 5/5、T01 36/36。
- T04-A01..A14、T04-N-001..025、63 RuleId、109 contract fixtures、42 production mutations 和三份 Snapshot Schema 通过。
- Human Review、G7、`finalPassed` 保持 `pending / pending / false`。

## 3. PX-6 前置 Minor

`replayLane.actualInvocation.artifactRoot` 使用 `replay_validation`，而内部 step ArtifactRef 使用 `validation_run`。两者当前指向同一物理目录且字节一致，不否定 T04 候选；进入 PX-6 前必须通过受控清理工作包统一命名，并保证新的候选/审计链可以重算。禁止直接修改已封存 run。

## 4. 当前门禁

```text
T03 R3 pipeline: LIMITED PASS
T04 R4 snapshot revalidation: LIMITED PASS
PX-5: FAIL / REOPENED
PX-6: BLOCKED_PENDING_T04_MINOR_AND_PX6_AUTHORIZATION
Human Review: pending
G7: pending
finalPassed: false
V2 / RKM / RAG: NOT PASSED
```

下一步仅允许制定并审计：T04 Minor 关闭、PX-6 人工签署合同与验收步骤。没有新的用户明确授权，不执行 PX-6、不签署 Human Review、不把 `finalPassed` 改为 true。

## 5. 自动化开发停止原因

用户批准范围 `T04-0..T04-7 implementation` 已完成并通过独立出门审计。下一工作包属于 PX-6，且存在必须先处理的 T04 Minor；当前没有 PX-6 实施授权，因此自动化开发在 T04 LIMITED PASS 边界停止。
