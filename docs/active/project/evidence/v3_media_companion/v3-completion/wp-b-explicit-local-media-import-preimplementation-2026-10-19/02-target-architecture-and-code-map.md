# WP-B 目标架构与代码实体

架构图：`docs/active/project/design/wp-b-explicit-local-media-import-prototype/architecture.html`。

## 单一数据路径

`LocalMediaImportCard/Client -> authenticated local-import API -> LocalMediaImportManager + LocalMediaImportStore -> TaskArtifactSandbox -> LocalMediaPreparer -> media_visual_sandbox -> LocalMediaConsumerBarrier -> MediaAcquisitionCoordinator -> SenseVoice + VisualProductMaterializer`

## 代码实体

| 状态 | 实体 | 责任 |
|---|---|---|
| 新增 | `media_companion/local_import/contracts.py` | 公共状态、18 个失败码、内部 receipt、semantic validator |
| 新增 | `media_companion/local_import/store.py` | SQLite durable import/barrier 记录、事务、启动扫描 |
| 新增 | `media_companion/local_import/manager.py` | 会话、内存 token、流写、状态、取消、恢复、复合清理编排 |
| 新增 | `media_companion/local_import/preparer.py` | ffprobe、容器验证、16 kHz mono WAV、最多 8 帧视觉 receipt |
| 新增 | `media_companion/local_import/consumer_barrier.py` | ASR/视觉双消费者 durable barrier 与清理唯一 owner |
| 修改 | `navia_runtime/app.py` | 四个认证 API、privileged Origin/CORS、manager/store 装配 |
| 修改 | `acquisition/coordinator.py` | `bind_local_import`、route-aware completion、同 task/authority 约束 |
| 修改 | `acquisition/task_artifacts.py` | 受控流式 writer；内部切片、quota、owner、原子 publish |
| 修改 | `acquisition/transcript_service.py` | local route 完成时通知 barrier，禁止提前调用 acquisition cleanup |
| 修改 | `transcript_projection.py`、`audio_ref.py` | `explicit_local_media_asr` 使用现有音频引用与投影 |
| 修改 | `product_materializer.py` | 仅消费 ImportedVisualReceipt；视觉终态通知 barrier；禁止再次下载 |
| 修改 | `apps/chrome-extension/src/runtimeClient.ts` | 严格 JSON API + XHR raw upload + generation guard |
| 新增 | `LocalMediaImportCard.tsx` | 用户选择、真实进度、取消、错误恢复 |
| 修改 | `MediaCompanionLaunchCard.tsx`、`sidepanel/main.tsx` | blocked 后显示导入入口；成功进入同一 workspace |

## 所有权

- Browser `File` 只由 Side Panel 持有；Runtime 永远看不到本机路径或文件名。
- `LocalMediaImportManager` 是进程内 import worker、upload token、writer 与取消编排 owner。
- `LocalMediaImportStore` 是跨请求和跨重启状态真值；不得保存 token、文件名、浏览器路径或沙箱绝对路径。
- `TaskArtifactSandbox` 是 acquisition 字节、quota、权限、SHA 与原子 publish owner；`media_visual_sandbox` 是帧与视觉 manifest owner。
- `LocalMediaConsumerBarrier` 是两个沙箱与 route-aware terminal cleanup 的唯一 owner；ASR 和 materializer 只能提交终态 receipt，不得各自清理共享输入。
- `MediaAcquisitionCoordinator` 继续是 task/source/selected input owner；不另建任务或第二 SourceAuthority。
- `MediaDependencyManager` 为 task 固定 ffmpeg/ffprobe/SenseVoice generation，运行中不得切换。

## LocalMediaImportStore

使用 Runtime 数据库中的独立 SQLite 表 `media_local_imports_v1`，主键 `import_id`，`task_id` 对非终态建唯一索引。字段固定为：`import_id/task_id/source_identity/state/sequence/byte_length/uploaded_bytes/declared_media_type/dependency_generation/video_manifest_sha256/visual_receipt_sha256/barrier_phase/failure_code/created_at/updated_at`。禁止列：token、token digest、文件名、客户端路径、沙箱路径、Cookie、原始异常。

所有状态变化使用 `BEGIN IMMEDIATE`、`PRAGMA synchronous=FULL`、单事务 CAS（`WHERE sequence=? AND state IN (...)`）、commit 后再向客户端返回。启动时扫描所有非终态以及 barrier 未 `cleaned` 的记录；不恢复 File 或 worker，统一转换为 `failed/RUNTIME_RESTARTED` 后由 barrier 校验 manifests 并清理。manifest/hash 不匹配时返回 `CLEANUP_INCOMPLETE`，保留不可验证对象供人工处理，禁止盲删。GET 必须返回该持久终态，不能因进程重启变为 404。

## durable handoff 与删除顺序

公共状态的 `ready` 仅表示导入已绑定并可由产品流水线消费，不表示产品完成。内部 receipt 合同见 `v3_media_local_import_internal_v1.schema.json`。

1. 视频 file fsync、owner manifest 原子 replace、父目录 fsync；事务 T1 写 `video_durable`。
2. preparer 发布 WAV artifact 和 1..8 个 frame artifact；`ImportedVisualReceipt` 使用 canonical JSON bytes 原子写入视觉沙箱并记录 SHA-256；事务 T2 写 `inputs_prepared`。
3. coordinator 锁内核对 task/source/generation/两个 manifest，绑定 route；事务 T3 写 `input_bound`。
4. `TaskAudioStager.stage()` 同步提交 owner manifest 与 SQLite receipt；barrier 校验 audio receipt、visual receipt、media hash 后写 `audio_staged`。
5. 只有 T3、audio owner receipt 和 visual receipt 全 durable 后才删除原视频；验证删除完成后事务 T4 写 `video_deleted`，然后启动异步 ASR。任何更早删除均为 Fatal。
6. ASR terminal 回调只写 `transcript_terminal`；视觉产品完成截图/OCR/evidence manifest 后只写 `visual_terminal`。两者先后顺序均合法。
7. 第二个 terminal receipt 到达时，barrier 原子 claim `cleaning`，调用 coordinator route-aware completion、audio cleanup、visual sandbox 非证据帧 cleanup；双沙箱 residual=0 后写 `cleaned`。失败/取消同样由 barrier 单点收口。

现有 `SenseVoiceTranscriptService` 的 unconditional acquisition cleanup 必须对 local route 改为 barrier callback；不得靠延长全局 TTL、复制到非受控目录或由两个消费者分别清理规避。

## 恢复与 hard-kill

- hard kill 只覆盖生产可达点：T1 后准备未完成、T2 后 bind 未提交、T3 后 audio owner receipt 未提交、audio owner + visual receipt 已齐但原视频未删、原视频已删但 T4 未提交、`transcript-terminal-first`、`visual-terminal-first`。不存在“audio owner receipt 先于 T2 visual receipt”或“删视频后 T3 尚未提交”的伪注入点。
- 新 Runtime 不恢复上传或转码；根据 store phase 和经 SHA 验证的 manifests 做幂等清理，最终公开状态为 `RUNTIME_RESTARTED` 或 `CLEANUP_INCOMPLETE`。
- 删除前必须证明对象属于同 task/import 且 manifest digest 一致；删除后 commit 前崩溃时，重启允许“文件已不存在 + T3 和双 receipt 有效”推进至 T4，但不得发布产品成功。
- 每 task 只允许一个非终态 import；并发 create 返回 `IMPORT_ACTIVE`。terminal CAS 防止旧 worker/旧 sequence 覆盖。

## 架构冲击

- 公共新增四个 loopback endpoint、两个公共 schema、18 个 import failure code；新增一个内部 durable schema，不扩张 relay v11 的 40/20 code universe。
- coordinator 增加一个 selected route 和 route-aware cleanup；自动 route 顺序、Cookie、capture 与 SourceAuthority key 不变。
- 最大冲击是把 local route 的 acquisition cleanup 从 transcript 单消费者迁移到持久双消费者 barrier；必须由 B23/B26 hard-kill 证明。
- local route 的视觉只能来自 ImportedVisualReceipt，不允许重新下载、读取任意路径或只产出文本。
