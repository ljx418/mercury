# V3-1 B站页面、会话与能力基线开发计划

日期：2026-09-17。状态：`V3-1.1 EXTERNAL LIMITED PASS / V3-1.2 DOCUMENT FREEZE`。本计划只覆盖 V3-1，不覆盖媒体下载、ASR、OCR、VLM、生成与最终 UI。

## 1. 已满足前置

- V3-0 文档候选已经独立审查，结论为 `DOCUMENT PASS`。
- 用户已授权进入实际开发阶段。
- V3-1P 已用全新 Chrome profile 探测 28 个真实 B站页面，并冻结 12 个唯一 URL 的 revision 1 注册表。
- 注册表 SHA-256 为 `b71588928db4a0cb371152999052ae6b511b076377df427d74e680119491d8c1`；固定锚点 `BV1ZpYd66ELP` 属于无字幕/ASR 类。

## 2. 原阻塞与路线 A 处置

冻结的 V3 A13 要求扩展权限中不存在 `<all_urls>`。当前实现却同时在以下位置使用 `<all_urls>`：

- `apps/chrome-extension/wxt.config.ts` 的 `host_permissions`；
- `apps/chrome-extension/entrypoints/content/index.ts` 的静态 content script；
- `web_accessible_resources.matches`；
- 构建产物 `chrome-mv3-unpacked/manifest.json`。

这些权限支撑 V1 PRD 的“普通网页默认出现常驻 launcher”。Chrome `activeTab` 只在用户点击扩展、执行命令等明确手势后提供当前标签页的临时权限，不能在用户尚未调用扩展时自动注入 launcher。用户已选择路线 A：B站详情页窄域自动桥接，普通网页改为 action/command + `activeTab` + 原生 Side Panel。

用户已选择路线 A。当前停点从“等待产品路线”变为“同步合同/Draw.io 并重新独立审查”；外审 Fatal/Major 清零后即可开始 V3-1.1。

## 3. 路线确定后的实现范围

### V3-1.1 媒体页面采集

新增 `apps/chrome-extension/src/modules/media_companion/`：

- `contracts.ts`：前端只读通用 `MediaPageContext`、能力状态和失败码；与冻结 Schema 对齐。
- `MediaPortalAdapter.ts`、`MediaPortalRegistry.ts`：构建期显式 adapter 接口和唯一匹配 registry。
- `docs/active/project/contracts/v3-media-portal-registry.json`：机器可读 adapter/权限/capability/identity 权威；构建与 validator 共同消费。
- `adapters/bilibili/BilibiliMediaPortalAdapter.ts`：首个实现；隔离 bvid/cid/播放器 DOM/API。
- `bilibiliUrl.ts`：规范化视频 URL、bvid、分 P 参数和 canonical URL。
- `bilibiliPageState.ts`：从当前页面、播放器状态和 B站公开接口响应提取 cid、part、duration、标题、UP 主与字幕能力。
- `adapters/bilibili/BilibiliMediaPortalAdapter.ts`：合并来源、保留来源 revision、拒绝标题/简介冒充字幕。
- `adapters/bilibili/BilibiliMediaPortalAdapter.test.ts`：DOM、SSR、API、分 P、页面变更与缺字段回归。

修改：

- `apps/chrome-extension/src/contentBridge.ts`：增加 `navia.media.collectPageContext` 消息；普通页面读取合同保持不变。
- `apps/chrome-extension/entrypoints/content/index.ts`：按获批权限路线注册媒体桥接。

### V3-1.2 授权与会话 Broker

新增：

- `session/PortalPermissionClient.ts`：只在扩展页面真实 click handler 内请求 registry 冻结的 optional permissions。
- `session/PortalSessionAdapter.ts`、`PortalSessionRegistry.ts`、`PortalSessionBroker.ts`：通用会话能力层；不含 B站字段、host 或 secret 名称。
- `session/MediaConsentPolicyStore.ts`：持久化 scope/revision/决定，不含 Cookie 值。
- `session/bilibili/bilibiliCookiePolicy.ts`、`BilibiliPortalSessionAdapter.ts`：版本化 9 名白名单；只在授权后派生无秘密 candidate capability。
- 对应单元测试：拒绝未授权读取、非白名单名称、伪造 host/值、撤销后读取、过期缓存和任何序列化 Cookie 值。

修改：

- `apps/chrome-extension/wxt.config.ts`：只按获批路线声明权限。
- `apps/chrome-extension/entrypoints/background/index.ts`：挂载通用 Broker 消息，保持 Side Panel/Workspace 无 Cookie 值访问能力。
- `entrypoints/sidepanel/main.tsx`：挂载 `MediaConsentCard`，只显示五 scope 和 `PortalSessionCapability`。

V3-1.2 不创建一次性 envelope，不连接 Runtime，不签发租约。Browser→Runtime 秘密传输与 `PortalCredentialLease` 继续属于 V3-1.3。详细权威为 `v3-1.2-session-broker-development-plan.md`。

### V3-1.3 Runtime 租约边界

新增 `services/local-runtime/navia_runtime/modules/media_companion/`：

- `contracts.py`：`BilibiliCredentialEnvelope` 输入和不含秘密的 `PortalCredentialLease(adapterId=bilibili)` 输出。
- `credential_lease.py`：同 task、短期、单次消费和到期/撤销。
- `credential_redaction.py`：日志、异常、Trace 和持久事件统一清除秘密。
- `routes.py`：认证 loopback 的一次性接收入口；不进入 retry queue。
- 单元/集成测试：租约 identity、过期、重复消费、撤销、错误路径和 0 secret persistence。

修改 `services/local-runtime/navia_runtime/app.py`，只注册受治理媒体路由；不实现 V3-2 下载。

### V3-1.4 双容器入口

- Side Panel 显示页面识别、字幕/会话能力、五项授权、开始按钮的可用性和明确失败原因。
- Workspace 只接收同一媒体 identity/task route，不在 V3-1 伪造分析结果。
- route direct-open/reload/Back/reopen 必须保持相同 `mediaPageRevision`；页面 identity 变化时失效旧上下文。

## 4. 明确不做

- 不下载字幕、音频或视频，不创建 cookiefile。
- 不调用 ASR/OCR/VLM/文本生成 Provider。
- 不生成 `VideoOutline`、时间线、Mindmap 或 Ask 结果。
- 不把 V3-1P probe、原型或 BiliNote 输出计为产品实现。
- 不修改已封存 V2/PX/T02/T03/T04 证据。

## 5. 顺序与停点

1. 路线 A 同步 PRD/A13/ADR/合同/Draw.io，并重新独立文档审查。
2. V3-1.1 完成后，运行单元测试、真实 Chrome 12 页身份采集、PRD review、false-green audit。
3. V3-1.2 完成后，运行真实 Chrome 权限授予/拒绝/撤销，会话能力与秘密扫描。
4. V3-1.3 完成后，运行真实 loopback 单次 envelope/租约测试和全介质秘密扫描。
5. V3-1.4 完成后，运行双容器四视口、route 恢复、键盘与 Axe 验收。
6. 单一全新 run 通过 `v3-1-acceptance-plan.md` 后，才允许声明 `V3-1 LIMITED PASS` 并规划 V3-2。

任一子阶段出现 Fatal/Major、跨 run 拼接、Cookie 值可观察、权限未获批准或真实页面与注册表发生类别漂移，立即停止并回到计划阶段。
