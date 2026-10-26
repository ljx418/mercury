# WP-B 目标体验与范围

## 用户问题

用户已经拥有当前视频文件，但自动字幕和受控下载失败时，现有产品只能重复自动分析或展示 experimental capture 说明。目标体验是：在同一 Side Panel、同一网页任务中选择一个本地视频，立即看到传输、校验、准备和分析进度，并最终进入既有视频工作台。

## 最小体验路径

1. 自动路线按既有顺序执行；失败后卡片显示“需要本地视频”，不启动 tabCapture。
2. 用户点击“选择本地视频”，浏览器原生文件选择器只允许单文件。
3. Extension 只保留本次 `File` 对象和 DOM 内文件名；先在本地拒绝 0 B、超过 2 GiB 和明显不支持类型。
4. Runtime 建立一次导入会话；页面显示真实上传字节、耗时和取消按钮。
5. Runtime 流式写入私有 staging，校验长度/SHA/container/video stream/duration/dimensions，准备 16 kHz mono WAV 和分布式候选帧。
6. 输入原子绑定到原 task/source identity，继续 SenseVoice、OCR、图文大纲、时间线和导图。
7. 原视频、WAV 和非证据帧在全部消费者完成 durable handoff 后清理；只保留既有策略允许的派生证据。

## 交互状态

`idle -> selecting -> awaiting_upload -> uploading -> verifying -> preparing -> transcribing -> materializing -> ready|degraded`

失败进入 `failed`，必须给出下一步；用户取消进入 `cancelling -> cancelled`。`selecting` 仅属于 Extension UI，不进入 Runtime 合同。Runtime 重启不恢复浏览器 File 权限，必须显示“请重新选择文件”。

## 组件要求

- `LocalMediaImportCard` 只在原任务已穷尽三条自动输入且尚无 terminal product 时出现。
- 首屏只显示一句原因、一个主按钮和隐私说明；技术码收纳在详情。
- 上传进度以 `loaded/total` 字节为真值；校验和准备阶段使用阶段名与计时器，不伪造百分比。
- 取消始终可达，terminal 后隐藏；错误文案分别覆盖大小、格式、损坏、时长、空间、Runtime 重启和清理失败。
- 同一文件重选允许创建新 importId；旧失败会话不可复活。

## 支持边界

- 单文件；声明 MIME 仅接受 `video/mp4`、`video/webm`、`video/x-matroska`、`application/octet-stream`。
- 权威判断来自 `ffprobe`，容器闭集为 `mp4|webm|matroska`，必须有有效视频流。
- `1 <= byteLength <= 2,147,483,648`；`1 <= durationMs <= 14,400,000`；最大 7680x4320。
- 只绑定当前已存在的 `portal:*` task；不得创建 `file:*` SourceAuthority，也不得替换页面身份。

## 隐私与非目标

- 不接收 `fileName/path/lastModified/webkitRelativePath`，不使用 `showDirectoryPicker`，不保存浏览器伪路径。
- 不读取用户未选择的任何文件；不后台重开文件；不把文件句柄写入 storage/IndexedDB。
- 原始媒体、WAV、未选帧截图不进入 Provider、知识库、日志、Trace、公开证据或错误响应。
- WP-B 不支持音频-only、批量、目录、URL 粘贴、断点续传、跨重启自动续传、云同步或媒体库。

交互原型：`docs/active/project/design/wp-b-explicit-local-media-import-prototype/index.html`。
