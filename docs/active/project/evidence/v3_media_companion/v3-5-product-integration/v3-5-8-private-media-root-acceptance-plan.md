# V3-5-8 本机媒体私有目录修复验收计划

日期：2026-10-09。固定真实样本：`https://www.bilibili.com/video/BV1ZpYd66ELP`。

| ID | 操作 | 必须结果 |
|---|---|---|
| A01 | 不设置媒体目录环境变量启动桌面 Companion | acquisition root 位于 WSL home 私有缓存，不位于 `/mnt/c` |
| A02 | 创建任务和写入字幕/媒体 artifact | 目录 mode=0700、文件 mode=0600，sandbox 校验通过 |
| A03 | 人工制造不安全 artifact root 并执行 | 返回结构化 `V3_MEDIA_TEMP_FILE_MODE_INVALID`，无裸 ASGI traceback |
| A04 | 打开真实 B站侧栏 | Runtime 保持在线，自动 session/lease/acquisition 不误报未启动 |
| A05 | 执行真实采集 | execute 不因目录权限返回 500，并至少进入 processing/input-acquired/明确的机器 fallback |
| A06 | 结束流程 | task 私有目录按合同清理；公开材料 secret scan=0 |
| A07 | 回归 | Runtime 定向测试、前端错误映射测试、typecheck/build 通过 |

失败时不得以关闭 mode 校验、把目录改回仓库、吞掉异常或伪造 projection 通过验收。

