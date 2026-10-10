# V3-5-1 Side Panel 产品任务闭环开发计划

日期：2026-10-08。前置：V3-5-0 PASS。授权来源：用户已批准 `V3-5-0..7 implementation`。

## 用户结果

用户在受支持的 B站视频页完成既有授权并点击开始后，Side Panel 必须：

1. 延续现有 acquisition、字幕或 SenseVoice 真实路线；
2. 显示 Runtime 实际 route、进度和本地 ASR 资源影响；
3. 转写完成后把同一 `taskId/sourceIdentity` 原子物化为 Runtime outline task；
4. 显示真实快速摘要并以 canonical route 打开同一 Workspace task；
5. 取消、失败、无字幕和视觉证据缺失均显示真实状态，不伪造完成。

## 架构方案

- 新增 Runtime `MediaProductMaterializer`，输入只允许既有 taskId；source、route、segments 从 Runtime 既有 projection 读取，前端不能上传转写正文。
- Materializer 将真实 segment 压缩为 transcript evidence，正文只写入 Runtime 私有目录，公开 task 仅持有 hash 和相对引用。
- 任务状态按 `created -> acquiring -> transcribing -> extracting_frames -> synthesizing -> degraded` 提交；本子阶段未取得视觉证据时固定 `VISUAL_EVIDENCE_UNAVAILABLE`。
- 重复 materialize 返回既有同 task terminal envelope；source/task 不一致 fail closed。
- Side Panel 只经 `runtimeClient` 调用 materialize/get，Workspace deep link 固定 `#/media/tasks/:taskId`。

## 实施顺序

1. `V3-5-1a`：Materializer 单元合同、真实 segment evidence 与私有路径。
2. `V3-5-1b`：受 Companion session 保护的 materialize API 和负例。
3. `V3-5-1c`：runtimeClient 与 Side Panel terminal materialize 编排。
4. `V3-5-1d`：ASR 资源提示、快速摘要、canonical Workspace deep link。
5. `V3-5-1e`：真实 B站 fresh task E2E、取消/失败/清理。
6. `V3-5-1f`：PRD 检视和内部出门审计。

## 非目标

- 不实现 Ask、export、seek。
- 不把 transcript-only task 声明为画面理解完成。
- 不修改 Cookie/credential/capture 合同，不复用已消费 lease。
- 不导入 V4 知识库，不把 V3-4 封存数据注入产品 DB。

