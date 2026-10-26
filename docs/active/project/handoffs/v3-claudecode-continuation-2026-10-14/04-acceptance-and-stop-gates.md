# 验收与停止门禁

## 固定硬门禁

- 所有自动化测试不得播放声音；Chrome 必须显式包含 `--mute-audio`。
- 新 run 不得复用旧 Runtime、database、Chrome profile、task ID 或派生产物。
- 六个固定 BVID 不得替换、删减或跨 run 拼接。
- 单任务只能使用一个 Provider；不得跨 Provider 拼接、最佳 N 选一或隐式 fallback。
- 只允许上传派生 transcript/OCR/vision-caption 文本。
- 原始视频、音频、帧、Cookie、API key、凭据内容和本地路径上传计数必须为 0。
- secret scan 必须 0 命中。
- 两个或以上 BVID blocked：立即 NO-GO。
- 任务取消、超时、Runtime 崩溃和进程中断后必须证明 Chrome/Runtime/profile/temp/cache 清理完成。

## 内容质量门禁

- brief 必须凝练而非转写拼接；章节时间覆盖合理且单调。
- claim 必须能追溯到 evidence；截图不得与时间戳/论点错配。
- 大纲、时间线、导图必须表达不同信息结构，不能只是同一转写列表换皮。
- 宿主 LLM 必须独立检查错误、无关、概括不足、证据不足和章节失衡。
- B-7 人工质量验收之前不得声明 Stage B 或 V3 PASS。

## 外审规则

- 主干开发窗口不得自己签署独立 PASS。
- 外审窗口只读复算；除指定报告外不得修改工作树。
- external-audit-package 每轮必须先清空，平铺且总数 <=20，不能混入旧轮次文件。
- Fatal/Major 任一非 0：返回开发阶段，不得继续下阶段。
