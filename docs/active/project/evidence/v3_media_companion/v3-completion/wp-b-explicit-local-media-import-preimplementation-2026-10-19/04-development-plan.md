# WP-B 开发计划

## B0 文档与合同门禁

- 运行本包 verifier；3 个 schema meta-validation、公共/内部 fixtures、资产 registry、语义 mutations 全绿。
- 核对 WP-A checkpoint 与 v11 `50/50 + 16/16`；WP-B 不修改历史 relay。
- 冻结 18 码、SQLite 字段、barrier phase、CORS/Origin/bearer 顺序、30 个验收 case 后才改产品代码。

## B1 contracts、store 与 manager

- 实现公共/内部 dataclass、18 码 semantic validator、`LocalMediaImportStore` 和 manager。
- SQLite `BEGIN IMMEDIATE + synchronous=FULL + sequence CAS`；单 active import；token 只在内存。
- 启动扫描、terminal guard、cancel/join、manifest-aware cleanup；重启 GET 必须返回持久失败而非 404。
- 所有磁盘动作委托沙箱；writer 内部 `memoryview` 切成 <=1 MiB slices，不限制 ASGI transport chunk。

## B2 认证 API 与 streaming

- `app.py` privileged paths 纳入四个 API，补 PUT、精确 allowed headers 与 exact extension Origin。
- 拒绝顺序：Origin -> bearer -> contract/token -> writer；每条负例证明 writer 未创建。
- 禁止 `request.body()`、Base64、multipart 全量加载；disconnect/cancel/deadline 走同一复合清理。

## B3 媒体验证与 preparation

- 复用同 task WP-A ffprobe/ffmpeg snapshot；严格 argv、`-nostdin`、deadline、进程组 cleanup。
- 检查 container/video stream/duration/dimensions；输出 16 kHz mono WAV。
- 在视觉沙箱原子发布 1..8 帧与 canonical `ImportedVisualReceipt`；stderr 不出界。

## B4 coordinator 与双消费者 barrier

- `bind_local_import()` 锁内验证 task/source/generation/audio/video/visual receipts，发布 `explicit_local_media_asr`。
- 扩展 audio reference、projection 与 materializer route 闭集；local route downloader/credential/capture dispatch=0。
- 实现 T1-T4 durable 顺序。ASR stage receipt + visual receipt 都 durable 后才删原视频。
- 把 transcript local-route cleanup 改为 barrier terminal callback；materializer 同样只提交 terminal receipt。第二个 terminal 到达后 barrier 单点清理双沙箱。
- 为 T1/T2/T3、双 receipt 后删除前、删除后 T4 前、`transcript-terminal-first` 与 `visual-terminal-first` 写新进程重启 tests；禁止不可达注入点。

## B5 Extension client 与组件

- 严格 runtime types；XHR generation guard、真实 byte progress、abort、error normalization。
- `LocalMediaImportCard` 只在 eligible blocked state 显示；隐藏 input 由主按钮触发，单文件 accept。
- 文件名只存在组件内存/DOM，terminal/unmount 清空；不进 storage、请求或日志。
- 顶部状态/计时器显示 upload/verifying/preparing/transcribing/materializing，不新增状态卡片堆。
- 原型 tabs 必须具备 tablist/tab/tabpanel、aria-controls/selected；状态样例使用 aria-pressed。

## B6 restart 与恢复

- identity、unmount、session generation、取消、expiry 统一 abort/cancel。
- 新 Runtime 不恢复 File/worker；store 行转 `RUNTIME_RESTARTED`，校验 manifests 后 cleanup；不匹配为 `CLEANUP_INCOMPLETE` 且不盲删。
- ready/failed/cancelled GET/DELETE 幂等；旧 worker/XHR/sequence 不覆盖 terminal。

## B7 自动化验收

- 实现 B01-B28 deterministic tests 与真实 owned Runtime hard-kill probe。
- B29/B30 使用 `v3-media-local-import-acceptance-assets-v1.json`：私有真实有声种子经过 SenseVoice/动态帧预检，再由 WP-A verified ffmpeg 实际转码扩展；禁止 sparse/truncate/padding/mock。
- 记录 seed probe digest、argv digest、输出 SHA/size/st_blocks/ffprobe digest；媒体和绝对路径只留在 owned temp/private receipt，不进公开证据。
- 资源门槛：Runtime RSS delta <=256 MiB、Extension JS heap delta <=128 MiB、writer slice <=1 MiB、结束 owned artifacts=0。
- B29/B30 UI 集中一次，优先 headless；可见 Chrome 必须先通知用户、owned profile、`--mute-audio`、不抢焦点。

## B8 证据与停止

- 受影响测试用于内循环；workpack 稳定后仅一次集中回归与一个 Codex checkpoint。
- 写 implementation receipt、case results、PRD review、cleanup、handoff、manifest；v11 保持绿，secret/path/raw-media scan=0。
- 全绿写 `WP-B AWAITING CODEX CHECKPOINT` 并停止；不宣布 PASS、不进 WP-C、不做 Claude 文档外审。

## 固定测试入口

交付必须包含：contracts/store/manager/API/preparer/barrier/coordinator tests；Extension client/component/orchestration tests；真实 restart/hard-kill probe；私有资产生成/校验 probe；Runtime media focused；Extension media subtree；typecheck；build；v11 baseline/mutations。全量测试只在集中回归运行一次并限制并发。
