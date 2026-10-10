# V3-2 受控媒体获取与本地 ASR 威胁模型

日期：2026-09-17。状态：`DOCUMENT CANDIDATE / IMPLEMENTATION NO-GO`。

## 1. 资产与信任边界

高敏资产：Cookie 原值、进程内 lease、capture ticket、Chrome streamId、原始音频/视频、私有 task path、账号身份。产品资产：page/source identity、字幕/ASR transcript、route/failure/cleanup records、模型与工具链 manifest。

边界：Host page/content script；Side Panel/Workspace；Background；Offscreen Document；loopback Runtime bearer API；专用 credential/capture capability；Runtime task sandbox；yt-dlp/ffmpeg/faster-whisper 子进程；公开 evidence package。

## 2. 威胁与控制

| ID | 威胁 | 控制 | 拒绝证据 |
|---|---|---|---|
| T01 | 任意 URL/SSRF/本地文件输入下载器 | URL 只能来自注册 adapter + page identity；协议/host/redirect 复核；私网/file/data 拒绝 | 负例 + network log |
| T02 | yt-dlp 配置/插件/exec 注入 | 隔离 HOME/config、固定可执行 hash、argv 无 shell、禁插件/exec/self-update | process argv audit |
| T03 | Cookie 出现在 argv/log/trace | 随机 `0600` cookiefile；redactor；公开合同无 path/value/hash | 原值 scanner 0 hit |
| T04 | cookiefile symlink/hardlink/path traversal | 随机 `0700` root；open/create no-follow；lstat/mode/link-count；owner manifest | 文件系统负例 |
| T05 | 跨 task lease/artifact 复用 | task/source/adapter binding；每任务目录；semantic validator | `V3_MEDIA_CROSS_TASK_REUSE` |
| T06 | 下载其他分 P/播放列表 | `--no-playlist`、显式 part/cid、request index | A07 |
| T07 | 资源耗尽/磁盘填满 | 音频/视频/任务配额、超时、子进程 watchdog、并发上限 1 | quota fault |
| T08 | DRM/付费/风控绕过 | 仅标准会话可访问响应；保护/限制返回 blocked；无解密/签名绕过 | restricted sample |
| T09 | Background 无用户操作 capture | fresh trusted click、30s one-shot ticket、可见 surface、sender/tab binding | background-autostart negative |
| T10 | 捕获错误 tab 或导航后继续 | tab hash + page identity；tab close/update listener；navigation stop | wrong-tab/navigation negative |
| T11 | streamId/ticket 重放或泄漏 | 私有内存、一次性消费、专用 WS、断线新点击、公开字段闭集 | replay/scan |
| T12 | offscreen 长期录音 | 900s 上限、active tracks registry、终态 stop、Chrome restart 清空 | activeCaptureCount=0 |
| T13 | 原始音频/视频持久化 | task-private only；ASR/终态 cleanup barrier；公开 tar deny | residual + tar scan |
| T14 | ASR 模型漂移/联网下载 | exact version/model revision/weights hash；预下载；production 网络禁用 | dependency manifest |
| T15 | ASR 幻觉或时间伪造 | 双模型盲评必须对照原视频、关键含义/critical 阈值、覆盖率、segment/hash/边界、空 transcript fail | A06/A11 |
| T16 | transcript 注入后续 UI/LLM | transcript 作为不可信文本；V3-2 不调用 LLM；未来 synthesis 转义并保留来源 | static boundary |
| T17 | 取消后子进程/写入继续 | shared cancel token、process group termination、event sequence cutoff | post-cancel observation=0 |
| T18 | Runtime crash 留 orphan | owner manifest、启动时限定 root 清理、绝不扫描用户目录 | restart fault |
| T19 | cleanup 失败仍成功 | cleaning 是强制 barrier；receipt 未通过不能终态成功 | schema/semantic negative |
| T20 | public evidence 暴露路径/账号/媒体 | closed Schema、path/value/name scanners、private/public index | A17 |
| T21 | 平台适配污染通用层 | `MediaAcquirer` 通用接口；B站字段只在 plugin；registry default deny | AST/static audit |
| T22 | 未来门户继承 B站权限 | 每门户独立 page/session/credential/acquisition policy 和真实矩阵 | unregistered fail closed |
| T23 | Service Worker stream ID 在不支持的 Chrome 或过期后被错误复用 | `minimum_chrome_version=116`；取得后立即由同 origin Offscreen 一次消费；失败要求新点击 | version/expired-stream negative |
| T24 | tabCapture 导致用户听不到原视频或形成静默录音 | capture stream 经 AudioContext 接回默认输出；回放失败即停止；UI 持续显示 capture | audible-playback observation |
| T25 | 多任务争用唯一 Offscreen Document | 普通 profile 并发 capture=1；`runtime.getContexts` 复核已有实例；task mismatch 拒绝 | concurrent-capture negative |

## 3. 高风险操作停止点

以下任一发生必须立即停止自动开发并请求用户确认：需要扩大 Cookie 白名单/host permission；需要 `<all_urls>`；需要绕过平台保护；需要保留原始媒体；需要云端 ASR；需要安装未签名/不可复算下载器；需要把 capture 变为后台自动启动；需要复制 BiliNote denylist 文件或 dirty diff。

## 4. 故障矩阵

至少覆盖：lease absent/mismatch/expired/revoked；字幕空/非法时间；yt-dlp 403/429/5xx/timeout/redirect/private-IP/oversize/nonzero exit；ffmpeg invalid media/hang/nonzero；ASR model missing/hash mismatch/empty/cancel；capture Chrome<116/wrong sender/tab/replay/grant expiry/stream ID expiry/并发 Offscreen/原声回放失败/socket loss/tab close/navigation；磁盘只读/满；Runtime/Background/Chrome restart；cleanup locked file/symlink/orphan process。

每个 fault 必须产生唯一 terminal 或 cleaning-failed 状态、机器失败码、0 后续写入和 0 泄漏。故障产物不得与 production positive 跨 run 拼接。

## 5. 剩余风险

- B站接口和 yt-dlp extractor 会漂移，必须通过版本冻结与 revision 2 实探测管理，不能承诺永久可用。
- tabCapture 是实时回退，速度受视频时长和浏览器生命周期限制；900 秒上限后允许 degraded，不承诺长视频完整捕获。
- CPU `small/int8` 的中文质量需要 3 个真实 120 秒 comparison window、两名人类共 48 项独立判断验证；未达阈值时只能回到 ADR 选择模型，不能宣称 ASR ready。
- V3-2 仅得到 transcript，不证明画面理解、总结质量或完整 V3 体验。
