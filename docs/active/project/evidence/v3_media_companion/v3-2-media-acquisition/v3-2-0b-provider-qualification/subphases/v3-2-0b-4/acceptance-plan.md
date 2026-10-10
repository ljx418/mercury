# V3-2-0b-4 Settings 与真实 Runtime 安装链验收计划

日期：2026-09-22。固定 `B04-01..B04-16`。

| ID | 操作 | 必须结果 |
|---|---|---|
| B04-01 | build/typecheck/frontend/runtime | 全部 exit 0 |
| B04-02 | 打开媒体与语音设置 | 四模型与 requested/effective/fallback 可见 |
| B04-03 | 查看 Paraformer 质量 | qualification_pending 明示；选择禁用、安装可用 |
| B04-04 | 查看资源 | Linux/Windows 下载、安装、1 GiB free、8 GiB RAM ceiling、8 CPU、0 VRAM 可见 |
| B04-05 | 点击下载并安装 | 请求进入真实 Runtime，无 Playwright route intercept |
| B04-06 | 查看状态历史 | checking→downloading→verifying→self_testing→installing→ready 顺序存在 |
| B04-07 | 校验发布文件 | 3 个冻结文件 hash 匹配，archive/script 不发布 |
| B04-08 | 安装完成 | 弹窗 ready；catalog installation ready |
| B04-09 | 查看实际生效 | effective 仍 Tiny；pending 不可选择 |
| B04-10 | 键盘操作 | tab/focus/dialog/Escape/按钮均可操作，焦点返回 |
| B04-11 | 自动失败说明 | 离线包三步和 CLI 命令仍可见（contract test） |
| B04-12 | 360/420 sidepanel | 无根溢出，文本不遮挡 |
| B04-13 | 768/1280 workspace regression | 无根溢出，无体验回归 |
| B04-14 | Axe | 四视口 + dialog serious/critical=0 |
| B04-15 | 卸载 | 候选删除，Tiny 保持 ready/effective，私有 staging/profile/runtime 清理 |
| B04-16 | PRD/秘密扫描 | 公开证据无 Cookie/audio/model/path；A06 未误报通过 |

旧 `v3-asr-model-settings-e2e.mjs` 的 route-intercept 安装进度不得作为 B04-05..09 证据。
