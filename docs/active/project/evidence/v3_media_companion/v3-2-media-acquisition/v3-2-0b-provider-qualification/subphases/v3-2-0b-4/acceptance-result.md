# V3-2-0b-4 Settings 与真实 Runtime 安装链验收结果

日期：2026-09-22  
accepted runId：`v3-2-0b-4-20260922T054533694Z`

```text
B04-01..B04-16: 16/16 PASS
independent read-only verifier: 12/12 PASS
Runtime full pytest: 321 passed
frontend typecheck/test/build: exit 0 / exit 0 / exit 0
Fatal=0 / Major=0 / Minor=0
V3-2-0b-4: PASS
```

真实 Chrome 通过设置页按钮调用真实 Runtime；未使用 Playwright route intercept。Runtime 从冻结的 GitHub/Hugging Face 地址处理 `246,664,010` bytes，状态历史严格为 `checking -> downloading -> verifying -> self_testing -> installing -> ready`，发布目录仅含三个冻结文件且大小与 SHA-256 全匹配。

候选安装后仍为 `qualification_pending/selectable=false`，实际生效模型在安装前后均为 `faster-whisper-tiny`。完成 360/420 Side Panel、768/1280 Workspace、安装弹窗共五个 Axe 面，`serious=0/critical=0`；键盘焦点在 ready 后关闭弹窗可返回同模型“卸载”按钮。卸载后候选目录、Runtime、Chrome profile 和 staging 全部清理。

证据：

- `runs/v3-2-0b-4-20260922T054533694Z/result.json`
- `runs/v3-2-0b-4-20260922T054533694Z/prerequisites.json`
- `runs/v3-2-0b-4-20260922T054533694Z/verification.json`
- `runs/v3-2-0b-4-20260922T054533694Z/screenshots/`（6 张）

首轮 `v3-2-0b-4-20260922T053900243Z` 保留为 runner 自检误报失败，不得用作 PASS 输入。
