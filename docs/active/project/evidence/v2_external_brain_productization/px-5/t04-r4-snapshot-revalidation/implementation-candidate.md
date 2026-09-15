# T04 R4 隔离快照复验实现候选

日期：2026-09-14  
Run：`t04-r4-snapshot-revalidation-20260914t105407z`  
状态：`T04 LIMITED PASS / PX-6 NOT AUTHORIZED`

T04-0..T04-6 已顺序实际执行并通过；T04-7 已生成 19+1 平铺审计包。R4-P 为 10 exact + 1 normalized + 8 logs；R4-E 使用 fresh raw `4f8e8e8d...` / seal `06fc51f0...`，完整满足 12 source、20 route、12 Forget、Axe 0/0、Keyboard 5/5、T01 36/36。fresh T03 为 63=61+2、109/109、42/42、G1-G6 passed、G7 pending。

实现方两轮内部审计均 `Fatal=0 / Major=0`。外部独立实现出门审查已落盘为 `independent-implementation-exit-audit.md`，结论 `Fatal=0 / Major=0 / Minor=1`，授予 T04 LIMITED PASS；审计文件 SHA-256 为 `cd64f8dbe685be7e252f65b1226a248885eb7b1a642651cd58c79ba752090c9b`。唯一 Minor 是 `replayLane.actualInvocation.artifactRoot=replay_validation` 与内部 step ArtifactRef 的 `validation_run` 命名不一致；它不否定候选，但必须在 PX-6 前通过新的受控工作包关闭，不能回写当前已封存候选。

门禁保持：Human Review pending，G7 pending，finalPassed=false；PX-5 FAIL/REOPENED；PX-6 未授权且 BLOCKED；V2/RKM 未通过。当前只允许规划/审计 Minor 关闭与 PX-6，不允许执行人工签署。
