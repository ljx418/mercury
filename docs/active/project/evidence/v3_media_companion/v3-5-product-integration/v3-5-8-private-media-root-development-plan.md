# V3-5-8 本机媒体私有目录修复开发计划

日期：2026-10-09。触发事实：人工流程的 acquisition 已创建，但 execute 在 Windows 挂载盘上的任务目录触发 `V3_MEDIA_TEMP_FILE_MODE_INVALID`。

## 根因

默认媒体目录继承 `NAVIA_DB_PATH` 所在目录；仓库位于 `/mnt/c`，DrvFS/NTFS 不能可靠表达 Runtime 要求的 POSIX `0700/0600` 私有权限。该失败被未捕获为 ASGI 500，前端又把随后状态变化误报为“本机伴侣未启动”。

## 实施

1. 未显式配置时，将媒体 acquisition 与 ASR 临时根迁到 WSL 用户私有缓存目录 `~/.cache/navia/`。
2. 保留 `NAVIA_MEDIA_TASK_ROOT`、`NAVIA_MEDIA_ASR_TASK_ROOT` 覆盖接口，E2E 隔离输入不变。
3. endpoint 捕获 `TaskArtifactError` 并返回结构化 FailureCode，不允许裸 500 traceback 成为客户端合同。
4. 前端保留 Runtime 在线状态，并将目录安全错误解释为本机存储配置问题。
5. 重启 Companion，清理本轮失败任务的临时目录，然后重新执行真实 B站流程。

## 不变边界

- 不放宽目录 `0700`、文件 `0600`、单硬链接、owner manifest 或跨任务隔离校验。
- 不把 Cookie、字幕、音频或截图写入公开 evidence。
- 不改变数据库、模型缓存、Provider 密钥或用户知识的现有路径。

