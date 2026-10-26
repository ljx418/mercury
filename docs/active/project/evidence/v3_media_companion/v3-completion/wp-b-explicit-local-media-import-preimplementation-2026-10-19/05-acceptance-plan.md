# WP-B 验收计划

## 固定矩阵（B01-B30，30/30 才可提交 checkpoint）

| ID | 场景与操作 | 生产路径 / oracle / 负例与清理 |
|---|---|---|
| B01 | 3 个 schema meta-validation、公共/内部 fixtures、资产 registry | schema/instance/semantic mutation 全绿；失败即合同 NO-GO |
| B02 | create 精确 body；逐项加入 fileName/path/url/hash/lastModified/额外字段 | 精确 body=201；mutation=400；writer/file/store secret=0 |
| B03 | task/source/route eligibility | 仅三自动 route 已失败且无 selected/capture/import/terminal 可创建 |
| B04 | OPTIONS、exact Origin/id、bearer、content script/proxy、token/header | 允许 methods/headers 精确；403 ORIGIN_MISMATCH、401 AUTH_REQUIRED/TOKEN_INVALID；拒绝发生在 writer 前 |
| B05 | uploadToken 43 字符、只返回一次、重放/跨 import/session | 首次合法连接消费；其余 TOKEN_INVALID；token 不落 store/log/status |
| B06 | GET/DELETE 与 envelope，含进程重启后 GET | no-store/字段/HTTP 精确；重启返回 persisted RUNTIME_RESTARTED，不是 404 |
| B07 | public state、store sequence、barrier phase mutations | 非法跳转、终态反转、bytes 回退、phase 越级、禁止列全部拒绝 |
| B08 | MIME 四项与不支持 MIME | 闭集进入；其他 TYPE_UNSUPPORTED；MIME 不替代 ffprobe |
| B09 | 0 B、2 GiB、2 GiB+1 | 0 REQUEST_INVALID；exact 允许；+1 SIZE_LIMIT；不分配大文件 |
| B10 | Content-Length 缺失/不等、encoding、chunked | writer 前 SIZE_MISMATCH/REQUEST_INVALID；staging=0 |
| B11 | ASGI 64 KiB、1 MiB+1、8 MiB transport chunks | 全部合法并被 writer 切成 <=1 MiB slice，累计/SHA 相同；无 `request.body()` |
| B12 | 客户端中断 0%/50%/EOF 前 | WRITE_FAILED/cancelled；writer 关闭、store terminal、staging=0、可重选 |
| B13 | MP4/WebM/MKV 真样本与伪 MIME/无视频流 | 三容器通过；伪装或无视频流 MEDIA_INVALID |
| B14 | 4h/+1ms、7680x4320/超限 | exact 可继续；超限固定失败且不启动 ASR/视觉 |
| B15 | ffprobe/ffmpeg 缺失、摘要变更、超时、非零、恶意输出 | 同 task WP-A snapshot；PREPARE_FAILED；进程组/双沙箱=0 |
| B16 | 空间 exact/one-under、task quota 临界 | exact 可继续；one-under DISK_SPACE_LOW；无 sparse/partial |
| B17 | WAV shape/hash/owner receipt | pcm_s16le/16k/mono、task-bound、durable；mutation 拒绝 |
| B18 | 1..8 分布式帧与 ImportedVisualReceipt | 真实非空帧、timestamp 单调、canonical receipt digest 与 task/source/media/hash 闭合 |
| B19 | coordinator bind 原子性 | route 正确；跨 task/source/generation/artifact mutation 拒绝；SourceAuthority 不变 |
| B20 | local route 禁止 downloader/credential/capture | dispatch=0；自动 route 顺序不变；不建 file authority |
| B21 | SenseVoice projection | >=1 非空单调 segment；route 正确；无 mock transcript |
| B22 | 图文产品链路 | Overview/Outline/Timeline/Mindmap 同任务；>=1 真实缩略图可见可跳转；不再下载 |
| B23 | durable barrier 正常与 hard-kill | T1/T2/T3、双 receipt 删除前、删除后 T4 前、transcript-terminal-first/visual-terminal-first；恢复 fail closed，成功残留=0 |
| B24 | 取消 awaiting/uploading/verifying/preparing | 只能 cancelled；XHR/worker/process/双沙箱=0；可重选 |
| B25 | cancel 与 ready/bind/terminal 竞争 | cancelled+无 input 或 ready+完整 input；单 cleanup owner、无终态反转 |
| B26 | 四非终态及五个 barrier phase hard kill 后重启 | store 行存在；GET 非 404；RUNTIME_RESTARTED 或 CLEANUP_INCOMPLETE；不自动续读/不假成功 |
| B27 | identity 切换、unmount、session generation | 旧导入 abort/cancel，不附着新页；File/name/token/storage 残留=0 |
| B28 | token/upload/probe/prepare deadline 与旧 callback 晚到 | deadline cleanup；terminal/store sequence 不变；active slot 释放 |
| B29 | registry 的真实 100 MB 资产走 Side Panel 产品路径 | input File -> public API；真实进度、转写、帧、工作台；RSS/heap 门槛；无声/无抢焦点 |
| B30 | registry 的真实 1 GB 资产 + 错误 UX/A11y | 非 sparse、真实有声动态视频；峰值有界；格式/空间/重启有下一步；键盘、tab ARIA、滚动通过 |

## B23/B26 durable oracle

每个注入点必须由新 Runtime 进程读取原 SQLite 与沙箱，不得复用 manager 对象。收据须列出 kill phase、store sequence、两个 manifest digests、文件存在性、重启 GET、cleanup residual。audio receipt 与 visual receipt 任一缺失时不得删原视频；二者齐全但未 T4 时恢复只能做幂等删除/失败收口，不能发布成功。manifest mismatch 必须保留不可验证对象并返回 CLEANUP_INCOMPLETE。

## B29/B30 资产与资源 oracle

资产规则来自 `docs/active/project/fixtures/v3-media-local-import-acceptance-assets-v1.json`。私有 seed 需先由 ffprobe 证明音视频流、SenseVoice 证明至少 3 个非空 segment、三个分布式帧证明至少 3 个不同 hash。随后使用 WP-A verified ffmpeg 真正编码到 96-112 MiB 与约 0.95-1.05 GiB；`st_blocks*512/fileSize >= 0.95`。禁止 sparse、truncate、尾部填零、metadata-only、mock transcript/frame。

公开证据只记录随机 run/task/import/product id、摘要、字节数、allocated ratio、资源峰值与相对 owned-temp 标签；不得记录 seed/output 绝对路径或原始媒体。finally 删除生成资产并证明 owned artifacts=0。

## 反假绿（false green）

- B29/B30 必须从真实 `<input type=file>`/Extension `File` 进入公开 create/content/status API；不得直调 manager、预置 artifact 或伪造 progress。
- B21 不注入 transcript；B22 不用历史缩略图或平台再下载。task/import/media/receipt hash 必须闭合。
- HTTP 200、ready、文件存在或 unit pass 不能单独证明成功；必须有真实转写、帧、同任务产品、双消费者收据与零残留。
- 失败测试必须断言 writer/worker/subprocess/store/两个沙箱/task selected input 的负向状态。
- 浏览器测试不得播放声音。可见 Chrome 先通知用户，集中一次、owned profile、`--mute-audio`、不碰用户 Chrome。

## 出门门槛

Fatal=0、Major=0；B01-B30 `30/30`；定向与一次集中回归全绿；v11 `50/50 + 16/16`；secret/path/raw-media scan=0；owned Runtime/Chrome/process/port/temp/profile/media=0；公共合同只限本包冻结增量。否则 `WP-B NO-GO`。
