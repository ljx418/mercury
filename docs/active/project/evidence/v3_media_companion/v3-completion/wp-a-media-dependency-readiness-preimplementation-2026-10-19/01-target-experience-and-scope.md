# WP-A 目标体验与范围

## 用户体验

首次使用时，用户在 `Settings / 媒体与语音` 看到一个“媒体分析依赖”区域。Runtime 在线但依赖不完整时，只需点击一次“修复本机依赖”；进度连续显示检查、下载、校验、自检和启用。失败时按网络、空间、摘要、权限、自检或系统工具缺失给出具体下一步，不能只显示 `Runtime offline`。

日常使用时，依赖 ready 后不再出现额外授权或连接步骤。媒体任务优先字幕；需要受控媒体下载和本地 ASR 时，在任务开始或显式重试时绑定当前 verified generation。安装完成不得替换运行中任务使用的工具。

## 组件状态

| 状态 | 用户所见 | 可执行动作 |
|---|---|---|
| ready | 可以分析无字幕视频；显示已验证版本 | 重新检查 |
| action_required | 精确列出缺失/损坏项 | 修复本机依赖 |
| installing | 当前阶段、确定/不确定进度；可取消阶段显示取消 | 取消或等待原子提交 |
| failed | 固定失败类别及恢复建议；旧 ready 版本仍可用 | 重试 |
| Runtime offline | 启动 Navia 本机伴侣 | Runtime 恢复后自动重查 |

## 固定范围

- managed：`yt-dlp 2026.08.19`，只允许冻结 URL、`3,072,469` bytes、摘要和运行参数。
- system-verified：`ffmpeg 6.1.1-3ubuntu5` 与 `ffprobe`，只验证路径、版本、摘要和协议约束。
- delegated：SenseVoice 继续由既有 `AsrModelManager` 管理；本组件只聚合实际生效状态。
- 持久位置：可恢复工具放 Windows 持久 Navia 目录；不得只放 WSL 临时目录。状态接口不返回绝对路径。

## 明确非目标

- 不自动执行 apt，不接收客户端 URL/path/hash，不提供工具自更新。
- 不实现用户本地视频导入；该能力属于 WP-B。
- 不重新启用或证明 tabCapture；仍是 default-off experimental。
- 不改变 Cookie、密钥、媒体、转写、OCR 或视觉数据上传边界。
- 不把 WP-A 通过扩大为整个 V3 通过。

交互原型：`../../../../design/wp-a-media-dependency-readiness-prototype/index.html`。

