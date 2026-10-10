# V3-5-7 侧边栏一键媒体流程开发计划

日期：2026-10-09。授权来源：用户明确要求简化侧边栏，使其打开后即可使用，隐藏正常路径中的授权刷新、Runtime 手动连接和安全租约操作。

## 目标体验

1. 首次在 B站视频页打开 Navia 时，Chat 只显示一个“启用并分析当前视频”主动作；该动作直接触发 Chrome 必需的站点/Cookie 权限请求。
2. 用户已经授权时，打开侧边栏后自动读取授权、连接本机 Runtime、建立任务级安全租约并开始媒体采集，不再要求点击“刷新状态”“重新连接”“开始分析”。
3. 浏览器因无字幕而要求可信 tabCapture 时，仍保留一次明确的用户手势；该限制来自 Chrome 安全模型，不得伪造或绕过。
4. 撤销授权、Runtime 停止和诊断信息移入“连接与隐私设置”，不占用 Chat 主流程。

## 实施范围

- 新增一个交付级统一启动组件，聚合授权、Runtime、安全租约和采集状态。
- `LocalRuntimeAccess` 增加自动模式：保留自动 bootstrap 和状态回调，隐藏日常路径中的连接/断开/停止按钮。
- 侧边栏增加单次自动编排状态机和防重复启动保护；每次建立租约前重新读取 policy/capability，避免使用陈旧状态。
- 把底层 FailureCode 映射为用户可执行的中文信息；技术码仅在折叠诊断区显示。
- 更新真实 Chrome V3 acquisition runner，证明授权后无需手动连接 Runtime 或点击“开始分析”。

## 不变边界

- 不静默申请 Chrome optional permission；首次授权必须来自用户点击。
- 不放宽 Cookie allowlist、一次性 lease、60 秒生命周期、Runtime origin 绑定或 secret scan。
- 不自动触发 trusted tabCapture；Chrome 要求该动作必须由当前用户手势发起。
- 不删除设置页中的撤销/停止能力，不改变 Workspace 审计工作流。

## 交付文件

- `apps/chrome-extension/src/modules/media_companion/MediaCompanionLaunchCard.tsx`
- `apps/chrome-extension/src/modules/media_companion/tests/MediaCompanionLaunchCard.test.tsx`
- `apps/chrome-extension/src/modules/knowledge_workspace/LocalRuntimeAccess.tsx`
- `apps/chrome-extension/entrypoints/sidepanel/main.tsx`
- `apps/chrome-extension/entrypoints/sidepanel/style.css`
- 对应真实 Chrome runner 与本目录验收/PRD/审计证据。

