# V3 Media Companion 内部审计第三轮：交互、视觉与原型证据

日期：2026-09-17  
范围：V3-0 文档候选、确定性交互原型、自包含审查页、四张操作指引截图与 8 页 Draw.io。  
边界：本轮只验证文档和 review prototype；没有实现或运行 V3 媒体产品能力，没有访问真实 Cookie、下载真实视频、执行 ASR/OCR/VLM 或声明锚点视频已被理解。

## 1. 审计问题

本轮针对上一轮 Cookie 主路径修订后的三个剩余风险执行独立复核：

1. 当前页面基线是否使用真实 Mock 阻塞截图，而非将 V2 mock 写成可用知识服务。
2. Cookie 主路径、公开字幕回退和可信 `tabCapture` 回退是否能由人类在原型中逐步辨认并操作。
3. 自包含页面、四视口、键盘与 Axe 是否有新鲜浏览器证据，而非复用 no-cookie 候选结果。

## 2. 本轮发现与闭环

| ID | 级别 | 发现 | 修订 | 复核结果 |
|---|---|---|---|---|
| R3-M01 | Major | 原审查页使用的 Side Panel 基线图显示 `data_service connected`，与人工验收时看到的 V2 mock 阻塞事实不一致 | 换成用户提供的真实截图 `baseline-sidepanel-mock-blocked.png`，并在 PRD、架构和原型中明确 V2 mock 不得作为 V3 输入或完成证据 | CLOSED |
| R3-M02 | Major | 原 AI 目标样张出现错误视频和 V3 范围外的素材库/笔记/项目存储，可能让实现者误读范围 | 从权威审查页移除 AI 图；改为确定性 HTML/CSS 总体设计和模块设计，AI 图不再承担实体、文案、路由或验收事实 | CLOSED |
| R3-M03 | Major | Cookie 失败后的 `tabCapture` 回退缺少可操作的可信点击停点，无法证明不会自动捕获 | 新增三种审查情景、`trustedCapture` 按钮和 pending 状态；没有可信点击时流程不前进 | CLOSED |
| R3-M04 | Major | 自包含文件用字符串 replacement 内联 Lucide 时，压缩代码中的 `$$` 被替换成 `$`，浏览器出现 `Identifier '$' has already been declared` | 生成器改用函数 replacement，重新生成自包含文件；隔离 Chrome 上 console/page error 为 0 | CLOSED |
| R3-m01 | Minor | `06-tab-capture-fallback-420.png` 初次生成时实际选中了 768 宽 | 用同一系统 Chrome 会话重新选择 420，确认 `device` 计算宽度为 420px 后重拍并更新 hash | CLOSED |
| R3-m02 | Minor | 原型曾有重复 `main` landmark | 详细架构画布改为普通容器，Axe 重跑 0 violations | CLOSED |

## 3. 新鲜浏览器验证

验证环境：Windows 系统 Chrome 152，通过 CDP 从仓库 Playwright 1.60.0 驱动；原先 bundled Chromium 缺失 `libnspr4.so` 的启动失败保留为历史基础设施记录，不再阻断本轮审查。

权威结果文件：

```text
docs/active/project/design/v3-media-companion-prototype-review/
  screenshots/prototype-qa-results.json
```

验证结果：

| 检查 | 结果 |
|---|---|
| 五项授权文案、Cookie 主路径、公开字幕回退、可信 capture 回退 | PASS |
| 授权刷新后仍存在，撤销后阻止后续任务 | PASS（review prototype 状态机） |
| 未可信点击前不自动进入 tab capture | PASS |
| 可信点击后流程完成并允许打开 Workspace | PASS |
| 360 / 420 Side Panel，768 / 1280 Workspace 横向溢出 | 0 |
| 键盘授予、Tab 遍历和 H01-H10 回填控件 | PASS |
| Axe serious / critical / total violations | 0 / 0 / 0 |
| console error / page error | 0 / 0 |
| 权威页面中的 AI 参考图引用 | 0 |
| 自包含页面外部 `src` / `href` 资源 | 0 |

四张操作指引截图均由同一原型和浏览器生成：

```text
ca4aef9d6a84f594823811364369c4c6d875e8518ed7585af144480d3cf837ed  01-sidepanel-420.png
15852d4fcbe94263c88d4b03cdc08cd03d776a463801745319c0f02e336ca099  06-tab-capture-fallback-420.png
2743209dd4a98ba7006a1ab943ff35a77dc5ff66b882dbf9f91398314a477763  03-workspace-1280.png
6ba9b4736d226689194d09be03686f7814382debe411da272e284e07fbadfe05  04-workspace-768-ask.png
```

这些截图只证明原型呈现和操作说明，不证明真实 B站页面、媒体下载、ASR、OCR、VLM、seek 或任务存储已经实现。

## 4. Draw.io 复核

独立 XML 解析结果：8 页、113 个 vertex、53 条 edge；全局重复 ID 0、每页重复 ID 0、断裂 source/target 0、1600x900 越界 0。

本轮额外核对：

- 第 01 页 `MediaTaskStore` 已由“已实现”颜色纠正为“V3 待新增”。
- 第 04 页同时显示 Cookie 短租约、公开/页内字幕和可信 `tabCapture`，并标明清理终态。
- 第 06 页只允许冻结 commit 下六个文件作 reference-only 研究，不承诺整仓复制。
- 第 08 页包含用户场景、操作、预期、证据和出门判定，不是“三无验收”。

## 5. PRD 规格检视

原型没有新增 PRD 外产品承诺。所有大纲、证据、Ask 和时间点都标为“目标示例/非生产证据”；锚点视频标题只用于稳定界面身份，不将虚构摘要写成视频事实。Query、Graph、Durable Forget、知识导入与自动知识维护继续属于 V4，不进入 V3 出门条件。

## 6. 结论

```text
Fatal: 0
Major: 0
Minor: 0
V3-0 interaction/visual document candidate: INTERNAL PASS.
V3-1..V3-7 product implementation: NO-GO.
```

本轮关闭的是交互说明和视觉审查风险，不消除 B站平台、真实账号、Cookie 名称、媒体获取和模型质量的实现期风险。
