# V3-1R 登录态真实站点回归重绑定开发计划

日期：2026-09-17。状态：`INTERNAL PLAN / IMPLEMENTATION AUTHORIZED BY RESUMPTION REQUEST`。

## 1. 目标

关闭 V3-1.2-A13：B站已把冻结字幕样本从匿名可见改为登录后可见。V3-1R 不改变产品合同，不替换 12 页分母，只让当前真实 Chrome 回归使用已经获批的 `user_authorized_live_session_seed` 证据类别。

## 2. 修改范围

只修改：

- `apps/chrome-extension/e2e/v3-media-page-collector.mjs`
- `apps/chrome-extension/e2e/v3-media-page-verify.mjs`
- 本子阶段计划、验收卡、PRD 检视和审计证据。

产品 `MediaPortalAdapter`、session broker、manifest、Runtime 和 UI 均不因本修复改变。

## 3. 实施顺序

1. collector 增加显式 `NAVIA_V3_AUTHENTICATED_REGRESSION=1` 模式；默认匿名模式保持不变。
2. 只从用户已授权文件读取冻结九名 B站 Cookie，在内存中过滤后写入全新 disposable profile；不得复制主 profile。
3. 打开冻结锚点并验证 B站 nav 为 HTTP 200、code=0、isLogin=true；失败立即终止。
4. 在同一 profile、同一 run 顺序采集原 12 个 URL。字幕样本允许等待 MAIN bridge 的凭据 WBI 结果，但不得从标题、简介或旧证据补 transcript。
5. 截图使用 1280x1000 viewport、裁切顶部 100 px 后保留 1280x900，排除账户头像/顶栏区域；不得记录昵称、UID 或完整响应。
6. verifier 独立检查 evidence class、服务端有效性、12 页身份、字幕/受限/锚点语义、截图裁切、hash、普通页 Route A、seek、清理和秘密扫描。
7. 运行全量测试、typecheck、build、Route A 静态审计和单 run 真实 Chrome 12 页矩阵。

## 4. 不变式

- 不降低 6 subtitle + 3 ASR + 1 multipart + 1 restricted + 1 degraded 分母。
- 不修改 revision 1 registry 原始字节或 hash。
- 不把登录态证据冒充匿名能力；结果必须显式写 `user_authorized_live_session_seed_regression`。
- 不公开 Cookie 名称列表、值、可逆 hash、账号身份、会话文件路径或顶栏截图。
- 不通过 CDP grant permission，不调用产品 Cookie 文件读取，不进入 V3-1.3 envelope/lease。
- 任何原始 Cookie 值命中 run、build、log、JSON 或 PNG 都失败。

## 5. 停止条件

服务端会话无效；任一字幕样本仍不可用；截图不能稳定排除账号顶栏；秘密扫描命中；12 页身份漂移；profile/Chrome 残留；或需要修改产品合同、权限和分母时，停止并回到文档阶段。
