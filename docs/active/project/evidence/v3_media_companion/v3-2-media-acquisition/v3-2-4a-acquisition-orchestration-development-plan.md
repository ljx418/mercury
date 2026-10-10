# V3-2-4a Acquisition Orchestration 开发计划

日期：2026-10-07。状态：`IMPLEMENTATION AUTHORIZED BY USER CONTINUE-DEVELOPMENT INSTRUCTION`。

## 1. 目标体验

用户在受支持的当前视频页完成授权并点击“开始分析”后，Side Panel 与 Workspace 显示同一真实任务的路线和进度。凭据字幕或媒体成功时继续生成 transcript；只有前三路真实失败时才显示“捕获当前标签页”。不得要求人类伪造失败或手工调用 API。

## 2. 子阶段

1. `4a-0` 冻结本合同、失败码和测试矩阵。
2. `4a-1` 修订 Runtime coordinator，使两个预期凭据路线失败形成非终态权威投影。
3. `4a-2` 增加无 body 的 execute API，并通过已冻结工具 manifest 构造 adapter；依赖缺失必须返回 `V3_MEDIA_RUNTIME_OFFLINE`。
4. `4a-3` 实现 portal-neutral `MediaAcquisitionClient` 与严格 response guards。
5. `4a-4` 由 content bridge 获取新鲜 `MediaPageContext`，创建同 task acquisition；公开字幕 unavailable/restricted/unknown 时提交第三失败。
6. `4a-5` Side Panel 与 Workspace 接入统一 hook/component，显示路线、进度、阻塞和 capture action。
7. `4a-6` 聚焦、全量、build/typecheck、真实 Chrome B站验收与秘密/残留扫描。
8. `4a-7` PRD 检视、候选封存与独立实施出门审计。

实际实现将 `4a-5/4a-6` 细化为两个不可合并的边界：先 arm 并绑定当前 tab，再由真实扩展 action 事件签发 stream ID；捕获完成后由独立沙箱 launcher 启动 SenseVoice。该细化不改变路线分母或用户目标，只关闭 Chrome 用户手势约束和 Runtime 多线程子进程安全问题。

## 3. 文件边界

- Runtime：`app.py`、`modules/media_companion/acquisition/` 及对应测试。
- Extension：`runtimeClient.ts`、`modules/media_companion/acquisition/`、两个现有 V3 容器及对应测试。
- Capture：`modules/media_companion/capture/`、`entrypoints/media-capture-offscreen/`、Background action/command handler。
- ASR 沙箱：`modules/media_companion/asr/native_process.py` 与 `asr_sandbox_launcher.py`。
- 不修改 V1 A/C/D 模块，不扩大 manifest host/optional permissions，不引入 V3-3+ 组件。

## 4. 停止条件

- 需要新增 Cookie 名、host permission、`<all_urls>` 或后台自动 capture。
- 需要由 UI 伪造 credentialed route failure 才能显示 capture。
- 真实工具/模型资产与冻结 hash 不匹配。
- 真实 B站正例不能从用户点击到 transcript 完成，或存在 Cookie/路径/音频残留。
- PCM 仅有容器或时长但全部为零采样；该情形必须按产品失败处理。
