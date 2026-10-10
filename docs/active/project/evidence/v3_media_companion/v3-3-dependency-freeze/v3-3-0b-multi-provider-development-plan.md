# V3-3-0b 多视觉 Provider 开发计划

日期：2026-10-08。范围：只扩展 V3-3-0a 的视觉凭据和能力探测，不实施真实视频帧生产调用。

## 目标

用户可在 `Settings > 媒体与语音 > 画面理解模型` 选择 MiniMax 或 OpenAI、选择受控模型、分别保存密钥、运行中性图片能力测试并切换当前 Provider。MiniMax 默认为开放平台兼容性更广的 `MiniMax-M3`，M Plan 用户可选 `MiniMax-M3.1-Flash-Preview`；OpenAI 保留既有冻结模型。

MiniMax 合同依据官方文档：OpenAI-compatible base URL `https://api.minimax.io/v1`，多模态请求使用 `POST /chat/completions`、`image_url.url` Data URL 和 Bearer API Key。实现不得开放自定义 URL、任意模型或任意 adapter 类。

## 实施顺序

1. Runtime 增加闭集 Provider registry 与独立 `secretRef`。
2. SQLite 增加单例当前选择，不保存密钥。
3. 未经真实 capability test 的 Provider 不可选择；首个测试通过项自动成为当前项。
4. 实现 MiniMax OpenAI-compatible 多模态 adapter，并把返回归一为既有 typed observation。
5. Extension 增加 Provider 和模型选择器；保存、测试、选择、删除均经过 Companion session。
6. 补齐合同负例、组件测试、全量回归和两视口真实 Chrome QA。

## 边界

- 不读取或记录用户 API Key，不要求用户在对话框提供密钥。
- 不把中性 probe 扩大为真实视频帧授权。
- 不删除 OpenAI 路线；两个 Provider 可同时配置且互不覆盖。
- 不允许未测试 Provider 成为当前路由，不允许测试失败后静默回退。
