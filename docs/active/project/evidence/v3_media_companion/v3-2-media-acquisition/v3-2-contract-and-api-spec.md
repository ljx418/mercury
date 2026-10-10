# V3-2 受控媒体获取、字幕、本地 ASR 与 Capture 合同规格

日期：2026-10-07。状态：`V3-2-1 LIMITED PASS / V3-2-2 REVISION 5 ROUTE B3 LIMITED PASS / V3-2-3 RESUMPTION DOCUMENT CANDIDATE`。历史 ASR 失败合同与 Revision 1..4 保持只读；SenseVoice 是 V3 development baseline，跨模型质量回退属于 V4。

## 1. 范围

本规格只冻结 V3-2：字幕解析、任务期媒体获取、本地 ASR、可信 `tabCapture` 回退、进度/取消和终态清理。关键帧、OCR、VLM、`VideoOutline`、Media Mindmap、Ask、持久 `MediaTaskStore`、导出和 V4 知识能力不属于本阶段。

V3-2 消费已通过 V3-1.3 的同 task `PortalCredentialLease`，不得延长、复制、序列化或把公开 `leaseId` 当访问能力。

## 2. 机器权威

- Schema：`contracts/v3_media_acquisition_contracts.schema.json`
- 历史 Production sample registry revision 2 Schema：`contracts/v3_media_acquisition_sample_registry.schema.json`（只读）
- 当前 Production sample registry revision 3 Schema：`contracts/v3_media_acquisition_sample_registry_v3.schema.json`
- 路线 B Production sample registry revision 4 Schema：`contracts/v3_media_acquisition_sample_registry_v4.schema.json`
- 路线 B3 Production sample registry revision 5 Schema：`contracts/v3_media_acquisition_sample_registry_v5.schema.json`
- V3-2-3 Transcript Execution v2 Schema：`contracts/v3_media_transcript_execution_v2.schema.json`
- V3-2-4 Capture Stream v1 Schema：`contracts/v3_media_capture_stream_v1.schema.json`
- V3-2-3/4 positive fixture：`fixtures/v3-media-pipeline-observability-positive.json`
- ASR comparison/review/adjudication Schema：`contracts/v3_asr_comparison_contracts.schema.json`
- Policy：`contracts/v3-media-acquisition-policy-registry.json`
- Positive：`fixtures/v3-media-acquisition-contract-positive.json`
- 49 cases（13 Schema + 36 semantic）：`fixtures/v3-media-acquisition-contract-fixtures.json`
- 样本基线：V3-1P revision 1；V3-2-0 必须用授权会话重探测并生成不可变 revision 2，不得修改 revision 1。

Revision 2 继续按原 Schema 和原结论保留，不得改写。Revision 3 必须通过新增 Schema，并由 semantic gate 再验证：12 个 sampleId/URL/sourceIdentity 唯一；分类计数精确为 6/3/1/1/1；`mediaId/playbackUnitId/partId/partIndex` 与 page context、server probe 相等；每项都有授权会话真实 probe、route availability、截图与 hash；ASR baseline 精确绑定 SenseVoice revision/weights，且 `crossModelQualityGate=deferred_to_v4`。每个 artifact 路径必须存在且 hash 可复算。Revision 3 的 `productionReady` 只表示样本和路线可进入 V3 生产矩阵，不表示模型达到跨模型生产质量认证。

Revision 4 作为历史路线 B 候选保留，不得修改。Revision 5 Route B3 是当前 V3-2-2 权威输入：保持 12 URL 与 6/3/1/1/1，固定三个 ASR 能力槽位和预绑定 acceptance fault；在 acquisition task 时按真实字幕发现得到 `runtime_no_subtitle` 或 `audited_subtitle_failure`，两类计数之和精确为 3。故障只存在于 acceptance runner；`MediaAcquirer`、Runtime API、环境配置和 portal registry 均不可表达。权威 B3 run 为 `v3-2-route-b3-20261007T014759Z`，已取得独立 `LIMITED PASS`。

V3-2-3 不复用 B3 已清理的私有音频。它只复用三个固定 slot 的身份与预绑定 acceptance-fault 基线，在全新单 run 内逐任务重新 acquisition，并在同一任务生命周期立即执行 SenseVoice。验收 runner 先执行真实字幕发现：0 候选直接媒体，存在候选时按 slot 固定故障一次后获取真实媒体；动态两类计数和必须为 3。产品 Runtime/API/env/Acquirer/registry 仍不得表达 fault。

Schema 描述公开、可持久的无秘密记录。Cookie envelope、Cookie 值、Netscape cookiefile 路径、capture ticket、Chrome media stream ID、原始音频路径和临时媒体绝对路径只存在于任务私有内存/目录，禁止进入公开 Schema。

## 3. 代码实体和所有权

| 实体 | 目标位置 | 责任 | 平台隔离 |
|---|---|---|---|
| `MediaAcquisitionCoordinator` | `services/local-runtime/navia_runtime/modules/media_companion/acquisition/` | 单 task 路由状态机、取消、终态与 cleanup barrier | 通用，不含 B站 URL/API/Cookie 名 |
| `MediaAcquirer` | 同上 `contracts.py` | `probe_subtitle/acquire_subtitle/acquire_audio/acquire_video` 通用接口 | 新门户实现同接口 |
| `BilibiliMediaAcquirer` | `.../acquisition/bilibili/` | bvid/cid/part 到字幕和媒体调用；只读当前会话可访问内容 | B站字段只留在 plugin |
| `SubtitleResolver` | `.../acquisition/subtitle_resolver.py` | 规范化凭据字幕、公开/页内字幕为 `MediaTranscript` | 不调用模型 |
| `TaskArtifactSandbox` | `.../acquisition/task_artifacts.py` | 随机 `0700` 目录、`0600` 文件、配额、symlink/hardlink 拒绝、终态扫描 | 不公开绝对路径 |
| `YtDlpMediaDownloader` | `.../acquisition/downloaders/` | 受限 argv 调用、固定版本/hash、无自更新/插件/任意 exec | 不生成业务事实 |
| `LocalAsrAdapter` | `.../asr/contracts.py` | 本地 ASR 通用接口 | 引擎可替换 |
| `FunAsrLlamaCppProviderAdapter` | `.../asr/funasr_llamacpp.py` | SenseVoiceSmall Q8 开发基线、冻结模型/hash、输出强类型 segments | 不上传云端 |
| `MediaCaptureController` | `apps/chrome-extension/entrypoints/background/` | 可信点击、目标 tab 复核、streamId 与 offscreen 生命周期 | 不读 Cookie/主 bearer |
| `MediaCaptureMessageRouter` | `apps/.../media_companion/capture/` | 精确 sender、task/tab/page binding、一次性 ticket | content script/普通 tab 拒绝 |
| `MediaCaptureOffscreen` | `apps/chrome-extension/entrypoints/media-capture-offscreen/` | 消费 streamId、MediaRecorder、专用 loopback 流、停止/清理 | 不持久化音频 |
| `MediaAcquisitionClient` | `apps/.../media_companion/acquisition/` | Side Panel/Workspace 共享 API 和状态 | UI 不直连平台/下载器/ASR |

## 4. 路由状态机

唯一顺序：

```text
created
  -> credentialed_subtitle
  -> credentialed_media_asr
  -> public_or_page_subtitle
  -> awaiting_trusted_capture_click
  -> trusted_tab_capture_asr
  -> cleaning
  -> succeeded | degraded | blocked | failed | cancelled
```

规则：

1. 每个 attempt 递增 `sequence`，不得并行竞速、静默跳过或事后重排。
2. 第一个成功 route 是 `selectedRoute`；成功后禁止继续后续 route。
3. 凭据 route 必须存在同 task、同 adapter、未过期、未撤销的进程内 lease。
4. `credentialed_media_asr` 只下载当前 part 的必要音频；V3-3 需要的视频 acquisition 必须使用同一 sandbox/cleanup 合同，但不计 V3-2 ASR 正例。
5. 公开/页内字幕不需要 Cookie，但仍绑定同一 `sourceIdentity` 和 task。
6. `trusted_tab_capture_asr` 必须等待用户在可见 Side Panel/Workspace 中点击，不允许 Background 自动开始。
7. 无 route 成功时，受限样本进入 `blocked`，低信号样本进入 `degraded`；不得使用标题、简介、评论或常识伪造 transcript。

## 5. Runtime API

所有 API 绑定 loopback、现有内存 bearer、精确 Extension Origin；generic proxy 不得调用 capture/credential 路径。

### 5.1 创建 acquisition

```text
POST /v1/media/acquisitions
Request: taskId, sourceIdentity, adapterId, mediaId, playbackUnitId, partId,
         consentPolicyId, consentPolicyRevision
Response: MediaAcquisitionTask public record
```

Runtime 用 `taskId` 查进程内 lease，不接受 Cookie、cookiefile、公开 leaseId 作为权限替代。相同 active task 的重复 POST 返回同一任务；不同 identity 的 taskId 冲突返回 `V3_MEDIA_TASK_INVALID`。

### 5.2 读取与取消

```text
GET    /v1/media/acquisitions/{taskId}
DELETE /v1/media/acquisitions/{taskId}
```

DELETE 是幂等取消：先设 cancel token，终止 downloader/ffmpeg/ASR/capture，再进入 cleaning。只有 cleanup receipt 通过后才返回 `cancelled`；超时或残留返回 `V3_MEDIA_CLEANUP_INCOMPLETE`，不能伪装取消成功。

### 5.3 Capture session

```text
POST /v1/media/acquisitions/{taskId}/capture-sessions
Response private: 256-bit captureTicket, expiresIn<=30s
Response public: MediaCaptureGrant (不含 ticket/tabId/streamId)

WS /v1/media/acquisitions/{taskId}/capture-stream?ticket=<one-shot>
```

WebSocket 首次握手消费 ticket；同 ticket 重放、断线重连或跨 task 失败。成功连接关联到单个任务和单个 offscreen producer，序号必须从 0 连续递增。Runtime 不把原始 chunk 写 EventStore/Trace；只写 task-private `0600` 音频并在 ASR 终态删除。

## 6. Chrome capture 协议

```text
visible trusted click
-> MediaAcquisitionClient creates capture session with Runtime bearer
-> trusted extension message(taskId, captureTicket, page identity)
-> Background verifies sender URL + active tab + registry adapter + current page identity
-> chrome.tabCapture.getMediaStreamId(targetTabId)
-> chrome.offscreen document consumes streamId
-> MediaRecorder WebM/Opus chunks -> dedicated loopback WebSocket
-> terminal/abort -> stop tracks -> close socket -> clear all in-memory capability
```

- Manifest 可新增 `tabCapture` 与 `offscreen`，但不得新增 `<all_urls>` 或等价全站 host 权限。
- `ChromeManifestPermissions` 冻结精确子集：必需权限为 `activeTab/scripting/sidePanel/storage/tabs/offscreen/tabCapture`；`cookies` 仍为 optional；B站 host 仍为 `https://*.bilibili.com/*` optional；Runtime loopback 两项保持 required host；Web Accessible Resource 只匹配 `https://www.bilibili.com/*`。禁止 `<all_urls>`、`http://*/*`、`https://*/*`。
- `tabCapture` 权限只允许在 Side Panel/Workspace 可信点击后的 grant 路径调用；拥有 manifest 权限不构成后台自动捕获授权。
- 冻结 `minimum_chrome_version=116`：该版本起 Service Worker 取得且未指定 `consumerTabId` 的 stream ID 才能由同 extension origin 的 Offscreen Document 消费。低版本必须在创建 grant 前返回 `V3_MEDIA_CAPTURE_GRANT_INVALID`，不得回退到 content script 录音。
- Offscreen 必须使用扩展内静态 HTML、`reasons=["USER_MEDIA"]` 和固定 justification；通过 `runtime.getContexts({contextTypes:["OFFSCREEN_DOCUMENT"]})` 复用或拒绝已有实例，同一普通 profile 最多一个 active Offscreen Document。
- Chrome stream ID 本身只能使用一次且会在浏览器定义的短窗口后失效，取得后必须立即交给 Offscreen `getUserMedia`；失败后销毁 grant/streamId，要求新的用户点击，不能用 30 秒 grant TTL 推断 stream ID 仍有效。
- 捕获 tab 音频会改变默认播放路径；Offscreen 必须把 capture stream 经 `AudioContext` 接回默认输出，生产验收期间用户仍应听到原视频声音。若恢复播放失败，本次 capture 失败并停止，不允许静默录音。
- content script、普通 extension tab、DevTools、错误 tab、过期 click、Back/reload 后旧 ticket 全部拒绝。
- tab 关闭、导航离开冻结 identity、播放器停止、用户取消、授权撤销、Runtime 离线或达到 900 秒上限立即停止。
- offscreen document 不保留 IndexedDB/Cache/Downloads/OPFS/FileSystem 内容。

## 7. 下载器与临时文件

- `yt-dlp` 使用 stable channel；V3-2-0 记录 exact version、可执行文件 SHA-256、来源和许可。禁用自更新、插件、配置文件自动读取、任意 `--exec`/postprocessor 命令和 shell 插值。
- 只用参数数组启动子进程；URL 必须由已注册 adapter 从冻结 page identity 构建，不接受任意用户 URL、文件 URL、localhost 或重定向到私网。
- `--no-playlist` 并显式选择当前 `partId/cid`；多 P 不得下载其他 part。
- cookiefile 位于随机 task 目录，目录 `0700`、文件 `0600`；文件名不含 task/account/bvid。cookiefile 生成后重新 `lstat`，symlink/hardlink/count/mode 不符即停。
- stdout/stderr 经过 secret redactor；命令行不含 Cookie 值；日志只保留 exit code、工具版本、字节计数、hash 和封闭失败码。
- 音频 512 MiB、视频 2 GiB、单任务 2.5 GiB 上限；超限终止并清理。
- `ffmpeg` 只读取 task-private 本地输入，禁用网络协议输入；输出 PCM/WAV 或冻结容器，由 argv 传参，不调用 shell。

## 8. Local ASR

V3 基线 profile：`funasr-llamacpp runtime-llamacpp-v0.2.6 / funasr-sensevoice-small-q8 / CPU / q8`。模型 revision `90c1c61912018b70ada0fcc024ea24aca62f2e63` 与 weights SHA-256 `4ae45c94422de949b387e2e0fb10d7e14e4c42c69db30c3444ecc7d4b844b7c5` 已由 V3-2-0c-1 冻结并完成真实安装；生产验收期间不得临时换模型或联网拉权重。

`LocalAsrAdapter.transcribe()` 输入 task-private 音频描述符和 cancel token，输出：

- 语言；
- 有序 `startMs/endMs/text/textSha256/confidence`；
- 输入音频 hash、模型 hash、输出 transcript hash；
- 本地执行与 cloudUpload=false 证明。

Hash 公式冻结为：`textSha256 = SHA-256(UTF-8(text))`，不做 Unicode 二次转义或换行改写；`contentSha256` 的输入按 segment 顺序连接 `segmentId + TAB + startMs + TAB + endMs + TAB + textSha256 + LF` 的 UTF-8 字节。`MediaTranscript.contentSha256`、`LocalAsrRecord.outputTranscriptSha256` 和 `MediaAcquisitionRecord.transcriptSha256` 必须逐字节相等。音频/媒体 hash 始终绑定原始文件字节。

空 transcript、逆序/重叠越界时间、hash 不匹配、取消后继续输出或模型 profile 漂移均 fail closed。

`speech_interval_overlap/v1` 在冻结 native runtime 不公开完整 VAD interval list 的约束下采用保守语义：adapter 从私有 stderr 提取开始/终态一致的 FSMN-VAD 总段数 `N`；SRT 必须恰有 `N` 个非空段。只有完全相等时才发布 `coverageRatio=1.0`，任何 count mismatch 均返回 `V3_MEDIA_TRANSCRIPT_COVERAGE_INDETERMINATE`。不得用 SRT 自身计数生成 VAD 分母，也不得估算未知遗漏时长来声称达到 90%。

## 9. 清理 barrier

终态前必须依次完成：停止 capture tracks/socket -> 终止并回收子进程 -> 关闭文件句柄 -> 删除 cookiefile/raw audio/raw video/temp subtitle -> 拒绝 symlink 跳转 -> 扫描 task root -> 写 `MediaCleanupReceipt` -> 删除空 task root。

`succeeded/degraded/blocked/failed/cancelled` 五种终态都要求 0 cookiefile、0 临时媒体、0 原始音频/视频、0 active capture、0 私有路径公开。Runtime 进程异常退出后，下一次启动只能清理带有效 owner manifest 的 Navia task root；不能扫描或删除任意用户目录。

## 10. Semantic validator 顺序

1. Schema-valid；2. registry/FailureCode 集合；3. 全对象 task/source identity；4. attempt sequence/time/status/fallback；5. route order/selected route；6. lease authority；7. capture grant authority；8. ASR profile/input/segment count；9. transcript 时间/hash，再核对 ASR output binding；10. terminal state；11. cleanup 时序/零残留；12. privacy audit；13. sample denominator/build/run binding。

关键判定冻结如下：

| 顺序 | 判定 | 失败码 |
|---|---|---|
| 3 | taskId 在 acquisition/capture/asr/transcript/cleanup 全相等；sourceIdentity 与 acquisition/transcript 相等；transcript 引用当前 acquisition | `V3_MEDIA_CROSS_TASK_REUSE`、`V3_MEDIA_CAPTURE_GRANT_INVALID` 或 `V3_MEDIA_TRANSCRIPT_PROVENANCE_INVALID` |
| 4 | sequence 从 1 连续；attempt 不重叠且 `startedAt <= completedAt`；failed 必须有 failureCode，succeeded 必须无 failureCode；fallbackReasonCodes 等于失败 attempt failureCode 按首次出现顺序去重后的数组 | `V3_MEDIA_ROUTE_ORDER_INVALID` |
| 5 | attempt route 必须是 policy 前缀；恰有一个首成功且为最后 attempt；selectedRoute 等于它，成功后不得继续 | `V3_MEDIA_ROUTE_ORDER_INVALID` |
| 6 | credential route 的 `authorityClass=credential_lease` 且 task lease 存在；authorityId 精确等于 task credentialLeaseId | `V3_MEDIA_LEASE_REQUIRED` 或 `V3_MEDIA_LEASE_TASK_MISMATCH` |
| 7 | capture route 必须有同 task/adapter grant；task.captureGrantId、成功 attempt.authorityId、grantId 三者相等；oneShot=true、persisted=false、state=consumed；TTL 不超过 30 秒且 attempt 开始时未过期 | `V3_MEDIA_CAPTURE_GRANT_REQUIRED`、`V3_MEDIA_CAPTURE_GRANT_INVALID` 或 `V3_MEDIA_CAPTURE_GRANT_EXPIRED` |
| 8 | ASR route 必须有冻结 profile 的 local/no-cloud record；成功 attempt 必须有 audio artifact；ASR input hash 等于该 artifact；segmentCount 等于 transcript | `V3_MEDIA_ASR_UNAVAILABLE` 或 `V3_MEDIA_ASR_OUTPUT_INVALID` |
| 9 | transcript route 等于 selectedRoute；segments 非空、有序、不重叠、在 duration 内；每个 text hash 和整体 content hash 按 §8 复算；先核对 acquisition/transcript hash，再核对 ASR output/transcript hash。前者失败返回 provenance，只有 transcript 本体已通过而 ASR output 不等时才返回 ASR output invalid | `V3_MEDIA_TRANSCRIPT_EMPTY`、`V3_MEDIA_TRANSCRIPT_PROVENANCE_INVALID` 或 `V3_MEDIA_ASR_OUTPUT_INVALID` |
| 10 | task.state 与 acquisition.status 一致；成功终态无 failureCode；cancelled 不得保留成功 acquisition/artifact | `V3_MEDIA_TASK_INVALID` 或 `V3_MEDIA_CANCEL_NOT_HONORED` |
| 11 | cleanup.terminalState 等于 task.state；cleanup 在最后处理完成后开始、在 task.terminalAt 前完成；passed=true 且六类残留计数全 0 | `V3_MEDIA_CLEANUP_INCOMPLETE` |
| 12 | 持久 Cookie/hash/path、公开原始媒体、账号/profile、generic proxy、跨 task artifact 和公开 secret hit 全为拒绝值 | `V3_MEDIA_PUBLIC_ARTIFACT_SECRET` |

任何前置失败只返回其唯一主要失败码，后续规则不得把失败覆盖成成功。49 个 fixture case 必须逐个执行；36 个 semantic case 在 Schema 层必须保持合法，且每个 case 只能修改一个 JSON Pointer。第 49 个 Schema 负例专门证明扩大 host 权限或加入 `<all_urls>` 会失败。

## 11. V3-1.3 Minor 继承义务

- V3-2 外审必须逐条复算全部 A01-A20 子字段，不能只抽 summary。
- V3-2 实施审计至少抽取 credential subtitle、credential media、public subtitle、capture、cancel/cleanup 五类 observation payload。
- 授权 Cookie 由用户临时提供给采集 session；独立审查只验证 secret scan，不打开或复制 Cookie 文件。

## 12. V3-2-0a ASR 模型管理公共接口

模型管理属于 Runtime 控制面，不进入 `MediaAcquisitionCoordinator` 的任务事实。固定 API 为 `GET /v1/asr/catalog`、`GET|PATCH /v1/asr/settings`、`POST /v1/asr/installations`、`GET|DELETE /v1/asr/installations/{jobId}`、`GET /v1/asr/installations/{jobId}/events`、`DELETE /v1/asr/models/{modelId}` 和 `PUT /v1/asr/models/import/{modelId}`。请求只接受 closed-set `modelId`；客户端 URL/hash/path/provider class/additional property 均拒绝。

公共响应只含 catalog descriptor、资源 profile、quality、installation job 和 requested/effective/fallback；不得含绝对模型目录、下载凭据、Cookie、音频或 transcript。下载源/redirect 必须匹配 Runtime allowlist，当前固定 Hugging Face 主站及官方冻结 CDN 后缀；重定向每跳重新校验。只有固定文件集合、字节数、SHA-256 和本地 provider self-test 全通过的目录可原子发布为 ready。

`faster-whisper-tiny` 是 bundled/immutable/fallback-only；`faster-whisper-small` 是 remote-verified/selectable 但 `failed_current_gate`；`funasr-sensevoice-small-q8` 是 `development_baseline`，仅在 verified/ready 后可选；Paraformer 仍不可选。未来 `LocalAsrAdapter` 只通过 `effectiveModelId` 获取 ready path，不读取设置 UI 状态或任意用户目录。跨模型退化检测和质量失败后的智能回退属于 V4。

## 13. V3-2-5..7 产品与出门合同

机器权威新增 `contracts/v3_media_transcript_exit_v1.schema.json`，包含三个互斥 receipt：

1. `ProductUiAcceptance`：四个精确 surface/viewport、五类可见状态、A01..A14、取消清理和新 task 重试。
2. `FaultMatrix`：F01..F14 各一次且 faultClass 唯一、唯一终态、终态后零写、零残留和零秘密，绑定 A01..A12。
3. `ExitCandidate`：12 个唯一样本、精确 6+3+1+1+1、至少一次真实 capture、三个全长 ASR、A01..A20、public/private/seal 引用，并强制 `independentAuditStatus=pending`、`v3_2Passed=false`。

Schema 只定义可持久公开 receipt；真实 Cookie、ticket、streamId、绝对路径、原始媒体和 private evidence 内容仍不得进入。候选不能自我晋级，独立审计结果只更新 stage gate/独立报告，不修改 sealed candidate。
