# V3-2-5 Transcript 双容器产品化开发计划

日期：2026-10-07。状态：`V3-2-5 LIMITED PASS (2026-10-08)`。权威 run 为 `v3-2-5-ui-20261007T155715Z`；继承 2026-10-06 已通过外审的固定范围，只按当前代码基线补齐 Runtime 产品投影，不废弃或重排原 V3 计划。

## 1. 用户结果与范围

用户在当前 B站视频页的 Side Panel 点击“开始分析”后，可看到当前获取路线、真实进度、失败原因、等待可信捕获、取消、清理和终态；Workspace 展示同一 Runtime task 的完整 transcript、时间段、来源路线和重试入口。V3-2-5 只交付 transcript 产品体验，不显示大纲、OCR/VLM、Mindmap、Ask、历史或导出已完成。

## 2. 目标代码实体

| 状态 | 实体 | 目标路径 | 职责 |
|---|---|---|---|
| 已实现保持 | `MediaAcquisitionClient` | `apps/chrome-extension/src/modules/media_companion/acquisition/MediaAcquisitionClient.ts` | 调用冻结的创建/执行/route-failure API；不读 Cookie、平台 API 或本地路径 |
| 待新增 | `useMediaAcquisitionTask` | `.../acquisition/useMediaAcquisitionTask.ts` | 单 task polling/SSE、终态停止、重连后从 Runtime 重读 |
| 待新增 | `MediaTranscriptQuickCard` | `.../acquisition/MediaTranscriptQuickCard.tsx` | Side Panel 开始、路线、进度、取消和 Workspace 入口 |
| 待新增 | `MediaAcquisitionProgress` | `.../acquisition/MediaAcquisitionProgress.tsx` | 映射 acquiring/capture/transcribing/cleaning/terminal；不自行推断成功 |
| 已实现、需接入共享投影 | `TrustedTabCaptureCard` | `.../capture/TrustedTabCaptureCard.tsx` | 仅真实用户点击请求 one-shot capture；脚本/自动重试不可触发 |
| 待新增 | `MediaTranscriptWorkspacePage` | `.../acquisition/MediaTranscriptWorkspacePage.tsx` | 完整 transcript、路线、失败详情、取消和全新 task 重试 |
| 待新增 | `MediaTranscriptViewer` | `.../acquisition/MediaTranscriptViewer.tsx` | 虚拟化时间段列表；此阶段时间戳不可 seek |
| 需修改 | `MediaPortalPageStateBridge` | 既有 media companion 路径 | 提供当前 page identity；不承载 task 事实 |
| 需修改 | Side Panel/Workspace router | `entrypoints/sidepanel/main.tsx`、`entrypoints/workspace/main.tsx` | 注册 `/media/transcript/:taskId`，无效/跨页 task 返回媒体首页 |
| 已实现、需扩展 | `MediaAcquisitionCoordinator` | `services/local-runtime/navia_runtime/modules/media_companion/acquisition/coordinator.py` | 唯一写模型；增加按 sourceIdentity 查当前 task 与公开 transcript segment 读取 |
| 待新增 | `MediaTranscriptProjectionService` | `services/local-runtime/navia_runtime/modules/media_companion/transcript_projection.py` | 合并 acquisition、transcript、eligibility、segments 为 closed-set 产品读模型，并对投影变化分配单调 revision/updatedAt |
| 需修改 | Runtime API | `services/local-runtime/navia_runtime/app.py` | 增加 `GET /v1/media/task-projections/{taskId}` 与按 source 查询；沿用 companion session 认证 |

## 3. 状态与交互规则

1. `created/acquiring/transcribing/cleaning/terminal` 完全来自 Runtime；前端只能派生显示文案。
2. `awaiting_trusted_capture_click` 显示明确原因和捕获范围；只有可见按钮的 `isTrusted=true` 点击进入 Background grant。
3. 取消后先显示“正在停止并清理”；只有 cleanup receipt 通过才显示“已取消”。
4. 重试创建新 taskId；禁止复用失败 task、旧 ticket、旧 lease 或本地缓存 transcript。
5. Side Panel 和 Workspace 同时打开时使用同一 taskId，并以 Runtime revision/updatedAt 解决陈旧响应。
6. 公开 UI 不显示 Cookie、账户标识、ticket、streamId、绝对路径、命令行或原始媒体位置。

## 3.1 ADR-V3-2-5-01：双容器权威读模型

**决定：**采用 Runtime 聚合产品投影。Side Panel 与 Workspace 只读取同一 `MediaTranscriptProjection`；投影由 Runtime 合并 acquisition task、transcript task、capture eligibility 和公开 segments，并携带单调 `revision`、`updatedAt`、`terminal` 与 `cleanupStatus`。

**备选 A（拒绝）：**两容器分别轮询 acquisition/transcript 后在前端拼接。改动较少，但会形成两个派生状态机，取消、清理和终态可能分叉，违反 A02/A07/A11。

**备选 B（拒绝）：**把共享状态写入 `localStorage`。实现最快，但 reload 后可能显示过期成功，也无法跨扩展容器可靠同步，违反 Runtime 唯一事实源。

**代价：**Runtime 增加一个只读投影层和两个查询入口；收益是状态拼接、修订冲突、终态和隐私字段均可统一验证。该接口以 `adapterId/sourceIdentity/taskId` 为门户无关边界，不写死 B站，可供后续 YouTube、小红书适配器复用。

## 4. 实施顺序

| 子阶段 | 开发内容 | 进入下一步条件 |
|---|---|---|
| `2-5-0` | 冻结投影 DTO、UI receipt Schema、路由和组件 ownership | Schema/positive/negative PASS，实施前审计无 Fatal/Major |
| `2-5-1` | 实现 typed `MediaAcquisitionClient` 与 Runtime task store hook | 错误/超时/陈旧 revision/终态 polling 测试通过 |
| `2-5-2` | Side Panel quick card 与开始/取消 | 真实 task 状态可见，取消等待 cleanup |
| `2-5-3` | Workspace transcript page/viewer | 大 transcript 不阻塞；来源和路线可复核 |
| `2-5-4` | trusted capture 可见操作和焦点恢复 | 只有 trusted click 可触发；拒绝自动触发 |
| `2-5-5` | 四视口、键盘、Axe、200% zoom | A01..A12 通过 |
| `2-5-6` | 真实 B站同 task 双容器 E2E | A01..A14 全通过，公开证据 0 secret/path |
| `2-5-7` | PRD 检视与独立实施出门审计 | Fatal=0/Major=0，仅放行 V3-2-6 |

## 5. 停止条件

V3-2.4a 独立实施审查未通过；需要浏览器直接生成 transcript；UI 用 fixture/mock 计生产；捕获无需可信点击；取消先于 cleanup 显示完成；双容器出现不同 task 事实；四视口或 Axe/键盘失败；出现大纲/视频理解完成声明；秘密或绝对路径进入截图/日志时立即停止并回到计划。

## 6. 出门效果

出门只允许声明“用户可在 Side Panel 和 Workspace 查看并控制同一 V3-2 transcript task”。不得声明 V3-2、V3-3、视频理解或 V3 完成。
