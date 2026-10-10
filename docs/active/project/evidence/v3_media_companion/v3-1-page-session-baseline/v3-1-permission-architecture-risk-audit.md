# V3-1 权限架构实施前风险审计

日期：2026-09-17。结论：`ROUTE A SELECTED / REMEDIATION IN PROGRESS / PRODUCT CODE NO-GO UNTIL REAUDIT`。

## 1. 发现

### Major V3-1-M01：V3 无全站权限门禁与 V1 常驻入口不可同时成立

冻结要求：

- `01-prd.md` 要求 Chrome 只请求可选 `cookies` 与 `https://*.bilibili.com/*`；
- V3 A13 要求权限中不存在 `<all_urls>`；
- V3 stage gate 把 `<all_urls>` 列为 No-Go。

当前实现：

- `wxt.config.ts` 的 `host_permissions` 包含 `<all_urls>`；
- `entrypoints/content/index.ts` 静态注入匹配 `<all_urls>`；
- `web_accessible_resources.matches` 包含 `<all_urls>`；
- `background/index.ts` 在 tab complete/activate 时尝试注入内容桥；
- V1 交互 PRD 要求插件启用后普通网页默认出现可移动常驻 launcher。

Chrome 官方权限模型说明 `activeTab` 只在用户调用扩展后临时授予当前标签页权限。静态或程序化地在用户手势前为任意普通网页注入脚本，需要相应 host/content-script 匹配权限。将 `<all_urls>` 改写为 `http://*/*` 与 `https://*/*` 仍然是语义等价的全站权限，不构成修复。

因此当前没有同时满足以下三项的实现：

1. 所有普通网页在未点击扩展前自动显示 launcher；
2. manifest/content script 不申请任何全站匹配权限；
3. 不改变 Chrome 平台权限模型。

## 2. 路线比较

### 路线 A：V3 隐私优先，推荐

实现：B站详情页采用窄域静态桥接；普通网页移除全站静态注入，改为点击扩展/快捷键后借助 `activeTab` 注入并打开 Navia。`web_accessible_resources` 同步缩窄。

优点：严格满足 V3 A13；最小权限；V3 B站首发无需额外全站授权；被攻破时影响面更小。

代价：V1 普通网页从“默认常驻 launcher”变为“首次点击/快捷键后进入”，属于可见交互变化。普通网页读取、总结、Mindmap 能力仍可在用户激活后保留。

所需文档动作：修改 V1 交互 PRD 的当前基线、主 PRD、架构、V3 ADR/Draw.io 和验收；重新做独立文档审查后实施。

### 路线 B：V1 体验优先，保留当前全站静态注入

实现：保留 `<all_urls>` 以维持普通网页默认 launcher；V3 Cookie API 仍仅使用可选 `cookies` + B站 host，并在代码所有权与扫描规则上隔离。

优点：V1 可见体验不退化；对现有 content bridge、页面阅读 E2E 和 Side Panel 影响最小。

代价：必须修改 V3 A13 和 No-Go，把禁止项限定为“V3 Cookie/媒体获取不得申请全站权限”；扩展整体仍拥有广泛网页注入能力，安全影响面不满足现有文字承诺。

所需文档动作：修改主 PRD、V3 验收、ADR、stage gate、Draw.io 和权限扫描算法；重新独立文档审查后实施。

### 路线 C：用户可选的全站常驻模式

实现：默认采用路线 A；设置中允许用户主动授予全站可选 host 权限，授予后动态注册普通网页 launcher。B站 Cookie 权限仍独立、窄域、可撤销。

优点：默认最小权限；需要 V1 常驻体验的用户可显式恢复；授权意图清晰。

代价：manifest 仍需声明语义上的可选全站 host；现有 V3 A13 仍需修改；权限、动态脚本、撤销和升级测试复杂度最高。

所需文档动作：新增第六类独立“普通网页常驻访问”授权，不得与五项媒体授权合并；修改 V1/V3 PRD、架构、设置、撤销、A13 和 Draw.io，重新外审。

## 3. 审计判断

推荐路线 A，因为它与 V3 B站优先、最小权限和用户主动处理媒体的方向一致，并保留普通网页的按需能力。但路线 A 会改变已经落地的 V1 入口，不能由实施代理自行决定。

路线 B 技术改动最小，但会实质放宽已经独立审查通过的 V3 安全门禁。路线 C 提供最多用户选择，却引入当前阶段不必要的授权与动态注册复杂度。

## 4. 出门前置

用户已明确选择路线 A，并要求通用 adapter 支持后续门户。恢复条件为：

1. 同步修改所有权威文档和 Draw.io，不能只改 stage gate 一处；
2. 重建不超过 20 文件的外部审计包；
3. 独立审查达到 Fatal=0/Major=0；
4. 再开始 `v3-1-development-plan.md` 的产品代码。

在重新独立审查前，V3-1 产品代码保持 `NO-GO`，V3-1P 的 PASS 不受影响。

## 5. 事实来源

- Chrome Extensions：Declare permissions，https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions
- Chrome Extensions：The activeTab permission，https://developer.chrome.com/docs/extensions/develop/concepts/activeTab
- Chrome Extensions：Scripting API，https://developer.chrome.com/docs/extensions/reference/api/scripting
- Chrome Extensions：Match patterns，https://developer.chrome.com/docs/extensions/develop/concepts/match-patterns
