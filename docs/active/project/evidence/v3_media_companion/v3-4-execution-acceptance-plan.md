# V3-4 授权后执行验收计划

日期：2026-10-08。

## 自动门槛

1. v1 Schema SHA-256 保持 `75f88ea0c366132ba9a2008038062c6984a19295b048698a32746140153438f4`。
2. migration 对既有表只增不改；事务注入点不得产生半提交。
3. CAS、idempotency、cancel/retry/recovery 全部有正负例。
4. Outline/Timeline/Mindmap 只引用同 task 当前 revision 的 evidence。
5. 12 页必须同 run：01..10 ready、11 blocked 零投影、12 degraded。
6. 真实 MiniMax dispatch `<=8`，每次有独立 consent receipt；云端只收到 selected frame。
7. Cookie/API Key/Authorization/raw media/full transcript/OCR text 不进入公开材料。
8. 临时视频、音频、候选帧和开发截图在阶段验收后 `residualCount=0`。
9. Runtime 全量回归、Extension 类型检查/测试/构建全部通过。
10. 独立实现审查 Fatal=0/Major=0。

## PRD 边界

本阶段交付可恢复的媒体任务及大纲/时间线/Mindmap，不宣称 Ask、播放器跳转、最终双容器 UI、知识库导入、Query/Graph/Durable Forget 或完整 V3 PASS。
