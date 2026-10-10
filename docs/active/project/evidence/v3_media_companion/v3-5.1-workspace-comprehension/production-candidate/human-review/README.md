# V3-5.1 固定候选人工质量复核

本目录绑定 `v3-5.1-production-candidate-20261010T210000Z`。自动化不得填写或提交判断。

## 最小操作

1. 双击仓库根目录 `Start Navia V3-5.1 Review Runtime.cmd`，保持窗口运行。
2. 在已安装 Navia 的 Chrome 打开 `https://www.bilibili.com/video/BV1ZpYd66ELP`，点击扩展图标一次。
3. 打开本目录 `index.html`。先复核三条视频共 36 个固定问答，再按页面底部完成锚点视频五步体验。
4. 如实填写审查者 ID，下载 JSON。不要手工改 JSON。
5. 把下载结果放回本目录并交给 verifier；没有文件时阶段保持 `HUMAN_REVIEW_PENDING`。

问题复核是质量门槛，不要求听写。发现明显错译、漏义、错主体或引用不能支持回答，应标记失败。任一体验动作无法完成应选 `BLOCKED`。

## 安全边界

- 固定 Runtime 使用私有候选数据库，不修改日常 Runtime 数据库。
- 页面不读取 Cookie、API key、日志或私有路径。
- 私有帧只供 Runtime 本机读取；公开目录不保存自动化截图。
- 测试生成的 `AUTOMATED_SCHEMA_TEST_ONLY` 提交只存在于 `/tmp`，不得作为人类结论。
