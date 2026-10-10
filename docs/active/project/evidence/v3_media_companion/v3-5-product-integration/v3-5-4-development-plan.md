# V3-5-4 Ask、播放器反跳与本地导出开发计划

日期：2026-10-08。授权来源：用户 `approved V3-5-0..7 implementation`。前置：V3-5-3 PASS。

## 1. 用户结果

1. 用户在 Ask 页面输入问题；Runtime 只从当前 task 的私有 evidence 检索并生成带引用回答，证据不足时返回空答案和明确拒答。
2. 用户从大纲、时间线、导图、Ask 引用和证据详情点击时间，Extension 通过当前 portal adapter 跳转真实播放器并回读时间；页面/分P不一致时拒绝。
3. 用户可下载版本化 JSON bundle 或 Markdown ZIP；文件只含产品投影、Ask 摘要、evidence index 与允许的证据缩略信息，明确 `knowledgeImportStatus=deferred_to_v4`。

## 2. 架构和所有权

### Runtime

- `MediaAskService`：输入 `taskId/revision/question`，从 `MediaTaskStore` 与 task 私有 evidence 读取事实；输出 `answered/insufficient_evidence/blocked` 和同 task evidence IDs。
- `EvidenceGroundedExtractiveProvider`：V3 低资源默认 Provider；仅重排/摘取 evidence，不引入外部常识。接口允许 V4 替换为受治理模型 Provider。
- `MediaExportService`：规范化 JSON 与确定性 ZIP；路径固定在 Runtime 私有 export root；下载接口只按 task/export ID 读取 allowlist 文件。
- Ask 与 export API 受 Companion 安全会话保护；body 严格拒绝未知字段、客户端 evidence、输出路径和文件名。

### Extension

- `MediaJumpbackController`：只通过 `navia.media.seek` content bridge 调用 `MediaPortalRegistry`，不直接查询 B站 DOM。
- `AskVideoPanel`、`MediaExportPanel`、三视图/evidence 的 seek control 只显示 Runtime/adapter 事实。
- 当前 active tab 的 `sourceIdentity` 必须与 task 一致；请求/回读均受当前分P时长约束。

## 3. 数据合同

- Ask request：`question` 1–500 字，`expectedRevision`；结果包含 `answerId/taskId/taskRevision/question/answer/evidenceIds/status/failureCode/createdAt`。
- `answered`：answer 非空、至少一个 evidenceId、所有引用属于当前 task/revision。
- `insufficient_evidence`：answer 为空、evidenceIds 空、failureCode=`ASK_EVIDENCE_INSUFFICIENT`。
- 视觉问题只允许 frame/ocr_block/vision_caption 参与；纯 transcript 不得回答“画面里有什么”。
- seek receipt：origin、task/source identity、requestedMs、observedMs、deltaMs、pageIdentityMatched、status/failureCode；located 必须 delta<=2000。
- export manifest：format、members、bytes、sha256、knowledgeImportStatus；禁止绝对路径和 secret。

## 4. 实施顺序

1. V3-5-4-1：冻结 Ask/export 类型和 Runtime API；补 fail-closed 单测。
2. V3-5-4-2：实现私有 evidence reader 与低资源 evidence-grounded Ask Provider。
3. V3-5-4-3：实现 JSON/Markdown ZIP 导出、manifest 和受保护下载。
4. V3-5-4-4：实现 content/background/workspace jumpback controller 与五类入口。
5. V3-5-4-5：实现 Ask/Export UI、加载/拒答/错误/下载状态和键盘焦点。
6. V3-5-4-6：全量回归和故障注入。
7. V3-5-4-7：全新真实 B站 run 完成两个 Ask、五次 seek、两种导出、secret/residual scan。

## 5. 禁止项

- 前端生成答案、引用或导出内容；使用 mock/fixture 计 production pass。
- 直接从 Workspace 操作 `document.querySelector('video')`；绕过 portal adapter。
- 将 V3 export 宣称为 Know 持久化或 V4 导入。
- 导出 Cookie/key/token/绝对路径/SQLite/原视频/音频/非证据帧。
- 用 schema shape 代替真实文件 hash、ZIP member 和播放器回读。
