# V3-2-5 模块交接

日期：2026-10-08。模块：V3 Media Transcript Product Projection。

## 1. 交付范围

- Runtime 聚合 `MediaTranscriptProjection`，统一 acquisition、capture eligibility、transcript 与公开 segments。
- Side Panel 快速卡与 Workspace transcript 页面读取同一 Runtime task。
- 真实 trusted tabCapture、SenseVoice、取消清理、全新 task 重试、四视口、Axe 与键盘主路径。
- 权威证据：`v3-2-5-real-chrome/runs/v3-2-5-ui-20261007T155715Z/`。

## 2. 合同变化

- 新增数据模型：`v3-media-transcript-projection/v1`。
- 新增 additive API：`GET /v1/media/task-projections/{taskId}` 及按 source 查询的产品投影接口。
- 既有 acquisition、capture、ASR、Credential Lease、Adapter 与 Event 合同没有破坏性变更。
- UI 不持有 Cookie、lease、envelope、绝对路径或媒体文件事实。

## 3. 主要代码实体

- Runtime：`navia_runtime/modules/media_companion/transcript_projection.py`、acquisition coordinator、`navia_runtime/app.py`。
- Frontend：`src/modules/media_companion/acquisition/`、Side Panel、Workspace、typed `runtimeClient`。
- E2E：`e2e/v3-acquisition-orchestration-e2e.mjs`。
- Schema：`contracts/v3_media_transcript_projection_v1.schema.json`。

## 4. 测试与真实证据

- Runtime：573 passed。
- Frontend：45 files / 311 tests passed。
- typecheck、WXT production build、`git diff --check`：PASS。
- 真实 B站、真实播放、真实 decoded audio、真实 trusted capture、真实 SenseVoice：PASS。
- 四视口、Axe serious/critical=0、键盘主路径：PASS。
- 公共证据 secret scan：0 hit；offscreen、task、ASR、secure root、profile：0 residual。

## 5. PRD 覆盖

已覆盖 V3-2-5 A01..A14。未覆盖并不得外推：F01..F14 故障矩阵、V3-2.7 十二页总出门、关键帧/OCR/VLM、VideoOutline、Timeline/Mindmap/Ask、持久任务恢复、导出与 H01..H10。

## 6. 后续集成说明

V3-2.6 复用同一 task 状态机、终态屏障和 cleanup receipt，不新增产品可达 fault 参数。故障只能由签名隔离测试 profile 驱动，并且不得把故障 fixture 当作成功 transcript。

V3-2.7 必须使用全新单 run 完成原 12 页分母；本阶段单页 run 不可拼入。最终审查者需与本实施/自动审计 session 不同。

## 7. 停止条件

出现双终态、终态后写、task/offscreen/profile/secret 残留、生产可达 fault injection、跨 run 拼接或缩小固定分母时立即停止并返回计划阶段。
