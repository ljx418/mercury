# T02.1 架构一致性检视

日期：2026-09-12  
结论：`PASS FOR R2 RAW-EVIDENCE BOUNDARY`

## 1. 数据流

实际采集链保持目标架构：

```text
Host Page
-> native Side Panel user click
-> Extension Background open/focus
-> workspace.html canonical route
-> shared runtimeClient
-> Local Runtime
-> MockKnowledgeServiceAdapter
-> raw event/artifact collector
```

前端未直连 data_service，R2 collector 未生成知识事实，T03 尚未从 raw 派生 G1-G7。Runtime 和 Adapter 公共合同未修改。

## 2. 权威与隔离

- route/container ID 只接受同 segment、同 navigation、先发生的 Runtime response/transport authority。
- Runtime restart 产生第二 segment、不同 PID/session/browserContext，未承诺恢复旧 operation。
- 12-source registry 将 `sourceSampleId` 与 Runtime `sourceId` 分开。
- public artifact 与 `private_local_only` 分离；授权文档和带路径请求不进入公开包。
- 新 run 与旧 T02 run 通过 run root、snapshot、build、database、profile 和 seal 物理隔离。

## 3. CSS 修复影响

T02.1a 只改变 Workspace 两处前景色，不改变组件边界、布局、状态机、事件、API 或数据流。隔离快照 diff 证明产品变更仅一文件两行。

## 4. 下一阶段约束

T03 只能只读消费本 run，在独立审查前继续 `NO-GO`。独立审查通过后也只允许重新执行 T03 实施前审计；不得跳到 T04、PX-6 或 RKM。
