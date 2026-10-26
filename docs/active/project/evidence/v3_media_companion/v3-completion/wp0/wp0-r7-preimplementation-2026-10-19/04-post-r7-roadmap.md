# R7 后续开发路线

## WP-A 媒体依赖就绪

目标：让受控下载真正成为稳定第二输入。增加 yt-dlp/ffmpeg/SenseVoice 状态检查、一次安装、冻结摘要验证、空间检查、失败分类、设置页管理和任务期清理。禁止任意下载 URL 和静默安装。

## WP-B 显式本地视频导入

目标：自动路线失败后，用户可选择已经下载的视频继续同一分析流程。

阶段：原型与 PRD -> API/SourceAuthority/隐私合同 -> 小文件 spike -> 100 MB/1 GB/取消/磁盘不足/损坏/重启矩阵 -> 产品实现 -> 人工体验。

边界：只允许用户手势选择单文件；不扫描目录；不保存浏览器伪路径；原始媒体不进入 Provider、知识库、日志或公开证据；durable ASR handoff 后按策略删除 Runtime 临时副本。

## WP-C tabCapture 重新资格化（可选）

仅当 WP-A/WP-B 仍不能覆盖关键用户场景且收益高于维护成本时启动。必须先完成两 Chrome 版本正控与真实 UI 启停矩阵；否则保持 experimental/default-off，允许最终删除用户入口但保留历史证据。

优先级：WP-A > WP-B > WP-C。

