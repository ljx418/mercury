# V3-5-5 资源投影修复验收计划

日期：2026-10-09。状态：实施前冻结。

## 固定门槛

1. projection 在转写不存在时返回 `resources=null`。
2. 转写存在时精确投影 `cpuCoreLimit`、`memoryLimitBytes`、`temporaryDiskPeakBytes`、`gpuUsed`，且返回副本。
3. `v3_media_transcript_projection_v1` Draft 2020-12 校验通过。
4. Companion session 鉴权与错误 origin 拒绝回归通过。
5. Runtime 全量测试、扩展 typecheck/build 通过。
6. 全新真实 B站/Chrome run 中 `temporaryDiskPeakBytes>0`，资源提示取自产品 projection。
7. 正式 `v3-media-product-acceptance/v2` Schema 与语义校验通过，A01..A18 不缩小。
8. Cookie、API key、私有路径、临时媒体与过程帧不进入公开证据；失败 run 不封存。

## PRD 检视

该修复恢复 PRD 要求的低资源影响告知和可审计资源事实，不改变 Chat/Know 信息架构、B站路线或用户操作步骤。

