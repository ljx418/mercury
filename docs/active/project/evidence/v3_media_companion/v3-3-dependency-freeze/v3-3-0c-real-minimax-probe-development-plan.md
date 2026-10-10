# V3-3-0c 真实 MiniMax 能力探针开发计划

日期：2026-10-08。范围仅关闭 V3-3 的真实视觉 Provider 能力门禁，不计入 8/10 生产画面分母。

## 目标

1. 保留既有国际区 Provider ID，新增受控的 MiniMax 中国区 Provider；禁止任意 Base URL。
2. API Key 仅从设置页进入 Windows 凭据库，Runtime 数据库、扩展、日志和公开证据均不保存原值。
3. 使用 Navia 生成的无用户内容中性色块图执行一次真实 `MiniMax-M3` 多模态请求。
4. 测试通过后将中国区 Provider 设为当前项，并验证 Runtime 重启后选择、验证状态和凭据引用仍有效。
5. 国际区 401/403 必须给出区域不匹配提示；结构探针不得因模型推理文本或超长摘要产生假失败。

## 实施边界

- 允许：Provider 注册表、MiniMax 中性图适配器、设置页区域选择、脱敏 probe 和测试。
- 禁止：上传真实视频帧、读取 Cookie、把 probe 扩大为 V3-3 PASS、记录响应私有 ID 或密钥。
- 后续依赖：V3-3-1 必须重新从 V3-2 任务媒体建立绑定；本探针不能替代关键帧、OCR 或 consent ledger。
