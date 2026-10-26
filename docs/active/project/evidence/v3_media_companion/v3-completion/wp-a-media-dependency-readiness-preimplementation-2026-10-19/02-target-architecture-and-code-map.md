# WP-A 目标架构与代码实体

## 0 层

`MediaDependencySettingsPanel -> authenticated Runtime API -> MediaDependencyManager -> VerifiedDependencySnapshot -> build_media_downloader -> BilibiliMediaAcquirer`

架构图：`../../../../design/wp-a-media-dependency-readiness-prototype/architecture.html`。

## 实体与状态

| 状态 | 实体 | 责任 |
|---|---|---|
| 新增 | `media_companion/dependencies/catalog.py` | 冻结 yt-dlp URL、3,072,469 bytes、摘要、版本、参数和网络限制 |
| 新增 | `media_companion/dependencies/contracts.py` | 状态、repair job、snapshot、固定失败码 |
| 新增 | `media_companion/dependencies/manager.py` | 聚合校验、单 job、下载、原子发布、恢复、generation |
| 修改 | `navia_runtime/app.py` | 构造 manager，新增四个 API；acquisition、视觉和 ASR provider factory 消费同一 task snapshot |
| 修改 | `apps/chrome-extension/src/runtimeClient.ts` | 严格类型客户端；沿用认证 loopback transport |
| 新增 | `MediaDependencySettingsPanel.tsx` | 状态、修复、进度、取消、分类恢复建议 |
| 修改 | `entrypoints/sidepanel/main.tsx` | 在现有 ASR 设置附近装配新组件 |
| 复用 | `asr/model_manager.py` | SenseVoice 安装和生效状态的唯一 owner |
| 复用 | `acquisition/downloaders/yt_dlp.py` | 运行参数、摘要与媒体沙箱约束 |

## 所有权和并发

- Runtime manager 是下载、校验、安装作业和 generation 的唯一 owner；Extension 只发固定命令和渲染状态。
- 只允许一个活动 repair job。并发 POST 返回 `V3_MEDIA_DEPENDENCY_JOB_ACTIVE`，不能启动第二次下载。
- managed root 固定为 `default_db_path().parent / "managed-tools"`（允许 `NAVIA_MEDIA_TOOL_ROOT` 覆盖到 Windows 持久目录）。目录必须位于该 canonical root、不得是 symlink；目录 `0700`、文件暂存 `0600`、提交后可执行文件 `0700`。
- 下载写 `staging/<jobId>/yt-dlp.part`。长度、SHA-256、可执行性与最小命令自检全部通过后，发布到内容寻址且不变的 `versions/yt-dlp/2026.08.19/<sha256>/yt-dlp`；执行 file fsync、atomic replace、parent-directory fsync，再原子写 active manifest。WP-A 不删除已发布版本。
- 取消、异常或重启清理未提交临时文件；旧 ready 文件不被覆盖。重启后从最终文件重新验证，不恢复虚假的 downloading/installing 成功态。
- `VerifiedDependencySnapshot` 内部字段固定为 `schemaVersion/generation/verifiedAt`，以及 `ytDlp|ffmpeg|ffprobe` 的 canonical path、version、byteLength、sha256，`asr` 的 effectiveModelId、catalogRevision、modelRoot、assetSetDigest。generation 为除 path/verifiedAt 外上述身份字段按 UTF-8、排序 key、无空白 canonical JSON 的 SHA-256，前缀 `depgen_`。
- `execute_media_acquisition` 在进入任何 route 前读取一次 snapshot，并把同一对象传入 `build_media_acquirers`、视觉 downloader resolver 和 transcript provider factory。现有进程级 `media_product_materializer.visual_downloader` 与零参数 `create_sensevoice_provider` 必须改为按 task snapshot 解析；不能保留第二条全局依赖 owner。
- manager 以 taskId 持有进程内 `DependencyLease`，直到 acquisition/transcript/product 路径进入既有 terminal cleanup。managed 版本在 WP-A 永不回收；system tool 在每次 subprocess 前复核摘要；ASR 若被既有卸载动作外部删除则本任务 fail closed，禁止切换到另一模型。WP-A 不改变 ASR uninstall 公共合同。

## 兼容边界

新 dependency API 是 WP-A 的版本化公共 loopback 合同；现有 media acquisition 请求/响应、SourceAuthority、Cookie 租约、Provider、relay v11 和既有媒体 FailureCode registry 不变。依赖未就绪时现有 acquisition 对外行为继续诚实 blocked；Settings 通过新 API 提供更精确诊断。

