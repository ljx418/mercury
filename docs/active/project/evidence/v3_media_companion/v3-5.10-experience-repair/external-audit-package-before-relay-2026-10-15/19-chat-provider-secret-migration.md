# Chat Provider 安全密钥迁移与 DeepSeek 导入记录

日期：2026-10-14。授权：用户明确批准迁移 Chat Provider 密钥到系统凭据库，并从桌面 `dsKey.txt` 安全导入 DeepSeek；MiniMax 保持默认且 DeepSeek 不自动切换。

## 实现

- `SettingsStore` 必须注入系统 `SecretStore`，生产使用与 Vision Provider 相同的 Keyring / Windows Credential Vault fail-closed 路径。
- SQLite 的 `llm_providers` 只保留 `api_key_ref`、`secret_storage` 和不可逆展示掩码；`api_key` 兼容列清空。
- 启动时检测历史非空 `api_key`，先写系统凭据库，再以带旧值条件的 SQL 清空明文；迁移失败则 Runtime 启动失败关闭。
- 新建、更新、删除和测试统一通过凭据引用读取密钥；系统凭据库不可用时不回退明文。
- `clear()` 同步清理对应凭据引用，测试数据库保持隔离。

## 真实配置结果

| 项目 | 结果 |
|---|---|
| MiniMax Chat Provider | `prov_minimax_chat_primary`，默认与 Chat 当前选择 |
| MiniMax secret storage | `windows_credential_vault` |
| DeepSeek Provider | `deepseek-strict-tool`，模型 `deepseek-chat` |
| DeepSeek strict capability | `deepseek_beta_strict_tool_v1` |
| DeepSeek selected | false |
| DeepSeek secret storage | `windows_credential_vault` |
| SQLite DeepSeek 完整密钥命中 | 0 |
| SQLite MiniMax 完整密钥命中 | 0 |

桌面文件只作为本次用户授权的导入源，不复制到项目、日志、报告或测试 fixture。当前没有 Runtime 进程，无需终止；下次正常启动会读取新存储结构。

## 验收边界

- 本记录不授权自动切换 DeepSeek，也不上传真实视频派生内容。
- MiniMax 保持默认；DeepSeek 只有用户在 Settings 的 Chat Provider 中明确选择并保存后才参与媒体合成。
- 后续 B-5 开始前仍需记录单一 Provider 路由和真实数据授权状态。
