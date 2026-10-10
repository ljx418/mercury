# V3-2-5 PRD 规格检视

日期：2026-10-08。结论：`PASS WITH FROZEN BOUNDARY`。

## 体验对齐

1. 用户从真实 B站页开始分析，前三路线失败后由显式可信点击启动 tabCapture；符合 Cookie 主路径加公开字幕/可信 capture 回退。
2. Side Panel 与 Workspace 使用 Runtime `MediaTranscriptProjection`，没有新增前端第二事实源。
3. 用户可看到路线、进度、SenseVoice、转写片段、取消、cleaning、终态和重试。
4. 取消先清理；重试生成新 task、新 lease/envelope；秘密和临时媒体不持久化。
5. 组件以 `adapterId/sourceIdentity/taskId` 为边界，没有把 acquisition core 写死为只能服务 B站；后续门户仍通过 `MediaPortalAdapter` 扩展。

## 未越界

- 未声明 OCR、VLM、VideoOutline、Timeline、Mindmap、Ask、seek 或 export 已完成。
- 未实现 Query、Graph、记忆、自动维护或 Durable Forget；这些仍属于 V4。
- 未引入 Agent、多 Agent 或后台自动启动 Runtime。
- 未缩小 12 页 B站分母，也未改写 H01-H10。
- SenseVoice 文本质量继续采用用户批准的 V3 baseline；质量回退和多 Provider 优化仍在 V4。

## 后续绑定

V3-2.6 必须继续使用本阶段投影、清理屏障和真实失败文案；不得用 fault fixture 证明成功 transcript。V3-2.7 仍需全新单 run 完成 12 页 `6+3+1+1+1`，本次单页 run 不能替代该分母。

