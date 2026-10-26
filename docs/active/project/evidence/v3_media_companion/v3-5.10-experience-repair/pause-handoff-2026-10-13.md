# V3-5.10 Stage A 暂停与恢复交接（2026-10-13）

状态：`PAUSED_BY_USER`。本文件只保存当前进度，不授予继续实现或测试的权限。

## 1. 当前门禁

- 长期目标“推进全部 V3 阶段的自动化开发至人工验收门限”尚未完成。
- Stage A 固定分母 NJ-01..NJ-10 中，NJ-07 / NJ-08 已有受限真实 Chrome 证据。
- NJ-09 负态四视口矩阵仍未通过；NJ-10 独立对账尚未开始。
- 不得据此声明 Stage A、V3-5.10 或完整 V3 PASS。

## 2. 已保留的有效证据

- `first-use-runs/20261012T150728291Z-navigation-result.json`
  - SHA-256：`8e2ea09d40d12ccf86241b78460aef4edceea3158bace4185b86c1529cc9ff4a`
  - 仅证明 NJ-07 / NJ-08 的证据返回、直开边界、对话框初始焦点、焦点环和关闭后焦点恢复。
- `first-use-runs/20261012T143540249Z-watchdog-result.json`
  - SHA-256：`7a39d3fd9a54f51b64c2831f1b500abd892afd5891cb2b43e4748588faac6318`
  - 仅证明 active + created 看门狗路径，不是完成任务或 Stage A 出门证据。

## 3. 最新失败与诊断结论

最新保留失败：

`first-use-runs/20261013T094741843Z-stage-a-failure.json`

真实任务 `media_task_1d7e5139e69a4ea3b7338fb1acfdb8ad` 在 outline `ready@revision=7` 后：

1. 第一次 outline 与 comprehension 读取均快速返回 200。
2. 约 3.4 秒后组件再次读取同一 outline，仍返回 `ready@revision=7`。
3. 随后的第二次 comprehension 请求未在 20 秒诊断窗口内返回。
4. UI 因此停留在 `.media-workspace-loading`，`.media-quality-control > button` 不存在。
5. Runtime stderr 只有正常启动信息，没有对应应用异常。

这表明 NJ-09 当前不是普通 ready 状态轮询失败，而是 Workspace 读取流程被二次触发后悬挂。优先假设是本机安全会话 bootstrap / token generation 变化造成 `runtimeConnected` 瞬态切换，进而重启 `MediaWorkspaceShell` 的读取 effect；该假设尚未证实。

## 4. 暂停点代码状态

- `apps/chrome-extension/e2e/v3-media-experience-stage-a-fresh.mjs`
  - 当前 SHA-256：`de49f8f6ead5c28c8e153eca14af2a434183f11d4a14d1260c876d33fc7ab9ee`
  - 已覆盖 NJ-09 四个负态 × 360/420/768/1280：直开证据详情、综合生成同意对话框、无效章节恢复、合法形状但不存在的任务。
  - 固定检查为：零水平溢出、Axe serious/critical 为零、截图像素非空、状态特定控件或消息可见。
  - 已增加 outline / comprehension 请求时间线和 Runtime 尾部诊断。
  - 暂停前最后一处改动把 `/v1/companion/sessions` 与 `/v1/knowledge/permissions` 加入同一 HTTP 时间线，用于验证是否发生第二次安全会话 bootstrap；这处改动尚未执行，也未在暂停后运行 `node --check`。
- 主计划：`stage-a-negative-journey-development-and-acceptance-plan.md`。
- 工作树包含大量既有未提交实现、测试、文档和构建产物；全部原样保留，不得在恢复时 reset、checkout 或清理。

## 5. 恢复顺序

用户明确要求继续后，按以下顺序恢复：

1. 读取本文件、Stage A 主计划、最新失败 JSON，并检查工作树和残留进程。
2. 对 runner 执行 `node --check` 与 `git diff --check`；不得先改超时或减少 NJ-09 分母。
3. 只运行一次隔离、静音的 NJ-09 诊断，确认第二次读取前是否出现新的 companion session / permission 请求。
4. 若确认 token/bootstrap 重入，优先修复会话状态或请求生命周期，并保留断连、认证失败时隐藏受保护内容的安全边界；不得把真实断连误报为已连接。
5. 若没有会话重入，则继续定位 `MediaWorkspaceShell` 读取 effect 的重新触发来源，先补最小生命周期证据再改产品代码。
6. NJ-09 全矩阵通过后再做 NJ-10 独立对账；失败产物必须保留，不得用普通 outline 的四视口结果替代负态结果。

恢复运行参数：

```bash
xvfb-run -a env \
  NAVIA_STAGE_A_NAVIGATION_CHECK=1 \
  NAVIA_STAGE_A_CHECK_WORKSPACE=1 \
  NAVIA_STAGE_A_EVIDENCE_ROOT=/mnt/c/workspace/navia/docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/first-use-runs \
  node e2e/v3-media-experience-stage-a-fresh.mjs
```

工作目录：`apps/chrome-extension/`。

## 6. 不可违反的测试约束

- 所有真实 Chrome 测试必须显式带 `--mute-audio`；`xvfb-run` 本身不静音。
- 恢复前先确认 runner 内仍保留 `--mute-audio`，否则拒绝启动浏览器。
- 不播放视频声音，不抢占用户现有浏览器，不复用用户 profile。
- 当前没有 Stage A runner、Xvfb 或 Navia Runtime 残留进程。
- Axe 自动检查不能替代真实屏幕阅读器验收；不得据此声称完整 WCAG 2.2 AA 合规。

## 7. 自动化开发停止原因

用户于 2026-10-13 明确要求暂停并保存进度。停止属于主动暂停，不是通过、失败关闭或技术阻塞判定。
