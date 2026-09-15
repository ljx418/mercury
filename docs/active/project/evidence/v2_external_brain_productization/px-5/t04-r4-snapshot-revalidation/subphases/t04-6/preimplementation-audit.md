# T04-6 ExitManifest 与审计产物实施前审计

日期：2026-09-14  
结论：`GO ONLY AFTER T04-5 PASS`

## 固定产物

- SnapshotRevalidation v1：T04-A01..A14 全 passed，25/25 negatives，G1-G6 passed，G7 pending，machinePassed=true，humanReviewStatus=pending，finalPassed=false。
- 中文 HTML、测试原始 stdout/stderr、fresh prerequisite index，以及 PRD、架构、false-green、独立出门审查请求四份内部审计材料。
- payload-only deterministic public tar；真实成员索引必须与 tar 一致，重复路径按字节一致去重，冲突字节必须失败。
- tar 不得包含 ExitManifest 或后续独立审查；ExitManifest 在 tar 生成后作为旁挂 unsigned 文件产生，避免自引用。

## 隐私与声明边界

公开字节必须扫描实际 repository/home/temp/snapshot path 与当前环境真实 token/secret 值；证据文本还需拒绝 Bearer/JWT。测试源码中的非真实示例不得误判，但真实敏感值在任何二进制或文本成员中出现都必须失败。Human Review/G7/final 不得升级。

## 停止条件

Schema/semantic 校验失败、路径/hash/length 不可重算、成员索引不一致、敏感字节命中、自引用、签署或范围过度声明，均阻止 ExitManifest 生成。
