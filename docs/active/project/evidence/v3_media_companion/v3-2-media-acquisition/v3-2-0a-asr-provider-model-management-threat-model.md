# V3-2-0a ASR 模型供应链与安装威胁模型

日期：2026-09-21。状态：`FROZEN FOR IMPLEMENTATION`。

| ID | 威胁 | 强制控制 |
|---|---|---|
| AM-T01 | 任意 URL/SSRF/本地路径读取 | URL 仅来自 build-time catalog；API 不接收 URL/path |
| AM-T02 | 模型资产漂移或投毒 | 固定 revision、逐文件 byteLength/SHA-256、失败不发布 |
| AM-T03 | 半安装版本覆盖可用版本 | staging + self-test + atomic rename；旧 ready 版本保留至提交 |
| AM-T04 | zip-slip/symlink/hardlink 离线包 | 只允许普通文件和 manifest；规范化相对路径；拒绝 link 和越界 |
| AM-T05 | 压缩炸弹/磁盘耗尽 | compressed/uncompressed/file-count/单文件/总量上限，写前后容量检查 |
| AM-T06 | UI 假进度 | 进度来自 Runtime 已写 bytes；未知 total 明示 indeterminate |
| AM-T07 | 取消后继续写入 | cancel token、关闭流、清 staging、终态后 observation 不增长 |
| AM-T08 | 静默 fallback | requested/effective/fallbackReason 必须同时显示和返回 |
| AM-T09 | 最低模型冒充质量通过 | catalog 固定 `fallback_only=true`；验收和报告拒绝计入 A06 |
| AM-T10 | provider 动态代码执行 | provider closed-set；不安装用户 wheel、不导入包内 Python |
| AM-T11 | 许可证未确认模型可安装 | qualification_required 模型 installable=false |
| AM-T12 | 路径/凭据泄漏 | API 只返回相对 artifact id；日志和公开证据扫描绝对路径/secret 0 hit |

模型下载与离线导入不读取浏览器 Cookie，不与 V3-1.3 credential lease 共用通道。任何需要管理员权限、执行安装脚本或关闭 hash 校验的恢复方案均为 NO-GO。

