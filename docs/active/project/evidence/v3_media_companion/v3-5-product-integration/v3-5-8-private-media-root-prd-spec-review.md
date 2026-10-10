# V3-5-8 PRD 规格检视

日期：2026-10-09。

## 结论

- 用户体验目标：恢复。用户无需理解或配置 Linux/Windows 临时目录；桌面 Companion 使用安全默认值。
- 安全规格：未回退。`0700/0600`、owner manifest、单硬链接、跨任务隔离与 0 secret hit 均保留。
- 架构边界：未偏移。仅改变 Runtime 私有媒体 artifact 的默认物理根；数据库、模型、Provider 密钥、Cookie lease 和公开 evidence 合同不变。
- 多门户开放性：保持。路径修复位于通用 `TaskArtifactSandbox` 配置边界，不写死 B站；未来 YouTube、小红书适配器共享同一私有根和校验。

原 UI “本机伴侣未启动”属于错误分类，不是 Runtime 事实。当前前端会保留 `Runtime connected`，并对 `V3_MEDIA_TEMP_FILE_MODE_INVALID` 给出“重启本机伴侣”的存储安全提示。

