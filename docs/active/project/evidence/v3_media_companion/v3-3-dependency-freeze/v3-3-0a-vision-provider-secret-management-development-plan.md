# V3-3-0a 视觉 Provider 密钥管理开发计划

日期：2026-10-08。状态：`IMPLEMENTATION AUTHORIZED`。

## 1. 范围

本子阶段只实现视觉 Provider 的配置与密钥保管基础设施，不执行 B 站证据帧分析，不改变 V3-3 的 10 OCR / 8 VLM 固定分母。

交付顺序：

1. 冻结 `VisionProviderConfig`、`SecretStore` 与 OpenAI Responses Vision adapter 边界。
2. Runtime 元数据只写 SQLite，API Key 只写操作系统凭据库。
3. 新增受 Companion Session 保护的 list/upsert/test/delete API。
4. Settings > 媒体与语音增加视觉模型设置、密码输入、保存并测试、删除入口。
5. 执行合同、负路径、Runtime、前端、typecheck/build 与 secret scan。

## 2. 实体与边界

- `VisionProviderStore`：Provider 非秘密元数据与状态；不得持有持久化明文。
- `SecretStore`：`get/set/delete` 最小接口；生产实现使用 Python `keyring`。
- `OpenAIResponsesVisionAdapter`：仅消费调用期密钥；默认模型 `gpt-4.1-mini-2025-04-14`。
- `VisionProviderSettingsPanel`：密钥仅保存在 React 临时 state，提交完成立即清空。
- API：`/v1/vision/providers*`，要求精确扩展 Origin 和进程级 Companion bearer。

## 3. 安全约束

- 禁止密钥进入 SQLite、`chrome.storage`、URL、响应、日志、异常、测试快照和公开证据。
- 系统凭据库缺失、锁定或使用 fail/null/plaintext backend 时 fail-closed。
- 不得静默回退到 SQLite 明文或环境变量持久化。
- Provider 测试只由用户显式点击触发；`store=false`、无工具、无文件、生成中性图。
- 当前 adapter 固定 OpenAI Responses；未来 Provider 通过新 adapter 注册，不以任意 URL 绕过 SSRF 边界。

## 4. 非目标

- 不迁移既有 DeepSeek SQLite 明文债务。
- 不执行真实 B 站抽帧上传。
- 不宣称 V3-3、V3 或 PX-6 通过。

