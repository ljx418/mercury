# V3-3-4 授权 VLM 开发计划

日期：2026-10-08。前置：V3-3-3 LIMITED PASS、真实 MiniMax 中国区 capability PASS、用户已授权最多 8 张冻结证据帧上传。

## 目标与边界

实现 D Adapter Layer 内的单帧受治理画面说明。每次 dispatch 前从持久 SQLite consent store 获取一次性 permit；只上传当前 task 的 `frame` artifact；输出 caption、provider/model、请求/响应 SHA-256、usage 与授权绑定。

不实现大纲、证据合并、10 页矩阵、UI 人工内容判断、原视频上传、自动 Provider failover 或 V4 知识写入。

## 实施顺序

1. 实现 `VisionConsentStore`：grant/revoke/current/permit，scope 固定 `selected_frame_cloud_vision`，单 decision 最多 8 dispatch。
2. 实现 `MediaVisionProvider` 单帧接口；扩展已冻结 MiniMax/OpenAI adapters，不传 Cookie、路径、HTML 或 transcript。
3. 实现 `GovernedMediaVisionAdapter`：task/frame/hash 校验、permit、单图调用、typed receipt 和错误映射。
4. canonical request hash 只覆盖非秘密合同字段和 image SHA；response hash 只覆盖结构化响应与 usage。
5. 429、5xx、timeout、invalid response、未授权、已撤销、预算耗尽全部 fail-closed；不切换 Provider。
6. 单元测试并发撤销、8 帧预算、跨 task、未选 Provider、凭据缺失和 Provider 故障。
7. 用真实 B站选定帧和当前已验证 MiniMax 中国区执行一次生产探针；公开证据仅保留哈希、usage 和 caption hash。
8. 执行全量回归、秘密扫描、PRD 检视和出门审计。

本阶段单帧真实调用不计入 V3-3-6 的至少 8/10 固定生产分母。

