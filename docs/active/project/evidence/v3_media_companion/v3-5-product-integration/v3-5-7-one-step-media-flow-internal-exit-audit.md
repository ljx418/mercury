# V3-5-7 侧边栏一键媒体流程内部出门审计

日期：2026-10-09。审计类型：实现后内部独立复核（代码、测试、真实 Chrome 与证据边界）。

## 审计决定

`LIMITED PASS FOR ALREADY-GRANTED DAILY FLOW`。

- Fatal：0。
- Major：0（已授权日常路径）。
- Minor：2（首次 optional permission 的顶层承接、四视口/Axe 本轮复验）。

该决定允许用户对当前已授权 Chrome profile 开展人工体验复核；不允许把本结论扩大为首次安装全自动、trusted tabCapture 静默启动或 V3 全阶段 PASS。

## 代码审查

1. `MediaCompanionLaunchCard` 将三张技术卡合并为单一产品入口，正常态没有手动 Runtime 或 credential 按钮。
2. `LocalRuntimeAccess` 的 `automatic` 模式保留真实 bootstrap 与错误回调，但不渲染技术控制面。
3. sidepanel 自动编排会在授权、capability、Runtime 同时可用后启动，并用 in-flight/ref guard 防止重复创建。
4. credential 与 capture router 仅接受注册门户页面中的 `sidepanel.html?naviaInPage=1`；普通扩展页、未注册门户和外部 sender 继续 fail closed。
5. 未绕过 Chrome `activeTab`，也未降低 Cookie allowlist、lease 生命周期或 secret scan。

## 自动化与真实证据

- TypeScript typecheck：PASS。
- WXT E2E build：PASS。
- 相关 Vitest：7 files / 65 tests PASS。
- 真实 B站/Chrome/Runtime：PASS，`reached=processing`。
- 自动链路：Runtime session、credential channel、lease、acquisition 均有真实 HTTP 日志。
- secret scan：101 files / 45,053,896 bytes / 0 hit。
- 清理：Chrome profile、Runtime 进程和 secure task root 均清理。

## 风险复核

### 已关闭

- `V3_MEDIA_POLICY_NOT_GRANTED`：可信嵌入式 Navia surface 现在按注册门户和 sender tab 双重校验接受。
- 技术操作堆叠：刷新、连接和租约启动已退出 Chat 主流程。
- 重复启动：自动状态机只允许一个当前启动过程。

### 保留

- 首次 permission：Chrome 不保证从嵌入式扩展 iframe 显示 optional-permission 弹窗。后续应设计顶层首次启用承接页，且不得假装无需浏览器授权。
- 音频捕获兜底：`tabCapture.getMediaStreamId` 强制要求 extension invocation；正常主路径无需它，命中兜底时仍需一次工具栏调用。
- 本轮视觉门槛：四视口和 Axe 需单独补跑后才能把 V3-5-7 从 LIMITED PASS 升级为完整 PASS。

## 自动化开发停止原因

用户当前人工验收阻塞已经由真实 run 关闭；本子阶段在“已授权日常路径”范围内完成。自动化在此停止，是因为剩余两项涉及不同验收范围：首次安装的 Chrome 原生权限承接，以及本轮四视口/Axe 独立复验。两者不得用当前已授权单视口 run 假绿替代。

