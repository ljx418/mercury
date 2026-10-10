# V3-5-3 三视图与视觉证据产品化开发计划

日期：2026-10-08。状态：`IMPLEMENTATION AUTHORIZED / PREIMPLEMENTATION AUDIT REQUIRED`。

## 1. 用户结果与边界

用户在全新的 B站任务完成转写后，无需再次粘贴 Cookie 或配置 Provider，即可在 Media Workspace 查看来自同一 task/revision/outline 的大纲、时间线、导图和分型证据。视觉链路必须产生真实 `frame`、本地 `ocr_block` 与受控 MiniMax `vision_caption`；如视觉链路不可用，只能显示已有的 `VISUAL_EVIDENCE_UNAVAILABLE` 降级状态。

本阶段不实现 Ask、播放器反跳、导出或人工验收。V3-4 的 0–8 秒低清媒体切片、最多 12 个选中帧/8 个云帧预算保持不变；V3-5-3 最小产品路径只上传 1 个已选中帧，不上传原视频、音频、转写或 OCR 文本。

## 2. 实施事务

1. Extension 在转写成功后为**同一 taskId**申请新的短期 Cookie lease；不得按 task 猜测唯一租约。
2. Extension 调用新的视觉物化端点并显式提交 `credentialLeaseId`。旧 transcript-only `/materialize` 端点保持兼容。
3. Runtime 以 task、leaseId、sourceIdentity 三重绑定解析 Cookie，下载 0–8 秒、最高 480p 的真实 B站媒体切片。
4. Runtime 在独立视觉 sandbox 中执行 `FrameSelectionPolicy -> FrameExtractor -> LocalOcrAdapter -> GovernedMediaVisionAdapter`。
5. Runtime 只在已选 MiniMax Provider 通过 test 且云视觉 scope 已授权时上传一个选中帧；每次 dispatch 仍由 `VisionConsentStore.permit()` 检查。
6. Runtime 把真实 transcript、OCR、vision caption 转换成同一私有 evidence 集，生成并原子提交 ready task、outline、timeline、mindmap 与 evidence catalog。
7. `finally` 块删除 Cookie 临时文件、媒体切片、全部帧及视觉 sandbox；Extension 随后通过后台内存 revocation handle 撤销本次 lease。
8. Workspace 只渲染 Runtime 投影；Evidence Drawer 显示 evidence kind、时间、来源、内容哈希和反跳可用状态，不读取私有文件或前端总结。

## 3. 代码范围

- Runtime：扩展冻结的 yt-dlp downloader 以获取受限视频切片；新增视觉产品物化器与受保护端点；复用现有 Frame/OCR/VLM/Outline/TaskStore。
- Extension：凭据消息协议新增 `revoke_lease`；Side Panel 为同 task 更新 lease、视觉物化并终态撤销；Workspace 增强三视图和证据类型表达。
- Tests/E2E：单元测试覆盖 lease/task/source 绑定、Provider/consent 失败、清理和投影闭合；真实 Chrome fresh run 覆盖真实 B站、SenseVoice、OCR、MiniMax 与三视图恢复。

不修改五项 consent scope、V3-4 合同、已有 transcript-only 端点或 Knowledge 路由。

## 4. 子步骤

| 步骤 | 内容 | 出门条件 |
|---|---|---|
| V3-5-3-0 | 冻结计划、验收、威胁模型 | Fatal=0/Major=0 |
| V3-5-3-1 | 明确 leaseId 的视觉物化 API 与撤销消息 | 负例 fail-closed |
| V3-5-3-2 | 受限视频切片下载与 task sandbox | 哈希、大小、时长、清理闭合 |
| V3-5-3-3 | Frame/OCR/MiniMax evidence 事务 | 三种视觉 evidence 真实存在 |
| V3-5-3-4 | 同源 transcript + vision outline 提交 | task/revision/outline 一致 |
| V3-5-3-5 | Workspace 三视图与 Evidence Drawer | 不做前端总结；类型不冒充 |
| V3-5-3-6 | 全量测试与 fresh real Chrome | 全部门槛 PASS |
| V3-5-3-7 | PRD 检视、清理、内部出门审计 | Fatal=0/Major=0 |

## 5. 禁止项

- 禁止复用 V3-4 已封存数据库、媒体、帧或 outline 作为产品输入。
- 禁止把 raw video/audio/frame、Cookie、Provider key、绝对路径写入公开证据。
- 禁止把 OCR 冒充 transcript、把 caption 冒充 frame、或前端重新总结。
- 禁止视觉失败后覆盖已提交终态；fresh run 必须在单次原子终态提交前完成视觉事务。
- 禁止保留开发过程媒体、截图或帧；只保留脱敏 JSON、哈希、计数和产品 UI 验收截图。
